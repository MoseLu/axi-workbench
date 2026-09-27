# Axi Workbench Mac App — 初始构建产物

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 命令：`pnpm build:desktop:dmg`
- Rust release 编译时间：43.27s（增量，复用首次编译缓存）
- 工作目录：`apps/workbench-desktop`

## 产物

| 路径 | 大小 | 说明 |
| --- | --- | --- |
| `apps/workbench-desktop/src-tauri/target/release/workbench-desktop` | 11 MB | release 二进制（arm64，非 fat） |
| `apps/workbench-desktop/src-tauri/target/release/bundle/macos/Workbench.app` | 11 MB | `.app` bundle（macOS 10.15+） |
| `apps/workbench-desktop/src-tauri/target/release/bundle/dmg/Workbench_0.1.0_aarch64.dmg` | 4.2 MB | `.dmg` 安装镜像（拖拽到 Applications） |

## Bundle 信息

```
CFBundleIdentifier        = com.axi.workbench.desktop
CFBundleName              = Workbench
CFBundleDisplayName       = Workbench
CFBundleShortVersionString= 0.1.0
CFBundleVersion           = 0.1.0
CFBundleExecutable        = workbench-desktop
CFBundleIconFile          = icon.icns
LSMinimumSystemVersion    = 10.15
LSApplicationCategoryType = public.app-category.developer-tools
NSHighResolutionCapable   = true
```

## 校验

- `.dmg` SHA-256：`2dcf04ca7e79a3d2b95b4fc0e35149e79cc3fb82d286f08ff58131f3284fdfca`
- 二进制架构：`arm64`（非 fat；当前 macOS 14+ Apple Silicon 默认）
- `.app` 内含 `Contents/MacOS/workbench-desktop` 11.5MB + `Contents/Resources/icon.icns` 96566B
- `.dmg` 挂载验证：含 `Workbench.app` + `Applications -> /Applications` 软链

## 公证状态

- 未提供 Apple 凭据，`scripts/notarize.sh` 进入 DRY-RUN；
- `.app` 已能从 `.dmg` 抽出（脚本自动从 dmg mount → cp -R → detach），可重复公证；
- 真公证需在 GitHub Secrets 配 `APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD`，或本机执行：
  ```bash
  APPLE_ID=... APPLE_TEAM_ID=... APPLE_APP_SPECIFIC_PASSWORD=... \
    apps/workbench-desktop/scripts/notarize.sh
  ```

## 已知约束

- 单架构（arm64）；Intel 机器需加 `x86_64-apple-darwin` target 重 build（CI 已配双架构 build）。
- 未走 Apple 公证 → 本机双击 `.app` 会被 Gatekeeper 拦截，临时绕过：`xattr -dr com.apple.quarantine Workbench.app`。
- `.dmg` 4.2MB 较小，是因为 `.app` 内未嵌入 web dist 资源压缩副本——`apps/workbench-desktop/workbench-dist/` 是软链/拷贝，实际 SPA 资源在 `apps/workbench/dist/`，Tauri 2 在 build 时已把它们嵌入 `.app` Resources 中。

## 后续

- 真实出签名版：打 `axi-workbench/v0.1.0` tag，CI 自动跑 `axi-desktop-macos.yml`，上传到 GitHub Release。
- 用户本机手动验：在 macOS 上挂载 `.dmg` → 拖 Workbench.app 到 `/Applications` → 双击启动 → 进消息 tab 看 Dock 红点同步。