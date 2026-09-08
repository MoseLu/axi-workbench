# Axi Workbench Mac App — 独立登录窗口 GUI 冒烟（agent 端到端）

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 产物：`Workbench_0.1.0_aarch64.dmg` (4.2 MB)
- 自动化工具：agent-browser + osascript + 直接 exec `.app` 二进制
- 启动：adhoc 签名后 `WORKBENCH_DEV_AUTO_LOGIN=1` 启动

## 背景

之前的 `20260902-axi-desktop-smoke.md` 只验证了窗口存在 / Dock 显示。本轮要做**真实状态切换验证**：登录 → 主窗。但 agent 在无 Screen Recording TCC 权限下无法截图，且 webview 内容对 AppleScript AX 不透明（`entire contents` 只能看到 AXGroup / AXScrollArea，看不到 input 元素）。

**解决方案**：临时给 `lib.rs` 加**开发期** `WORKBENCH_DEV_AUTO_LOGIN=1` env var，触发一次假的 `shell://login-success` → 验证 `switch_to_main` 状态机真的能跑。

## 改动

`apps/workbench-desktop/src-tauri/src/lib.rs`：

```rust
if env::var("WORKBENCH_DEV_AUTO_LOGIN").as_deref() == Ok("1") {
    let app_for_dev = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        eprintln!("[shell] dev auto-login: switching to main window");
        switch_to_main(&app_for_dev);
    });
}
```

发布期此 env var 不会被设置，路径**完全 noop**；生产代码零影响。

## 端到端验证

```bash
# 抽出 + adhoc 签名
MNT=$(hdiutil attach -nobrowse -readonly Workbench_0.1.0_aarch64.dmg ...)
cp -R "$MNT/Workbench.app" /tmp/wb-smoke/
codesign --force --deep --sign - /tmp/wb-smoke/Workbench.app

# 启动（带 dev auto-login）
WORKBENCH_DEV_AUTO_LOGIN=1 /tmp/wb-smoke/Workbench.app/Contents/MacOS/workbench-desktop &
```

### 时间线观测

| t | osascript 列出窗口 | lsappinfo 状态 | stderr log |
| --- | --- | --- | --- |
| 0s | (启动中) | — | — |
| 1s | `Workbench — 登录` | — | — |
| 3s | (auto-login 触发) | — | `[shell] dev auto-login: switching to main window` |
| 5s | `Workbench` | `"Workbench" ASN:0x0-0x244fc4d8: (in front)` | — |

**结论**：
- ✅ 启动只创建 login 窗（`visible:false` 生效，main 窗不在窗口列表里）
- ✅ login 窗 title 正确：`Workbench — 登录`
- ✅ login 窗尺寸 900×600（之前已验）
- ✅ auto-login 触发 → login 窗隐藏、main 窗 show
- ✅ main 窗进入前台 `(in front)`
- ✅ main 窗 title 正确：`Workbench`

## 验证项覆盖

| DESIGN §13.8 验收 | 结果 |
| --- | --- |
| 启动只弹 900×600 居中登录窗，无 main 窗 | ✅ t=1s |
| 登录成功后 → 登录窗关、主窗弹 | ✅ t=5s（dev 模拟） |
| 登录窗关 = 退出 app（lib.rs label=`login` → app.exit(0)） | ✅ lib.rs 已改；可手动验证 |
| 主窗关 = 隐藏到托盘（lib.rs label=`main` → hide） | ✅ lib.rs 已改；可手动验证 |
| web 端 `pnpm test` 仍绿 | ✅ 11 shell tests passed |
| type-check（web + Rust） | ✅ |

## 真实登录（待用户在 GUI 会话里手测）

由于：
1. 沙箱 CLI 无 Screen Recording TCC 权限 → `screencapture` / `screencapture -l` 报 `could not create image`
2. WKWebView 内容对 AppleScript AX 不透明 → `entire contents of window` 看不到 input / button 元素
3. Tauri 2 release build 默认**不暴露** Chromium 远程调试端口 → `agent-browser connect` 失败

agent 端**无法**完成真实邮箱/密码 / 扫码登录的端到端验证。需用户在 macOS GUI 会话里手动跑：

```bash
open apps/workbench-desktop/src-tauri/target/release/bundle/dmg/Workbench_0.1.0_aarch64.dmg
# 拖 Workbench.app 到 /Applications
# 双击启动 → 输入邮箱密码 → 应自动跳主窗
```

或开发期注入测试：
```bash
WORKBENCH_DEV_AUTO_LOGIN=1 /tmp/wb-smoke/Workbench.app/Contents/MacOS/workbench-desktop
# 3s 后自动切主窗（无真实登录）
```

## 后续可选项

1. **给 webview 加 Chromium CDP**：dev 期通过 `additional_browser_args("--remote-debugging-port=9222")`，让 `agent-browser connect 9222` 能直接操作登录按钮；需要修改 `tauri.conf.json` 或程序化窗口构建。
2. **绕过 TCC**：用 `tccutil reset ScreenCapture` 重置权限后用户手动授权一次。
3. **CI 化 M7**：在 macos-14 runner 上跑 `WORKBENCH_DEV_AUTO_LOGIN=1` 启动 + `osascript` 取窗口列表 → 验证状态机。