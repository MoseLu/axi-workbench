#!/usr/bin/env python3
"""
SOP 系统数据模型
- SQLite 数据库（位于统一运行时数据目录）
- 用户表：管理员登录
- 设备表：展示端注册
- 命令表：离线命令持久化
"""
import sqlite3
import os
import sys
import json
import uuid as uuid_lib
import hashlib
import secrets
import string
import re
from datetime import datetime
from contextlib import contextmanager
from runtime_paths import get_runtime_data_dir

# ============== 路径处理 ==============
def get_data_dir():
    """获取统一运行时数据目录。"""
    return os.fspath(get_runtime_data_dir())

DATA_DIR = get_data_dir()
DB_PATH = os.path.join(DATA_DIR, "sop.db")


# ============== 数据库连接 ==============
@contextmanager
def get_db():
    """数据库连接上下文管理器"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL')    # 启用 WAL：允许读写并发，消除写操作对读操作的阻塞
    conn.execute('PRAGMA synchronous=NORMAL')  # 平衡崩溃安全与写入性能
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ============== 数据库初始化 ==============
def init_db():
    """初始化数据库表"""
    os.makedirs(DATA_DIR, exist_ok=True)

    with get_db() as conn:
        cursor = conn.cursor()

        # 用户表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                must_change_password INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 设备表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                display_name TEXT,
                sequence_num TEXT,
                device_group TEXT DEFAULT '',
                status TEXT DEFAULT 'offline',
                last_seen TIMESTAMP,
                assigned_job TEXT DEFAULT '',
                device_info TEXT DEFAULT '{}',
                current_job TEXT DEFAULT '',
                current_image TEXT DEFAULT '',
                latitude REAL,
                longitude REAL,
                location_updated_at TIMESTAMP,
                ip_address TEXT DEFAULT '',
                device_password TEXT DEFAULT '',
                login_status TEXT DEFAULT '',
                password_hint TEXT DEFAULT '',
                current_command_type TEXT DEFAULT '',
                current_payload TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 迁移：新增 device_group 字段（已有表不会重建，用 ALTER TABLE）
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN device_group TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.device_group 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增 GPS 定位字段
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN latitude REAL")
            cursor.execute("ALTER TABLE devices ADD COLUMN longitude REAL")
            cursor.execute("ALTER TABLE devices ADD COLUMN location_updated_at TIMESTAMP")
            print("[DB] 已迁移: devices.latitude/longitude/location_updated_at 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增 IP 地址字段
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN ip_address TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.ip_address 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增设备密码字段（展示端登录用，统一初始密码 123456）
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN device_password TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.device_password 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增登录状态字段（展示端登录后设为 logged_in，退出登录时清空）
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN login_status TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.login_status 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增明文密码提示字段（管理员可查看设备密码）
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN password_hint TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.password_hint 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增当前展示命令类型
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN current_command_type TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.current_command_type 字段")
        except Exception:
            pass  # 字段已存在

        # 迁移：新增当前展示载荷（用于断线恢复整份 SOP）
        try:
            cursor.execute("ALTER TABLE devices ADD COLUMN current_payload TEXT DEFAULT ''")
            print("[DB] 已迁移: devices.current_payload 字段")
        except Exception:
            pass  # 字段已存在

        # 命令表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id INTEGER NOT NULL,
                command_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                sent_at TIMESTAMP,
                acknowledged_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
            )
        ''')

        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_devices_uuid ON devices(uuid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(device_group)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_commands_device_id ON commands(device_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status)')

        # 回填历史数据：若设备编号是 LineX-Y 且产线为空，则自动补成 LineX
        cursor.execute('''
            SELECT id, sequence_num
            FROM devices
            WHERE TRIM(COALESCE(device_group, '')) = ''
              AND TRIM(COALESCE(sequence_num, '')) != ''
        ''')
        backfilled_groups = 0
        for row in cursor.fetchall():
            inferred_group = infer_device_group_from_sequence(row['sequence_num'])
            if not inferred_group:
                continue
            cursor.execute(
                'UPDATE devices SET device_group = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (inferred_group, row['id'])
            )
            backfilled_groups += 1
        if backfilled_groups:
            print(f"[DB] 已按设备编号回填 {backfilled_groups} 台设备的产线分组")

        # 创建默认管理员账号
        cursor.execute('SELECT COUNT(*) FROM users WHERE username = ?', ('admin',))
        if cursor.fetchone()[0] == 0:
            admin_password = generate_random_password()
            password_hash = hash_password(admin_password)
            cursor.execute('''
                INSERT INTO users (username, password_hash, role, must_change_password)
                VALUES (?, ?, 'admin', 1)
            ''', ('admin', password_hash))
            print(f"[DB] 默认管理员账号已创建: admin / {admin_password}")
            print("[DB] 请首次登录后修改密码！")
            return admin_password  # 返回密码供调用方显示
        return None


# ============== 密码处理 ==============
def generate_random_password(length: int = 16) -> str:
    """生成随机密码（由字母和数字组成）"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def hash_password(password: str) -> str:
    """密码哈希"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """验证密码"""
    return hash_password(password) == password_hash


def derive_device_status(status: str = '', login_status: str = '') -> str:
    """根据原始状态字段推导设备真实状态。"""
    normalized = (status or '').strip().lower()
    normalized_login = (login_status or '').strip().lower()

    if normalized == 'offline':
        return 'offline'
    if normalized == 'logged_in' or normalized_login == 'logged_in':
        return 'logged_in'
    if normalized == 'online':
        return 'online'
    return 'offline'


def is_unregistered_device_row(device: dict | None) -> bool:
    """未分配设备编号的记录视为未注册设备。"""
    if not device:
        return True
    return not (device.get('sequence_num') or '').strip()


def is_placeholder_uuid(uuid_value: str = '') -> bool:
    """中控端预创建设备位时使用占位 UUID，首次登录后再绑定真实设备 UUID。"""
    return (uuid_value or '').startswith('pending:')


def generate_placeholder_uuid() -> str:
    return f"pending:{uuid_lib.uuid4().hex}"


def normalize_device_row(row) -> dict | None:
    """将 sqlite row 规范化为前端可直接消费的设备对象。"""
    if not row:
        return None
    d = dict(row)
    d['assigned_jobs'] = d.get('assigned_job', '')
    d['device_info'] = json.loads(d.get('device_info') or '{}')
    d['status'] = derive_device_status(d.get('status', ''), d.get('login_status', ''))
    return d


def infer_device_group_from_sequence(sequence_num: str = '') -> str:
    """从设备编号推断产线，如 Line1-02 -> Line1。"""
    match = re.fullmatch(r'Line(\d+)-\d+', (sequence_num or '').strip(), flags=re.IGNORECASE)
    if not match:
        return ''
    return f"Line{int(match.group(1))}"


def resolve_device_group(sequence_num: str = '', device_group: str | None = '') -> str:
    """优先使用手动填写的产线，否则尝试从设备编号自动推断。"""
    manual_group = (device_group or '').strip()
    if manual_group:
        return manual_group
    return infer_device_group_from_sequence(sequence_num)


# ============== 用户操作 ==============
def create_user(username: str, password: str, role: str = 'admin') -> int:
    """创建用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        password_hash = hash_password(password)
        cursor.execute('''
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, ?)
        ''', (username, password_hash, role))
        return cursor.lastrowid


def get_user_by_username(username: str) -> dict:
    """根据用户名获取用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict:
    """根据ID获取用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_user_password(user_id: int, new_password: str):
    """更新用户密码"""
    with get_db() as conn:
        cursor = conn.cursor()
        password_hash = hash_password(new_password)
        cursor.execute('''
            UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?
        ''', (password_hash, user_id))


def list_users() -> list:
    """列出所有用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, role, must_change_password, created_at FROM users ORDER BY id')
        return [dict(row) for row in cursor.fetchall()]


def delete_user(user_id: int):
    """删除用户（不能删除自己）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM users WHERE id = ? AND role != ?', (user_id, 'admin'))
        return cursor.rowcount > 0


# ============== 设备操作 ==============
def register_device(uuid: str, display_name: str = '', device_info: dict = None, old_uuid: str = None, ip_address: str = '', device_password: str = '') -> dict:
    """
    注册设备（首次启动时调用）。

    自动去重逻辑：
    - 如果传入了 old_uuid 且与 uuid 不同，先合并旧记录（APK 升级场景）
    - 如果 uuid 已存在（无论 online/offline），都更新为 online 并刷新时间
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # APK 升级：旧随机 UUID → 新原生 ID，自动合并
        if old_uuid and old_uuid != uuid:
            migrate_device_uuid(old_uuid, uuid)

        # 检查目标 UUID 是否已存在
        cursor.execute('SELECT * FROM devices WHERE uuid = ?', (uuid,))
        existing = cursor.fetchone()

        if existing:
            # UUID 已存在：设备重新上线，更新为 online，刷新时间
            # 注意：旧的 SSE ConnectionContext 占着 sse_manager 里的旧连接，
            #       会在下次发消息时发现队列已被新连接替换而自行断开
            cursor.execute('''
                UPDATE devices SET
                    status = CASE
                        WHEN login_status = 'logged_in' THEN 'logged_in'
                        ELSE 'online'
                    END,
                    last_seen = CURRENT_TIMESTAMP,
                    device_info = ?,
                    display_name = COALESCE(NULLIF(?, ''), display_name),
                    ip_address = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE uuid = ?
            ''', (json.dumps(device_info or {}), display_name, ip_address, uuid))
            cursor.execute('SELECT * FROM devices WHERE uuid = ?', (uuid,))
            return normalize_device_row(cursor.fetchone())

        # 新设备：插入并返回
        password_hash = hash_password(device_password) if device_password else hash_password('123456')
        cursor.execute('''
            INSERT INTO devices (uuid, display_name, status, last_seen, device_info, ip_address, device_password)
            VALUES (?, ?, 'online', CURRENT_TIMESTAMP, ?, ?, ?)
        ''', (uuid, display_name or f'设备_{uuid[:8]}', json.dumps(device_info or {}), ip_address, password_hash))
        device_id = cursor.lastrowid
        cursor.execute('SELECT * FROM devices WHERE id = ?', (device_id,))
        return normalize_device_row(cursor.fetchone())


def create_device_slot(sequence_num: str, device_password: str = '123456', display_name: str = '',
                       device_group: str = '', assigned_job: str = '') -> dict:
    """中控端预创建设备位，首次登录时再绑定真实设备 UUID。"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM devices WHERE LOWER(sequence_num) = LOWER(?)', (sequence_num,))
        if cursor.fetchone():
            raise ValueError('设备编号已存在')

        placeholder_uuid = generate_placeholder_uuid()
        display_label = display_name.strip() if display_name and display_name.strip() else sequence_num
        password_value = (device_password or '123456').strip() or '123456'
        resolved_group = resolve_device_group(sequence_num, device_group)
        cursor.execute('''
            INSERT INTO devices (
                uuid, display_name, sequence_num, device_group, assigned_job,
                status, last_seen, device_info, device_password
            )
            VALUES (?, ?, ?, ?, ?, 'offline', NULL, '{}', ?)
        ''', (placeholder_uuid, display_label, sequence_num, resolved_group, assigned_job, password_value))
        device_id = cursor.lastrowid
        cursor.execute('SELECT * FROM devices WHERE id = ?', (device_id,))
        return normalize_device_row(cursor.fetchone())


def create_device_slots_batch(devices: list[dict]) -> list[dict]:
    """批量预创建设备位，用于中控端一次性初始化整批设备。"""
    if not devices:
        return []

    normalized_devices: list[dict] = []
    seen_sequence_nums: set[str] = set()

    for item in devices:
        sequence_num = (item.get('sequence_num') or '').strip()
        if not sequence_num:
            raise ValueError('设备编号不能为空')

        key = sequence_num.lower()
        if key in seen_sequence_nums:
            raise ValueError(f'批量数据中存在重复设备编号: {sequence_num}')
        seen_sequence_nums.add(key)

        normalized_devices.append({
            'sequence_num': sequence_num,
            'display_name': (item.get('display_name') or '').strip(),
            'device_group': resolve_device_group(sequence_num, item.get('device_group')),
            'assigned_job': (item.get('assigned_job') or '').strip(),
            'device_password': (item.get('device_password') or '123456').strip() or '123456',
        })

    with get_db() as conn:
        cursor = conn.cursor()

        placeholders = ','.join('?' * len(normalized_devices))
        cursor.execute(
            f"SELECT sequence_num FROM devices WHERE LOWER(sequence_num) IN ({placeholders})",
            [item['sequence_num'].lower() for item in normalized_devices]
        )
        existing = [row['sequence_num'] for row in cursor.fetchall()]
        if existing:
            existing_preview = '、'.join(existing[:10])
            if len(existing) > 10:
                existing_preview += ' 等'
            raise ValueError(f'以下设备编号已存在: {existing_preview}')

        created_ids: list[int] = []
        for item in normalized_devices:
            placeholder_uuid = generate_placeholder_uuid()
            display_label = item['display_name'] or item['sequence_num']
            cursor.execute('''
                INSERT INTO devices (
                    uuid, display_name, sequence_num, device_group, assigned_job,
                    status, last_seen, device_info, device_password
                )
                VALUES (?, ?, ?, ?, ?, 'offline', NULL, '{}', ?)
            ''', (
                placeholder_uuid,
                display_label,
                item['sequence_num'],
                item['device_group'],
                item['assigned_job'],
                item['device_password'],
            ))
            created_ids.append(cursor.lastrowid)

        id_placeholders = ','.join('?' * len(created_ids))
        cursor.execute(f'''
            SELECT *
            FROM devices
            WHERE id IN ({id_placeholders})
            ORDER BY device_group, sequence_num, id
        ''', created_ids)
        return [normalize_device_row(row) for row in cursor.fetchall()]


def update_device_heartbeat(uuid: str, ip_address: str = ''):
    """更新设备心跳"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE devices
            SET status = CASE
                    WHEN login_status = 'logged_in' THEN 'logged_in'
                    ELSE 'online'
                END,
                last_seen = CURRENT_TIMESTAMP,
                ip_address = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (ip_address, uuid))


def batch_update_heartbeat(uuids: list):
    """批量更新多台设备的心跳时间（由 SSE 管理器的批量刷新线程调用，替代 N 次独立写入）"""
    if not uuids:
        return
    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(uuids))
        cursor.execute(
            f"UPDATE devices "
            f"SET status = CASE "
            f"        WHEN login_status = 'logged_in' THEN 'logged_in' "
            f"        ELSE 'online' "
            f"    END, "
            f"    last_seen=CURRENT_TIMESTAMP, "
            f"    updated_at=CURRENT_TIMESTAMP "
            f"WHERE uuid IN ({placeholders})",
            uuids
        )


def cleanup_stale_devices(timeout_minutes: int = 2):
    """
    清理超时离线的设备。

    设备心跳间隔约 30 秒，2 分钟无心跳说明展示端已断开。
    被清理的设备会统一回到 offline，并清空登录态。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE devices
            SET status = 'offline',
                login_status = '',
                updated_at = CURRENT_TIMESTAMP
            WHERE status != 'offline'
              AND last_seen < datetime('now', '-' || ? || ' minutes')
        ''', (timeout_minutes,))
        changed = cursor.rowcount
        if changed > 0:
            print(f"[DB] 清理了 {changed} 个超时离线的设备")
        return changed


def delete_test_devices() -> int:
    """删除测试UUID格式的设备（随机UUID格式，非原生设备ID）

    返回删除的设备数量。
    原生设备UUID通常是固定格式（如华为设备的序列号），测试设备是随机生成的。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # 匹配随机UUID格式：8-4-4-4-12 十六进制
        cursor.execute("SELECT id, uuid FROM devices WHERE uuid GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'")
        test_devices = cursor.fetchall()
        if not test_devices:
            print("[DB] 未发现测试UUID设备")
            return 0

        deleted = 0
        for dev in test_devices:
            cursor.execute('DELETE FROM devices WHERE id = ?', (dev['id'],))
            deleted += 1
            print(f"[DB] 删除测试设备: {dev['uuid']}")
        print(f"[DB] 共删除 {deleted} 个测试设备")
        return deleted


def cleanup_old_devices(days: int = 30) -> int:
    """清理超过指定天数未上线的设备

    - days: 超过多少天未上线则删除
    返回删除的设备数量。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, uuid, last_seen FROM devices
            WHERE status = 'offline'
              AND last_seen < datetime('now', '-' || ? || ' days')
        ''', (days,))
        old_devices = cursor.fetchall()

        if not old_devices:
            print(f"[DB] 未发现超过 {days} 天未上线的设备")
            return 0

        deleted = 0
        for dev in old_devices:
            cursor.execute('DELETE FROM devices WHERE id = ?', (dev['id'],))
            deleted += 1
            print(f"[DB] 删除长期离线设备: {dev['uuid']} (最后seen: {dev['last_seen']})")
        print(f"[DB] 共删除 {deleted} 个长期离线设备")
        return deleted


def cleanup_unregistered_devices(timeout_minutes: int = 30) -> int:
    """清理遗留的未注册设备记录，避免旧版自动注册数据长期残留。"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, uuid, last_seen
            FROM devices
            WHERE TRIM(COALESCE(sequence_num, '')) = ''
              AND (
                  last_seen IS NULL
                  OR last_seen < datetime('now', '-' || ? || ' minutes')
              )
        ''', (timeout_minutes,))
        rows = cursor.fetchall()
        if not rows:
            return 0

        deleted = 0
        for row in rows:
            cursor.execute('DELETE FROM devices WHERE id = ?', (row['id'],))
            deleted += 1
            print(f"[DB] 清理未注册设备: {row['uuid']} (last_seen={row['last_seen']})")
        return deleted


def list_devices(include_offline: bool = False, group: str = None, include_unregistered: bool = False) -> list:
    """列出设备

    - include_offline: 默认只返回非 offline 设备（online + logged_in）
    - include_unregistered: 是否包含未分配设备编号的遗留记录
    - group: 按分组筛选，为空则返回全部分组
    """
    with get_db() as conn:
        cursor = conn.cursor()
        conditions = []
        params = []

        if not include_offline:
            conditions.append("status != 'offline'")
        if not include_unregistered:
            conditions.append("TRIM(COALESCE(sequence_num, '')) != ''")
        if group:
            conditions.append('device_group = ?')
            params.append(group)

        where_clause = ' AND '.join(conditions) if conditions else '1=1'
        cursor.execute(f'''
            SELECT id, uuid, display_name, sequence_num, device_group, status, last_seen,
                   assigned_job, device_info, current_job, current_image, created_at, updated_at,
                   latitude, longitude, location_updated_at, ip_address, login_status,
                   device_password, password_hint, current_command_type, current_payload
            FROM devices WHERE {where_clause} ORDER BY device_group, id DESC
        ''', params)
        rows = cursor.fetchall()
        return [normalize_device_row(row) for row in rows]


def list_device_groups() -> list:
    """返回所有已使用的分组名称（去重）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT DISTINCT device_group FROM devices "
            "WHERE device_group != '' AND TRIM(COALESCE(sequence_num, '')) != '' ORDER BY device_group"
        )
        return [r['device_group'] for r in cursor.fetchall()]


def get_device_by_uuid(uuid: str) -> dict:
    """根据UUID获取设备"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, uuid, display_name, sequence_num, device_group, status, last_seen,
                   assigned_job, device_info, current_job, current_image,
                   latitude, longitude, location_updated_at, ip_address, device_password,
                   created_at, updated_at, login_status, current_command_type, current_payload
            FROM devices WHERE uuid = ?
        ''', (uuid,))
        return normalize_device_row(cursor.fetchone())


def get_device_by_sequence_num(sequence_num: str) -> dict | None:
    """根据设备编号(sequence_num)获取设备，大小写不敏感"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, uuid, display_name, sequence_num, device_group, status, last_seen,
                   assigned_job, device_info, current_job, current_image,
                   latitude, longitude, location_updated_at, ip_address, device_password,
                   created_at, updated_at, login_status, current_command_type, current_payload
            FROM devices WHERE LOWER(sequence_num) = LOWER(?)
        ''', (sequence_num,))
        return normalize_device_row(cursor.fetchone())


def get_devices_by_uuids(uuids: list[str]) -> list[dict]:
    """按 UUID 批量获取设备，并尽量保持传入顺序。"""
    normalized = []
    seen = set()
    for item in uuids or []:
        uuid_value = (item or '').strip()
        if not uuid_value:
            continue
        key = uuid_value.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(uuid_value)

    if not normalized:
        return []

    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(normalized))
        cursor.execute(f'''
            SELECT id, uuid, display_name, sequence_num, device_group, status, last_seen,
                   assigned_job, device_info, current_job, current_image,
                   latitude, longitude, location_updated_at, ip_address, device_password,
                   created_at, updated_at, login_status, current_command_type, current_payload
            FROM devices WHERE uuid IN ({placeholders})
        ''', normalized)
        rows = [normalize_device_row(row) for row in cursor.fetchall()]

    row_map = {(row.get('uuid') or '').lower(): row for row in rows if row}
    return [row_map[item.lower()] for item in normalized if item.lower() in row_map]


def get_devices_by_ids(device_ids: list[int]) -> list[dict]:
    """按 ID 批量获取设备，并尽量保持传入顺序。"""
    normalized = []
    seen = set()
    for item in device_ids or []:
        try:
            device_id = int(item)
        except (TypeError, ValueError):
            continue
        if device_id <= 0 or device_id in seen:
            continue
        seen.add(device_id)
        normalized.append(device_id)

    if not normalized:
        return []

    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(normalized))
        cursor.execute(f'''
            SELECT id, uuid, display_name, sequence_num, device_group, status, last_seen,
                   assigned_job, device_info, current_job, current_image,
                   latitude, longitude, location_updated_at, ip_address, device_password,
                   created_at, updated_at, login_status, current_command_type, current_payload
            FROM devices WHERE id IN ({placeholders})
        ''', normalized)
        rows = [normalize_device_row(row) for row in cursor.fetchall()]

    row_map = {int(row['id']): row for row in rows if row}
    return [row_map[item] for item in normalized if item in row_map]


def authenticate_device(sequence_num: str, password: str) -> dict | None:
    """校验设备编号和密码，不修改设备状态。"""
    device = get_device_by_sequence_num(sequence_num)
    if not device:
        return None
    stored = device.get('device_password', '')
    ok = False
    if not stored:
        # 兼容旧设备（无密码字段）：用默认密码 123456 的哈希
        ok = verify_password(password, hash_password('123456'))
    elif len(stored) == 64 and all(c in '0123456789abcdefABCDEF' for c in stored):
        # 看起来像 SHA256 哈希（旧数据）
        ok = verify_password(password, stored)
    else:
        # 明文密码（管理员设置）
        ok = (password == stored)
    if not ok:
        return None
    safe = {k: v for k, v in device.items() if k != 'device_password'}
    return safe


def device_login(sequence_num: str, password: str) -> dict | None:
    """
    展示端登录：按设备编号 + 密码验证，设置登录状态，返回设备信息。
    支持明文密码（管理员设置的）和 SHA256 哈希密码（向后兼容旧数据）。
    返回 None 表示设备未注册或密码错误。
    """
    device = authenticate_device(sequence_num, password)
    if not device:
        return None
    # 验证通过：更新登录状态和在线状态
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE devices
            SET login_status = 'logged_in',
                status = 'logged_in',
                last_seen = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (device['id'],))
    # 重新获取最新数据
    device = get_device_by_sequence_num(sequence_num)
    safe = {k: v for k, v in device.items() if k != 'device_password'}
    return safe


def bind_device_uuid(sequence_num: str, client_uuid: str) -> dict | None:
    """首次登录时将设备位绑定到真实展示端 UUID。"""
    if not client_uuid:
        return get_device_by_sequence_num(sequence_num)

    device = get_device_by_sequence_num(sequence_num)
    if not device:
        return None

    current_uuid = (device.get('uuid') or '').strip()
    if current_uuid == client_uuid:
        return device
    if current_uuid and not is_placeholder_uuid(current_uuid):
        return None

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM devices WHERE uuid = ? AND id != ?', (client_uuid, device['id']))
        conflict = cursor.fetchone()
        if conflict:
            conflict_device = normalize_device_row(conflict)
            if is_unregistered_device_row(conflict_device):
                cursor.execute('DELETE FROM devices WHERE id = ?', (conflict_device['id'],))
            else:
                return None

        cursor.execute('''
            UPDATE devices
            SET uuid = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (client_uuid, device['id']))

    return get_device_by_sequence_num(sequence_num)


def logout_device(uuid: str) -> bool:
    """展示端退出登录：清除 login_status，回到在线未登录状态。"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE devices
            SET login_status = '',
                status = 'online',
                last_seen = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (uuid,))
        return cursor.rowcount > 0


def update_device(device_id: int, display_name: str = None, sequence_num: str = None,
                  assigned_job: str = None, device_group: str = None,
                  latitude: float = None, longitude: float = None,
                  ip_address: str = None) -> bool:
    """更新设备信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        current_row = None

        if sequence_num is not None or device_group is not None:
            cursor.execute('SELECT sequence_num FROM devices WHERE id = ?', (device_id,))
            current_row = cursor.fetchone()
            if not current_row:
                return False

        if display_name is not None:
            updates.append('display_name = ?')
            params.append(display_name)
        if sequence_num is not None:
            updates.append('sequence_num = ?')
            params.append(sequence_num)
        if assigned_job is not None:
            updates.append('assigned_job = ?')
            params.append(assigned_job)
        if device_group is not None:
            effective_sequence_num = sequence_num if sequence_num is not None else (current_row['sequence_num'] if current_row else '')
            resolved_group = resolve_device_group(effective_sequence_num, device_group)
            updates.append('device_group = ?')
            params.append(resolved_group)
        if latitude is not None:
            updates.append('latitude = ?')
            params.append(latitude)
        if longitude is not None:
            updates.append('longitude = ?')
            params.append(longitude)
        if ip_address is not None:
            updates.append('ip_address = ?')
            params.append(ip_address)

        if not updates:
            return False

        updates.append('updated_at = CURRENT_TIMESTAMP')
        params.append(device_id)

        cursor.execute(f'''
            UPDATE devices SET {", ".join(updates)} WHERE id = ?
        ''', params)
        return cursor.rowcount > 0


def update_device_display(uuid: str, current_job: str = '', current_image: str = '',
                          current_command_type: str = '', current_payload: dict | None = None) -> bool:
    """更新设备当前显示状态（支持整份 SOP 断线恢复）"""
    payload_json = json.dumps(current_payload, ensure_ascii=False) if current_payload else ''
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE devices
            SET current_job = ?, current_image = ?, current_command_type = ?, current_payload = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (current_job, current_image, current_command_type, payload_json, uuid))
        return cursor.rowcount > 0


def batch_update_device_display(uuids: list, current_job: str = '', current_image: str = '',
                                current_command_type: str = '', current_payload: dict | None = None) -> int:
    """批量更新多台设备当前显示状态（广播场景用，单次事务替代 N 次独立事务）"""
    if not uuids:
        return 0
    payload_json = json.dumps(current_payload, ensure_ascii=False) if current_payload else ''
    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(uuids))
        cursor.execute(
            f"UPDATE devices SET current_job=?, current_image=?, current_command_type=?, current_payload=?, "
            f"updated_at=CURRENT_TIMESTAMP "
            f"WHERE uuid IN ({placeholders})",
            [current_job, current_image, current_command_type, payload_json] + list(uuids)
        )
        return cursor.rowcount


import math


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """计算两点间距离（米），使用 Haversine 公式"""
    R = 6371000  # 地球半径（米）
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def update_device_location(uuid: str, latitude: float, longitude: float) -> bool:
    """更新设备 GPS 坐标，并在相距 < AUTO_GROUP_RADIUS_METERS 时自动归组"""
    AUTO_GROUP_RADIUS_METERS = 10  # 10 米内自动归入同一产线

    with get_db() as conn:
        cursor = conn.cursor()

        # 先更新坐标
        cursor.execute('''
            UPDATE devices SET
                latitude = ?, longitude = ?,
                location_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (latitude, longitude, uuid))

        if cursor.rowcount == 0:
            return False

        # 若已有 device_group 不为空，说明管理员手动设置过，不自动覆盖
        cursor.execute('SELECT id, device_group FROM devices WHERE uuid = ?', (uuid,))
        row = cursor.fetchone()
        if not row or row['device_group']:
            return True  # 坐标已更新，但跳过归组

        device_id = row['id']

        # 查找 10m 范围内的已有设备，获取其产线名称
        cursor.execute('''
            SELECT id, uuid, display_name, latitude, longitude, device_group
            FROM devices
            WHERE latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND device_group != ''
              AND id != ?
        ''', (device_id,))

        for other in cursor.fetchall():
            dist = haversine_distance(
                latitude, longitude,
                other['latitude'], other['longitude']
            )
            if dist < AUTO_GROUP_RADIUS_METERS:
                # 找到附近设备，加入同一产线
                cursor.execute('''
                    UPDATE devices SET device_group = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                ''', (other['device_group'], device_id))
                print(f"[GPS] 设备 {uuid} 与 {other['uuid']} 相距 {dist:.1f}m，归入产线 {other['device_group']}")
                return True

        # 附近无设备，创建新产线（在同一事务内完成，避免数据库锁死）
        cursor.execute("SELECT MAX(CAST(SUBSTR(device_group, 6) AS INTEGER)) FROM devices WHERE device_group LIKE 'Line %'")
        row = cursor.fetchone()
        max_num = row[0] if row and row[0] is not None else 0
        line_name = f"Line {max_num + 1}"
        cursor.execute("UPDATE devices SET device_group = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (line_name, device_id))
        print(f"[GPS] 设备 {uuid} 创建新产线 {line_name}，位置 ({latitude}, {longitude})")
        return True


def _assign_line_for_device(device_id: int, uuid: str, latitude: float, longitude: float) -> str:
    """为设备分配产线编号（按注册顺序连续编号）"""
    with get_db() as conn:
        cursor = conn.cursor()
        # 获取当前最大的 Line 编号
        cursor.execute("SELECT MAX(CAST(SUBSTR(device_group, 6) AS INTEGER)) FROM devices WHERE device_group LIKE 'Line %'")
        row = cursor.fetchone()
        max_num = row[0] if row and row[0] is not None else 0
        line_num = max_num + 1
        line_name = f"Line {line_num}"
        cursor.execute("UPDATE devices SET device_group = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (line_name, device_id))
        print(f"[GPS] 设备 {uuid} 创建新产线 {line_name}，位置 ({latitude}, {longitude})")
        return line_name


def delete_device(device_id: int) -> bool:
    """删除设备"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM devices WHERE id = ?', (device_id,))
        return cursor.rowcount > 0


def migrate_device_uuid(old_uuid: str, new_uuid: str) -> dict:
    """
    迁移设备UUID（APK重装后，设备ID从随机UUID变更为原生ANDROID_ID）。
    - 如果 old_uuid 存在且 new_uuid 不存在：将 old_uuid 改名为 new_uuid
    - 如果 old_uuid 存在且 new_uuid 也存在：将 old_uuid 合并到 new_uuid（保留 new_uuid，
      把 old 的 commands 外键指向 new，删除 old 设备记录）
    - 如果 old_uuid 不存在：返回 unchanged
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 查询两个 UUID 的设备
        cursor.execute('SELECT * FROM devices WHERE uuid = ?', (old_uuid,))
        old_device = cursor.fetchone()
        cursor.execute('SELECT * FROM devices WHERE uuid = ?', (new_uuid,))
        new_device = cursor.fetchone()

        if not old_device:
            return {'action': 'unchanged', 'reason': 'old_uuid_not_found'}

        old_id = old_device['id']

        if not new_device:
            # 直接重命名
            cursor.execute('UPDATE devices SET uuid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                           (new_uuid, old_id))
            return {'action': 'renamed', 'old_uuid': old_uuid, 'new_uuid': new_uuid}

        # 两个都存在 → 合并到 new_uuid，废弃 old
        new_id = new_device['id']

        # 主动标记旧设备为离线（让 SSE 连接自然断开）
        cursor.execute('''
            UPDATE devices
            SET status = 'offline', login_status = '', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (old_id,))

        # 将旧设备的命令转移到新设备
        cursor.execute('UPDATE commands SET device_id = ? WHERE device_id = ?', (new_id, old_id))
        moved_commands = cursor.rowcount

        # 删除旧设备记录
        cursor.execute('DELETE FROM devices WHERE id = ?', (old_id,))

        return {
            'action': 'merged',
            'old_uuid': old_uuid,
            'new_uuid': new_uuid,
            'moved_commands': moved_commands,
        }


def mark_device_offline(uuid: str):
    """标记设备离线（服务器检测超时设备）"""
    with get_db() as conn:
        cursor = conn.cursor()
        # 超过5分钟没心跳视为离线
        cursor.execute('''
            UPDATE devices SET status = 'offline', login_status = ''
            WHERE uuid = ? AND last_seen < datetime('now', '-5 minutes')
        ''', (uuid,))


# ============== 命令操作 ==============
def create_command(device_id: int, command_type: str, payload: dict) -> int:
    """创建命令（存入数据库，支持离线持久化）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO commands (device_id, command_type, payload, status)
            VALUES (?, ?, ?, 'pending')
        ''', (device_id, command_type, json.dumps(payload, ensure_ascii=False)))
        return cursor.lastrowid


def create_commands_batch(device_ids: list[int], command_type: str, payload: dict) -> list[dict]:
    """批量创建命令，单次事务写入多台设备。"""
    if not device_ids:
        return []

    payload_json = json.dumps(payload, ensure_ascii=False)
    created: list[dict] = []
    with get_db() as conn:
        cursor = conn.cursor()
        for device_id in device_ids:
            cursor.execute('''
                INSERT INTO commands (device_id, command_type, payload, status)
                VALUES (?, ?, ?, 'pending')
            ''', (device_id, command_type, payload_json))
            created.append({
                'command_id': cursor.lastrowid,
                'device_id': device_id,
            })
    return created


def get_pending_commands(device_id: int) -> list:
    """获取待发送的命令（设备重连时调用）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM commands
            WHERE device_id = ? AND status = 'pending'
            ORDER BY created_at ASC
        ''', (device_id,))
        return [dict(row) for row in cursor.fetchall()]


def mark_command_sent(command_id: int):
    """标记命令已发送"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE commands SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?
        ''', (command_id,))


def mark_commands_sent_batch(command_ids: list[int]) -> int:
    """批量标记命令为已发送。"""
    normalized = []
    seen = set()
    for item in command_ids or []:
        try:
            command_id = int(item)
        except (TypeError, ValueError):
            continue
        if command_id <= 0 or command_id in seen:
            continue
        seen.add(command_id)
        normalized.append(command_id)

    if not normalized:
        return 0

    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(normalized))
        cursor.execute(
            f"UPDATE commands SET status = 'sent', sent_at = CURRENT_TIMESTAMP "
            f"WHERE id IN ({placeholders})",
            normalized
        )
        return cursor.rowcount


def mark_command_acknowledged(command_id: int):
    """标记命令已确认"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE commands SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?
        ''', (command_id,))


def acknowledge_all_pending(device_id: int):
    """设备重连时确认所有 pending 命令"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE commands
            SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP
            WHERE device_id = ? AND status IN ('pending', 'sent')
        ''', (device_id,))


def list_commands(device_id: int = None, limit: int = 100) -> list:
    """列出命令历史"""
    with get_db() as conn:
        cursor = conn.cursor()
        if device_id:
            cursor.execute('''
                SELECT c.*, d.uuid, d.display_name
                FROM commands c
                JOIN devices d ON c.device_id = d.id
                WHERE c.device_id = ?
                ORDER BY c.created_at DESC LIMIT ?
            ''', (device_id, limit))
        else:
            cursor.execute('''
                SELECT c.*, d.uuid, d.display_name
                FROM commands c
                JOIN devices d ON c.device_id = d.id
                ORDER BY c.created_at DESC LIMIT ?
            ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]


def get_command_stats() -> dict:
    """获取命令统计"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM commands WHERE status = "pending"')
        pending = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM commands WHERE status = "sent"')
        sent = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM commands WHERE status = "acknowledged"')
        acknowledged = cursor.fetchone()[0]
        return {
            'pending': pending,
            'sent': sent,
            'acknowledged': acknowledged,
            'total': pending + sent + acknowledged
        }


def cleanup_old_commands(days: int = 7) -> int:
    """清理 N 天前已完成的历史命令（sent/acknowledged 状态），防止 commands 表无限膨胀"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM commands WHERE status IN ('sent','acknowledged') "
            "AND created_at < datetime('now', '-' || ? || ' days')",
            (days,)
        )
        deleted = cursor.rowcount
        if deleted > 0:
            print(f"[DB] 清理了 {deleted} 条历史命令记录（>{days}天）")
        return deleted


if __name__ == '__main__':
    init_db()
    print(f"数据库已初始化: {DB_PATH}")
    users = list_users()
    print(f"用户数: {len(users)}")
