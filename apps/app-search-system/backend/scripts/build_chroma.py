#!/usr/bin/env python3
"""
03_build_chroma.py - ChromaDB增量索引构建

功能：
1. 读取图片转换结果和OCR缓存
2. 建立ChromaDB向量索引
3. 增量更新：跳过已索引的页面

ChromaDB文档结构：
- id: doc_id (唯一)
- embedding: 文本向量
- metadata: {job_name, pdf_path, page_num, image_path, category, machine, process, ...}
- document: 全文文本
"""

import os
import sys
import json
import sqlite3
import hashlib
import chromadb
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.pdf_scan_state import PDFScanState, STATE_DB
from scripts.pdf_to_images import OCR_CACHE_DB

# ============== 路径配置 ==============
BASE_DIR = Path(__file__).parent.parent.absolute()
CHROMA_DIR = BASE_DIR / "data" / "chroma_db"
COLLECTION_NAME = "sop_pages"
OCR_RESULT_FILE = BASE_DIR / "data" / "image_conversion_result.json"

# ============== 日志配置 ==============
def setup_logging():
    log_dir = BASE_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"chroma_build_{datetime.now().strftime('%Y%m%d')}.log"
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


# ============== 维度提取（从文件路径解析） ==============
_PROCESS_KEYWORDS = {
    "包装", "装配", "打包", "目检", "检查", "测试",
    "清洁", "维修", "点检", "消毒", "加注", "贴标",
    "组装", "拆卸", "擦拭", "合机", "分解"
}

_SOP_DATE_PAT = __import__('re').compile(
    r'\s*SOP ?(\d{4})\.?(\d{2})\.?(\d{2,})\s*$',
    __import__('re').IGNORECASE
)


def extract_file_dimensions(pdf_path: str) -> dict:
    """从PDF路径提取维度信息：
    - category: 父文件夹名（现金box/BNF等）
    - machine: 机型名
    - process: 工序名
    - job_name: 作业名称（从文件名提取）
    """
    # 解析路径
    parts = [p for p in pdf_path.replace("\\", "/").split("/") if p]
    filename = parts[-1] if parts else ""

    pdf_name = __import__('re').sub(r'\.pdf$', '', filename, flags=__import__('re').IGNORECASE).strip()

    # 获取目录层级
    if len(parts) >= 3:
        parent = parts[-2]
        grandparent = parts[-3]
    elif len(parts) == 2:
        parent = parts[-1]
        grandparent = parts[-2]
    else:
        parent = grandparent = ""

    # process: grandparent去掉SOP后缀
    process = __import__('re').sub(r'\s*SOP\s*$', '', grandparent, flags=__import__('re').IGNORECASE).strip() \
              if __import__('re').search(r'\s*SOP\s*$', grandparent, flags=__import__('re').IGNORECASE) else \
              (__import__('re').sub(r'\s*SOP\s*$', '', parent, flags=__import__('re').IGNORECASE).strip() \
               if __import__('re').search(r'\s*SOP\s*$', parent, flags=__import__('re').IGNORECASE) else "")

    # category: 父文件夹
    category = parent

    # machine + job_name: 从文件名提取
    name_no_sopdate = _SOP_DATE_PAT.sub('', pdf_name).strip()

    machine = name_no_sopdate
    for kw in sorted(_PROCESS_KEYWORDS, key=len, reverse=True):
        pattern = __import__('re').compile(r'(.+?)\s+' + __import__('re').escape(kw) + r'\s*$')
        m = pattern.match(name_no_sopdate)
        if m:
            before = m.group(1).strip()
            machine = before if before else name_no_sopdate
            break

    machine = __import__('re').sub(r'\s*SOP\s*$', '', machine, flags=__import__('re').IGNORECASE).strip()

    return {
        "category": category,
        "process": process,
        "machine": machine,
        "job_name": machine,  # 作业名称=机型名
        "pdf_name": pdf_name
    }


class ChromaIndexer:
    """ChromaDB索引构建器"""

    def __init__(self, chroma_dir: Path, collection_name: str = COLLECTION_NAME):
        self.chroma_dir = chroma_dir
        self.chroma_dir.mkdir(parents=True, exist_ok=True)

        # 初始化ChromaDB客户端
        self.client = chromadb.PersistentClient(path=str(chroma_dir))
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "SOP页面向量索引"}
        )

        # 加载dashscope配置
        try:
            from dashscope import TextEmbedding
            self.text_embedding = TextEmbedding
            self.embedding_available = True

            # 加载API Key
            config_file = BASE_DIR / "config.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    import dashscope
                    dashscope.api_key = config.get("dashscope_api_key", "")
        except ImportError:
            logger.warning("dashscope 未安装，向量索引功能不可用")
            self.embedding_available = False

    def get_existing_ids(self) -> Set[str]:
        """获取已索引的doc_id集合"""
        try:
            result = self.collection.get(include=[])
            return set(result.get('ids', []) or [])
        except Exception as e:
            logger.warning(f"获取已索引ID失败: {e}")
            return set()

    def get_text_embedding(self, text: str) -> Optional[list]:
        """获取文本向量"""
        if not self.embedding_available:
            return None

        try:
            resp = self.text_embedding.call(
                model='text-embedding-v3',
                input=[text]
            )
            if resp.status_code == 200:
                return resp.output['embeddings'][0]['embedding']
        except Exception as e:
            logger.error(f"获取embedding失败: {e}")
        return None

    def build_text_for_embedding(self, job_name: str, part_numbers: list,
                                  project: str, keywords: list,
                                  category: str, process: str, machine: str) -> str:
        """构建用于embedding的文本"""
        parts = []

        if job_name:
            parts.append(f"作业名称: {job_name}")
        if category:
            parts.append(f"分类: {category}")
        if process:
            parts.append(f"工序: {process}")
        if machine:
            parts.append(f"机型: {machine}")
        if part_numbers:
            parts.append(f"零件编号: {', '.join(part_numbers)}")
        if project:
            parts.append(f"项目: {project}")
        if keywords:
            parts.append(f"关键词: {', '.join(keywords)}")

        return ' '.join(parts)

    def index_pages(self, pages: List[dict], dims: dict) -> Tuple[int, int]:
        """索引页面列表

        Args:
            pages: 页面列表（从02输出）
            dims: 文件维度信息

        Returns:
            (indexed_count, skipped_count)
        """
        existing_ids = self.get_existing_ids()
        logger.info(f"已索引: {len(existing_ids)} 个文档")

        batch_ids = []
        batch_embeddings = []
        batch_metadatas = []
        batch_documents = []

        indexed_count = 0
        skipped_count = 0

        for page in pages:
            doc_id = page.get('doc_id')
            if not doc_id:
                continue

            # 跳过已索引的
            if doc_id in existing_ids:
                logger.debug(f"  跳过已索引: {doc_id}")
                skipped_count += 1
                continue

            # 构建文本
            text = self.build_text_for_embedding(
                job_name=page.get('job_name', ''),
                part_numbers=page.get('part_numbers', []),
                project=page.get('project', ''),
                keywords=page.get('keywords', []),
                category=dims.get('category', ''),
                process=dims.get('process', ''),
                machine=dims.get('machine', '')
            )

            # 获取embedding
            embedding = self.get_text_embedding(text)
            if not embedding:
                logger.warning(f"  获取embedding失败: {doc_id}")
                skipped_count += 1
                continue

            # 收集批次
            batch_ids.append(doc_id)
            batch_embeddings.append(embedding)
            batch_metadatas.append({
                "job_name": page.get('job_name', ''),
                "pdf_name": page.get('pdf_name', dims.get('pdf_name', '')),
                "pdf_path": page.get('pdf_path', ''),
                "page_num": page.get('page_num', 0),
                "image_path": page.get('image_path', ''),
                "image_url": f"/api/images/{Path(page.get('image_path', '')).name}",
                "part_numbers": json.dumps(page.get('part_numbers', []), ensure_ascii=False),
                "project": page.get('project', ''),
                "keywords": json.dumps(page.get('keywords', []), ensure_ascii=False),
                "category": dims.get('category', ''),
                "process": dims.get('process', ''),
                "machine": dims.get('machine', '')
            })
            batch_documents.append(text)

            indexed_count += 1

            # 批量写入（每20条写入一次）
            if len(batch_ids) >= 20:
                self.collection.upsert(
                    ids=batch_ids,
                    embeddings=batch_embeddings,
                    metadatas=batch_metadatas,
                    documents=batch_documents
                )
                batch_ids.clear()
                batch_embeddings.clear()
                batch_metadatas.clear()
                batch_documents.clear()

        # 写入剩余
        if batch_ids:
            self.collection.upsert(
                ids=batch_ids,
                embeddings=batch_embeddings,
                metadatas=batch_metadatas,
                documents=batch_documents
            )

        return indexed_count, skipped_count

    def delete_pages(self, doc_ids: List[str]):
        """删除页面索引"""
        if doc_ids:
            self.collection.delete(ids=doc_ids)
            logger.info(f"删除 {len(doc_ids)} 个索引")

    def rebuild_index(self, pages_by_pdf: Dict[str, List[dict]]):
        """重建索引（删除再重建，用于大规模更新）"""
        # 收集所有doc_id
        all_ids = []
        for pages in pages_by_pdf.values():
            for page in pages:
                if page.get('doc_id'):
                    all_ids.append(page['doc_id'])

        if all_ids:
            self.delete_pages(all_ids)
            logger.info(f"已删除 {len(all_ids)} 个旧索引")

        # 重新索引
        total_indexed = 0
        total_skipped = 0

        for pdf_path, pages in pages_by_pdf.items():
            dims = extract_file_dimensions(pdf_path)
            indexed, skipped = self.index_pages(pages, dims)
            total_indexed += indexed
            total_skipped += skipped

        return total_indexed, total_skipped

    def get_stats(self) -> dict:
        """获取索引统计"""
        try:
            count = self.collection.count()
        except:
            count = 0

        return {
            "total_docs": count
        }


def run_chroma_build(rebuild: bool = False) -> dict:
    """执行ChromaDB索引构建"""
    logger.info("=" * 60)
    logger.info("开始ChromaDB索引构建")
    logger.info(f"ChromaDB目录: {CHROMA_DIR}")
    logger.info(f"Collection: {COLLECTION_NAME}")
    logger.info(f"重建模式: {rebuild}")
    logger.info("=" * 60)

    indexer = ChromaIndexer(CHROMA_DIR)

    # 1. 读取图片转换结果
    if not OCR_RESULT_FILE.exists():
        logger.warning(f"图片转换结果文件不存在: {OCR_RESULT_FILE}")
        logger.info("请先运行 02_pdf_to_images.py")
        return {'indexed': 0, 'skipped': 0}

    with open(OCR_RESULT_FILE, 'r', encoding='utf-8') as f:
        conversion_result = json.load(f)

    pages = conversion_result.get('pages', [])
    if not pages:
        logger.info("没有页面需要索引")
        return {'indexed': 0, 'skipped': 0}

    logger.info(f"待索引页面: {len(pages)} 个")

    # 2. 按PDF分组
    pages_by_pdf: Dict[str, List[dict]] = {}
    for page in pages:
        pdf_path = page.get('pdf_path', '')
        if pdf_path:
            if pdf_path not in pages_by_pdf:
                pages_by_pdf[pdf_path] = []
            pages_by_pdf[pdf_path].append(page)

    # 3. 增量或重建
    if rebuild:
        indexed, skipped = indexer.rebuild_index(pages_by_pdf)
    else:
        total_indexed = 0
        total_skipped = 0

        for pdf_path, pdf_pages in pages_by_pdf.items():
            dims = extract_file_dimensions(pdf_path)
            indexed, skipped = indexer.index_pages(pdf_pages, dims)
            total_indexed += indexed
            total_skipped += skipped

        indexed = total_indexed
        skipped = total_skipped

    # 4. 统计
    stats = indexer.get_stats()

    logger.info(f"\n索引构建完成:")
    logger.info(f"  本次新增: {indexed} 个")
    logger.info(f"  跳过: {skipped} 个")
    logger.info(f"  总索引数: {stats['total_docs']} 个")

    return {
        'indexed': indexed,
        'skipped': skipped,
        'total_docs': stats['total_docs']
    }


def main():
    import argparse
    from typing import Tuple

    parser = argparse.ArgumentParser(description='ChromaDB索引构建')
    parser.add_argument('--rebuild', action='store_true', help='重建所有索引')
    parser.add_argument('--stats', action='store_true', help='查看索引统计')

    args = parser.parse_args()

    if args.stats:
        indexer = ChromaIndexer(CHROMA_DIR)
        stats = indexer.get_stats()
        print(f"\nChromaDB统计:")
        print(f"  总文档数: {stats['total_docs']}")
        return

    # 执行索引构建
    result = run_chroma_build(rebuild=args.rebuild)

    print(f"\n索引构建结果:")
    print(f"  新增: {result['indexed']}")
    print(f"  跳过: {result['skipped']}")
    print(f"  总计: {result['total_docs']}")


if __name__ == "__main__":
    main()
