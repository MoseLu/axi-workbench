# `@epap/ui`（Legacy Layout）— 子项目 AGENTS

> 本文件管辖 `/Volumes/code/workspace/workbench/axi-workbench/packages/ui`。
> 父级 [`packages/AGENTS.md`](../AGENTS.md) 与仓库根 [`AGENTS.md`](../../AGENTS.md) 仍然适用。
> **状态：legacy**（保留兼容 / 参考）。策略权威见 [`LEGACY.md`](LEGACY.md)：新 dashboard 壳层 / 布局必须用 `foundation/axi-ui` 的 `@axi/*`；本包只接受 `apps/workbench` 的 bugfix 与最小样式修改。

## 命名事实（必须记录的不一致）
- 包 scope 是 **`@epap/ui`**，与仓库主流 `@axi/*` 命名不一致。这是 EPAP → Axi 迁移期的历史遗留；**不要**在没有专门迁移任务时重命名（远程仓库名与部分 `EPAP_*` 兼容入口同样保留）。
- peer 依赖仍是 React 18 / react-router 6，而 `apps/workbench` 已是 React 19 / react-router 7。legacy 包容忍该漂移，但新代码不要依赖本包。

## 入口与子模块
- 入口：`src/index.ts`（barrel；副作用导入 `./styles/variables.css`），`exports` 另暴露 `./styles/*`。
- `src/components/`（atoms / tabbar / …）、`src/primitives/`（dropdown 等）、`src/composables/`（`useToggle` / `useFullscreen` / `useTabs` / `useBreakpoint`）、`src/styles/`（tokens、theme-provider）、`src/types/`（schemas、antd-compat）、`src/utils/`、`src/stories/`。
- 配套：`.storybook/`、`docs/`。

## 关键命令
```bash
pnpm --filter @epap/ui type-check        # 注意：本包没有 typecheck 脚本，只有 type-check
pnpm --filter @epap/ui build             # tsc && vite build
pnpm --filter @epap/ui test              # vitest
pnpm --filter @epap/ui lint              # eslint（本包有独立 eslint 配置）
pnpm --filter @epap/ui storybook         # 6006
```

## 依赖关系
- 运行时依赖：`@ant-design/icons` + Radix primitives + `zod`。
- 消费者纪律（`LEGACY.md`）：无活跃 Web runtime consumer（2026-09-13 清理后）；允许 `apps/workbench` 做 bugfix；**新消费者一律拒绝**，改到 `foundation/axi-ui`；AppLayout / TabBar / Topbar 的大功能必须 re-home 到 `@axi/*`。

## 已知违规（2026-10-15 实测）
- `src/types/schemas.ts` 596 行、`src/types/antd-compat.ts` 526 行——接近 600 行门禁。本包为 legacy，不做大拆分；改动时避免继续加行。

## 验证
- 最小：`pnpm --filter @epap/ui type-check`。
- 样式 / token 改动：加 `build`；组件改动加 `test`。
