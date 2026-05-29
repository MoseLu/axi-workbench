#!/usr/bin/env python3
"""
pdf_processor.py - PDF处理核心模块（改进版）

功能：
1. PDF转图片
2. OCR识别（带重试机制）
3. 状态持久化

改进：
- OCR重试机制（指数退避）
- 断点续传（失败后可恢复）
- 统一状态管理
"""

import os
import sys
import time
import base64
import hashlib
import sqlite3
import fitz
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from .config import DIR, DB, PROCESS, setup_logging
    from .state_manager import StateManager, PageStatus
except ImportError:
    from config import DIR, DB, PROCESS, setup_logging
    from state_manager import StateManager, PageStatus

logger = setup_logging("pdf_processor", "pdf_processor")

# OCR警告日志限流（最多打印5次，避免终端噪音）
_ocr_warn_count = 0
_ocr_warn_max = 5
_ocr_warn_done = False  # 超过上限后静默

# OCR断路器：连续失败超过此数直接静默跳过，不再重试日志
_CIRCUIT_FAIL_LIMIT = 10
_circuit_fail_count = 0


def _log_ocr_warn_once(msg: str):
    """OCR警告日志，最多打印5次"""
    global _ocr_warn_count, _ocr_warn_done
    if _ocr_warn_done:
        return
    if _ocr_warn_count < _ocr_warn_max:
        _ocr_warn_count += 1
        logger.warning(msg)
    else:
        _ocr_warn_done = True
        logger.warning("OCR持续失败，已切换静默模式，后续不再打印。")


def _trip_circuit():
    """触发断路器，跳过OCR并静默"""
    global _circuit_fail_count, _ocr_warn_count, _ocr_warn_done
    _circuit_fail_count += 1
    if _circuit_fail_count >= _CIRCUIT_FAIL_LIMIT:
        _ocr_warn_count = _ocr_warn_max  # 让所有后续警告静默
        _ocr_warn_done = True


def _reset_circuit():
    """成功后重置断路器"""
    global _circuit_fail_count, _ocr_warn_count, _ocr_warn_done
    if _circuit_fail_count > 0:
        _circuit_fail_count = 0


@dataclass
class OCRResult:
    """OCR识别结果"""
    doc_id: str
    job_name: str = ""
    part_numbers: List[str] = None
    project: str = ""
    keywords: List[str] = None
    success: bool = False
    error: str = ""
    skipped: bool = False

    def __post_init__(self):
        if self.part_numbers is None:
            self.part_numbers = []
        if self.keywords is None:
            self.keywords = []


class PDFProcessor:
    """PDF处理器"""

    def __init__(self, state_manager: StateManager = None):
        self.state = state_manager or StateManager()
        self.image_dir = DIR.IMAGE_DIR
        self.image_dir.mkdir(parents=True, exist_ok=True)
        self.staging_dir = DIR.STAGING_DIR
        self.staging_dir.mkdir(parents=True, exist_ok=True)

        # 视觉识别API
        self._vision_api = None
        self._embedding_api = None
        self._apis_available = None

    def _check_apis(self) -> bool:
        """检查API是否可用"""
        if self._apis_available is None:
            try:
                from dashscope import MultiModalConversation, TextEmbedding
                self._vision_api = MultiModalConversation
                self._embedding_api = TextEmbedding
                self._apis_available = True
            except ImportError:
                logger.warning("dashscope 未安装，部分功能不可用")
                self._apis_available = False
        return self._apis_available

    # ============== 文件操作 ==============

    @staticmethod
    def generate_doc_id(pdf_path: str, page_num: int) -> str:
        """生成唯一doc_id：文件名_hash前8位_页码"""
        file_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:8]
        safe_name = Path(pdf_path).stem
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ' -_')
        return f"{safe_name}_{file_hash}_p{page_num}"

    def get_image_path(self, pdf_path: str, page_num: int) -> Path:
        """获取图片存储路径（使用哈希分类文件夹）"""
        pdf_name = Path(pdf_path).stem
        file_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:12]
        safe_name = "".join(c for c in pdf_name if c.isalnum() or c in ' -_()（）')
        folder = self.image_dir / file_hash
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{page_num}.jpg"

    # ============== PDF转图片 ==============

    def pdf_to_image(self, pdf_path: str, page_num: int, image_key_path: str = None) -> Tuple[bytes, Path]:
        """将PDF单页转换为图片

        自适应DPI，确保图片大小不超过限制
        """
        doc = fitz.open(pdf_path)
        page = doc[page_num]
        img_path = self.get_image_path(image_key_path or pdf_path, page_num)

        dpi = PROCESS.DPI_START
        while dpi >= PROCESS.DPI_MIN:
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg", jpg_quality=PROCESS.JPG_QUALITY)

            if len(img_bytes) <= PROCESS.MAX_IMAGE_SIZE_KB * 1024:
                doc.close()
                return img_bytes, img_path

            dpi -= 10

        # 最后手段：最低DPI
        mat = fitz.Matrix(PROCESS.DPI_MIN / 72, PROCESS.DPI_MIN / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg", jpg_quality=70)
        doc.close()
        return img_bytes, img_path

    def stage_pdf_locally(self, pdf_path: str) -> Path:
        """将网络PDF复制到本地暂存目录，再从本地文件处理。"""
        source = Path(pdf_path)
        source_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:12]
        safe_name = "".join(c for c in source.name if c.isalnum() or c in " -_().（）")
        stage_dir = self.staging_dir / source_hash
        stage_dir.mkdir(parents=True, exist_ok=True)
        staged_path = stage_dir / safe_name
        temp_path = staged_path.with_suffix(staged_path.suffix + ".part")

        shutil.copy2(source, temp_path)
        os.replace(temp_path, staged_path)
        return staged_path

    # ============== OCR识别（带重试） ==============

    def recognize_page_with_retry(self, image_bytes: bytes, pdf_path: str,
                                  page_num: int, max_retries: int = None) -> OCRResult:
        """OCR识别（带指数退避重试机制）"""
        if max_retries is None:
            max_retries = PROCESS.OCR_MAX_RETRIES

        doc_id = self.generate_doc_id(pdf_path, page_num)

        if not self._check_apis():
            return OCRResult(
                doc_id=doc_id,
                success=False,
                error="API不可用",
                skipped=False
            )

        # 检查断路器：已连续失败过多，直接静默跳过
        if _circuit_fail_count >= _CIRCUIT_FAIL_LIMIT:
            return OCRResult(doc_id=doc_id, success=False, error="OCR断路器已跳闸", skipped=False)

        # 检查重试次数
        page_record = self.state.get_page_by_doc_id(doc_id)
        if page_record:
            retry_count = page_record.get('retry_count', 0)
            if retry_count >= max_retries:
                return OCRResult(
                    doc_id=doc_id,
                    success=False,
                    error=f"已达最大重试次数({max_retries})",
                    skipped=False
                )

        last_error = ""
        for attempt in range(max_retries):
            try:
                result = self._call_vision_api(image_bytes)
                if result.success:
                    self.state.update_page(doc_id, status="processed")
                    _reset_circuit()
                    return result
                last_error = result.error
            except ConnectionResetError as e:
                last_error = str(e)
                _trip_circuit()
                _log_ocr_warn_once(f"连接重置，已触发断路器，跳过后续重试: {last_error}")
                return OCRResult(doc_id=doc_id, success=False, error=last_error, skipped=False)
            except Exception as e:
                last_error = str(e)

            # 增加重试计数
            if page_record:
                self.state.increment_retry(doc_id)

            # 指数退避等待
            if attempt < max_retries - 1:
                wait_time = PROCESS.OCR_RETRY_DELAY ** (attempt + 1)
                _log_ocr_warn_once(f"OCR失败（尝试 {attempt + 1}/{max_retries}），{wait_time}秒后重试: {last_error}")
                time.sleep(wait_time)

        return OCRResult(
            doc_id=doc_id,
            success=False,
            error=last_error or "重试次数耗尽",
            skipped=False
        )

    def _call_vision_api(self, image_bytes: bytes) -> OCRResult:
        """调用视觉识别API"""
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

        # 模型轮询
        try:
            from .config import APIConfig
        except ImportError:
            from config import APIConfig
        model = APIConfig.DASHSCOPE_API_KEY and 'qwen3-omni-flash-2025-12-01'

        response = self._vision_api.call(model='qwen3-omni-flash-2025-12-01', messages=messages)

        if response.status_code != 200:
            return OCRResult(
                doc_id="",
                success=False,
                error=f"API返回错误: {response.code}"
            )

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
        try:
            if '{' in text and '}' in text:
                json_start = text.index('{')
                json_end = text.rindex('}') + 1
                text = text[json_start:json_end]
                data = json.loads(text)

                job_name = data.get('job_name', '__NO_JOB__')
                return OCRResult(
                    doc_id=self.generate_doc_id("", 0),  # 会在外部替换
                    job_name=job_name,
                    part_numbers=data.get('part_numbers', []),
                    project=data.get('project', ''),
                    keywords=data.get('keywords', []),
                    success=True,
                    skipped=(job_name == '__NO_JOB__')
                )
        except json.JSONDecodeError:
            pass

        return OCRResult(
            doc_id="",
            success=False,
            error="JSON解析失败"
        )

    # ============== 页面处理 ==============

    def process_page(self, pdf_path: str, page_num: int,
                     pdf_id: int = None, force: bool = False,
                     render_pdf_path: str = None) -> Optional[dict]:
        """处理单个页面：转图片 + OCR

        Args:
            pdf_path: PDF文件路径
            page_num: 页码（0-based）
            pdf_id: PDF记录ID
            force: 是否强制重新处理

        Returns:
            页面结果dict，失败返回None
        """
        doc_id = self.generate_doc_id(pdf_path, page_num)

        # 检查是否已处理（断点续传）
        if not force:
            existing = self.state.get_page_by_doc_id(doc_id)
            if existing and existing.get('status') == 'processed':
                logger.debug(f"页{page_num + 1}: 已处理，跳过")
                return None
        else:
            existing = None

        if not existing and pdf_id is not None:
            self.state.add_page(pdf_id, page_num + 1, doc_id, status="pending")

        try:
            # 1. 转换为图片
            img_bytes, img_path = self.pdf_to_image(
                render_pdf_path or pdf_path,
                page_num,
                image_key_path=pdf_path
            )

            # 2. 保存图片
            with open(img_path, 'wb') as f:
                f.write(img_bytes)

            # 3. OCR识别（带重试）
            ocr_result = self.recognize_page_with_retry(img_bytes, pdf_path, page_num)

            if not ocr_result.success and not ocr_result.skipped:
                _log_ocr_warn_once(f"页{page_num + 1}: OCR失败 - {ocr_result.error}")
                self.state.update_page(
                    doc_id,
                    status="failed",
                    error_msg=ocr_result.error
                )
                return None

            # 4. 更新状态
            self.state.update_page(
                doc_id,
                job_name=ocr_result.job_name,
                image_path=str(img_path),
                ocr_text=json.dumps({
                    'part_numbers': ocr_result.part_numbers,
                    'project': ocr_result.project,
                    'keywords': ocr_result.keywords
                }, ensure_ascii=False),
                status="skipped" if ocr_result.skipped else "processed"
            )

            return {
                'doc_id': doc_id,
                'pdf_path': pdf_path,
                'page_num': page_num + 1,  # 1-based
                'image_path': str(img_path),
                'job_name': ocr_result.job_name,
                'part_numbers': ocr_result.part_numbers,
                'project': ocr_result.project,
                'keywords': ocr_result.keywords,
                'skipped': ocr_result.skipped
            }

        except Exception as e:
            logger.error(f"页{page_num + 1} 处理失败: {e}")
            self.state.update_page(doc_id, status="failed", error_msg=str(e))
            return None

    def process_pdf(self, pdf_path: str, pdf_id: int = None,
                    force: bool = False, workers: int = 4) -> Tuple[int, int, List[dict]]:
        """处理单个PDF的所有页面

        Returns:
            (indexed_count, skipped_count, pages)
        """
        logger.info(f"处理PDF: {Path(pdf_path).name}")

        try:
            local_pdf_path = self.stage_pdf_locally(pdf_path)
            doc = fitz.open(local_pdf_path)
            page_count = len(doc)
            doc.close()
        except Exception as e:
            logger.error(f"打开PDF失败: {e}")
            return 0, 0, []

        # 确保pdf_id存在
        if pdf_id is None:
            pdf_record = self.state.get_pdf_by_path(pdf_path)
            pdf_id = pdf_record['id'] if pdf_record else None

        indexed_count = 0
        skipped_count = 0
        pages = []

        for page_num in range(page_count):
            result = self.process_page(
                pdf_path,
                page_num,
                pdf_id,
                force,
                render_pdf_path=str(local_pdf_path)
            )

            if result:
                if result['skipped']:
                    logger.info(f"  页{page_num + 1}: [跳过] {result['job_name']}")
                    skipped_count += 1
                else:
                    logger.info(f"  页{page_num + 1}: ✓ {result['job_name']}")
                    indexed_count += 1
                    pages.append(result)
            else:
                skipped_count += 1

        return indexed_count, skipped_count, pages

    def process_batch(self, pdf_paths: List[str], workers: int = 4) -> List[dict]:
        """批量处理多个PDF（多线程）"""
        all_pages = []

        with ThreadPoolExecutor(max_workers=workers) as executor:
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


# ============== CLI ==============

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='PDF处理器')
    parser.add_argument('--test', type=str, help='测试处理单个PDF')
    parser.add_argument('--workers', type=int, default=4, help='并发数')

    args = parser.parse_args()

    processor = PDFProcessor()

    if args.test:
        indexed, skipped, pages = processor.process_pdf(args.test)
        print(f"\n测试结果:")
        print(f"  有效: {indexed} 页")
        print(f"  跳过: {skipped} 页")
        for p in pages:
            print(f"  - {p['doc_id']}: {p['job_name']}")

    processor.state.close()
