---
id: axi-docs-en-projects-axi-ui
title: Axi UI
type: project
status: published
tags: [Axi Docs, Projects, foundation, shared-ui]
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

> Mirror of the project root `README.md` and `INDEX.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-ui/README.md`](/Volumes/code/workspace/foundation/axi-ui/README.md),
> [`/Volumes/code/workspace/foundation/axi-ui/INDEX.md`](/Volumes/code/workspace/foundation/axi-ui/INDEX.md).
> Section: shared-ui / Partition: `foundation/`.

## Summary

`axi-ui` is the workspace-level UI runtime for axiomaticworld / Axi
applications. It is a pnpm workspace of nine `@axi/*` packages plus a
companion Vite plugin (`@axi/vite-plugin`) and a private Gallery management
backend (`gallery/`). The canonical visual baseline is **Black Gold**, owned
by `@axi/tokens` (preset contract) and `@axi/core` (runtime provider,
persistence, exposure); consumer hosts are explicitly forbidden from
maintaining a parallel theme registry. Heavy optional surfaces (rich text,
charts, Excel, video, image crop, QR code, reasoning-state visualizers) are
sealed inside `@axi/addons` so a default administration shell does not pull
editor, charting, spreadsheet, or media dependencies unless a page imports
them explicitly.

**Stage**: live project, shared foundation.
**Canonical path**: `/Volumes/code/workspace/foundation/axi-ui`.
**Workspace version**: `0.2.1` (root), with package versions tracked
independently — `@axi/tokens@0.2.0`, `@axi/presets@0.1.0`, `@axi/icons@0.2.1`,
`@axi/core@0.2.1`, `@axi/widgets@0.1.0`, `@axi/shell@0.3.0`,
`@axi/settings@0.1.0`, `@axi/crud@0.3.0`, `@axi/addons@0.1.0`,
`@axi/vite-plugin@0.1.0`. All packages publish to a local Verdaccio
registry at `http://127.0.0.1:4873/` via `publishConfig.registry`.

Branch policy: `main` carries releasable builds; `dev` carries daily
integration. Working tree is currently 55 commits ahead of `origin/dev` on
`dev` (audit-remediation tail and refactors in flight).

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

The runtime is shaped as a strict dependency DAG with `@axi/tokens` at the
root, three downstream packages depending only on `tokens` (`presets`,
`core`, and `vite-plugin`), then four leaf packages consuming `core`
(`widgets`, `shell`, `settings`, `crud`, `addons`). `@axi/vite-plugin` is
the only package that does not import any sibling — it ships the build
pipeline that hosts the others (`axi()` factory wires `chunks`, `chunkGuard`,
`modules`, `virtual`, and `eps` plugins). `@axi/crud` is the only package
that reaches sideways to `@axi/widgets` (so that `AxiNumberRange` /
`AxiDictOption` / `findAxiDictItem` consolidation lives in the lowest
shared surface, not in CRUD). This shape is fixed by
`docs/architecture/feature-architecture.md`: feature-oriented directories
(`features/<name>`) are used inside packages, while Gallery uses thin
application composition (`app/`, `pages/`, `features/`, `shared/`).

The Black Gold visual baseline is a **token contract**, not a CSS file. The
canonical JSON lives at `packages/tokens/tokens/admin.json` (with theme
preset block, color spectrum, sidebar / bar dimensions, typography, spacing,
radius, shadow, breakpoint, motion). `packages/tokens/scripts/build-tokens.mjs`
emits CSS variables, SCSS variables, Tailwind 4 `@theme`, and a TS module
plus a brand manifest. The CSS, Tailwind, SCSS, and TS subpaths are exposed
through `packages/tokens/package.json` `exports`. The Black Gold Dashboard
Shell — topbar, breadcrumb, sidebar, route-tab, message / notification
panels, content fullscreen — lives in `@axi/shell/src/dashboard-shell*` and
the navigation feature folder; the per-`Axi*` exports are re-exported from
`packages/shell/src/index.ts` under the navigation feature surface. Local
switches for theme, locale, fast-enter, and dashboard actions are exposed
as `AxiPlugin` factories in `packages/shell/src/plugins.tsx`.

Theming is centralised in `@axi/core/src/capabilities/theme/`. The runtime
exports `AxiThemeProvider`, `useAxiTheme`, `useAxiOptionalTheme`,
`applyAxiTheme`, `applyAxiAppearance`, `resolveAxiThemePreference`,
`createAxiAntdTheme`, plus type tokens for `AxiThemeContextValue`,
`AxiResolvedAppearance`, and `AxiThemePreset`. Preset metadata is owned by
`@axi/presets` (`axiStylePresets`, `axiStylePresetIds` = `black-gold`,
`minimal`, `cyber`, `glass`); applying a preset to the DOM is `@axi/core`'s
job, not the preset package's, so the registry stays pure data. Auth and
the optional `AxiHostedApp` context are also in `@axi/core`, so shells can
read hosted-app metadata without leaking desktop / port-allocation concerns
into the runtime.

The **trusted module host** in `@axi/core/src/module/` lets a consumer
register a module with `defineAxiModule({ routes, navigation, slots, commands,
settings, themes, crudExtensions, locale })` and bridge them through host
adapters. `createAxiModuleHost` is the SSR-safe mount; the optional Vite
plugin (`@axi/vite-plugin` → `createAxiModulesPlugin`) emits an auditable
module graph and independent feature chunks. Remote / uploaded code
execution is intentionally unsupported. `@axi/core/src/locale/` adds
`AxiLocaleProvider`, `useAxiLocale`, `format`, `resolve`, typed
contributions, and a strict `__tests__` validator, so each package owns a
namespaced `zh-CN` and `en-US` locale contribution (e.g.
`axiCrudLocaleContribution` for `@axi/crud`).

The Gallery is the Axi UI management backend. `gallery/src/gallery-admin-home.tsx`
is the Overview entry, surfacing component-asset counts, package health,
verification status, adoption trends, and shortcuts into typed resource
panels. Every typed UI panel shares the same three-level Dashboard Shell
(domain group → category → concrete resource). Theme Presets is a catalog
of the four built-in styles rather than a theme-composition editor; System
Settings remains the place for general behaviour, theme inspection,
shortcuts, notifications / messages, storage, and about. The
`@remotion/player` + `remotion` integration is used by
`gallery-component-library.tsx` to render a scene per exported component
(spec `2026-09-14-remotion-component-visualizer`); drift checks live in
`gallery/test/visualizer-smoke.test.mjs` and `drift-check.test.mjs`.

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

See `docs/state/MILESTONE.md` for the authoritative list and
`docs/axi-ui/MILESTONE.md` for the frozen M1–M7 rewrite history.

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

## Notes

`axi-ui` is the workspace-level UI runtime for axiomaticworld / Axi applications at `/Volumes/code/workspace/foundation/axi-ui`. The pnpm workspace contains nine `@axi/*` packages (`tokens`, `presets`, `icons`, `core`, `widgets`, `shell`, `settings`, `crud`, `addons`) + `@axi/vite-plugin` + private `gallery/` management backend (listens on `http://127.0.0.1:17920/`). The canonical visual baseline **Black Gold** is owned by `@axi/tokens` (preset contract at `packages/tokens/tokens/admin.json`, emits CSS / SCSS / Tailwind 4 `@theme` / TS / brand manifest) and `@axi/core` (`AxiThemeProvider`, `applyAxiAppearance`, `createAxiAntdTheme`, `axiStylePresets = [black-gold, minimal, cyber, glass]`); consumer hosts must not maintain a parallel theme registry. Heavy optional surfaces (rich text, charts, Excel, video, image crop, QR code, reasoning-state visualizers) are sealed in `@axi/addons` so a default administration shell does not pull editor, charting, spreadsheet, or media dependencies. `@axi/vite-plugin` is the only package that imports no sibling (`axi()` factory wires `chunks` / `chunkGuard` / `modules` / `virtual` / `eps` plugins); `@axi/crud` reaches sideways to `@axi/widgets` for `AxiNumberRange` / `AxiDictOption` / `findAxiDictItem`. `@axi/core/src/module/` provides the trusted local-module API (`defineAxiModule({ routes, navigation, slots, commands, settings, themes, crudExtensions, locale })`) plus SSR-safe `createAxiModuleHost`; remote / uploaded code execution is intentionally unsupported. `@axi/core/src/locale/` provides SSR-safe `AxiLocaleProvider` + `useAxiLocale` + typed contributions + strict `__tests__` validator; each package owns an `axiXxxLocaleContribution` (e.g. `axiCrudLocaleContribution`). All packages publish to local Verdaccio via `publishConfig.registry = http://127.0.0.1:4873/`. Package DAG order: `tokens → presets / core / vite-plugin → widgets / shell / settings / crud / addons`; `pnpm build` compiles in order; `pnpm publish:local:<pkg>` pushes per package. `gallery/` uses Remotion Player + `@remotion/player` + React 19 for the component-library visualizer (`gallery-component-library.tsx`), with the drift gate in `gallery/test/drift-check.test.mjs`. Milestone 0 / 0.5 / 0.6 complete; Visual Baseline Delivery verified 2026-07-28; JSDoc and module docs gates closed; i18n budget `<= 0.1` per package guarded by `check:i18n:budget`.