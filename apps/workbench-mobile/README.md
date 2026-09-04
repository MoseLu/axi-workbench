# Axi 移动工作台（`@axi/workbench-mobile`）

独立的微信式移动端应用，不是 `apps/workbench` 在窄屏下的一套 CSS 分支；Web 的 Axi Dashboard Chrome、标签栏与面包屑不属于这里。

| 项 | 值 |
| --- | --- |
| 目录 | `apps/workbench-mobile` |
| 包名 | `@axi/workbench-mobile` |
| 启动 | 仓库根：`pnpm dev:mobile` |
| 本地 URL | http://127.0.0.1:5174 |
| 路由 | `/home`、`/projects`、`/workspace`、`/scan`、`/scan/pair`、`/me`、`/inbox`、`/search`、`/login` |

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

移动端的浏览器标签图标、主屏图标与登录页 Logo 使用与 Web 相同的六瓣十二色花型；`public/favicon.svg` 必须与 `apps/workbench/public/favicon.svg` 保持一致，PNG 资源由该 SVG 生成。移动端 UI 内的 Logo 继续通过 `@axi/core` 共享组件渲染。

## 真机 App 边界

本目录是 Web/Vite 移动端客户端，不是假装成真机原生 App 的 WebView 宿主。当前已安装在真机上的 `com.workbench.mobile.debug` APK 的原生源码不属于本仓库，因此不在这里生成、替换或宣称可以重建该 APK；真机 UI 以设备截图为验收基线，网页移动端只维护同一信息架构与交互契约。
