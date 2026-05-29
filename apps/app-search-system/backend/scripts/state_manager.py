#!/usr/bin/env python3
"""
state_manager.py - SOP处理流水线统一状态管理

整合：
- PDF扫描状态（新增/修改/删除检测）
- 页面处理状态（图片转换+OCR）
- 向量索引状态（ChromaDB）

特性：
- 哈希增量检测（准确判断文件是否变化）
- 断点续传（失败后可恢复）
- 状态持久化（重启不丢失进度）
"""

import os
import sqlite3
import hashlib
import json
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

try:
    from .config import DIR, DB, setup_logging
except ImportError:
    from config import DIR, DB, setup_logging

logger = setup_logging("state_manager")


class PDFStatus(Enum):
    """PDF文件状态"""
    PENDING = "pending"       # 待处理
    PROCESSING = "processing"  # 处理中
    PROCESSED = "processed"   # 已完成
    FAILED = "failed"         # 失败
    DELETED = "deleted"       # 已删除


class PageStatus(Enum):
    """页面处理状态"""
    PENDING = "pending"       # 待处理
    PROCESSING = "processing" # 处理中
    PROCESSED = "processed"   # 已完成
    SKIPPED = "skipped"       # 跳过（无作业名称）
    FAILED = "failed"         # 失败


@dataclass
class PDFRecord:
    """PDF文件记录"""
    id: int = 0
    pdf_path: str = ""
    pdf_name: str = ""
    file_hash: str = ""
    file_size: int = 0
    page_count: int = 0
    last_modified: str = ""
    status: str = "pending"
    error_msg: str = ""
    sync_time: str = ""


@dataclass
class PageRecord:
    """页面记录"""
    id: int = 0
    pdf_id: int = 0
    page_num: int = 0
    doc_id: str = ""
    job_name: str = ""
    image_path: str = ""
    ocr_text: str = ""
    status: str = "pending"
    retry_count: int = 0
    error_msg: str = ""
    process_time: str = ""


class StateManager:
    """统一状态管理器"""

    _local = threading.local()

    def __init__(self, db_path: Path = None):
        self.db_path = db_path or DB.SCAN_DB
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """获取线程本地连接"""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self.db_path))
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_db(self):
        """初始化数据库表"""
        conn = self._get_conn()
        cursor = conn.cursor()

        # PDF文件状态表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pdf_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pdf_path TEXT NOT NULL UNIQUE,
                pdf_name TEXT NOT NULL,
                file_hash TEXT,
                file_size INTEGER,
                page_count INTEGER,
                last_modified TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                error_msg TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')

        # 页面处理状态表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pdf_id INTEGER NOT NULL,
                page_num INTEGER NOT NULL,
                doc_id TEXT NOT NULL UNIQUE,
                job_name TEXT,
                image_path TEXT,
                ocr_text TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                error_msg TEXT,
                process_time TEXT,
                FOREIGN KEY (pdf_id) REFERENCES pdf_files(id) ON DELETE CASCADE
            )
        ''')

        # 流水线执行记录表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pipeline_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                phase TEXT NOT NULL,
                pdf_path TEXT,
                page_num INTEGER,
                status TEXT NOT NULL,
                details TEXT,
                started_at TEXT NOT NULL,
                completed_at TEXT
            )
        ''')

        # 变更历史表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS change_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                change_type TEXT NOT NULL,
                pdf_path TEXT NOT NULL,
                pdf_name TEXT NOT NULL,
                old_hash TEXT,
                new_hash TEXT,
                change_time TEXT NOT NULL,
                details TEXT
            )
        ''')

        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pdf_path ON pdf_files(pdf_path)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pdf_status ON pdf_files(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_page_pdf_id ON page_index(pdf_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_page_doc_id ON page_index(doc_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_page_status ON page_index(status)')

        conn.commit()
        logger.info(f"状态数据库已初始化: {self.db_path}")

    # ============== 文件哈希 ==============

    @staticmethod
    def calculate_file_hash(file_path: str, chunk_size: int = 65536) -> str:
        """计算文件MD5哈希"""
        hasher = hashlib.md5()
        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(chunk_size), b''):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception as e:
            logger.error(f"计算哈希失败 {file_path}: {e}")
            return ""

    @staticmethod
    def calculate_content_hash(content: str) -> str:
        """计算内容哈希（用于页面内容）"""
        return hashlib.md5(content.encode()).hexdigest()

    # ============== PDF扫描 ==============

    def scan_source_pdfs(self, source_dir: Path) -> Dict[str, dict]:
        """扫描源目录，返回 {path: info}（不含hash，快速扫描）"""
        pdfs = {}
        if not source_dir.exists():
            logger.error(f"源目录不存在: {source_dir}")
            return pdfs

        logger.info(f"扫描源目录: {source_dir}")

        for pdf_path in source_dir.rglob("*.pdf"):
            try:
                stat = pdf_path.stat()
                pdfs[str(pdf_path)] = {
                    'path': str(pdf_path),
                    'name': pdf_path.name,
                    'size': stat.st_size,
                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'hash': ""  # 扫描阶段不计算hash
                }
            except Exception as e:
                logger.error(f"扫描PDF失败 {pdf_path}: {e}")

        logger.info(f"找到 {len(pdfs)} 个PDF文件")
        return pdfs

    def get_all_records(self) -> Dict[str, dict]:
        """获取所有已记录的PDF状态"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pdf_path, pdf_name, file_hash, file_size, page_count, last_modified, status
            FROM pdf_files WHERE status != 'deleted'
        """)
        return {
            row['pdf_path']: {
                'path': row['pdf_path'],
                'name': row['pdf_name'],
                'hash': row['file_hash'],
                'size': row['file_size'],
                'page_count': row['page_count'],
                'last_modified': row['last_modified'],
                'status': row['status']
            }
            for row in cursor.fetchall()
        }

    def detect_changes(self, source_pdfs: Dict[str, dict]) -> dict:
        """检测文件变更（使用哈希精确比较）

        Returns:
            dict: {added: [], modified: [], deleted: [], unchanged: [], metadata_only: []}
        """
        recorded = self.get_all_records()
        recorded_paths = set(recorded.keys())
        source_paths = set(source_pdfs.keys())

        added = []
        modified = []
        deleted = []
        unchanged = []
        metadata_only = []

        # 新增：源有，记录无
        for path in source_paths - recorded_paths:
            added.append(path)

        # 删除：记录有，源无（且状态不是deleted）
        for path in recorded_paths - source_paths:
            if recorded[path]['status'] != 'deleted':
                deleted.append(path)

        # 共同有：检查是否修改（计算实际hash）
        for path in source_paths & recorded_paths:
            rec = recorded[path]
            src = source_pdfs[path]

            fast_changed = (
                rec.get('size') != src.get('size') or
                (rec.get('last_modified') or "") != (src.get('modified') or "") or
                not rec.get('hash')
            )

            if not fast_changed:
                unchanged.append(path)
                continue

            current_hash = rec.get('hash') or self.calculate_file_hash(path)
            src_hash = self.calculate_file_hash(path)
            src['hash'] = src_hash

            if current_hash != src_hash:
                modified.append(path)
            else:
                metadata_only.append(path)

        return {
            'added': added,
            'modified': modified,
            'deleted': deleted,
            'unchanged': unchanged,
            'metadata_only': metadata_only,
        }

    def upsert_pdf(self, pdf_path: str, pdf_name: str, file_hash: str,
                   file_size: int, page_count: int, last_modified: str,
                   status: str = "pending", error_msg: str = "") -> int:
        """插入或更新PDF记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute('''
            INSERT INTO pdf_files
            (pdf_path, pdf_name, file_hash, file_size, page_count, last_modified, status, error_msg, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pdf_path) DO UPDATE SET
                pdf_name = excluded.pdf_name,
                file_hash = excluded.file_hash,
                file_size = excluded.file_size,
                page_count = excluded.page_count,
                last_modified = excluded.last_modified,
                status = excluded.status,
                error_msg = excluded.error_msg,
                updated_at = excluded.updated_at
        ''', (pdf_path, pdf_name, file_hash, file_size, page_count, last_modified, status, error_msg, now, now))

        conn.commit()
        cursor.execute("SELECT id FROM pdf_files WHERE pdf_path = ?", (pdf_path,))
        row = cursor.fetchone()
        return row['id'] if row else 0

    def update_pdf_status(self, pdf_path: str, status: str, error_msg: str = ""):
        """更新PDF状态"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE pdf_files
            SET status = ?, error_msg = ?, updated_at = ?
            WHERE pdf_path = ?
        ''', (status, error_msg, datetime.now().isoformat(), pdf_path))
        conn.commit()

    def refresh_pdf_metadata(self, pdf_path: str, file_size: int, last_modified: str):
        """刷新PDF的扫描元数据，但不改变状态和hash。"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE pdf_files
            SET file_size = ?, last_modified = ?, updated_at = ?
            WHERE pdf_path = ?
        ''', (file_size, last_modified, datetime.now().isoformat(), pdf_path))
        conn.commit()

    def mark_pdf_deleted(self, pdf_path: str):
        """标记PDF为已删除"""
        self.update_pdf_status(pdf_path, PDFStatus.DELETED.value)

    def get_deleted_pdfs(self) -> List[dict]:
        """获取已标记删除的PDF列表。"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.*
            FROM pdf_files f
            WHERE f.status = 'deleted'
              AND EXISTS (SELECT 1 FROM page_index p WHERE p.pdf_id = f.id)
        """)
        return [dict(row) for row in cursor.fetchall()]

    def get_pending_pdfs(self) -> List[dict]:
        """获取待处理的PDF列表"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pdf_path, file_hash, page_count, status
            FROM pdf_files WHERE status IN ('pending', 'modified', 'failed')
        """)
        return [
            {'path': row['pdf_path'], 'hash': row['file_hash'], 'page_count': row['page_count'], 'status': row['status']}
            for row in cursor.fetchall()
        ]

    def get_pdf_by_path(self, pdf_path: str) -> Optional[dict]:
        """根据路径获取PDF记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pdf_files WHERE pdf_path = ?", (pdf_path,))
        row = cursor.fetchone()
        return dict(row) if row else None

    # ============== 页面管理 ==============

    def add_page(self, pdf_id: int, page_num: int, doc_id: str,
                 job_name: str = "", image_path: str = "",
                 ocr_text: str = "", status: str = "pending") -> int:
        """添加页面记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute('''
            INSERT OR REPLACE INTO page_index
            (pdf_id, page_num, doc_id, job_name, image_path, ocr_text, status, process_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (pdf_id, page_num, doc_id, job_name, image_path, ocr_text, status, now))

        conn.commit()
        return cursor.lastrowid

    def update_page(self, doc_id: str, job_name: str = None, image_path: str = None,
                    ocr_text: str = None, status: str = None, error_msg: str = None):
        """更新页面记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        updates = []
        params = []

        if job_name is not None:
            updates.append("job_name = ?")
            params.append(job_name)
        if image_path is not None:
            updates.append("image_path = ?")
            params.append(image_path)
        if ocr_text is not None:
            updates.append("ocr_text = ?")
            params.append(ocr_text)
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if error_msg is not None:
            updates.append("error_msg = ?")
            params.append(error_msg)

        if updates:
            updates.append("process_time = ?")
            params.append(datetime.now().isoformat())
            params.append(doc_id)
            cursor.execute(f"UPDATE page_index SET {', '.join(updates)} WHERE doc_id = ?", params)
            conn.commit()

    def increment_retry(self, doc_id: str) -> int:
        """增加重试计数，返回当前计数"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("UPDATE page_index SET retry_count = retry_count + 1 WHERE doc_id = ?", (doc_id,))
        conn.commit()
        cursor.execute("SELECT retry_count FROM page_index WHERE doc_id = ?", (doc_id,))
        return cursor.fetchone()['retry_count']

    def get_page_by_doc_id(self, doc_id: str) -> Optional[dict]:
        """根据doc_id获取页面记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM page_index WHERE doc_id = ?", (doc_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_pages_by_pdf(self, pdf_id: int) -> List[dict]:
        """获取PDF的所有页面"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM page_index WHERE pdf_id = ? ORDER BY page_num", (pdf_id,))
        return [dict(row) for row in cursor.fetchall()]

    def is_file_stable(self, pdf_path: str, expected_size: int = None,
                       expected_modified: str = None, wait_seconds: int = 2) -> bool:
        """检查文件在短时间内是否稳定，避免读取到正在写入的网络文件。"""
        path = Path(pdf_path)
        try:
            first = path.stat()
        except OSError:
            return False

        if expected_size is not None and first.st_size != expected_size:
            return False

        if expected_modified is not None:
            first_modified = datetime.fromtimestamp(first.st_mtime).isoformat()
            if first_modified != expected_modified:
                return False

        if wait_seconds <= 0:
            return True

        time.sleep(wait_seconds)

        try:
            second = path.stat()
        except OSError:
            return False

        return first.st_size == second.st_size and first.st_mtime == second.st_mtime

    def delete_pages_by_pdf(self, pdf_id: int):
        """删除PDF的所有页面记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM page_index WHERE pdf_id = ?", (pdf_id,))
        conn.commit()

    def get_pending_pages(self, pdf_id: int = None) -> List[dict]:
        """获取待处理的页面"""
        conn = self._get_conn()
        cursor = conn.cursor()
        if pdf_id:
            cursor.execute("""
                SELECT p.*, f.pdf_path, f.file_hash
                FROM page_index p
                JOIN pdf_files f ON p.pdf_id = f.id
                WHERE p.pdf_id = ? AND p.status IN ('pending', 'failed')
            """, (pdf_id,))
        else:
            cursor.execute("""
                SELECT p.*, f.pdf_path, f.file_hash
                FROM page_index p
                JOIN pdf_files f ON p.pdf_id = f.id
                WHERE p.status IN ('pending', 'failed')
            """)
        return [dict(row) for row in cursor.fetchall()]

    # ============== 变更日志 ==============

    def log_change(self, change_type: str, pdf_path: str, pdf_name: str,
                   old_hash: str = None, new_hash: str = None, details: dict = None):
        """记录变更日志"""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO change_log (change_type, pdf_path, pdf_name, old_hash, new_hash, change_time, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (change_type, pdf_path, pdf_name, old_hash, new_hash,
              datetime.now().isoformat(), json.dumps(details, ensure_ascii=False) if details else None))
        conn.commit()

    # ============== 统计 ==============

    def get_stats(self) -> dict:
        """获取统计信息"""
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM pdf_files WHERE status != 'deleted'")
        total_pdfs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pdf_files WHERE status = 'pending'")
        pending_pdfs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pdf_files WHERE status = 'processed'")
        processed_pdfs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM page_index WHERE status = 'processed'")
        processed_pages = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM page_index WHERE status = 'skipped'")
        skipped_pages = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT job_name) FROM page_index WHERE job_name IS NOT NULL AND job_name != ''")
        unique_jobs = cursor.fetchone()[0]

        return {
            'total_pdfs': total_pdfs,
            'pending_pdfs': pending_pdfs,
            'processed_pdfs': processed_pdfs,
            'processed_pages': processed_pages,
            'skipped_pages': skipped_pages,
            'unique_jobs': unique_jobs
        }

    def close(self):
        """关闭数据库连接"""
        if hasattr(self._local, 'conn') and self._local.conn:
            self._local.conn.close()
            self._local.conn = None


# ============== 工厂函数 ==============

def get_state_manager(db_path: Path = None) -> StateManager:
    """获取StateManager实例（单例）"""
    global _state_manager
    if db_path:
        return StateManager(db_path)
    if '_state_manager' not in globals():
        globals()['_state_manager'] = StateManager()
    return globals()['_state_manager']


# ============== CLI ==============

if __name__ == "__main__":
    import argparse
    import fitz

    parser = argparse.ArgumentParser(description='SOP状态管理')
    parser.add_argument('--scan', action='store_true', help='扫描源目录')
    parser.add_argument('--stats', action='store_true', help='查看统计')
    parser.add_argument('--pending', action='store_true', help='查看待处理列表')
    parser.add_argument('--check', type=str, help='检查指定PDF的hash')

    args = parser.parse_args()

    sm = StateManager()

    if args.scan:
        source_pdfs = sm.scan_source_pdfs(DIR.SOURCE_DIR)
        changes = sm.detect_changes(source_pdfs)
        print(f"\n变更检测结果:")
        print(f"  新增: {len(changes['added'])} 个")
        print(f"  修改: {len(changes['modified'])} 个")
        print(f"  删除: {len(changes['deleted'])} 个")
        print(f"  未变: {len(changes['unchanged'])} 个")

    elif args.stats:
        stats = sm.get_stats()
        print(f"\n当前状态:")
        print(f"  PDF文件: {stats['total_pdfs']}")
        print(f"  待处理: {stats['pending_pdfs']}")
        print(f"  已完成: {stats['processed_pdfs']}")
        print(f"  索引页面: {stats['processed_pages']}")
        print(f"  跳过页面: {stats['skipped_pages']}")
        print(f"  作业数: {stats['unique_jobs']}")

    elif args.pending:
        pending = sm.get_pending_pdfs()
        print(f"\n待处理PDF ({len(pending)} 个):")
        for p in pending:
            print(f"  [{p['status']}] {p['path']}")

    elif args.check:
        h = sm.calculate_file_hash(args.check)
        print(f"\n文件哈希: {h}")
        rec = sm.get_pdf_by_path(args.check)
        if rec:
            print(f"记录哈希: {rec.get('file_hash', 'N/A')}")
            print(f"状态: {rec.get('status', 'N/A')}")

    sm.close()
