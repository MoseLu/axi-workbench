# PRD — Workbench Mac App 打包（2026-09-01）

> 状态：草稿 v0.1（执行中）
> 决策日期：2026-09-01
> 负责人：Workbench Web Team
> 关联：apps/workbench（MVP 架构 Web 端）、apps/workbench-mobile（移动端独立 IA）、`docs/specs/2026-08-09-multi-surface-admin-positioning/`（多端定位）

## 1. 背景

`apps/workbench` 当前是标准的 MVP（Model-View-Presenter）架构 Web 应用，跑在浏览器里；多端后台定位 spec（2026-08-09）已经在产品层面把工作台定位为"控制—执行—专业工具"的桌面级信息架构，但**目前没有任何原生壳**，Mac 用户只能用浏览器访问 http://127.0.0.1:5173。

后续要把 Workbench 打包成**应用级别**的 Mac 客户端，对标 Bilibili Mac 客户端的形态（独立 Dock 图标、原生菜单栏、托盘通知、全局快捷键、`.dmg` 安装、`~/Applications` 安装路径、Apple 公证）。

## 2. 目标

1. **G1 — 一键打包出 Mac App**：执行 `pnpm build:desktop` 在本机产出可双击运行的 `.app` 与可分发的 `.dmg`。
2. **G2 — 复用现有 MVP Web 端**：UI 1:1 复用 `apps/workbench`，不重写、不双维护；只在外层套一层 macOS 原生壳（菜单栏、托盘、命令面板快捷键）。
3. **G3 — 对标 Bilibili Mac 客户端形态**：
   - 独立 Dock 图标 + 窗口分组；
   - 原生 macOS 菜单栏（App > File > Edit > View > Window > Help）；
   - 全局快捷键 `⌘⇧W` 唤起主窗口；
   - 托盘图标 + 未读消息红点（先打桩，复用 Web 端的 inbox 未读计数）；
   - 单实例锁（再次启动聚焦已有窗口，不开第二个进程）；
   - Apple 公证通过，Gatekeeper 不拦截。
4. **G4 — 现状工程零回归**：现有 `pnpm dev / build / test / e2e` 全部不变；桌面壳只新增、不修改。

## 3. 非目标（明确不做什么）

- ❌ 不做 Windows / Linux 桌面壳（先把 Mac 跑通，预留扩展点）。
- ❌ 不重写 Web 端 UI（不在 shell 层强行改样式、布局、路由）。
- ❌ 不引入 Electron（已技术决策锁定 Tauri 2）。
- ❌ 不接入 App Store 分发（先做 `.dmg` 直传，App Store 后续单独立项）。
- ❌ 不做 iOS / iPadOS 端（走 `apps/workbench-mobile` 路线，Mac 端与移动端是两条独立产品线）。
- ❌ 不动 `apps/workbench-mobile` 的边界（移动端 README 第 29–31 行明确：当前是 Web/Vite 客户端，不是 WebView 宿主；Mac App 不复用此路径）。

## 4. 技术决策

| 项 | 选择 | 理由 |
| --- | --- | --- |
| 桌面壳框架 | **Tauri 2** | 产物 ~10MB、内存低、WKWebView 复用、与 Rust 后端零冲突（后续可加 Rust 命令面板）；Apple 公证链路成熟（`tauri-action`）。 |
| UI 来源 | **复用 `apps/workbench`** | Vite 构建产物直接被 Tauri 加载（`frontendDist`），0 UI 改动。 |
| 后端运行时 | **沿用现有后端服务**（NestJS/Express，不在桌面进程内嵌） | Mac App 是壳不是运行时；本地后端继续走 `pnpm dev:backend` 或已部署的远程服务。 |
| 安装包格式 | `.app` + `.dmg` | 对标 B 站客户端；`.dmg` 拖拽到 `~/Applications`。 |
| 公证 | `tauri-action` + Apple notarize | 与 Tauri 官方推荐一致。 |
| 数据存储 | **沿用 Web 端 localStorage / cookie** | WKWebView 与浏览器共享同一份持久化语义；不引入独立 SQLite。 |

## 5. 架构（高层）

```
┌────────────────────────────────────────────┐
│ Mac App（Tauri 2 shell, ~10MB）             │
│  ┌──────────────────────────────────────┐  │
│  │ macOS 原生层（Rust + Swift bridge）   │  │
│  │  - 菜单栏 / 全局快捷键 / 托盘 / Dock  │  │
│  │  - 单实例锁                           │  │
│  │  - 自动更新（tauri-plugin-updater）   │  │
│  │  - 系统通知（tauri-plugin-notification│  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ WKWebView 渲染层                      │  │
│  │  = apps/workbench 现有 SPA（1:1 复用） │  │
│  │  - React + Vite + MVP                 │  │
│  │  - 同源加载 file://...dist/index.html  │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
                ↕ HTTP（同机走 127.0.0.1:3000 或远程）
┌────────────────────────────────────────────┐
│ Workbench Backend（不变）                  │
└────────────────────────────────────────────┘
```

关键点：Mac App **不是** 自带后端 runtime 的"全栈客户端"，只是把现有 Web 端套一个原生壳。后端继续是独立服务（开发期 `pnpm dev:backend`，生产期走部署环境）。

## 6. 与 Bilibili Mac 客户端的对标清单

| Bilibili Mac 客户端能力 | 本次实现 | 备注 |
| --- | --- | --- |
| 独立 Dock 图标 + 主窗口 | ✅ Tauri 默认窗口 + 自定义图标 | 图标先用占位资源 |
| 原生 macOS 菜单栏 | ✅ Tauri 菜单 API（`Menu::new`） | App / File / Edit / View / Window / Help |
| 全局快捷键唤起 | ✅ `tauri-plugin-global-shortcut` | `⌘⇧W` 唤起主窗口 |
| 托盘图标 + 未读红点 | ✅ `tauri-plugin-tray-icon` + web 端 inbox API | 红点角标 = unread > 0 |
| 单实例锁 | ✅ `tauri-plugin-single-instance` | 第二次启动激活已有窗口 |
| 系统通知 | ✅ `tauri-plugin-notification` | inbox 新消息触发 |
| 自动更新 | ⏸️ 留接口，本期不接通 | `tauri-plugin-updater` 已安装，配置留位 |
| 深色模式跟随系统 | ✅ Web 端已支持 `prefers-color-scheme` | 壳层不重复实现 |
| Apple 公证 / Gatekeeper | ✅ `tauri-action` notarize | 需 Apple Developer ID |
| `.dmg` 安装 | ✅ `tauri build --bundles dmg` | 默认产物 |

## 7. 工程结构

新增（不修改任何现有目录）：

```
apps/
  workbench-desktop/                 # 新增
    package.json                     # 桌面壳元数据（pnpm 任务）
    src-tauri/
      Cargo.toml
      tauri.conf.json                # window/menu/bundle/security
      capabilities/default.json      # 权限声明
      icons/                         # 占位图标
      src/main.rs                    # Tauri 入口
      src/lib.rs                     # 菜单/单实例/托盘
    scripts/
      notarize.sh                    # Apple 公证脚本（开发期占位）
    README.md
turbo.json                           # + desktop:dev / desktop:build 任务
package.json                         # + dev:desktop / build:desktop 根脚本
docs/HANDOFF.md                      # 更新：新增 Mac App 启动段
```

## 8. 验收标准

- [ ] `pnpm dev:desktop` 在 macOS 本地启动 Tauri 窗口，窗口内可见与浏览器一致的 `apps/workbench` UI。
- [ ] `pnpm build:desktop` 产出 `apps/workbench-desktop/src-tauri/target/release/bundle/macos/Axi 工作台.app`，并在 macOS Dock/应用列表显示 `Axi 工作台`。
- [ ] `pnpm build:desktop -- --bundles dmg` 产出可分发的 `.dmg`。
- [ ] 二次启动应用，激活已有窗口（验证单实例锁）。
- [ ] `⌘⇧W` 在应用未聚焦时唤起主窗口。
- [ ] Dock 图标右键菜单可见（含"显示主窗口 / 退出"）。
- [ ] `apps/workbench` 现有 `type-check / test / build / e2e` 全部通过、零回归。
- [ ] `pnpm --filter @axi/workbench type-check` 仍绿。
- [ ] Apple 公证脚本可在配置完整 Apple ID 后直接跑通（占位实现先到位）。

## 9. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Tauri 2 与现有 pnpm/turbo 体系不熟 | 用 `@tauri-apps/cli` 二进制 + pnpm scripts 调用，**不** 替换构建系统 |
| Apple 公证需付费开发者账号 | 脚本留位 + 文档说明，本机无账号时 `.app` 可双击运行（仅 Gatekeeper 拦截） |
| 图标资源缺失 | 先用 Tauri 默认占位图标，后续由设计出图替换 |
| 单实例锁与 dev 模式冲突 | dev 模式下默认禁用 `single-instance` 插件，仅 build/release 启用 |
| Web 端假设浏览器 localStorage 在 macOS 沙盒内可用 | Tauri WKWebView 与浏览器同语义，已验证；如遇 ITP 问题再加白名单 |

## 10. 里程碑

1. **M1 — PRD + DESIGN** ✅ 2026-09-01
2. **M2 — 桌面壳骨架** ✅ 2026-09-01（`apps/workbench-desktop` 可 `pnpm dev` 起空壳）
3. **M3 — UI 复用** ✅ 2026-09-01（壳加载 `apps/workbench` 的 Vite 产物）
4. **M4 — B 站级能力** ✅ 2026-09-02（菜单栏 / 全局快捷键 / 托盘 / 单实例 / 通知 + web↔shell IPC）
5. **M5 — 打包与公证** ✅ 2026-09-02（`.app` + `.dmg` + GitHub Action 自动签名 + Apple notarize 脚本）
6. **M6 — 通知按 tag 合并 + 文档** ✅ 2026-09-02（Rust 端 1.5s 短时窗去重；DESIGN §11 checklist 全勾）
7. **M7 — 独立登录窗口**（2026-09-02 加入，B 站形态对齐）：login 窗独立居中、登录成功切 main 窗、登出回 login 窗；详见 DESIGN §13

---

**相关阅读**
- `docs/specs/2026-08-09-multi-surface-admin-positioning/PRD.md`（多端后台定位）
- `docs/specs/2026-08-09-multi-surface-admin-positioning/DESKTOP-WORKBENCH-RESEARCH.md`（桌面工作台公开形态）
- `apps/workbench/README.md`（Web 端入口）
- `apps/workbench-mobile/README.md`（移动端边界，明确不复用此路径）
