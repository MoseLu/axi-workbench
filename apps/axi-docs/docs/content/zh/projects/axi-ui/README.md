---
id: axi-docs-zh-projects-axi-ui
title: Axi UI
type: project
status: published
tags: [Axi Docs, 项目, foundation, shared-ui]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi UI
graph-tags: [Projects, foundation, shared-ui]
description: Workspace-level UI runtime for axiomaticworld / Axi applications. Nine `@axi/*` packages (tokens, presets, icons, core, widgets, shell, settings, crud, addons) plus a `@axi/vite-plugin` and a private Gallery management backend at http://127.0.0.1:17920/. Canonical visual baseline is Black Gold; tokens and core own the runtime, consumers add their own CRUD and routing.
project:
  id: axi-ui
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-ui
  source-section: shared
---

# Axi UI

> 项目根 `README.md` 和 `INDEX.md` 镜像。事实源：
> [`/Volumes/code/workspace/foundation/axi-ui/README.md`](/Volumes/code/workspace/foundation/axi-ui/README.md)、
> [`/Volumes/code/workspace/foundation/axi-ui/INDEX.md`](/Volumes/code/workspace/foundation/axi-ui/INDEX.md)。
> Section: shared-ui / Partition: `foundation/`。

## Summary

`axi-ui` 是 axiomaticworld / Axi 应用的工作区级 UI runtime。它是一个 pnpm workspace，包含九个 `@axi/*` 包，外加一个 companion Vite 插件（`@axi/vite-plugin`）和一个私有 Gallery management backend（`gallery/`）。规范视觉基线为 **Black Gold**，由 `@axi/tokens`（preset 合约）和 `@axi/core`（runtime provider、persistence、exposure）所有；consumer host 被明确禁止维护并行的 theme registry。重型可选面（rich text、charts、Excel、video、image crop、QR code、reasoning-state visualizers）被封装在 `@axi/addons` 内，使得默认 administration shell 不会拉入 editor、charting、spreadsheet 或 media 依赖，除非某个页面显式 import。

**Stage**：live project, shared foundation。
**Canonical path**：`/Volumes/code/workspace/foundation/axi-ui`。
**Workspace version**：`0.2.1`（根），package 版本独立管理 —— `@axi/tokens@0.2.0`、`@axi/presets@0.1.0`、`@axi/icons@0.2.1`、`@axi/core@0.2.1`、`@axi/widgets@0.1.0`、`@axi/shell@0.3.0`、`@axi/settings@0.1.0`、`@axi/crud@0.3.0`、`@axi/addons@0.1.0`、`@axi/vite-plugin@0.1.0`。所有包都通过 `publishConfig.registry` 发布到本地 Verdaccio registry `http://127.0.0.1:4873/`。

分支策略：`main` 承载可发布构建；`dev` 承载日常集成。当前工作树在 `dev` 上领先 `origin/dev` 55 commits（audit-remediation tail 与重构在途）。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Workspace root | pnpm 10.33.2, Node.js, TypeScript 6 | `pnpm-workspace.yaml` globs `gallery` and `packages/*`; store at `/tmp/axi-ui-pnpm-store` |
| React runtime | React 19.2, React-DOM 19.2 (peer `>=18 <20`) | Ant Design 6.4 as the peer design system |
| Token compile | Node `scripts/build-tokens.mjs`, `scripts/build-app-icons.mjs` | Generates CSS variables, SCSS variables, Tailwind theme, TS tokens, brand SVG / PNG manifest |
| Bundler | `@axi/vite-plugin` (`axi()` factory) + `@vitejs/plugin-react` | chunk-split, chunk-guard, EPS codegen, virtual modules, modules graph |
| Runtime services | Fastify 5, Postgres (`pg`), JOSE (`jose`) for tokens | Live only inside Gallery; packages stay framework-agnostic |
| Local registry | Verdaccio via `foundation/axi-registry` | `publishConfig.registry = http://127.0.0.1:4873/` per package |
| Gallery (admin backend) | Vite 7 dev/preview, Fastify backend in `gallery/backend/`, Remotion 4 for Component Library visualizer | Local port `17920` (hardcoded); preference API on its own process |
| Visualizer / docs | Remotion Player + React 19 | `gallery/src/gallery-component-library.tsx` renders the catalog with one scene per exported component |
| i18n | Per-package `locale/` folder with `axiCrudLocaleContribution` / `axiCoreLocaleContribution` / etc. | `@axi/core` provides SSR-safe `AxiLocaleProvider` and `useAxiLocale`; `gallery` resolves the URL / preference / `Accept-Language` outside the UI library |

## Project Layout

```text
axi-ui/
├── AGENTS.md                  # workspace governance + relationship metadata
├── README.md                  # English entrypoint and quickstart
├── README.zh-CN.md            # Simplified Chinese mirror
├── INDEX.md / INDEX.zh-CN.md  # document map (authoritative)
├── CONSUMPTION-GUIDE.md       # per-package export + workbench integration guide
├── CHANGE.md / CHANGELOG.md   # root pointer + canonical docs/state/CHANGELOG.md
├── SECURITY.md                # security reporting and secret handling
├── PRD.md                     # project charter (Chinese)
├── CLAUDE.md                  # one-line pointer to AGENTS.md
├── package.json               # workspace scripts (build, test, publish, check)
├── pnpm-workspace.yaml        # gallery + packages/*
├── tsconfig.base.json
├── packages/
│   ├── tokens/                # @axi/tokens (DAG root; CSS/SCSS/Tailwind/TS outputs)
│   ├── presets/               # @axi/presets (Black Gold / Minimal / Cyber / Glass)
│   ├── icons/                 # @axi/icons (admin icon system; admin + locale)
│   ├── core/                  # @axi/core (theme runtime, auth, module host, branding)
│   ├── widgets/               # @axi/widgets (business-neutral + Ant wrappers)
│   ├── shell/                 # @axi/shell (dashboard chrome, navigation)
│   ├── settings/              # @axi/settings (settings panel + admin preferences)
│   ├── crud/                  # @axi/crud (CRUD runtime + locale contributions)
│   ├── addons/                # @axi/addons (heavy optional surfaces)
│   └── vite-plugin/           # @axi/vite-plugin (chunks, modules, EPS, virtual)
├── gallery/                   # private management backend + Component Library visualizer
│   ├── backend/               # Go Fastify API (axi-gallery-api)
│   ├── preferences-api/       # admin preferences service
│   ├── axi-modules/           # typed catalog + module registry
│   ├── components/            # gallery component visuals
│   ├── features/              # feature-level helpers (audit, observer, etc.)
│   ├── app/                   # app shell composition
│   ├── pages/                 # GalleryPanel / system-settings / catalog preview
│   └── gallery-*.tsx/.ts/.css # typed resource panels
├── docs/
│   ├── state/                 # PRD, TDD, TODO, MILESTONE, CHANGELOG, VERIFICATION, TOKENS_INDEX
│   ├── modules/<id>/PRD.md    # living PRDs for visual-baseline, shell, gallery, settings, crud, addons, core, icons
│   ├── architecture/          # feature-architecture.md, css-ownership.json, dependency-policy.json, ui-aesthetic-rules.md
│   ├── axi-ui/                # generated PUBLIC_API.md, COMPONENTS.md, SCENES.md, RELEASES.md, snapshots
│   ├── specs/<date-slug>/     # closed lifecycle specs (Black Gold panel, JSDoc passes, etc.)
│   ├── brand/                 # Axi Instrument Glass app-icon contract
│   ├── governance/            # SECURITY, THIRD_PARTY_NOTICES
│   ├── testing/               # frontend-testing-standard.md, frontend-test-contract.json
│   ├── audits/                # point-in-time scan reports
│   ├── project-docs.manifest.json
│   └── HANDOFF.md
└── scripts/                   # check-*, build-*, refresh-public-api, install-git-hooks
```

## Build & Install

```bash
# Install
pnpm install

# Build every package in DAG order (tokens → presets → icons → core → widgets → shell → settings → crud → addons → vite-plugin)
pnpm build

# Build the Gallery
pnpm build:gallery

# Local Verdaccio publishing (one-time `apm`-equivalent registry start in foundation/axi-registry)
cd /Volumes/code/workspace/foundation/axi-registry && npm start
cd /Volumes/code/workspace/foundation/axi-ui
pnpm publish:local:tokens
pnpm publish:local:presets
pnpm publish:local:icons
pnpm publish:local:core
pnpm publish:local:shell
pnpm publish:local:settings
pnpm publish:local:crud
pnpm publish:local:widgets
pnpm publish:local:addons
pnpm publish:local:vite-plugin
```

## Verification

```bash
# Source-of-truth checks (run after edits)
pnpm check:file-lines              # 600-line per-source-file guard
pnpm typecheck                     # pnpm -r --if-present typecheck
pnpm test                          # token, css-arch, ui-aesthetic, jsdoc, module-docs, arch, inventory, build, css-parity, i18n-budget, runtime tests, gallery tests, gallery build
pnpm check:module-docs             # every package has a PRD.md / DECISIONS.md under docs/modules/
pnpm check:ui-aesthetic            # UI aesthetic contract audit (use --strict for new visual surfaces)
pnpm check:design-tokens           # token JSON validation (admin.json + app-icons.json)
pnpm check:component-inventory     # drift detection against docs/axi-ui/component-inventory.snapshot.json
pnpm docs:check                    # PUBLIC_API drift vs docs/axi-ui/COMPONENTS.md → docs/audits/public-api-drift-<date>.md

# Regenerate generated docs
pnpm docs:refresh-public-api
pnpm build:indexes
pnpm build:component-inventory

# Monorepo-consumer gates (run from the consuming app's root)
node /Volumes/code/workspace/foundation/axi-ui/scripts/check-design-tokens.mjs --root <consumer-app>
node /Volumes/code/workspace/foundation/axi-ui/scripts/check-ui-aesthetic.mjs --root <consumer-app> --strict
node /Volumes/code/workspace/foundation/axi-ui/scripts/check-css-architecture.mjs --root <consumer-app> --policy ./css-ownership.json
node /Volumes/code/workspace/foundation/axi-ui/scripts/check-module-budget.mjs --root <consumer-app> --skip-runtime
```

## Architecture Highlights

运行时被构造为严格的依赖 DAG，`@axi/tokens` 为根；三个下游包仅依赖 `tokens`（`presets`、`core`、`vite-plugin`）；随后是四个消费 `core` 的叶子包（`widgets`、`shell`、`settings`、`crud`、`addons`）。`@axi/vite-plugin` 是唯一不 import 任何 sibling 的包 —— 它承载构建 pipeline，用于 host 其余包（`axi()` factory 把 `chunks`、`chunkGuard`、`modules`、`virtual`、`eps` 插件串起来）。`@axi/crud` 是唯一横向触达 `@axi/widgets` 的包（让 `AxiNumberRange` / `AxiDictOption` / `findAxiDictItem` 的合并落在最低的共享面，而不是 CRUD）。这个形状由 `docs/architecture/feature-architecture.md` 固定：feature-oriented 目录（`features/<name>`）在包内部使用，而 Gallery 采用瘦 application composition（`app/`、`pages/`、`features/`、`shared/`）。

Black Gold 视觉基线是一个 **token 合约**，而非 CSS 文件。canonical JSON 位于 `packages/tokens/tokens/admin.json`（包含 theme preset 块、color spectrum、sidebar / bar dimensions、typography、spacing、radius、shadow、breakpoint、motion）。`packages/tokens/scripts/build-tokens.mjs` 输出 CSS variables、SCSS variables、Tailwind 4 `@theme`，以及 TS 模块加上 brand manifest。CSS、Tailwind、SCSS、TS subpath 通过 `packages/tokens/package.json` 的 `exports` 暴露。Black Gold Dashboard Shell —— topbar、breadcrumb、sidebar、route-tab、message / notification 面板、content fullscreen —— 落在 `@axi/shell/src/dashboard-shell*` 与 navigation feature 文件夹；逐 `Axi*` export 从 `packages/shell/src/index.ts` 的 navigation feature surface 重新导出。theme、locale、fast-enter、dashboard actions 的本地开关以 `AxiPlugin` factory 形式暴露在 `packages/shell/src/plugins.tsx`。

Theming 集中在 `@axi/core/src/capabilities/theme/`。runtime 导出 `AxiThemeProvider`、`useAxiTheme`、`useAxiOptionalTheme`、`applyAxiTheme`、`applyAxiAppearance`、`resolveAxiThemePreference`、`createAxiAntdTheme`，以及 `AxiThemeContextValue`、`AxiResolvedAppearance`、`AxiThemePreset` 类型 token。preset 元数据由 `@axi/presets` 拥有（`axiStylePresets`、`axiStylePresetIds` = `black-gold`、`minimal`、`cyber`、`glass`）；把 preset 套到 DOM 上是 `@axi/core` 的工作，而不是 preset 包本身，因此 registry 保持纯数据。auth 与可选 `AxiHostedApp` 上下文同样位于 `@axi/core`，使得 shell 可以读取 hosted-app 元数据而不会把 desktop / port-allocation 关注点泄漏到 runtime。

**Trusted module host** 位于 `@axi/core/src/module/`，允许 consumer 通过 `defineAxiModule({ routes, navigation, slots, commands, settings, themes, crudExtensions, locale })` 注册一个 module，并通过 host adapter 桥接。`createAxiModuleHost` 是 SSR-safe mount；可选的 Vite 插件（`@axi/vite-plugin` → `createAxiModulesPlugin`）输出可审计的 module graph 与独立的 feature chunk。**故意不支持** remote / uploaded code execution。`@axi/core/src/locale/` 新增 `AxiLocaleProvider`、`useAxiLocale`、`format`、`resolve`、typed contributions 以及严格的 `__tests__` 验证器，因此每个 package 都拥有 namespace 化的 `zh-CN` 与 `en-US` locale contribution（如 `@axi/crud` 的 `axiCrudLocaleContribution`）。

Gallery 是 Axi UI management backend。`gallery/src/gallery-admin-home.tsx` 是 Overview 入口，展示 component-asset 计数、package health、verification 状态、adoption 趋势以及到 typed resource panel 的 shortcut。每个 typed UI panel 共享同一三层 Dashboard Shell（domain group → category → concrete resource）。Theme Presets 是四个内置样式的目录，而非 theme-composition 编辑器；System Settings 仍然承担通用行为、theme 检查、shortcut、notifications / messages、storage 与 about。`@remotion/player` + `remotion` 集成被 `gallery-component-library.tsx` 用于为每个导出 component 渲染一个场景（spec `2026-09-14-remotion-component-visualizer`）；drift 检查位于 `gallery/test/visualizer-smoke.test.mjs` 与 `drift-check.test.mjs`。

## Key Modules/Files

| Path | Role |
| --- | --- |
| `packages/tokens/tokens/admin.json` | Canonical Black Gold preset JSON (color, layout, typography, spacing, radius, shadow, breakpoint, motion) |
| `packages/tokens/tokens/app-icons.json` | Axi Instrument Glass app-icon registry |
| `packages/tokens/scripts/build-tokens.mjs` | Emits CSS / SCSS / Tailwind / TS / brand manifest outputs |
| `packages/tokens/scripts/build-app-icons.mjs` | Generates `brand/app-icons/manifest.json` + SVG / PNG |
| `packages/tokens/package.json` | `exports` map: `./css`, `./tailwind.css`, `./scss`, `./ts`, `./brand/*` |
| `packages/presets/src/index.ts` | `axiStylePresets`, `axiStylePresetIds = [black-gold, minimal, cyber, glass]`; pure data only |
| `packages/icons/package.json` | `@axi/icons@0.2.1`, admin icon source + locale contributions |
| `packages/core/src/index.ts` | Aggregates `auth`, `branding`, `feedback`, `hosted-app`, `hooks`, `page`, `next`, `tag`, `text-scroll`, `watermark`, `cards`, `context-menu`, `count-to`, `module/`, `capabilities/theme/`, `types` |
| `packages/core/src/auth.tsx` | `AxiAuthState`, `AxiAuthUser`, `useAxiAuth`, `AxiAuthProvider`; `hasPermission(perm\|perms[])` checks the union of permissions and roles |
| `packages/core/src/branding.tsx` | `AxiLogoMark`, `AxiAppIcon`, `AxiBrandingFlower` (legacy) — dango-family PNG inside stable SVG box |
| `packages/core/src/hosted-app.tsx` | `useAxiHostedApp` — lightweight host-context for components running inside an Axi Dashboard host |
| `packages/core/src/capabilities/theme/index.ts` | `AxiThemeProvider`, `useAxiTheme`, `applyAxiAppearance`, `resolveAxiThemePreference`, `createAxiAntdTheme`, `axiThemePresets`, `axiHostThemeEventName` |
| `packages/core/src/module/{define,host,registry,resolve,bridge,conformance,error-boundary,types}.ts` | Trusted local-module API and host bridge |
| `packages/core/src/locale/{context.tsx,format.ts,hooks.tsx,messages.ts,resolve.ts,types.ts}` | `AxiLocaleProvider`, `useAxiLocale`, namespaced contributions |
| `packages/core/src/hooks.ts` | `useAxiBoolean`, `useAxiDisclosure`, `useAxiControllableState`, `useAxiLocalStorageState` |
| `packages/shell/src/index.ts` | Aggregates dashboard chrome, navigation features (`AxiShell`, `AxiSidebar`, `AxiTopbar`, `AxiBreadcrumb`, `AxiTabbar`, `AxiGlobalSearch`, `AxiNotificationPanel`, `AxiMessagePanel`) |
| `packages/shell/src/dashboard-shell*.tsx` | Three-level shell composition + helpers + nav helpers + types |
| `packages/shell/src/plugins.tsx` | `createAxiThemePlugin`, `createAxiLocalePlugin`, `createAxiUserInfoPlugin`, `createAxiFastEnterPlugin`, `createAxiNotificationsPlugin`, `createAxiMessagesPlugin`; `axiShellPluginSlots` |
| `packages/shell/src/features/navigation/index.ts` | All `Axi*` navigation exports (Breadcrumb, Sidebar, SideMenu, Topbar, HeaderBar, MainLayout, PageContent, ViewContainer, RouteTabs, Notification / Message panels, GlobalSearch, ThemeSwitcher, LocaleSwitcher, StatusPill, etc.) |
| `packages/shell/src/contributions.ts` | `axiShellLocaleContribution` (zh-CN / en-US) |
| `packages/crud/src/index.ts` | Aggregates `features/data-workflow/index.ts` — `AxiCrud`, `AxiCrudLayout`, `AxiTable`, `AxiForm`, `AxiDialog`, `AxiPagination`, `AxiSearch`, `AxiSearchBar`, `AxiUpload`, `AxiUpsert`, `useAxiCrud`, `useAxiCrudActions`, `useAxiCrudForm`, `useAxiCrudPagination`, `useAxiCrudQuery`, `useAxiCrudSearch`, `useAxiCrudSelection`, `useAxiCrudState`, `useAxiCrudTable`, `useAxiCrudTranslation`, `createDefaultDict`, `defaultAxiTranslate`, `findDictItem`, `mergeDict`, `normalizePageResponse`, `toRowKey` |
| `packages/crud/src/contributions.ts` | `axiCrudLocaleContribution`, `axiCrudZhCNLocaleMessages`, `axiCrudEnUSLocaleMessages` |
| `packages/widgets/src/index.ts` | `controls.tsx` (Ant Design wrappers), `management.tsx`, `types.ts`, `utils.ts` |
| `packages/settings/src/index.ts` | `AxiSettingsPanel`, `AxiAdminSettingsPanel`, `AxiAdminSettingsContent`, `AxiSettingsSection`, `AxiSettingsLayoutSection`, `AxiSettingsCompactRow`, `AxiSettingsFieldRow`, `AxiSettingsSwitchRow`, `AxiSettingsSegmented`, `AxiSettingsChoice`, `AxiSettingsThemeSection`, `applyAxiAdminSettingsToDocument`, `createAxiPreferenceSyncAdapter`, `useAxiAdminSettings`, `useAxiSettingsPanel`, `useAxiStylePresetEffect`, `normalizeAxiAdminSettings`, `axiAdminPreviewAssets`, `axiAdminSettingsDefaults`, `AxiPreferenceSyncError` |
| `packages/addons/src/index.ts` | Aggregates `chart`, `excel`, `image-cropper`, `qr-code`, `reasoning-switcher`, `rich-text`, `video-player`, `media-preview`, `locale` |
| `packages/addons/src/reasoning-switcher/` | `AxiReasoningSwitcher` with WebGL2 shaders for live energy surface; DOM/Canvas fallback |
| `packages/vite-plugin/src/index.ts` | `axi(options)` factory + `createAxiVitePlugin` alias |
| `packages/vite-plugin/src/{chunks,chunkGuard,modules,virtual,eps}.ts` | Per-plugin factories wired into `axi()` |
| `gallery/package.json` | `@axi/gallery` private; Fastify backend, Remotion Player, Postgres-backed preferences |
| `gallery/src/gallery-admin-home.tsx` | Gallery management-backend Overview |
| `gallery/src/gallery-component-library.tsx` | Remotion-driven per-component scene player + drift checks |
| `gallery/src/gallery-system-settings.tsx` | System Settings dialog with category navigation |
| `gallery/src/gallery-catalog.tsx` / `gallery-catalog.ts` | Typed resource catalogs (Black Gold / Minimal / Cyber / Glass presets, components, packages) |
| `gallery/backend/` | Go Fastify-based `axi-gallery-api` (`pnpm api:dev`) |
| `gallery/preferences-api/server.mjs` | Admin preferences API on a separate Node process |
| `scripts/build-indexes.mjs` | Regenerates `docs/axi-ui/public-api.snapshot.json` + `components-index.json` |
| `scripts/check-{design-tokens,css-architecture,ui-aesthetic,module-docs,component-inventory,architecture,jsdoc,file-lines,i18n-budget}.mjs` | Source-of-truth gates |
| `docs/modules/index.json` | Living-PRD router (`visual-baseline`, `shell`, `gallery`, `core`, `settings`, `crud`, `addons`, `widgets`, `icons`) with `priority` + `reqPrefix` + `invPrefix` |
| `docs/state/TDD.md` | Authoritative verification + minimum documentation check |
| `docs/state/PRD.md` | Project charter, REQ-DOC, REQ-VERIFY, REQ-BOUNDARY, REQ-MILESTONE, REQ-THEME-001 |
| `docs/architecture/feature-architecture.md` | Hybrid package + feature-directory model decision |
| `docs/architecture/ui-aesthetic-rules.md` | Translating subjective "premium / Apple-like" asks into measurable contracts |
| `docs/architecture/css-ownership.json` | Machine-readable CSS ownership table |
| `docs/architecture/dependency-policy.json` | Machine-readable package + Gallery dependency policy |
| `docs/brand/app-icons.md` | Axi Instrument Glass style, P0 app prompt list, asset workflow |
| `docs/specs/` | Closed lifecycle specs (Black Gold panel 2026-07-15; JSDoc passes 2026-07-24/25; i18n coverage 2026-07-25; Remotion visualizer 2026-09-14) |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Milestone 0 | Black Gold Core (tokens + theme runtime) | Complete (2026-07-28 evidence); `axi-design` retired |
| Milestone 0.5 | Black Gold Menu Panel + Gallery three-level shell | Complete |
| Milestone 0.6 | Connected Dashboard Chrome (breadcrumb, tabs, notifications, Escape-safe fullscreen) | Complete |
| Visual Baseline Delivery | P0 theme + tokens + dashboard shell | Verified 2026-07-28; `MILESTONE.md` records exit criteria |
| Black Gold preset | `@axi/tokens` ships preset + `@axi/core` applies as default dark | Verified locally, scoped audit-remediation tail in flight |
| Gallery Black Gold management backend | `gallery/src/gallery-admin-home.tsx` + typed resource catalogs | Live (spec `2026-07-15-black-gold-panel` closed) |
| Component Library visualizer | Remotion-driven per-component scene player | Live (spec `2026-09-14-remotion-component-visualizer`); drift gate in `gallery/test/drift-check.test.mjs` |
| JSDoc coverage gate | `pnpm check:jsdoc` over `@axi/settings`, `@axi/core`, `@axi/shell`, `@axi/vite-plugin`, `@axi/crud`, `@axi/widgets`, `@axi/addons`, `@axi/presets` | Closed (2026-07-24 → 2026-07-25 spec set); wired into pre-push hook and VS Code task |
| Module docs gate | `pnpm check:module-docs` ensures every package has `docs/modules/<id>/PRD.md` + `DECISIONS.md` | Live; deferred modules tracked under `REQ-DOC-002` |
| i18n | per-package `axiXxxLocaleContribution` + namespaced `t("axiXxx.key")` callsites + `<= 0.1` per-package i18n budget | Live (`check:i18n:budget`); spec `2026-07-25-axi-i18n-package-contributions` closed |
| Public-API drift | `docs/refresh-public-api` + `docs/audits/public-api-drift-<date>.md` | Live; latest drift report at `docs/audits/public-api-drift-2026-10-07.md` |
| Settings + CRUD P1 module PRDs | living design-of-record | P1; PRD + DECISIONS under `docs/modules/{settings,crud}/` |

详见 `docs/state/MILESTONE.md`（权威列表）与 `docs/axi-ui/MILESTONE.md`（frozen M1–M7 rewrite history）。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-ui/AGENTS.md) — workspace rules, component-index quick entry, verification, relationship metadata
- [`README.md`](/Volumes/code/workspace/foundation/axi-ui/README.md) — packages, Black Gold baseline, Gallery at `:17920`, local Verdaccio publish
- [`INDEX.md`](/Volumes/code/workspace/foundation/axi-ui/INDEX.md) — authoritative document map + package DAG + integration guide pointer
- [`INDEX.zh-CN.md`](/Volumes/code/workspace/foundation/axi-ui/INDEX.zh-CN.md) — Simplified Chinese mirror
- [`CONSUMPTION-GUIDE.md`](/Volumes/code/workspace/foundation/axi-ui/CONSUMPTION-GUIDE.md) — per-package exports + axiom-workbench integration walkthrough
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-ui/CHANGE.md) — root change log pointer
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-ui/CHANGELOG.md) — visible behaviour changes
- [`SECURITY.md`](/Volumes/code/workspace/foundation/axi-ui/SECURITY.md) — secret handling + reporting policy
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-ui/PRD.md) — project charter (Chinese)
- [`CLAUDE.md`](/Volumes/code/workspace/foundation/axi-ui/CLAUDE.md) — one-line pointer
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-ui/docs/HANDOFF.md) — zero-context takeover brief (generated from `docs/project-docs.manifest.json`)
- [`docs/INTEGRATION.md`](/Volumes/code/workspace/foundation/axi-ui/docs/INTEGRATION.md) — new-project integration guide (scenario matrix, dependency order, hello world, Verdaccio wiring)
- [`docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/PRD.md) — project charter, global non-goals, REQ-* / module index
- [`docs/state/TDD.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/TDD.md) — technical design + minimum documentation check + verification
- [`docs/state/TODO.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/TODO.md) — requirement-linked task queue
- [`docs/state/MILESTONE.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/MILESTONE.md) — delivery milestone + evidence
- [`docs/state/CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/CHANGELOG.md) — authoritative human-visible change log
- [`docs/state/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/VERIFICATION.md) — dated verification log entries
- [`docs/state/TOKENS_INDEX.md`](/Volumes/code/workspace/foundation/axi-ui/docs/state/TOKENS_INDEX.md) — human-readable inventory of `@axi/tokens`
- [`docs/modules/index.json`](/Volumes/code/workspace/foundation/axi-ui/docs/modules/index.json) + `docs/modules/<id>/PRD.md` — living module PRDs
- [`docs/architecture/feature-architecture.md`](/Volumes/code/workspace/foundation/axi-ui/docs/architecture/feature-architecture.md) — package + feature-directory hybrid model
- [`docs/architecture/css-ownership.json`](/Volumes/code/workspace/foundation/axi-ui/docs/architecture/css-ownership.json) — machine-readable CSS ownership
- [`docs/architecture/dependency-policy.json`](/Volumes/code/workspace/foundation/axi-ui/docs/architecture/dependency-policy.json) — machine-readable dependency policy
- [`docs/architecture/ui-aesthetic-rules.md`](/Volumes/code/workspace/foundation/axi-ui/docs/architecture/ui-aesthetic-rules.md) — measurable visual contracts
- [`docs/axi-ui/PUBLIC_API.md`](/Volumes/code/workspace/foundation/axi-ui/docs/axi-ui/PUBLIC_API.md) — rendered public component / hook / function / type / constant list
- [`docs/axi-ui/COMPONENTS.md`](/Volumes/code/workspace/foundation/axi-ui/docs/axi-ui/COMPONENTS.md) — exported component / hook / plugin inventory
- [`docs/axi-ui/SCENES.md`](/Volumes/code/workspace/foundation/axi-ui/docs/axi-ui/SCENES.md) — components grouped by scene
- [`docs/axi-ui/RELEASES.md`](/Volumes/code/workspace/foundation/axi-ui/docs/axi-ui/RELEASES.md) — local package release history
- [`docs/axi-ui/MILESTONE.md`](/Volumes/code/workspace/foundation/axi-ui/docs/axi-ui/MILESTONE.md) — frozen M1–M7 rewrite history
- [`docs/brand/app-icons.md`](/Volumes/code/workspace/foundation/axi-ui/docs/brand/app-icons.md) — Axi Instrument Glass style + asset workflow
- [`docs/testing/frontend-testing-standard.md`](/Volumes/code/workspace/foundation/axi-ui/docs/testing/frontend-testing-standard.md) — L0–L4 frontend testing standard
- [`docs/testing/frontend-test-contract.json`](/Volumes/code/workspace/foundation/axi-ui/docs/testing/frontend-test-contract.json) — named critical flows mapped to concrete tests
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/foundation/axi-ui/docs/project-docs.manifest.json) — v2 handoff manifest source
- `packages/<pkg>/package.json` + `packages/<pkg>/README.md` — per-package manifest, exports, description

## Cross-References

- Workspace root entrypoint: `/Volumes/code/workspace/AGENTS.md` and `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance`
- Workspace registry / project graph: `/Volumes/code/workspace/workspace.graph.json`, `scripts/workspace-project list`
- Relationship metadata as a Provider — capabilities `design-tokens` (build), `ui-components` (runtime), `shell-layout` (runtime), `settings-panel` (runtime), `crud-workflows` (runtime), `vite-plugin` (build); requiredness `required`
- ADR references cited in `AGENTS.md`: ADR-001 governance-repo-as-index-plane through ADR-009 workflow-first-bounded-agent
- Consumers listed in `PRD.md`: `axi-workbench`, `axi-agent`, `axi-notify`, `axi-image-preview`, `ielts-vocab` (`@axi/ui`), `axiom-todo-loop`
- Verdaccio: `/Volumes/code/workspace/foundation/axi-registry`
- Gallery local port: `17920` (hardcoded); Verdaccio: `4873`
- Skill loading policy: `foundation/axi-skills/.apm/instructions/axi-skill-loading-policy.instructions.md` (L0 bootstrap → L1 workflow OS → L2 stage-gated feature plugins)
- Recent trajectory: `caa82b67` consumer `--root` flag + Node 22 crash fix; `4f3f6789` UI aesthetic contract audit; `c5ceaa45` private governance remote; `36a26e5c` decision-algorithm + decision-retrieval + eslint-plugin-axi packages; `dd3ad43e` split oversized shell / gallery files to satisfy 600-line limit; `07f9dfbd` axi-ui-decision-mcp + decision stubs + PRDs

## 说明

`axi-ui` 是 axiomaticworld / Axi 应用的工作区级 UI runtime，路径 `/Volumes/code/workspace/foundation/axi-ui`。pnpm workspace 包含九个 `@axi/*` 包（`tokens`、`presets`、`icons`、`core`、`widgets`、`shell`、`settings`、`crud`、`addons`）+ companion `@axi/vite-plugin` + 私有 `gallery/` management backend（监听 `http://127.0.0.1:17920/`）。规范视觉基线 **Black Gold** 由 `@axi/tokens`（preset 合约，`packages/tokens/tokens/admin.json`，发出 CSS / SCSS / Tailwind 4 `@theme` / TS / brand manifest）与 `@axi/core`（`AxiThemeProvider`、`applyAxiAppearance`、`createAxiAntdTheme`、`axiStylePresets = [black-gold, minimal, cyber, glass]`）所有；consumer host 不得维护并行 theme registry。重型可选面（rich text、charts、Excel、video、image crop、QR code、reasoning-state visualizers）被封装在 `@axi/addons` 内，使得默认 administration shell 不会拉入 editor、charting、spreadsheet 或 media 依赖。`@axi/vite-plugin` 是唯一不 import 任何 sibling 的包（`axi()` factory 串接 `chunks` / `chunkGuard` / `modules` / `virtual` / `eps` 插件）；`@axi/crud` 横向触达 `@axi/widgets` 用于 `AxiNumberRange` / `AxiDictOption` / `findAxiDictItem` 合并。`@axi/core/src/module/` 提供 trusted local-module API（`defineAxiModule({ routes, navigation, slots, commands, settings, themes, crudExtensions, locale })`）+ SSR-safe `createAxiModuleHost`，**故意不支持** remote / uploaded code execution。`@axi/core/src/locale/` 提供 SSR-safe `AxiLocaleProvider` + `useAxiLocale` + typed contributions + 严格 `__tests__` 验证器；每包一个 `axiXxxLocaleContribution`（如 `axiCrudLocaleContribution`）。所有包通过 `publishConfig.registry = http://127.0.0.1:4873/`（Verdaccio）发布到本地。Package DAG 顺序：`tokens → presets / core / vite-plugin → widgets / shell / settings / crud / addons`；`pnpm build` 按序编译，`pnpm publish:local:<pkg>` 逐包推送。`gallery/` 用 Remotion Player + `@remotion/player` + React 19 实现 component-library 视觉化（`gallery-component-library.tsx`），drift gate 在 `gallery/test/drift-check.test.mjs`。Milestone 0 / 0.5 / 0.6 完成；Visual Baseline Delivery 2026-07-28 验证；JSDoc coverage gate 与 module docs gate 闭环；i18n budget `<= 0.1` per package 由 `check:i18n:budget` 守。