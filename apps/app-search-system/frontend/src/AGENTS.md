<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# frontend/src

## Purpose
React 组件源码目录，包含 control（管理端）和 display（展示端）两个独立应用入口，以及共享组件库。

## Key Files

| File | Description |
|------|-------------|
| `App.tsx` | 主应用组件 |
| `index.tsx` | React DOM 渲染入口 |
| `index.css` | 全局样式 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `control/` | 管理端应用（管理员操作界面） |
| `display/` | 展示端应用（设备端 SOP 展示） |
| `shared/` | 共享组件和 hooks |
| `services/` | API 服务层（与后端通信） |
| `types/` | TypeScript 类型定义 |
| `config/` | 前端配置 |

## For AI Agents

### Working In This Directory
- 使用 React 18 + TypeScript
- 遵循现有组件结构：优先在 `shared/` 中抽取公共组件
- API 调用通过 `services/` 中的模块

### Testing Requirements
- `pnpm build` 验证 TypeScript 编译无错误

<!-- MANUAL: -->

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `./AGENTS.md` | 源码目录 AI 文档（当前 L4） |
| AGENTS.md (parent) | `../AGENTS.md` | 前端模块文档（L3） |
| TODO.md (inherited) | `../../TODO.md` | 前端模块任务（L3） |
| MILESTONES.md (inherited) | `../../MILESTONES.md` | 前端模块里程碑（L3） |
| AGENTS.md (root) | `../../../AGENTS.md` | 项目根文档（L2） |
| TODO.md (root, inherited) | `../../../TODO.md` | 全项目任务（继承自 L2） |
| MILESTONES.md (root, inherited) | `../../../MILESTONES.md` | 全项目里程碑（继承自 L2） |
