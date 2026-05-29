#!/usr/bin/env python3
"""
index_new_pdfs.py - 为完全未被索引的 PDF 补充索引

这些 PDF 可能是因为：
1. 新添加的，还没运行过 OCR
2. OCR 识别失败了
3. 原始 PDF 有问题

这里使用简化的元数据提取（从文件名）来补充索引。
"""

import os
import sys
import json
import chromadb
import hashlib
import re
from pathlib import Path
from typing import Dict, List, Set, Optional
import argparse

sys.path.insert(0, str(Path(__file__).parent))

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
    print("Warning: dashscope not installed")
    EMBEDDING_AVAILABLE = False


_PROCESS_KEYWORDS = {
    "包装", "装配", "打包", "目检", "检查", "测试",
    "清洁", "维修", "点检", "消毒", "加注", "贴标",
    "组装", "拆卸", "擦拭", "合机", "分解"
}


def extract_from_filename(filename: str) -> dict:
    """从文件名提取元数据"""
    pdf_name = filename
    if '_p' in filename:
        pdf_name = filename.rsplit('_p', 1)[0]

    pdf_name = re.sub(r'\.pdf$', '', pdf_name, flags=re.IGNORECASE).strip()

    process = ""
    for kw in sorted(_PROCESS_KEYWORDS, key=len, reverse=True):
        if kw in pdf_name:
            idx = pdf_name.rfind(kw)
            process = pdf_name[idx:idx+len(kw)].strip()
            pdf_name = pdf_name[:idx].strip()
            break

    date_match = re.search(r'SOP\s*(\d{4})\s*(\d{1,2})\s*(\d{1,2})', pdf_name, re.IGNORECASE)
    if date_match:
        pdf_name = pdf_name[:date_match.start()].strip()

    return {
        'pdf_name': pdf_name,
        'job_name': pdf_name,
        'machine': pdf_name,
        'process': process,
        'category': '',
    }


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
    file_hash = hashlib.md5(pdf_name.encode()).hexdigest()[:8]
    safe_name = "".join(c for c in pdf_name if c.isalnum() or c in ' -_()（）')
    return f"{safe_name}_{file_hash}_p{page_num}"


def get_text_embedding(text: str) -> Optional[list]:
    if not EMBEDDING_AVAILABLE:
        return None
    try:
        resp = TextEmbedding.call(model='text-embedding-v3', input=[text])
        if resp.status_code == 200:
            return resp.output['embeddings'][0]['embedding']
    except Exception as e:
        print(f"Error getting embedding: {e}")
    return None


def build_text(job_name: str, category: str, process: str, machine: str) -> str:
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


def main():
    parser = argparse.ArgumentParser(description='为全新 PDF 补充索引')
    parser.add_argument('--dry-run', action='store_true', help='只显示，不写入')
    args = parser.parse_args()

    print("=" * 60)
    print("为全新 PDF 补充索引")
    print("=" * 60)

    if not IMAGES_DIR.exists():
        print(f"Error: Images directory not found: {IMAGES_DIR}")
        return

    # 连接 ChromaDB
    chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)

    # 获取已索引的 image_path
    indexed_image_paths: Set[str] = set()
    results = collection.get(limit=10000, include=['metadatas'])
    for meta in results.get('metadatas', []):
        image_path = meta.get('image_path', '')
        if image_path:
            indexed_image_paths.add(os.path.basename(image_path))

    print(f"已索引图片数: {len(indexed_image_paths)}")

    # 扫描未索引的图片
    unindexed_files = []
    for f in os.listdir(IMAGES_DIR):
        if not f.endswith('.jpg'):
            continue
        if f not in indexed_image_paths:
            unindexed_files.append(f)

    print(f"发现 {len(unindexed_files)} 个未索引的图片")

    if not unindexed_files:
        print("无需处理")
        return

    # 按 PDF 分组
    pdfs: Dict[str, dict] = {}
    for f in unindexed_files:
        pdf_name = get_pdf_name_from_image(f)
        if not pdf_name:
            continue
        if pdf_name not in pdfs:
            pdfs[pdf_name] = {
                'pdf_name': pdf_name,
                'metadata': extract_from_filename(pdf_name),
                'files': []
            }
        pdfs[pdf_name]['files'].append(f)

    print(f"涉及 {len(pdfs)} 个 PDF")

    # 索引
    batch_ids = []
    batch_metadatas = []
    batch_documents = []
    batch_embeddings = []
    indexed = 0
    skipped = 0

    for item in pdfs.values():
        pdf_name = item['pdf_name']
        meta = item['metadata']

        for f in item['files']:
            page_num = get_page_num_from_image(f)
            if not page_num:
                continue

            doc_id = generate_doc_id(pdf_name, page_num)
            image_path = str(IMAGES_DIR / f)

            text = build_text(
                job_name=meta['job_name'],
                category=meta['category'],
                process=meta['process'],
                machine=meta['machine']
            )

            # 获取 embedding
            embedding = get_text_embedding(text) if EMBEDDING_AVAILABLE else None
            if not embedding:
                print(f"  Skipped (no embedding): {f}")
                skipped += 1
                continue

            batch_ids.append(doc_id)
            batch_metadatas.append({
                "job_name": meta['job_name'],
                "pdf_name": meta['pdf_name'],
                "pdf_path": "",
                "page_num": page_num,
                "image_path": image_path,
                "image_url": f"/api/images/{f}",
                "part_numbers": "[]",
                "project": "",
                "keywords": "[]",
                "category": meta['category'],
                "process": meta['process'],
                "machine": meta['machine']
            })
            batch_documents.append(text)
            batch_embeddings.append(embedding)
            indexed += 1

    print(f"\n准备写入 {indexed} 个索引")

    if skipped > 0:
        print(f"跳过 {skipped} 个（需要 API）")

    if indexed == 0:
        print("没有可写入的索引")
        return

    # 写入
    if not args.dry_run:
        print(f"\n写入 {len(batch_ids)} 个索引...")
        collection.upsert(
            ids=batch_ids,
            embeddings=batch_embeddings,
            metadatas=batch_metadatas,
            documents=batch_documents
        )

    # 统计
    total = collection.count()
    print(f"\n统计:")
    print(f"  本次新增: {indexed}")
    print(f"  跳过: {skipped}")
    print(f"  总索引数: {total}")


if __name__ == "__main__":
    main()
