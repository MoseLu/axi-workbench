---
id: axi-docs-en-projects-axi-workbench-mobile-dist
title: Axi Workbench Mobile Distribution
type: project
status: published
tags: [Axi Docs, Projects, distributions, reference, workbench, mobile, android]
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

A standalone mobile distribution that ships **two co-resident product surfaces** for the Axi Workbench mobile channel — an independent **Vite/React JS WeChat-style shell** (`apps/workbench-mobile`) and a **Kotlin/Compose native Android app** (`apps/workbench-mobile/android`) — sharing the same `@axi/workbench-foundation` (AuthProvider, WorkbenchLocaleProvider, icons, shell-contracts) and `@axi/workstation-contracts`. Both surfaces serve the same product boundary (workbench mobile channel) but each maintains its own implementation; the JS shell is the canonical mobile UX (4-tab + scan-all home + QR pairing + Web login confirmation + inbox + handoffs), while the Kotlin shell owns CameraX/ML Kit scanning, Android Keystore device-key storage, native push notifications, and the WebView container slot. Per the **Mobile 三端职责矩阵** in `apps/workbench-mobile/README.md`, the Web admin chrome is forbidden on mobile (`verify-mobile-contracts.mjs` blocks `from '@axi/shell'`, `<AxiDashboardShell>`, `(?:\.\.\/)+workbench/`, hand-drawn `<svg>`/`<path>`, `<circle>`, `<rect>` icons, etc.) — mobile JS is an independent information architecture, not a narrow-screen branch of the Web admin.

Build matrix: pnpm 10.33.2 + Turbo 2.0 + TypeScript 5.3 for the JS shell; **AGP 8.7.2 + Kotlin 2.0.21 + Compose BOM 2024.10.01 + Gradle config-cache** for the Android app. `applicationId = com.workbench.mobile` (release) / `com.workbench.mobile.debug` (debug) at `versionCode = 9`, `versionName = "1.0.8"`, `compileSdk = 34`, `minSdk = 24`, `targetSdk = 34`. Gateway URL is selected per build type: `Debug = http://10.0.2.2:8088/api/v1/` (Android Emulator host loopback; overridable via `local.properties` `api.base.url`), `Release = https://workbench.axiomaticworld.com/api/v1/` (overridable via `-Papi.release.base.url`). The control-plane port `8092` is explicitly rejected as a runtime gateway (`normalizeGatewayBaseUrl`). CI is GitHub Actions (Android-only at present); iOS target is not configured in this distribution.

**Stage**: live product distribution, mobile channel of the Axi Workbench trio. Build: 2026-09-24, web `apps/workbench-mobile/dist/`, release APK `apps/workbench-mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk` (24.9 MB, unsigned), debug APK 46.7 MB. iOS: `null` (not configured). `verify-mobile-contracts.mjs` enforces the mobile JS contract and **forbids** any second Kotlin-side login file beyond `DeprecatedNativeManualLogin.kt`.

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

`verify-mobile-contracts.mjs` is a 130+ line contract gate with these assertion groups:

**JS shell positive**: `MobileShell` (own shell), `WorkbenchLocaleProvider` mounted before `BrowserRouter`, `path="scan"` + `path="scan/pair"` owned by mobile; `MobileShell.tsx` `isScanRoute` switches to `axi-mobile-app--scanner`; `MobileHeader` + `MobileTabBar` mounted for ordinary routes; `wb-mobile-topbar` + `wb-bottom-nav` classes; `MobileNavKey = 'home' | 'projects' | 'workspace' | 'me'`; `navigate('/scan')` from topbar plus-button; package.json consumes `@axi/workbench-foundation`; index exposes `favicon-32.png`, `favicon-48.png`, `favicon.svg`, `apple-touch-icon.png`, `<title>Axi 工作台</title>`; locale `zh-CN` / `en-US` both define `app.name`; Android launcher `R.string.app_name = "Axi 工作台"`; `BrandLoadingView` uses `R.string.app_name` + `R.string.startup_preparing_workspace`; favicon byte-equality with Web; favicon SVG uses `viewBox` + `<image>` href + `data-family-layout` per `favicon-geometry.json` (forbidden legacy six-petal pattern); `MobileIcons` uses `AxiSvgIcon` + `resolveAxiWorkbenchIcon`; `LoginPage` uses `AxiLogoMark`, `login.emailCode`, `requestEmailCode`, `confirmEmailCode`, `challengeId`, `one-time-code`.

**JS shell negative**: no `@axi/shell` import or `<AxiDashboardShell>` in `App.tsx`; no Web admin chrome (`<AxiDashboardShell>`, `<AxiBreadcrumb>`, `<AxiTabBar>`) in shell/header/tabbar; no `AxiMark` in header; no `(?:\.\.\/)+workbench/` cross-app import; no hand-drawn icons (`<svg>`, `<path>`, `<circle>`, `<rect>`) in MobileIcons/MobileHeader/MobileTabBar; no CSS pseudo-elements on the topbar plus (`.wb-mobile-topbar__plus::before`/`::after`); no `localStorage`/`sessionStorage`/`console.*` in scan/loginConfirm flows; no `com.axi.workbench.mobile` / `MainActivity` / `WebView` claim of ownership over the APK shell in JS.

**Kotlin shell**: `DeprecatedNativeManualLogin.kt` is `@Deprecated`; **only** `DeprecatedNativeManualLogin.kt` allowed in `ui/screens/manual/`; no active Kotlin file reintroduces `password`.

**API routing**: `mobileControl.ts` calls `resolveGatewayURL(\`/api/v1/mobile/...)`; uses Ed25519 with `record.privateKey.extractable` throwing if changed; calls `control-plane/mobile/pair-approval` with `ownerApprovalToken`; persists via `indexedDB`; forbids `localhost:8092` / `CONTROL_PLANE_URL` / `localStorage` / `sessionStorage`.

**Business pages (`Home` / `Projects` / `Workspace`)**: must use `useMobileWorkspaceQuery` + `MobileProjectionState`; Workspace must call `runMobileProjectAction`; forbids `setTasks` / `toggleTask` / `task.done` / `localStorage` / `sessionStorage` (no local-state task completion); forbids `DEMO_` / `mockProject|Task|Data` / `staticProjects`; Search must use `useMobileWorkspaceQuery` + `MobileProjectionState` (no static corpus, no `navigationReview` / `syncStatus`).

## Architecture Highlights

**The mobile distribution keeps three UIs, one product boundary.** The Mobile 三端职责矩阵 in `apps/workbench-mobile/README.md` is the source of truth for "who owns what":
- **mobile JS (Vite/React)** owns 4-tab information architecture (`home` / `projects` / `workspace` / `me`), email-code login, mobile pairing scan (`axi-mobile-pair-v1`), Web login confirmation (`axi-web-login-v1`), domain approval scan (`axi://approval`), Ed25519 device keys (IndexedDB, `extractable=false`), control-plane mobile routes (`/api/v1/mobile/*`), and TanStack-Query `useMobileWorkspaceQuery` + `MobileProjectionState`. The JS shell **does not** import `@axi/shell` / `AxiDashboardShell` / `AxiBreadcrumb` / `AxiTabBar`, **does not** import any code under `apps/workbench/src/pages/`, and **does not** maintain a hand-drawn icon set (only `AxiSvgIcon`).
- **mobile Kotlin (native shell)** owns the Activity startup choreography (`BrandLoadingView` first, `ComposeView` mounted underneath, splash exit animation removed on Android 12+), CameraX + ML Kit barcode scanning, Android Keystore device-key storage (per-device, non-extractable), the device-pairing QR scan, the Web login QR scan after pairing, system notifications/push, the WebView container slot (not yet wired), and the Hilt-managed `GatewayEndpointStore` + `ControlPlaneSessionStore`. The Kotlin shell **does not** write a second account login protocol; first-run is a device-pairing QR only. `DeprecatedNativeManualLogin.kt` is `@Deprecated` and intentionally not registered in `WorkBenchNavHost`; `verify-mobile-contracts.mjs` asserts that no second Kotlin login file exists.
- **Web admin (`apps/workworkbench`)** owns the OIDC login flow and the admin Chrome. Mobile JS does not silently redirect into OIDC (`forbidMatch(login, /beginLogin/)`); the email-code path is the JS entry.

**Mobile JS session bootstrap mirrors desktop.** `MobileDeviceSessionBootstrap` runs inside `BrowserRouter` for `/login/confirm-web` and the root `/`, hydrating the mobile device session before rendering pages that need pairing state. The login page uses `requestEmailCode` / `confirmEmailCode` against `resolveGatewayURL(\`/api/v1/mobile/...)` and surfaces `one-time-code` autofill for Android.

**Native Kotlin startup is a three-stage composition.** `MainActivity.onCreate()` calls `enableEdgeToEdge()` + `enforceOpaqueWindow()` (clears translucent status/nav flags, draws system bar backgrounds, opaque pixel format, contrast enforcement off, decor fits system windows off, light appearance on system bars), then `showNativeStartup()` adds `BrandLoadingView` (custom native View) on top of a `FrameLayout` with `R.color.wechat_chrome_bg`. After a single real paint (`startupRoot.postOnAnimation`), `mountComposeContent()` adds a `ComposeView` at index 0 (rendering below the brand View) and invokes `WorkBenchStartupGate(onStartup = gatewayEndpointStore::hydrate, onReady = ::dismissNativeStartup)`. `WorkBenchStartupGate` removes the brand View only after `WorkspaceViewModel.state.first { !Loading || snapshot != null }` to avoid exposing intermediate work as the canonical first frame. Android 12+ splash: `removePlatformSplashExitAnimation()` (the OS exit fade-out is suppressed to avoid double-Logo flicker).

**Gateway URL is normalized, control-plane-port-rejected.** `normalizeGatewayBaseUrl()` accepts only `http`/`https` schemes, no userinfo, no query, no fragment, rejects port `8092`, and rewrites path to `/api/v1/`. The Retrofit placeholder base URL is `http://axi.invalid/`; the `Interceptor` rewrites each request URL onto the cached endpoint via `rewriteGatewayRequestUrl(endpoint, placeholder)`. `requiresExplicitLanGateway()` checks `isLikelyAndroidEmulator()` (fingerprint/model/product heuristics) and the `BuildConfig.GATEWAY_BASE_URL` default; if the phone is real, has no stored endpoint, and the default is `10.0.2.2`, `requireConfiguredLanGateway()` throws `GatewayEndpointConfigurationRequiredException` — preventing a 15-second socket attempt against the emulator alias. The user is forced to enter a LAN gateway URL from "我的 → 设置 → 本机网关"; `save()` runs `normalizeGatewayBaseUrl()` again before persisting to DataStore.

**Native session storage uses DataStore Preferences and is split from auth.** `ControlPlaneSessionStore` (separate from `TokenStore`) holds `deviceId` + `pendingPairingId` + `pendingPairingCode` + `accessToken` + `accessTokenExpiresAt`; `legacyDeviceSecretKey` is removed on hydrate (HMAC secret was incompatible with the per-device Keystore contract). `ControlPlaneCrypto.deleteDeviceKey()` is invoked on `clear()`. The session is **not** reused with the account gateway JWT — it's a control-plane-specific device session.

**Cross-distribution parity.** The mobile distribution shares the same `@axi/workbench-foundation` and `@axi/workstation-contracts` identities as the Web and Desktop distributions, all rooted in `apps/workbench-shared/src/brand/favicon-geometry.json` (the single source of the dango-family invariants). `verify-mobile-contracts.mjs` byte-compares `apps/workbench-mobile/public/favicon.svg` to `apps/workbench/public/favicon.svg` to lock the brand across surfaces.

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| Initial Android Kotlin shell scaffold | Shipped | `apps/workbench-mobile/android/app/build.gradle.kts` (`namespace=com.workbench.mobile`); `MainActivity.kt` `@AndroidEntryPoint`; `WorkBenchApp.kt` `@HiltAndroidApp` |
| Vite/React mobile JS shell | Shipped | `apps/workbench-mobile/package.json` (`@axi/workbench-mobile` v1.0.0); `vite.config.ts` (`127.0.0.1:5174 host:true`); `MobileShell.tsx` WeChat-style |
| Mobile JS contract gate | Shipped | `638dea0 feat(workbench-mobile): vite config + governance submit-log ingest`; `apps/workbench-mobile/scripts/verify-mobile-contracts.mjs` 130+ lines blocks `@axi/shell`/`<AxiDashboardShell>`/`(??:.\\/)+workbench/`, enforces `MobileNavKey = 'home' \| 'projects' \| 'workspace' \| 'me'`, forbids second Kotlin login file beyond `DeprecatedNativeManualLogin.kt` |
| Device pairing (Ed25519 + IndexedDB) | Shipped | `mobileControl.ts` (extractable=false; throws if changed); `ControlPlaneSessionStore` over DataStore `control_plane_session`; `/scan/pair` parses `axi-mobile-pair-v1` payload (`webPairingId` + `scanToken`); polls `completeScannedMobilePairing` |
| Gateway URL normalisation | Shipped | `normalizeGatewayBaseUrl()` accepts http/https only, rejects port `8092`, rewrites path to `/api/v1/`; `GatewayEndpointConfigurationRequiredException` blocks 15-s hang on `10.0.2.2`; `BuildConfig.GATEWAY_BASE_URL` per buildType (Debug `http://10.0.2.2:8088/api/v1/`, Release `https://workbench.axiomaticworld.com/api/v1/`) |
| Android 12+ splash exit suppression | Shipped | `MainActivity.kt` `getSplashScreen().setOnExitAnimationListener { remove() }`; `enforceOpaqueWindow()` clears translucent flags |
| Build provenance snapshot | Shipped | `BUILD_INFO.json` (`kind=mobile-distribution`, `platforms=[android]`, `source.commit=cc83e5e01cf3110479ac7e96ca8aee7cacfe4113` on `dev`, `dist_commit=276a64599a680a00567c746796a25c1856aa513f` on `main`, `build_timestamp=2026-09-24T15:21:31Z`, `web=apps/workbench-mobile/dist/`, `android_release_apk_unsigned={path=apps/workbench-mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk, size_bytes=24903537, signed=false}`, `android_debug_apk={size_bytes=46693918}`, `ios=null`); `notes: "iOS build target not configured in this distribution. Release APK is unsigned and requires signing before store distribution."` |
| iOS target | Not started | `ios: null` in `BUILD_INFO.json`; not configured in this distribution |

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

- Sibling distribution: [`axi-workbench-web-dist`](/Volumes/code/workspace/distributions/axi-workbench-web) — Web admin SPA that the mobile surfaces authenticate against (Web OIDC for Web login)
- Sibling distribution: [`axi-workbench-desktop-dist`](/Volumes/code/workspace/distributions/axi-workbench-desktop) — Tauri macOS app that the mobile JS pairs with (Web/desktop QR for device pairing)
- Upstream monorepo: [`workbench/axi-workbench`](/Volumes/code/workspace/workbench/axi-workbench) — source of `apps/workbench-mobile`, `packages/*`, `foundation/axi-ui`
- Brand contract: `apps/workbench-shared/src/brand/favicon-geometry.json` (referenced by `verify-mobile-contracts.mjs`)
- Decision record: `apps/workbench-mobile/android/docs/decisions/0001-kotlin-manual-login.md` (Kotlin manual login deprecated)