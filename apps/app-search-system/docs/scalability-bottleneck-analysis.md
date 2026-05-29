# 中控端可扩展性瓶颈分析

> **场景**：展示端（Display End）设备数量超过 100 台时，中控端（Control End）的健壮性与稳定性瓶颈。
>
> **分析日期**：2026-03-20
> **代码库版本**：`feat: migrate frontend to TypeScript and add device status sync`（commit `4fbb2ed`）

---

## 一、系统架构概述

```
┌─────────────────────────────────────────────────────┐
│                   中控端（Control End）               │
│  Electron + React  ──►  Flask Server (port 8765)     │
│  · 设备管理 Dashboard                                 │
│  · 广播命令 / 单播命令                                │
│  · 10 秒轮询设备列表                                  │
└──────────────────────────┬──────────────────────────┘
                           │ HTTP REST + SSE
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ 展示端 #1    │ │ 展示端 #2    │ │ 展示端 #N    │
   │ SSE 长连接   │ │ SSE 长连接   │ │ SSE 长连接   │
   │ 25s 心跳     │ │ 25s 心跳     │ │ 25s 心跳     │
   └──────────────┘ └──────────────┘ └──────────────┘
```

**通信模式**：
- 展示端通过 **Server-Sent Events（SSE）** 维持与后端的长连接
- 后端为每台设备维护独立的 `queue.Queue`，命令通过入队方式推送
- 所有状态持久化在 **SQLite 单文件数据库**中
- 中控端 Dashboard 通过 **REST 轮询** 获取设备状态

---

## 二、瓶颈详细分析

### 瓶颈 1：SSE 连接管理器的全局锁竞争（严重度：🔴 高）

**文件**：`backend/command_pusher.py`

```python
class SSEConnectionManager:
    def __init__(self):
        self._connections = {}      # uuid -> queue.Queue
        self._device_ids = {}       # uuid -> device_id
        self._lock = threading.Lock()  # ← 所有操作共享同一把锁
```

**问题根因**：

`_lock` 是一个普通互斥锁，`add_connection`（第 43 行）、`remove_connection`（第 51 行）、`get_queue`（第 59 行）、`is_online`（第 62 行）、`send_command`（第 72 行）、`send_heartbeat`（第 88 行）等所有操作均需获取同一把锁。

当 100 台设备同时存在时：

| 事件 | 并发数 / 25s 周期 |
|------|-----------------|
| SSE 心跳入队（`send_heartbeat`） | 100 次（分散触发） |
| 命令发送（`send_command`） | 按操作频率增加 |
| 设备连接/断开（`add/remove_connection`） | 随机触发 |

所有操作都在等待同一把锁，构成全局序列化点。锁的持有时间虽然短，但竞争频率随设备数线性增长。

**影响**：广播到 100 台设备时，`command_send_all` 顺序调用 100 次 `send_command`，每次都需要加锁-解锁；同时 100 个 SSE 线程也在竞争同一把锁；总争用次数 = O(N²/单位时间)。

---

### 瓶颈 2：`broadcast()` 方法存在线程安全竞争条件（严重度：🔴 高）

**文件**：`backend/command_pusher.py`，第 98-102 行

```python
def broadcast(self, command_type: str, payload: dict):
    """广播命令到所有在线设备"""
    uuids = list(self._connections.keys())  # ← 无锁保护！
    for uuid in uuids:
        self.send_command(uuid, command_type, payload)
```

**问题根因**：

`list(self._connections.keys())` 在**未持有锁**的情况下执行。在多线程环境下，当另一个线程（如某台设备的 SSE 生成器）同时修改 `_connections` 字典时，可能引发：

- `RuntimeError: dictionary changed size during iteration`
- 遗漏新连接的设备（快照不完整）
- 对已断开的设备发送命令（幽灵发送）

在 100 台设备频繁连接/断开的场景下，此竞争条件的触发概率显著提升。

---

### 瓶颈 3：SQLite 每次操作独立连接 + 无 WAL 模式（严重度：🔴 高）

**文件**：`backend/models.py`，第 45-57 行

```python
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)  # ← 每次都新建连接
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()  # ← 操作完即关闭
```

**问题根因**：

1. **无连接池**：每次数据库操作都经历 open → execute → commit/rollback → close 的完整生命周期，连接建立本身有开销。
2. **未启用 WAL 模式**：SQLite 默认使用 DELETE journal mode，写操作会对整个数据库文件加独占锁（exclusive lock），其他读/写操作必须等待。启用 WAL（Write-Ahead Logging）模式后，读写可并发进行。
3. **并发写操作量**（100 台设备，每 25 秒一个周期）：

| 写操作来源 | 频率（100台设备） |
|-----------|----------------|
| `update_device_heartbeat`（SSE 心跳） | 100 次 / 25s |
| `update_device_display`（状态上报） | 按显示状态变化频率 |
| `create_command`（发送命令） | 按操作频率 |
| `cleanup_stale_devices`（后台守护） | 1 次 / 60s |

高峰期（广播 + 心跳叠加）可达每秒数十次并发写，全部串行化等待，写延迟线性累积。

---

### 瓶颈 4：广播命令触发 N 次独立数据库事务（严重度：🔴 高）

**文件**：`backend/command_pusher.py`，第 257-287 行

```python
def command_send_all():
    online = sse_manager.get_online_uuids()
    sent_count = 0
    for uuid in online:                          # ← 循环 100 次
        if sse_manager.send_command(uuid, command_type, payload):
            sent_count += 1
        if command_type == 'show_image':
            update_device_display(uuid, ...)     # ← 每次独立 UPDATE 事务
        elif command_type == 'show_job':
            update_device_display(uuid, ...)     # ← 每次独立 UPDATE 事务
        elif command_type == 'clear':
            update_device_display(uuid, ...)     # ← 每次独立 UPDATE 事务
    return jsonify({...})
```

**问题根因**：

100 台设备广播时，循环执行 100 次 `update_device_display()`，每次调用均：
1. 打开新的 SQLite 连接
2. 执行 `UPDATE devices SET current_job=?, current_image=? WHERE uuid=?`
3. commit
4. 关闭连接

总计 **100 次独立事务串行执行**，HTTP 请求会阻塞等待所有事务完成。

**量化影响**：假设每次事务耗时 2ms（包含连接建立），100 台设备广播响应时间 ≥ 200ms，且随 SQLite 锁争用可能大幅上升（实测可能 >1s）。

---

### 瓶颈 5：SSE 心跳每 25 秒触发 100 次高频 DB 写（严重度：🟡 中）

**文件**：`backend/command_pusher.py`，第 164-179 行
**文件**：`backend/models.py`，第 252-258 行

```python
# SSE 生成器（每台设备独立运行）
heartbeat_interval = 25  # 秒
while True:
    now = time.time()
    if now - last_heartbeat >= heartbeat_interval:
        yield f"event: heartbeat\n..."
        last_heartbeat = now
        update_device_heartbeat(device_uuid)  # ← 每 25 秒 1 次 DB 写

# update_device_heartbeat（models.py）
def update_device_heartbeat(uuid: str):
    with get_db() as conn:   # ← 每次新建连接
        cursor.execute('UPDATE devices SET status=\'online\', last_seen=CURRENT_TIMESTAMP WHERE uuid=?', ...)
```

**问题根因**：

- 100 台设备各自维护 SSE 生成器线程，每 25 秒独立触发心跳写入
- 写入时间**分散但密集**：100 次写 / 25s = 平均 4 次/s，峰值可能集中
- 每次写入均需经历"新建连接→写→关闭"完整流程，无批量合并

---

### 瓶颈 6：Werkzeug 开发服务器每连接一线程（严重度：🟡 中）

**文件**：`backend/server.py`，第 334 行

```python
app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
```

**问题根因**：

`threaded=True` 启用 Werkzeug 的多线程模式，每个 HTTP 请求（包括长连接）分配一个独立线程：

- 100 台设备 = 100 个 SSE 长连接线程，**常驻内存**，各自阻塞在 `q.get(timeout=1)`
- 后台守护线程 2 个（PDF 同步 + 设备清理）
- 加上正常 REST 请求线程，总线程数持续 > 100

| 资源项 | 100 台设备估算 |
|--------|--------------|
| 线程数（SSE + 其他） | ≥ 105 个 |
| 线程栈内存（约 8MB/线程） | ~840 MB |
| `q.get(timeout=1)` 循环唤醒 | 100 次/s（空转 I/O 开销） |

Werkzeug 是**开发服务器**，非生产级别，无 graceful shutdown、无请求队列控制、无最大连接数限制。

---

### 瓶颈 7：中控端 Dashboard 10 秒固定轮询（严重度：🟡 中）

**文件**：`frontend/src/shared/hooks/index.ts`，第 99-108 行

```typescript
// 定期刷新设备列表（10秒轮询，确保状态实时）
useEffect(() => {
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
}, [fetchDevices]);
```

**问题根因**：

- 无论是否有设备状态变化，每 10 秒必然发起一次 `GET /api/devices` 请求
- 100 台设备时，每次响应包含 100 条设备记录（含 JSON 序列化的 `device_info` 字段）
- 后端每次执行全表查询 + JSON 反序列化 `device_info`（`models.py` 第 310 行）
- React 收到新数据后触发完整的 `devices` 状态更新，导致整个设备列表重渲染

**加剧因素**：多个中控端同时登录时，轮询频率成倍增加。

---

### 瓶颈 8：`commands` 表无限增长，无清理机制（严重度：🟡 中）

**文件**：`backend/models.py`，第 452-523 行

**问题根因**：

- 每次调用 `create_command()` 均向 `commands` 表 INSERT 一条记录
- 代码中**不存在**定期清理历史命令的逻辑（无 `DELETE FROM commands WHERE created_at < ...`）
- 100 台设备场景下，commands 表增长速度 = 设备数 × 操作频率
- 随时间推移，`list_commands()` 的 JOIN 查询和 `get_pending_commands()` 的全量扫描耗时增加

**查询影响**：

```python
# 查询 pending 命令（get_pending_commands）
SELECT * FROM commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC
# → 依赖 idx_commands_device_id + idx_commands_status 复合过滤，表膨胀后 B-tree 层深增加

# 命令历史查询（list_commands）
SELECT c.*, d.uuid, d.display_name FROM commands c JOIN devices d ON c.device_id = d.id
ORDER BY c.created_at DESC LIMIT 100
# → 全表排序后取 LIMIT，无时间范围索引，表大时代价高
```

---

### 瓶颈 9：图片目录全量扫描无缓存（严重度：🟢 低）

**文件**：`backend/server.py`，第 157-162 行

```python
@app.route('/api/images', methods=['GET'])
def api_images():
    if not os.path.exists(IMAGES_DIR):
        return jsonify([])
    files = [f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg', '.jpeg', '.png'))]
    return jsonify(files)
```

**问题根因**：

- 每次 `GET /api/images` 均调用 `os.listdir()` 全量扫描 `pdf_images/` 目录
- 一个典型 SOP 系统可能包含数百到数千个 PDF 页面图片
- 无内存缓存，无 ETag / Last-Modified 缓存头，每次请求均重新扫描
- 100 台展示端启动时同时请求图片列表，产生并发文件系统扫描

---

### 瓶颈 10：向量检索并发外部 API 调用，无本地缓存（严重度：🟢 低）

**文件**：`backend/build_embedding.py`，第 130-141 行

```python
# 模型轮询（分散 API 压力）
_model轮询计数器 = 0
VISION_MODELS = [
    'qwen-vl-max-latest',
    'qwen-vl-plus-latest',
]
def _get_vision_model():
    global _model轮询计数器
    model = VISION_MODELS[_model轮询计数器 % len(VISION_MODELS)]
    _model轮询计数器 += 1
    return model
```

**问题根因**：

- `search_hybrid()` 调用 DashScope 生成文本 embedding，是**同步外部 API 调用**
- 100 台展示端同时搜索 → 100 个并发请求命中 DashScope QPS 限制
- 两模型轮询仅针对图片处理（build_embedding），搜索路径无类似保护
- 相同查询的 embedding 结果**不缓存**，重复查询重复调用外部 API
- DashScope API 超时或限流会导致搜索请求长时间阻塞（占用 Flask 线程）

---

## 三、瓶颈汇总与优先级

| # | 瓶颈 | 严重度 | 影响维度 | 代码位置 |
|---|------|--------|---------|---------|
| 1 | SSE 连接管理器全局锁竞争 | 🔴 高 | 吞吐量、延迟 | `command_pusher.py:38` |
| 2 | `broadcast()` 无锁线程竞争 | 🔴 高 | 稳定性、崩溃风险 | `command_pusher.py:98-102` |
| 3 | SQLite 无连接池 + 无 WAL | 🔴 高 | 写延迟、并发能力 | `models.py:45-57` |
| 4 | 广播 N 次独立 DB 事务串行 | 🔴 高 | 广播响应时间 | `command_pusher.py:257-287` |
| 5 | SSE 心跳高频 DB 写（无批量） | 🟡 中 | 写压力、写延迟 | `command_pusher.py:179` |
| 6 | Werkzeug 开发服务器 + 每连接一线程 | 🟡 中 | 内存、线程数上限 | `server.py:334` |
| 7 | 中控端 10 秒固定轮询 | 🟡 中 | 无效 DB 查询、渲染抖动 | `hooks/index.ts:106` |
| 8 | `commands` 表无限增长无清理 | 🟡 中 | 查询性能劣化 | `models.py:452-523` |
| 9 | 图片目录全量扫描无缓存 | 🟢 低 | 文件 I/O 偶发抖动 | `server.py:157-162` |
| 10 | 向量检索无缓存 + 并发 API 限流 | 🟢 低 | 搜索延迟、外部依赖风险 | `build_embedding.py:130-141` |

---

## 四、改进建议

### 高优先级（影响 100 台以上稳定性的根本问题）

**1. 为 `broadcast()` 加锁，修复竞争条件**

```python
def broadcast(self, command_type: str, payload: dict):
    with self._lock:                               # 加锁保护快照
        uuids = list(self._connections.keys())
    for uuid in uuids:
        self.send_command(uuid, command_type, payload)
```

**2. 启用 SQLite WAL 模式，提升读写并发**

```python
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL')        # 启用 WAL
    conn.execute('PRAGMA synchronous=NORMAL')      # 平衡安全与性能
    conn.row_factory = sqlite3.Row
    ...
```

**3. 广播时批量更新，减少事务数**

```python
def command_send_all():
    online = sse_manager.get_online_uuids()
    # SSE 入队（快速）
    sent_count = sum(1 for uuid in online if sse_manager.send_command(uuid, command_type, payload))
    # 批量 UPDATE，一次事务
    if online:
        with get_db() as conn:
            conn.executemany(
                'UPDATE devices SET current_job=?, current_image=?, updated_at=CURRENT_TIMESTAMP WHERE uuid=?',
                [(payload.get('job_name',''), payload.get('image_path',''), uuid) for uuid in online]
            )
    return jsonify({'status': 'broadcast', 'online_count': len(online), 'sent_count': sent_count})
```

**4. 心跳批量写入（按时间窗口合并）**

将各 SSE 生成器的心跳写入请求缓冲后批量提交（如每 10 秒批量更新所有在线设备的 `last_seen`），而非每台设备独立写。

**5. 替换 Werkzeug 为 Gunicorn（生产级部署）**

```bash
# 使用 gevent worker，支持异步长连接，大幅降低线程数
gunicorn -w 1 -k gevent --worker-connections 200 -b 0.0.0.0:8765 server:app
```

### 中优先级（性能优化）

**6. 中控端改用增量刷新或 SSE 推送替代轮询**

在后端新增 `/api/devices/changes?since=<timestamp>` 接口，仅返回变化的设备；或在中控端的设备列表也通过 SSE 实时推送，彻底消除轮询开销。

**7. 定期清理历史命令记录**

```python
# 在 cleanup_stale_devices 守护线程中添加
def cleanup_old_commands(days: int = 7):
    with get_db() as conn:
        conn.execute(
            "DELETE FROM commands WHERE status IN ('sent','acknowledged') AND created_at < datetime('now', '-' || ? || ' days')",
            (days,)
        )
```

### 低优先级（锦上添花）

**8. 图片列表接口增加内存缓存**

```python
import functools, time as _time
_images_cache = {'files': [], 'ts': 0}

def get_images_cached(ttl=30):
    if _time.time() - _images_cache['ts'] > ttl:
        _images_cache['files'] = [f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg','.jpeg','.png'))]
        _images_cache['ts'] = _time.time()
    return _images_cache['files']
```

**9. 搜索结果 LRU 缓存**

```python
from functools import lru_cache

@lru_cache(maxsize=256)
def cached_embedding(text: str):
    return get_embedding(text)   # DashScope API 调用
```

---

## 五、关键代码路径（100 台设备场景下的热点路径）

```
展示端 SSE 心跳（每 25s × 100 台）
  └─► command_pusher.py:176-179 (generate 生成器)
      └─► models.py:252-258 (update_device_heartbeat)
          └─► sqlite3.connect() × 100  ← 瓶颈 3、5

中控端广播命令
  └─► command_pusher.py:257-287 (command_send_all)
      ├─► sse_manager.send_command() × 100  ← 瓶颈 1
      │   └─► threading.Lock() 竞争
      └─► update_device_display() × 100  ← 瓶颈 4
          └─► get_db() × 100 (独立事务)

中控端设备列表刷新（每 10s）
  └─► hooks/index.ts:71-84 (fetchDevices)
      └─► models.py:282-312 (list_devices)
          └─► fetchall() 全量返回 100 行 + JSON 反序列化  ← 瓶颈 7
```

---

*本文档由代码库静态分析生成，分析对象为 `backend/command_pusher.py`、`backend/models.py`、`backend/server.py`、`frontend/src/shared/hooks/index.ts`、`backend/build_embedding.py`。*
