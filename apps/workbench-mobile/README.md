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

移动端的浏览器标签图标、主屏图标、原生 Android 启动图标、系统 Splash 与登录页 Logo 使用与 Web 相同的六瓣十二色花型。`public/favicon.svg` 必须与 `apps/workbench/public/favicon.svg` 保持一致；Android launcher 使用居中安全边距派生版，Android 12+ 系统 Splash 直接显示额外安全区版本的六瓣花型，准备完成后首帧进入工作区，不再叠加第二个 Compose 品牌 Loading。移动端 UI 内的 Logo 继续通过 `@axi/core` 共享组件渲染。

## 真机 Android 工程

`apps/workbench-mobile/android` 是 WorkBench 原生 Android 客户端的唯一源码入口，与本目录的 Web/Vite 客户端同属一个移动端产品边界，但保持独立实现，不使用 WebView 伪装原生 App。它维护 Kotlin/Compose UI、CameraX/ML Kit 扫码、API Gateway 会话和真机运行时。

```bash
cd apps/workbench-mobile/android
./gradlew test
./gradlew assembleDebug
adb shell am start -n com.workbench.mobile.debug/com.workbench.mobile.MainActivity
```

Debug 构建的 applicationId 为 `com.workbench.mobile.debug`，版本由 `app/build.gradle.kts` 维护。不要在仓库外维护第二份 WorkBench Android 工程。
