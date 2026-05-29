#!/usr/bin/env python3
r"""
02_pdf_to_images.py - PDF裁切+OCR过滤+公盘存储

功能：
1. 读取待处理的PDF列表（从 scan_state.db）
2. 将PDF每页转换为图片，存入公盘目录
3. OCR识别过滤无作业名称的页面（封面/目录等）
4. 缓存OCR结果，避免重复处理

图片存储规则：
- 源: \\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)\...\xxx.pdf
- 目标: \\cnszxapp01\BTC Data\10-Mose\pdf-images\{pdf_name_without_ext}\{1,2,3...}.jpg
"""

import os
import sys
import json
import sqlite3
import fitz
import base64
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.pdf_scan_state import PDFScanState, STATE_DB

# ============== 路径配置 ==============
BASE_DIR = Path(__file__).parent.parent.absolute()
DATA_DIR = BASE_DIR / "data"
SOURCE_DIR = Path(r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)")
IMAGE_DIR = (
    Path(r"\\cnszxapp01\BTC Data\10-Mose\pdf-images")
    if Path(r"\\cnszxapp01\BTC Data\10-Mose\pdf-images").exists()
    else DATA_DIR / "pdf_images"
)
OCR_CACHE_DB = DATA_DIR / "ocr_cache.db"
LOG_DIR = DATA_DIR / "logs"

# ============== 配置 ==============
MAX_IMAGE_SIZE_KB = 3000  # 最大图片大小KB
DPI_START = 120           # 初始DPI
DPI_MIN = 60              # 最小DPI
JPG_QUALITY = 85          # JPEG质量

# ============== 日志配置 ==============
def setup_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / f"pdf_images_{datetime.now().strftime('%Y%m%d')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - [%(threadName)s] %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()


class OCRCacheDB:
    """OCR结果缓存数据库"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化OCR缓存表"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ocr_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id TEXT NOT NULL UNIQUE,
                pdf_path TEXT NOT NULL,
                page_num INTEGER NOT NULL,
                job_name TEXT,
                part_numbers TEXT,
                project TEXT,
                keywords TEXT,
                ocr_time TEXT NOT NULL,
                UNIQUE(pdf_path, page_num)
            )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_doc_id ON ocr_cache(doc_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pdf_path ON ocr_cache(pdf_path)')

        conn.commit()
        conn.close()

    def get_ocr_result(self, pdf_path: str, page_num: int) -> Optional[dict]:
        """获取缓存的OCR结果"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute(
            "SELECT doc_id, job_name, part_numbers, project, keywords FROM ocr_cache WHERE pdf_path = ? AND page_num = ?",
            (pdf_path, page_num)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'doc_id': row[0],
                'job_name': row[1],
                'part_numbers': json.loads(row[2]) if row[2] else [],
                'project': row[3],
                'keywords': json.loads(row[4]) if row[4] else []
            }
        return None

    def save_ocr_result(self, doc_id: str, pdf_path: str, page_num: int, job_name: str,
                        part_numbers: list, project: str, keywords: list):
        """保存OCR结果"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO ocr_cache
            (doc_id, pdf_path, page_num, job_name, part_numbers, project, keywords, ocr_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            doc_id, pdf_path, page_num, job_name,
            json.dumps(part_numbers, ensure_ascii=False),
            project,
            json.dumps(keywords, ensure_ascii=False),
            datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()

    def is_processed(self, pdf_path: str, page_num: int) -> bool:
        """检查页面是否已处理"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM ocr_cache WHERE pdf_path = ? AND page_num = ? AND job_name IS NOT NULL AND job_name != '__NO_JOB__'",
            (pdf_path, page_num)
        )
        exists = cursor.fetchone() is not None
        conn.close()
        return exists


class PDFToImages:
    """PDF转图片处理器"""

    def __init__(self, image_dir: Path):
        self.image_dir = image_dir
        self.image_dir.mkdir(parents=True, exist_ok=True)
        self.ocr_cache = OCRCacheDB(OCR_CACHE_DB)

        # 视觉识别API配置
        try:
            from dashscope import MultiModalConversation
            self.vision_api = MultiModalConversation
            self.vision_available = True
        except ImportError:
            logger.warning("dashscope 未安装，OCR功能不可用")
            self.vision_available = False

    def generate_doc_id(self, pdf_path: str, page_num: int) -> str:
        """生成唯一doc_id：PDF_hash前8位 + 页码"""
        file_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:8]
        safe_name = Path(pdf_path).stem
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ' -_')
        return f"{safe_name}_{file_hash}_p{page_num}"

    def get_image_path(self, pdf_path: str, page_num: int) -> Path:
        """获取图片存储路径"""
        pdf_name = Path(pdf_path).stem  # 去后缀
        # 清理文件名
        safe_name = "".join(c for c in pdf_name if c.isalnum() or c in ' -_()（）')
        folder = self.image_dir / safe_name
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{page_num}.jpg"

    def pdf_to_image(self, pdf_path: str, page_num: int) -> Tuple[bytes, Path]:
        """将PDF单页转换为图片"""
        doc = fitz.open(pdf_path)
        page = doc[page_num]

        dpi = DPI_START
        img_path = self.get_image_path(pdf_path, page_num)

        while dpi >= DPI_MIN:
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg", jpg_quality=JPG_QUALITY)

            if len(img_bytes) <= MAX_IMAGE_SIZE_KB * 1024:
                doc.close()
                return img_bytes, img_path

            dpi -= 10

        # 最后手段：最低DPI
        mat = fitz.Matrix(DPI_MIN / 72, DPI_MIN / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg", jpg_quality=70)
        doc.close()
        return img_bytes, img_path

    def recognize_page_info(self, image_bytes: bytes, pdf_path: str, page_num: int) -> dict:
        """OCR识别页面信息，返回job_name, part_numbers等"""
        doc_id = self.generate_doc_id(pdf_path, page_num)

        # 先检查缓存
        cached = self.ocr_cache.get_ocr_result(pdf_path, page_num)
        if cached:
            logger.debug(f"  页{page_num+1}: 使用缓存OCR结果")
            return cached

        if not self.vision_available:
            # 无法OCR时，假设所有页面都需要
            result = {'doc_id': doc_id, 'job_name': '__UNKNOWN__', 'part_numbers': [], 'project': '', 'keywords': []}
            self.ocr_cache.save_ocr_result(**result, pdf_path=pdf_path, page_num=page_num)
            return result

        # 调用视觉识别API
        img_base64 = base64.b64encode(image_bytes).decode('utf-8')

        messages = [{
            "role": "user",
            "content": [
                {"image": f"data:image/jpeg;base64,{img_base64}"},
                {"text": """识别这张SOP页面，返回JSON格式：
{
    "job_name": "作业名称（如PA2720），如果是封面/目录/修订历史等无内容页面，返回"__NO_JOB__"
    "part_numbers": ["零件编号列表"],
    "project": "项目名称",
    "keywords": ["其他关键词"]
}
只返回JSON，不要其他说明。"""}
            ]
        }]

        try:
            response = self.vision_api.call(model='qwen3-omni-flash-2025-12-01', messages=messages)

            if response.status_code == 200:
                content = response.output.choices[0].message.content
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and 'text' in item:
                            text = item['text'].strip()
                            break
                    else:
                        text = ""
                else:
                    text = content.strip() if content else ""

                # 解析JSON
                if '{' in text and '}' in text:
                    json_start = text.index('{')
                    json_end = text.rindex('}') + 1
                    text = text[json_start:json_end]
                    data = json.loads(text)

                    result = {
                        'doc_id': doc_id,
                        'job_name': data.get('job_name', '__NO_JOB__'),
                        'part_numbers': data.get('part_numbers', []),
                        'project': data.get('project', ''),
                        'keywords': data.get('keywords', [])
                    }
                else:
                    result = {'doc_id': doc_id, 'job_name': '__NO_JOB__', 'part_numbers': [], 'project': '', 'keywords': []}
            else:
                logger.warning(f"  OCR API返回错误: {response.code}")
                result = {'doc_id': doc_id, 'job_name': '__NO_JOB__', 'part_numbers': [], 'project': '', 'keywords': []}

        except Exception as e:
            logger.error(f"  OCR识别异常: {e}")
            result = {'doc_id': doc_id, 'job_name': '__NO_JOB__', 'part_numbers': [], 'project': '', 'keywords': []}

        # 缓存结果
        self.ocr_cache.save_ocr_result(
            doc_id=result['doc_id'],
            pdf_path=pdf_path,
            page_num=page_num,
            job_name=result['job_name'],
            part_numbers=result['part_numbers'],
            project=result['project'],
            keywords=result['keywords']
        )

        return result

    def process_page(self, pdf_path: str, page_num: int) -> Optional[dict]:
        """处理单个页面：转图片 + OCR"""
        try:
            # 1. 转换为图片
            img_bytes, img_path = self.pdf_to_image(pdf_path, page_num)

            # 2. 保存图片到公盘
            with open(img_path, 'wb') as f:
                f.write(img_bytes)

            # 3. OCR识别
            ocr_result = self.recognize_page_info(img_bytes, pdf_path, page_num)

            # 4. 返回结果
            return {
                'doc_id': ocr_result['doc_id'],
                'pdf_path': pdf_path,
                'page_num': page_num + 1,  # 1-based
                'image_path': str(img_path),
                'job_name': ocr_result['job_name'],
                'part_numbers': ocr_result['part_numbers'],
                'project': ocr_result['project'],
                'keywords': ocr_result['keywords'],
                'skipped': ocr_result['job_name'] in ('__NO_JOB__', '__UNKNOWN__')
            }

        except Exception as e:
            logger.error(f"  页{page_num+1} 处理失败: {e}")
            return None

    def process_pdf(self, pdf_path: str) -> Tuple[int, int, List[dict]]:
        """处理单个PDF的所有页面

        Returns:
            (indexed_count, skipped_count, pages)
        """
        logger.info(f"处理PDF: {Path(pdf_path).name}")

        try:
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()
        except Exception as e:
            logger.error(f"  打开PDF失败: {e}")
            return 0, 0, []

        indexed_count = 0
        skipped_count = 0
        pages = []

        for page_num in range(page_count):
            result = self.process_page(pdf_path, page_num)

            if result:
                if result['skipped']:
                    logger.info(f"  页{page_num+1}: [跳过] {result['job_name']}")
                    skipped_count += 1
                else:
                    logger.info(f"  页{page_num+1}: ✓ {result['job_name']}")
                    indexed_count += 1
                    pages.append(result)
            else:
                skipped_count += 1

        return indexed_count, skipped_count, pages

    def process_batch(self, pdf_paths: List[str], max_workers: int = 4) -> List[dict]:
        """批量处理多个PDF（多线程）"""
        all_pages = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.process_pdf, pdf_path): pdf_path
                for pdf_path in pdf_paths
            }

            for i, future in enumerate(as_completed(futures), 1):
                pdf_path = futures[future]
                try:
                    indexed, skipped, pages = future.result()
                    all_pages.extend(pages)
                    logger.info(f"[{i}/{len(pdf_paths)}] 完成: {Path(pdf_path).name} (+{indexed} -{skipped})")
                except Exception as e:
                    logger.error(f"[{i}/{len(pdf_paths)}] 失败: {Path(pdf_path).name} - {e}")

        return all_pages


def run_image_conversion(scan_state_db: Path = STATE_DB, max_workers: int = 4) -> dict:
    """执行图片转换主流程"""
    logger.info("=" * 60)
    logger.info("开始PDF转图片处理")
    logger.info(f"源目录: {SOURCE_DIR}")
    logger.info(f"图片目录: {IMAGE_DIR}")
    logger.info(f"OCR缓存: {OCR_CACHE_DB}")
    logger.info("=" * 60)

    # 1. 读取待处理的PDF
    scan_state = PDFScanState(scan_state_db)
    pending_pdfs = scan_state.get_pending_pdfs()

    if not pending_pdfs:
        logger.info("没有待处理的PDF")
        return {'indexed': 0, 'skipped': 0, 'pages': []}

    logger.info(f"待处理PDF: {len(pending_pdfs)} 个")

    # 2. 处理
    processor = PDFToImages(IMAGE_DIR)
    all_pages = processor.process_batch(
        [p['path'] for p in pending_pdfs],
        max_workers=max_workers
    )

    # 3. 更新状态
    for pdf_path in [p['path'] for p in pending_pdfs]:
        scan_state.update_record(pdf_path, {'name': Path(pdf_path).name}, status='processed')

    # 4. 统计
    indexed = [p for p in all_pages if not p['skipped']]
    skipped = [p for p in all_pages if p['skipped']]

    logger.info(f"\n处理完成:")
    logger.info(f"  有效页面: {len(indexed)} 页")
    logger.info(f"  跳过页面: {len(skipped)} 页")

    return {
        'indexed': len(indexed),
        'skipped': len(skipped),
        'pages': all_pages
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description='PDF转图片处理')
    parser.add_argument('--workers', type=int, default=4, help='并发数（默认4）')
    parser.add_argument('--stats', action='store_true', help='查看OCR缓存统计')
    parser.add_argument('--test', type=str, help='测试处理单个PDF')

    args = parser.parse_args()

    if args.stats:
        ocr_cache = OCRCacheDB(OCR_CACHE_DB)
        conn = sqlite3.connect(str(OCR_CACHE_DB))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM ocr_cache")
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM ocr_cache WHERE job_name NOT IN ('__NO_JOB__', '__UNKNOWN__')")
        valid = cursor.fetchone()[0]
        conn.close()
        print(f"\nOCR缓存统计:")
        print(f"  总记录: {total}")
        print(f"  有效页面: {valid}")
        print(f"  跳过页面: {total - valid}")
        return

    if args.test:
        processor = PDFToImages(IMAGE_DIR)
        indexed, skipped, pages = processor.process_pdf(args.test)
        print(f"\n测试结果:")
        print(f"  有效: {indexed} 页")
        print(f"  跳过: {skipped} 页")
        for p in pages:
            print(f"  - {p['doc_id']}: {p['job_name']}")
        return

    # 执行图片转换
    result = run_image_conversion(max_workers=args.workers)

    # 保存结果到JSON（供03_build_chroma.py使用）
    output_file = BASE_DIR / "data" / "image_conversion_result.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    logger.info(f"结果已保存: {output_file}")


if __name__ == "__main__":
    main()
