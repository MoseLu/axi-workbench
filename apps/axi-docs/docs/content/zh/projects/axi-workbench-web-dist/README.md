---
id: axi-docs-zh-projects-axi-workbench-web-dist
title: Axi Workbench Web Distribution
type: project
status: published
tags: [Axi Docs, 项目, distributions, reference, workbench, web]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench Web Distribution
graph-tags: [Projects, distributions, workbench]
description: Standalone pnpm + Turbo monorepo that mirrors apps/workbench from workbench/axi-workbench as a buildable Web distribution; ships the React + Vite + antd admin UI plus shared `@axi/*` workspace packages.
project:
  id: axi-workbench-web-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-web
  source-section: reference
---

# Axi Workbench Web Distribution

> Workspace project dossier. Source of truth:
> [`/Volumes/code/workspace/distributions/axi-workbench-web`](/Volumes/code/workspace/distributions/axi-workbench-web).
> Partition: `distributions/`. Upstream monorepo: `workbench/axi-workbench`.

## Summary

一个独立的 pnpm + Turbo monorepo，把 Axi Workbench 的 **Web 管理后台** 打包成可独立构建的分发。它复用 React 18 + Vite + antd 6 SPA、所有共享 workspace 库（`@axi/core`、`@axi/crud`、`@axi/presets`、`@axi/settings`、`@axi/shell`、`@axi/tokens`、`@axi/widgets`、`@axi/workstation-contracts`、`@axi/workbench-foundation`），以及 API/types/utils 包（`@epap/api-client`、`@epap/types`、`@epap/utils`）。Web 入口 `apps/workbench` 使用 React Router、TanStack Query、Antd ConfigProvider、Axi Dashboard Shell，以及一个 macOS 客户端共用的 Tauri-aware gateway fetch 拦截器（`installTauriGatewayFetch()`）。

构建产物落在 `apps/workbench/dist/`（约 5.5 MB），入口是 `apps/workbench/dist/index.html`，标题为 "公理工作台"。Dev server 监听 IPv4 `http://127.0.0.1:5183`（端口 `5173` 留给 `axi-image-preview`），`/api` 代理到 Vite 选定的后端（`VITE_API_PROXY_TARGET` / `VITE_API_BASE_URL`，默认 `127.0.0.1:8088`），`/control-plane` 代理到 `http://localhost:8092`。CI 使用 GitHub Actions（`contracts` → `typecheck` → `test` → `build`），运行于 `main` 与 `dev` 分支。合约校验脚本（`scripts/verify-ci-contracts.mjs`）会在任意任务宣告成功前交叉核对 `package.json`、`turbo.json`、`pnpm-workspace.yaml` 和 workflow 文件。

**Stage**：现役产品分发，Axi Workbench 三端中的 Web 端（`web` / `desktop` / `mobile`）；兄弟分发位于 `/Volumes/code/workspace/distributions/axi-workbench-desktop` 与 `/Volumes/code/workspace/distributions/axi-workbench-mobile`。

## Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Distribution package root | pnpm 10.33.2 + Turbo 2.3 + TypeScript 5.3 + sass 1.77 | `engines.node>=22`, `engines.pnpm>=10`, `verify:ci` |
| `apps/workbench` SPA | React 18 + react-router-dom 6 + vite 5 + antd 6.4.3 + @tanstack/react-query 5 + @vitejs/plugin-react 4 | Vite dev on IPv4 `127.0.0.1:5183` (5173 reserved for `axi-image-preview`), `strictPort: true`; Workspace builds `apps/workbench/dist/index.html` |
| API client | `@epap/api-client` (axios 1.6) with `apiClient` and `controlPlaneClient`; peer dep on `@tanstack/react-query` | `/api` default empty (relative) or env-supplied; `withCredentials: true` for HttpOnly cookie sessions |
| Types / contracts | `@epap/types`, `@axi/workstation-contracts` (zod 4) | `ApiResponse<T>` etc. |
| Theme / tokens | `@axi/tokens` (CSS variables), `@axi/presets` (style presets), `@axi/core` (`AxiThemeProvider`, `createAxiAntdTheme`, `AxiLocaleProvider`) | `defaultPreference="dark"`, `defaultStylePreset="black-gold"`, namespace `axi.workbench` |
| Shell / dashboard | `@axi/shell` (`AxiDashboardShell`, `AxiFloatingToolDock`), `@axi/settings` (`AxiAdminSettingsPanel`), `@axi/crud`, `@axi/widgets`, `@axi/icons` | Layout chrome for the Web admin surface |
| Foundation | `@axi/workbench-foundation` (AuthProvider + LocaleProvider + icons + username + notifications + shell-contracts) | Used by `App.tsx`, `MainLayout.tsx`, `AuthContext.tsx` |
| Tauri bridging (when packaged) | `apps/workbench/src/lib/tauriGateway.ts` (`installTauriGatewayFetch`) | Rewrites `/api/*` fetches in the packaged macOS Tauri WebView to `invoke('proxy_gateway_request')`. Defaults: dev `http://127.0.0.1:8088`, prod `https://workbench.axiomaticworld.com` |
| E2E | Playwright 1.60 (`Desktop Chrome`, `baseURL 127.0.0.1:4321`) | `pnpm --filter @axi/workbench e2e` |
| Tests | vitest 3.2 + jsdom 29 + @testing-library/{react,jest-dom,user-event} | `pnpm --filter @axi/workbench test` |
| CI | GitHub Actions on `ubuntu-latest`, Node 22, pnpm `action-setup@v4` | Jobs: `contracts` → `typecheck` → `test` (needs `build`) → `build` |
| Brand | "Dango-family" seven-member geometry from `shared/axi-ui/packages/tokens/tokens/admin.json` (worked on in current branch) | `Web favicon 使用七成员团子大家族主图` (verify-ui-contracts) |

## Project Layout

```text
axi-workbench-web/
├── README.md                          # Distribution README (English)
├── README.zh-CN.md                    # Distribution README (zh-CN mirror)
├── BUILD_INFO.json                    # Build provenance (commit, branch, artifact path)
├── pnpm-workspace.yaml                 # packages/* + foundation/axi-ui/packages/*
├── pnpm-lock.yaml
├── package.json                     # @axi/workbench-web v1.0.0
├── turbo.json                       # Tasks: build / dev / lint / type-check / test / clean
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.node.json
├── .gitattributes / .gitmessage
├── .github/workflows/ci.yml         # contracts → typecheck → test → build jobs
├── .githooks/{pre-commit,commit-msg,post-commit}
├── scripts/verify-ci-contracts.mjs   # Cross-checks package.json/turbo/workspace/CI
├── shared/axi-ui/                   # Vendored axiom-workbench monorepo fragments
│   ├── packages/{core,crud,presets,settings,shell,tokens,vite-plugin,widgets,addons}
│   ├── scripts/{clean-package-*,copy-package-*,build-if-needed}
│   └── tsconfig.base.json
├── packages/                        # Local package mirrors (workspace:* consumers)
│   ├── api-client/                  # @epap/api-client (axios + TanStack Query peer)
│   ├── schemas/                     # @axi/workstation-contracts (zod)
│   ├── types/                       # @epap/types (api/auth/events/route/sse/theme)
│   ├── utils/                       # @epap/utils (cn/date/string/storage, clsx+dayjs+tailwind-merge)
│   └── workbench-foundation/        # @axi/workbench-foundation (AuthProvider + LocaleProvider + icons + username)
├── apps/
│   └── workbench/                   # @axi/workbench — the Web admin SPA
│       ├── README.md
│       ├── package.json
│       ├── index.html               # <title>公理工作台</title>, favicons, root div
│       ├── vite.config.ts            # dev=127.0.0.1:5183; legal-document SSR dev plugin; /api & /control-plane proxies; React Query dedupe
│       ├── vitest.config.ts
│       ├── playwright.config.ts     # baseURL 127.0.0.1:4321, Desktop Chrome
│       ├── tsconfig.json + tsconfig.node.json
│       ├── vite.apiProxyTarget.ts   # env-driven proxy selector (VITE_API_PROXY_TARGET vs VITE_API_BASE_URL)
│       ├── public/{favicon.ico,favicon.svg,favicon-32.png,favicon-48.png,apple-touch-icon.png,login-default-avatar.jpg,login-qr-corner.png}
│       ├── scripts/{legal-page-html.mjs,prerender-legal.mjs,serve-local-https.mjs,verify-ui-contracts.mjs,forward-local-443.py}
│       ├── e2e/{handoff.spec.ts,login.spec.ts,personal-os.spec.ts}
│       ├── src/
│       │   ├── main.tsx             # createRoot + RuntimeErrorBoundary + tauriGateway
│       │   ├── App.tsx              # QueryClient + ConfigProvider(antd) + Axi providers + BrowserRouter
│       │   ├── index.css
│       │   ├── legal-ssr-entry.tsx  # /legal/terms, /legal/privacy server-rendered markup
│       │   ├── pages/{Home,Login,Register,AuthCallback,LegalDocument,CommandCenter,Projects,ProjectDetail,...admin,personal-os}
│       │   ├── layouts/MainLayout.tsx # AxiDashboardShell + tabs + breadcrumbs + theme + globalSearch
│       │   ├── contexts/AuthContext.tsx (re-export from foundation)
│       │   ├── components/{Auth,Icon,Layout,OneTimeCodeInput,WorkbenchIcon}
│       │   ├── lib/{tauriGateway.ts,shell.ts,breadcrumbs.ts,tabs.ts,navigationRegistry.ts,search-data.ts,floatingToolArrow.ts}
│       │   ├── hooks/useNavBadges.ts
│       │   ├── i18n/{index,locales/{zh-CN,en-US}}
│       │   ├── assets/icons/{actions,analytics,commerce,...}
│       │   ├── styles/, test/
│       └── dist/                    # vite build output
└── docs/
    ├── HANDOFF.md                   # 90-second takeover brief
    ├── VERIFICATION.md
    ├── project-docs.manifest.json
    └── logs/submit/2026{09,10}-*-*.md  # auto-submit logs
```

`shared/axi-ui/` 是 `workbench/axi-workbench/foundation/axi-ui` 包的一份快照，本地 registry 位于 `http://127.0.0.1:4873/`（Verdaccio）。

## Build & Install

```bash
# Install all workspace dependencies (frozen lockfile in CI)
pnpm install --frozen-lockfile   # or: pnpm install

# Run the contract verifier before any task claims green
pnpm verify:ci                   # scripts/verify-ci-contracts.mjs

# Build everything (Turbo pipeline with `dependsOn: ["^build"]`)
pnpm build

# Per-app dev / build / type-check
pnpm --filter @axi/workbench dev          # vite @ 127.0.0.1:5183
pnpm --filter @axi/workbench build        # tsc + vite build + node scripts/prerender-legal.mjs
pnpm --filter @axi/workbench type-check   # tsc --noEmit
pnpm --filter @axi/workbench test         # vitest run
pnpm --filter @axi/workbench test:coverage
pnpm --filter @axi/workbench e2e          # playwright (webServer pnpm dev on 4321)

# Cross-package contract enforcement
pnpm --filter @axi/workbench verify-ui-contracts.mjs
```

CI workflow 文件位于 `.github/workflows/ci.yml`，按顺序运行四个 job：

1. `contracts` — `pnpm install --frozen-lockfile` 然后 `pnpm verify:ci`。
2. `typecheck` — `pnpm install --frozen-lockfile` 然后 `pnpm type-check`（Turbo task）。
3. `test` — 依赖 `build`；`pnpm install --frozen-lockfile` 然后 `pnpm test`。
4. `build` — `pnpm install --frozen-lockfile` 然后 `pnpm build`（Turbo task；产出 `dist/**`）。

## Verification

```bash
# Cross-file contract gate
pnpm verify:ci

# Source-level contract gate (legal SSR, favicon, login window, capability set, plumb)
pnpm --filter @axi/workbench verify-ui-contracts

# Unit / component tests
pnpm test

# Playwright (e2e/handoff.spec.ts, login.spec.ts, personal-os.spec.ts)
pnpm --filter @axi/workbench e2e
```

`docs/project-docs.manifest.json` 中记录了源码清单断言（readOrder：`README.md`、`BUILD_INFO.json`、`package.json`；commands.verify `pnpm install --frozen-lockfile`；smoke `test -f BUILD_INFO.json`；截至 `2026-09-25` 状态 `unverified`）。

## Architecture Highlights

**单 SPA 管理后台并采用 Tauri 形态的启动流程。** `apps/workbench/src/main.tsx` 在挂载 React 根节点 *之前* 调用 `installTauriGatewayFetch()`，这样当后续把它打包进 Tauri WebView（桌面分发）时，`/api/*` 请求会被透明地通过 `tauri.invoke('proxy_gateway_request')` 路由到 loopback 或生产 gateway。在打包外的 WebView 中，`installTauriGatewayFetch()` 是 no-op（Tauri 内部守卫防止重复安装），因此同一份 `apps/workbench/dist/` 目录可以同时服务 Web 和桌面。

**Provider 树与 Web 管理后台的 Axi 壳层组合对应。** `App.tsx` 依次包裹 `AxiThemeProvider`（defaultPreference `dark`、defaultStylePreset `black-gold`、namespace `axi.workbench`）→ `AuthProvider`（来自 `@axi/workbench-foundation`）→ `WorkbenchLocaleProvider` → `WorkbenchSurface`，后者再组合 `AxiLocaleProvider`（附带 `axiShellLocaleContribution`、`axiSettingsLocaleContribution`、`axiCrudLocaleContribution`，回退 `zh-CN`）→ antd `ConfigProvider`（`createAxiAntdTheme(mode, preset, { borderRadius: 6 })`，locale `zh-CN` / `en-US`）→ `QueryClientProvider`（staleTime 5 min，retry 1）→ `I18nProvider` → `BrowserRouter`。路由分两区：公开（`/login`、`/register`、`/auth/callback`、`/legal/{terms,privacy}`）与 `RequireSession` 守护（`/admin/dashboard`、`/admin/personal-os/{today,workbench}`、`/admin/operations`、`/admin/project[/id]`、`/admin/task`、`/admin/team`、`/admin/handoff[/id]`、`/admin/search`、`/admin/me/*`、`/admin/settings/{menu,role}`）。

**持久化与壳层装饰。** `MainLayout.tsx` 组合 `AxiDashboardShell` 与 `AxiFloatingToolDock`，侧边导航分组（`workbenchDesktopNavGroupsWithKeys`）、持久化标签页（storage key `axi.workbench.tabs.v1`）、面包屑（`resolveBreadcrumbs`）、`GlobalSearchDialog`（`Cmd/Ctrl+K`）、`SystemSettingsPanel` 与 `AxiAdminSettingsPanel`。它通过 `emitShellUnread()`（`docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md §5`）将 `unreadCount` 推送给 Tauri 壳层。历史 scan 路由 `/admin/scan` 重定向到 `/admin/dashboard`；`admin/me/account` 与 `admin/me/settings` 分别重定向到 `admin/me` 与 `admin/me/theme`。

**Vite 配置防止端口冲突并强制 React Query dedupe。** `vite.config.ts` 绑定 `127.0.0.1:5183`（而非 `5173`），`strictPort: true`，暴露 `legalDocumentDevPlugin` 通过 `ssrLoadModule('/src/legal-ssr-entry.tsx')` SSR `/legal/terms` 和 `/legal/privacy`，并对 `react`、`react-dom`、`@tanstack/react-query` 做 `dedupe`，以保证打包 WebView 内 workspace 包的 peer 依赖指向同一模块实例。`/api` 代理目标由 `vite.apiProxyTarget.ts` 选定（优先级：`VITE_API_PROXY_TARGET` → `VITE_API_BASE_URL` → `http://127.0.0.1:8088`）；`/control-plane` 代理到 `http://localhost:8092`（或 `VITE_CONTROL_PLANE_PROXY_TARGET`），并重写 `/control-plane` 前缀。

**API client 是单一 axios 工厂，两个具名客户端。** `packages/api-client/src/client.ts` 导出 `apiClient`（baseURL = `VITE_API_BASE_URL || ""`）与 `controlPlaneClient`（baseURL = `VITE_CONTROL_PLANE_BASE_URL || "/api/v1/control-plane"`），都启用 `withCredentials: true` 与 `timeout: 30000`。401 处理交给上层而不是尝试从 localStorage 刷新 token —— gateway session 是 HttpOnly，应用在 cookie 缺失时跳转 OIDC。

**与桌面和移动分发跨包对齐。** 三个分发（`axi-workbench-web`、`axi-workbench-desktop`、`axi-workbench-mobile`）共享同一份 `@axi/workbench-foundation` 和 `@axi/workstation-contracts` 包身份，每个分发各自固定 workspace 镜像，使 cookie 锚点能在 Tauri / Web / Mobile 之间一致流动。`BUILD_INFO.json` 记录上游快照 commit（`workbench/axi-workbench` commit `cc83e5e01cf3110479ac7e96ca8aee7cacfe4113` on `dev`）以及分发 commit（`b5ad8e5c6d52d135a33934954a2744d2509c8175` on `main`）。

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| 初次分发脚手架 | Shipped | `7311a2d Initial commit: Axi Workbench Web distribution`；`package.json`（`@axi/workbench-web v1.0.0`） |
| CI 合约门禁 | Shipped | `f8ba1e0 feat: add CI workflows and verify:ci contracts`；`scripts/verify-ci-contracts.mjs` 交叉核对 `package.json` / `turbo.json` / `pnpm-workspace.yaml` / `.github/workflows/ci.yml` |
| Token 命名空间重命名收敛 | In progress | 当前分支 `feature/workbench-web-tokens-css-convergence`（working tree dirty）；近期提交 `2a636d0 chore(distribution): land tokens css convergence wave`、`a620648 refactor(workbench-web): rename --palette-* to --axi-wb-palette-*`、`a5085d8 fix(ci): ensure @axi/vite-plugin dist exists before test`、`8659e0f fix(ci): make turbo test depend on package own build`、`b69afe0 fix(ci): ensure test job runs after build job completes` |
| 构建来源快照 | Shipped | `BUILD_INFO.json`（`source.commit=cc83e5e01cf3110479ac7e96ca8aee7cacfe4113` on `dev`；`dist_commit=b5ad8e5c6d52d135a33934954a2744d2509c8175` on `main`；build_timestamp `2026-09-24T15:21:31Z`；artifact `apps/workbench/dist/`，entry `apps/workbench/dist/index.html`，size_kb_estimate 5500） |
| 治理 + 自动提交证据 | Shipped | `c1b5d6a feat(workbench-web): governance inspector + breadcrumb/tab refactor + verify docs`；`4849bc2 snapshot auto-submit + grouped-commit logs (chunk 1)`；`docs/logs/submit/2026{09,10}-*-*.md` |

## Authoritative Documents

- [`README.md`](/Volumes/code/workspace/distributions/axi-workbench-web/README.md) — distribution README (English)
- [`README.zh-CN.md`](/Volumes/code/workspace/distributions/axi-workbench-web/README.zh-CN.md) — distribution README (Chinese)
- [`package.json`](/Volumes/code/workspace/distributions/axi-workbench-web/package.json) — workspace root
- [`pnpm-workspace.yaml`](/Volumes/code/workspace/distributions/axi-workbench-web/pnpm-workspace.yaml) — workspace globs
- [`turbo.json`](/Volumes/code/workspace/distributions/axi-workbench-web/turbo.json) — Turbo task graph
- [`BUILD_INFO.json`](/Volumes/code/workspace/distributions/axi-workbench-web/BUILD_INFO.json) — build provenance
- [`docs/HANDOFF.md`](/Volumes/code/workspace/distributions/axi-workbench-web/docs/HANDOFF.md) — zero-context takeover brief
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/distributions/axi-workbench-web/docs/VERIFICATION.md) — verification snapshot
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/distributions/axi-workbench-web/docs/project-docs.manifest.json) — manifest source of truth
- [`scripts/verify-ci-contracts.mjs`](/Volumes/code/workspace/distributions/axi-workbench-web/scripts/verify-ci-contracts.mjs) — cross-file contract verifier
- [`.github/workflows/ci.yml`](/Volumes/code/workspace/distributions/axi-workbench-web/.github/workflows/ci.yml) — CI contract
- [`apps/workbench/README.md`](/Volumes/code/workspace/distributions/axi-workbench-web/apps/workbench/README.md) — app README
- [`apps/workbench/vite.config.ts`](/Volumes/code/workspace/distributions/axi-workbench-web/apps/workbench/vite.config.ts) — dev server + proxies + legal SSR
- [`apps/workbench/src/App.tsx`](/Volumes/code/workspace/distributions/axi-workbench-web/apps/workbench/src/App.tsx) — provider tree + route table
- [`apps/workbench/src/main.tsx`](/Volumes/code/workspace/distributions/axi-workbench-web/apps/workbench/src/main.tsx) — root + tauri gateway install
- [`apps/workbench/src/layouts/MainLayout.tsx`](/Volumes/code/workspace/distributions/axi-workbench-web/apps/workbench/src/layouts/MainLayout.tsx) — Axi Dashboard Shell composition
- [`apps/workbench/src/lib/tauriGateway.ts`](/Volumes/code/workspace/distributions/axi-workbench-web/apps/workbench/src/lib/tauriGateway.ts) — Tauri gateway fetch interceptor
- [`packages/workbench-foundation/src/index.ts`](/Volumes/code/workspace/distributions/axi-workbench-web/packages/workbench-foundation/src/index.ts) — foundation export surface
- [`packages/api-client/src/client.ts`](/Volumes/code/workspace/distributions/axi-workbench-web/packages/api-client/src/client.ts) — axios factory

## Cross-References

- 兄弟分发：[`axi-workbench-desktop-dist`](/Volumes/code/workspace/distributions/axi-workbench-desktop) — Tauri 2 macOS app，通过 `frontendDist` 消费 `apps/workbench/dist/`
- 兄弟分发：[`axi-workbench-mobile-dist`](/Volumes/code/workspace/distributions/axi-workbench-mobile) — Android（Kotlin Compose + JS Web 管理后台壳） + 独立的 `apps/workbench-mobile`
- 上游 monorepo：[`workbench/axi-workbench`](/Volumes/code/workspace/workbench/axi-workbench) — `apps/workbench`、`packages/*`、`foundation/axi-ui` 的源头
- 品牌合约源：`apps/workbench-shared/src/brand/favicon-geometry.json`（被桌面 + 移动 `verify-*-contracts.mjs` 引用）
- Spec：`docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md` §3（shell IPC）与 §5（Dock 红点 / tray 标题）