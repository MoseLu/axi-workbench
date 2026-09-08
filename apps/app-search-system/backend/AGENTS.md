<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# backend

## Purpose
Python FastAPI 后端服务，提供 SOP 文档管理、设备控制、向量语义搜索、JWT 认证等核心 API。

## Related Tasks

| Task | Priority | Status | Description |
|------|----------|--------|-------------|
| 数据库备份策略 | 中 | 📋 建议 | SQLite 数据库定时备份 |

## Key Files

| File | Description |
|------|-------------|
| `server.py` | 应用入口，启动 Uvicorn 服务 |
| `api.py` | 主 API 路由定义（文档、设备、搜索等） |
| `auth.py` | JWT 认证、登录、密码管理 |
| `models.py` | SQLAlchemy 模型（Document, Job, Device, User） |
| `device_manager.py` | 设备注册、心跳、OTA 推送、测试设备清理 |
| `sync_sop.py` | SOP PDF 同步到向量数据库 |
| `build_embedding.py` | 向量 embedding 构建脚本 |
| `build_parallel.py` | 并行构建 embedding |
| `publish_bundle.py` | 前端 bundle 发布 |
| `query_devices.py` | 设备查询工具 |
| `quick_api.py` | 快速 API 测试脚本 |
| `command_pusher.py` | 命令推送服务 |
| `ota_update.py` | OTA 远程更新 |
| `setup_schedule.py` | 定时任务配置 |
| `voice_asr.py` | 语音识别（ASR）集成 |
| `pdf_sync_monitor.py` | PDF 同步监控 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `chroma/` | ChromaDB 向量数据库相关代码 |
| `data/` | 数据存储目录（PDF、图片、ChromaDB 数据） |
| `logs/` | 服务运行日志 |
| `installer/` | 安装包打包脚本 |
| `bundle_updates/` | 前端 bundle 更新包 |

## For AI Agents

### Working In This Directory
- 依赖：`fastapi`, `uvicorn`, `sqlalchemy`, `chroma`, `jinja2`, `Pillow`, `python-multipart`
- 启动服务：`python server.py` 或 `uvicorn server:app --reload`
- 服务地址：`http://10.80.8.198:8765`
- 数据库：`backend/data/sop.db`（SQLite）

### Active Context
已完成后端安全增强（随机密码生成、测试设备清理 API）。

### Testing Requirements
- 健康检查：`POST /api/health`
- 设备列表：`GET /api/devices`
- 设备清理：`POST /api/devices/cleanup-test`, `POST /api/devices/cleanup-old`

### Common Patterns
- 所有 API 均需 JWT 认证（`Authorization: Bearer <token>`）
- 设备通过 UUID 注册，每 2 分钟上报心跳
- SOP 文档以 PDF 存储，通过 `sync_sop.py` 同步到 ChromaDB 向量库
- 前端构建产物由 `publish_bundle.py` 发布

## Dependencies

### Internal
- `backend/models.py` - 数据库模型
- `backend/auth.py` - 认证逻辑
- `backend/api.py` - API 路由
- `backend/chroma/` - 向量检索

### External
- FastAPI - Web 框架
- SQLAlchemy - ORM
- ChromaDB - 向量数据库
- Uvicorn - ASGI 服务器
- Jinja2 - 模板引擎
- Pillow - 图片处理

<!-- MANUAL: -->

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `./AGENTS.md` | 后端目录 AI 文档（当前） |
| TODO.md | `./TODO.md` | 后端模块任务（L3） |
| MILESTONE.md | `./MILESTONE.md` | 后端模块里程碑（L3） |
| AGENTS.md (parent) | `../AGENTS.md` | 项目根文档（L2） |
| TODO.md (parent) | `../TODO.md` | 全项目任务（L2） |
| MILESTONE.md (parent) | `../MILESTONE.md` | 全项目里程碑（L2） |

### Quick Commands
```bash
# 查看后端任务
grep -n "P0\|P1\|P2\|P3" ./TODO.md

# 查看进行中的后端任务
grep "🔄\|IN_PROGRESS" ./TODO.md
```
