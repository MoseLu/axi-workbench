---
id: axi-docs-en-projects-axi-workbench-desktop-dist
title: Axi Workbench Desktop Distribution
type: project
status: published
tags: [Axi Docs, Projects, distributions, reference, workbench, desktop, tauri]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench Desktop Distribution
graph-tags: [Projects, distributions, workbench, tauri]
description: Tauri 2 macOS desktop distribution that wraps the @axi/workbench Web UI; provides a native login-then-main window lifecycle, cookie-bridged gateway proxy, tray, single-instance lock, and bundled Rust shell.
project:
  id: axi-workbench-desktop-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-desktop
  source-section: reference
---

# Axi Workbench Desktop Distribution

> Workspace project dossier. Source of truth:
> [`/Volumes/code/workspace/distributions/axi-workbench-desktop`](/Volumes/code/workspace/distributions/axi-workbench-desktop).
> Partition: `distributions/`. Framework: **Tauri 2**.

## Summary

A Tauri 2 desktop distribution that wraps the **`@axi/workbench` Web UI** in a native macOS shell. It carries two apps under `apps/`: the existing Vite SPA (`apps/workbench` — same source as the Web distribution) and a Tauri 2 shell package (`apps/workbench-desktop`). The shell's `frontendDist` is a mirrored copy of `apps/workbench/dist/` placed under `apps/workbench-desktop/workbench-dist/` (verified by `scripts/verify-desktop-contracts.mjs`). All shared workspace libraries (`@axi/core`, `@axi/crud`, `@axi/presets`, `@axi/settings`, `@axi/shell`, `@axi/tokens`, `@axi/widgets`, `@axi/workstation-contracts`, `@axi/workbench-foundation`, `@epap/api-client`, `@epap/types`, `@epap/utils`) are vendored under `shared/axi-ui/` and `packages/`, identical in shape to the Web distribution.

The Rust runtime (`apps/workbench-desktop/src-tauri/src/`) implements a login-then-main lifecycle: a 380×440 fixed-size login window (`tauri.conf.json`) is created at start; the main 1280×800 window is built *only after* `shell://login-success` (via `WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html"))`); main close = hide-to-tray; tray Quit exits the process; single-instance lock prevents duplicate processes. The shell exposes two `#[tauri::command]`s — `proxy_gateway_request` (HTTPS / loopback `127.0.0.1:8088`, scheme/host allowlist, host-strict `Set-Cookie` parsing, resume-cookie persistence to `app_data_dir/axi-resume-cookie`) and `open_external_url` (HTTPS `workbench.axiomaticworld.com` / `:8443` `/legal/{terms,privacy}` only). IPC channels: `shell://unread` (Dock badge + tray title), `shell://notify` (system notification), `shell://login-success`, `shell://login-failed`, `shell://logout`. Bundling is `app` (with `dmg` optional via `--bundles dmg`); signing is `APPLE_SIGNING_IDENTITY` driven (CI may skip with no certificate).

**Stage**: live product distribution, desktop channel of the Axi Workbench trio. Build: 2026-09-24, bundle `公理工作台.app`, no `.dmg` or `latest-mac.yml` emitted (auto-update channel cannot be exercised until both files exist).

## Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Workspace root | pnpm 10.33.2 + Turbo 2.0 + TypeScript 5.3 + sass 1.77 | `engines.node>=22`, `pnpm>=10`, `packageManager pnpm@10.33.2`; `pnpm.overrides` for `brace-expansion`, `js-yaml`, `postcss`, `react-router`, `nanoid` security advisories |
| Web SPA (consumed) | React 18 + Vite 5 + antd 6.4 + TanStack Query 5 | Same as Web dist; provides `apps/workbench/dist/` |
| Desktop shell | `@axi/workbench-desktop` (Tauri 2 shell) | dev: `node scripts/dev-desktop.mjs` (orchestrates runtime + web + tauri); build: `node scripts/build-macos.mjs` (optionally `--bundles dmg`) |
| Desktop `verify:contracts` | `scripts/verify-desktop-contracts.mjs` | Mirrors `apps/workbench/dist` → `apps/workbench-desktop/workbench-dist`, asserts packaged gateway URL, login window 380×440, no main window in `tauri.conf.json`, `Info.plist` zh-Hans, `InfoPlist.strings` (zh-Hans + en), `data-tauri-drag-region`, dango-family favicon |
| Rust runtime | Tauri 2 (`tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }`), `tauri-plugin-global-shortcut 2`, `tauri-plugin-single-instance 2`, `tauri-plugin-notification 2`, `reqwest 0.13` (`rustls`), `serde 1`, `serde_json`, `once_cell 1` | Library crate `workbench_desktop_lib`; `crate-type = ["staticlib", "cdylib", "rlib"]`; `rust-version = "1.77"`; feature `custom-protocol` |
| Capability set | `apps/workbench-desktop/src-tauri/capabilities/default.json` | `windows: ["main", "login"]`; `core:default`, window show/hide/focus/close/min/max/unmax; `core:app:allow-app-show/hide`; `core:event:default`; `notification:default`; `global-shortcut:{default,allow-register,allow-unregister,allow-is-registered}` |
| Entitlements | `apps/workbench-desktop/src-tauri/entitlements/workbench.plist` | `com.apple.security.app-sandbox`; `cs.allow-jit`, `cs.allow-unsigned-executable-memory`, `cs.disable-library-validation`; `network.client`, `network.server`; `files.user-selected.read-only` |
| Info.plist | `apps/workbench-desktop/src-tauri/Info.plist` | `CFBundleDisplayName = 公理工作台`, `CFBundleDevelopmentRegion = zh-Hans`, `CFBundleName = 公理工作台`, `NSLocalizations = [zh-Hans, en]`, `NSQuitAlwaysKeepsWindows = false`, ATS exception for `localhost` / `127.0.0.1` (`NSAllowsLocalNetworking = true`, `NSExceptionAllowsInsecureHTTPLoads = true`) |
| Tauri config | `tauri.conf.json` | `productName = "公理工作台"`, `identifier = "com.axi.workbench.desktop"`, `frontendDist = "../workbench-dist"`, `devUrl = "http://127.0.0.1:5183"`, `beforeBuildCommand = pnpm --filter @axi/workbench-desktop verify:contracts`; login window `380×440`, `decorations: false`, `transparent: true`, `theme: Light`, `backgroundColor: #00000000`; `bundle.targets = ["app"]`, `bundle.icon = ["icons/icon.icns"]`, `bundle.category = "DeveloperTool"`, `macOS.minimumSystemVersion = "11.0"`, `macOS.entitlements = "entitlements/workbench.plist"`, `macOS.signingIdentity = "-"` (ad-hoc); plugins `globalShortcut` (`CmdOrCtrl+Shift+W` → "show-main-window"), `singleInstance.enabled = true` |
| Local runtime supervisor | `apps/workbench-desktop/scripts/ensure-local-runtime.mjs` | Supervises `control-plane:8092`, `identity-adapter:8081`, `platform-core:8082`, `api-gateway:8088`; probes `/health` for each; optional docker-compose up for postgres:5432 + redis:6379 |
| One-click dev launcher | `apps/workbench-desktop/scripts/dev-desktop.mjs` | Spawns runtime supervisor + `pnpm dev:workbench` (web on 5183) + `pnpm --filter @axi/workbench-desktop dev:split` (tauri dev); waits for 5183 + 8088 before starting Tauri; `--print-only` mode |
| macOS build | `apps/workbench-desktop/scripts/build-macos.mjs` | Normalizes packaged Gateway URL (`https://workbench.axiomaticworld.com` or `AXI_DESKTOP_ALLOW_LOCAL_GATEWAY=true` opt-in); invokes `tauri build --bundles app|dmg`; stages DMG to avoid Tauri clobbering `公理工作台.app`; codesign + verify; localized `InfoPlist.strings` (zh-Hans, en); supports `APPLE_SIGNING_IDENTITY` (or `-` ad-hoc) |
| Notarization | `apps/workbench-desktop/scripts/notarize.sh` | Independent notarization hook |
| Native bridge (WebView → Rust) | `apps/workbench-desktop/src/contracts.ts` | Re-exports `@axi/workbench-foundation/shell-contracts`; IPC channel names standardized in `apps/workbench/src/lib/tauriGateway.ts` |
| Shared workspace packages | `@axi/{core,crud,presets,settings,shell,tokens,vite-plugin,widgets,addons}`, `@axi/{workstation-contracts,workbench-foundation}`, `@epap/{api-client,types,utils}`, `@axi/icons` | Same identities as Web distribution, mirrored at `packages/*` and `shared/axi-ui/packages/*` |
| CI | GitHub Actions (matrix gates Tauri to macOS/Windows; Ubuntu glib libs; turbo test depends on package own build) | Brand contract enforced by `verify-desktop-contracts.mjs` |
| Brand | "Dango-family" seven-member geometry | `apps/workbench-shared/src/brand/favicon-geometry.json` referenced by `verify-desktop-contracts.mjs` |

## Project Layout

```text
axi-workbench-desktop/
├── README.md / README.zh-CN.md      # Distribution READMEs
├── BUILD_INFO.json                  # Build provenance + dist commit
├── package.json                     # Workspace root
├── pnpm-workspace.yaml              # globs apps/* + packages/* + foundation/axi-ui/packages/*
├── turbo.json                       # Adds desktop:build / desktop:dev tasks
├── tsconfig.base.json / tsconfig.json / tsconfig.node.json
├── .github/workflows/ci.yml         # CI matrix (macos/windows for tauri; ubuntu glib libs)
├── .githooks/{pre-commit,commit-msg,post-commit}
├── scripts/verify-ci-contracts.mjs  # Workspace CI contract gate
├── shared/axi-ui/                   # Vendored axiom-workbench monorepo fragments
│   └── packages/{core,crud,presets,settings,shell,tokens,vite-plugin,widgets,addons}
├── packages/                        # Local package mirrors
│   ├── api-client/                  # @epap/api-client (axios + TanStack Query peer)
│   ├── schemas/                     # @axi/workstation-contracts (zod)
│   ├── types/                       # @epap/types
│   ├── utils/                       # @epap/utils
│   └── workbench-foundation/        # @axi/workbench-foundation
├── apps/
│   ├── workbench/                   # @axi/workbench — same Vite SPA as Web dist (consumer of dist)
│   │   ├── README.md / package.json
│   │   ├── vite.config.ts            # dev=127.0.0.1:5183; proxies; React Query dedupe
│   │   ├── src/{App,main,layouts/MainLayout,lib/tauriGateway,contexts/AuthContext}
│   │   └── public/{favicon,apple-touch-icon,login-qr-corner}
│   └── workbench-desktop/           # @axi/workbench-desktop — Tauri 2 shell package
│       ├── README.md
│       ├── package.json             # @tauri-apps/cli ^2.11.2; workspace deps @axi/workbench
│       ├── src/contracts.ts         # re-export from @axi/workbench-foundation/shell-contracts
│       ├── scripts/
│       │   ├── build-macos.mjs      # tauri build --bundles app|dmg + codesign + verify
│       │   ├── dev-desktop.mjs      # orchestrator: runtime + web + tauri dev
│       │   ├── ensure-local-runtime.mjs   # control-plane/identity-adapter/platform-core/api-gateway
│       │   ├── notarize.sh
│       │   ├── type-check.mjs
│       │   ├── verify-desktop-contracts.mjs  # mirror dist → workbench-dist + contracts gate
│       │   ├── verify-ui-contracts.mjs
│       │   └── generate-source-icon.mjs
│       ├── workbench-dist/          # Mirror of apps/workbench/dist/ (frontendDist target)
│       └── src-tauri/
│           ├── Cargo.toml            # workbench-desktop Lib (lib name); rust-version 1.77
│           ├── build.rs              # tauri_build::build()
│           ├── tauri.conf.json       # productName=公理工作台, identifier=com.axi.workbench.desktop
│           ├── capabilities/default.json
│           ├── entitlements/workbench.plist
│           ├── Info.plist
│           ├── icons/{icon.icns,icon.png,icon.svg,icon.ico,dango-family.png,ios/,legacy/,android/}
│           ├── i18n/{zh-Hans.lproj,en.lproj}/InfoPlist.strings
│           └── src/
│               ├── main.rs          # workbench_desktop_lib::run()
│               ├── lib.rs           # proxy_gateway_request + open_external_url + login→main→tray
│               └── runtime.rs       # LocalRuntime supervisor (AXI_WORKBENCH_ROOT / CARGO_MANIFEST_DIR)
└── docs/
    ├── HANDOFF.md                   # Zero-context takeover (mirror of Web dist)
    ├── VERIFICATION.md
    ├── project-docs.manifest.json   # Axi overlay
    └── logs/submit/2026{09,10}-*.md
```

## Build & Install

```bash
# Install workspace dependencies
pnpm install

# One-click local desktop dev (web on 5183 + local API plane + tauri window)
pnpm dev:desktop                  # root scripts:dev:desktop → @axi/workbench-desktop dev
# Or, manual / split dev:
pnpm dev:web                      # filter=@axi/workbench → vite @ 127.0.0.1:5183
pnpm dev:desktop                  # filter=@axi/workbench-desktop dev (orchestrator)
pnpm --filter @axi/workbench-desktop dev:split   # tauri dev only

# Native build (unsigned / ad-hoc / signed depending on APPLE_SIGNING_IDENTITY)
pnpm build:desktop                # verify:contracts + tauri build --bundles app
pnpm build:desktop:dmg            # verify:contracts + tauri build --bundles dmg

# CI gate
pnpm verify:ci                    # scripts/verify-ci-contracts.mjs
pnpm --filter @axi/workbench-desktop verify:contracts   # desktop contract gate
pnpm --filter @axi/workbench-desktop type-check
pnpm --filter @axi/workbench type-check
pnpm test
pnpm lint
```

**Notes**:

- `build:desktop:dmg` cleans `bundle/macos/公理工作台.app` after the DMG step (Tauri's `dmg` target removes the macOS app folder) and re-stages the signed `.app` from a temp directory.
- In CI without an Apple certificate, `signingIdentity = null` → `verify-desktop-contracts.mjs` skips signing; `beforeBuildCommand` runs first.
- For local builds: `APPLE_SIGNING_IDENTITY=-` ad-hoc, or set a real identity. For local debug with explicit loopback gateway, set `AXI_DESKTOP_ALLOW_LOCAL_GATEWAY=true`.
- Web entry copied to `apps/workbench-desktop/workbench-dist/` is regenerated by `verify-desktop-contracts.mjs` (removes existing dir, `mkdirSync`, `cpSync(workbenchDist, targetDir, { recursive: true })`).

## Verification

```bash
# Cross-file CI contract verifier
pnpm verify:ci

# Per-app contract verifier (Web: UI + login window + plumb; Desktop: window + plist + favicon)
pnpm --filter @axi/workbench verify-ui-contracts
pnpm --filter @axi/workbench-desktop verify:contracts

# Type checks
pnpm type-check
pnpm --filter @axi/workbench-desktop type-check

# Unit tests
pnpm test

# Native Rust tests (within apps/workbench-desktop/src-tauri)
cd apps/workbench-desktop/src-tauri && cargo test
```

`verify-desktop-contracts.mjs` asserts (extracts):

- `apps/workbench/dist` exists; copies to `apps/workbench-desktop/workbench-dist`.
- When `AXI_DESKTOP_PACKAGE=true`, packaged Gateway URL is `https://workbench.axiomaticworld.com` (or explicit local debug allow); packaged JS source must reference that URL.
- `apps/workbench-desktop/src-tauri/icons/icon.icns` exists.
- `tauri.conf.json` `productName = "公理工作台"`; login window 380×440, not resizable/maximizable, decorations off, transparent, `theme: Light`, `backgroundColor: #00000000`.
- `tauri.conf.json` MUST NOT pre-declare a main window (otherwise macOS restore would inflate login into 1280×800); the Rust shell must contain `WebviewWindowBuilder::new(app, "main"`, `inner_size(1280.0, 800.0)`, `min_inner_size(1024.0, 640.0)`, `resizable(true)`, `maximizable(true)`.
- `Info.plist` `CFBundleDevelopmentRegion=zh-Hans`, `CFBundleDisplayName=公理工作台`, `CFBundleName=公理工作台`, `NSAllowsLocalNetworking=true`, NO `NSAllowsArbitraryLoadsInWebContent`, `NSQuitAlwaysKeepsWindows=false`, `NSExceptionDomains` for `localhost` + `127.0.0.1` with `NSExceptionAllowsInsecureHTTPLoads=true`.
- `i18n/zh-Hans.lproj/InfoPlist.strings` `CFBundleDisplayName = "公理工作台"`; `i18n/en.lproj/InfoPlist.strings` `CFBundleDisplayName = "Axi Workbench"`.
- `capabilities/default.json` `windows: ["main", "login"]` (login must be drag-allowed).
- `apps/workbench/src/pages/Login.tsx` includes `data-tauri-drag-region` and `axi-login-window-close`; `Login.css` includes `.axi-login-drag-region`, `cursor: default`; forbids `cursor: grab|grabbing`.
- Web favicon (and desktop icon master `icon.svg`) must use the `dango-family` seven-member image per `apps/workbench-shared/src/brand/favicon-geometry.json`; byte-identical with the Workbench Web favicon.
- Forbidden: legacy six-petal flower geometry in `icon.svg` / `favicon.svg`.

## Architecture Highlights

**Native window lifecycle is `login → main → tray-hide`.** `tauri.conf.json` declares only the `login` window (380×440, fixed-size, transparent, `decorations: false`, `theme: Light`). On app start, `enforce_login_only()` hides the main window if it was restored by macOS and shows the login window. The Rust shell listens for `shell://login-success` → `switch_to_main()` hides `login`, builds `main` via `WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html"))` with `inner_size(1280.0, 800.0)` + `min_inner_size(1024.0, 640.0)`, sets the page-load listener to `show + setFocus` on `PageLoadEvent::Finished`. `shell://logout` triggers `switch_to_login()` which `eval("window.location.replace('/login')")` on both windows. The login window's `on_window_event(CloseRequested)` calls `app.exit(0)` (explicit exit); main window close = `api.prevent_close(); window.hide()` (tray-park). `SHELL_AUTHENTICATED: AtomicBool` gates whether tray activation reveals main or login.

**Cookie-bridged gateway proxy.** WebView `/api/*` requests are intercepted by `installTauriGatewayFetch()` (Web distribution) which calls `invoke('proxy_gateway_request', { request: { method, path, headers, body, baseUrl } })`. The Rust handler:
1. `method` validated via `reqwest::Method::from_bytes`.
2. `resolve_gateway_url(base, path)` — base must be `http://localhost|127.0.0.1|::1:8088` *or* `https://workbench.axiomaticworld.com[:443|:8443]`; path must start with `/api` (rejects `..`, `%2e`, `\`, `#`); userinfo/query/fragment rejected on base; pathname of base must be `""` or `/`.
3. `reqwest::Client` with `connect_timeout 5s` + `timeout 30s`; for `:8443` it uses `no_proxy().resolve(WORKBENCH_PUBLIC_HOST, 127.0.0.1:8443)`.
4. Strips `origin`, `host`, `cookie`, `content-length` headers from request; attaches `Cookie` from a `GatewaySession::cookies` `Mutex<HashMap>` (initially loaded from `app_data_dir/axi-resume-cookie`).
5. Persists only the `axi_resume` cookie to `app_data_dir/axi-resume-cookie` (0600 on Unix, atomic rename) when the cookie set changes. On logout, clears the jar and removes the file.
6. Forwards only `content-type`, `cache-control`, `x-request-id` response headers back; preserves status code (special cases 204/205/304 → empty body).

**App menu + tray + global shortcut.** The Tauri shell installs a five-submenu AppKit menu (App / 文件 / 编辑 / 视图 / 窗口) with standard accelerators (`Cmd+H` hide, `Cmd+Q` quit, `Cmd+T` new tab, `Cmd+W` close, `Cmd+Z`/`Shift+Cmd+Z` undo/redo, `Cmd+X/C/V/A` cut/copy/paste/select-all, `Cmd+R` reload, `Alt+Cmd+I` toggle devtools, `Cmd+M` minimize). All other menu ids are forwarded to the WebView as a `native-menu` custom event. Tray (`main-tray`) holds Show/Hide/Quit; double-click toggles main visibility. `CmdOrCtrl+Shift+W` registered as `show-main-window` via `global-shortcut`. Single-instance plugin focuses existing window on second launch.

**Notification dedupe with native `tauri-plugin-notification`.** `shell://notify` payload `{ title, body, url?, tag? }`; same-tag pushes inside a 1.5 s window (`MERGE_WINDOW`) are dropped (macOS 11+ no longer allows direct replace); entries older than `4 × MERGE_WINDOW` are evicted. Notification click triggers `window.eval` to `pushState` to the payload URL.

**Local runtime supervisor (optional).** `ensure-local-runtime.mjs` boots four services if their `/health` probes are missing: `control-plane :8092`, `identity-adapter :8081`, `platform-core :8082`, `api-gateway :8088`. It also tries to bring up `docker-compose` (postgres :5432, redis:6379) if missing. The Rust side discovers the workspace root via `AXI_WORKBENCH_ROOT` env var or `CARGO_MANIFEST_DIR/../../../..` and checks for `services/{api-gateway,control-plane}/scripts/dev-run.sh`. Once running, `LocalRuntime.prefer_local.store(true, SeqCst)` makes `preferred_base_url` always return `http://127.0.0.1:8088`.

**TypeScript-side contracts re-exported.** `apps/workbench-desktop/src/contracts.ts` is a one-line facade: `export * from '@axi/workbench-foundation/shell-contracts'`. This lets the Tauri build reference shell-contracts without depending on the desktop host package; the Web renderer also pulls from `@axi/workbench-foundation` directly.

**Cross-distribution parity with the Web and Mobile distributions.** All three distributions share the same `@axi/workbench-foundation`, `@axi/workstation-contracts`, `@axi/tokens`, `@axi/core` identities. The Web distribution and Mobile distribution each pin the same `apps/workbench-shared/src/brand/favicon-geometry.json` as the single source of the brand invariants.

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| Initial Tauri 2 shell scaffold | Shipped | `apps/workbench-desktop/package.json` (`@axi/workbench-desktop` v0.1.0); `src-tauri/Cargo.toml` (`workbench_desktop_lib`); `tauri.conf.json` declares login-only window |
| Web dist mirror gate | Shipped | `a3f3c8c refactor(workbench-desktop): sync workbench-web token namespace rename`; `5a49491 feat(workbench-desktop): governance inspector + breadcrumb/tab refactor + verify docs`; `scripts/verify-desktop-contracts.mjs` asserts dist → `workbench-dist/` mirror |
| Login → main → tray lifecycle | Shipped | `src-tauri/src/lib.rs` exposes `proxy_gateway_request`, `open_external_url`; `SHELL_AUTHENTICATED: AtomicBool`; `shell://login-success` triggers `switch_to_main()`; main close = `prevent_close(); window.hide()` |
| macOS build pipeline | Shipped | `apps/workbench-desktop/scripts/build-macos.mjs` normalizes packaged Gateway URL → `https://workbench.axiomaticworld.com`; supports `APPLE_SIGNING_IDENTITY`; localized `InfoPlist.strings` (zh-Hans, en); `verify:contracts` runs before build |
| Token-namespace rename convergence | In progress | Current branch `feature/workbench-desktop-tokens-css-convergence` (working tree dirty); recent commits `4c925ae chore(distribution): land tokens css convergence wave`, `3a2c0f0 docs(designs): archive pending icons-sync wave patch`, `2dfe982 chore(gitignore): cover env + Android signing material` |
| Build provenance snapshot | Shipped | `BUILD_INFO.json` (`framework=tauri-2`, `dist_commit=923092fed4b6fec5a5b7f232e3207ee87be916af` on `main`, `build_timestamp=2026-09-24T15:21:31Z`, `build_platform=darwin-arm64`, `app_bundle=apps/workbench-desktop/src-tauri/target/release/bundle/macos/公理工作台.app`, `dmg=null`, `latest_mac_yml=null`); `notes: "No .dmg or latest-mac.yml produced; current bundle is a bare .app."` |
| DMG + auto-update channel | Not started | `dmg: null`, `latest_mac_yml: null` in `BUILD_INFO.json`; auto-update cannot be exercised until both files exist |

## Authoritative Documents

- [`README.md`](/Volumes/code/workspace/distributions/axi-workbench-desktop/README.md) — distribution README
- [`README.zh-CN.md`](/Volumes/code/workspace/distributions/axi-workbench-desktop/README.zh-CN.md) — Chinese distribution README
- [`package.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/package.json) — workspace root
- [`pnpm-workspace.yaml`](/Volumes/code/workspace/distributions/axi-workbench-desktop/pnpm-workspace.yaml)
- [`turbo.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/turbo.json)
- [`BUILD_INFO.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/BUILD_INFO.json)
- [`docs/HANDOFF.md`](/Volumes/code/workspace/distributions/axi-workbench-desktop/docs/HANDOFF.md)
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/distributions/axi-workbench-desktop/docs/VERIFICATION.md)
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/docs/project-docs.manifest.json)
- [`apps/workbench-desktop/README.md`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/README.md)
- [`apps/workbench-desktop/package.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/package.json)
- [`apps/workbench-desktop/src/contracts.ts`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src/contracts.ts)
- [`apps/workbench-desktop/src-tauri/Cargo.toml`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/Cargo.toml)
- [`apps/workbench-desktop/src-tauri/build.rs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/build.rs)
- [`apps/workbench-desktop/src-tauri/tauri.conf.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/tauri.conf.json)
- [`apps/workbench-desktop/src-tauri/capabilities/default.json`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/capabilities/default.json)
- [`apps/workbench-desktop/src-tauri/entitlements/workbench.plist`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/entitlements/workbench.plist)
- [`apps/workbench-desktop/src-tauri/Info.plist`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/Info.plist)
- [`apps/workbench-desktop/src-tauri/src/main.rs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/src/main.rs)
- [`apps/workbench-desktop/src-tauri/src/lib.rs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/src/lib.rs)
- [`apps/workbench-desktop/src-tauri/src/runtime.rs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/src-tauri/src/runtime.rs)
- [`apps/workbench-desktop/scripts/build-macos.mjs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/scripts/build-macos.mjs)
- [`apps/workbench-desktop/scripts/dev-desktop.mjs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/scripts/dev-desktop.mjs)
- [`apps/workbench-desktop/scripts/ensure-local-runtime.mjs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/scripts/ensure-local-runtime.mjs)
- [`apps/workbench-desktop/scripts/verify-desktop-contracts.mjs`](/Volumes/code/workspace/distributions/axi-workbench-desktop/apps/workbench-desktop/scripts/verify-desktop-contracts.mjs)

## Cross-References

- Sibling distribution: [`axi-workbench-web-dist`](/Volumes/code/workspace/distributions/axi-workbench-web) — provides `apps/workbench/dist/` mirrored into `apps/workbench-desktop/workbench-dist/`; the installTauriGatewayFetch fetch interceptor lives in `apps/workbench/src/lib/tauriGateway.ts`
- Sibling distribution: [`axi-workbench-mobile-dist`](/Volumes/code/workspace/distributions/axi-workbench-mobile) — independent mobile JS + Kotlin Compose native shell, same `@axi/workbench-foundation` and `@axi/workstation-contracts`
- Upstream monorepo: [`workbench/axi-workbench`](/Volumes/code/workspace/workbench/axi-workbench) — source of `apps/workbench`, `packages/*`, `foundation/axi-ui`
- Brand contract: `apps/workbench-shared/src/brand/favicon-geometry.json` (referenced by `verify-desktop-contracts.mjs`)
- Spec: `docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md` (§3 IPC + §5 Dock / tray)