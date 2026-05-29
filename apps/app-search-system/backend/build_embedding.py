#!/usr/bin/env python3
"""
PDF SOP 检索系统 - ChromaDB + 双向向量检索
- 关键词搜索: 输入作业名称 → 返回匹配页面
- 向量搜索: 输入文本描述 → 返回语义相关页面
- 联想搜索: 支持拼音、纠错
"""

import os
import sys
import glob
import fitz
import base64
import json
import re
import chromadb
from dashscope import MultiModalEmbedding, MultiModalConversation, TextEmbedding
import dashscope
from pypinyin import lazy_pinyin
import rapidfuzz
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from pathlib import Path
from runtime_paths import get_base_dir as get_runtime_base_dir, get_runtime_data_dir
from sop_dimensions import extract_file_dimensions
from scripts.config import DIR, CHROMA

# 向量搜索警告限流（最多5次）
_sem_warn_count = 0
_sem_warn_done = False


def _log_semantic_warn_once(msg: str):
    global _sem_warn_count, _sem_warn_done
    if _sem_warn_done:
        return
    if _sem_warn_count < 5:
        _sem_warn_count += 1
        print(f"[Search] {msg}")
    else:
        _sem_warn_done = True


# ============================================================
# ChromaDB + 视觉识别（LLM 仅用于 per-page embedding 文本）
# ============================================================

# 检测是否在 PyInstaller 打包环境中
def get_base_dir():
    """获取只读基础目录（exe 或脚本所在目录）"""
    return os.fspath(get_runtime_base_dir())

def get_data_dir():
    """获取统一运行时数据目录"""
    return os.fspath(get_runtime_data_dir())

BASE_DIR = get_base_dir()
DATA_DIR = get_data_dir()

# 配置路径（只读资源，放在 BASE_DIR）
COLLECTION_NAME = CHROMA.COLLECTION_NAME
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

# 运行时数据目录（用户可写）
RUNTIME_CHROMA_DIR = os.fspath(DIR.CHROMA_DIR)
RUNTIME_IMAGES_DIR = os.fspath(DIR.IMAGE_DIR)
RUNTIME_CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
_IMAGE_PATH_CACHE: dict[str, str] = {}


def load_config():
    """加载配置文件"""
    config_paths = [RUNTIME_CONFIG_FILE, CONFIG_FILE]
    for path in config_paths:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    return {}


def ensure_runtime_dirs():
    """确保运行时目录存在"""
    os.makedirs(RUNTIME_CHROMA_DIR, exist_ok=True)
    os.makedirs(RUNTIME_IMAGES_DIR, exist_ok=True)


# 加载配置并设置API Key
config = load_config()
dashscope.api_key = config.get("dashscope_api_key", os.environ.get("DASHSCOPE_API_KEY", ""))


def init_chroma():
    """初始化ChromaDB"""
    ensure_runtime_dirs()
    persist_dir = RUNTIME_CHROMA_DIR

    client = chromadb.PersistentClient(path=persist_dir)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "SOP页面双向索引"}
    )
    return client, collection


def get_image_path(img_filename: str) -> str:
    """获取图片路径，兼容旧版平铺文件和新版哈希子目录。"""
    if not img_filename:
        return ""

    normalized = img_filename.replace("\\", "/").strip()
    if os.path.isabs(normalized):
        return normalized

    direct_candidates = []
    if normalized:
        direct_candidates.append(os.path.join(RUNTIME_IMAGES_DIR, normalized.strip("/")))

    basename = os.path.basename(normalized)
    if basename and basename != normalized:
        direct_candidates.append(os.path.join(RUNTIME_IMAGES_DIR, basename))

    for candidate in direct_candidates:
        if os.path.exists(candidate):
            return candidate

    cached_path = _IMAGE_PATH_CACHE.get(basename)
    if cached_path and os.path.exists(cached_path):
        return cached_path

    if basename:
        matches = glob.glob(os.path.join(RUNTIME_IMAGES_DIR, "**", basename), recursive=True)
        if matches:
            resolved = matches[0]
            _IMAGE_PATH_CACHE[basename] = resolved
            return resolved

    if direct_candidates:
        return direct_candidates[0]
    return os.path.join(RUNTIME_IMAGES_DIR, basename)


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


# 双模型配置 - 轮询使用以提高并发速度
VISION_MODELS = [
    'qwen3-omni-flash-2025-12-01',
    'qwen3-omni-flash-2025-09-15'
]
_model轮询计数器 = 0

def get_vision_model():
    """轮询获取模型，分散API负载"""
    global _model轮询计数器
    model = VISION_MODELS[_model轮询计数器 % len(VISION_MODELS)]
    _model轮询计数器 += 1
    return model


def get_page_info_by_vision(image_bytes: bytes) -> dict:
    """视觉识别页面信息（合并调用，一次获取作业名称和所有文本内容）

    Returns:
        dict: {"job_name": str, "part_numbers": list, "project": str, "keywords": list}
              job_name 为 "__NO_JOB__" 表示封面/目录等无需索引的页面
    """
    img_base64 = base64.b64encode(image_bytes).decode('utf-8')

    messages = [{
        "role": "user",
        "content": [
            {"image": f"data:image/jpeg;base64,{img_base64}"},
            {"text": """这是SOP页面，请识别以下信息：

1. 作业名称：在页眉表格中（如PA2720、PA03296等）
   - 封面/目录/修订历史页面返回 "__NO_JOB__"
   - 正常SOP页面返回实际作业名称

2. 零件编号：如 59-222137-01、59-081678-01 等格式的编号

3. 项目名称

4. 其他关键词

请用JSON格式返回：{"job_name": "作业名称或__NO_JOB__", "part_numbers": ["零件编号列表"], "project": "项目名称", "keywords": ["其他关键词"]}
只返回JSON，不要其他说明。"""}
        ]
    }]

    response = MultiModalConversation.call(model=get_vision_model(), messages=messages)

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
        try:
            # 尝试提取JSON部分
            if '{' in text and '}' in text:
                json_start = text.index('{')
                json_end = text.rindex('}') + 1
                text = text[json_start:json_end]
            data = json.loads(text)
            # 确保所有字段存在
            return {
                "job_name": data.get("job_name", "__NO_JOB__"),
                "part_numbers": data.get("part_numbers", []),
                "project": data.get("project", ""),
                "keywords": data.get("keywords", [])
            }
        except:
            pass

    return {"job_name": "__NO_JOB__", "part_numbers": [], "project": "", "keywords": []}



def get_text_embedding(text: str) -> list:
    """获取文本embedding（用于语义搜索）"""
    resp = TextEmbedding.call(
        model='text-embedding-v2',
        input=[text]
    )

    if resp.status_code == 200:
        return resp.output['embeddings'][0]['embedding']
    else:
        raise Exception(f"Text embedding失败: {resp.code}")


def process_page(pdf_path: str, page_num: int, safe_name: str, dims: dict) -> dict:
    """处理单个页面（用于并发调用）

    dims 由主线程预计算后传入，包含:
        {category, category_parts, process, machine, job_name, pdf_name}
    LLM 仅用于提取 per-page 文本内容以供 embedding。
    """
    try:
        # 转换图片
        img_bytes = pdf_page_to_image(pdf_path, page_num)

        # 一次性识别页面所有信息（作业名称、零件编号、项目名称等）
        page_info = get_page_info_by_vision(img_bytes)

        # job_name 优先从文件名提取（dims），这是该 SOP 的合辑标题；
        # per_page_job_name 是该页面视觉识别出的作业名称，仅用于参考，不作为合辑标题
        job_name = dims.get("job_name") or ""
        per_page_job_name = page_info.get("job_name", "")

        # 封面/目录/修订历史等无内容页面：跳过，不写入索引
        if per_page_job_name == "__NO_JOB__":
            return {"page_num": page_num, "skipped": True, "reason": "封面/无内容页面"}

        # 构建用于 embedding 的文本（将页面识别的作业名称也加入，提升语义检索命中率）
        text_parts = []
        if job_name:
            text_parts.append(f"作业名称: {job_name}")
        if per_page_job_name and per_page_job_name != "__NO_JOB__":
            text_parts.append(f"页面作业: {per_page_job_name}")

        # 添加零件编号
        part_numbers = page_info.get('part_numbers', [])
        if part_numbers:
            text_parts.append(f"零件编号: {', '.join(part_numbers)}")

        # 添加项目名称
        project = page_info.get('project', '')
        if project:
            text_parts.append(f"项目: {project}")

        # 添加其他关键词
        keywords = page_info.get('keywords', [])
        if keywords:
            text_parts.append(f"关键词: {', '.join(keywords)}")

        # 维度由主线程预计算后传入，不再重复调用 LLM
        category = dims["category"]
        process = dims["process"]
        machine = dims.get("machine", "")
        category_parts = dims.get("category_parts", [])

        if category:
            text_parts.append(f"分类: {category}")
        if machine:
            text_parts.append(f"机型: {machine}")
        if process:
            text_parts.append(f"工序: {process}")

        text_for_embedding = ' '.join(text_parts)

        # 保存图片到运行时目录
        img_filename = f"{safe_name}_p{page_num+1}.jpg"
        img_path = os.path.join(RUNTIME_IMAGES_DIR, img_filename)

        with open(img_path, 'wb') as f:
            f.write(img_bytes)

        # pdf_name：完整文件名（不含 .pdf），作为展示标题
        import re as _re
        pdf_name = _re.sub(r'\.pdf$', '', os.path.basename(pdf_path), flags=_re.IGNORECASE).strip()

        try:
            embedding = get_text_embedding(text_for_embedding)
        except Exception as e:
            return {"page_num": page_num, "skipped": True, "reason": f"embedding失败: {e}"}

        doc_id = f"{safe_name}_page{page_num+1}"

        return {
            "page_num": page_num,
            "skipped": False,
            "id": doc_id,
            "embedding": embedding,
            "metadata": {
                "job_name": job_name,          # 合辑标题（从文件名提取）
                "pdf_name": pdf_name,           # 完整文件名（展示用）
                "pdf_path": pdf_path,
                "page_num": page_num + 1,
                "image_path": img_path,
                "part_numbers": json.dumps(part_numbers, ensure_ascii=False) if part_numbers else "[]",
                "project": project,
                "keywords": json.dumps(keywords, ensure_ascii=False) if keywords else "[]",
                "category": category,
                "category_parts": json.dumps(category_parts, ensure_ascii=False),  # 拆分后的分类列表
                "machine": machine,
                "process": process,
            },
            "document": text_for_embedding,
            "job_name": job_name,
            "per_page_job_name": per_page_job_name,
            "part_count": len(part_numbers)
        }
    except Exception as e:
        return {"page_num": page_num, "skipped": True, "reason": f"处理错误: {e}"}


def build_index(pdf_files: list = None, max_workers: int = 15, rebuild: bool = False):
    """构建索引（并发版本，支持断点续传）

    断点续传逻辑：以 pdf_path 为单位，
    若数据库中已存在该文件的所有页面记录，则跳过 API 调用，直接复用已有记录。

    Args:
        pdf_files: PDF文件列表
        max_workers: 最大并发数（建议10-20，避免API限流）
        rebuild: 若为 True，先清空 collection 从头重建
    """
    ensure_runtime_dirs()
    os.makedirs(RUNTIME_IMAGES_DIR, exist_ok=True)

    if pdf_files is None:
        pdf_files = glob.glob("**/*.pdf", recursive=True)

    client, collection = init_chroma()

    # 断点续传：加载已有记录，按 pdf_path 归组
    existing_by_file: dict[str, dict[str, dict]] = {}
    if not rebuild:
        all_results = collection.get(include=["metadatas"])
        for doc_id, meta in zip(
                all_results.get("ids", []) or [],
                all_results.get("metadatas", []) or []
        ):
            if not meta or "pdf_path" not in meta:
                continue
            pdf_path = meta["pdf_path"]
            if pdf_path not in existing_by_file:
                existing_by_file[pdf_path] = {}
            existing_by_file[pdf_path][doc_id] = meta
        print(f"已有 {len(all_results.get('ids', []) or [])} 条记录，"
              f"覆盖 {len(existing_by_file)} 个文件\n")

    total_files = len(pdf_files)
    indexed_count = 0
    skipped_count = 0

    print(f"找到 {total_files} 个PDF文件")
    print(f"并发数: {max_workers}\n")

    print_lock = threading.Lock()

    for i, pdf_path in enumerate(pdf_files):
        norm_path = pdf_path.replace("\\", "/")
        filename = norm_path.split("/")[-1]
        safe_name = "".join(c for c in os.path.basename(pdf_path) if c.isalnum() or c in ' -_')

        try:
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()
        except Exception as e:
            print(f"[{i+1}/{total_files}] {filename}: 打开失败 {e}")
            continue

        print(f"[{i+1}/{total_files}] {filename}")

        dims = extract_file_dimensions(pdf_path)
        existing_pages = existing_by_file.get(pdf_path, {}) if not rebuild else {}

        # 预处理：区分需要 API 处理的页 vs 直接用已有记录的页
        new_tasks = []      # 需要 process_page（API 调用）
        existing_tasks = []  # 直接用已有记录
        for page_num in range(page_count):
            doc_id = f"{safe_name}_page{page_num+1}"
            if doc_id in existing_pages:
                existing_tasks.append((doc_id, existing_pages[doc_id]))
            else:
                new_tasks.append((pdf_path, page_num, safe_name, dims))

        for doc_id, meta in existing_tasks:
            with print_lock:
                print(f"  页{meta.get('page_num', '?')}: [跳过] 维度已索引，使用已有记录")
            skipped_count += 1

        if not new_tasks:
            continue

        batch_ids = []
        batch_embeddings = []
        batch_metadatas = []
        batch_documents = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_doc_id = {
                executor.submit(process_page, *task): task[1]
                for task in new_tasks
            }
            for future in as_completed(future_to_doc_id):
                page_num = future_to_doc_id[future]
                try:
                    result = future.result()
                    if result.get("skipped"):
                        with print_lock:
                            print(f"  页{result['page_num']+1}: [跳过] {result.get('reason', '')}")
                        skipped_count += 1
                    else:
                        batch_ids.append(result["id"])
                        batch_embeddings.append(result["embedding"])
                        batch_metadatas.append(result["metadata"])
                        batch_documents.append(result["document"])
                        with print_lock:
                            print(f"  页{result['page_num']+1}: {result['job_name']} | 零件: {result['part_count']}个")
                        indexed_count += 1
                        if len(batch_ids) >= 20:
                            collection.upsert(
                                ids=batch_ids, embeddings=batch_embeddings,
                                metadatas=batch_metadatas, documents=batch_documents
                            )
                            batch_ids.clear()
                            batch_embeddings.clear()
                            batch_metadatas.clear()
                            batch_documents.clear()
                except Exception as e:
                    with print_lock:
                        print(f"  页{page_num+1}: [错误] {e}")
                    skipped_count += 1

        if batch_ids:
            collection.upsert(
                ids=batch_ids, embeddings=batch_embeddings,
                metadatas=batch_metadatas, documents=batch_documents
            )

    print(f"\n索引构建完成! 本次新增: {indexed_count} 页, 跳过: {skipped_count} 页")



# get_all_job_names 缓存（TTL = 60s，避免每次 suggest 请求都全量加载 ChromaDB）
_job_names_cache: dict = {'names': [], 'ts': 0.0}
_JOB_NAMES_CACHE_TTL = 60  # 秒


def get_all_job_names() -> list:
    """获取所有作业名称（60s TTL 缓存，减少 ChromaDB 全量 collection.get() 频次）"""
    import time as _time
    now = _time.time()
    if now - _job_names_cache['ts'] < _JOB_NAMES_CACHE_TTL and _job_names_cache['names']:
        return _job_names_cache['names']

    _, collection = init_chroma()
    all_results = collection.get()

    job_names = set()
    for meta in all_results.get('metadatas', []):
        if meta and 'job_name' in meta:
            job_names.add(meta['job_name'])

    names = sorted(list(job_names))
    _job_names_cache['names'] = names
    _job_names_cache['ts'] = now
    return names


# get_filter_options 缓存（TTL = 5 分钟）
_filter_options_cache: dict = {'data': None, 'ts': 0.0}
_FILTER_OPTIONS_CACHE_TTL = 300  # 秒


def _split_compound(val: str) -> list:
    """按 & 拆分复合值，trim 每个部分，过滤空项，去重"""
    parts = [p.strip() for p in val.split('&')]
    return [p for p in parts if p]

def get_filter_options(category: str = '', machine: str = '') -> dict:
    """获取筛选项（支持三级级联过滤，5 分钟缓存）

    级联规则：
      - category='' 且 machine='' → 全量（使用缓存）
      - category='X'             → 返回属于X的机型 + 全量工序
      - machine='Y'              → 返回属于Y的工序（与category组合）

    过滤规则：
      - 分类下拉：复合分类按 & 拆分为多个独立选项
      - 机型下拉：始终排除所有分类名（case-insensitive）

    Args:
        category: 分类筛选（触发机型级联）
        machine:   机型筛选（触发工序级联）
    """
    import time as _time
    now = _time.time()
    cache = _filter_options_cache['data']

    # 无缓存时先构建缓存（所有选项）
    if not cache:
        _, collection = init_chroma()
        all_results = collection.get()
        cat_set, mach_set, proc_set = set(), set(), set()
        for meta in all_results.get('metadatas', []):
            if not meta:
                continue
            cat_raw  = (meta.get('category')       or '').strip()
            proc     = (meta.get('process')        or '').strip()
            mach     = (meta.get('machine')        or '').strip()
            # 分类收集：
            #   - cat_dropdown_set：只存 category_parts 拆分后的独立名（显示在下拉）
            #   - cat_all_set：存所有分类名（包含原始复合名，用于机型去重）
            if cat_raw:
                parts_raw = meta.get('category_parts', '')
                try:
                    parts_list = json.loads(parts_raw) if parts_raw else []
                except Exception:
                    parts_list = []
                for p in parts_list:
                    if p:
                        cat_set.add(p)
                # 原始复合名也加入机器去重集合（防止 "MP02043&..." 混入机型）
                if '&' in cat_raw:
                    cat_set.add(cat_raw)
            if proc: proc_set.add(proc)
            if mach: mach_set.add(mach)

        # 分类名小写集合（用于机型去重）
        all_cats_lower = {c.lower() for c in cat_set}

        # 机型：排除所有分类名（始终过滤，不只在级联时）
        machines_all = sorted({
            m for m in mach_set if m and m.lower() not in all_cats_lower
        })

        # 分类下拉列表（排除含 & 的复合名）
        categories_dropdown = sorted({c for c in cat_set if '&' not in c})

        full_data = {
            "categories": categories_dropdown,
            "machines":   machines_all,
            "processes":  sorted(proc_set),
        }
        _filter_options_cache['data'] = full_data
        _filter_options_cache['ts'] = now
        cache = full_data

    # 无级联参数 → 直接返回缓存的全量数据（缓存已处理好去重）
    if not category and not machine:
        return cache

    # 有级联参数 → 从 ChromaDB 直接过滤（不使用缓存）
    _, collection = init_chroma()
    all_results = collection.get()
    all_metas = all_results.get('metadatas', [])
    all_cats_lower = {c.lower() for c in cache.get('categories', [])}

    if category:
        # 按分类过滤机型（支持 category_parts），同时排除分类名
        machines_of_cat = sorted({
            (m.get('machine') or '').strip()
            for m in all_metas
            if (
                (m.get('category') or '').strip().lower() == category.lower()
                or category in _split_compound((m.get('category') or '').strip())
                or category in _safe_json_list(m.get('category_parts', ''))
            )
            and (m.get('machine') or '').strip()
            and (m.get('machine') or '').strip().lower() not in all_cats_lower
        })
    else:
        machines_of_cat = cache.get('machines', [])

    if machine:
        # 按机型过滤工序
        processes_of_mach = sorted({
            (m.get('process') or '').strip()
            for m in all_metas
            if (m.get('machine') or '').strip().lower() == machine.lower()
            and (m.get('process') or '').strip()
        })
    else:
        processes_of_mach = cache.get('processes', [])

    return {
        "categories": cache.get('categories', []),
        "machines":   machines_of_cat,
        "processes":  processes_of_mach,
    }


def _safe_json_list(raw: str) -> list:
    try:
        return json.loads(raw) if raw else []
    except Exception:
        return []


def suggest_job_names(keyword: str, top_k: int = 10) -> list:
    """联想搜索 - 支持汉字、拼音、纠错"""
    all_names = get_all_job_names()

    if not keyword:
        return all_names[:top_k]

    keyword_upper = keyword.upper()
    keyword_pinyin = ''.join(lazy_pinyin(keyword)).lower()

    # 先检查是否存在精确匹配
    for name in all_names:
        if name.upper() == keyword_upper:
            return [name]  # 精确匹配直接返回单个结果

    matched = []

    for name in all_names:
        name_upper = name.upper()
        name_pinyin = ''.join(lazy_pinyin(name)).lower()

        # 1. 前缀匹配（最高优先级）
        if name_upper.startswith(keyword_upper):
            matched.append((name, 10))
        # 2. 包含匹配
        elif keyword_upper in name_upper:
            matched.append((name, 8))
        # 3. 拼音前缀匹配
        elif keyword_pinyin and name_pinyin.startswith(keyword_pinyin):
            matched.append((name, 7))
        # 4. 拼音包含匹配
        elif keyword_pinyin and keyword_pinyin in name_pinyin:
            matched.append((name, 6))
        # 5. 字符模糊匹配
        elif all(c in name_upper for c in keyword_upper if c.isalnum()):
            matched.append((name, 4))
        # 6. 纠错匹配
        else:
            ratio = rapidfuzz.fuzz.ratio(keyword_upper, name_upper)
            if ratio >= 70:
                matched.append((name, ratio / 25))

    matched.sort(key=lambda x: (-x[1], x[0]))
    return [m[0] for m in matched[:top_k]]


def _apply_filters(metas: list, category: str, process: str, machine: str = "") -> list:
    """在 metadata 列表上应用筛选，返回命中的索引列表"""
    indices = []
    for i, meta in enumerate(metas):
        if not meta:
            continue
        if category:
            # 同时匹配 category 字段和 category_parts 列表（支持复合分类拆分）
            if meta.get('category', '') != category:
                parts_raw = meta.get('category_parts', '')
                try:
                    parts_list = json.loads(parts_raw) if parts_raw else []
                except Exception:
                    parts_list = []
                if category not in parts_list:
                    continue
        if process and meta.get('process', '') != process:
            continue
        if machine and meta.get('machine', '') != machine:
            continue
        indices.append(i)
    return indices


def search_by_job_name(
    keyword: str,
    top_k: int = 10,
    exact_match: bool = False,
    category: str = "",
    process: str = "",
    machine: str = "",
) -> list:
    """关键词搜索

    Args:
        keyword: 搜索关键词
        top_k: 返回数量
        exact_match: 是否精确匹配（作业名称完全等于关键词）
        category: 分类筛选（如 "成品包装", "装配"）
        process: 工序筛选（如 "包装", "装配"）
    """
    _, collection = init_chroma()
    all_results = collection.get()
    all_metas = all_results.get('metadatas', [])

    # 先按维度过滤
    if category or process or machine:
        valid_indices = _apply_filters(all_metas, category, process, machine)
    else:
        valid_indices = list(range(len(all_metas)))

    matched = []
    keyword_upper = keyword.upper()
    seen_ids = set()

    # 空关键词：返回所有记录（按作业名排序），避免 '' in job 为 True 导致全量匹配
    if not keyword_upper:
        all_ids = all_results['ids']
        sorted_indices = sorted(valid_indices, key=lambda i: all_metas[i].get('job_name', ''))
        for idx in sorted_indices:
            meta = all_metas[idx]
            doc_id = all_results['ids'][idx]
            if doc_id in seen_ids:
                continue
            img_path = meta.get('image_path', '')
            if img_path and not os.path.isabs(img_path):
                img_path = get_image_path(os.path.basename(img_path))
            # 只返回图片真实存在的记录
            # 2026-04-01: 禁用此检查——打包后服务器图片路径可能与开发机不同，
            # 图片不存在时前端收到404，仍能显示其他元数据而不崩溃
            # if not img_path or not os.path.exists(img_path):
            #     continue
            seen_ids.add(doc_id)
            matched.append({
                "id": doc_id,
                "job_name": meta.get('job_name', ''),
                "pdf_name": meta.get('pdf_name', ''),
                "pdf_path": meta.get('pdf_path', ''),
                "page_num": meta.get('page_num', 0),
                "image_path": img_path,
                "match_type": "all",
                "category": meta.get('category', ''),
                "process": meta.get('process', ''),
                "machine": meta.get('machine', ''),
            })
            if len(matched) >= top_k:
                break
        return matched

    for idx in valid_indices:
        doc_id = all_results['ids'][idx]
        meta = all_metas[idx]
        job = meta.get('job_name', '')

        match_found = False
        match_type = None

        # 1. 搜索作业名称
        pdf_name = meta.get('pdf_name', '')
        category_name = meta.get('category', '')
        machine_name = meta.get('machine', '')
        process_name = meta.get('process', '')
        pdf_path = meta.get('pdf_path', '')
        if exact_match:
            if job.upper() == keyword_upper:
                match_found = True
                match_type = "exact_job"
            elif pdf_name and pdf_name.upper() == keyword_upper:
                match_found = True
                match_type = "exact_pdf_name"
            elif category_name and category_name.upper() == keyword_upper:
                match_found = True
                match_type = "exact_category"
            elif machine_name and machine_name.upper() == keyword_upper:
                match_found = True
                match_type = "exact_machine"
            elif process_name and process_name.upper() == keyword_upper:
                match_found = True
                match_type = "exact_process"
        else:
            if keyword_upper in job.upper():
                match_found = True
                match_type = "substring_job"
            elif pdf_name and keyword_upper in pdf_name.upper():
                match_found = True
                match_type = "substring_pdf_name"
            elif category_name and keyword_upper in category_name.upper():
                match_found = True
                match_type = "substring_category"
            elif machine_name and keyword_upper in machine_name.upper():
                match_found = True
                match_type = "substring_machine"
            elif process_name and keyword_upper in process_name.upper():
                match_found = True
                match_type = "substring_process"
            elif pdf_path and keyword_upper in pdf_path.upper():
                match_found = True
                match_type = "substring_pdf_path"

        # 2. 搜索零件编号（存储为JSON字符串）
        if not match_found:
            part_numbers_json = meta.get('part_numbers', '[]')
            try:
                part_numbers = json.loads(part_numbers_json) if part_numbers_json else []
                for pn in part_numbers:
                    if keyword_upper in pn.upper():
                        match_found = True
                        match_type = "part_number"
                        break
            except:
                pass

        # 3. 搜索项目名称
        if not match_found:
            project = meta.get('project', '')
            if project and keyword_upper in project.upper():
                match_found = True
                match_type = "project"

        # 4. 搜索关键词列表
        if not match_found:
            keywords_json = meta.get('keywords', '[]')
            try:
                keywords = json.loads(keywords_json) if keywords_json else []
                for kw in keywords:
                    if keyword_upper in kw.upper():
                        match_found = True
                        match_type = "keyword"
                        break
            except:
                pass

        if match_found and doc_id not in seen_ids:
            seen_ids.add(doc_id)
            img_path = meta.get('image_path', '')
            if img_path and not os.path.isabs(img_path):
                img_path = get_image_path(os.path.basename(img_path))
            # 只返回图片真实存在的记录，避免前端显示空卡片
            # 2026-04-01: 禁用此检查——打包后服务器图片路径可能与开发机不同，
            # 图片不存在时前端收到404，仍能显示其他元数据而不崩溃
            # if not img_path or not os.path.exists(img_path):
            #     continue
            matched.append({
                "id": doc_id,
                "job_name": job,                    # 合辑标题（从文件名提取）
                "pdf_name": meta.get('pdf_name', ''),  # 完整文件名（展示用）
                "pdf_path": meta.get('pdf_path', ''),
                "page_num": meta.get('page_num', 0),
                "image_path": img_path,
                "match_type": match_type,
                "category": meta.get('category', ''),
                "process": meta.get('process', ''),
                "machine": meta.get('machine', ''),
            })

    # 不在此处去重，保留所有匹配记录（含重复 job_name）
    # 图片存在性已在添加记录时检查
    matched.sort(key=lambda x: x['job_name'])
    return matched[:top_k]


def search_by_text_description(
    description: str,
    top_k: int = 10,
    category: str = "",
    process: str = "",
    machine: str = "",
) -> list:
    """向量语义搜索

    Args:
        description: 搜索描述文本
        top_k: 返回数量
        category: 分类筛选（如 "成品包装", "装配"）
        process: 工序筛选（如 "包装", "装配"）
    """
    _, collection = init_chroma()
    all_results = collection.get()
    all_metas = all_results.get('metadatas', [])

    # 三维度过滤：收集符合条件的 ID
    valid_doc_ids = set()
    for i, meta in enumerate(all_metas):
        if not meta:
            continue
        if category and meta.get('category', '') != category:
            continue
        if process and meta.get('process', '') != process:
            continue
        if machine and meta.get('machine', '') != machine:
            continue
        valid_doc_ids.add(all_results['ids'][i])

    # 如果筛选项为空，则不限制
    has_filter = bool(category or process or machine)

    try:
        query_embedding = get_text_embedding(description)
    except Exception as e:
        _log_semantic_warn_once(f"语义检索已降级为关键词检索: {e}")
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k * 3 if has_filter else top_k,
    )

    matched = []
    if results and results.get('ids') and results['ids'][0]:
        for i, doc_id in enumerate(results['ids'][0]):
            # 有筛选时只接受在 valid_doc_ids 中的结果
            if has_filter and doc_id not in valid_doc_ids:
                continue
            meta = results['metadatas'][0][i]
            distance = results['distances'][0][i]
            similarity = 1 - distance

            img_path = meta.get('image_path', '')
            if img_path and not os.path.isabs(img_path):
                img_path = get_image_path(os.path.basename(img_path))
            # 只返回图片真实存在的记录，避免前端显示空卡片
            # 2026-04-01: 禁用此检查——打包后服务器图片路径可能与开发机不同，
            # 图片不存在时前端收到404，仍能显示其他元数据而不崩溃
            # if not img_path or not os.path.exists(img_path):
            #     continue

            matched.append({
                "id": doc_id,
                "job_name": meta.get('job_name', ''),
                "pdf_name": meta.get('pdf_name', ''),
                "pdf_path": meta.get('pdf_path', ''),
                "page_num": meta.get('page_num', 0),
                "image_path": img_path,
                "similarity": round(similarity, 4),
                "match_type": "semantic",
                "category": meta.get('category', ''),
                "process": meta.get('process', ''),
                "machine": meta.get('machine', ''),
            })
            if len(matched) >= top_k:
                break

    return matched


def search_hybrid(
    keyword: str,
    top_k: int = 10,
    category: str = "",
    process: str = "",
    machine: str = "",
) -> list:
    """混合搜索: 精确匹配 + 子串匹配 + 向量语义，统一去重，优先返回有图片的记录"""
    keyword = (keyword or "").strip()

    # 1. 精确匹配（不改 job_name，返回可能重复的记录）
    exact_results = search_by_job_name(
        keyword, top_k, exact_match=True,
        category=category, process=process, machine=machine,
    )

    # 2. 子串匹配（不重复精确匹配结果）
    keyword_results = search_by_job_name(
        keyword, top_k, exact_match=False,
        category=category, process=process, machine=machine,
    )
    # 去重（精确匹配结果已含于子串结果中，但子串结果可能有更丰富的记录）
    seen_ids = {r['id'] for r in exact_results}
    keyword_results = [r for r in keyword_results if r['id'] not in seen_ids]

    # 3. 合并精确+子串结果，优先选有 image_path 的
    all_keyword = exact_results + keyword_results
    # 按 doc_id 去重，同 doc_id 优先选有 image_path 的
    id_best: dict[str, dict] = {}
    for r in all_keyword:
        doc_id = r.get('id', '')
        if doc_id not in id_best:
            id_best[doc_id] = r
        elif not id_best[doc_id].get('image_path') and r.get('image_path'):
            id_best[doc_id] = r
    all_results = list(id_best.values())

    # 空关键词只返回关键词/筛选结果，避免无意义的实时 embedding 调用。
    if not keyword:
        return all_results[:top_k]

    # 4. 若关键词搜索已有 top_k 条结果，跳过语义搜索
    if len(all_results) >= top_k:
        return all_results[:top_k]

    # 5. 关键词搜索结果不足，补充语义搜索
    semantic_results = search_by_text_description(
        keyword, top_k,
        category=category, process=process, machine=machine,
    )
    # 语义结果去重（排除关键词已返回的 doc_id）
    for r in semantic_results:
        doc_id = r.get('id', '')
        if doc_id not in seen_ids:
            seen_ids.add(doc_id)
            if not r.get('image_path'):
                # 语义结果无图片时，尝试用关键词结果中有图片的同 doc_id 记录替换
                pass
            all_results.append(r)
        elif not any(existing.get('image_path') for existing in all_results if existing.get('id') == doc_id) and r.get('image_path'):
            # 已有记录无图片，用语义结果中有图片的替换
            for i, existing in enumerate(all_results):
                if existing.get('id') == doc_id and not existing.get('image_path'):
                    all_results[i] = r
                    break

    return all_results[:top_k]


def get_stats():
    """获取统计"""
    _, collection = init_chroma()
    count = collection.count()
    job_names = get_all_job_names()
    return {
        "total_pages": count,
        "total_documents": count,
        "unique_job_names": len(job_names)
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PDF SOP 检索索引构建")
    parser.add_argument("cmd", nargs="?", default="stats",
                        choices=["build", "stats", "test"])
    parser.add_argument("--rebuild", action="store_true",
                        help="清空已有索引，从头重建（默认 False，断点续传）")
    parser.add_argument("--workers", type=int, default=15,
                        help="并发数（默认 15）")
    args = parser.parse_args()

    if args.cmd == "build":
        from scripts.run_pipeline import run_full_pipeline

        print("build_embedding.py build 已切换到统一流水线 run_pipeline.py")
        results = run_full_pipeline(workers=args.workers, rebuild=args.rebuild)
        if results.get("errors"):
            print(f"流水线执行有错误: {results['errors']}")
            sys.exit(1)
    elif args.cmd == "stats":
        stats = get_stats()
        print(f"已索引: {stats['total_pages']} 页, {stats['unique_job_names']} 个作业名称")
    elif args.cmd == "test":
        print("测试联想搜索:")
        print("PA ->", suggest_job_names("PA", 5))
