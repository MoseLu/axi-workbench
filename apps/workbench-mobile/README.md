# Axi 移动工作台（`@axi/workbench-mobile`）

独立的微信式移动端应用，不是 `apps/workbench` 在窄屏下的一套 CSS 分支；Web 的 Axi Dashboard Chrome、标签栏与面包屑不属于这里。

| 项 | 值 |
| --- | --- |
| 目录 | `apps/workbench-mobile` |
| 包名 | `@axi/workbench-mobile` |
| 启动 | 仓库根：`pnpm dev:mobile` |
| 本地 URL | http://127.0.0.1:5174 |
| Android 包名 | `com.axi.workbench.mobile` |
| 路由 | `/home`、`/projects`、`/workspace`、`/scan`、`/me`、`/inbox`、`/search`、`/login` |

## 边界

- 拥有微信式移动路由、绝对居中顶栏、搜索/加号菜单、五项绿色底栏、红点角标、扫一扫与移动页面组合。
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

## Android 模拟器

移动端包含一个独立的 Android WebView 宿主。它负责应用包、生命周期和系统栏，页面路由仍由本目录的移动端实现负责；模拟器验收时不会打开 Chrome。

```bash
# 先启动移动端 Vite 服务，再构建并安装 APK
pnpm --dir apps/workbench-mobile dev -- --host 0.0.0.0 --port 5174
pnpm --filter @axi/workbench-mobile android:install

# Android 模拟器通过 10.0.2.2 访问宿主机
adb shell am start -n com.axi.workbench.mobile/.MainActivity \
  --es serverUrl http://10.0.2.2:5174 \
  --es startPath /me
```

安装脚本会优先选择 `emulator-*` 设备，不会误把 APK 安装到同时连接的真机；也可以用 `ANDROID_SERIAL` 指定目标。

`serverUrl` 和 `startPath` 是受控开发参数；发布包应指向实际移动端网关入口，默认路径是 `/home`。默认开发地址是 `http://10.0.2.2:5174`。
