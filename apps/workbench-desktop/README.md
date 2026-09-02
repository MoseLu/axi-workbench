# `@axi/workbench-desktop` — Axi Workbench Mac App

Axi Workbench 的 **macOS 原生壳**，对标 Bilibili Mac 客户端形态。

> **核心原则**：UI 1:1 复用 `apps/workbench` 现有 Web 端，**不重写、不双维护**；本包只在外层套一层 macOS 原生壳（菜单栏 / 托盘 / 全局快捷键 / 单实例锁 / 系统通知 / Apple 公证打包）。

| 项 | 值 |
| --- | --- |
| 目录 | `apps/workbench-desktop` |
| 包名 | `@axi/workbench-desktop` |
| 桌面壳 | **Tauri 2**（Rust + WKWebView） |
| 复用 UI | `apps/workbench` 的 Vite 构建产物 |
| 启动开发 | `pnpm dev:desktop` |
| 打包 .app | `pnpm build:desktop` |
| 打包 .dmg + 公证 | `pnpm build:desktop:dmg` + `apps/workbench-desktop/scripts/notarize.sh` |
| 输出 | `apps/workbench-desktop/src-tauri/target/release/bundle/{macos,dmg}/` |

## 与其他端的关系

| 端 | 路径 | 形态 | 是否复用 |
| --- | --- | --- | --- |
| Web 工作台 | `apps/workbench` | Vite + React，浏览器 | **是** —— 1:1 套壳 |
| 移动端 | `apps/workbench-mobile` | Vite + React，独立 IA | **否** —— 见其 README 第 29–31 行 |
| Mac 桌面 | `apps/workbench-desktop`（本包） | Tauri 2 壳 + WKWebView | 是（套 web 端） |

## 开发前准备

1. **Rust 工具链**：`cargo` / `rustc` ≥ 1.77。已装。
3. **macOS 平台依赖**（仅 macOS）：`xcode-select --install` 安装 Xcode Command Line Tools。
4. **Node ≥ 18**、**pnpm ≥ 8**。已装。

## 本地开发

```bash
# 终端 A：先跑 web 端 dev server（Tauri 窗口的 web 内容源）
pnpm --filter @axi/workbench dev

# 终端 B：起 Tauri 窗口，指向终端 A 的 dev URL
pnpm dev:desktop
```

第一次 `pnpm dev:desktop` 会触发 `cargo` 拉依赖，需要几分钟。

## 打包 .app / .dmg

```bash
# 仅打包 .app（快速本地验证）
pnpm build:desktop

# 打包 .app + .dmg（分发用）
pnpm build:desktop:dmg
```

产物路径：

```
apps/workbench-desktop/src-tauri/target/release/bundle/macos/Workbench.app
apps/workbench-desktop/src-tauri/target/release/bundle/dmg/Workbench_0.1.0_<arch>.dmg
```

未经过 Apple 公证的 `.app` 双击会被 Gatekeeper 拦截（提示"无法打开，因为它来自身份不明的开发者"）。本地开发期可以：

```bash
xattr -dr com.apple.quarantine apps/workbench-desktop/src-tauri/target/release/bundle/macos/Workbench.app
```

## Apple 公证

```bash
APPLE_ID=you@example.com \
APPLE_TEAM_ID=ABCDE12345 \
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop \
./apps/workbench-desktop/scripts/notarize.sh \
  apps/workbench-desktop/src-tauri/target/release/bundle/macos/Workbench.app \
  apps/workbench-desktop/src-tauri/target/release/bundle/dmg/Workbench_0.1.0_<arch>.dmg
```

第一次使用前需在 Keychain 注册 `workbench-desktop-notary` profile：

```bash
xcrun notarytool store-credentials "workbench-desktop-notary" \
  --apple-id "$APPLE_ID" \
  --team-id  "$APPLE_TEAM_ID" \
  --password  "$APPLE_APP_SPECIFIC_PASSWORD"
```

## CI 自动签名（推荐）

`.github/workflows/axi-desktop-macos.yml` 在 `axi-workbench/v*` tag 推送时自动跑：

1. 装 Rust + Node + pnpm；
2. 跑 `pnpm --filter @axi/workbench build` 与 `verify:contracts`；
3. `pnpm --filter @axi/workbench-desktop build:dmg` 出 `.app` + `.dmg`；
4. 调 `notarize.sh` 公证 + staple；
5. 上传为 workflow artifact，并把 `.dmg` + 打包好的 `.app.zip` 附到对应 GitHub Release。

需在仓库 GitHub Secrets 配：

| Secret | 说明 |
| --- | --- |
| `APPLE_ID` | Apple Developer 邮箱 |
| `APPLE_TEAM_ID` | 10 位 Team ID（developer.apple.com → Membership） |
| `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → App-Specific Passwords 生成 |

未配 Secrets 时 workflow 仍会跑，但只产出未签名 `.dmg`，仅用于本地调试。

## 占位图标

当前 `src-tauri/icons/` 下为 1×1 透明 PNG + 最小 ICNS 占位（用于打通打包链路）。设计出图后替换：

```bash
# 把设计稿 icon.png（≥1024×1024 透明 PNG）放到 icons/ 目录
pnpm --filter @axi/workbench-desktop icon
```

## 校验脚本

```bash
pnpm --filter @axi/workbench-desktop verify:contracts
```

会检查：
- `apps/workbench/dist` 已存在并镜像到 `apps/workbench-desktop/workbench-dist/`；
- `apps/workbench-desktop/src-tauri/icons/icon.icns` 已就位。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| `cargo` 报错 `failed to fetch crate` | 确认 `~/.cargo/config.toml` 的源设置；国内环境考虑换镜像 |
| `tauri build` 报 icon 不合法 | 跑 `pnpm --filter @axi/workbench-desktop icon` 重新生成 |
| 窗口白屏 | 检查 `tauri.conf.json` 的 `devUrl` 是否能 `curl http://127.0.0.1:5173` 成功 |
| macOS Gatekeeper 拦截 | `xattr -dr com.apple.quarantine <path>`，或走完整公证流程 |
| 单实例锁与开发模式冲突 | 调试期可在 `tauri.conf.json` 关闭 `plugins.singleInstance.enabled` |

## 相关文档

- `docs/specs/2026-09-01-workbench-mac-packaging/PRD.md` —— 本次打包的产品/技术决策
- `apps/workbench/README.md` —— Web 端入口
- `apps/workbench-mobile/README.md` —— 移动端边界（明确不复用此路径）