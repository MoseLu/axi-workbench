from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "SOP Server"
_RUNTIME_FILES = ("sop.db", "config.json", "pdf_sync_state.db")
_RUNTIME_DIRS = ("chroma_db", "pdf_images", "logs", "bundle_updates")


def get_base_dir() -> Path:
    """返回只读代码目录或可执行文件目录。"""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def _safe_exists(path: Path) -> bool:
    try:
        return path.exists()
    except OSError:
        return False


def _dir_has_entries(path: Path) -> bool:
    try:
        next(path.iterdir())
        return True
    except (OSError, StopIteration):
        return False


def _iter_user_profile_app_dirs() -> list[Path]:
    candidates: list[Path] = []

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        candidates.append(Path(local_app_data) / APP_NAME)

    users_root = Path(os.environ.get("SystemDrive", "C:")) / "Users"
    if _safe_exists(users_root):
        try:
            for child in users_root.iterdir():
                candidates.append(child / "AppData" / "Local" / APP_NAME)
        except OSError:
            pass

    return candidates


def _iter_candidate_dirs(preferred: Path) -> list[Path]:
    candidates: list[Path] = [preferred]

    backend_dir = get_base_dir()
    if getattr(sys, "frozen", False):
        candidates.append(backend_dir)
    else:
        candidates.append(backend_dir / "data")
        candidates.append(backend_dir)

    candidates.extend(_iter_user_profile_app_dirs())

    deduped: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        key = os.path.normcase(str(candidate))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def _score_runtime_data_dir(path: Path) -> tuple[int, float]:
    if not _safe_exists(path):
        return (0, 0.0)

    score = 0
    latest_mtime = 0.0

    for filename in _RUNTIME_FILES:
        file_path = path / filename
        try:
            if file_path.is_file():
                stat = file_path.stat()
                latest_mtime = max(latest_mtime, stat.st_mtime)
                if stat.st_size > 0:
                    score += 100 if filename == "sop.db" else 20
        except OSError:
            continue

    for dirname in _RUNTIME_DIRS:
        dir_path = path / dirname
        try:
            if dir_path.is_dir():
                stat = dir_path.stat()
                latest_mtime = max(latest_mtime, stat.st_mtime)
                if _dir_has_entries(dir_path):
                    score += 10
        except OSError:
            continue

    return (score, latest_mtime)


def _is_writable_dir(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def get_preferred_data_dir() -> Path:
    override = (os.environ.get("SOP_DATA_DIR") or "").strip()
    if override:
        return Path(override).expanduser()

    if getattr(sys, "frozen", False):
        # 打包模式：优先从 exe 同目录查找数据（由 installer 复制到此）
        exe_dir = get_base_dir()
        if _score_runtime_data_dir(exe_dir)[0] > 0:
            return exe_dir
        # 其次尝试 PROGRAMDATA / LOCALAPPDATA（历史数据或用户目录）
        program_data = (os.environ.get("PROGRAMDATA") or "").strip()
        if program_data:
            return Path(program_data) / APP_NAME
        local_app_data = (os.environ.get("LOCALAPPDATA") or "").strip()
        if local_app_data:
            return Path(local_app_data) / APP_NAME
        # 最后 fallback 到 exe 同目录
        return exe_dir

    return get_base_dir() / "data"


def get_runtime_data_dir() -> Path:
    """
    选择统一的运行时数据目录。

    优先级：
    1. `SOP_DATA_DIR` 显式覆盖。
    2. 首选目录中的现有数据。
    3. 历史目录中最新的有效数据（包括其他用户的 LocalAppData）。
    4. 可写的首选目录。
    """
    preferred = get_preferred_data_dir()

    if os.environ.get("SOP_DATA_DIR"):
        preferred.mkdir(parents=True, exist_ok=True)
        return preferred

    preferred_score = _score_runtime_data_dir(preferred)
    if preferred_score[0] > 0:
        return preferred

    best_existing: Path | None = None
    best_score = (0, 0.0)
    for candidate in _iter_candidate_dirs(preferred):
        score = _score_runtime_data_dir(candidate)
        if score > best_score:
            best_existing = candidate
            best_score = score

    if best_existing and best_score[0] > 0:
        return best_existing

    if _is_writable_dir(preferred):
        return preferred

    for candidate in _iter_candidate_dirs(preferred)[1:]:
        if _is_writable_dir(candidate):
            return candidate

    preferred.mkdir(parents=True, exist_ok=True)
    return preferred
