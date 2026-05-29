#!/usr/bin/env python3
"""
PDF SOP 检索系统 - 并发构建版本
"""

import os
import glob
import fitz
import base64
import chromadb
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from dashscope import MultiModalEmbedding, MultiModalConversation, TextEmbedding
import dashscope
from pypinyin import lazy_pinyin
import rapidfuzz

# 设置API Key
dashscope.api_key = "sk-18ef2958ce844b6b893f4c13427c7e62"

# 配置
CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "sop_pages"
IMAGES_DIR = "./pdf_images"

# 并发配置
MAX_WORKERS = 8  # 并发线程数

# 线程锁
lock = threading.Lock()


def pdf_page_to_image(pdf_path: str, page_num: int, max_size_kb: int = 3000) -> bytes:
    """将PDF页面转换为图片"""
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    dpi = 100
    while dpi >= 50:
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg", jpg_quality=85)
        if len(img_bytes) <= max_size_kb * 1024:
            doc.close()
            return img_bytes
        dpi -= 10
    mat = fitz.Matrix(50 / 72, 50 / 72)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("jpeg", jpg_quality=70)
    doc.close()
    return img_bytes


def get_job_name_by_vision(image_bytes: bytes) -> str:
    """视觉识别作业名称"""
    img_base64 = base64.b64encode(image_bytes).decode('utf-8')
    messages = [{
        "role": "user",
        "content": [
            {"image": f"data:image/jpeg;base64,{img_base64}"},
            {"text": """这是SOP页面。【作业名称】字段在页眉表格中。
- 有作业名称返回该值（如PA2720）
- 封面/目录/修订历史返回"__NO_JOB__"
只返回值。"""}
        ]
    }]
    try:
        response = MultiModalConversation.call(model='qwen3-omni-flash-2025-12-01', messages=messages)
        if response.status_code == 200:
            content = response.output.choices[0].message.content
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and 'text' in item:
                        return item['text'].strip()
            return content.strip() if content else "__NO_JOB__"
    except:
        pass
    return "__NO_JOB__"


def get_text_embedding(text: str) -> list:
    """获取文本embedding"""
    try:
        resp = TextEmbedding.call(model='text-embedding-v3', input=[text])
        if resp.status_code == 200:
            return resp.output['embeddings'][0]['embedding']
    except:
        pass
    return None


def process_single_page(args):
    """处理单个页面"""
    pdf_path, page_num, safe_name = args

    try:
        # 转换为图片
        img_bytes = pdf_page_to_image(pdf_path, page_num)

        # 识别作业名称
        job_name = get_job_name_by_vision(img_bytes)

        if job_name == "__NO_JOB__":
            return None

        # 保存图片
        img_filename = f"{safe_name}_p{page_num+1}.jpg"
        img_path = os.path.join(IMAGES_DIR, img_filename)
        with open(img_path, 'wb') as f:
            f.write(img_bytes)

        # 获取embedding
        text_for_embedding = f"作业名称: {job_name}"
        embedding = get_text_embedding(text_for_embedding)

        if embedding is None:
            return None

        doc_id = f"{safe_name}_page{page_num+1}"

        return {
            "id": doc_id,
            "embedding": embedding,
            "metadata": {
                "job_name": job_name,
                "pdf_path": pdf_path,
                "page_num": page_num + 1,
                "image_path": img_path
            },
            "document": job_name
        }

    except Exception as e:
        return None


def init_chroma():
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    collection = client.get_or_create_collection(name=COLLECTION_NAME)
    return client, collection


def build_index_parallel(pdf_files: list = None, max_workers: int = MAX_WORKERS):
    """并发构建索引"""
    os.makedirs(IMAGES_DIR, exist_ok=True)

    if pdf_files is None:
        pdf_files = glob.glob("../asserts/**/*.pdf", recursive=True)

    _, collection = init_chroma()

    # 收集所有页面任务
    print("收集任务...")
    all_tasks = []
    for pdf_path in pdf_files:
        try:
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()
            safe_name = "".join(c for c in os.path.basename(pdf_path) if c.isalnum() or c in ' -_')
            for page_num in range(page_count):
                all_tasks.append((pdf_path, page_num, safe_name))
        except:
            pass

    total_tasks = len(all_tasks)
    print(f"总任务数: {total_tasks}, 使用 {max_workers} 并发\n")

    completed = 0
    indexed = 0
    batch_ids = []
    batch_embeddings = []
    batch_metadatas = []
    batch_documents = []

    # 并发处理
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_single_page, task): task for task in all_tasks}

        for future in as_completed(futures):
            completed += 1

            result = future.result()
            if result:
                indexed += 1
                batch_ids.append(result["id"])
                batch_embeddings.append(result["embedding"])
                batch_metadatas.append(result["metadata"])
                batch_documents.append(result["document"])

                # 批量入库
                if len(batch_ids) >= 50:
                    with lock:
                        collection.upsert(
                            ids=batch_ids,
                            embeddings=batch_embeddings,
                            metadatas=batch_metadatas,
                            documents=batch_documents
                        )
                    batch_ids = []
                    batch_embeddings = []
                    batch_metadatas = []
                    batch_documents = []

            # 每100个输出进度
            if completed % 100 == 0:
                pct = completed / total_tasks * 100
                print(f"进度: {completed}/{total_tasks} ({pct:.1f}%)")

    # 入库剩余
    if batch_ids:
        with lock:
            collection.upsert(
                ids=batch_ids,
                embeddings=batch_embeddings,
                metadatas=batch_metadatas,
                documents=batch_documents
            )

    print(f"\n完成! 已索引: {indexed} 页")


if __name__ == "__main__":
    import sys

    workers = int(sys.argv[1]) if len(sys.argv) > 1 else MAX_WORKERS
    print(f"使用 {workers} 并发线程")

    pdf_files = glob.glob("../asserts/**/*.pdf", recursive=True)
    print(f"找到 {len(pdf_files)} 个PDF文件\n")

    build_index_parallel(pdf_files, max_workers=workers)
