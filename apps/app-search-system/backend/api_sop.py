#!/usr/bin/env python3
"""
api_sop.py - SOP检索API（改进版）

功能：
1. 关联SQLite状态数据库和ChromaDB进行联合查询
2. 支持按分类/机型/工序筛选
3. 返回公盘图片URL（可直接访问）

改进：
- 使用统一配置管理
- 改进错误处理
- 更好的缓存策略
"""

import os
import sys
import json
import sqlite3
import chromadb
from pathlib import Path
from typing import Dict, List, Optional, Set
from functools import lru_cache
import threading

# 使用统一配置
sys.path.insert(0, str(Path(__file__).parent))
from scripts.config import DIR, DB, CHROMA, API

# ============== ChromaDB客户端 ==============
_chroma_client = None
_chroma_collection = None
_chroma_lock = threading.Lock()


def get_chroma_collection():
    """获取ChromaDB集合（单例，线程安全）"""
    global _chroma_client, _chroma_collection

    if _chroma_collection is None:
        with _chroma_lock:
            if _chroma_collection is None:
                _chroma_client = chromadb.PersistentClient(path=str(DIR.CHROMA_DIR))
                _chroma_collection = _chroma_client.get_or_create_collection(
                    name=CHROMA.COLLECTION_NAME,
                    metadata={"description": "SOP页面向量索引"}
                )

    return _chroma_collection


# ============== 缓存管理 ==============
_cache_lock = threading.Lock()
_cache_data = {
    'filter_options': {'data': None, 'ts': 0.0},
    'job_names': {'names': [], 'ts': 0.0},
}
_CACHE_TTL = 300  # 5分钟缓存


def _get_cached(key: str, ttl: int = _CACHE_TTL):
    """获取缓存数据"""
    with _cache_lock:
        cached = _cache_data.get(key)
        if cached and (datetime.now().timestamp() - cached['ts']) < ttl:
            return cached['data']
    return None


def _set_cached(key: str, data):
    """设置缓存数据"""
    with _cache_lock:
        _cache_data[key] = {'data': data, 'ts': datetime.now().timestamp()}


def clear_cache():
    """清除所有缓存"""
    with _cache_lock:
        _cache_data['filter_options'] = {'data': None, 'ts': 0.0}
        _cache_data['job_names'] = {'names': [], 'ts': 0.0}


# ============== SQLite查询 ==============

def get_pdf_dimensions(pdf_path: str) -> Dict:
    """从pdf_scan_state.db获取PDF维度信息"""
    if not DB.SCAN_DB.exists():
        return {}

    conn = sqlite3.connect(str(DB.SCAN_DB))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category, machine, process, job_name, pdf_name
        FROM pdf_state WHERE pdf_path = ?
    """, (pdf_path,))

    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            'category': row[0] or '',
            'machine': row[1] or '',
            'process': row[2] or '',
            'job_name': row[3] or '',
            'pdf_name': row[4] or ''
        }
    return {}


# ============== 筛选选项 ==============

def get_filter_options(category: str = "", machine: str = "") -> Dict:
    """获取筛选项（支持三级级联过滤，5分钟缓存）"""
    # 先尝试从缓存获取
    cached = _get_cached('filter_options')
    if cached and not category and not machine:
        return cached

    collection = get_chroma_collection()
    all_results = collection.get()

    cat_set, mach_set, proc_set = set(), set(), set()
    for meta in all_results.get('metadatas', []):
        if not meta:
            continue

        cat = (meta.get('category') or '').strip()
        mach = (meta.get('machine') or '').strip()
        proc = (meta.get('process') or '').strip()

        if cat:
            cat_set.add(cat)
        if mach:
            mach_set.add(mach)
        if proc:
            proc_set.add(proc)

    # 分类名下拉：排除含 & 的复合名
    categories = sorted({c for c in cat_set if '&' not in c})

    # 机型：排除所有分类名
    all_cats_lower = {c.lower() for c in cat_set}
    machines = sorted({m for m in mach_set if m.lower() not in all_cats_lower})

    # 工序
    processes = sorted(proc_set)

    # 级联过滤
    if category:
        cat_machines = sorted({
            m.get('machine', '').strip()
            for m in all_results.get('metadatas', [])
            if m and m.get('category', '').lower() == category.lower()
            and m.get('machine', '').strip()
            and m.get('machine', '').strip().lower() not in all_cats_lower
        })
        machines = cat_machines

    if machine:
        machine_procs = sorted({
            m.get('process', '').strip()
            for m in all_results.get('metadatas', [])
            if m and m.get('machine', '').lower() == machine.lower()
            and m.get('process', '').strip()
        })
        processes = machine_procs

    result = {
        'categories': categories,
        'machines': machines,
        'processes': processes
    }

    if not category and not machine:
        _set_cached('filter_options', result)

    return result


# ============== 搜索功能 ==============

def _split_compound(val: str) -> List[str]:
    """按 & 拆分复合值"""
    return [p.strip() for p in val.split('&') if p.strip()]


def _match_filter(meta: dict, category: str, process: str, machine: str) -> bool:
    """检查元数据是否匹配筛选条件"""
    if category:
        cat = (meta.get('category') or '').strip()
        parts = _split_compound(cat)
        if cat.lower() != category.lower() and category not in parts:
            return False

    if process and (meta.get('process') or '').strip().lower() != process.lower():
        return False

    if machine and (meta.get('machine') or '').strip().lower() != machine.lower():
        return False

    return True


def search_by_keyword(
    keyword: str = "",
    top_k: int = 10,
    category: str = "",
    process: str = "",
    machine: str = ""
) -> List[Dict]:
    """关键词搜索"""
    collection = get_chroma_collection()
    all_results = collection.get()
    all_ids = all_results.get('ids', [])
    all_metas = all_results.get('metadatas', [])
    all_docs = all_results.get('documents', [])

    matched = []
    seen_ids: Set[str] = set()
    keyword_upper = keyword.upper() if keyword else ""

    for i, meta in enumerate(all_metas):
        if not meta:
            continue

        if not _match_filter(meta, category, process, machine):
            continue

        doc_id = all_ids[i]
        job_name = (meta.get('job_name') or '').strip()

        # 匹配逻辑
        match_type = None

        if keyword_upper:
            # 精确匹配
            if job_name.upper() == keyword_upper:
                match_type = "exact"
            # 包含匹配
            elif keyword_upper in job_name.upper():
                match_type = "substring"
            # 零件编号匹配
            elif _match_part_number(meta, keyword_upper):
                match_type = "part_number"
            # 关键词匹配
            elif keyword_upper in (all_docs[i] or '').upper():
                match_type = "keyword"

            if not match_type:
                continue
        elif doc_id in seen_ids:
            continue

        seen_ids.add(doc_id)

        matched.append({
            'id': doc_id,
            'job_name': job_name,
            'pdf_name': (meta.get('pdf_name') or '').strip(),
            'pdf_path': (meta.get('pdf_path') or '').strip(),
            'page_num': meta.get('page_num', 0),
            'image_path': (meta.get('image_path') or '').strip(),
            'image_url': f"{API.IMAGE_BASE_URL}/{Path(meta.get('image_path') or '').name}",
            'category': (meta.get('category') or '').strip(),
            'process': (meta.get('process') or '').strip(),
            'machine': (meta.get('machine') or '').strip(),
            'part_numbers': parse_json_field(meta.get('part_numbers', '[]')),
            'match_type': match_type or 'all',
            'score': 1.0 if match_type == "exact" else 0.8
        })

    # 去重并排序
    unique = []
    seen_jobs = set()
    for r in matched:
        jn = r['job_name'].lower()
        if jn not in seen_jobs:
            unique.append(r)
            seen_jobs.add(jn)

    return unique[:top_k]


def search_semantic(
    description: str,
    top_k: int = 10,
    category: str = "",
    process: str = "",
    machine: str = ""
) -> List[Dict]:
    """语义向量搜索"""
    # 获取query embedding
    try:
        from dashscope import TextEmbedding
        import dashscope

        config_path = DIR.DATA_DIR / "config.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                dashscope.api_key = config.get("dashscope_api_key", "") or config.get("dashscope", {}).get("api_key", "")

        resp = TextEmbedding.call(model='text-embedding-v3', input=[description])
        if resp.status_code != 200:
            return []
        query_embedding = resp.output['embeddings'][0]['embedding']
    except Exception as e:
        print(f"Embedding获取失败: {e}")
        return []

    collection = get_chroma_collection()

    # 预过滤符合条件的结果
    all_results = collection.get()
    valid_ids = set()
    all_metas = all_results.get('metadatas', [])

    for i, meta in enumerate(all_metas):
        if meta and _match_filter(meta, category, process, machine):
            valid_ids.add(all_results['ids'][i])

    # 向量查询
    has_filter = bool(category or process or machine)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k * 3 if has_filter else top_k * 2
    )

    matched = []
    if results and results.get('ids') and results['ids'][0]:
        for i, doc_id in enumerate(results['ids'][0]):
            if has_filter and doc_id not in valid_ids:
                continue

            meta = results['metadatas'][0][i]
            distance = results['distances'][0][i]
            similarity = round(1 - distance, 4)

            matched.append({
                'id': doc_id,
                'job_name': (meta.get('job_name') or '').strip(),
                'pdf_name': (meta.get('pdf_name') or '').strip(),
                'pdf_path': (meta.get('pdf_path') or '').strip(),
                'page_num': meta.get('page_num', 0),
                'image_path': (meta.get('image_path') or '').strip(),
                'image_url': f"{API.IMAGE_BASE_URL}/{Path(meta.get('image_path') or '').name}",
                'category': (meta.get('category') or '').strip(),
                'process': (meta.get('process') or '').strip(),
                'machine': (meta.get('machine') or '').strip(),
                'part_numbers': parse_json_field(meta.get('part_numbers', '[]')),
                'match_type': 'semantic',
                'score': similarity
            })

    return matched[:top_k]


def search_hybrid(
    keyword: str = "",
    top_k: int = 10,
    category: str = "",
    process: str = "",
    machine: str = ""
) -> List[Dict]:
    """混合搜索：精确 + 子串 + 语义"""
    # 1. 精确/子串匹配
    keyword_results = search_by_keyword(keyword, top_k, category, process, machine)

    # 2. 如果关键词搜索结果不足，补充语义搜索
    if len(keyword_results) < top_k and keyword:
        semantic_results = search_semantic(keyword, top_k, category, process, machine)

        seen_ids = {r['id'] for r in keyword_results}
        for r in semantic_results:
            if r['id'] not in seen_ids:
                keyword_results.append(r)
                seen_ids.add(r['id'])

    return keyword_results[:top_k]


def suggest_job_names(keyword: str = "", top_k: int = 10) -> List[str]:
    """联想搜索 - 返回匹配的作业名称列表"""
    collection = get_chroma_collection()
    all_results = collection.get()

    job_names = set()
    for meta in all_results.get('metadatas', []):
        if meta and meta.get('job_name'):
            job_names.add(meta['job_name'])

    if not keyword:
        return sorted(list(job_names))[:top_k]

    keyword_upper = keyword.upper()
    matched = []

    for name in job_names:
        name_upper = name.upper()

        # 前缀匹配
        if name_upper.startswith(keyword_upper):
            matched.append((name, 10, name_upper))
        # 包含匹配
        elif keyword_upper in name_upper:
            matched.append((name, 8, name_upper))
        # 字符匹配
        elif all(c in name_upper for c in keyword_upper if c.isalnum()):
            matched.append((name, 4, name_upper))

    matched.sort(key=lambda x: (-x[1], x[2]))
    return [m[0] for m in matched[:top_k]]


# ============== 辅助函数 ==============

def _match_part_number(meta: dict, keyword: str) -> bool:
    """检查零件编号是否匹配"""
    part_numbers = parse_json_field(meta.get('part_numbers', '[]'))
    for pn in part_numbers:
        if keyword in pn.upper():
            return True
    return False


def parse_json_field(field: str) -> list:
    """解析JSON字段"""
    if not field:
        return []
    try:
        return json.loads(field)
    except:
        return []


def get_stats() -> Dict:
    """获取统计信息"""
    collection = get_chroma_collection()

    count = collection.count()

    job_names = set()
    categories = set()
    for meta in collection.get().get('metadatas', []):
        if meta:
            if meta.get('job_name'):
                job_names.add(meta['job_name'])
            if meta.get('category'):
                categories.add(meta['category'])

    return {
        'total_pages': count,
        'unique_jobs': len(job_names),
        'categories': len(categories)
    }


# ============== CLI测试 ==============

if __name__ == "__main__":
    import argparse
    from datetime import datetime

    parser = argparse.ArgumentParser(description='SOP检索API测试')
    parser.add_argument('cmd', nargs='?', choices=['search', 'suggest', 'stats', 'filters'])
    parser.add_argument('--keyword', '-k', type=str, default='')
    parser.add_argument('--top', '-n', type=int, default=10)
    parser.add_argument('--category', '-c', type=str, default='')
    parser.add_argument('--process', '-p', type=str, default='')
    parser.add_argument('--machine', '-m', type=str, default='')

    args = parser.parse_args()

    if args.cmd == 'search' or not args.cmd:
        results = search_hybrid(
            keyword=args.keyword,
            top_k=args.top,
            category=args.category,
            process=args.process,
            machine=args.machine
        )
        print(f"\n搜索结果 ({len(results)} 条):")
        for r in results:
            print(f"  [{r['match_type']}] {r['job_name']} - {r['category']}/{r['process']}/{r['machine']}")
            print(f"    图片: {r['image_url']}")

    elif args.cmd == 'suggest':
        results = suggest_job_names(keyword=args.keyword, top_k=args.top)
        print(f"\n联想结果 ({len(results)} 条):")
        for r in results:
            print(f"  {r}")

    elif args.cmd == 'stats':
        s = get_stats()
        print(f"\n统计信息:")
        print(f"  总页面数: {s['total_pages']}")
        print(f"  作业名称数: {s['unique_jobs']}")
        print(f"  分类数: {s['categories']}")

    elif args.cmd == 'filters':
        f = get_filter_options(category=args.category, machine=args.machine)
        print(f"\n筛选项:")
        print(f"  分类: {f['categories']}")
        print(f"  机型: {f['machines']}")
        print(f"  工序: {f['processes']}")
