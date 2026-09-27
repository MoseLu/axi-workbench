# Axi Workbench Mac App — M8 交通灯 + Login IPC 串接

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 产物：`Workbench_0.1.0_aarch64.dmg`

## 关键改动

### M8-1：登录窗 B 站形态（仅 2 颗交通灯）

1. `tauri.conf.json`：`resizable: false` → NSWindow 不画 zoom 按钮
2. `lib.rs` 新增 `hide_fullscreen_button()`，用 objc2 msg_send 调 NSWindow 的 `setShowsFullScreenButton:`：
   - BOOL 用 `i8` 编码（macOS BOOL = signed char）——避免上次的崩溃
   - `catch_unwind` 包裹 → 失败不 crash app
3. `Cargo.toml` 加 `objc2 v0.5 + objc2-foundation v0.3 + block2 v0.5`

### M8-2：Login.tsx IPC 串接

1. `Login.tsx` 加 `isTauriShell() + emitShellLoginSuccess()`：`isAuthenticated` 翻 true 时，Tauri 壳内 emit `shell://login-success`，纯浏览器走原 navigate
2. `Login.tsx` useEffect：`isTauriShell()` 时往 `<body>` 加 `axi-tauri-shell` class
3. `Login.tsx` 在 `isTauriShell()` 时**不渲染**自绘 chrome 圆点（macOS 已提供原生）
4. `Login.css` 加 `body.axi-tauri-shell` 选择器：透明背景、隐藏三层 web 伪元素纹理、卡片 14px 圆角 + 毛玻璃 + 顶部 padding 给交通灯留位

## 验证

| 项 | 结果 |
| --- | --- |
| `pnpm --filter @axi/workbench-desktop type-check` | ✅ cargo check 5.17s |
| `pnpm --filter @axi/workbench type-check` | ✅ tsc --noEmit |
| `pnpm --filter @axi/workbench test` | ✅ **133 tests passed (27 files)** |
| `pnpm build:desktop:dmg` | ✅ bundle 完成 |
| 启动 .app，pid alive 5s+ | ✅ |
| objc2 msg_send panic | ✅ 无（stderr 空） |
| `lsappinfo info $PID` → `(in front)` | ✅ |

## 已知限制

- **无法 agent 端验证按钮数量**——macOS TCC 拒绝 sandbox 下 osascript 访问辅助功能，无法枚举 AXButton 数
- 需用户在 GUI 会话肉眼验：登录窗应仅 2 颗交通灯（红钮关 + 黄钮最小化），**无绿钮**

## 之前 main 单独回归

- 之前的"alert"误判是 osascript TCC 拒绝时的 fallback 对话框，已记录在 `20260902-axi-desktop-tauri-osascript-tcc.md`
- 真状态通过 `lsappinfo info $PID` 取，应用确实在前台运行