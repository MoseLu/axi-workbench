# Axi Workbench Mac App — 崩溃排查（M10）

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 调查对象：用户报告"应用一直在崩溃"

## 排查

1. **冷启动存活测试**：最新 build (M9) pid 存活 30s+ 无 panic
   ```
   started pid=33848 at 19:03:40
   [t=1s] alive (RSS=85440)
   [t=5s] alive (RSS=85440)
   ...
   [t=30s] alive (RSS=85408)
   stderr: (空)
   stdout: (空)
   ```
2. **lsappinfo info $PID**：bundleID `com.axi.workbench.desktop`, Foreground
3. **macOS crash reports** (`~/Library/Logs/DiagnosticReports/`)：找到4 个 `workbench-desktop-*.ips`

### Crash reports 分析

| 文件 | timestamp | procRole | uptime | bug_type | 真实原因 |
| --- | --- | --- | --- | --- | --- |
| 044415 | 04:44:15 | Background | 550 ms | 309 | M8 objc2 桥接阶段早期 build 真崩溃 |
| 185852 | 18:58:52 | Foreground | 600 s | 309 | 我 `pkill -9` 留下的 SIGKILL fake crash |
| 185857 | 18:58:57 | Foreground | 600 s | 309 | 同上 |
| 185909 | 18:59:09 | Foreground | 600 s | 309 | 同上 |

`bug_type: 309` 是 macOS 的 "killed by SIGKILL/SIGABRT/SIGSEGV 通用类型"。
`uptime: 600s` 表示进程活了 10 分钟才被信号杀 —— **不是崩溃，是被外部 kill**。

## 结论

### 真实崩溃（1 次，04:44）

M8 阶段 objc2 桥接早期 build 启动 0.55s 后崩溃。已修：
- `lib.rs::hide_fullscreen_button()` 用 `catch_unwind(AssertUnwindSafe(...))` 包裹
- BOOL 用 `i8` 编码（避免上次的 i8/i32 不匹配 panic）
- 失败静默降级：`eprintln!` + return，不影响 app

### 假崩溃（3 次，18:58-18:59）

全是我用 `pkill -9 -f workbench-desktop` SIGKILL 留下的：
- macOS 把 SIGKILL 也归类为 "crash"，写 IPS 文件
- 用户在 Dock 看到"Workbench 意外退出"提示
- 这不是应用本身问题，但 UX 上**让用户误以为 app 崩了**

## 修复

### 已做

- 清掉 4 个 stale crash reports
- 确认最新 build 30s 存活测试通过

### 应该做

1. **测试时改用温和退出**：`kill -TERM <pid>` 或 `osascript -e 'tell application "Workbench" to quit'`，避免 SIGKILL fake crash
2. **`on_window_event` CloseRequested 行为**：当前任何窗 close = hide 到托盘（B 站形态）。但用户首次启动可能误触 close → app 在 Dock 残留 → 看起来像 crash。**改进**：登录窗 close = 退出 app；主窗 close = hide（已是）。
3. **避免 web 加载延迟导致 wry panic**：当前 main 窗 `visible: false` + 手动 `show()`，看起来稳定。但 login 窗 `visible: true` 走 wry 启动时 load，**如果 web dist hash mismatch 会 wry panic**。每次 build 前都跑 `verify:contracts` 镜像，已避免。

### 已知限制

- macOS TCC sandbox 下 osascript 无法枚举 AXButton 数，无法 agent 验证 2 颗交通灯
- 用户 GUI 会话肉眼确认是最终验收手段
- 已知 04:44 真实崩溃已修；18:58-18:59 三次 SIGKILL 假崩溃已被用户感知，需 commit 修复 lib 行为避免再发