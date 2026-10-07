---
id: axi-docs-zh-projects-axi-workbench-desktop-dist
title: Axi Workbench Desktop Distribution
type: project
status: published
tags: [Axi Docs, 项目, distributions, reference, workbench, desktop, tauri]
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

Tauri 2 桌面分发，把 **`@axi/workbench` Web UI** 套进 macOS 原生壳。`apps/` 下挂两个 app：既有的 Vite SPA（`apps/workbench`，与 Web 分发同源）以及 Tauri 2 壳包（`apps/workbench-desktop`）。壳的 `frontendDist` 是 `apps/workbench/dist/` 的镜像拷贝，落在 `apps/workbench-desktop/workbench-dist/`（由 `scripts/verify-desktop-contracts.mjs` 验证）。所有共享 workspace 库（`@axi/core`、`@axi/crud`、`@axi/presets`、`@axi/settings`、`@axi/shell`、`@axi/tokens`、`@axi/widgets`、`@axi/workstation-contracts`、`@axi/workbench-foundation`、`@epap/api-client`、`@epap/types`、`@epap/utils`）在 `shared/axi-ui/` 与 `packages/` 下 vendored，结构与 Web 分发完全一致。

Rust 运行时（`apps/workbench-desktop/src-tauri/src/`）实现 login-then-main 生命周期：启动时创建 380×440 固定尺寸登录窗口（`tauri.conf.json`）；主窗口 1280×800 仅在 `shell://login-success` 之后构造（`WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html"))`）；主窗口关闭 = 隐藏至 tray；tray Quit 退出进程；single-instance 锁防止重复进程。壳暴露两个 `#[tauri::command]` —— `proxy_gateway_request`（HTTPS / loopback `127.0.0.1:8088`、scheme/host 白名单、host-strict `Set-Cookie` 解析、`axi_resume` cookie 持久化到 `app_data_dir/axi-resume-cookie`）与 `open_external_url`（仅 `workbench.axiomaticworld.com` / `:8443` `/legal/{terms,privacy}`）。IPC 通道：`shell://unread`（Dock badge + tray title）、`shell://notify`（系统通知）、`shell://login-success`、`shell://login-failed`、`shell://logout`。打包目标为 `app`（可选 `dmg`，通过 `--bundles dmg`）；签名由 `APPLE_SIGNING_IDENTITY` 驱动（CI 无证书时可跳过）。

**Stage**：现役产品分发，Axi Workbench 三端中的桌面端。Build：2026-09-24，bundle `公理工作台.app`，未产出 `.dmg` 或 `latest-mac.yml`（auto-update 通道需两者齐备方可运行）。

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

**说明**：

- `build:desktop:dmg` 会在 DMG 步骤之后清理 `bundle/macos/公理工作台.app`（Tauri 的 `dmg` target 会移除 macOS app 文件夹），并从临时目录重新 stage 已签 `.app`。
- 在 CI 无 Apple 证书时，`signingIdentity = null` → `verify-desktop-contracts.mjs` 跳过签名；`beforeBuildCommand` 先跑。
- 本地构建：`APPLE_SIGNING_IDENTITY=-` 即 ad-hoc，或设置真实 identity。若本地调试需显式 loopback gateway，可设 `AXI_DESKTOP_ALLOW_LOCAL_GATEWAY=true`。
- 拷贝到 `apps/workbench-desktop/workbench-dist/` 的 Web 入口由 `verify-desktop-contracts.mjs` 重新生成（先删目录、`mkdirSync`、再 `cpSync(workbenchDist, targetDir, { recursive: true })`）。

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

`verify-desktop-contracts.mjs` 断言（摘录）：

- `apps/workbench/dist` 存在；拷贝到 `apps/workbench-desktop/workbench-dist`。
- 当 `AXI_DESKTOP_PACKAGE=true`，打包 Gateway URL 为 `https://workbench.axiomaticworld.com`（或显式本地调试放行）；打包 JS 源码必须引用该 URL。
- `apps/workbench-desktop/src-tauri/icons/icon.icns` 存在。
- `tauri.conf.json` `productName = "公理工作台"`；登录窗口 380×440，不可缩放/最大化，关闭装饰、透明、`theme: Light`、`backgroundColor: #00000000`。
- `tauri.conf.json` 不得预先声明 main 窗口（否则 macOS restore 会把登录窗口放大到 1280×800）；Rust 壳必须包含 `WebviewWindowBuilder::new(app, "main"`、`inner_size(1280.0, 800.0)`、`min_inner_size(1024.0, 640.0)`、`resizable(true)`、`maximizable(true)`。
- `Info.plist` `CFBundleDevelopmentRegion=zh-Hans`、`CFBundleDisplayName=公理工作台`、`CFBundleName=公理工作台`、`NSAllowsLocalNetworking=true`，无 `NSAllowsArbitraryLoadsInWebContent`，`NSQuitAlwaysKeepsWindows=false`，`NSExceptionDomains` 含 `localhost` + `127.0.0.1` 并设置 `NSExceptionAllowsInsecureHTTPLoads=true`。
- `i18n/zh-Hans.lproj/InfoPlist.strings` `CFBundleDisplayName = "公理工作台"`；`i18n/en.lproj/InfoPlist.strings` `CFBundleDisplayName = "Axi Workbench"`。
- `capabilities/default.json` `windows: ["main", "login"]`（登录窗口必须允许拖拽）。
- `apps/workbench/src/pages/Login.tsx` 含 `data-tauri-drag-region` 与 `axi-login-window-close`；`Login.css` 含 `.axi-login-drag-region`、`cursor: default`；禁止 `cursor: grab|grabbing`。
- Web favicon（以及桌面图标母版 `icon.svg`）必须使用 `apps/workbench-shared/src/brand/favicon-geometry.json` 中的 `dango-family` 七成员图；与 Workbench Web favicon 字节相同。
- 禁止：`icon.svg` / `favicon.svg` 出现旧版六瓣花。

## Architecture Highlights

**原生窗口生命周期是 `login → main → tray-hide`。** `tauri.conf.json` 仅声明 `login` 窗口（380×440，固定尺寸，透明，`decorations: false`，`theme: Light`）。App 启动时，`enforce_login_only()` 会隐藏 macOS restore 出来的 main 窗口并显示 login 窗口。Rust 壳监听 `shell://login-success` → `switch_to_main()` 隐藏 `login`，通过 `WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html"))` 以 `inner_size(1280.0, 800.0)` + `min_inner_size(1024.0, 640.0)` 构建 main，并把 page-load 监听器设为 `PageLoadEvent::Finished` 时 `show + setFocus`。`shell://logout` 触发 `switch_to_login()`，对两个窗口执行 `eval("window.location.replace('/login')")`。login 窗口的 `on_window_event(CloseRequested)` 调用 `app.exit(0)`（显式退出）；main 窗口关闭 = `api.prevent_close(); window.hide()`（入 tray）。`SHELL_AUTHENTICATED: AtomicBool` 控制 tray 激活时显示 main 还是 login。

**Cookie 桥接的 gateway 代理。** WebView 的 `/api/*` 请求被 `installTauriGatewayFetch()`（Web 分发）拦截，调用 `invoke('proxy_gateway_request', { request: { method, path, headers, body, baseUrl } })`。Rust 处理器：
1. `method` 由 `reqwest::Method::from_bytes` 校验。
2. `resolve_gateway_url(base, path)` —— base 必须是 `http://localhost|127.0.0.1|::1:8088` *或* `https://workbench.axiomaticworld.com[:443|:8443]`；path 必须以 `/api` 开头（拒绝 `..`、`%2e`、`\`、`#`）；base 上禁止 userinfo/query/fragment；base 的 pathname 必须为 `""` 或 `/`。
3. `reqwest::Client` 设 `connect_timeout 5s` + `timeout 30s`；`:8443` 走 `no_proxy().resolve(WORKBENCH_PUBLIC_HOST, 127.0.0.1:8443)`。
4. 请求侧剥离 `origin`、`host`、`cookie`、`content-length` 头；从 `GatewaySession::cookies` `Mutex<HashMap>`（初始从 `app_data_dir/axi-resume-cookie` 装载）附加 `Cookie`。
5. 当 cookie 集合变化时，仅把 `axi_resume` cookie 持久化到 `app_data_dir/axi-resume-cookie`（Unix 0600，原子 rename）。登出时清空 jar 并删除文件。
6. 响应侧仅回传 `content-type`、`cache-control`、`x-request-id` 头；保留状态码（特殊处理 204/205/304 → 空 body）。

**应用菜单 + tray + 全局快捷键。** Tauri 壳安装一个五子菜单的 AppKit 菜单（App / 文件 / 编辑 / 视图 / 窗口），标准加速键为 `Cmd+H` 隐藏、`Cmd+Q` 退出、`Cmd+T` 新建标签页、`Cmd+W` 关闭、`Cmd+Z`/`Shift+Cmd+Z` 撤销/重做、`Cmd+X/C/V/A` 剪切/复制/粘贴/全选、`Cmd+R` 重载、`Alt+Cmd+I` 切换 devtools、`Cmd+M` 最小化。其他菜单 id 通过 `native-menu` 自定义事件转发到 WebView。Tray（`main-tray`）含 Show/Hide/Quit；双击切换 main 显隐。`CmdOrCtrl+Shift+W` 通过 `global-shortcut` 注册为 `show-main-window`。single-instance 插件在二次启动时聚焦已有窗口。

**基于原生 `tauri-plugin-notification` 的通知去重。** `shell://notify` 载荷 `{ title, body, url?, tag? }`；同一 tag 在 1.5 s 窗口（`MERGE_WINDOW`）内的提交被丢弃（macOS 11+ 不再允许直接替换）；超过 `4 × MERGE_WINDOW` 的条目被淘汰。通知点击触发 `window.eval` 把 `pushState` 转到载荷 URL。

**本地运行时 supervisor（可选）。** `ensure-local-runtime.mjs` 在 `/health` 探针缺失时启动四个服务：`control-plane :8092`、`identity-adapter :8081`、`platform-core :8082`、`api-gateway :8088`。它也会尝试 `docker-compose` 拉起（postgres :5432、redis:6379）。Rust 端通过 `AXI_WORKBENCH_ROOT` 环境变量或 `CARGO_MANIFEST_DIR/../../../..` 发现 workspace root，并检查 `services/{api-gateway,control-plane}/scripts/dev-run.sh`。一旦启动，`LocalRuntime.prefer_local.store(true, SeqCst)` 让 `preferred_base_url` 始终返回 `http://127.0.0.1:8088`。

**TypeScript 端合约再导出。** `apps/workbench-desktop/src/contracts.ts` 是一行 facade：`export * from '@axi/workbench-foundation/shell-contracts'`。这让 Tauri 构建在不依赖桌面宿主包的前提下引用 shell-contracts；Web renderer 也直接从 `@axi/workbench-foundation` 拉取。

**与 Web 和 Mobile 分发跨端对齐。** 三个分发共享同一份 `@axi/workbench-foundation`、`@axi/workstation-contracts`、`@axi/tokens`、`@axi/core` 身份。Web 分发与 Mobile 分发各自固定 `apps/workbench-shared/src/brand/favicon-geometry.json` 作为品牌不变量的唯一来源。

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| 初次 Tauri 2 壳脚手架 | Shipped | `apps/workbench-desktop/package.json`（`@axi/workbench-desktop` v0.1.0）；`src-tauri/Cargo.toml`（`workbench_desktop_lib`）；`tauri.conf.json` 仅声明 login 窗口 |
| Web dist 镜像门禁 | Shipped | `a3f3c8c refactor(workbench-desktop): sync workbench-web token namespace rename`；`5a49491 feat(workbench-desktop): governance inspector + breadcrumb/tab refactor + verify docs`；`scripts/verify-desktop-contracts.mjs` 断言 dist → `workbench-dist/` 镜像 |
| Login → main → tray 生命周期 | Shipped | `src-tauri/src/lib.rs` 暴露 `proxy_gateway_request`、`open_external_url`；`SHELL_AUTHENTICATED: AtomicBool`；`shell://login-success` 触发 `switch_to_main()`；main 关闭 = `prevent_close(); window.hide()` |
| macOS 构建管线 | Shipped | `apps/workbench-desktop/scripts/build-macos.mjs` 将打包 Gateway URL 标准化为 `https://workbench.axiomaticworld.com`；支持 `APPLE_SIGNING_IDENTITY`；本地化 `InfoPlist.strings`（zh-Hans、en）；构建前跑 `verify:contracts` |
| Token 命名空间重命名收敛 | In progress | 当前分支 `feature/workbench-desktop-tokens-css-convergence`（working tree dirty）；近期提交 `4c925ae chore(distribution): land tokens css convergence wave`、`3a2c0f0 docs(designs): archive pending icons-sync wave patch`、`2dfe982 chore(gitignore): cover env + Android signing material` |
| 构建来源快照 | Shipped | `BUILD_INFO.json`（`framework=tauri-2`，`dist_commit=923092fed4b6fec5a5b7f232e3207ee87be916af` on `main`，`build_timestamp=2026-09-24T15:21:31Z`，`build_platform=darwin-arm64`，`app_bundle=apps/workbench-desktop/src-tauri/target/release/bundle/macos/公理工作台.app`，`dmg=null`，`latest_mac_yml=null`）；`notes: "No .dmg or latest-mac.yml produced; current bundle is a bare .app."` |
| DMG + 自动更新通道 | Not started | `BUILD_INFO.json` 中 `dmg: null`、`latest_mac_yml: null`；auto-update 在两者齐备前无法运行 |

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

- 兄弟分发：[`axi-workbench-web-dist`](/Volumes/code/workspace/distributions/axi-workbench-web) — 提供 `apps/workbench/dist/`，镜像到 `apps/workbench-desktop/workbench-dist/`；`installTauriGatewayFetch` 拦截器位于 `apps/workbench/src/lib/tauriGateway.ts`
- 兄弟分发：[`axi-workbench-mobile-dist`](/Volumes/code/workspace/distributions/axi-workbench-mobile) — 独立 mobile JS + Kotlin Compose 原生壳，共享 `@axi/workbench-foundation` 和 `@axi/workstation-contracts`
- 上游 monorepo：[`workbench/axi-workbench`](/Volumes/code/workspace/workbench/axi-workbench) — `apps/workbench`、`packages/*`、`foundation/axi-ui` 的源头
- 品牌合约：`apps/workbench-shared/src/brand/favicon-geometry.json`（被 `verify-desktop-contracts.mjs` 引用）
- Spec：`docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md`（§3 IPC + §5 Dock / tray）