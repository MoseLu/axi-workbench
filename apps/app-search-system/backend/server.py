#!/usr/bin/env python3
"""
SOP 系统主服务器
- Flask HTTP API（端口 8765）
- 包含：认证、设备管理、命令推送、检索 API
- PDF 同步守护线程（凌晨2点）
"""
import sys
import os
import uuid
import hashlib
from urllib.parse import quote, unquote
from runtime_paths import get_runtime_data_dir

# ============== 路径处理 ==============
def get_data_dir():
    """获取统一运行时数据目录。"""
    return os.fspath(get_runtime_data_dir())

DATA_DIR = get_data_dir()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ============== Flask 应用 ==============
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import threading
import time
import json

app = Flask(__name__, static_folder=None)  # 禁用内置静态服务，我们自定义 /static 路由
try:
    from flask_cors import CORS
    CORS(app)
except ImportError:
    print('[WARN] flask-cors not installed, using manual CORS headers')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# ============== 初始化数据 ==============
# 初始化数据库（创建表和默认账号）
from models import init_db
initial_admin_password = init_db()

# ============== 加载配置（支持两种路径：exe同目录 或 _internal）==============
def find_config():
    """查找配置文件，优先从 exe 同目录，其次 _internal"""
    exe_dir = DATA_DIR
    internal_dir = os.path.join(exe_dir, "_internal") if getattr(sys, 'frozen', False) else exe_dir

    for d in [exe_dir, internal_dir]:
        config_path = os.path.join(d, "config.json")
        if os.path.exists(config_path):
            return config_path
    return os.path.join(exe_dir, "config.json")

CONFIG_FILE = find_config()
CHROMA_PERSIST_DIR = os.path.join(DATA_DIR, "chroma_db")
IMAGES_DIR = os.path.join(DATA_DIR, "pdf_images")
LOGS_DIR = os.path.join(DATA_DIR, "logs")
ASSERTS_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "asserts"))
BACKEND_LEGACY_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdf_images")
BACKEND_DATA_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "pdf_images")
FRONTEND_BUILD_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "build", "images")

# 图片列表缓存（TTL = 30s，避免频繁 os.listdir 扫描）
_images_cache: dict = {'files': [], 'ts': 0.0}
_IMAGES_CACHE_TTL = 30  # 秒


def build_image_url(image_path: str) -> str:
    if not image_path:
        return ''
    return f"/api/image-file?path={quote(image_path, safe='')}"


def build_pdf_url(pdf_path: str) -> str:
    if not pdf_path:
        return ''
    return f"/api/pdf-file?path={quote(pdf_path, safe='')}"


def _normalize_requested_path(raw_path: str) -> str:
    decoded = unquote(raw_path or '').strip()
    if not decoded:
        return ''
    return os.path.normpath(decoded)


def _candidate_files(path_value: str, fallback_dirs: list[str]) -> list[str]:
    candidates: list[str] = []
    normalized = _normalize_requested_path(path_value)
    if normalized:
        candidates.append(normalized)
        basename = os.path.basename(normalized)
        if basename:
            for root in fallback_dirs:
                candidates.append(os.path.join(root, basename))

    deduped: list[str] = []
    seen = set()
    for candidate in candidates:
        if candidate and candidate not in seen:
            deduped.append(candidate)
            seen.add(candidate)
    return deduped


def _image_search_dirs() -> list[str]:
    dirs = [
        IMAGES_DIR,
        BACKEND_LEGACY_IMAGES_DIR,
        BACKEND_DATA_IMAGES_DIR,
        FRONTEND_BUILD_IMAGES_DIR,
    ]
    deduped: list[str] = []
    seen = set()
    for root in dirs:
        normalized = os.path.normcase(os.path.normpath(root))
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(root)
    return deduped

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

config = load_config()


def _configured_server_port() -> int:
    try:
        return int(
            config.get("server", {}).get("port")
            or config.get("server_port")
            or 8765
        )
    except Exception:
        return 8765


def _cli_server_port(default_port: int) -> int:
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except Exception:
            pass
    return default_port


SERVER_PORT = _cli_server_port(_configured_server_port())
ASR_PORT = SERVER_PORT + 1
SERVER_ID_FILE = os.path.join(DATA_DIR, "server.id")


def get_server_id() -> str:
    try:
        if os.path.exists(SERVER_ID_FILE):
            with open(SERVER_ID_FILE, 'r', encoding='utf-8') as f:
                server_id = f.read().strip()
                if server_id:
                    return server_id
        server_id = uuid.uuid4().hex
        with open(SERVER_ID_FILE, 'w', encoding='utf-8') as f:
            f.write(server_id)
        return server_id
    except Exception:
        return "sop-server"


SERVER_ID = get_server_id()
DEFAULT_REMOTE_SOURCE_DIR = r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)"


def _normalize_config_host(host_value: str) -> str:
    host = (host_value or '').strip()
    if not host or host == '0.0.0.0':
        return ''
    return host


def build_discovery_payload(req=None) -> dict:
    base_urls: list[str] = []
    seen = set()

    def add_url(url: str):
        normalized = (url or '').rstrip('/')
        if normalized and normalized not in seen:
            seen.add(normalized)
            base_urls.append(normalized)

    if req is not None:
        add_url(f"{req.scheme}://{req.host}")

    configured_host = _normalize_config_host(
        config.get("server", {}).get("host") or config.get("server_host", "")
    )
    if configured_host:
        add_url(f"http://{configured_host}:{SERVER_PORT}")

    add_url(f"http://127.0.0.1:{SERVER_PORT}")
    add_url(f"http://localhost:{SERVER_PORT}")

    return {
        'status': 'ok',
        'service': 'sop-server',
        'server_id': SERVER_ID,
        'http_port': SERVER_PORT,
        'asr_port': ASR_PORT,
        'base_urls': base_urls,
        'timestamp': time.time(),
    }

# 设置 API Key（优先级：config > 环境变量）
import dashscope
dashscope.api_key = (
    config.get("dashscope_api_key")
    or config.get("dashscope", {}).get("api_key")
    or os.environ.get("DASHSCOPE_API_KEY", "")
)

# ============== 注册路由模块 ==============
# 认证路由
from auth import init_auth_routes, jwt_required
init_auth_routes(app)

# 设备管理路由
from device_manager import init_device_routes
init_device_routes(app)

# 命令推送路由
from command_pusher import init_command_routes
init_command_routes(app)

# OTA 更新路由
from ota_update import init_ota_routes
init_ota_routes(app, lambda: DATA_DIR)

# ============== 现有检索 API（保持兼容） ==============
from build_embedding import (
    suggest_job_names, search_by_job_name, search_by_text_description,
    search_hybrid, get_stats, get_all_job_names, get_image_path,
    get_filter_options, init_chroma
)
from scripts.config import DIR
from sop_metadata_index import (
    sync_index as sync_sop_metadata_index,
    search_metadata as search_path_metadata,
    suggest_terms as suggest_path_terms,
    get_filter_options as get_path_filter_options,
    get_stats as get_path_metadata_stats,
)


def get_search_source_root() -> str:
    source_dir = os.fspath(DIR.SOURCE_DIR) if getattr(DIR, "SOURCE_DIR", None) else ""
    return os.path.normpath(source_dir or "")


def _normalize_search_path(path_value: str) -> str:
    return os.path.normcase(os.path.normpath(path_value or ""))


def is_path_under_root(path_value: str, root_path: str) -> bool:
    normalized_path = _normalize_search_path(path_value)
    normalized_root = _normalize_search_path(root_path)
    if not normalized_root:
        return True
    try:
        common = os.path.commonpath([normalized_path, normalized_root])
        return common == normalized_root
    except Exception:
        return normalized_path == normalized_root or normalized_path.startswith(normalized_root.rstrip("\\/") + os.sep)


def filter_results_to_source_root(results: list[dict]) -> list[dict]:
    source_root = get_search_source_root()
    if not source_root or not os.path.isdir(source_root):
        return results
    return [item for item in results if is_path_under_root(item.get("pdf_path", ""), source_root)]


def ensure_search_metadata_index():
    try:
        source_root = get_search_source_root()
        if source_root:
            sync_sop_metadata_index([source_root])
    except Exception as e:
        print(f"[SearchMetadata] 索引同步失败: {e}")


def merge_suggestion_lists(*suggestion_lists: list[str], limit: int = 10) -> list[str]:
    merged: list[str] = []
    seen = set()
    for items in suggestion_lists:
        for item in items:
            normalized = (item or "").strip()
            if normalized and normalized not in seen:
                seen.add(normalized)
                merged.append(normalized)
                if len(merged) >= limit:
                    return merged
    return merged[:limit]


def merge_filter_option_payloads(*payloads: dict) -> dict:
    categories: set[str] = set()
    machines: set[str] = set()
    processes: set[str] = set()
    for payload in payloads:
        if not payload:
            continue
        categories.update(item for item in (payload.get("categories") or []) if item)
        machines.update(item for item in (payload.get("machines") or []) if item)
        processes.update(item for item in (payload.get("processes") or []) if item)
    return {
        "categories": sorted(categories),
        "machines": sorted(machines),
        "processes": sorted(processes),
    }


def merge_search_records(*result_lists: list[dict]) -> list[dict]:
    merged: list[dict] = []
    index_by_key: dict[tuple, int] = {}
    for results in result_lists:
        for record in results:
            key = (
                record.get("pdf_path", ""),
                int(record.get("page_num") or 0),
                record.get("job_name", ""),
                record.get("pdf_name", ""),
            )
            if key not in index_by_key:
                index_by_key[key] = len(merged)
                merged.append(dict(record))
                continue

            existing = merged[index_by_key[key]]
            if not existing.get("image_path") and record.get("image_path"):
                existing["image_path"] = record.get("image_path")
            if not existing.get("image_url") and record.get("image_url"):
                existing["image_url"] = record.get("image_url")
            if not existing.get("pdf_url") and record.get("pdf_url"):
                existing["pdf_url"] = record.get("pdf_url")
            for field in ["category", "machine", "process", "match_type", "similarity"]:
                if not existing.get(field) and record.get(field):
                    existing[field] = record.get(field)
    return merged


def combined_search_results(q: str, top_k: int, category: str = "", process: str = "", machine: str = "") -> list[dict]:
    ensure_search_metadata_index()
    broad_limit = max(top_k * 3, top_k)
    has_keyword = bool(q and q.strip())

    # 三维度筛选不需要 Chroma（SQLite 已有正确 image_path）
    # 只有关键词搜索才调用 Chroma
    if has_keyword:
        chroma_results = filter_results_to_source_root(
            search_hybrid(q, broad_limit, category, process, machine)
        )
    else:
        chroma_results = []

    metadata_results = filter_results_to_source_root(
        search_path_metadata(q, broad_limit, category, process, machine)
    )
    return merge_search_records(chroma_results, metadata_results)


def resolve_existing_image_path(path_value: str) -> str:
    for candidate in _candidate_files(
        path_value,
        _image_search_dirs(),
    ):
        if os.path.isfile(candidate) and candidate.lower().endswith(('.jpg', '.jpeg', '.png')):
            return candidate
    return ''


def hydrate_search_record_assets(record: dict) -> dict:
    hydrated = dict(record)
    image_path = resolve_existing_image_path(hydrated.get('image_path', ''))
    if image_path:
        hydrated['image_path'] = image_path
        hydrated['image_url'] = build_image_url(image_path)

    pdf_path = (hydrated.get('pdf_path') or '').strip()
    if pdf_path:
        hydrated['pdf_url'] = build_pdf_url(pdf_path)

    return hydrated


def _pick_group_base_record(group: list[dict]) -> tuple[dict, bool]:
    image_page_numbers = [
        int(item.get('page_num') or 0)
        for item in group
        if item.get('image_path') or item.get('image_url')
    ]
    assume_one_based = bool(image_page_numbers) and 0 not in image_page_numbers

    ordered = sorted(
        group,
        key=lambda item: (
            0 if (item.get('image_path') or item.get('image_url')) else 1,
            int(item.get('page_num') or 0),
            str(item.get('match_type') or ''),
        ),
    )

    base = dict(ordered[0]) if ordered else {}
    for field in ['job_name', 'pdf_name', 'pdf_path', 'category', 'machine', 'process', 'match_type']:
        if base.get(field):
            continue
        for item in ordered[1:]:
            if item.get(field):
                base[field] = item.get(field)
                break
    return base, assume_one_based


def _render_pdf_page_bytes(page, dpi: int = 120, jpg_quality: int = 85) -> bytes:
    import fitz

    pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72))
    return pix.tobytes('jpeg', jpg_quality=jpg_quality)


def find_pre_rendered_pages(pdf_name: str, base_record: dict) -> list[dict]:
    pdf_title = (pdf_name or '').strip()
    if not pdf_title:
        return []

    prefixes = [
        f"{pdf_title}pdf_p",
        f"{pdf_title}.pdf_p",
    ]
    matched: dict[int, dict] = {}

    for img_dir in _image_search_dirs():
        if not os.path.isdir(img_dir):
            continue
        try:
            for entry in os.scandir(img_dir):
                if not entry.is_file():
                    continue
                lower_name = entry.name.lower()
                if not lower_name.endswith(('.jpg', '.jpeg', '.png')):
                    continue

                page_num = None
                for prefix in prefixes:
                    if not entry.name.startswith(prefix):
                        continue
                    suffix = entry.name[len(prefix):]
                    number = ''
                    for ch in suffix:
                        if ch.isdigit():
                            number += ch
                        else:
                            break
                    if number:
                        page_num = int(number)
                    break

                if page_num is None:
                    continue

                page_index = max(0, page_num - 1)
                if page_index in matched:
                    continue

                matched[page_index] = {
                    'id': f"image:{hashlib.md5(entry.path.encode('utf-8')).hexdigest()[:16]}",
                    'job_name': base_record.get('job_name', ''),
                    'pdf_name': pdf_title,
                    'pdf_path': base_record.get('pdf_path', ''),
                    'page_num': page_index,
                    'image_path': entry.path,
                    'image_url': build_image_url(entry.path),
                    'pdf_url': build_pdf_url(base_record.get('pdf_path', '')) if base_record.get('pdf_path') else '',
                    'category': base_record.get('category', ''),
                    'process': base_record.get('process', ''),
                    'machine': base_record.get('machine', ''),
                    'match_type': base_record.get('match_type', 'image_group'),
                }
        except OSError:
            continue

    return [matched[idx] for idx in sorted(matched.keys())]


def materialize_pdf_group_records(base_record: dict, group: list[dict]) -> list[dict]:
    pdf_path = (base_record.get('pdf_path') or '').strip()
    pdf_name = (base_record.get('pdf_name') or '').strip()
    base, assume_one_based = _pick_group_base_record(group)

    known_pages: dict[int, dict] = {}
    for item in group:
        if not (item.get('image_path') or item.get('image_url')):
            continue
        raw_page_num = int(item.get('page_num') or 0)
        page_index = max(0, raw_page_num - 1) if assume_one_based else max(0, raw_page_num)
        merged = dict(base)
        merged.update(item)
        merged['page_num'] = page_index
        known_pages[page_index] = hydrate_search_record_assets(merged)

    # 优先复用生产环境现成图片组，避免把封面/目录页重新渲染进结果里。
    pre_rendered_pages = find_pre_rendered_pages(pdf_name, base)
    if pre_rendered_pages:
        merged_pages = {page['page_num']: page for page in pre_rendered_pages}
        for page_index, page in known_pages.items():
            merged_pages[page_index] = page
        return [merged_pages[idx] for idx in sorted(merged_pages.keys())]

    if not pdf_path or not os.path.isfile(pdf_path):
        return [known_pages[idx] for idx in sorted(known_pages.keys())]

    try:
        import fitz

        stat = os.stat(pdf_path)
        cache_key = f"{os.path.normcase(os.path.normpath(pdf_path))}|{int(stat.st_mtime_ns)}|{int(stat.st_size)}"
        cache_dir = os.path.join(IMAGES_DIR, "_pdf_render_cache", hashlib.md5(cache_key.encode('utf-8')).hexdigest()[:16])
        os.makedirs(cache_dir, exist_ok=True)

        rendered_pages: list[dict] = []
        doc = fitz.open(pdf_path)
        try:
            for page_index in range(len(doc)):
                if page_index in known_pages:
                    record = dict(known_pages[page_index])
                    record['pdf_url'] = build_pdf_url(pdf_path)
                    rendered_pages.append(record)
                    continue

                image_path = os.path.join(cache_dir, f"p{page_index + 1}.jpg")
                if not os.path.exists(image_path):
                    with open(image_path, 'wb') as f:
                        f.write(_render_pdf_page_bytes(doc.load_page(page_index)))

                rendered_pages.append({
                    'id': f"render:{hashlib.md5(pdf_path.encode('utf-8')).hexdigest()[:16]}:{page_index + 1}",
                    'job_name': base.get('job_name', ''),
                    'pdf_name': pdf_name,
                    'pdf_path': pdf_path,
                    'page_num': page_index,
                    'image_path': image_path,
                    'image_url': build_image_url(image_path),
                    'pdf_url': build_pdf_url(pdf_path),
                    'category': base.get('category', ''),
                    'process': base.get('process', ''),
                    'machine': base.get('machine', ''),
                    'match_type': base.get('match_type', 'metadata'),
                })
        finally:
            doc.close()

        return rendered_pages
    except Exception as e:
        print(f"[Search] PDF页面物化失败 {pdf_path}: {e}")
        return [known_pages[idx] for idx in sorted(known_pages.keys())]


def materialize_search_results(results: list[dict], expand_pages: bool = False) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    ordered_keys: list[str] = []

    for record in results:
        key = (record.get('pdf_path') or '').strip() or f"__single__:{record.get('id', '')}"
        if key not in grouped:
            grouped[key] = []
            ordered_keys.append(key)
        grouped[key].append(record)

    materialized: list[dict] = []
    for key in ordered_keys:
        group = grouped[key]
        base, _assume_one_based = _pick_group_base_record(group)

        if expand_pages and base.get('pdf_path'):
            page_records = materialize_pdf_group_records(base, group)
            if page_records:
                materialized.extend(page_records)
                continue

        materialized.append(hydrate_search_record_assets(base))

    return materialized

@app.route('/api/suggest', methods=['GET'])
def api_suggest():
    keyword = request.args.get('q', request.args.get('keyword', ''))
    top_k = int(request.args.get('top_k', request.args.get('limit', 10)))
    ensure_search_metadata_index()
    metadata_suggestions = suggest_path_terms(keyword, top_k)
    if len(metadata_suggestions) >= top_k:
        return jsonify(metadata_suggestions[:top_k])
    chroma_suggestions = suggest_job_names(keyword, top_k)
    return jsonify(merge_suggestion_lists(metadata_suggestions, chroma_suggestions, limit=top_k))

@app.route('/api/search', methods=['GET'])
def api_search():
    keyword = request.args.get('job', request.args.get('keyword', ''))
    top_k = int(request.args.get('top_k', 10))
    category = request.args.get('category', '').strip()
    process = request.args.get('process', '').strip()
    machine = request.args.get('machine', '').strip()
    chroma_results = filter_results_to_source_root(search_by_job_name(
        keyword,
        max(top_k * 3, top_k),
        category=category,
        process=process,
        machine=machine,
    ))
    metadata_results = []
    ensure_search_metadata_index()
    metadata_results = filter_results_to_source_root(
        search_path_metadata(keyword, max(top_k * 3, top_k), category, process, machine)
    )
    return jsonify(merge_search_records(chroma_results, metadata_results)[:top_k])

@app.route('/api/search-text', methods=['GET'])
@app.route('/api/semantic', methods=['GET'])
def api_semantic():
    q = request.args.get('q', request.args.get('keyword', ''))
    top_k = int(request.args.get('top_k', 10))
    category = request.args.get('category', '').strip()
    process = request.args.get('process', '').strip()
    machine = request.args.get('machine', '').strip()
    chroma_results = filter_results_to_source_root(search_by_text_description(
        q,
        max(top_k * 3, top_k),
        category=category,
        process=process,
        machine=machine,
    ))
    ensure_search_metadata_index()
    metadata_results = filter_results_to_source_root(
        search_path_metadata(q, max(top_k * 3, top_k), category, process, machine)
    )
    return jsonify(merge_search_records(chroma_results, metadata_results)[:top_k])

@app.route('/api/search-hybrid', methods=['GET'])
def api_hybrid():
    q = request.args.get('q', '')
    top_k = int(request.args.get('top_k', 10))
    category = request.args.get('category', '').strip()
    process = request.args.get('process', '').strip()
    machine = request.args.get('machine', '').strip()
    return jsonify(combined_search_results(q, top_k,
                                          category=category, process=process, machine=machine)[:top_k])

@app.route('/api/search/filter-options', methods=['GET'])
def api_filter_options():
    """返回筛选项（支持三级级联）

    Query params:
        category: 分类（触发机型级联）
        machine:  机型（触发工序级联）
    """
    category = request.args.get('category', '').strip()
    machine  = request.args.get('machine', '').strip()
    ensure_search_metadata_index()
    metadata_options = get_path_filter_options(category=category, machine=machine)
    return jsonify(metadata_options)

@app.route('/api/search/filter', methods=['GET'])
def api_search_filter():
    """带机型+工序筛选的混合搜索

    Query params:
        q: 搜索关键词
        machine: 机型（如 "BNF", "Cashbox", "NV200S"）
        process: 工序（如 "包装", "装配"）
        category: 大类（如 "装配", "成品包装", "PA组件包装"）
        top_k: 返回数量
    """
    q = request.args.get('q', '')
    top_k = int(request.args.get('top_k', 20))
    machine = request.args.get('machine', '').strip()
    process = request.args.get('process', '').strip()
    category = request.args.get('category', '').strip()
    results = combined_search_results(q, top_k, category, process, machine)

    # 关键词搜索时，按命中的 PDF 物化完整图片组：
    # - 若 Chroma 已有页面记录，直接复用
    # - 若只有路径维度命中，则从源 PDF 渲染页面图片
    # 这样目录三维解析与 Chroma 关键词来源保持解耦。
    if (q or '').strip():
        return jsonify(materialize_search_results(results, expand_pages=True))

    # ================== 修复1: 按 job_name + pdf_name 合并重复条目 ==================
    # 同一 SOP 可能被 UNC 和本地路径各索引一次（meta页+内容页），按 job_name+pdf_name 分组合并
    # 分组合并时优先保留有 image_path 的条目（内容页），若无则保留第一条
    key_groups: dict[str, list[dict]] = {}
    for r in results:
        key = f"{r.get('job_name', '')}|{r.get('pdf_name', '')}"
        if key not in key_groups:
            key_groups[key] = []
        key_groups[key].append(r)
    deduped = []
    for key, group in key_groups.items():
        # 优先选有 image_path 的条目（内容页 > meta页）
        with_img = [r for r in group if r.get('image_path')]
        deduped.append((with_img or group)[0])
    results = deduped

    # ================== 修复2: 多目录图片兜底查找 ==================
    # images 可能在多个目录（本地 SOP Server / backend data / asserts）
    _extra_image_dirs: list[str] = []

    def _get_extra_image_dirs() -> list[str]:
        """懒加载额外的图片目录（避免频繁目录扫描）"""
        nonlocal _extra_image_dirs
        if _extra_image_dirs:
            return _extra_image_dirs
        _extra_image_dirs = [d for d in _image_search_dirs() if os.path.isdir(d) and d != IMAGES_DIR]
        return _extra_image_dirs

    # job_name → image_url 缓存（避免同 job_name 重复查 ChromaDB 和文件系统）
    job_img_cache: dict[str, str] = {}

    def _find_fallback_img(pdf_path: str, job_name: str) -> str:
        """兜底：策略1按pdf_path查同PDF其他页 → 策略2按job_name查同类SOP → 策略3扫描文件系统"""
        if not job_name:
            return ''
        if job_name in job_img_cache:
            return job_img_cache[job_name]
        fallback = ''

        def _try_query(where_filter: dict) -> str:
            """用指定 filter 查 ChromaDB，找一张图片存在的记录"""
            try:
                _, collection = init_chroma()
                res = collection.get(where=where_filter, include=['metadatas'])
                for i in range(len(res.get('ids', []) or [])):
                    meta = res['metadatas'][i]
                    if not meta:
                        continue
                    alt_path = meta.get('image_path', '')
                    if not alt_path:
                        continue
                    if os.path.isabs(alt_path) and os.path.exists(alt_path):
                        return build_image_url(alt_path)
                    bn = os.path.basename(alt_path)
                    resolved = resolve_existing_image_path(bn)
                    if resolved:
                        return build_image_url(resolved)
            except Exception:
                pass
            return ''

        # 策略1：同 PDF 其他页
        if pdf_path:
            fallback = _try_query({'pdf_path': pdf_path})

        # 策略2：同名 SOP（job_name 完全相同）
        if not fallback:
            fallback = _try_query({'job_name': job_name})

        # 策略3：扫描文件系统（查 pdf_name 匹配的图片文件）
        if not fallback:
            pdf_name = job_name  # 用 job_name 作为图片文件名前缀
            for img_dir in [IMAGES_DIR] + _get_extra_image_dirs():
                try:
                    if not os.path.isdir(img_dir):
                        continue
                    for fname in os.listdir(img_dir):
                        if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                            # 图片文件名格式：<job_name>_<suffix>.jpg，模糊匹配前缀
                            if fname.startswith(pdf_name) or pdf_name.split()[0] in fname:
                                fallback = build_image_url(os.path.join(img_dir, fname))
                                break
                    if fallback:
                        break
                except Exception:
                    pass

        job_img_cache[job_name] = fallback
        return fallback

    for r in results:
        img_path = r.get('image_path', '')
        if img_path:
            resolved = resolve_existing_image_path(img_path)
            if resolved:
                r['image_url'] = build_image_url(resolved)
        # 兜底：当前页无图片时，从同 PDF 或同名 SOP 找一张
        if not r.get('image_url'):
            r['image_url'] = _find_fallback_img(r.get('pdf_path', ''), r.get('job_name', ''))
        # 添加 PDF 下载 URL（设备推送用）
        pdf_path = r.get('pdf_path', '')
        if pdf_path:
            r['pdf_url'] = build_pdf_url(pdf_path)
    return jsonify(results)

@app.route('/api/stats', methods=['GET'])
def api_stats():
    ensure_search_metadata_index()
    stats = get_stats()
    metadata_stats = get_path_metadata_stats()
    stats["indexed_pdfs"] = metadata_stats.get("total_pdfs", 0)
    stats["path_unique_job_names"] = metadata_stats.get("unique_job_names", 0)
    return jsonify(stats)

# ============== 图片服务 ==============
@app.route('/api/images', methods=['GET'])
def api_images():
    """列出所有图片（30s TTL 缓存，减少频繁目录扫描开销）"""
    now = time.time()
    if now - _images_cache['ts'] > _IMAGES_CACHE_TTL:
        files: list[str] = []
        seen = set()
        for img_dir in _image_search_dirs():
            if not os.path.isdir(img_dir):
                continue
            for name in os.listdir(img_dir):
                if not name.endswith(('.jpg', '.jpeg', '.png')):
                    continue
                if name in seen:
                    continue
                seen.add(name)
                files.append(name)
        _images_cache['files'] = files
        _images_cache['ts'] = now
    return jsonify(_images_cache['files'])

@app.route('/api/image/<path:filename>', methods=['GET'])
def api_image(filename):
    """获取图片（支持多目录查找）"""
    safe_filename = os.path.basename(filename)
    for img_dir in _image_search_dirs():
        candidate = os.path.join(img_dir, safe_filename)
        if os.path.exists(candidate):
            return send_from_directory(img_dir, safe_filename)
    return jsonify({'error': 'Image not found'}), 404


@app.route('/api/image-file', methods=['GET'])
def api_image_file():
    """按完整路径获取图片，避免同名文件串单。"""
    requested_path = request.args.get('path', '')
    for candidate in _candidate_files(
        requested_path,
        _image_search_dirs(),
    ):
        if os.path.isfile(candidate) and candidate.lower().endswith(('.jpg', '.jpeg', '.png')):
            return send_from_directory(os.path.dirname(candidate), os.path.basename(candidate))
    return jsonify({'error': 'Image not found'}), 404

# ============== PDF 下载服务（供设备推送使用）==============
@app.route('/api/pdf/<path:filename>', methods=['GET'])
def api_pdf(filename):
    """下载 PDF 文件（供设备推送整个 SOP 文件）"""
    safe_filename = os.path.basename(filename)
    # 优先从 IMAGES_DIR 查找（PDF 会被复制到此处）
    if os.path.exists(os.path.join(IMAGES_DIR, safe_filename)):
        return send_from_directory(IMAGES_DIR, safe_filename, as_attachment=True)
    # 其次从 asserts 目录及其子目录中递归查找
    for root, _dirs, files in os.walk(ASSERTS_DIR):
        if safe_filename in files:
            return send_from_directory(root, safe_filename, as_attachment=True)
    return jsonify({'error': 'PDF not found'}), 404


@app.route('/api/pdf-file', methods=['GET'])
def api_pdf_file():
    """按完整路径获取 PDF，避免同名文件串单。"""
    requested_path = request.args.get('path', '')
    pdf_roots = [IMAGES_DIR, ASSERTS_DIR]
    for candidate in _candidate_files(requested_path, pdf_roots):
        if os.path.isfile(candidate) and candidate.lower().endswith('.pdf'):
            return send_from_directory(os.path.dirname(candidate), os.path.basename(candidate), as_attachment=True)
    return jsonify({'error': 'PDF not found'}), 404

@app.route('/api/images/by-job', methods=['GET'])
def api_images_by_job():
    """根据作业名称获取所有相关图片"""
    job_name = request.args.get('job', '').strip()
    if not job_name:
        return jsonify([])

    results = combined_search_results(job_name, 50)
    materialized = materialize_search_results(results, expand_pages=True)
    if materialized:
        return jsonify([
            {
                'image_path': item.get('image_path', ''),
                'job_name': item.get('job_name', ''),
                'page_num': item.get('page_num', 0),
                'pdf_path': item.get('pdf_path', ''),
                'image_url': item.get('image_url', ''),
                'pdf_url': item.get('pdf_url', ''),
            }
            for item in materialized
            if item.get('image_url') or item.get('image_path')
        ])
    return jsonify([])

# ============== 搜索结果完整信息 ==============
@app.route('/api/search/full', methods=['GET'])
def api_search_full():
    """完整搜索结果（含相似度）"""
    q = request.args.get('q', '')
    top_k = int(request.args.get('top_k', 10))

    # 混合搜索
    results = combined_search_results(q, top_k)

    # 按 job_name + pdf_name 分组合并（优先选有 image_path 的条目）
    key_groups: dict[str, list[dict]] = {}
    for r in results:
        key = f"{r.get('job_name', '')}|{r.get('pdf_name', '')}"
        if key not in key_groups:
            key_groups[key] = []
        key_groups[key].append(r)
    deduped = []
    for key, group in key_groups.items():
        with_img = [r for r in group if r.get('image_path')]
        deduped.append((with_img or group)[0])
    results = deduped

    # 图片目录列表（含额外目录）
    _extra_image_dirs: list[str] = []

    def _get_extra_image_dirs() -> list[str]:
        nonlocal _extra_image_dirs
        if _extra_image_dirs:
            return _extra_image_dirs
        _extra_image_dirs = [d for d in _image_search_dirs() if os.path.isdir(d) and d != IMAGES_DIR]
        return _extra_image_dirs

    # job_name → image_url 缓存
    job_img_cache_full: dict[str, str] = {}

    def _full_fallback(pdf_path: str, job_name: str) -> str:
        """策略1: pdf_path查Chromadb → 策略2: job_name查 → 策略3: 扫描文件系统"""
        if not job_name or job_name in job_img_cache_full:
            return job_img_cache_full.get(job_name, '')
        fallback = ''

        def _try_query(filter_dict: dict) -> str:
            try:
                _, collection = init_chroma()
                res = collection.get(where=filter_dict, include=['metadatas'])
                for i in range(len(res.get('ids', []) or [])):
                    meta = res['metadatas'][i]
                    if not meta:
                        continue
                    alt = meta.get('image_path', '') or ''
                    if not alt:
                        continue
                    if os.path.isabs(alt) and os.path.exists(alt):
                        return build_image_url(alt)
                    bn = os.path.basename(alt)
                    resolved = resolve_existing_image_path(bn)
                    if resolved:
                        return build_image_url(resolved)
            except Exception:
                pass
            return ''

        # 策略1+2
        for fdict in ([{'pdf_path': pdf_path}] if pdf_path else []) + \
                     ([{'job_name': job_name}] if job_name else []):
            fallback = _try_query(fdict)
            if fallback:
                break

        # 策略3：文件系统扫描（job_name 模糊匹配）
        if not fallback:
            prefix = job_name.split()[0]  # 取第一个词作为前缀
            for img_dir in [IMAGES_DIR] + _get_extra_image_dirs():
                try:
                    if not os.path.isdir(img_dir):
                        continue
                    for fname in os.listdir(img_dir):
                        if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                            if fname.startswith(job_name) or prefix in fname:
                                fallback = build_image_url(os.path.join(img_dir, fname))
                                break
                    if fallback:
                        break
                except Exception:
                    pass

        job_img_cache_full[job_name] = fallback
        return fallback

    for r in results:
        img_path = r.get('image_path', '')
        if img_path:
            resolved = resolve_existing_image_path(img_path)
            if resolved:
                r['image_url'] = build_image_url(resolved)
        if not r.get('image_url'):
            r['image_url'] = _full_fallback(r.get('pdf_path', ''), r.get('job_name', ''))
        pdf_path = r.get('pdf_path', '')
        if pdf_path:
            r['pdf_url'] = build_pdf_url(pdf_path)

    return jsonify(results)

# ============== 静态资源 ==============
# 确定 React build 目录（开发模式和 PyInstaller 模式通用）
if getattr(sys, 'frozen', False):
    _build_dir = os.path.join(os.path.dirname(sys.executable), "frontend", "build")
else:
    _build_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "build")
_BUILD_DIR = os.path.normpath(_build_dir)

@app.route('/favicon.ico', methods=['GET'])
@app.route('/favicon.png', methods=['GET'])
@app.route('/robots.txt', methods=['GET'])
@app.route('/sitemap.xml', methods=['GET'])
def static_assets():
    """静态资源 - 返回空响应避免 405"""
    return '', 204

@app.route('/static/<path:filename>', methods=['GET'])
def serve_static(filename):
    """Serve React 静态文件（JS/CSS）"""
    from flask import send_file
    file_path = os.path.join(_BUILD_DIR, "static", filename)
    return send_file(file_path)

# ============== 根路径 ==============
@app.route('/', methods=['GET'])
def root():
    """根路径 - 返回 React index.html（支持 SPA）"""
    from flask import send_file
    return send_file(os.path.join(_BUILD_DIR, "index.html"))

# ============== CORS 预检（werkzeug 默认返回 501）==============
@app.route('/<path:path>', methods=['OPTIONS'])
@app.route('/', methods=['OPTIONS'])
def options_handler(path=None):
    return '', 204

# ============== 调试端点 ==============
@app.route('/api/debug/dirs', methods=['GET'])
def api_debug_dirs():
    """调试用：查看服务器路径解析结果"""
    from models import DB_PATH
    from sop_metadata_index import _get_image_dir_candidates
    import os
    candidates = _get_image_dir_candidates()
    return jsonify({
        "DB_PATH": DB_PATH,
        "image_dir_candidates": candidates,
        "DATA_DIR": DATA_DIR,
        "IMAGES_DIR": IMAGES_DIR,
    })

# ============== 健康检查端点 ==============
@app.route('/health', methods=['GET', 'POST'])
@app.route('/api/health', methods=['GET', 'POST'])
def health_check():
    """健康检查端点 - 用于检测服务是否运行"""
    payload = build_discovery_payload(request)
    payload['port'] = SERVER_PORT
    return jsonify(payload)


@app.route('/api/discovery', methods=['GET'])
def discovery_info():
    """轻量发现端点 - 供展示端/中控端自动探测后端地址。"""
    return jsonify(build_discovery_payload(request))

# ============== PDF 同步守护线程 ==============
def start_pdf_sync_daemon():
    """PDF 同步守护线程 - 按固定分钟间隔执行统一流水线。"""
    try:
        from scripts.config import PROCESS, SCHEDULE
        from scripts.run_pipeline import run_full_pipeline

        interval_minutes = max(1, int(SCHEDULE.WATCH_INTERVAL_MINUTES))
        print(f"[SyncDaemon] PDF同步守护线程已启动，每 {interval_minutes} 分钟执行一次统一流水线")

        while True:
            print("[SyncDaemon] 开始执行PDF同步...")
            started = time.time()
            try:
                run_full_pipeline(workers=PROCESS.DEFAULT_WORKERS)
                print("[SyncDaemon] 同步完成")
            except Exception as e:
                print(f"[SyncDaemon] 同步出错: {e}")

            elapsed = time.time() - started
            wait_seconds = max(0, interval_minutes * 60 - elapsed)
            print(f"[SyncDaemon] 下次同步: {int(wait_seconds // 60)} 分钟后")
            time.sleep(wait_seconds)

    except Exception as e:
        print(f"[SyncDaemon] 守护线程启动失败: {e}")


# ============== 设备状态清理守护线程 ==============
def start_device_cleanup_daemon():
    """定期清理超时离线的设备（每60秒检查一次），每10分钟额外清理历史命令"""
    from models import (
        cleanup_stale_devices, cleanup_old_commands,
        cleanup_unregistered_devices, cleanup_old_devices
    )

    print("[DeviceCleanup] 设备状态清理线程已启动（每60秒检查一次）")
    cycle = 0
    while True:
        time.sleep(60)
        cycle += 1
        try:
            cleanup_stale_devices(timeout_minutes=2)
            cleanup_unregistered_devices(timeout_minutes=30)
        except Exception as e:
            print(f"[DeviceCleanup] 清理出错: {e}")
        if cycle % 10 == 0:   # 每 10 分钟清理一次 7 天前的历史命令
            try:
                cleanup_old_commands(days=7)
            except Exception as e:
                print(f"[DeviceCleanup] 命令清理出错: {e}")
        if cycle % 60 == 0:   # 每小时清理一次长期离线设备
            try:
                cleanup_old_devices(days=30)
            except Exception as e:
                print(f"[DeviceCleanup] 长期设备清理出错: {e}")


# ============== 启动 ==============
if __name__ == '__main__':
    # 禁用 Werkzeug 的彩色日志输出（避免 Windows 终端显示乱码）
    import logging
    from werkzeug.serving import WSGIRequestHandler

    # 设置无颜色的日志格式
    WSGIRequestHandler._log = lambda self, type, message, *args: \
        logging.info(f"{self.address_string()} - - [{self.log_date_time_string()}] {message % args}")

    # 启动 PDF 同步守护线程
    sync_thread = threading.Thread(target=start_pdf_sync_daemon, daemon=True)
    sync_thread.start()
    print('[SyncDaemon] PDF同步守护线程已启动')

    # 启动设备状态清理线程
    cleanup_thread = threading.Thread(target=start_device_cleanup_daemon, daemon=True)
    cleanup_thread.start()
    print('[DeviceCleanup] 设备状态清理线程已启动')

    # 启动 ASR WebSocket 服务（语音识别）
    try:
        from voice_asr import start_asr_server
        start_asr_server(dashscope.api_key, port=ASR_PORT)
        print(f'[ASR] 语音识别 WebSocket 服务已启动: ws://localhost:{ASR_PORT}')
    except Exception as e:
        print(f'[ASR] 语音识别服务启动失败: {e}')

    # 启动 HTTP 服务
    print(f"SOP Server 启动: http://localhost:{SERVER_PORT}")
    print(f"图片目录: {IMAGES_DIR}")
    print(f"数据库: {os.path.join(DATA_DIR, 'sop.db')}")
    print(f"向量库: {CHROMA_PERSIST_DIR}")
    print()
    if initial_admin_password:
        print(f"默认管理员账号: admin / {initial_admin_password}（首次登录后请修改密码）")
    else:
        print("管理员账号: admin（请使用初始化时生成或当前有效的密码登录）")
    print()

    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False, threaded=True)
