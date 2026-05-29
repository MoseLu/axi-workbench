#!/usr/bin/env python3
"""
基于 SQLite 的 SOP 路径元数据索引。

用途：
- 不依赖 OCR，即可按目录结构建立 分类/机型/工序 检索
- 为中控端和展示端搜索接口提供兜底
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import time
from pathlib import Path

from models import DB_PATH
from sop_dimensions import extract_file_dimensions

_SYNC_LOCK = threading.Lock()
_SYNC_STATE = {"ts": 0.0, "root": ""}
_DEFAULT_SYNC_TTL_SECONDS = 300

# 图片目录候选路径（按优先级）
_IMAGE_DIR_CANDIDATES: list[str] | None = None


def _get_image_dir_candidates() -> list[str]:
    """获取所有可能的 pdf_images 目录路径（扫描所有存在的目录）。"""
    global _IMAGE_DIR_CANDIDATES
    if _IMAGE_DIR_CANDIDATES is not None:
        return _IMAGE_DIR_CANDIDATES

    db_dir = os.path.dirname(DB_PATH)  # DATA_DIR
    base_dir = os.path.dirname(db_dir)  # 父目录（如 backend/ 或 LOCALAPPDATA/SOP Server/）

    candidates = []

    # 1. DATA_DIR/pdf_images（主目录）
    candidates.append(os.path.join(db_dir, "pdf_images"))

    # 2. 父目录/pdf_images（如 LOCALAPPDATA/SOP Server/pdf_images）
    parent_images = os.path.join(base_dir, "pdf_images")
    if parent_images != candidates[0]:
        candidates.append(parent_images)

    # 3. LOCALAPPDATA/SOP Server/pdf_images（包含旧 pipeline 图片）
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        candidates.append(os.path.join(local_app_data, "SOP Server", "pdf_images"))

    # 4. 祖父目录/pdf_images（兜底）
    grandparent = os.path.dirname(base_dir)
    if grandparent and grandparent != base_dir:
        gp_images = os.path.join(grandparent, "pdf_images")
        if gp_images not in candidates:
            candidates.append(gp_images)

    _IMAGE_DIR_CANDIDATES = [d for d in candidates if os.path.isdir(d)]
    return _IMAGE_DIR_CANDIDATES


def _safe_basename(filename: str) -> str:
    """保留中文和空格的文件名清理（用于匹配旧 pipeline 图片名）。"""
    return "".join(c for c in filename if c.isalnum() or c in ' -_()（）。')


def _resolve_image_path(pdf_path: str) -> str:
    """
    根据 pdf_path 解析图片路径（优先 hash 子目录，其次根目录旧格式）。

    图片查找顺序：
    1. {hash}/{page}.jpg（新 pipeline，hash = md5(pdf_path)[:12]）
    2. 扫描 pdf_images 根目录，找第一个匹配 pdf_name 前缀的 jpg
    """
    if not pdf_path:
        return ""

    candidates = _get_image_dir_candidates()
    if not candidates:
        return ""

    h12 = hashlib.md5(pdf_path.encode()).hexdigest()[:12]

    # 策略1：hash 子目录
    for images_dir in candidates:
        hash_dir = os.path.join(images_dir, h12)
        if os.path.isdir(hash_dir):
            for fname in os.listdir(hash_dir):
                if fname.endswith(('.jpg', '.jpeg', '.png')):
                    return os.path.join(hash_dir, fname)

    # 策略2：扫描根目录，按 pdf_name 前缀匹配（兼容旧 pipeline 和各种命名格式）
    pdf_basename = os.path.basename(pdf_path)
    pdf_name_clean = _safe_basename(pdf_basename).rstrip('.pdf').rstrip('.PDF').strip()
    # 去掉日期后缀，匹配更广
    import re as _re
    pdf_name_prefix = _re.sub(r'\s*SOP\s*\d+.*$', '', pdf_name_clean, flags=_re.IGNORECASE).strip()

    for images_dir in candidates:
        try:
            if not os.path.isdir(images_dir):
                continue
            best_match = None
            for fname in os.listdir(images_dir):
                if not fname.endswith('.jpg'):
                    continue
                fname_clean = _safe_basename(fname).rstrip('.jpg').rstrip('.JPG')
                # 前缀匹配（去掉页码后缀 _p1, _p2 等）
                fname_base = _re.sub(r'_p\d+.*$', '', fname_clean)
                if pdf_name_prefix and fname_base.startswith(pdf_name_prefix):
                    if best_match is None or len(fname_base) < len(best_match):
                        best_match = fname_base
                        best_fname = fname
            if best_match is not None:
                return os.path.join(images_dir, best_fname)
        except OSError:
            pass

    return ""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def ensure_table() -> None:
    conn = _connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sop_file_index (
                pdf_path TEXT PRIMARY KEY,
                pdf_name TEXT NOT NULL DEFAULT '',
                job_name TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                category_parts TEXT NOT NULL DEFAULT '[]',
                machine TEXT NOT NULL DEFAULT '',
                process TEXT NOT NULL DEFAULT '',
                source_size INTEGER NOT NULL DEFAULT 0,
                source_mtime REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sop_file_index_job_name ON sop_file_index(job_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sop_file_index_pdf_name ON sop_file_index(pdf_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sop_file_index_category ON sop_file_index(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sop_file_index_machine ON sop_file_index(machine)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sop_file_index_process ON sop_file_index(process)")
        conn.commit()
    finally:
        conn.close()


def _pick_source_root(candidate_roots: list[str]) -> str:
    for root in candidate_roots:
        normalized = os.path.normpath(root or "")
        if normalized and os.path.isdir(normalized):
            return normalized
    return ""


def _scan_pdfs(source_root: str) -> dict[str, dict]:
    files: dict[str, dict] = {}
    if not source_root or not os.path.isdir(source_root):
        return files

    for root, _dirs, filenames in os.walk(source_root):
        for filename in filenames:
            if not filename.lower().endswith(".pdf"):
                continue
            full_path = os.path.normpath(os.path.join(root, filename))
            try:
                stat = os.stat(full_path)
            except OSError:
                continue
            files[full_path] = {
                "pdf_path": full_path,
                "size": int(stat.st_size),
                "mtime": float(stat.st_mtime),
            }
    return files


def sync_index(candidate_roots: list[str], ttl_seconds: int = _DEFAULT_SYNC_TTL_SECONDS) -> str:
    """按 TTL 增量同步 SOP 元数据索引。返回实际使用的根目录。"""
    ensure_table()
    source_root = _pick_source_root(candidate_roots)
    if not source_root:
        return ""

    now = time.time()
    with _SYNC_LOCK:
        if (
            _SYNC_STATE["root"] == source_root
            and now - _SYNC_STATE["ts"] <= max(0, ttl_seconds)
        ):
            return source_root

        scanned = _scan_pdfs(source_root)
        conn = _connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT pdf_path, source_size, source_mtime FROM sop_file_index")
            existing = {
                row["pdf_path"]: {
                    "size": int(row["source_size"] or 0),
                    "mtime": float(row["source_mtime"] or 0),
                }
                for row in cursor.fetchall()
            }

            # 删除已不存在的记录
            missing_paths = set(existing.keys()) - set(scanned.keys())
            if missing_paths:
                cursor.executemany(
                    "DELETE FROM sop_file_index WHERE pdf_path = ?",
                    [(path,) for path in missing_paths],
                )

            # 新增/变更记录增量更新
            upserts = []
            for pdf_path, info in scanned.items():
                previous = existing.get(pdf_path)
                if previous and previous["size"] == info["size"] and previous["mtime"] == info["mtime"]:
                    continue
                dims = extract_file_dimensions(pdf_path)
                upserts.append(
                    (
                        pdf_path,
                        dims.get("pdf_name", ""),
                        dims.get("job_name", ""),
                        dims.get("category", ""),
                        json.dumps(dims.get("category_parts", []), ensure_ascii=False),
                        dims.get("machine", ""),
                        dims.get("process", ""),
                        info["size"],
                        info["mtime"],
                    )
                )

            if upserts:
                cursor.executemany(
                    """
                    INSERT INTO sop_file_index (
                        pdf_path, pdf_name, job_name, category, category_parts,
                        machine, process, source_size, source_mtime, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(pdf_path) DO UPDATE SET
                        pdf_name = excluded.pdf_name,
                        job_name = excluded.job_name,
                        category = excluded.category,
                        category_parts = excluded.category_parts,
                        machine = excluded.machine,
                        process = excluded.process,
                        source_size = excluded.source_size,
                        source_mtime = excluded.source_mtime,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    upserts,
                )

            conn.commit()
        finally:
            conn.close()

        _SYNC_STATE["ts"] = now
        _SYNC_STATE["root"] = source_root

    return source_root


def _row_matches_category(row: sqlite3.Row | dict, category: str) -> bool:
    if not category:
        return True
    category_lower = category.strip().lower()
    raw = (row["category"] or "").strip()
    if raw.lower() == category_lower:
        return True
    try:
        parts = json.loads(row["category_parts"] or "[]")
    except Exception:
        parts = []
    return any(str(part).strip().lower() == category_lower for part in parts)


def _row_matches_filters(row: sqlite3.Row | dict, category: str, process: str, machine: str) -> bool:
    if category and not _row_matches_category(row, category):
        return False
    if process and (row["process"] or "").strip().lower() != process.strip().lower():
        return False
    if machine and (row["machine"] or "").strip().lower() != machine.strip().lower():
        return False
    return True


def _score_field(keyword_upper: str, value: str, base: int) -> tuple[int, str] | None:
    text = (value or "").strip()
    if not text:
        return None
    upper = text.upper()
    if upper == keyword_upper:
        return (base + 40, "exact")
    if upper.startswith(keyword_upper):
        return (base + 30, "prefix")
    if keyword_upper in upper:
        return (base + 20, "substring")
    tokens = [token for token in re_split_tokens(text) if token]
    for token in tokens:
        token_upper = token.upper()
        if token_upper == keyword_upper:
            return (base + 18, "token_exact")
        if token_upper.startswith(keyword_upper):
            return (base + 12, "token_prefix")
    return None


def re_split_tokens(text: str) -> list[str]:
    for sep in ["/", "\\", "&", "+", "-", "_", "(", ")", "（", "）"]:
        text = text.replace(sep, " ")
    return [token for token in text.split() if token]


def _rank_row(keyword: str, row: sqlite3.Row | dict) -> tuple[int, str] | None:
    keyword_upper = (keyword or "").strip().upper()
    if not keyword_upper:
        return (0, "all")

    candidates = [
        ("job_name", row["job_name"], 100),
        ("machine", row["machine"], 95),
        ("category", row["category"], 90),
        ("process", row["process"], 85),
        ("pdf_name", row["pdf_name"], 80),
        ("pdf_path", row["pdf_path"], 70),
    ]
    best: tuple[int, str] | None = None
    best_field = "metadata"
    for field_name, value, base in candidates:
        scored = _score_field(keyword_upper, value or "", base)
        if scored and (best is None or scored[0] > best[0]):
            best = scored
            best_field = field_name

    if best is None:
        return None
    return (best[0], f"metadata_{best_field}_{best[1]}")


def _make_result(row: sqlite3.Row | dict, match_type: str, score: int) -> dict:
    pdf_path = row["pdf_path"] or ""
    digest = hashlib.md5(pdf_path.encode("utf-8")).hexdigest()[:16]
    image_path = _resolve_image_path(pdf_path)
    return {
        "id": f"meta:{digest}",
        "job_name": row["job_name"] or "",
        "pdf_name": row["pdf_name"] or "",
        "pdf_path": pdf_path,
        "page_num": 0,
        "image_path": image_path,
        "match_type": match_type,
        "category": row["category"] or "",
        "process": row["process"] or "",
        "machine": row["machine"] or "",
        "_score": score,
    }


def search_metadata(keyword: str, top_k: int = 20, category: str = "", process: str = "", machine: str = "") -> list[dict]:
    ensure_table()
    conn = _connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT pdf_path, pdf_name, job_name, category, category_parts, machine, process
            FROM sop_file_index
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    matched: list[dict] = []
    for row in rows:
        if not _row_matches_filters(row, category, process, machine):
            continue
        rank = _rank_row(keyword, row)
        if rank is None:
            continue
        score, match_type = rank
        matched.append(_make_result(row, match_type, score))

    matched.sort(
        key=lambda item: (
            -int(item.get("_score", 0)),
            str(item.get("job_name", "")),
            str(item.get("pdf_name", "")),
            str(item.get("pdf_path", "")),
        )
    )
    for item in matched:
        item.pop("_score", None)
    return matched[:top_k]


def suggest_terms(keyword: str, top_k: int = 10) -> list[str]:
    ensure_table()
    conn = _connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT job_name, pdf_name, category, category_parts, machine, process
            FROM sop_file_index
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    terms: set[str] = set()
    for row in rows:
        for value in [
            row["job_name"],
            row["pdf_name"],
            row["category"],
            row["machine"],
            row["process"],
        ]:
            if value:
                terms.add(str(value).strip())
        try:
            parts = json.loads(row["category_parts"] or "[]")
        except Exception:
            parts = []
        for part in parts:
            if part:
                terms.add(str(part).strip())

    keyword_upper = (keyword or "").strip().upper()
    if not keyword_upper:
        return sorted(terms)[:top_k]

    ranked: list[tuple[int, str]] = []
    for term in terms:
        scored = _score_field(keyword_upper, term, 50)
        if scored:
            ranked.append((scored[0], term))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [term for _score, term in ranked[:top_k]]


def get_filter_options(category: str = "", machine: str = "") -> dict:
    ensure_table()
    conn = _connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT category, category_parts, machine, process
            FROM sop_file_index
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    categories: set[str] = set()
    machines_all: set[str] = set()
    processes_all: set[str] = set()
    filtered_rows = [row for row in rows if _row_matches_filters(row, category, "", "")]

    for row in rows:
        try:
            parts = json.loads(row["category_parts"] or "[]")
        except Exception:
            parts = []
        for part in parts:
            if part:
                categories.add(str(part).strip())
        if row["category"] and "&" not in str(row["category"]):
            categories.add(str(row["category"]).strip())
        if row["machine"]:
            machines_all.add(str(row["machine"]).strip())
        if row["process"]:
            processes_all.add(str(row["process"]).strip())

    categories_lower = {item.lower() for item in categories if item}

    if category:
        machines = {
            str(row["machine"]).strip()
            for row in filtered_rows
            if row["machine"] and str(row["machine"]).strip().lower() not in categories_lower
        }
    else:
        machines = {item for item in machines_all if item and item.lower() not in categories_lower}

    if machine:
        processes = {
            str(row["process"]).strip()
            for row in filtered_rows
            if row["machine"] and str(row["machine"]).strip().lower() == machine.strip().lower() and row["process"]
        }
    else:
        processes = processes_all

    return {
        "categories": sorted(item for item in categories if item),
        "machines": sorted(item for item in machines if item),
        "processes": sorted(item for item in processes if item),
    }


def get_stats() -> dict:
    ensure_table()
    conn = _connect()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sop_file_index")
        total_pdfs = int(cursor.fetchone()[0])
        cursor.execute("SELECT COUNT(DISTINCT job_name) FROM sop_file_index WHERE TRIM(job_name) != ''")
        unique_jobs = int(cursor.fetchone()[0])
    finally:
        conn.close()
    return {
        "total_pdfs": total_pdfs,
        "unique_job_names": unique_jobs,
    }
