---
id: axi-docs-en-projects-axi-workbench-web-dist
title: Axi Workbench Web Distribution
type: project
status: published
tags: [Axi Docs, Projects, distributions, reference, workbench, web]
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

A standalone pnpm + Turbo monorepo that packages the Axi Workbench **Web admin** surface as an independent, buildable distribution. It re-exports the React 18 + Vite + antd 6 SPA, all shared workspace libraries (`@axi/core`, `@axi/crud`, `@axi/presets`, `@axi/settings`, `@axi/shell`, `@axi/tokens`, `@axi/widgets`, `@axi/workstation-contracts`, `@axi/workbench-foundation`), and the API/types/utils packages (`@epap/api-client`, `@epap/types`, `@epap/utils`). The web entry point is `apps/workbench`, which uses React Router, TanStack Query, Antd ConfigProvider, the Axi Dashboard Shell, and a Tauri-aware gateway fetch interceptor (`installTauriGatewayFetch()`) that the macOS client shares.

The bundle is sized to land at `apps/workbench/dist/` (~5.5 MB), the entry being `apps/workbench/dist/index.html` titled "公理工作台". The dev server listens on IPv4 `http://127.0.0.1:5183` (port `5173` is reserved for `axi-image-preview`), proxies `/api` to a Vite-selected backend (`VITE_API_PROXY_TARGET` / `VITE_API_BASE_URL`, default `127.0.0.1:8088`) and `/control-plane` to `http://localhost:8092`. CI is GitHub Actions (`contracts` → `typecheck` → `test` → `build`) on `main` and `dev`. The contract verifier (`scripts/verify-ci-contracts.mjs`) cross-checks `package.json`, `turbo.json`, `pnpm-workspace.yaml` and the workflow file before any task can claim success.

**Stage**: live product distribution, web-channel of the Axi Workbench trio (`web` / `desktop` / `mobile`); sibling distributions live under `/Volumes/code/workspace/distributions/axi-workbench-desktop` and `/Volumes/code/workspace/distributions/axi-workbench-mobile`.

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

The vendored `shared/axi-ui/` is a snapshot of `workbench/axi-workbench/foundation/axi-ui` packages, published locally at the registry `http://127.0.0.1:4873/` (Verdaccio).

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

The CI workflow file at `.github/workflows/ci.yml` runs four jobs sequentially:

1. `contracts` — `pnpm install --frozen-lockfile` then `pnpm verify:ci`.
2. `typecheck` — `pnpm install --frozen-lockfile` then `pnpm type-check` (Turbo task).
3. `test` — depends on `build`; `pnpm install --frozen-lockfile` then `pnpm test`.
4. `build` — `pnpm install --frozen-lockfile` then `pnpm build` (Turbo task; emits `dist/**`).

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

Source-manifest assertions recorded in `docs/project-docs.manifest.json` (readOrder: `README.md`, `BUILD_INFO.json`, `package.json`; commands.verify `pnpm install --frozen-lockfile`; smoke `test -f BUILD_INFO.json`; status `unverified` as of `2026-09-25`).

## Architecture Highlights

**Single SPA admin surface with Tauri-shaped bootstrapping.** `apps/workbench/src/main.tsx` calls `installTauriGatewayFetch()` *before* mounting the React root, so when the same bundle is later dropped into the Tauri WebView (desktop distribution), `/api/*` requests to the loopback or prod gateway get transparently routed through `tauri.invoke('proxy_gateway_request')`. Outside the packaged WebView, `installTauriGatewayFetch()` is a no-op (the Tauri internals guard prevents double install), so the same `apps/workbench/dist/` directory serves both Web and desktop.

**Provider tree mirrors the Web admin's Axi shell composition.** `App.tsx` wraps with `AxiThemeProvider` (defaultPreference `dark`, defaultStylePreset `black-gold`, namespace `axi.workbench`) → `AuthProvider` (from `@axi/workbench-foundation`) → `WorkbenchLocaleProvider` → `WorkbenchSurface` which then composes `AxiLocaleProvider` (with `axiShellLocaleContribution`, `axiSettingsLocaleContribution`, `axiCrudLocaleContribution`, fallback `zh-CN`) → antd `ConfigProvider` (`createAxiAntdTheme(mode, preset, { borderRadius: 6 })`, locale `zh-CN` / `en-US`) → `QueryClientProvider` (staleTime 5 min, retry 1) → `I18nProvider` → `BrowserRouter`. Routes are partitioned: public (`/login`, `/register`, `/auth/callback`, `/legal/{terms,privacy}`) and `RequireSession`-guarded (`/admin/dashboard`, `/admin/personal-os/{today,workbench}`, `/admin/operations`, `/admin/project[/id]`, `/admin/task`, `/admin/team`, `/admin/handoff[/id]`, `/admin/search`, `/admin/me/*`, `/admin/settings/{menu,role}`).

**Persistence / shell chrome.** `MainLayout.tsx` composes `AxiDashboardShell` with `AxiFloatingToolDock`, sidebar nav groups (`workbenchDesktopNavGroupsWithKeys`), persistent tabs (storage key `axi.workbench.tabs.v1`), breadcrumbs (`resolveBreadcrumbs`), `GlobalSearchDialog` (`Cmd/Ctrl+K`), `SystemSettingsPanel`, and `AxiAdminSettingsPanel`. It pushes `unreadCount` to the Tauri shell via `emitShellUnread()` (`docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md §5`). A historical scan route `/admin/scan` redirects to `/admin/dashboard`; `admin/me/account` and `admin/me/settings` redirect to `admin/me` and `admin/me/theme` respectively.

**Vite config gates port collision and forces React Query dedupe.** `vite.config.ts` binds `127.0.0.1:5183` (not `5173`) with `strictPort: true`, exposes a `legalDocumentDevPlugin` that SSRs `/legal/terms` and `/legal/privacy` via `ssrLoadModule('/src/legal-ssr-entry.tsx')`, and `dedupe`'s `react`, `react-dom`, `@tanstack/react-query` to keep workspace-package peer dependencies on the same module instance inside the packaged WebView. The `/api` proxy target is chosen by `vite.apiProxyTarget.ts` (priority: `VITE_API_PROXY_TARGET` → `VITE_API_BASE_URL` → `http://127.0.0.1:8088`); `/control-plane` proxies to `http://localhost:8092` (or `VITE_CONTROL_PLANE_PROXY_TARGET`) with `/control-plane` prefix rewritten.

**API client is one axios factory, two named clients.** `packages/api-client/src/client.ts` exports `apiClient` (baseURL = `VITE_API_BASE_URL || ""`) and `controlPlaneClient` (baseURL = `VITE_CONTROL_PLANE_BASE_URL || "/api/v1/control-plane"`), both `withCredentials: true` and `timeout: 30000`. 401 handling is delegated to the app layer rather than attempting to refresh a token from localStorage — the gateway session is HttpOnly, so the app redirects to OIDC on missing cookies.

**Cross-package parity with the desktop and mobile distributions.** All three distributions (`axi-workbench-web`, `axi-workbench-desktop`, `axi-workbench-mobile`) share the same `@axi/workbench-foundation` and `@axi/workstation-contracts` package identities, with each distribution pinning its workspace mirror so the runtime cookie pin flows across Tauri / Web / Mobile consistently. The `BUILD_INFO.json` records the upstream snapshot commit (`workbench/axi-workbench` commit `cc83e5e01cf3110479ac7e96ca8aee7cacfe4113` on `dev`) and the dist commit (`b5ad8e5c6d52d135a33934954a2744d2509c8175` on `main`).

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| Initial distribution scaffold | Shipped | `7311a2d Initial commit: Axi Workbench Web distribution`; `package.json` (`@axi/workbench-web v1.0.0`) |
| CI contract gate | Shipped | `f8ba1e0 feat: add CI workflows and verify:ci contracts`; `scripts/verify-ci-contracts.mjs` cross-checks `package.json` / `turbo.json` / `pnpm-workspace.yaml` / `.github/workflows/ci.yml` |
| Token-namespace rename convergence | In progress | Current branch `feature/workbench-web-tokens-css-convergence` (working tree dirty); recent commits `2a636d0 chore(distribution): land tokens css convergence wave`, `a620648 refactor(workbench-web): rename --palette-* to --axi-wb-palette-*`, `a5085d8 fix(ci): ensure @axi/vite-plugin dist exists before test`, `8659e0f fix(ci): make turbo test depend on package own build`, `b69afe0 fix(ci): ensure test job runs after build job completes` |
| Build provenance snapshot | Shipped | `BUILD_INFO.json` (`source.commit=cc83e5e01cf3110479ac7e96ca8aee7cacfe4113` on `dev`; `dist_commit=b5ad8e5c6d52d135a33934954a2744d2509c8175` on `main`; build_timestamp `2026-09-24T15:21:31Z`; artifact `apps/workbench/dist/`, entry `apps/workbench/dist/index.html`, size_kb_estimate 5500) |
| Governance + auto-submit evidence | Shipped | `c1b5d6a feat(workbench-web): governance inspector + breadcrumb/tab refactor + verify docs`; `4849bc2 snapshot auto-submit + grouped-commit logs (chunk 1)`; `docs/logs/submit/2026{09,10}-*-*.md` |

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

- Sibling distribution: [`axi-workbench-desktop-dist`](/Volumes/code/workspace/distributions/axi-workbench-desktop) — Tauri 2 macOS app consuming `apps/workbench/dist/` via `frontendDist`
- Sibling distribution: [`axi-workbench-mobile-dist`](/Volumes/code/workspace/distributions/axi-workbench-mobile) — Android (Kotlin Compose + JS Web admin shell) + independent mobile JS at `apps/workbench-mobile`
- Upstream monorepo: [`workbench/axi-workbench`](/Volumes/code/workspace/workbench/axi-workbench) — source of `apps/workbench`, `packages/*`, `foundation/axi-ui`
- Brand contract source: `apps/workbench-shared/src/brand/favicon-geometry.json` (referenced by desktop + mobile `verify-*-contracts.mjs`)
- Spec: `docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md` §3 (shell IPC) and §5 (Dock red points / tray title)