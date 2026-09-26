# Axi Workbench Mac App — 独立登录窗口冒烟（M7）

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 产物：`Workbench_0.1.0_aarch64.dmg` (4.2 MB)
- 启动：adhoc 签名后 `/tmp/wb-smoke/Workbench.app/Contents/MacOS/workbench-desktop`

## 行为对照（B 站形态对齐）

| 行为 | B 站 Mac客户端 | 当前实现 | 证据 |
| --- | --- | --- | --- |
| 启动 → 独立登录窗 | ✅ | ✅ | osascript → 仅1 窗口 title=`Workbench — 登录` |
| 登录窗尺寸 | 中等 | ✅ 900×600 | `size=900,600` |
| 登录窗居中 | ✅ | ✅ | `pos=830,382`（屏幕约 1920×1080，居中） |
| 登录窗不可最大化 | ✅ | ✅（`maximizable:false`） | config 生效 |
| 主窗启动隐藏 | ✅ | ✅（`visible:false`） | osascript 只列1 个窗口 |
| 登录成功 → 切主窗 | ✅ | 待手动测（需要真实登录凭据） | IPC 路径已通（cargo check + vitest） |
| 关闭登录窗 → 退出 app | ✅ | ✅ | lib.rs `WindowEvent::CloseRequested` label=`login` → `app.exit(0)` |
| 关闭主窗 → 隐藏到托盘 | ✅ | ✅ | lib.rs label=`main` → `window.hide()`（已有） |

## 改动清单

| 文件 | 改动 |
| --- | --- |
| `apps/workbench-desktop/src-tauri/tauri.conf.json` | 新增 `login` 窗口（900×600、`maximizable:false`、`visible:true`、`url:/login`）；原 `main` 改为 `visible:false`、`url:/admin/dashboard` |
| `apps/workbench-desktop/src-tauri/src/lib.rs` | `on_window_event` 按 label 分支：`login` 关 = `app.exit(0)`；`main` 关 = hide 到托盘；新增 `switch_to_main / switch_to_login` 辅助函数；register_ipc_listeners 加 `shell://login-success / login-failed / logout` 监听 |
| `apps/workbench-desktop/src/contracts.ts` | SHELL_EVENTS + 3 个 payload type：`LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT` |
| `apps/workbench/src/lib/shell.ts` | + `emitShellLoginSuccess / emitShellLoginFailed / emitShellLogout` |
| `apps/workbench/src/pages/Login.tsx` | `isAuthenticated` 翻 true 时：Tauri 壳内 emit `shell://login-success`；浏览器下保持路由 navigate |

## 验证

- `pnpm --filter @axi/workbench-desktop type-check` → exit 0
- `pnpm --filter @axi/workbench type-check` → exit 0
- `pnpm --filter @axi/workbench test -- --run shell` → 11 passed
- `pnpm build:dmg` → 成功
- 启动 `.app` → 仅 1 个登录窗，900×600，居中；main 窗未出现

## 已知遗留（需用户在 GUI 会话里手测）

1. **真实登录后切主窗**：邮箱/密码或扫码登录成功后 → 是否真触发 `shell://login-success` → shell 是否关 login、开 main。
2. **主窗登出回 login**：在 main 窗登出后 → 是否 emit `shell://logout` → shell 是否回 login。
3. **登录窗关 = 退出 app**：红钮点关 → 进程是否完全退出，无残留。
4. **最大化按钮**：登录窗不应有 macOS 绿色最大化按钮（`maximizable:false`）。

## 产物

```
apps/workbench-desktop/src-tauri/target/release/
 ├── workbench-desktop                                   11 MB
 └── bundle/
     ├── macos/Workbench.app
     └── dmg/Workbench_0.1.0_aarch64.dmg                 4.2 MB
```