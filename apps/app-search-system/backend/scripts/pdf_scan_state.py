#!/usr/bin/env python3
"""
01_pdf_scan.py - PDF扫描与哈希状态管理

功能：
1. 扫描源目录，检测PDF文件变更（新增/修改/删除）
2. 计算每个PDF的MD5哈希，记录文件元信息
3. 管理同步状态数据库，支持增量更新

输出：
- sync_state.db - PDF文件状态表（path, hash, size, modified, status）
- 变更报告JSON - 供下游脚本使用
"""

import os
import sys
import json
import sqlite3
import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Set, Optional
import logging

# ============== 路径配置 ==============
BASE_DIR = Path(__file__).parent.parent.absolute()
SOURCE_DIR = Path(r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)")
LOCAL_SYNC_DIR = BASE_DIR / "data" / "pdf_sync"  # 本地PDF备份（可选）
STATE_DB = BASE_DIR / "data" / "pdf_scan_state.db"
LOG_DIR = BASE_DIR / "logs"

# ============== 日志配置 ==============
def setup_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / f"pdf_scan_{datetime.now().strftime('%Y%m%d')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()


class PDFScanState:
    """PDF扫描状态管理器"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化状态数据库"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        # PDF文件状态表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pdf_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pdf_path TEXT NOT NULL UNIQUE,
                pdf_name TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                file_hash TEXT,
                file_size INTEGER,
                last_modified TEXT,
                page_count INTEGER,
                scan_time TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                error_msg TEXT,
                UNIQUE(pdf_path)
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
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pdf_path ON pdf_state(pdf_path)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_status ON pdf_state(status)')

        conn.commit()
        conn.close()

    def calculate_hash(self, file_path: str, chunk_size: int = 65536) -> str:
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

    def scan_pdf_info(self, pdf_path: Path) -> Optional[dict]:
        """快速获取PDF信息（不计算hash，用于扫描阶段）"""
        try:
            stat = pdf_path.stat()
            import fitz
            with fitz.open(pdf_path) as doc:
                page_count = len(doc)
            return {
                'path': str(pdf_path),
                'name': pdf_path.name,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'page_count': page_count,
                'hash': ""  # 扫描阶段不计算hash
            }
        except Exception as e:
            logger.error(f"扫描PDF失败 {pdf_path}: {e}")
            return None

    def scan_source(self, source_dir: Path) -> Dict[str, dict]:
        """扫描源目录，返回 {path: info}"""
        pdfs = {}
        if not source_dir.exists():
            logger.error(f"源目录不存在: {source_dir}")
            return pdfs

        logger.info(f"扫描源目录: {source_dir}")
        count = 0
        for pdf_path in source_dir.rglob("*.pdf"):
            info = self.scan_pdf_info(pdf_path)
            if info:
                pdfs[info['path']] = info
                count += 1
        logger.info(f"找到 {count} 个PDF文件")
        return pdfs

    def get_all_recorded(self) -> Dict[str, dict]:
        """获取所有已记录的PDF状态"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT pdf_path, pdf_name, file_hash, file_size, page_count, status FROM pdf_state WHERE status != 'deleted'")
        rows = cursor.fetchall()
        conn.close()
        return {
            row[0]: {
                'path': row[0], 'name': row[1], 'hash': row[2],
                'size': row[3], 'page_count': row[4], 'status': row[5]
            }
            for row in rows
        }

    def compute_hash_if_needed(self, pdf_path: str, info: dict) -> str:
        """如果hash为空，则计算（增量处理时只计算变更文件的hash）"""
        if not info.get('hash'):
            info['hash'] = self.calculate_hash(pdf_path)
        return info['hash']

    def detect_changes(self, source_pdfs: Dict[str, dict]) -> dict:
        """检测文件变更，返回新增/修改/删除列表"""
        recorded = self.get_all_recorded()
        recorded_paths = set(recorded.keys())
        source_paths = set(source_pdfs.keys())

        added = []
        modified = []
        deleted = []
        unchanged = []

        # 新增：源有，记录无
        for path in source_paths - recorded_paths:
            added.append(path)

        # 删除：记录有，源无
        for path in recorded_paths - source_paths:
            if recorded[path]['status'] != 'deleted':
                deleted.append(path)

        # 共同有：检查是否修改
        for path in source_paths & recorded_paths:
            rec = recorded[path]
            src = source_pdfs[path]

            # 如果记录中没有hash，先计算
            if not rec.get('hash'):
                rec['hash'] = self.calculate_hash(path)

            # 比较：大小 或 hash
            if src['size'] != rec['size'] or (rec['hash'] and src['size'] != rec['size']):
                modified.append(path)
            else:
                unchanged.append(path)

        return {
            'added': added,
            'modified': modified,
            'deleted': deleted,
            'unchanged': unchanged
        }

    def update_record(self, pdf_path: str, info: dict, status: str = 'pending', error_msg: str = ''):
        """更新或插入PDF记录"""
        # 计算hash（如果还没有）
        file_hash = self.compute_hash_if_needed(pdf_path, info)

        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO pdf_state
            (pdf_path, pdf_name, relative_path, file_hash, file_size, last_modified, page_count, scan_time, status, error_msg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            pdf_path,
            info['name'],
            Path(pdf_path).relative_to(SOURCE_DIR) if pdf_path.startswith(str(SOURCE_DIR)) else Path(pdf_path).name,
            file_hash,
            info['size'],
            info['modified'],
            info.get('page_count', 0),
            datetime.now().isoformat(),
            status,
            error_msg
        ))

        conn.commit()
        conn.close()

    def log_change(self, change_type: str, pdf_path: str, pdf_name: str,
                   old_hash: str = None, new_hash: str = None, details: dict = None):
        """记录变更日志"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO change_log (change_type, pdf_path, pdf_name, old_hash, new_hash, change_time, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            change_type, pdf_path, pdf_name,
            old_hash, new_hash,
            datetime.now().isoformat(),
            json.dumps(details, ensure_ascii=False) if details else None
        ))
        conn.commit()
        conn.close()

    def mark_deleted(self, pdf_path: str):
        """标记PDF为已删除"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute("UPDATE pdf_state SET status = 'deleted' WHERE pdf_path = ?", (pdf_path,))
        conn.commit()
        conn.close()

    def get_pending_pdfs(self) -> list:
        """获取待处理的PDF列表（新增和修改的）"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT pdf_path, file_hash, page_count FROM pdf_state WHERE status IN ('pending', 'modified')")
        rows = cursor.fetchall()
        conn.close()
        return [{'path': row[0], 'hash': row[1], 'page_count': row[2]} for row in rows]

    def get_stats(self) -> dict:
        """获取统计信息"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM pdf_state WHERE status = 'pending'")
        pending = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pdf_state WHERE status = 'processed'")
        processed = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pdf_state WHERE status = 'deleted'")
        deleted = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pdf_state WHERE status IN ('pending', 'modified')")
        todo = cursor.fetchone()[0]

        conn.close()

        return {
            'total': pending + processed + deleted,
            'pending': pending,
            'processed': processed,
            'deleted': deleted,
            'todo': todo
        }


def run_scan(source_dir: Path = SOURCE_DIR) -> dict:
    """执行扫描，返回变更报告"""
    logger.info("=" * 60)
    logger.info("开始PDF扫描")
    logger.info(f"源目录: {source_dir}")
    logger.info("=" * 60)

    scan_state = PDFScanState(STATE_DB)

    # 1. 扫描源目录
    source_pdfs = scan_state.scan_source(source_dir)

    # 2. 检测变更
    changes = scan_state.detect_changes(source_pdfs)

    # 3. 更新记录并记录日志
    for pdf_path in changes['added']:
        info = source_pdfs[pdf_path]
        scan_state.update_record(pdf_path, info, status='pending')
        scan_state.log_change('added', pdf_path, info['name'], new_hash=info.get('hash', ''))

    for pdf_path in changes['modified']:
        info = source_pdfs[pdf_path]
        old_info = scan_state.get_all_recorded().get(pdf_path, {})
        scan_state.update_record(pdf_path, info, status='modified')
        scan_state.log_change('modified', pdf_path, info['name'],
                              old_hash=old_info.get('hash', ''),
                              new_hash=info.get('hash', ''))

    for pdf_path in changes['deleted']:
        old_info = scan_state.get_all_recorded().get(pdf_path, {})
        scan_state.mark_deleted(pdf_path)
        scan_state.log_change('deleted', pdf_path, old_info.get('name', ''),
                              old_hash=old_info.get('hash', ''))

    # 4. 输出报告
    stats = scan_state.get_stats()

    report = {
        'timestamp': datetime.now().isoformat(),
        'source_dir': str(source_dir),
        'changes': {
            'added': len(changes['added']),
            'modified': len(changes['modified']),
            'deleted': len(changes['deleted']),
            'unchanged': len(changes['unchanged'])
        },
        'stats': stats,
        'pending_pdfs': scan_state.get_pending_pdfs()
    }

    logger.info(f"\n变更报告:")
    logger.info(f"  新增: {report['changes']['added']} 个")
    logger.info(f"  修改: {report['changes']['modified']} 个")
    logger.info(f"  删除: {report['changes']['deleted']} 个")
    logger.info(f"  未变: {report['changes']['unchanged']} 个")
    logger.info(f"\n待处理: {stats['todo']} 个")

    return report


def main():
    import argparse
    parser = argparse.ArgumentParser(description='PDF扫描与状态管理')
    parser.add_argument('--source', type=str, help='源目录路径')
    parser.add_argument('--stats', action='store_true', help='查看统计')
    parser.add_argument('--pending', action='store_true', help='查看待处理列表')
    parser.add_argument('--output-json', type=str, help='输出报告到JSON文件')

    args = parser.parse_args()

    source = Path(args.source) if args.source else SOURCE_DIR
    scan_state = PDFScanState(STATE_DB)

    if args.stats:
        stats = scan_state.get_stats()
        print(f"\n当前状态:")
        print(f"  总记录: {stats['total']}")
        print(f"  待处理: {stats['pending']}")
        print(f"  已处理: {stats['processed']}")
        print(f"  已删除: {stats['deleted']}")
        return

    if args.pending:
        pending = scan_state.get_pending_pdfs()
        print(f"\n待处理PDF ({len(pending)} 个):")
        for p in pending:
            print(f"  {p['path']}")
        return

    # 执行扫描
    report = run_scan(source)

    # 输出JSON
    if args.output_json:
        with open(args.output_json, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        logger.info(f"报告已保存: {args.output_json}")

    # 打印待处理列表
    if report['pending_pdfs']:
        logger.info(f"\n待处理PDF列表 ({len(report['pending_pdfs'])} 个):")
        for p in report['pending_pdfs'][:10]:
            logger.info(f"  {p['path']}")
        if len(report['pending_pdfs']) > 10:
            logger.info(f"  ... 还有 {len(report['pending_pdfs']) - 10} 个")


if __name__ == "__main__":
    main()
