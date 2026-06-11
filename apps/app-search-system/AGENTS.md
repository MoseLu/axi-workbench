<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# SOP 系统

> 层级: L2 (Project, 全项目)

## Purpose
SOP（Standard Operating Procedure）管理系统，用于管理生产作业标准文档，支持设备管理、文档搜索（语义检索）和 Electron 桌面客户端。

## Documentation Layers

| Layer | Scope | TODO | MILESTONE | AGENTS |
|-------|-------|------|------------|--------|
| L2 | 全项目 | `./TODO.md` | `./MILESTONE.md` | `./AGENTS.md` |
| L3 | backend/ | `backend/TODO.md` | `backend/MILESTONE.md` | `backend/AGENTS.md` |
| L3 | frontend/ | `frontend/TODO.md` | `frontend/MILESTONE.md` | `frontend/AGENTS.md` |
| L3 | docs/ | — (inherited) | — (inherited) | `docs/AGENTS.md` |
| L3 | asserts/ | — (inherited) | — (inherited) | `asserts/AGENTS.md` |

## Project Status

**Current Version**: v1.0.0
**Overall Progress**: ████████████░░░░ 80%
**Target Date**: 持续迭代

### Active Milestone

| Milestone | Layer | Progress | Status |
|-----------|-------|----------|--------|
| 管理员密码安全增强 | backend | ████████████████ 100% | ✅ COMPLETED |
| 前端 Web 版本构建 | frontend | ████████████████ 100% | ✅ COMPLETED |
| 离线测试设备清理 | backend | ████████████████ 100% | ✅ COMPLETED |
| Display 展示端修复 | frontend | ████░░░░░░░░░░░ 30% | 🔄 IN_PROGRESS |
| Capacitor Android 端 | frontend | ████░░░░░░░░░░░ 20% | 🔄 IN_PROGRESS |
| 用户账户管理 | backend | ░░░░░░░░░░░░░░░░░ 0% | 📋 PLANNED |
| HTTPS 安全传输 | backend | ░░░░░░░░░░░░░░░░░ 0% | 📋 PLANNED |
| 数据库备份策略 | backend | ░░░░░░░░░░░░░░░░░ 0% | 📋 PLANNED |

## Key Files

| File | Layer | Description |
|------|-------|-------------|
| `CLAUDE.md` | L2 | Claude Code 会话规范和分支策略 |
| `TODO.md` | L2 | 全项目任务追踪 |
| `MILESTONE.md` | L2 | 全项目里程碑路线图 |
| `AGENTS.md` | L2 | 当前文档 |
| `build_all.bat` | L2 | 全量构建脚本（后端+前端） |
| `.mcp.json` | L2 | MCP 服务器配置 |

## Subdirectories / Modules

| Directory | Layer | Purpose | Own TODO | Own MILESTONE |
|---------|-------|---------|---------|----------------|
| `backend/` | L3 | Python FastAPI 后端服务 | ✅ `backend/TODO.md` | ✅ `backend/MILESTONE.md` |
| `frontend/` | L3 | React 多端前端 | ✅ `frontend/TODO.md` | ✅ `frontend/MILESTONE.md` |
| `docs/` | L3 | 项目文档 | — (inherited) | — (inherited) |
| `asserts/` | L3 | SOP 静态资源 | — (inherited) | — (inherited) |

## For AI Agents

### Active Context
已完成：管理员密码安全增强、前端 Web 构建、测试设备清理。
进行中：
- **backend/**: v1.1.0 功能增强规划中
- **frontend/**: `display-fix` 分支 — Display 展示端修复

### Working In This Directory
- 后端使用 Python，依赖 `fastapi`, `uvicorn`, `chroma`, `jinja2`
- 前端使用 TypeScript + React + Capacitor
- 使用 `build_all.bat` 可一次性构建后端 exe + 前端
- Electron 桌面端在 `frontend/` 中构建

### Testing Requirements
- 后端健康检查：`POST /api/health`
- API 测试：JWT 认证 + 设备管理接口
- 前端：`pnpm build` 验证构建成功

### Common Patterns
- 后端 API：`backend/api.py` 定义所有 REST 接口
- 设备管理：`backend/device_manager.py`
- 向量检索：`backend/chroma/` 用于 SOP 语义搜索
- 前端路由：`frontend/src/control/` 和 `frontend/src/display/`

## Dependencies

### External
- FastAPI - Web 框架
- ChromaDB - 向量数据库
- Electron - 桌面端框架
- Capacitor - 跨端适配层
- React 18 - UI 框架
- SQLAlchemy - ORM

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| TODO.md (this) | `./TODO.md` | 全项目任务追踪 (L2) |
| MILESTONE.md (this) | `./MILESTONE.md` | 全项目里程碑 (L2) |
| AGENTS.md (backend) | `./backend/AGENTS.md` | 后端模块文档 (L3) |
| TODO.md (backend) | `./backend/TODO.md` | 后端模块任务 (L3) |
| MILESTONE.md (backend) | `./backend/MILESTONE.md` | 后端模块里程碑 (L3) |
| AGENTS.md (frontend) | `./frontend/AGENTS.md` | 前端模块文档 (L3) |
| TODO.md (frontend) | `./frontend/TODO.md` | 前端模块任务 (L3) |
| MILESTONE.md (frontend) | `./frontend/MILESTONE.md` | 前端模块里程碑 (L3) |

### Quick Commands

```bash
# 查看全项目里程碑
grep -A 20 "v1.0.0" MILESTONE.md

# 查看后端任务
grep -n "P0\|P1\|P2" backend/TODO.md

# 查看前端任务
grep -n "P0\|P1\|P2" frontend/TODO.md

# 按优先级筛选全项目
grep -n "P0\|P1" TODO.md

# 扫描代码中的 TODO 注释
grep -rn "TODO\|FIXME" --include="*.py" --include="*.tsx" --include="*.ts" .
```

<!-- MANUAL: -->
