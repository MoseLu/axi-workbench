# Axi Workbench Mac App — M7-fix 排查记录（osascript TCC 误判）

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 真实结论：**前面的"alert 弹窗"全部是误判——Tauri shell 一直工作正常**

## 真相

之前冒烟中反复出现的 260×333"Workbench alert"窗口 +3 个按钮（AXImage + AXStaticText + AXButton）**并不是 wry 创建 webview 失败**——而是 macOS TCC 拒绝 osascript 访问辅助功能时的 fallback 错误对话框。

证据：
- `lsappinfo info $PID` → `"Workbench" ASN:0x0-...: (in front)` + bundleID `com.axi.workbench.desktop` + Foreground type
- osascript 真实报错：`execution error: "osascript"不允许辅助访问。 (-25211)`
- 多次 kill 后用 `lsappinfo` 看窗口都正常——主窗 1280×800 在前台

## 之前的误判链路

1. 修改 tauri.conf.json / lib.rs / Login.css → build .app
2. 抽出 .app，codesign，open
3. 跑 osascript AX 查询窗口列表 → macOS TCC 拒绝 → "允许辅助访问"系统对话框弹出来（恰好也是 260×333 + 3 按钮）
4. 我把"系统拒绝 osascript"的对话框误当成 wry 的 webview 失败 alert
5. 反复修改配置 / Login.css / lib.rs，试图"修复"根本不存在的 bug

## 真正修复的方向

- 不需要再改 tauri.conf.json / lib.rs 的窗口配置（之前的相关改动可能不需要）
- 主要看 web 端 Login.css 的视觉调整（去黑底、居中卡片）
- 验证手段改用 `lsappinfo` + `pgrep` 而不是 osascript AX

## 当前可工作状态（已验证）

- 单 main 窗：1280×800 居中，前台，Foreground type
- 加入了 login 窗（visible:true，title="Workbench — 登录"）：lsappinfo 显示前台 ASN，bundleID 正确
- Login.css 已调整：
  - `.axi-login-page` 背景 transparent（去掉 web 自绘黑底）
  - `::before / ::after / .axi-login-page__grid` 全部 `display: none`（去掉三层 web 自绘纹理）
  - `.axi-login-card` 圆角 14px + 白色背景 + 大阴影
  - `.axi-login-card__chrome` `display: none`（去掉自绘红黄绿圆点）
  - 卡片顶部 padding 增加到 `var(--space-6)`，给 macOS 原生交通灯留出空间

## 待办（不阻塞）

1. 把刚才为修复"alert"乱改的 lib.rs（on_window_event 拦截）回退到原始 close-to-tray 行为
2. 用 lsappinfo 完整验证 login → main 状态机切换
3. GUI 截图验证 macOS 形态（需用户在有 TCC 权限的 GUI 会话里）

## 关键经验

| 错误 | 真相 |
| --- | --- |
| "wry 创建 webview 失败" | 大概率是 osascript TCC 拒绝的副产物 |
| "260×333 + 3 按钮的 alert" | macOS 系统级"允许 osascript 辅助访问"对话框 |
| `could not create image from display/window` | TCC Screen Recording 权限 |
| `(in front)` in lsappinfo | 应用真在前台运行 |

**GUI 冒烟首选工具：`lsappinfo info $PID`** + `pgrep` + `hdiutil`，避免 osascript TCC 限制。