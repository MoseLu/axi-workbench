# `@axi/workbench-shared` — 跨端共享纯函数 / hooks / 类型

三端（Web / Mobile / Desktop）共用的工具层。**不包含 UI、不调用平台 API**。

| 项 | 值 |
| --- | --- |
| 目录 | `apps/workbench-shared` |
| 包名 | `@axi/workbench-shared` |
| 类型 | `module`（ESM） |
| 消费者 | `@axi/workbench` / `@axi/workbench-mobile` / `@axi/workbench-desktop`（via web SPA） |
| type-check | `pnpm --filter @axi/workbench-shared type-check` |
| test | `pnpm --filter @axi/workbench-shared test` |

## 设计原则

1. **纯函数优先**：hooks 仅依赖 react + 共享 contracts，不调用任何平台 API（无 fetch、无 Tauri IPC、无 React Router）。三端各自的封装层在上层包做。
2. **零 UI**：不导出组件、不依赖 `@axi/shell` / `@axi/widgets` 等 UI 库。
3. **类型公开**：所有函数都有完整的 TS 类型签名。

## 不归这里

- **任何带 fetch 的 API 客户端** —— 用 `@epap/api-client`
- **任何带路由的页面级工具** —— 各端自管理
- **任何 i18n / locale** —— 用 `@axi/workbench-foundation`
- **任何 macOS shell IPC** —— 用 `@axi/workbench-desktop/contracts`

## 何时往这里加东西？

任何在 web/mobile/desktop 三个端**重复出现 ≥2 次**的纯函数 → 提取到本包。

具体决策见 `docs/specs/2026-09-02-workbench-multi-surface-architecture/ARCHITECTURE.md` §4 决策树。

## 当前内容（M14 骨架）

```
src/
 ├── index.ts            入口 + package 元数据
 ├── format/             跨端格式化（unread、timestamp）
 ├── hooks/              通用 hooks（useDebouncedValue）
 └── types/              共享类型（Surface、NavBadge）
```

## 演进路线

- **M14**（本）：骨架 + 占位 + 单测 ✅
- **M15+**（后续）：把 web 端散落的 format helpers / 通用 hooks 实际搬过来
- **M16+**（后续）：把 mobile 端 `apps/workbench-mobile/src/lib` 下的纯函数搬过来
- **M17+**（后续）：从 web/mobile 删去重复实现
- **M18+**（后续）：CI 加 `pnpm --filter @axi/workbench-shared test` + type-check