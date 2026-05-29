#!/usr/bin/env python3
"""
rebuild_missing_index.py - 重建缺失的 ChromaDB 索引

原理：对于缺失的页面，复用同一 PDF 其他已索引页面的元数据。
这样可以快速补充索引，不需要重新运行 OCR。

注意：这是简化方案，会将缺失页面的 job_name 等设为与同一 PDF 其他页面相同。
如果需要精确的 per-page OCR 结果，请重新运行完整的 PDF 处理流程。
"""

import os
import sys
import json
import chromadb
import hashlib
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sop_dimensions import extract_file_dimensions
from runtime_paths import get_runtime_data_dir

# ============== 路径配置 ==============
BASE_DIR = Path(__file__).parent.absolute()
DATA_DIR = Path(get_runtime_data_dir())
CHROMA_DIR = DATA_DIR / "chroma_db"
IMAGES_DIR = DATA_DIR / "pdf_images"
COLLECTION_NAME = "sop_pages"

# 加载 dashscope
try:
    from dashscope import TextEmbedding
    import dashscope
    from scripts.config import load_config
    config = load_config()
    dashscope.api_key = config.get("dashscope_api_key", os.environ.get("DASHSCOPE_API_KEY", ""))
    EMBEDDING_AVAILABLE = bool(dashscope.api_key)
except ImportError:
    print("Warning: dashscope not installed, embedding will be skipped")
    EMBEDDING_AVAILABLE = False


def get_pdf_name_from_image(filename: str) -> Optional[str]:
    if '_p' not in filename:
        return None
    return filename.rsplit('_p', 1)[0]


def get_page_num_from_image(filename: str) -> Optional[int]:
    if '_p' not in filename:
        return None
    parts = filename.rsplit('_p', 1)
    try:
        return int(parts[1].replace('.jpg', ''))
    except ValueError:
        return None


def generate_doc_id(pdf_name: str, page_num: int) -> str:
    """生成 doc_id"""
    # 使用 PDF 名称的 hash
    file_hash = hashlib.md5(pdf_name.encode()).hexdigest()[:8]
    safe_name = "".join(c for c in pdf_name if c.isalnum() or c in ' -_()（）')
    return f"{safe_name}_{file_hash}_p{page_num}"


def get_text_embedding(text: str) -> Optional[list]:
    """获取文本向量"""
    if not EMBEDDING_AVAILABLE:
        return None

    try:
        resp = TextEmbedding.call(model='text-embedding-v3', input=[text])
        if resp.status_code == 200:
            return resp.output['embeddings'][0]['embedding']
    except Exception as e:
        print(f"Error getting embedding: {e}")
    return None


def build_text_for_embedding(job_name: str, category: str, process: str, machine: str) -> str:
    """构建用于 embedding 的文本"""
    parts = []
    if job_name:
        parts.append(f"作业名称: {job_name}")
    if category:
        parts.append(f"分类: {category}")
    if process:
        parts.append(f"工序: {process}")
    if machine:
        parts.append(f"机型: {machine}")
    return ' '.join(parts)


def scan_images() -> Dict[str, Set[int]]:
    """扫描 pdf_images 目录"""
    pdf_pages: Dict[str, Set[int]] = {}
    if not IMAGES_DIR.exists():
        return pdf_pages

    for f in os.listdir(IMAGES_DIR):
        if not f.endswith('.jpg'):
            continue
        pdf_name = get_pdf_name_from_image(f)
        page_num = get_page_num_from_image(f)
        if pdf_name and page_num:
            if pdf_name not in pdf_pages:
                pdf_pages[pdf_name] = set()
            pdf_pages[pdf_name].add(page_num)
    return pdf_pages


def get_indexed_pages_and_metadata(chroma_client, collection_name: str = COLLECTION_NAME) -> Tuple[Dict[str, Set[int]], Dict[str, dict]]:
    """获取已索引的页面及其元数据"""
    pdf_pages: Dict[str, Set[int]] = {}
    pdf_metadata: Dict[str, dict] = {}  # pdf_name -> 复用元数据

    try:
        collection = chroma_client.get_collection(collection_name)
        results = collection.get(limit=10000, include=['metadatas', 'documents'])

        for i, meta in enumerate(results.get('metadatas', [])):
            path = meta.get('image_path', '')
            if not path:
                continue

            basename = os.path.basename(path)
            pdf_name = get_pdf_name_from_image(basename)
            page_num = get_page_num_from_image(basename)

            if pdf_name and page_num:
                if pdf_name not in pdf_pages:
                    pdf_pages[pdf_name] = set()
                    # 复用第一个已索引页面的元数据
                    pdf_metadata[pdf_name] = {
                        'job_name': meta.get('job_name', ''),
                        'category': meta.get('category', ''),
                        'process': meta.get('process', ''),
                        'machine': meta.get('machine', ''),
                        'pdf_name': meta.get('pdf_name', pdf_name),
                    }
                pdf_pages[pdf_name].add(page_num)

    except Exception as e:
        print(f"Error getting indexed pages: {e}")

    return pdf_pages, pdf_metadata


def find_missing_with_metadata(
    actual_pages: Dict[str, Set[int]],
    indexed_pages: Dict[str, Set[int]],
    pdf_metadata: Dict[str, dict]
) -> List[dict]:
    """找出缺失的页面并附带元数据"""
    missing = []

    for pdf_name, pages in actual_pages.items():
        indexed = indexed_pages.get(pdf_name, set())
        missing_pages = sorted(pages - indexed)

        if missing_pages and pdf_name in pdf_metadata:
            missing.append({
                'pdf_name': pdf_name,
                'missing_pages': missing_pages,
                'metadata': pdf_metadata[pdf_name]
            })

    return missing


def main():
    print("=" * 60)
    print("ChromaDB 缺失索引重建")
    print("=" * 60)

    # 1. 扫描图片
    print(f"\n扫描图片目录: {IMAGES_DIR}")
    actual_pages = scan_images()
    print(f"发现 {len(actual_pages)} 个 PDF")

    # 2. 连接 ChromaDB
    print(f"\n连接 ChromaDB: {CHROMA_DIR}")
    chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "SOP页面向量索引"}
    )

    # 3. 获取已索引的页面和元数据
    indexed_pages, pdf_metadata = get_indexed_pages_and_metadata(chroma_client)
    print(f"已索引 {sum(len(p) for p in indexed_pages.values())} 个页面")

    # 4. 找出缺失的
    missing = find_missing_with_metadata(actual_pages, indexed_pages, pdf_metadata)
    total_missing = sum(len(m['missing_pages']) for m in missing)

    if not missing:
        print("\n所有页面都已索引，无需修复")
        return

    print(f"\n发现 {len(missing)} 个 PDF 存在 {total_missing} 个缺失页面")

    # 5. 重建索引
    if not EMBEDDING_AVAILABLE:
        print("\nWarning: dashscope API key not available, will skip embedding generation")
        print("  缺失的页面将不会被添加到 ChromaDB")
        print("  请先配置 dashscope_api_key 后重新运行")

    batch_ids = []
    batch_embeddings = []
    batch_metadatas = []
    batch_documents = []
    skipped = 0
    indexed = 0

    for item in missing:
        pdf_name = item['pdf_name']
        meta = item['metadata']

        for page_num in item['missing_pages']:
            doc_id = generate_doc_id(pdf_name, page_num)
            image_filename = f"{pdf_name}_p{page_num}.jpg"
            image_path = str(IMAGES_DIR / image_filename)

            # 构建文本
            text = build_text_for_embedding(
                job_name=meta['job_name'],
                category=meta['category'],
                process=meta['process'],
                machine=meta['machine']
            )

            # 获取 embedding
            embedding = get_text_embedding(text) if EMBEDDING_AVAILABLE else None
            if not embedding:
                skipped += 1
                continue

            batch_ids.append(doc_id)
            batch_embeddings.append(embedding)
            batch_metadatas.append({
                "job_name": meta['job_name'],
                "pdf_name": meta['pdf_name'],
                "pdf_path": "",  # 原始 PDF 路径未知
                "page_num": page_num,
                "image_path": image_path,
                "image_url": f"/api/images/{image_filename}",
                "part_numbers": "[]",
                "project": "",
                "keywords": "[]",
                "category": meta['category'],
                "process": meta['process'],
                "machine": meta['machine']
            })
            batch_documents.append(text)
            indexed += 1

    # 6. 批量写入
    if batch_ids:
        print(f"\n写入 {len(batch_ids)} 个索引...")
        collection.upsert(
            ids=batch_ids,
            embeddings=batch_embeddings,
            metadatas=batch_metadatas,
            documents=batch_documents
        )
        print(f"索引写入完成")

    # 7. 统计
    total = collection.count()
    print(f"\n统计:")
    print(f"  本次新增: {indexed}")
    print(f"  跳过（无 API）: {skipped}")
    print(f"  总索引数: {total}")

    # 8. 保存报告
    report = {
        'rebuild_time': datetime.now().isoformat(),
        'indexed': indexed,
        'skipped': skipped,
        'total_now': total,
        'missing_pdfs': len(missing),
        'total_missing_pages': total_missing
    }

    report_file = DATA_DIR / 'rebuild_report.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n报告已保存: {report_file}")


if __name__ == "__main__":
    main()
