# Axi Workbench Web（`@axi/workbench`）— 子项目 AGENTS

> 本文件管辖 `/Volumes/code/workspace/workbench/axi-workbench/apps/workbench`。
> 父级 [`apps/AGENTS.md`](../AGENTS.md) 与仓库根 [`AGENTS.md`](../../AGENTS.md) 仍然适用；冲突时根级 > 本文件。
> 本文件只写入口 / 子模块 / 命令 / 依赖 / 已知违规，不重复根级六层控制面 SOP。

## 入口
- `index.html` → `src/main.tsx`（React 挂载 + `installTauriGatewayFetch()` + observability SDK 懒加载）→ `src/App.tsx`（路由）。
- 布局壳：`src/layouts/MainLayout.tsx`（Dashboard Chrome、侧栏、顶栏、标签栏、面包屑、设置面板）。
- 开发地址：http://127.0.0.1:5173（仓库根 `pnpm dev:workbench`）。

## 子模块划分
| 目录 | 职责 |
|---|---|
| `src/pages/` | 路由页：`Home` / `Projects` / `ProjectDetail` / `CommandCenter` / `Login` / `Register` / `AuthCallback` / `LegalDocument` / `workspaceRegistry.ts`；`admin/`（Operations / GovernanceSummary / Handoff 等）；`commit-ledger/`；`personal-os/` |
| `src/components/` | `Auth/`、`Icon/`、`Layout/`、`OfflineBanner`、`OneTimeCodeInput` |
| `src/layouts/` | `MainLayout` |
| `src/lib/` `src/hooks/` `src/contexts/` `src/config/` `src/i18n/` | 工具、hook、上下文、配置、国际化 |
| `e2e/` | Playwright 冒烟：`login` / `handoff` / `personal-os` |
| `scripts/` | `prerender-legal.mjs`（build 尾部）、`verify-lcp*.mjs`、`verify-ui-contracts.mjs`、`serve-local-https.mjs` |

## 关键命令
```bash
pnpm dev:workbench                          # 仓库根；5173
pnpm --filter @axi/workbench type-check     # tsc --noEmit（脚本名是 type-check，没有 typecheck）
pnpm --filter @axi/workbench test           # vitest run
pnpm --filter @axi/workbench lint
pnpm --filter @axi/workbench build          # tsc && vite build && prerender-legal
pnpm --filter @axi/workbench e2e            # playwright
pnpm --filter @axi/workbench check:bundle
```

## 依赖关系
- 本仓共享包：`@axi/workbench-foundation`（会话 / locale）、`@axi/workstation-contracts`（schemas）、`@axi/api-client`、`@axi/types`、`@axi/utils`。
- 跨仓 `@axi/*` UI 栈（`@axi/core` / `@axi/shell` / `@axi/tokens` / `@axi/crud` / `@axi/presets` / `@axi/settings` / `@axi/widgets` / `@axi/observability-web`）由 `pnpm-workspace.yaml` 的 `../../foundation/axi-ui/packages/*` 与 `../../foundation/axi-observability/*` 链接，**不在本仓**；改这些包要去对应 foundation 仓库。
- 本地全链路运行时依赖：`identity-adapter` (8081)、`platform-core` (8082)、`control-plane` (8092)、`api-gateway` (8088)；`/api` 代理目标规则见 `README.md`（`VITE_API_PROXY_TARGET` > `VITE_API_BASE_URL` > 默认 8088）。
- 移动端是独立应用 `apps/workbench-mobile`（5174），**不要**把移动壳塞回本应用的 viewport / CSS 分支。

## 已知违规（2026-10-15 06:10 复核，阈值 500 行）
- 视图 / 逻辑：`src/layouts/MainLayout.tsx` 596（工作树中已有并行拆分）、`src/assets/icons/index.ts` 502。
- 样式：`src/assets/icons/system/iconfont.css` 2664、`src/pages/Login.css` 2152、`src/pages/personal-os/PersonalOs.css` 630。
- 已由并行拆分修复：`src/pages/Login.tsx` 1377 → `src/pages/Login/`（最大 376）、`src/pages/commit-ledger/CommitLedgerPage.tsx` 963 → `CommitLedgerPage/`（最大 224）。
- 拆分须走专门任务（`admin/me`、`Login` 系列已有并行拆分工作），本文件不构成拆分授权。

## 验证
- 最小：`pnpm --filter @axi/workbench type-check`。
- 页面 / 布局改动：加 `test` 与 `build`；登录或网关代理改动加 `e2e`。
