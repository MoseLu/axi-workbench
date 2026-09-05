# Axi 移动工作台（`@axi/workbench-mobile`）

独立的微信式移动端应用，不是 `apps/workbench` 在窄屏下的一套 CSS 分支；Web 的 Axi Dashboard Chrome、标签栏与面包屑不属于这里。

| 项 | 值 |
| --- | --- |
| 目录 | `apps/workbench-mobile` |
| 包名 | `@axi/workbench-mobile` |
| 启动 | 仓库根：`pnpm dev:mobile` |
| 本地 URL | http://127.0.0.1:5174 |
| 路由 | `/home`、`/projects`、`/workspace`、`/scan`、`/scan/pair`、`/me`、`/inbox`、`/search`、`/login` |
| 原生 Android | `apps/workbench-mobile/android`；`./gradlew :app:installDebug` |

## 边界

- 拥有微信式移动路由、绝对居中顶栏、搜索/加号菜单、四项底栏、红点角标、扫码配对与移动页面组合。
- 不导入 `apps/workbench` 的页面、`MainLayout`、面包屑或标签栏。
- 仅共享 `@axi/workbench-foundation`（认证会话和语言偏好）、`@epap/api-client` 认证合同、`@axi/workstation-contracts`、`@axi/tokens` 与 `@axi/core`。
- 认证在不同 origin 下仍由后端 SSO / cookie / token 合同负责；前端不会跨 origin 读取另一个应用的 localStorage。

## 验证

```bash
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile test
pnpm --filter @axi/workbench-mobile build
pnpm --filter @axi/workbench-mobile verify:contracts
```

### 品牌图标

移动端的浏览器标签图标、主屏图标、原生 Android 启动图标、系统 Splash、单一品牌 Loading 与登录页 Logo 使用与 Web 相同的六瓣十二色花型。`public/favicon.svg` 必须与 `apps/workbench/public/favicon.svg` 保持一致；Android launcher 使用居中安全边距派生版，Android 12+ 系统 Splash 作为首帧预览并与原生 `BrandLoadingView` 无缝衔接，单 Activity 只显示一次 Logo、提示文案和 loading 动画，Compose 工作区在其下方准备完成后直接接管。移动端 UI 内的 Logo 继续通过 `@axi/core` 共享组件渲染。

## 真机 Android 工程

`apps/workbench-mobile/android` 是 WorkBench 原生 Android 客户端的唯一源码入口，与本目录的 Web/Vite 客户端同属一个移动端产品边界，但保持独立实现，不使用 WebView 伪装原生 App。它维护 Kotlin/Compose UI、CameraX/ML Kit 扫码、API Gateway 会话和真机运行时。

```bash
cd apps/workbench-mobile/android
./gradlew test
./gradlew assembleDebug
adb shell am start -n com.workbench.mobile.debug/com.workbench.mobile.MainActivity
```

Debug 构建的 applicationId 为 `com.workbench.mobile.debug`，版本由 `app/build.gradle.kts` 维护。不要在仓库外维护第二份 WorkBench Android 工程。

## 三端职责矩阵

本节是 mobile 端唯一的"谁是事实拥有者"参考表。Monorepo 中 Axi Workbench 移动边界目前共存 **三套 UI**，后续维护者必须先看这张表再决定改动落在哪里。

> 图例：✅ 拥有 / ⚠️ 部分拥有 / ❌ 不拥有 / 🔵 转给其他端

| 能力 | mobile JS（Vite） | mobile Kotlin（native shell） | 未来 Web mobile 适配 |
| --- | --- | --- | --- |
| 用户登录入口 — OIDC | ❌（`verify-mobile-contracts.mjs` 显式禁止 `beginLogin`） | ❌（走 `AuthApi.login`） | ✅（Web `apps/workbench/src/pages/Login.tsx` 已拥有） |
| 用户登录入口 — 邮箱验证码 | ✅（`LoginPage.tsx`：`requestEmailCode` + `confirmEmailCode` + `challengeId` + `one-time-code` 自动填充） | ❌（无验证码 UI） | 🔵（留给 Web 桌面） |
| 用户登录入口 — 邮箱密码 | ❌（`verify-mobile-contracts.mjs` 显式 `forbidMatch password`） | ✅（`ManualLoginScreen.kt`：邮箱 + 密码 → 拿 token） | 🔵（留给 Web 桌面） |
| 用户登录入口 — Web 扫码授权（电脑端 QR） | ✅（`WebLoginConfirmPage.tsx` + `webLoginQr.ts`：`axi-web-login-v1`） | ✅（`ManualLoginScreen` 注释：`/auth/qrcode/confirm` 把 Web QR 授权给自己） | 🔵（由 mobile 端反向授权） |
| 用户登录入口 — 域审批 / domain approval | ✅（顶级 `/scan` 路由 + `parseApprovalScanPayload`，`axi://approval` 不带业务字段） | ❌（无 Compose 域审批 UI） | 🔵（Web 桌面发起） |
| 设备会话 — Ed25519 设备密钥 | ✅（`mobileControl.ts`：`Ed25519`、`extractable` 抛错 → 私钥不可导出） | ❌（Kotlin 侧 `TokenStore` 存 token，未涉及 Ed25519） | 🔵 |
| 设备会话 — IndexedDB 持久化 | ✅（`mobileControl.ts`：`indexedDB`，禁止 `localStorage` / `sessionStorage`） | ❌（Kotlin 用原生 `TokenStore`，非 Web） | 🔵 |
| 扫码能力 — domain approval QR | ✅（`/scan` 全屏子路由，`parseApprovalScanPayload`） | ❌（无扫码 UI） | 🔵 |
| 扫码能力 — pairing QR | ✅（`/scan/pair` + `parseMobilePairingQrPayload` + `axi-mobile-pair-v1`） | ❌（Kotlin 端无 QR 解析） | 🔵 |
| 扫码能力 — web login QR | ✅（`WebLoginConfirmPage` + `approveMobileWebLoginQr`） | ✅（扫码后调 `/auth/qrcode/confirm`，见 `ManualLoginScreen` 注释） | 🔵 |
| 信息架构 — 4 tab + scan 全屏子路由 | ✅（`navigation.ts`：`'home' \| 'projects' \| 'workspace' \| 'me'`；`scan` 不占底栏，顶栏加号菜单进入） | ❌（无 tab 架构，只有 Login / Startup） | ⚠️（Web 桌面后台壳不是微信式架构，适配需重做） |
| 信息架构 — 复用 Web `apps/workbench/src/pages/` | ❌（`verify-mobile-contracts.mjs` 显式 `forbidMatch ...workbench/` 路径导入） | ❌（Kotlin 不引用 React 页面） | ✅（Web 本身就是它） |
| i18n / locale | ✅（`src/i18n.ts`：`zh-CN` / `en-US`，`app.name` 双语；`verify-mobile-contracts.mjs` 强制） | ⚠️（只硬编码中文文案 + `R.string.app_name` / `startup_preparing_workspace` 资源化） | ✅（`apps/workbench/src/i18n/`） |
| 主题 — light / dark / black-gold | ✅（`@axi/tokens` + mobile CSS） | ⚠️（`MaterialTheme.colorScheme` + `BrandLoadingView`，黑金色未单独定义） | ✅（`@axi/tokens` + antd ConfigProvider） |
| WebView 容器 / 系统 WebView 桥接 | ❌（`verify-mobile-contracts.mjs` 显式 `forbidMatch WebView` 在 JS 端） | ✅（Kotlin 是 native shell，可承载 `WebView` / CameraX / ML Kit） | 🔵 |
| 推送通道 / 系统通知 | ❌（无 FCM / 本地通知） | ✅（Android 通知通道由 native shell 提供） | 🔵 |
| 后端 API 边界 — `resolveGatewayURL(/api/v1/mobile/...)` | ✅（`mobileControl.ts`：`resolveGatewayURL(\`/api/v1/mobile\`)`） | ✅（Retrofit `AuthApi.login` 等接口走同一网关） | ✅（Web 经 API Gateway） |
| 状态管理 — tanstack-query | ✅（`useMobileWorkspaceQuery` + `MobileProjectionState`，契约强制 5 个页面） | ❌（Kotlin 用 `StateFlow` / ViewModel） | ✅（Web 桌面用） |
| 控制平面 — `control-plane/mobile/pair-approval` | ✅（`mobileControl.ts`：`ownerApprovalToken`） | ❌（Kotlin 不直接走 control-plane） | ✅（Web 桌面拥有） |
| 启动 Loading / 品牌一致性 | ✅（浏览器 tab 图标 + `AxiLogoMark` + `<title>Axi 工作台</title>`） | ✅（`BrandLoadingView.kt` + Android 12+ Splash + `R.string.app_name`） | ✅（Web 桌面有 antd 品牌壳） |

## 当前登录入口决策（Decision Record）

### 事实

- **Web 桌面**：`apps/workbench/src/pages/Login.tsx`，OIDC 流。
- **Mobile JS**：`apps/workbench-mobile/src/pages/LoginPage.tsx`，邮箱验证码流。
  - `verify-mobile-contracts.mjs` 强制：
    - `requireMatch(login, /requestEmailCode/)` / `/confirmEmailCode/` / `/challengeId/` / `/one-time-code/`
    - `forbidMatch(login, /beginLogin/)` → 不允许悄悄跳 OIDC
    - `forbidMatch(login, /password/i)` → 不允许重新引入密码流
- **Mobile Kotlin**：`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/ui/screens/manual/ManualLoginScreen.kt`，邮箱密码流。
  - 文件头注释明确写出三步流程：① 邮箱密码登录 → 拿 token；② App 调 `/auth/qrcode/confirm` 把 Web 端的 QR 会话授权给自己；③ Web 端轮询拿到 tokens → 自动登录。

### 不一致点

`verify-mobile-contracts.mjs` 对 mobile JS 的登录入口约束得非常死，但 **不约束 Kotlin 侧**。当前 Kotlin 侧使用邮箱密码是历史选择（扫码前的 fallback 入口），没有合约级保护。

### 现在可以怎么改（默认建议）

1. **短期**：不动 Kotlin 的密码入口，继续保留它作为 Android 用户在没有 Web QR 时的兜底登录路径。
2. **中期**：把"邮箱密码登录入口"也写进 `verify-mobile-contracts.mjs` 的事实段（而非禁止段），作为已知的、合法的 Kotlin 入口登记。
3. **长期方向（可选）**：如果团队决定统一登录体验，优先做"mobile Kotlin 也走邮箱验证码"（复用 `requestEmailCode` 同样的 gateway 端点），然后再从 Kotlin 移除密码 UI。这是一次较大的产品决策，需要单独 RFC，**不在本 README 范围内决定**。

## 信息架构决策

### 为什么 mobile JS 选 4 tab + scan 全屏子路由

- `apps/workbench-mobile/src/lib/navigation.ts` 中 `MobileNavKey` 严格定义为 `'home' | 'projects' | 'workspace' | 'me'` 四个，`verify-mobile-contracts.mjs` 用 `forbidMatch(navigation, /\{\s*key:\s*'scan'/, ...)` 显式禁止 `scan` 占用底栏 tab。
- 扫码作为"临时任务"而非"目的地"，必须是全屏 modal 子路由，而不是常驻 tab。`MobileShell.tsx` 通过 `isScanRoute` + `axi-mobile-app--scanner` 切换布局，顶栏加号菜单 `navigate('/scan')` 是唯一入口。
- 四 tab 对应微信式产品的核心场景：首页 / 项目 / 工作台 / 我。`scan` 不参与这四元结构，避免"为了找到一个扫码按钮要在底栏挤一个位"的反模式。

### 为什么 mobile JS 不复用 Web `apps/workbench/src/pages/` 的 React 页面

- Web 桌面后台壳是 Ant Design + `AxiDashboardShell` + `AxiBreadcrumb` + `AxiTabBar` 的宽屏布局，与移动端的微信式信息架构不重合。
- `verify-mobile-contracts.mjs` 显式禁止：
  - `forbidMatch(app, /from ['"]@axi\/shell['"]|<AxiDashboardShell/, ...)`
  - `forbidMatch(shell, /<AxiDashboardShell|<AxiBreadcrumb|<AxiTabBar/, ...)`
  - `forbidMatch(... /(?:\.\.\/)+workbench\//, ...)` → 禁止跨应用导入实现代码
- 共享仅限：`@axi/workbench-foundation`（认证会话 + 语言偏好）、`@epap/api-client` 认证合同、`@axi/workstation-contracts`、`@axi/tokens`、`@axi/core`（品牌图标）。

### mobile Kotlin 当前扩展边界

- 当前实际 Compose 屏幕只有两个：`BrandLoadingView`（启动） + `ManualLoginScreen`（登录）。
- Kotlin 的职责定位是 **native shell**，即承担 mobile JS 做不到或不该做的能力：
  - 扫码权限桥接（CameraX / ML Kit）
  - 系统通知与推送通道
  - WebView 容器（若未来需要）
  - 设备级安全存储（Android Keystore）
- **不要在 Kotlin 侧写新的业务 UI**（如：首页、项目、工作台、我）。业务 UI 走 mobile JS 或将来 Web 适配。

## 后续维护 SOP

- **改 Web 时**：不要期望 mobile 自动跟上。mobile JS 是独立信息架构，Web 的 antd 壳不是它的窄屏分支。
- **改 mobile JS 时**：不要碰 Web 的 antd 壳；登录路径只动 `LoginPage.tsx`；遵守 `verify-mobile-contracts.mjs` 的所有 `requireMatch` / `forbidMatch`。
- **改 mobile Kotlin 时**：只改 native shell 范围（扫码权限桥接 / 推送 / WebView 容器 / 设备密钥存储）；不要自己写新业务 UI；任何登录入口变更必须先在 `verify-mobile-contracts.mjs` 同步登记。
- **任何"加新能力"的提案**：先填这份矩阵的空白单元格，再开 PR。提案里必须写出：这个能力归哪一端、它与现有行的边界如何、是否会触碰 `verify-mobile-contracts.mjs` 的禁止规则。
- **跨端一致性**：mobile JS 与 Kotlin 都通过 `resolveGatewayURL(/api/v1/mobile/...)` 走 API Gateway，不要在 client 侧另起 endpoint。

### 公网 Gateway

移动端部署在 Workbench 项目入口时使用 `https://workbench.axiomaticworld.com`。
Vite 移动端跟随当前站点的同源 `/api`；原生 Android 的 Release 构建默认使用
`https://workbench.axiomaticworld.com/api/v1/`，Debug 构建仍可通过
`api.base.url`（`local.properties` 或 `-Papi.base.url=...`）覆盖为模拟器或局域网
Gateway。Release 覆盖值使用 `-Papi.release.base.url=...`，不要把控制面端口直接写入
客户端配置。

## 相关链接

- `apps/workbench-mobile/scripts/verify-mobile-contracts.mjs` — mobile JS 侧契约强制器
- `apps/workbench-mobile/src/lib/mobileControl.ts` — Ed25519 设备密钥 + IndexedDB + 控制平面调用
- `apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/ui/screens/manual/ManualLoginScreen.kt` — Kotlin 侧邮箱密码登录入口
- `apps/workbench-mobile/src/pages/LoginPage.tsx` — mobile JS 侧邮箱验证码登录入口
- `apps/AGENTS.md` — monorepo 根 mobile 段（跨端契约说明）
