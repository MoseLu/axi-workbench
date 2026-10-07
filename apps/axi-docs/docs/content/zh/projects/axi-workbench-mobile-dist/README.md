---
id: axi-docs-zh-projects-axi-workbench-mobile-dist
title: Axi Workbench Mobile Distribution
type: project
status: published
tags: [Axi Docs, 项目, distributions, reference, workbench, mobile, android]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench Mobile Distribution
graph-tags: [Projects, distributions, workbench, mobile]
description: Standalone mobile distribution with an independent Vite/React JS WeChat-style shell (`apps/workbench-mobile`) and a Kotlin Compose native Android app with CameraX/ML Kit scan, Ed25519 device pairing, and control-plane gateway routing.
project:
  id: axi-workbench-mobile-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-mobile
  source-section: reference
---

# Axi Workbench Mobile Distribution

> Workspace project dossier. Source of truth:
> [`/Volumes/code/workspace/distributions/axi-workbench-mobile`](/Volumes/code/workspace/distributions/axi-workbench-mobile).
> Partition: `distributions/`. Platform: **Android (Kotlin Compose + JS WeChat-style shell)**.

## Summary

一个独立的移动端分发，为 Axi Workbench 移动端通道并行提供 **两个共驻产品面** —— 一个独立的 **Vite/React JS 微信风格壳**（`apps/workbench-mobile`）以及一个 **Kotlin/Compose 原生 Android 应用**（`apps/workbench-mobile/android`）—— 它们共享同一份 `@axi/workbench-foundation`（AuthProvider、WorkbenchLocaleProvider、icons、shell-contracts）和 `@axi/workstation-contracts`。两个面服务同一个产品边界（workbench 移动端通道），但各自维护自己的实现：JS 壳是移动端的正典 UX（4 tab + 全屏扫码入口 + 二维码配对 + Web 登录确认 + 收件箱 + 交接），Kotlin 壳负责 CameraX/ML Kit 扫码、Android Keystore 设备密钥、原生推送通知和 WebView 容器槽位。依据 `apps/workbench-mobile/README.md` 中的 **Mobile 三端职责矩阵**，Web 管理后台的 Chrome 在移动端被禁止（`verify-mobile-contracts.mjs` 会拦截 `from '@axi/shell'`、`<AxiDashboardShell>`、`(?:\.\.\/)+workbench/` 以及手绘的 `<svg>`/`<path>`/`<circle>`/`<rect>` 图标等）—— 移动端 JS 是一套独立的信息架构，不是 Web 管理后台的窄屏分支。

构建矩阵：JS 壳为 pnpm 10.33.2 + Turbo 2.0 + TypeScript 5.3；Android 应用为 **AGP 8.7.2 + Kotlin 2.0.21 + Compose BOM 2024.10.01 + Gradle config-cache**。`applicationId = com.workbench.mobile`（release）/ `com.workbench.mobile.debug`（debug），`versionCode = 9`、`versionName = "1.0.8"`、`compileSdk = 34`、`minSdk = 24`、`targetSdk = 34`。Gateway URL 按 buildType 选取：`Debug = http://10.0.2.2:8088/api/v1/`（Android 模拟器宿主 loopback；可通过 `local.properties` `api.base.url` 覆盖），`Release = https://workbench.axiomaticworld.com/api/v1/`（通过 `-Papi.release.base.url` 覆盖）。控制面端口 `8092` 在 `normalizeGatewayBaseUrl` 中被显式拒绝作为运行时 gateway。CI 使用 GitHub Actions（目前仅 Android）；iOS 目标在此分发中尚未配置。

**Stage**：现役产品分发，Axi Workbench 三端中的移动端。Build：2026-09-24，web 产物 `apps/workbench-mobile/dist/`，release APK `apps/workbench-mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk`（24.9 MB，未签名），debug APK 46.7 MB。iOS：`null`（未配置）。`verify-mobile-contracts.mjs` 强制移动端 JS 合约，并 **禁止** 任何第二个 Kotlin 端登录文件超过 `DeprecatedNativeManualLogin.kt`。

## Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Workspace root | pnpm 10.33.2 + Turbo 2.0 + TypeScript 5.3 + sass 1.77 | `engines.node>=22`, `pnpm>=10`, `packageManager pnpm@10.33.2`; scripts `dev`, `build`, `type-check`, `test`, `lint`, `verify:ci` |
| Mobile JS shell (`apps/workbench-mobile`) | React 18 + Vite 5 + TanStack Query 5 + react-router-dom 6 + `@axi/core`, `@axi/tokens`, `@axi/workbench-foundation` | Vite dev on `127.0.0.1:5174` (`host: true`); proxies `/api` → `VITE_API_PROXY_TARGET || http://localhost:8088`; mobile CSS `wechat-mobile.css`; locales `zh-CN` (`'app.name': 'Axi 工作台'`) + `en-US` (`'app.name': 'Axi Workbench'`); document `<title>Axi 工作台</title>` |
| Shared JS packages | `@axi/workstation-contracts` (zod 4) + `@axi/workbench-foundation` (AuthProvider, WorkbenchLocaleProvider, icons, shell-contracts, notifications, username) | `workbench-foundation` uses `@tanstack/react-query` + `react` as peer deps; `auth`, `locale` providers must mount before the local router |
| Mobile JS architecture | 4 tabs (`home` / `projects` / `workspace` / `me`) + `/scan` & `/scan/pair` as full-screen sub-routes + `/login`, `/login/confirm-web`, `/auth/callback`, `/handoffs`, `/inbox`, `/search` | `MobileNavKey = 'home' \| 'projects' \| 'workspace' \| 'me'` exactly; `'scan'` forbidden from bottom-nav (`verify-mobile-contracts.mjs`) |
| Mobile JS auth | Email verification code (`requestEmailCode` + `confirmEmailCode` + `challengeId` + `one-time-code` autofill) | Forbidden: `beginLogin` (no silent OIDC redirect), `password/i` (no password flow) |
| Mobile JS device pairing | `mobileControl.ts`: Ed25519 keypair with `extractable=false` (throws if changed); stored in **IndexedDB only** (no `localStorage` / `sessionStorage`); `control-plane/mobile/pair-approval` carries `ownerApprovalToken` | `/scan/pair` parses `axi-mobile-pair-v1` payload (must contain `webPairingId` + `scanToken`); polls for Web owner confirmation via `completeScannedMobilePairing` |
| Mobile JS Web login QR | `webLoginQr.ts` `kind: 'axi-web-login-v1'`; `WEB_LOGIN_ID_PATTERN` + `OPAQUE_TOKEN_PATTERN`; `WebLoginConfirmPage` calls `approveMobileWebLoginQr`; `mobileControl.ts` uses `resolveGatewayURL(\`/api/v1/mobile/web-login/qr/scan\`)`; forbids `parseQRApprovalPayload` / `qrApprovalEndpoint` / `credentials: 'include'` (OIDC fallback forbidden) |
| Domain approval QR (mobile JS) | `parseApprovalScanPayload` + `resolveMobileApprovalScan`; URI scheme `axi://approval`; opaque payload (no `ticket`, no `projectId`, no `actionId`) | Top-level `/scan` route is the canonical entry; result resolves through the control plane |
| Native Android shell (`apps/workbench-mobile/android`) | Kotlin 2.0.21 + Jetpack Compose (BOM 2024.10.01) + Material 3 + Hilt 2.52 + Navigation Compose 2.8.4 + CameraX 1.4 + ML Kit Barcode 17.3 + Accompanist Permissions 0.36 + Retrofit 2.11 + OkHttp 4.12 + kotlinx.serialization 1.7.3 + DataStore Preferences 1.1.1 + Coil 2.7 + Timber 5.0.1 + Room 2.6.1 (declared, not yet wired) + JUnit 4.13.2 + Turbine 1.2.0 | AGP 8.7.2; Java/Kotlin `sourceCompatibility = VERSION_17`; KSP `2.0.21-1.0.27` |
| Single Activity | `MainActivity.kt` `@AndroidEntryPoint` (ComponentActivity) | `enableEdgeToEdge()`, `enforceOpaqueWindow()` (clear translucent flags, draw system bar backgrounds, opaque pixel format, contrast enforcement off, decor fits system windows off). On `Build.VERSION_CODES.S`, `getSplashScreen().setOnExitAnimationListener { remove() }` (no platform fade-out, no double logo) |
| Startup choreography | `showNativeStartup()` adds `BrandLoadingView` (native View) to `FrameLayout` with `R.color.wechat_chrome_bg`; `startupRoot.postOnAnimation { mountComposeContent() }` mounts `ComposeView` underneath (index 0) so native Loading remains topmost | `mountComposeContent()` wraps `WorkBenchStartupGate(onStartup = gatewayEndpointStore::hydrate, onReady = ::dismissNativeStartup)`; native Loading is removed only after first workspace state lands |
| Gateway routing (Kotlin) | `GatewayEndpointStore` (Singleton, `@Inject`) over DataStore `gateway_endpoint` preferences | `normalizeGatewayBaseUrl()` accepts only `http/https` schemes with no userinfo/query/fragment, path ≤ `/api/v1`, **rejects port 8092** (control-plane direct), rewrites to `/api/v1/`. Retrofit base URL is the placeholder `http://axi.invalid/`; `interceptor()` rewrites via `rewriteGatewayRequestUrl(endpoint, placeholder)`. `requiresExplicitLanGateway()` requires real handset (non-emulator) without stored endpoint and default `10.0.2.2` to surface `GatewayEndpointConfigurationRequiredException` (no 15-ss hang on `10.0.2.2`) |
| Device session | `ControlPlaneSessionStore` (Singleton, `@Inject`) over DataStore `control_plane_session`; `ControlPlaneSession(deviceId?, pendingPairingId?, pendingPairingCode?, accessToken?, accessTokenExpiresAt?)` | `legacyDeviceSecretKey = "device_secret_hex"` removed on hydrate (HMAC secret incompatible with per-device Keystore pairing contract). `ControlPlaneCrypto.deleteDeviceKey()` called on `clear()`. `hasUsableAccessToken` requires `expiresAt > now + 30s` |
| Navigation graph (`WorkBenchNavHost.kt`) | Compose Navigation 2.8.4; startDestination `WORKSPACE`; routes HOME / SCAN / SCAN_RESULT / PROJECTS / PROJECT_DETAIL / PROJECT_DEVELOPER / WORKSPACE / PENDING / WORKSPACE_GROUP / FILE_PREVIEW / ME / ACCOUNT / ACCOUNT_EDIT / DEVICES / NOTIFICATIONS / THEME / SETTINGS / SEARCH | `WorkspaceViewModel` is a Hilt-scoped shared state across the graph; `PROJECTS` + `WORKSPACE_STATUS` immediately `navigate(WORKSPACE)` + `popUpTo` to avoid duplicate shells; deep-link `workbench://` is handled by MainActivity (currently a TODO comment in NavHost) |
| Brand | `R.string.app_name = "Axi 工作台"`, `R.string.startup_preparing_workspace = "正在准备工作区…"`; launcher `mipmap-*/ic_launcher.png`; Android 12+ Splash uses `ic_splash_logo.xml` (with safety inset to defeat auto-crop); dango-family master reused from desktop `apps/workbench-desktop/src-tauri/icons/icon.png` | No `adaptive-icon` wrap on launcher; `BrandLoadingView` sizes the master image; `verify-mobile-contracts.mjs` byte-equality check on `public/favicon.svg` vs `apps/workbench/public/favicon.svg` |
| CI | GitHub Actions on `ubuntu-latest`, Node 22, pnpm `action-setup@v4`; jobs `contracts` / `typecheck` / `test` / `build` | `turbo.json` `globalDependencies: ["**/.env.*local"]`; `test.dependsOn: ["build"]` |
| Auth flow | OIDC (Web → email code (mobile JS) → device-pairing QR (Kotlin first run) → `axi-web-login-v1` QR (Kotlin for Web login) → domain approval `axi://approval` (mobile JS top-level scan) | `verify-mobile-contracts.mjs` enforces the JS flow; `DeprecatedNativeManualLogin.kt` is retained but `@Deprecated` and **not** registered in `WorkBenchNavHost` |

## Project Layout

```text
axi-workbench-mobile/
├── README.md / README.zh-CN.md      # Distribution READMEs (zh-CN primary, English mirror)
├── package.json                     # Workspace root (axi-workbench-mobile); scripts dev/build/type-check/test/lint/verify:ci
├── pnpm-workspace.yaml             # globs apps/* + packages/* + foundation/axi-ui/packages/*
├── turbo.json                      # build ^build; type-check ^build; dev cache:false persistent; test dependsOn:[build]
├── tsconfig.base.json / tsconfig.json / tsconfig.node.json
├── BUILD_INFO.json                 # kind=mobile-distribution, platforms=[android]; web + android_release_unsigned + debug APK
├── .github/workflows/ci.yml         # CI: pnpm install + verify:ci + typecheck + build
├── .githooks/{pre-commit,commit-msg,post-commit}
├── scripts/verify-ci-contracts.mjs # Workspace CI contract gate
├── shared/axi-ui/packages/{core,presets,tokens}/  # Vendored axi-ui minimal subset
├── packages/
│   ├── schemas/                     # @axi/workstation-contracts (zod 4) split subpaths
│   └── workbench-foundation/        # @axi/workbench-foundation (same identity as Web/Desktop)
├── apps/
│   └── workbench-mobile/           # @axi/workbench-mobile v1.0.0; mobile JS shell + Android project
│       ├── README.md                # Mobile 三端职责矩阵 + decision records
│       ├── package.json             # @tanstack/react-query 5, react 18, react-dom 18, react-router-dom 6.20
│       ├── index.html               # <title>Axi 工作台</title>, theme-color #0f1724, favicons
│       ├── vite.config.ts           # Vite dev 127.0.0.1:5174 host:true; /api proxy
│       ├── playwright.config.ts + e2e/login.spec.ts
│       ├── public/{favicon.svg,favicon-32.png,favicon-48.png,apple-touch-icon.png}
│       ├── src/
│       │   ├── main.tsx             # createRoot + side-effect CSS for tokens + core
│       │   ├── App.tsx              # Provider tree: AxiThemeProvider → MobileSurface → routes
│       │   ├── layouts/MobileShell.tsx  # WeChat-style shell
│       │   ├── i18n.ts              # zh-CN + en-US with app.name; sets document.title
│       │   ├── components/{MobileHeader,MobileTabBar,MobileIcons,MobileDeviceSessionBootstrap,RequireSession,MobileProjectionState}
│       │   ├── pages/{HomePage,ProjectsPage,FocusPage,InboxPage,HandoffPage,ProfilePage,SearchPage,LoginPage,ScanPage,PairingScanPage,AuthCallbackPage,WebLoginConfirmPage}
│       │   ├── lib/{mobileControl,mobilePairingQr,approvalScan,webLoginQr,navigation}.ts
│       │   └── assets/{icons,styles}
│       ├── scripts/verify-mobile-contracts.mjs   # 130+ line contract gate
│       └── android/                # Kotlin Compose native app
│           ├── README.md            # Android 工程 overview
│           ├── build.gradle.kts     # Root; plugin aliases android.application/kotlin.android/kotlin.compose/kotlin.serialization/hilt/ksp apply false
│           ├── settings.gradle.kts  # pluginManagement + RepositoriesMode.FAIL_ON_PROJECT_REPOS; rootProject.name=Axi 工作台; include(:app)
│           ├── gradle.properties    # org.gradle.jvmargs=-Xmx4g; configuration-cache=true; useAndroidX=true; nonTransitiveRClass=true
│           ├── gradle/libs.versions.toml  # agp 8.7.2; kotlin 2.0.21; compose-bom 2024.10.01; hilt 2.52; ...
│           ├── gradle/wrapper/gradle-wrapper.{jar,properties}
│           ├── gradlew / gradlew.bat
│           ├── local.properties     # api.base.url (debug), SDK paths
│           ├── docs/decisions/0001-kotlin-manual-login.md
│           └── app/
│               ├── build.gradle.kts # namespace=com.workbench.mobile; compileSdk=34; applicationId=com.workbench.mobile; minSdk=24; targetSdk=34; versionCode=9; versionName=1.0.8; GATEWAY_BASE_URL per buildType
│               ├── proguard-rules.pro
│               ├── debug.keystore
│               ├── docs/decisions/0001-kotlin-manual-login.md
│               └── src/main/
│                   ├── AndroidManifest.xml      # uses-feature camera; permissions CAMERA, INTERNET, VIBRATE; deep-link workbench://
│                   ├── res/values/strings.xml   # app_name="Axi 工作台", startup_preparing_workspace="正在准备工作区…"
│                   ├── res/xml/network_security_config.xml  # cleartext + explicit allow 10.0.2.2/localhost/127.0.0.1
│                   ├── res/values{,-v27,-v29,-v31}/themes.xml  # Theme.WorkBench + Theme.WorkBench.Starting
│                   ├── res/{drawable,drawable-*}/  # ic_wechat_plus.png, ic_wechat_search.png, ic_scan.xml, ic_splash_logo.xml
│                   ├── res/mipmap-*/           # Launcher + round icon across densities
│                   ├── res/drawable-nodpi/    # dango-family master from desktop
│                   ├── res/xml/{backup_rules,data_extraction_rules}.xml
│                   └── java/com/workbench/mobile/
│                       ├── WorkBenchApp.kt           # @HiltAndroidApp Application
│                       ├── MainActivity.kt           # enableEdgeToEdge, enforceOpaqueWindow, mountComposeContent
│                       ├── di/AppModule.kt           # OkHttp + Retrofit + AuthApi/ControlPlaneApi + repos
│                       ├── data/{network,auth,repository,profile}/
│                       │   ├── network/GatewayEndpoint.kt        # normalizeGatewayBaseUrl + requiresExplicitLanGateway
│                       │   ├── auth/{TokenStore,DeviceInfo,ControlPlaneCrypto,ControlPlaneSessionStore}.kt
│                       │   ├── api/{AuthApi,ControlPlaneApi,NotificationApi,dto}
│                       │   ├── repository/{WorkspaceRepository,NavBadgeRepository}.kt
│                       │   └── profile/ProfileStore.kt
│                       ├── ui/
│                       │   ├── startup/                          # BrandLoadingView + WorkBenchStartupGate
│                       │   ├── navigation/WorkBenchNavHost.kt   # Compose NavHost startDestination WORKSPACE
│                       │   ├── screens/{home,projects,project,workspace,scan,scanresult,file,me,settings,search,manual}/
│                       │   │   └── manual/DeprecatedNativeManualLogin.kt   # @Deprecated, not in nav
│                       │   └── components/{WorkBenchChrome,WorkBenchEmptyState,WorkspaceStatusCards,WorkspaceSyncContent,NavBadge,NavBadgeAccess}
│                       └── util/
└── docs/
    ├── HANDOFF.md                   # Zero-context takeover (mirror of Web dist)
    ├── VERIFICATION.md
    ├── project-docs.manifest.json   # Axi overlay
    └── logs/submit/2026{09,10}-*.md
```

## Build & Install

```bash
# Workspace install
pnpm install

# Mobile JS shell
pnpm --filter @axi/workbench-mobile dev           # vite @ 127.0.0.1:5174
pnpm --filter @axi/workbench-mobile build         # tsc + vite build → apps/workbench-mobile/dist
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile test
pnpm --filter @axi/workbench-mobile verify:contracts   # verify-mobile-contracts.mjs

# Native Android shell
cd apps/workbench-mobile/android
./gradlew test
./gradlew assembleDebug                 # com.workbench.mobile.debug, GATEWAY_BASE_URL=http://10.0.2.2:8088/api/v1/
./gradlew assembleRelease                # com.workbench.mobile, GATEWAY_BASE_URL=https://workbench.axiomaticworld.com/api/v1/

# Override gateway via local.properties (Debug) or -P (Release)
# local.properties: api.base.url=http://192.168.1.100:8088/api/v1/
# -Papi.release.base.url=https://<project-host>/api/v1/

# Install + launch on attached device
./gradlew :app:installDebug
adb shell am start -n com.workbench.mobile.debug/com.workbench.mobile.MainActivity

# CI gate
pnpm verify:ci                           # scripts/verify-ci-contracts.mjs
```

## Verification

```bash
# Workspace-level CI gate (Turbo + workflow + workspace yaml + scripts)
pnpm verify:ci

# Mobile JS contract gate
pnpm --filter @axi/workbench-mobile verify:contracts

# Mobile JS unit tests
pnpm --filter @axi/workbench-mobile test

# Native Android unit tests
cd apps/workbench-mobile/android && ./gradlew test
```

`verify-mobile-contracts.mjs` 是一个 130+ 行的合约门禁，包含以下断言组：

**JS 壳正向**：`MobileShell`（自有壳层）、`WorkbenchLocaleProvider` 在 `BrowserRouter` 之前挂载、`path="scan"` 与 `path="scan/pair"` 归属 mobile；`MobileShell.tsx` `isScanRoute` 切到 `axi-mobile-app--scanner`；普通路由挂载 `MobileHeader` + `MobileTabBar`；`wb-mobile-topbar` + `wb-bottom-nav` 类；`MobileNavKey = 'home' | 'projects' | 'workspace' | 'me'`；topbar plus 按钮调用 `navigate('/scan')`；`package.json` 消费 `@axi/workbench-foundation`；`index` 暴露 `favicon-32.png`、`favicon-48.png`、`favicon.svg`、`apple-touch-icon.png`、`<title>Axi 工作台</title>`；`zh-CN` / `en-US` 都定义 `app.name`；Android launcher `R.string.app_name = "Axi 工作台"`；`BrandLoadingView` 使用 `R.string.app_name` + `R.string.startup_preparing_workspace`；favicon 与 Web 字节相同；favicon SVG 使用 `viewBox` + `<image>` href + `data-family-layout`（依据 `favicon-geometry.json`，禁止旧版六瓣花）；`MobileIcons` 使用 `AxiSvgIcon` + `resolveAxiWorkbenchIcon`；`LoginPage` 使用 `AxiLogoMark`、`login.emailCode`、`requestEmailCode`、`confirmEmailCode`、`challengeId`、`one-time-code`。

**JS 壳反向**：`App.tsx` 不引入 `@axi/shell` 或 `<AxiDashboardShell>`；shell/header/tabbar 不含 Web 管理后台 Chrome（`<AxiDashboardShell>`、`<AxiBreadcrumb>`、`<AxiTabBar>`）；header 无 `AxiMark`；无 `(?:\.\.\/)+workbench/` 跨 app 引用；`MobileIcons`/`MobileHeader`/`MobileTabBar` 不含手绘图标（`<svg>`、`<path>`、`<circle>`、`<rect>`）；topbar plus 不含 CSS 伪元素（`.wb-mobile-topbar__plus::before`/`::after`）；扫码/登录确认流程不出现 `localStorage`/`sessionStorage`/`console.*`；JS 不声明对 `com.axi.workbench.mobile` / `MainActivity` / `WebView` 的 APK 壳所有权。

**Kotlin 壳**：`DeprecatedNativeManualLogin.kt` 是 `@Deprecated`；`ui/screens/manual/` 下 **仅允许** `DeprecatedNativeManualLogin.kt`；任何 active Kotlin 文件不得重新引入 `password`。

**API 路由**：`mobileControl.ts` 调用 `resolveGatewayURL(\`/api/v1/mobile/...)`；使用 Ed25519 且 `record.privateKey.extractable` 若被改动即抛错；调用 `control-plane/mobile/pair-approval` 时携带 `ownerApprovalToken`；通过 `indexedDB` 持久化；禁止 `localhost:8092` / `CONTROL_PLANE_URL` / `localStorage` / `sessionStorage`。

**业务页（`Home` / `Projects` / `Workspace`）**：必须使用 `useMobileWorkspaceQuery` + `MobileProjectionState`；Workspace 必须调用 `runMobileProjectAction`；禁止 `setTasks` / `toggleTask` / `task.done` / `localStorage` / `sessionStorage`（禁止本地态任务完成）；禁止 `DEMO_` / `mockProject|Task|Data` / `staticProjects`；Search 必须使用 `useMobileWorkspaceQuery` + `MobileProjectionState`（禁止静态语料、`navigationReview`、`syncStatus`）。

## Architecture Highlights

**移动端分发保持三个 UI、一个产品边界。** `apps/workbench-mobile/README.md` 中的 Mobile 三端职责矩阵是“谁负责什么”的事实源：
- **mobile JS（Vite/React）** 拥有 4 tab 信息架构（`home` / `projects` / `workspace` / `me`）、邮件验证码登录、移动端配对扫码（`axi-mobile-pair-v1`）、Web 登录确认（`axi-web-login-v1`）、域内审批扫码（`axi://approval`）、Ed25519 设备密钥（IndexedDB、`extractable=false`）、控制面移动端路由（`/api/v1/mobile/*`），以及 TanStack-Query 的 `useMobileWorkspaceQuery` + `MobileProjectionState`。JS 壳 **不** 引入 `@axi/shell` / `AxiDashboardShell` / `AxiBreadcrumb` / `AxiTabBar`，**不** 引用 `apps/workbench/src/pages/` 下任何代码，**不** 维护手绘图标集（仅 `AxiSvgIcon`）。
- **mobile Kotlin（原生壳）** 拥有 Activity 启动编排（先 `BrandLoadingView`、下方挂载 `ComposeView`、Android 12+ 移除 splash 退出动画）、CameraX + ML Kit 扫码、Android Keystore 设备密钥存储（按设备、不可导出）、设备配对扫码、配对后的 Web 登录扫码、系统通知/推送、WebView 容器槽位（尚未接线）、Hilt 托管的 `GatewayEndpointStore` + `ControlPlaneSessionStore`。Kotlin 壳 **不** 写第二套账号登录协议；首次启动仅为设备配对扫码。`DeprecatedNativeManualLogin.kt` 是 `@Deprecated`，且刻意未注册到 `WorkBenchNavHost`；`verify-mobile-contracts.mjs` 断言不存在第二个 Kotlin 登录文件。
- **Web 管理后台（`apps/workworkbench`）** 拥有 OIDC 登录流与管理后台 Chrome。Mobile JS 不会静默重定向到 OIDC（`forbidMatch(login, /beginLogin/)`）；邮件验证码路径才是 JS 入口。

**Mobile JS session bootstrap 与桌面镜像。** `MobileDeviceSessionBootstrap` 在 `BrowserRouter` 内为 `/login/confirm-web` 与根 `/` 执行，提前 hydrate 移动端 device session 再渲染需要配对状态的页面。登录页使用 `requestEmailCode` / `confirmEmailCode` 调用 `resolveGatewayURL(\`/api/v1/mobile/...)`，并在 Android 上呈现 `one-time-code` 自动填充。

**原生 Kotlin 启动是三段式合成。** `MainActivity.onCreate()` 调用 `enableEdgeToEdge()` + `enforceOpaqueWindow()`（清理半透明 status/nav flag、绘制系统栏背景、不透明像素格式、关闭对比度强制、关闭 decor fits system windows、系统栏采用浅色外观），然后 `showNativeStartup()` 在 `FrameLayout` 之上添加 `BrandLoadingView`（自定义原生 View），背景色为 `R.color.wechat_chrome_bg`。在首次真实绘制后（`startupRoot.postOnAnimation`），`mountComposeContent()` 在 index 0 添加 `ComposeView`（渲染在品牌 View 之下），并调用 `WorkBenchStartupGate(onStartup = gatewayEndpointStore::hydrate, onReady = ::dismissNativeStartup)`。`WorkBenchStartupGate` 仅在 `WorkspaceViewModel.state.first { !Loading || snapshot != null }` 之后才移除品牌 View，避免把中间过程暴露为正典首帧。Android 12+ splash：`removePlatformSplashExitAnimation()`（抑制 OS 退出淡出，避免双 Logo 闪烁）。

**Gateway URL 标准化、拒绝控制面端口。** `normalizeGatewayBaseUrl()` 仅接受 `http`/`https` 协议、不接受 userinfo、不接受 query、不接受 fragment，拒绝端口 `8092`，并将路径重写为 `/api/v1/`。Retrofit 占位 base URL 是 `http://axi.invalid/`；`Interceptor` 通过 `rewriteGatewayRequestUrl(endpoint, placeholder)` 把每个请求 URL 重写到缓存的 endpoint。`requiresExplicitLanGateway()` 检查 `isLikelyAndroidEmulator()`（fingerprint/model/product 启发式）和 `BuildConfig.GATEWAY_BASE_URL` 默认值；若手机是真机、没有存储 endpoint，且默认值为 `10.0.2.2`，则 `requireConfiguredLanGateway()` 抛出 `GatewayEndpointConfigurationRequiredException`——避免针对模拟器别名 15 秒的 socket 尝试。用户被迫从“我的 → 设置 → 本机网关”输入 LAN gateway URL；`save()` 在写入 DataStore 前再次执行 `normalizeGatewayBaseUrl()`。

**Native session 存储使用 DataStore Preferences，与 auth 分离。** `ControlPlaneSessionStore`（与 `TokenStore` 分离）持有 `deviceId` + `pendingPairingId` + `pendingPairingCode` + `accessToken` + `accessTokenExpiresAt`；hydrate 时移除 `legacyDeviceSecretKey`（HMAC 密钥与按设备 Keystore 合约不兼容）。`ControlPlaneCrypto.deleteDeviceKey()` 在 `clear()` 时调用。Session **不** 与账号 gateway JWT 复用——它是控制面专属的设备 session。

**跨分发对齐。** 移动端分发与 Web、桌面端分发共享同一份 `@axi/workbench-foundation` 与 `@axi/workstation-contracts` 身份，全部锚定 `apps/workbench-shared/src/brand/favicon-geometry.json`（dango-family 不变量的唯一来源）。`verify-mobile-contracts.mjs` 字节比对 `apps/workbench-mobile/public/favicon.svg` 与 `apps/workbench/public/favicon.svg`，锁定跨面品牌。

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| 初次 Android Kotlin 壳脚手架 | Shipped | `apps/workbench-mobile/android/app/build.gradle.kts`（`namespace=com.workbench.mobile`）；`MainActivity.kt` `@AndroidEntryPoint`；`WorkBenchApp.kt` `@HiltAndroidApp` |
| Vite/React 移动端 JS 壳 | Shipped | `apps/workbench-mobile/package.json`（`@axi/workbench-mobile` v1.0.0）；`vite.config.ts`（`127.0.0.1:5174 host:true`）；`MobileShell.tsx` 微信风格 |
| Mobile JS 合约门禁 | Shipped | `638dea0 feat(workbench-mobile): vite config + governance submit-log ingest`；`apps/workbench-mobile/scripts/verify-mobile-contracts.mjs` 130+ 行拦截 `@axi/shell`/`<AxiDashboardShell>`/`(??:.\\/)+workbench/`，强制 `MobileNavKey = 'home' \| 'projects' \| 'workspace' \| 'me'`，禁止超出 `DeprecatedNativeManualLogin.kt` 的第二个 Kotlin 登录文件 |
| 设备配对（Ed25519 + IndexedDB） | Shipped | `mobileControl.ts`（`extractable=false`；若被改动即抛错）；`ControlPlaneSessionStore` 基于 DataStore `control_plane_session`；`/scan/pair` 解析 `axi-mobile-pair-v1` 载荷（`webPairingId` + `scanToken`）；通过 `completeScannedMobilePairing` 轮询 Web 端确认 |
| Gateway URL 标准化 | Shipped | `normalizeGatewayBaseUrl()` 仅接受 http/https，拒绝端口 `8092`，重写路径为 `/api/v1/`；`GatewayEndpointConfigurationRequiredException` 阻断 `10.0.2.2` 上 15 秒的 hang；`BuildConfig.GATEWAY_BASE_URL` 按 buildType（Debug `http://10.0.2.2:8088/api/v1/`、Release `https://workbench.axiomaticworld.com/api/v1/`） |
| Android 12+ splash 退出抑制 | Shipped | `MainActivity.kt` `getSplashScreen().setOnExitAnimationListener { remove() }`；`enforceOpaqueWindow()` 清理半透明 flag |
| 构建来源快照 | Shipped | `BUILD_INFO.json`（`kind=mobile-distribution`、`platforms=[android]`、`source.commit=cc83e5e01cf3110479ac7e96ca8aee7cacfe4113` on `dev`、`dist_commit=276a64599a680a00567c746796a25c1856aa513f` on `main`、`build_timestamp=2026-09-24T15:21:31Z`、`web=apps/workbench-mobile/dist/`、`android_release_apk_unsigned={path=apps/workbench-mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk, size_bytes=24903537, signed=false}`、`android_debug_apk={size_bytes=46693918}`、`ios=null`）；`notes: "iOS build target not configured in this distribution. Release APK is unsigned and requires signing before store distribution."` |
| iOS 目标 | Not started | `BUILD_INFO.json` 中 `ios: null`；此分发中尚未配置 |

## Authoritative Documents

- [`README.md`](/Volumes/code/workspace/distributions/axi-workbench-mobile/README.md) — distribution README (zh-CN; English README has identical content via mirror)
- [`README.zh-CN.md`](/Volumes/code/workspace/distributions/axi-workbench-mobile/README.zh-CN.md) — Chinese distribution README
- [`package.json`](/Volumes/code/workspace/distributions/axi-workbench-mobile/package.json) — workspace root
- [`pnpm-workspace.yaml`](/Volumes/code/workspace/distributions/axi-workbench-mobile/pnpm-workspace.yaml)
- [`turbo.json`](/Volumes/code/workspace/distributions/axi-workbench-mobile/turbo.json)
- [`BUILD_INFO.json`](/Volumes/code/workspace/distributions/axi-workbench-mobile/BUILD_INFO.json)
- [`docs/HANDOFF.md`](/Volumes/code/workspace/distributions/axi-workbench-mobile/docs/HANDOFF.md)
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/distributions/axi-workbench-mobile/docs/VERIFICATION.md)
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/distributions/axi-workbench-mobile/docs/project-docs.manifest.json)
- [`apps/workbench-mobile/README.md`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/README.md) — Mobile 三端职责矩阵 + decision records
- [`apps/workbench-mobile/scripts/verify-mobile-contracts.mjs`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/scripts/verify-mobile-contracts.mjs) — mobile JS contract gate
- [`apps/workbench-mobile/android/README.md`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/README.md) — Android 工程 overview
- [`apps/workbench-mobile/android/app/build.gradle.kts`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/build.gradle.kts)
- [`apps/workbench-mobile/android/gradle/libs.versions.toml`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/gradle/libs.versions.toml)
- [`apps/workbench-mobile/android/app/src/main/AndroidManifest.xml`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/src/main/AndroidManifest.xml)
- [`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/MainActivity.kt`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/MainActivity.kt)
- [`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/ui/navigation/WorkBenchNavHost.kt`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/ui/navigation/WorkBenchNavHost.kt)
- [`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/data/network/GatewayEndpoint.kt`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/data/network/GatewayEndpoint.kt)
- [`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/data/auth/ControlPlaneSessionStore.kt`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/data/auth/ControlPlaneSessionStore.kt)
- [`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/ui/screens/manual/DeprecatedNativeManualLogin.kt`](/Volumes/code/workspace/distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/ui/screens/manual/DeprecatedNativeManualLogin.kt) — `@Deprecated`, not in nav

## Cross-References

- 兄弟分发：[`axi-workbench-web-dist`](/Volumes/code/workspace/distributions/axi-workbench-web) — 移动端面鉴权的 Web 管理后台 SPA（Web 登录走 Web OIDC）
- 兄弟分发：[`axi-workbench-desktop-dist`](/Volumes/code/workspace/distributions/axi-workbench-desktop) — 移动端 JS 与之配对的 Tauri macOS 应用（设备配对走 Web/desktop QR）
- 上游 monorepo：[`workbench/axi-workbench`](/Volumes/code/workspace/workbench/axi-workbench) — `apps/workbench-mobile`、`packages/*`、`foundation/axi-ui` 的源头
- 品牌合约：`apps/workbench-shared/src/brand/favicon-geometry.json`（被 `verify-mobile-contracts.mjs` 引用）
- Decision record：`apps/workbench-mobile/android/docs/decisions/0001-kotlin-manual-login.md`（Kotlin 手动登录被废弃）