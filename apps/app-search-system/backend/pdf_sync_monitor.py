#!/usr/bin/env python3
"""
SOP PDF监控同步脚本
- 监控公盘PDF原文件目录
- 检测新增/修改PDF时：在本地拆分图片、生成embedding、更新Chroma
- 检测删除时：清理本地图片和向量库数据
- 原文件保留在公盘，本地只保存处理后的图片
"""

import os
import sys
import json
import sqlite3
import fitz
import base64
import chromadb
import hashlib
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
import logging
from dashscope import MultiModalConversation, TextEmbedding
import dashscope


# ============== PyInstaller 兼容路径处理 ==============
def get_base_dir():
    """获取基础目录，兼容开发环境和打包环境

    - 开发环境：返回脚本所在目录
    - 打包环境：返回 PyInstaller 临时解压目录（用于只读资源）
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后
        return sys._MEIPASS
    else:
        # 开发环境
        return os.path.dirname(os.path.abspath(__file__))


def get_data_dir():
    """获取数据目录（exe 或脚本所在目录）"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return get_base_dir()

# 全局路径常量
BASE_DIR = get_base_dir()
DATA_DIR = get_data_dir()

def find_config():
    """查找配置文件，优先从 exe 同目录，其次 _internal，最后用户数据目录"""
    # 用户数据目录（优先级最高，方便用户修改）
    user_data_dir = os.path.join(os.path.expandvars("%LOCALAPPDATA%"), "SOP Server")
    user_config = os.path.join(user_data_dir, "config.json")
    if os.path.exists(user_config):
        return user_config

    # exe 同目录
    exe_dir = DATA_DIR
    config_in_exe_dir = os.path.join(exe_dir, "config.json")
    if os.path.exists(config_in_exe_dir):
        return config_in_exe_dir

    # _internal 目录（打包后的内置资源）
    internal_dir = os.path.join(exe_dir, "_internal") if getattr(sys, 'frozen', False) else exe_dir
    config_in_internal = os.path.join(internal_dir, "config.json")
    if os.path.exists(config_in_internal):
        return config_in_internal

    # 默认返回用户数据目录（即使不存在，也让用户知道应该放哪里）
    return user_config

# 运行时目录
RUNTIME_IMAGES_DIR = os.path.join(DATA_DIR, "pdf_images")
RUNTIME_CHROMA_DIR = os.path.join(DATA_DIR, "chroma_db")
RUNTIME_SYNC_DB = os.path.join(DATA_DIR, "pdf_sync_state.db")
# 日志写入用户目录，避免 Program Files 权限问题
RUNTIME_LOG_DIR = os.path.join(os.path.expandvars("%LOCALAPPDATA%"), "SOP Server", "logs")

# 加载配置
def load_config():
    config_file = find_config()
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

_config = load_config()

CONFIG = {
    # 公盘PDF源目录（只读取，不修改）
    "source_dir": _config.get("pdf_sync", {}).get(
        "source_dir",
        r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)"
    ),

    # 图片输出目录：优先本地 pdf_images（网络路径不可访问时自动 fallback）
    "images_dir": RUNTIME_IMAGES_DIR,

    # Chroma向量库目录
    "chroma_dir": RUNTIME_CHROMA_DIR,
    "collection_name": _config.get("pdf_sync", {}).get("collection_name", "sop_pages"),

    # 同步状态数据库
    "sync_db_path": RUNTIME_SYNC_DB,

    # 日志目录
    "log_dir": RUNTIME_LOG_DIR,

    # API配置 - 兼容扁平格式 dashscope_api_key 和嵌套格式 dashscope.api_key
    "dashscope_api_key": _config.get("dashscope_api_key") or _config.get("dashscope", {}).get("api_key", ""),
}

# 设置API Key
if CONFIG["dashscope_api_key"]:
    dashscope.api_key = CONFIG["dashscope_api_key"]
else:
    print("警告: 未配置 dashscope API Key，请在 config.json 中设置")

# ============== 日志设置 ==============
def setup_logging():
    log_dir = Path(CONFIG["log_dir"])
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"pdf_sync_{datetime.now().strftime('%Y%m%d')}.log"

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


# ============== 同步状态数据库 ==============
class SyncStateDB:
    """PDF同步状态管理"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # PDF文件状态表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pdf_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pdf_path TEXT NOT NULL UNIQUE,
                pdf_name TEXT NOT NULL,
                file_hash TEXT,
                file_size INTEGER,
                last_modified TEXT,
                page_count INTEGER,
                sync_time TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active'
            )
        ''')

        # 图片页面索引表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pdf_id INTEGER NOT NULL,
                page_num INTEGER NOT NULL,
                job_name TEXT,
                image_path TEXT NOT NULL,
                doc_id TEXT NOT NULL UNIQUE,
                FOREIGN KEY (pdf_id) REFERENCES pdf_files(id) ON DELETE CASCADE
            )
        ''')

        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pdf_path ON pdf_files(pdf_path)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pdf_id ON page_index(pdf_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_doc_id ON page_index(doc_id)')

        conn.commit()
        conn.close()

    def get_all_pdf_paths(self) -> Set[str]:
        """获取所有已同步的PDF路径"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT pdf_path FROM pdf_files WHERE status = 'active'")
        rows = cursor.fetchall()
        conn.close()
        return {row[0] for row in rows}

    def get_pdf_info(self, pdf_path: str) -> Optional[dict]:
        """获取PDF信息"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pdf_files WHERE pdf_path = ? AND status = 'active'", (pdf_path,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'id': row[0],
                'pdf_path': row[1],
                'pdf_name': row[2],
                'file_hash': row[3],
                'file_size': row[4],
                'last_modified': row[5],
                'page_count': row[6],
                'sync_time': row[7],
                'status': row[8]
            }
        return None

    def get_pdf_page_ids(self, pdf_id: int) -> List[str]:
        """获取PDF的所有页面doc_id"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT doc_id FROM page_index WHERE pdf_id = ?", (pdf_id,))
        rows = cursor.fetchall()
        conn.close()
        return [row[0] for row in rows]

    def add_pdf(self, pdf_path: str, pdf_name: str, file_hash: str, file_size: int,
                last_modified: str, page_count: int) -> int:
        """添加PDF记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO pdf_files (pdf_path, pdf_name, file_hash, file_size, last_modified, page_count, sync_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        ''', (pdf_path, pdf_name, file_hash, file_size, last_modified, page_count, datetime.now().isoformat()))
        pdf_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return pdf_id

    def update_pdf(self, pdf_path: str, file_hash: str, file_size: int,
                   last_modified: str, page_count: int) -> int:
        """更新PDF记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE pdf_files
            SET file_hash = ?, file_size = ?, last_modified = ?, page_count = ?, sync_time = ?
            WHERE pdf_path = ? AND status = 'active'
        ''', (file_hash, file_size, last_modified, page_count, datetime.now().isoformat(), pdf_path))
        pdf_id = cursor.execute("SELECT id FROM pdf_files WHERE pdf_path = ?", (pdf_path,)).fetchone()[0]
        conn.commit()
        conn.close()
        return pdf_id

    def mark_pdf_deleted(self, pdf_path: str):
        """标记PDF为已删除"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE pdf_files SET status = 'deleted' WHERE pdf_path = ?", (pdf_path,))
        conn.commit()
        conn.close()

    def add_page(self, pdf_id: int, page_num: int, job_name: str, image_path: str, doc_id: str):
        """添加页面记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO page_index (pdf_id, page_num, job_name, image_path, doc_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (pdf_id, page_num, job_name, image_path, doc_id))
        conn.commit()
        conn.close()

    def delete_pages_by_pdf(self, pdf_id: int):
        """删除PDF的所有页面记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM page_index WHERE pdf_id = ?", (pdf_id,))
        conn.commit()
        conn.close()

    def get_stats(self) -> dict:
        """获取统计信息"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM pdf_files WHERE status = 'active'")
        pdf_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM page_index")
        page_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(DISTINCT job_name) FROM page_index WHERE job_name IS NOT NULL")
        job_count = cursor.fetchone()[0]
        conn.close()
        return {
            'total_pdfs': pdf_count,
            'total_pages': page_count,
            'unique_jobs': job_count
        }


# ============== PDF处理类 ==============
class PDFProcessor:
    """PDF处理：拆分、识别、存储"""

    def __init__(self, images_dir: str):
        self.images_dir = Path(images_dir)
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def calculate_file_hash(self, file_path: str, chunk_size: int = 65536) -> str:
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

    def fast_file_info(self, file_path: str) -> dict:
        """快速获取文件信息（不含hash，用于扫描阶段）"""
        path = Path(file_path)
        stat = path.stat()
        return {
            'path': str(file_path),
            'name': path.name,
            'size': stat.st_size,
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'hash': ""
        }

    def get_file_info(self, file_path: str) -> dict:
        """获取文件信息（含完整hash，用于处理阶段）"""
        path = Path(file_path)
        stat = path.stat()
        return {
            'path': str(file_path),
            'name': path.name,
            'size': stat.st_size,
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'hash': self.calculate_file_hash(file_path)
        }

    def pdf_page_to_image(self, pdf_path: str, page_num: int, max_size_kb: int = 3000) -> bytes:
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

    def recognize_job_name(self, image_bytes: bytes) -> str:
        """视觉识别作业名称"""
        try:
            img_base64 = base64.b64encode(image_bytes).decode('utf-8')

            messages = [{
                "role": "user",
                "content": [
                    {"image": f"data:image/jpeg;base64,{img_base64}"},
                    {"text": """这是SOP页面。【作业名称】字段在页眉表格中。
- 有作业名称返回该值（如PA2720）
- 封面/目录/修订历史返回"__NO_JOB__"
只返回值。"""}
                ]
            }]

            response = MultiModalConversation.call(model='qwen3-omni-flash-2025-12-01', messages=messages)

            if response.status_code == 200:
                content = response.output.choices[0].message.content
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and 'text' in item:
                            return item['text'].strip()
                return content.strip() if content else "__NO_JOB__"
            return "__NO_JOB__"
        except Exception as e:
            logger.error(f"识别作业名称失败: {e}")
            return "__NO_JOB__"

    def get_text_embedding(self, text: str) -> list:
        """获取文本embedding"""
        try:
            resp = TextEmbedding.call(model='text-embedding-v3', input=[text])
            if resp.status_code == 200:
                return resp.output['embeddings'][0]['embedding']
            else:
                raise Exception(f"Embedding失败: {resp.code}")
        except Exception as e:
            logger.error(f"获取embedding失败: {e}")
            raise

    def generate_doc_id(self, pdf_name: str, page_num: int) -> str:
        """生成唯一doc_id"""
        safe_name = "".join(c for c in pdf_name if c.isalnum() or c in ' -_')
        return f"{safe_name}_page{page_num}"

    def generate_image_filename(self, pdf_name: str, page_num: int, job_name: str = None) -> str:
        """生成图片文件名"""
        safe_name = "".join(c for c in Path(pdf_name).stem if c.isalnum() or c in ' -_')
        if job_name and job_name != "__NO_JOB__":
            return f"{safe_name}_p{page_num}_{job_name}.jpg"
        return f"{safe_name}_p{page_num}.jpg"


# ============== Chroma管理类 ==============
class ChromaManager:
    """Chroma向量库管理"""

    def __init__(self, chroma_dir: str, collection_name: str):
        self.client = chromadb.PersistentClient(path=chroma_dir)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "SOP页面索引"}
        )

    def upsert_pages(self, pages: List[dict]):
        """批量插入/更新页面"""
        if not pages:
            return

        ids = []
        embeddings = []
        metadatas = []
        documents = []

        for page in pages:
            ids.append(page['doc_id'])
            embeddings.append(page['embedding'])
            metadatas.append({
                "job_name": page['job_name'],
                "pdf_path": page['pdf_path'],
                "page_num": page['page_num'],
                "image_path": page['image_path']
            })
            documents.append(page['job_name'])

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents
        )

    def delete_pages(self, doc_ids: List[str]):
        """删除页面"""
        if doc_ids:
            self.collection.delete(ids=doc_ids)

    def get_stats(self) -> dict:
        """获取统计"""
        return {
            "total_pages": self.collection.count()
        }


# ============== 主同步类 ==============
class SOPPDFSync:
    """SOP PDF同步主控制器"""

    def __init__(self):
        self.state_db = SyncStateDB(CONFIG["sync_db_path"])
        self.processor = PDFProcessor(CONFIG["images_dir"])
        self.chroma = ChromaManager(CONFIG["chroma_dir"], CONFIG["collection_name"])

    def scan_source_pdfs(self) -> Dict[str, dict]:
        """扫描源目录所有PDF（快速模式，不计算hash）"""
        pdfs = {}
        # Windows UNC路径需要正斜杠，Path才能正常工作
        source_path_str = CONFIG["source_dir"].replace("\\", "/")
        source_dir = Path(source_path_str)

        if not source_dir.exists():
            logger.error(f"源目录不存在: {source_dir}")
            return pdfs

        logger.info(f"扫描源目录: {source_dir}")

        for pdf_path in source_dir.rglob("*.pdf"):
            try:
                # 快速获取文件信息（跳过hash，网络I/O大幅减少）
                info = self.processor.fast_file_info(str(pdf_path))
                pdfs[info['path']] = info
            except Exception as e:
                logger.error(f"扫描PDF失败 {pdf_path}: {e}")

        logger.info(f"找到 {len(pdfs)} 个PDF文件")
        return pdfs

    def process_pdf(self, pdf_path: str, pdf_info: dict) -> Tuple[int, int]:
        """处理单个PDF：拆分、识别、索引

        Returns:
            (indexed_count, skipped_count)
        """
        # 扫描阶段可能没有hash，补算
        if not pdf_info.get('hash'):
            pdf_info['hash'] = self.processor.calculate_file_hash(pdf_path)

        logger.info(f"处理PDF: {pdf_info['name']}")

        try:
            # 打开PDF获取页数
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()

            # 检查是否已存在且未修改
            existing = self.state_db.get_pdf_info(pdf_path)
            if existing and existing['file_hash'] == pdf_info['hash']:
                logger.info(f"  文件未变化，跳过")
                return 0, 0

            if existing:
                # 文件已修改，先清理旧数据
                logger.info(f"  检测到文件修改，重新处理...")
                old_page_ids = self.state_db.get_pdf_page_ids(existing['id'])
                self.chroma.delete_pages(old_page_ids)
                self.state_db.delete_pages_by_pdf(existing['id'])
                self._delete_local_images(existing['id'])

                # 更新PDF记录
                pdf_id = self.state_db.update_pdf(
                    pdf_path, pdf_info['hash'], pdf_info['size'],
                    pdf_info['modified'], page_count
                )
            else:
                # 新PDF
                pdf_id = self.state_db.add_pdf(
                    pdf_path, pdf_info['name'], pdf_info['hash'],
                    pdf_info['size'], pdf_info['modified'], page_count
                )

            # 处理每一页
            indexed_count = 0
            skipped_count = 0
            pages_to_index = []

            for page_num in range(page_count):
                try:
                    # 转换为图片
                    img_bytes = self.processor.pdf_page_to_image(pdf_path, page_num)

                    # 识别作业名称
                    job_name = self.processor.recognize_job_name(img_bytes)

                    if job_name == "__NO_JOB__":
                        logger.info(f"  页{page_num + 1}: [跳过] 无作业名称")
                        skipped_count += 1
                        continue

                    # 保存图片
                    img_filename = self.processor.generate_image_filename(
                        pdf_info['name'], page_num + 1, job_name
                    )
                    img_path = str(self.processor.images_dir / img_filename)
                    with open(img_path, 'wb') as f:
                        f.write(img_bytes)

                    # 生成doc_id
                    doc_id = self.processor.generate_doc_id(pdf_info['name'], page_num + 1)

                    # 获取embedding
                    text_for_embedding = f"作业名称: {job_name}"
                    embedding = self.processor.get_text_embedding(text_for_embedding)

                    # 记录页面
                    self.state_db.add_page(pdf_id, page_num + 1, job_name, img_path, doc_id)

                    pages_to_index.append({
                        'doc_id': doc_id,
                        'embedding': embedding,
                        'job_name': job_name,
                        'pdf_path': pdf_path,
                        'page_num': page_num + 1,
                        'image_path': img_path
                    })

                    logger.info(f"  页{page_num + 1}: {job_name}")
                    indexed_count += 1

                    # 批量写入Chroma
                    if len(pages_to_index) >= 20:
                        self.chroma.upsert_pages(pages_to_index)
                        pages_to_index = []

                except Exception as e:
                    logger.error(f"  页{page_num + 1} 处理失败: {e}")
                    skipped_count += 1

            # 写入剩余页面
            if pages_to_index:
                self.chroma.upsert_pages(pages_to_index)

            return indexed_count, skipped_count

        except Exception as e:
            logger.error(f"处理PDF失败 {pdf_path}: {e}")
            return 0, 0

    def _delete_local_images(self, pdf_id: int):
        """删除PDF对应的本地图片"""
        conn = sqlite3.connect(CONFIG["sync_db_path"])
        cursor = conn.cursor()
        cursor.execute("SELECT image_path FROM page_index WHERE pdf_id = ?", (pdf_id,))
        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            img_path = Path(row[0])
            if img_path.exists():
                try:
                    img_path.unlink()
                    logger.debug(f"删除图片: {img_path}")
                except Exception as e:
                    logger.warning(f"删除图片失败 {img_path}: {e}")

    def delete_pdf(self, pdf_path: str):
        """删除PDF相关数据"""
        logger.info(f"删除PDF: {pdf_path}")

        existing = self.state_db.get_pdf_info(pdf_path)
        if not existing:
            logger.info(f"  PDF未在索引中，跳过")
            return

        # 删除Chroma中的向量
        page_ids = self.state_db.get_pdf_page_ids(existing['id'])
        self.chroma.delete_pages(page_ids)

        # 删除本地图片
        self._delete_local_images(existing['id'])

        # 删除数据库记录
        self.state_db.delete_pages_by_pdf(existing['id'])
        self.state_db.mark_pdf_deleted(pdf_path)

        logger.info(f"  已删除 {len(page_ids)} 个页面")

    def run(self, dry_run: bool = False) -> dict:
        """执行同步

        Args:
            dry_run: 仅检查差异，不执行处理
        """
        logger.info("=" * 60)
        logger.info("开始PDF同步")
        logger.info(f"源目录: {CONFIG['source_dir']}")
        logger.info(f"图片目录: {CONFIG['images_dir']}")
        logger.info(f"模式: {'检查模式' if dry_run else '执行模式'}")
        logger.info("=" * 60)

        # 扫描源目录
        source_pdfs = self.scan_source_pdfs()
        source_paths = set(source_pdfs.keys())

        # 获取已同步的PDF
        synced_paths = self.state_db.get_all_pdf_paths()

        # 计算差异
        added_paths = source_paths - synced_paths
        deleted_paths = synced_paths - source_paths
        common_paths = source_paths & synced_paths

        # 检查修改的文件（扫描阶段无hash，仅比较文件大小）
        modified_paths = set()
        for path in common_paths:
            synced_info = self.state_db.get_pdf_info(path)
            source_info = source_pdfs[path]
            if synced_info['file_size'] != source_info['size']:
                modified_paths.add(path)

        # 统计
        stats = {
            'added': len(added_paths),
            'deleted': len(deleted_paths),
            'modified': len(modified_paths),
            'unchanged': len(common_paths) - len(modified_paths),
            'indexed_pages': 0,
            'skipped_pages': 0,
            'deleted_pages': 0
        }

        logger.info(f"\n差异报告:")
        logger.info(f"  新增: {stats['added']} 个")
        logger.info(f"  删除: {stats['deleted']} 个")
        logger.info(f"  修改: {stats['modified']} 个")
        logger.info(f"  未变: {stats['unchanged']} 个")

        if dry_run:
            logger.info("\n[检查模式] 不执行实际操作")
            return stats

        # 处理新增和修改的PDF（多线程并行）
        to_process = sorted(added_paths) + sorted(modified_paths)
        if to_process:
            max_workers = min(8, len(to_process))
            logger.info(f"\n并行处理 {len(to_process)} 个PDF（{max_workers} 线程）")

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(self.process_pdf, path, source_pdfs[path]): path
                    for path in to_process
                }
                for i, future in enumerate(as_completed(futures), 1):
                    path = futures[future]
                    try:
                        indexed, skipped = future.result()
                        stats['indexed_pages'] += indexed
                        stats['skipped_pages'] += skipped
                        logger.info(f"[{i}/{len(to_process)}] 完成: {Path(path).name}")
                    except Exception as e:
                        logger.error(f"[{i}/{len(to_process)}] 失败: {Path(path).name} - {e}")

        # 处理删除的PDF
        for i, path in enumerate(sorted(deleted_paths)):
            logger.info(f"\n[{i+1}/{stats['deleted']}] 处理删除PDF")
            self.delete_pdf(path)

        # 最终统计
        db_stats = self.state_db.get_stats()
        chroma_stats = self.chroma.get_stats()

        logger.info("\n" + "=" * 60)
        logger.info("同步完成!")
        logger.info(f"  本次新增索引: {stats['indexed_pages']} 页")
        logger.info(f"  本次跳过: {stats['skipped_pages']} 页")
        logger.info(f"  本次删除: {stats['deleted']} 个PDF")
        logger.info(f"  当前总PDF数: {db_stats['total_pdfs']}")
        logger.info(f"  当前总页数: {db_stats['total_pages']}")
        logger.info(f"  当前作业数: {db_stats['unique_jobs']}")
        logger.info("=" * 60)

        return stats


# ============== 命令行入口 ==============
def main():
    import argparse

    parser = argparse.ArgumentParser(description='SOP PDF监控同步工具')
    parser.add_argument('--sync', action='store_true', help='执行实际同步（默认只检查）')
    parser.add_argument('--stats', action='store_true', help='查看当前统计')
    parser.add_argument('--watch', action='store_true', help='持续监控模式（每小时检查）')

    args = parser.parse_args()

    sync = SOPPDFSync()

    if args.stats:
        db_stats = sync.state_db.get_stats()
        chroma_stats = sync.chroma.get_stats()
        print(f"\n当前状态:")
        print(f"  PDF文件: {db_stats['total_pdfs']}")
        print(f"  索引页面: {db_stats['total_pages']}")
        print(f"  作业名称: {db_stats['unique_jobs']}")
        print(f"  Chroma页面: {chroma_stats['total_pages']}")
        return

    if args.watch:
        import time
        logger.info("启动持续监控模式，每小时检查一次...")
        while True:
            try:
                sync.run(dry_run=False)
            except Exception as e:
                logger.error(f"同步出错: {e}")
            logger.info("\n下次检查: 1小时后")
            time.sleep(3600)

    # 执行同步
    sync.run(dry_run=not args.sync)


if __name__ == "__main__":
    main()