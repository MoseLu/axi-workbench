#!/usr/bin/env python3
"""
SOP文件同步脚本
- 比较远程共享目录和本地目录的文件差异
- 记录差异信息到SQLite数据库
- 触发向量数据库更新
"""

import os
import sys
import json
import sqlite3
import hashlib
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import logging

# 配置
CONFIG = {
    # 远程共享路径
    "remote_base": r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)",
    # 本地同步目录（SOP文件存放目录）
    "local_base": r"E:\app\sop\asserts",
    # 数据库路径
    "db_path": str(Path(__file__).parent / "sync_history.db"),
    # 日志路径
    "log_path": str(Path(__file__).parent / "logs"),
    # 统一流水线脚本路径
    "pipeline_script": str(Path(__file__).parent / "scripts" / "run_pipeline.py"),
    # 支持的文件扩展名
    "supported_extensions": [".pdf", ".mp4", ".jpg", ".png", ".doc", ".docx", ".xls", ".xlsx"],
    # 排除的目录（本地生成的缓存目录）
    "exclude_dirs": ["pdf_images", "__pycache__", ".git", "logs", "chroma_db"],
}

# 设置日志
def setup_logging():
    log_dir = Path(CONFIG["log_path"])
    log_dir.mkdir(exist_ok=True)

    log_file = log_dir / f"sync_{datetime.now().strftime('%Y%m%d')}.log"

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


class SyncDatabase:
    """同步历史数据库管理"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化数据库表"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 同步历史表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_time TEXT NOT NULL,
                status TEXT NOT NULL,
                added_count INTEGER DEFAULT 0,
                removed_count INTEGER DEFAULT 0,
                modified_count INTEGER DEFAULT 0,
                details TEXT
            )
        ''')

        # 文件记录表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS file_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                folder_path TEXT NOT NULL,
                file_hash TEXT,
                file_size INTEGER,
                last_modified TEXT,
                sync_time TEXT NOT NULL,
                status TEXT NOT NULL,
                UNIQUE(file_path, sync_time)
            )
        ''')

        # 变更详情表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS change_details (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_id INTEGER NOT NULL,
                change_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                folder_path TEXT NOT NULL,
                old_hash TEXT,
                new_hash TEXT,
                FOREIGN KEY (sync_id) REFERENCES sync_history(id)
            )
        ''')

        conn.commit()
        conn.close()

    def record_sync(self, status: str, added: int, removed: int, modified: int, details: dict) -> int:
        """记录一次同步"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO sync_history (sync_time, status, added_count, removed_count, modified_count, details)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            status,
            added,
            removed,
            modified,
            json.dumps(details, ensure_ascii=False)
        ))

        sync_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return sync_id

    def record_change(self, sync_id: int, change_type: str, file_path: str, file_name: str,
                      folder_path: str, old_hash: str = None, new_hash: str = None):
        """记录单个变更"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO change_details (sync_id, change_type, file_path, file_name, folder_path, old_hash, new_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (sync_id, change_type, file_path, file_name, folder_path, old_hash, new_hash))

        conn.commit()
        conn.close()

    def get_last_sync(self) -> Optional[dict]:
        """获取上次同步信息"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM sync_history ORDER BY id DESC LIMIT 1
        ''')

        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'id': row[0],
                'sync_time': row[1],
                'status': row[2],
                'added_count': row[3],
                'removed_count': row[4],
                'modified_count': row[5],
                'details': json.loads(row[6]) if row[6] else {}
            }
        return None

    def get_file_records(self, sync_id: int) -> List[dict]:
        """获取指定同步的文件记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM change_details WHERE sync_id = ?
        ''', (sync_id,))

        rows = cursor.fetchall()
        conn.close()

        return [{
            'id': row[0],
            'sync_id': row[1],
            'change_type': row[2],
            'file_path': row[3],
            'file_name': row[4],
            'folder_path': row[5],
            'old_hash': row[6],
            'new_hash': row[7]
        } for row in rows]


class FileScanner:
    """文件扫描器"""

    def __init__(self, base_path: str, supported_extensions: List[str], exclude_dirs: List[str] = None):
        self.base_path = base_path
        self.supported_extensions = [ext.lower() for ext in supported_extensions]
        self.exclude_dirs = exclude_dirs or []

    def scan_all_files(self, use_hash: bool = False) -> Dict[str, dict]:
        """扫描所有文件，返回文件路径 -> 文件信息的映射

        Args:
            use_hash: 是否计算文件哈希（大文件/网络文件建议False）
        """
        files = {}
        base = Path(self.base_path)

        if not base.exists():
            logger.warning(f"路径不存在: {self.base_path}")
            return files

        for root, dirs, filenames in os.walk(self.base_path):
            # 排除指定的目录
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]

            for filename in filenames:
                file_path = Path(root) / filename
                ext = file_path.suffix.lower()

                if ext in self.supported_extensions:
                    try:
                        stat = file_path.stat()
                        rel_path = file_path.relative_to(base)

                        files[str(rel_path)] = {
                            'name': filename,
                            'path': str(file_path),
                            'relative_path': str(rel_path),
                            'folder': str(rel_path.parent),
                            'size': stat.st_size,
                            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            'hash': self._calculate_hash(file_path) if use_hash else f"{stat.st_size}_{stat.st_mtime}"
                        }
                    except Exception as e:
                        logger.error(f"扫描文件失败 {file_path}: {e}")

        return files

    def _calculate_hash(self, file_path: Path, chunk_size: int = 8192) -> str:
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

    def get_folder_stats(self, files: Dict[str, dict]) -> Dict[str, int]:
        """获取各文件夹的文件数量统计"""
        stats = {}
        for file_info in files.values():
            folder = file_info['folder']
            stats[folder] = stats.get(folder, 0) + 1
        return stats


class SOPSync:
    """SOP同步主类"""

    def __init__(self):
        self.db = SyncDatabase(CONFIG["db_path"])
        self.remote_scanner = FileScanner(
            CONFIG["remote_base"],
            CONFIG["supported_extensions"],
            CONFIG.get("exclude_dirs", [])
        )
        self.local_scanner = FileScanner(
            CONFIG["local_base"],
            CONFIG["supported_extensions"],
            CONFIG.get("exclude_dirs", [])
        )

    def compare_files(self, remote_files: Dict[str, dict], local_files: Dict[str, dict]) -> dict:
        """比较远程和本地文件，返回差异"""
        remote_keys = set(remote_files.keys())
        local_keys = set(local_files.keys())

        added = {}      # 远程有，本地无
        removed = {}    # 本地有，远程无
        modified = {}   # 两边都有，但内容不同

        # 找出新增的文件
        for key in remote_keys - local_keys:
            added[key] = remote_files[key]

        # 找出删除的文件
        for key in local_keys - remote_keys:
            removed[key] = local_files[key]

        # 检查修改的文件（使用大小比较，快速高效）
        for key in remote_keys & local_keys:
            remote_size = remote_files[key]['size']
            local_size = local_files[key]['size']

            # 文件大小不同，认为已修改
            if remote_size != local_size:
                modified[key] = {
                    'remote': remote_files[key],
                    'local': local_files[key]
                }

        return {
            'added': added,
            'removed': removed,
            'modified': modified
        }

    def generate_report(self, diff: dict, remote_stats: dict, local_stats: dict) -> dict:
        """生成详细的差异报告"""
        report = {
            'summary': {
                'total_added': len(diff['added']),
                'total_removed': len(diff['removed']),
                'total_modified': len(diff['modified']),
                'remote_folders': len(remote_stats),
                'local_folders': len(local_stats),
                'timestamp': datetime.now().isoformat()
            },
            'folder_comparison': {},
            'added_files': [],
            'removed_files': [],
            'modified_files': []
        }

        # 按文件夹对比
        all_folders = set(remote_stats.keys()) | set(local_stats.keys())
        for folder in sorted(all_folders):
            remote_count = remote_stats.get(folder, 0)
            local_count = local_stats.get(folder, 0)

            if remote_count != local_count:
                report['folder_comparison'][folder] = {
                    'remote_count': remote_count,
                    'local_count': local_count,
                    'diff': remote_count - local_count
                }

        # 新增文件详情
        for key, info in sorted(diff['added'].items()):
            report['added_files'].append({
                'path': key,
                'name': info['name'],
                'folder': info['folder'],
                'size': info['size']
            })

        # 删除文件详情
        for key, info in sorted(diff['removed'].items()):
            report['removed_files'].append({
                'path': key,
                'name': info['name'],
                'folder': info['folder'],
                'size': info['size']
            })

        # 修改文件详情
        for key, info in sorted(diff['modified'].items()):
            report['modified_files'].append({
                'path': key,
                'name': info['remote']['name'],
                'folder': info['remote']['folder'],
                'remote_size': info['remote']['size'],
                'local_size': info['local']['size']
            })

        return report

    def print_report(self, report: dict):
        """打印差异报告"""
        print("\n" + "="*70)
        print("SOP文件同步差异报告")
        print("="*70)
        print(f"时间: {report['summary']['timestamp']}")
        print(f"\n【统计摘要】")
        print(f"  新增文件: {report['summary']['total_added']} 个")
        print(f"  删除文件: {report['summary']['total_removed']} 个")
        print(f"  修改文件: {report['summary']['total_modified']} 个")

        if report['folder_comparison']:
            print(f"\n【文件夹文件数量差异】")
            for folder, stats in sorted(report['folder_comparison'].items()):
                diff_str = f"+{stats['diff']}" if stats['diff'] > 0 else str(stats['diff'])
                print(f"  {folder}: 远程({stats['remote_count']}) vs 本地({stats['local_count']}) [{diff_str}]")

        if report['added_files']:
            print(f"\n【新增文件】({len(report['added_files'])} 个)")
            for f in report['added_files'][:20]:  # 只显示前20个
                print(f"  + {f['path']}")
            if len(report['added_files']) > 20:
                print(f"  ... 还有 {len(report['added_files']) - 20} 个文件")

        if report['removed_files']:
            print(f"\n【删除文件】({len(report['removed_files'])} 个)")
            for f in report['removed_files'][:20]:
                print(f"  - {f['path']}")
            if len(report['removed_files']) > 20:
                print(f"  ... 还有 {len(report['removed_files']) - 20} 个文件")

        if report['modified_files']:
            print(f"\n【修改文件】({len(report['modified_files'])} 个)")
            for f in report['modified_files'][:20]:
                print(f"  ~ {f['path']}")
            if len(report['modified_files']) > 20:
                print(f"  ... 还有 {len(report['modified_files']) - 20} 个文件")

        print("="*70 + "\n")

    def sync_files(self, diff: dict, report: dict) -> bool:
        """执行文件同步（复制新增/修改的文件）"""
        success = True

        # 同步新增的文件
        for key, info in diff['added'].items():
            try:
                src_path = Path(info['path'])
                dst_path = Path(CONFIG['local_base']) / key
                dst_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_path, dst_path)
                logger.info(f"复制新增文件: {key}")
            except Exception as e:
                logger.error(f"复制新增文件失败 {key}: {e}")
                success = False

        # 同步修改的文件
        for key, info in diff['modified'].items():
            try:
                src_path = Path(info['remote']['path'])
                dst_path = Path(CONFIG['local_base']) / key
                shutil.copy2(src_path, dst_path)
                logger.info(f"更新修改文件: {key}")
            except Exception as e:
                logger.error(f"更新修改文件失败 {key}: {e}")
                success = False

        return success

    def trigger_embedding_update(self, report: dict) -> bool:
        """触发统一流水线更新图片与向量索引。"""
        script_path = CONFIG.get('pipeline_script') or CONFIG.get('embedding_script', '')

        if not Path(script_path).exists():
            logger.warning(f"流水线脚本不存在: {script_path}")
            return False

        # 如果有新增或修改的PDF文件，触发更新
        pdf_changed = False
        for f in report['added_files']:
            if f['name'].lower().endswith('.pdf'):
                pdf_changed = True
                break
        if not pdf_changed:
            for f in report['modified_files']:
                if f['name'].lower().endswith('.pdf'):
                    pdf_changed = True
                    break

        if not pdf_changed:
            logger.info("没有PDF文件变更，跳过统一流水线更新")
            return True

        try:
            logger.info("触发统一流水线更新...")
            result = subprocess.run(
                [sys.executable, script_path],
                cwd=str(Path(script_path).parent),
                capture_output=True,
                text=True,
                timeout=3600  # 1小时超时
            )

            if result.returncode == 0:
                logger.info("统一流水线更新完成")
                return True
            else:
                logger.error(f"统一流水线更新失败: {result.stderr or result.stdout}")
                return False

        except subprocess.TimeoutExpired:
            logger.error("统一流水线更新超时")
            return False
        except Exception as e:
            logger.error(f"统一流水线更新异常: {e}")
            return False

    def run(self, dry_run: bool = True, use_hash: bool = False) -> dict:
        """执行同步

        Args:
            dry_run: True=只检查差异，False=执行实际同步
            use_hash: True=计算文件哈希（慢但精确），False=使用文件大小比较（快）
        """
        logger.info("开始SOP文件同步...")
        logger.info(f"远程路径: {CONFIG['remote_base']}")
        logger.info(f"本地路径: {CONFIG['local_base']}")
        logger.info(f"比较模式: {'哈希比较' if use_hash else '文件大小比较'}")

        # 检查远程路径是否可访问
        if not Path(CONFIG['remote_base']).exists():
            logger.error(f"无法访问远程路径: {CONFIG['remote_base']}")
            logger.info("提示: 请确保网络连接正常，或使用正确的UNC路径")

            # 记录失败
            sync_id = self.db.record_sync(
                status='failed',
                added=0, removed=0, modified=0,
                details={'error': '无法访问远程路径'}
            )
            return {'status': 'failed', 'error': '无法访问远程路径'}

        # 扫描文件
        logger.info("扫描远程文件...")
        remote_files = self.remote_scanner.scan_all_files(use_hash=use_hash)
        logger.info(f"远程文件数: {len(remote_files)}")

        logger.info("扫描本地文件...")
        local_files = self.local_scanner.scan_all_files(use_hash=use_hash)
        logger.info(f"本地文件数: {len(local_files)}")

        # 获取文件夹统计
        remote_stats = self.remote_scanner.get_folder_stats(remote_files)
        local_stats = self.local_scanner.get_folder_stats(local_files)

        # 比较差异
        diff = self.compare_files(remote_files, local_files)

        # 生成报告
        report = self.generate_report(diff, remote_stats, local_stats)

        # 打印报告
        self.print_report(report)

        # 记录到数据库
        sync_id = self.db.record_sync(
            status='dry_run' if dry_run else 'completed',
            added=len(diff['added']),
            removed=len(diff['removed']),
            modified=len(diff['modified']),
            details=report
        )

        # 记录变更详情
        for key, info in diff['added'].items():
            self.db.record_change(sync_id, 'added', key, info['name'], info['folder'], new_hash=info['hash'])

        for key, info in diff['removed'].items():
            self.db.record_change(sync_id, 'removed', key, info['name'], info['folder'], old_hash=info['hash'])

        for key, info in diff['modified'].items():
            self.db.record_change(sync_id, 'modified', key, info['remote']['name'],
                                  info['remote']['folder'],
                                  old_hash=info['local']['hash'],
                                  new_hash=info['remote']['hash'])

        # 如果不是dry_run，执行同步和向量更新
        if not dry_run:
            # 执行文件同步
            sync_success = self.sync_files(diff, report)

            # 触发向量数据库更新
            if sync_success:
                self.trigger_embedding_update(report)

        logger.info("同步完成!")
        return {
            'status': 'success',
            'sync_id': sync_id,
            'report': report,
            'dry_run': dry_run
        }


def main():
    import argparse

    parser = argparse.ArgumentParser(description='SOP文件同步工具')
    parser.add_argument('--sync', action='store_true', help='执行实际同步（默认只检查差异）')
    parser.add_argument('--hash', action='store_true', help='使用哈希比较（慢但精确，默认使用文件大小比较）')
    parser.add_argument('--history', action='store_true', help='查看同步历史')
    parser.add_argument('--last', action='store_true', help='查看上次同步详情')

    args = parser.parse_args()

    sync = SOPSync()

    if args.history:
        # 查看历史
        db = SyncDatabase(CONFIG['db_path'])
        conn = sqlite3.connect(CONFIG['db_path'])
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sync_history ORDER BY id DESC LIMIT 10')
        rows = cursor.fetchall()
        conn.close()

        print("\n最近10次同步记录:")
        print("-" * 80)
        for row in rows:
            print(f"ID: {row[0]} | 时间: {row[1]} | 状态: {row[2]} | 新增: {row[3]} | 删除: {row[4]} | 修改: {row[5]}")

    elif args.last:
        # 查看上次详情
        db = SyncDatabase(CONFIG['db_path'])
        last = db.get_last_sync()
        if last:
            print(f"\n上次同步 (ID: {last['id']}):")
            print(f"时间: {last['sync_time']}")
            print(f"状态: {last['status']}")
            print(f"新增: {last['added_count']}, 删除: {last['removed_count']}, 修改: {last['modified_count']}")
            if last['details']:
                print("\n详细报告:")
                print(json.dumps(last['details'], ensure_ascii=False, indent=2))
        else:
            print("没有同步记录")

    else:
        # 执行同步检查
        use_hash = getattr(args, 'hash', False)
        result = sync.run(dry_run=not args.sync, use_hash=use_hash)

        if result['status'] == 'failed':
            sys.exit(1)

        # 返回报告JSON（可用于其他脚本调用）
        print("\nJSON报告:")
        print(json.dumps(result['report'], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
