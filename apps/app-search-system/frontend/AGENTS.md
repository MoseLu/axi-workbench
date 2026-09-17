<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# frontend

## Purpose
React/TypeScript 前端应用，支持 Web 浏览器、Electron 桌面端和 Capacitor Android/iOS 移动端。采用 control（管理端）和 display（展示端）双应用架构。

## Related Tasks

| Task | Priority | Status | Description |
|------|----------|--------|-------------|
| 前端 Web 版本构建 | 中 | ✅ 已完成 | `pnpm build` 产物在 `frontend/build` 目录 |

## Key Files

| File | Description |
|------|-------------|
| `src/App.tsx` | 主应用入口 |
| `src/index.tsx` | React DOM 渲染入口 |
| `src/index.css` | 全局样式 |
| `capaci tor.config.ts` | Capacitor 配置（移动端构建） |
| `vite.config.ts` | Vite 构建配置 |
| `package.json` | 依赖和脚本定义 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/control/` | 管理端应用（设备管理、SOP 查看、搜索） |
| `src/display/` | 展示端应用（设备端 SOP 展示） |
| `src/shared/` | 共享组件和 hooks |
| `src/services/` | API 服务层 |
| `src/types/` | TypeScript 类型定义 |
| `src/config/` | 前端配置 |
| `assets/` | 静态资源 |
| `public/` | 公共资源（HTML 入口） |

## For AI Agents

### Working In This Directory
- 框架：React 18 + TypeScript + Vite
- 移动端：Capacitor（Android/iOS）
- 桌面端：Electron
- 构建：`pnpm build`（Web），`pnpm exec cap sync`（同步到 Android）
- 当前分支：`display-fix` — Display 相关功能修复

### Active Context
Display 客户端修复分支，已完成后端打包脚本更新。

### Testing Requirements
- Web 构建：`pnpm build` 验证无编译错误
- Android 构建：`pnpm exec cap sync android && cd android && ./gradlew assembleDebug`
- Capacitor 状态：`pnpm exec cap doctor`

### Common Patterns
- 共享组件：`src/shared/components/`，`src/shared/hooks/`
- Control 端：`src/control/` — 管理员使用
- Display 端：`src/display/` — 设备端展示
- API 服务：`src/services/` — 与后端 `/api/*` 通信

## Dependencies

### Internal
- `backend/` - 后端 API 服务

### External
- React 18 - UI 框架
- TypeScript - 类型系统
- Vite - 构建工具
- Capacitor - 跨端适配
- Axios - HTTP 客户端

<!-- MANUAL: -->

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `./AGENTS.md` | 前端目录 AI 文档（当前） |
| TODO.md | `./TODO.md` | 前端模块任务（L3） |
| MILESTONE.md | `./MILESTONE.md` | 前端模块里程碑（L3） |
| AGENTS.md (parent) | `../AGENTS.md` | 项目根文档（L2） |
| TODO.md (parent) | `../TODO.md` | 全项目任务（L2） |
| MILESTONE.md (parent) | `../MILESTONE.md` | 全项目里程碑（L2） |

### Quick Commands
```bash
# 查看前端任务
grep -n "P0\|P1\|P2\|P3" ./TODO.md

# 查看进行中的前端任务
grep "🔄\|IN_PROGRESS" ./TODO.md
```
