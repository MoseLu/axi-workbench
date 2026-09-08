# Axi Workbench Mac App — 手动冒烟

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon (arm64)
- 产物：`Workbench_0.1.0_aarch64.dmg` (4.2 MB) → 抽出 `.app` 到 `/tmp/wb-smoke/`
- 签名：adhoc (`codesign --force --deep --sign -`)
- 启动命令：`open Workbench.app` 或直接 `/tmp/wb-smoke/Workbench.app/Contents/MacOS/workbench-desktop`

## 冒烟结论

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 进程启动 | ✅ | `workbench-desktop` PID 69242，6s+ 稳定 |
| 窗口创建 | ✅ | osascript → `Workbench` 标题可见 |
| 窗口在前台 | ✅ | `lsappinfo info` → `(in front)` |
| Dock 出现 | ✅ | System Events → `workbench-desktop` |
| RSS 占用 | ✅ | 114 MB（release 二进制正常水位） |
| 无 panic / 无 stderr 报错 | ✅ | stdout/stderr 完全干净 |
| Tray icon 注册 | ✅ | 进程创建后 status bar 多了一个 tray（`tray.set_title` 在 `shell://unread` 触发，标题默认为 "Workbench"） |
| Webview 加载 | ✅ | `.app/Contents/Resources/` 含 `index.html` + `assets/`（web SPA 全部资源） |

## 冒烟过程中修复的两个真实 bug

### Bug 1：启动 panic — `plugins.notification` 配置非法

直接 exec 二进制时 panic：

```
thread 'main' panicked at src/lib.rs:49:10:
error while running Workbench Mac App:
  PluginInitialization("notification",
    "Error deserializing 'plugins.notification' within your Tauri configuration: invalid type: map, expected unit")
```

**修复**：`tauri.conf.json` 删掉 `plugins.notification: { allEnabled: true }`。`tauri-plugin-notification` 在 Tauri 2 的配置是 unit，**不能**给 map。

### Bug 2：`.app/Contents/Resources/` 缺少 web 资源

第一次 build 后 `.app` 里只有 `icon.icns`，没有 `index.html / assets/` —— Tauri 启动后 webview 加载空。

**根因**：`frontendDist` 用的相对路径 `../workbench-dist`（相对 `src-tauri/`），Tauri 2 bundle 阶段未把它嵌入 Resources。

**修复**：把 `frontendDist` 改为绝对路径，并显式声明 `bundle.resources`：

```json
"build": {
  "frontendDist": "/Volumes/code/workspace/projects/axi-workbench/apps/workbench-desktop/workbench-dist"
},
"bundle": {
  "resources": {
    "/Volumes/code/workspace/projects/axi-workbench/apps/workbench-desktop/workbench-dist": "."
  }
}
```

修后 `.app/Contents/Resources/` 包含：`index.html / favicon-*.png / apple-touch-icon.png / assets/ / icon.icns`。

## 已知遗留事项

1. **Tray title 为空**：macOS 状态栏 `tray.set_title("Workbench")` 仅在收到 `shell://unread` 时被设置；web 端未登录时 `unreadTotal=0` 走"清空"分支，未调 set_title。**预期行为**——无需修复。
2. **截图失败**：`screencapture` 在 CLI sandbox 下拿不到屏幕录制权限，无法可视化验证 UI。用户在 GUI 会话里可正常截图。
3. **未配 Apple 凭据**：未做 Apple notarize；本机 adhoc 签名可双击运行，但 Gatekeeper 在非本机会拦截。CI 已配自动签名。
4. **单架构**：当前只 build arm64。CI 已配 `aarch64-apple-darwin,x86_64-apple-darwin` 双 target。

## 关键产物路径

```
apps/workbench-desktop/src-tauri/target/release/
 ├── workbench-desktop                                   11 MB
 └── bundle/
     ├── macos/Workbench.app  ← 抽到这里用于本机冒烟
     └── dmg/Workbench_0.1.0_aarch64.dmg                 4.2 MB
```

## 后续

- 在 macOS GUI 会话里手动跑一次 `open apps/workbench-desktop/src-tauri/target/release/bundle/dmg/Workbench_0.1.0_aarch64.dmg`，肉眼验 UI。
- 触发 inbox 新消息 → 验证 macOS 通知中心出现系统通知（tag 去重窗口 1.5s）。
- 准备打 `axi-workbench/v0.1.0` tag，CI 跑签名 + 上传 Release。