"""
PDF SOP 检索API - 供前端调用
"""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])

import chromadb
from dashscope import TextEmbedding
import dashscope
from pypinyin import lazy_pinyin
import rapidfuzz

dashscope.api_key = "sk-18ef2958ce844b6b893f4c13427c7e62"

CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "sop_pages"


def get_collection():
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    return client.get_or_create_collection(name=COLLECTION_NAME)


def get_text_embedding(text: str) -> list:
    resp = TextEmbedding.call(model='text-embedding-v2', input=[text])
    if resp.status_code == 200:
        return resp.output['embeddings'][0]['embedding']
    return None


def get_all_job_names():
    """获取所有作业名称"""
    collection = get_collection()
    results = collection.get()
    job_names = set()
    for meta in results.get('metadatas', []):
        if meta and 'job_name' in meta:
            job_names.add(meta['job_name'])
    return sorted(list(job_names))


def suggest_job_names(keyword: str, top_k: int = 10) -> list:
    """联想搜索"""
    all_names = get_all_job_names()
    if not keyword:
        return all_names[:top_k]

    keyword_upper = keyword.upper()
    keyword_pinyin = ''.join(lazy_pinyin(keyword)).lower()
    matched = []

    for name in all_names:
        name_upper = name.upper()
        name_pinyin = ''.join(lazy_pinyin(name)).lower()

        if name_upper.startswith(keyword_upper):
            matched.append((name, 10))
        elif keyword_upper in name_upper:
            matched.append((name, 8))
        elif keyword_pinyin and name_pinyin.startswith(keyword_pinyin):
            matched.append((name, 7))
        elif keyword_pinyin and keyword_pinyin in name_pinyin:
            matched.append((name, 6))
        elif all(c in name_upper for c in keyword_upper if c.isalnum()):
            matched.append((name, 4))
        else:
            ratio = rapidfuzz.fuzz.ratio(keyword_upper, name_upper)
            if ratio >= 70:
                matched.append((name, ratio / 25))

    matched.sort(key=lambda x: (-x[1], x[0]))
    return [m[0] for m in matched[:top_k]]


def search_by_job_name(keyword: str, top_k: int = 10) -> list:
    """关键词搜索"""
    collection = get_collection()
    results = collection.get()

    matched = []
    keyword_upper = keyword.upper()

    for i, doc_id in enumerate(results['ids']):
        meta = results['metadatas'][i]
        job = meta.get('job_name', '')
        if keyword_upper in job.upper():
            matched.append({
                "id": doc_id,
                "job_name": job,
                "pdf_path": meta.get('pdf_path', ''),
                "page_num": meta.get('page_num', 0),
                "image_path": meta.get('image_path', '')
            })

    return matched[:top_k]


def search_by_text(description: str, top_k: int = 10) -> list:
    """向量语义搜索"""
    collection = get_collection()
    query_embedding = get_text_embedding(description)

    if not query_embedding:
        return []

    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)

    matched = []
    if results and results.get('ids') and results['ids'][0]:
        for i, doc_id in enumerate(results['ids'][0]):
            meta = results['metadatas'][0][i]
            distance = results['distances'][0][i]
            matched.append({
                "id": doc_id,
                "job_name": meta.get('job_name', ''),
                "pdf_path": meta.get('pdf_path', ''),
                "page_num": meta.get('page_num', 0),
                "image_path": meta.get('image_path', ''),
                "similarity": round(1 - distance, 4)
            })

    return matched


def get_stats():
    """获取统计"""
    collection = get_collection()
    count = collection.count()
    names = get_all_job_names()
    return {"total_pages": count, "unique_job_names": len(names)}


if __name__ == "__main__":
    import json

    # 命令行接口
    import sys
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        param = sys.argv[2] if len(sys.argv) > 2 else ""

        if cmd == "suggest":
            print(json.dumps(suggest_job_names(param, 10), ensure_ascii=False))
        elif cmd == "search":
            print(json.dumps(search_by_job_name(param, 10), ensure_ascii=False))
        elif cmd == "semantic":
            print(json.dumps(search_by_text(param, 10), ensure_ascii=False))
        elif cmd == "stats":
            print(json.dumps(get_stats(), ensure_ascii=False))
