#!/usr/bin/env python3
"""
config.py - SOP处理流水线统一配置

所有路径、配置常量集中管理，消除散落在各脚本中的重复配置。
"""

import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from runtime_paths import get_base_dir as get_runtime_base_dir, get_runtime_data_dir


def get_base_dir():
    """获取基础目录（兼容开发环境和打包环境）"""
    return os.fspath(get_runtime_base_dir())


def get_data_dir():
    """获取统一运行时数据目录"""
    return os.fspath(get_runtime_data_dir())


BASE_DIR = Path(get_base_dir())
DATA_DIR = Path(get_data_dir())
DEFAULT_REMOTE_SOURCE_DIR = r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)"


def _get_directory_stats(path: Path) -> tuple[int, float]:
    """返回目录中文件数量和最近文件修改时间。"""
    if not path.exists():
        return 0, 0.0

    file_count = 0
    latest_mtime = 0.0

    try:
        for item in path.rglob("*"):
            if not item.is_file():
                continue
            file_count += 1
            try:
                latest_mtime = max(latest_mtime, item.stat().st_mtime)
            except OSError:
                continue
    except OSError:
        return 0, 0.0

    return file_count, latest_mtime


def resolve_shared_chroma_dir(data_dir: Path, local_data_dir: Path, configured_dir: str = "") -> Path:
    """统一选择实际使用的 Chroma 目录。

    历史版本存在两套路径：
    - 旧版搜索/索引: DATA_DIR/chroma_db
    - 新版流水线: DATA_DIR/data/chroma_db

    这里优先复用已有且最近更新的目录，避免升级后必须先重建索引。
    """
    if configured_dir:
        return Path(configured_dir)

    legacy_dir = data_dir / "chroma_db"
    pipeline_dir = local_data_dir / "chroma_db"
    candidates = [legacy_dir, pipeline_dir]

    ranked = []
    for candidate in candidates:
        file_count, latest_mtime = _get_directory_stats(candidate)
        ranked.append((candidate, file_count, latest_mtime))

    populated = [item for item in ranked if item[1] > 0]
    if not populated:
        return legacy_dir

    populated.sort(
        key=lambda item: (
            item[2],
            item[1],
            1 if item[0] == legacy_dir else 0,
        ),
        reverse=True,
    )
    return populated[0][0]


def iter_source_dir_candidates(configured_dir: str = "") -> list[Path]:
    """返回 PDF 源目录候选列表。

    优先级：
    1. config.json 中配置的源目录
    2. 项目根目录下的 `asserts`（仓库内生产镜像资源）
    3. 项目根目录下的 `04-SOP(PDF)`（本地参考/调试）
    """
    candidates: list[Path] = []
    seen: set[str] = set()

    def add_candidate(raw_path) -> None:
        if not raw_path:
            return
        candidate = Path(raw_path).expanduser()
        key = os.path.normcase(os.path.normpath(os.fspath(candidate)))
        if not key or key in seen:
            return
        seen.add(key)
        candidates.append(candidate)

    add_candidate(configured_dir or DEFAULT_REMOTE_SOURCE_DIR)
    add_candidate(BASE_DIR.parent / "asserts")
    add_candidate(BASE_DIR.parent / "04-SOP(PDF)")
    return candidates


def resolve_source_dir(configured_dir: str = "") -> Path:
    """选择当前可用的 PDF 源目录。

    当配置的网络共享目录不可达时，自动回落到项目内测试目录，
    保证标准三维路径解析、本地搜索和流水线调试仍可工作。
    """
    candidates = iter_source_dir_candidates(configured_dir)
    for candidate in candidates:
        try:
            if candidate.is_dir():
                return candidate
        except OSError:
            continue
    return candidates[0] if candidates else Path(configured_dir or DEFAULT_REMOTE_SOURCE_DIR)


def load_config():
    """加载配置文件（config.json）"""
    config_paths = [
        DATA_DIR / "config.json",
        BASE_DIR / "config.json",
    ]

    for path in config_paths:
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
    return {}


_config = load_config()


# ============== 目录路径 ==============

class DirConfig:
    """目录路径配置"""

    # 公盘PDF源目录（只读取，不修改）
    _source_dir_config = _config.get("pdf_sync", {}).get("source_dir", DEFAULT_REMOTE_SOURCE_DIR)
    SOURCE_DIR_CANDIDATES = tuple(iter_source_dir_candidates(_source_dir_config))
    SOURCE_DIR = resolve_source_dir(_source_dir_config)

    # 图片输出目录：优先网络共享，访问失败时 fallback 到本地 pdf_images
    _image_dir = _config.get("pdf_sync", {}).get("image_dir", "")
    if _image_dir:
        try:
            IMAGE_DIR = Path(_image_dir)
            # 验证可写：尝试列出父目录
            list(IMAGE_DIR.parent.iterdir())
        except Exception:
            # 网络路径不可访问，fallback 到本地目录
            _local_images = DATA_DIR / "pdf_images"
            _local_images.mkdir(parents=True, exist_ok=True)
            IMAGE_DIR = _local_images
    else:
        _local_images = DATA_DIR / "pdf_images"
        _local_images.mkdir(parents=True, exist_ok=True)
        IMAGE_DIR = _local_images

    # 本地数据目录
    LOCAL_DATA_DIR = DATA_DIR / "data"
    LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 本地暂存PDF目录（处理前先从公盘复制到本地，避免边写边读）
    STAGING_DIR = LOCAL_DATA_DIR / "pdf_staging"
    STAGING_DIR.mkdir(parents=True, exist_ok=True)

    # 日志目录
    LOG_DIR = DATA_DIR / "logs"
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # ChromaDB目录
    _chroma_dir = _config.get("pdf_sync", {}).get("chroma_dir", "")
    CHROMA_DIR = resolve_shared_chroma_dir(DATA_DIR, LOCAL_DATA_DIR, _chroma_dir)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)


# ============== 数据库路径 ==============

class DBConfig:
    """数据库文件路径配置"""

    # PDF扫描状态数据库
    SCAN_DB = DATA_DIR / "pdf_scan_state.db"

    # OCR结果缓存数据库
    OCR_DB = DATA_DIR / "ocr_cache.db"

    # 同步状态数据库（由monitor使用）
    SYNC_DB = DATA_DIR / "pdf_sync_state.db"

    # 流水线执行记录数据库
    PIPELINE_DB = DATA_DIR / "pipeline_state.db"


# ============== ChromaDB配置 ==============

class ChromaConfig:
    """ChromaDB配置"""

    COLLECTION_NAME = _config.get("pdf_sync", {}).get("collection_name", "sop_pages")


# ============== API配置 ==============

class APIConfig:
    """API配置"""

    # DashScope API Key
    DASHSCOPE_API_KEY = (
        _config.get("dashscope_api_key")
        or _config.get("dashscope", {}).get("api_key", "")
        or os.environ.get("DASHSCOPE_API_KEY", "")
    )

    # 图片URL基础路径
    IMAGE_BASE_URL = "/api/images"


# ============== 处理参数 ==============

class ProcessConfig:
    """处理参数配置"""

    # 图片转换参数
    MAX_IMAGE_SIZE_KB = 3000      # 最大图片大小KB
    DPI_START = 120              # 初始DPI
    DPI_MIN = 60                # 最小DPI
    JPG_QUALITY = 85            # JPEG质量

    # 并发配置
    DEFAULT_WORKERS = 4          # 默认并发数
    MAX_WORKERS = 8             # 最大并发数

    # OCR重试配置
    OCR_MAX_RETRIES = 5         # 最大重试次数
    OCR_RETRY_DELAY = 2          # 重试延迟秒数（指数退避）

    # 向量索引参数
    EMBEDDING_BATCH_SIZE = 20    # 批量写入大小
    EMBEDDING_MODEL = "text-embedding-v3"


# ============== 调度配置 ==============

class ScheduleConfig:
    """调度配置"""

    # 监控间隔（分钟）
    WATCH_INTERVAL_MINUTES = int(_config.get("pdf_sync", {}).get("watch_interval_minutes", 10))

    # 文件稳定性检查等待秒数
    FILE_STABLE_SECONDS = int(_config.get("pdf_sync", {}).get("file_stable_seconds", 2))

    # 心跳超时（分钟）
    HEARTBEAT_TIMEOUT_MINUTES = 5


# ============== 快捷访问 ==============

DIR = DirConfig()
DB = DBConfig()
CHROMA = ChromaConfig()
API = APIConfig()
PROCESS = ProcessConfig()
SCHEDULE = ScheduleConfig()


def get_log_file(prefix: str) -> Path:
    """获取日志文件路径"""
    filename = f"{prefix}_{datetime.now().strftime('%Y%m%d')}.log"
    return DIR.LOG_DIR / filename


def setup_logging(name: str, prefix: str = None) -> logging:
    """配置日志"""
    import logging as _logging

    if prefix is None:
        prefix = name

    _logging.basicConfig(
        level=_logging.INFO,
        format='%(asctime)s - %(levelname)s - [%(threadName)s] %(message)s',
        handlers=[
            _logging.FileHandler(get_log_file(prefix), encoding='utf-8'),
            _logging.StreamHandler(sys.stdout)
        ]
    )
    return _logging.getLogger(name)


# ============== 兼容性 ==============

# 为了兼容旧代码，提供全局常量
SOURCE_DIR = DIR.SOURCE_DIR
IMAGE_DIR = DIR.IMAGE_DIR
CHROMA_DIR = DIR.CHROMA_DIR
SCAN_STATE_DB = DB.SCAN_DB
OCR_CACHE_DB = DB.OCR_DB
COLLECTION_NAME = CHROMA.COLLECTION_NAME

# 导入typing（供其他模块使用）
from typing import *
