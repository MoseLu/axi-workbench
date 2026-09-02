# Axi Workbench 多端架构整理（2026-09-02）

> 状态：草稿 v0.1
> 配套：`docs/specs/2026-08-09-multi-surface-admin-positioning/`（PRD + CAPABILITY-INVENTORY）、`docs/architecture/source-catalog.md`（源码拓扑基线）
> 目的：把"Web / Mobile / Desktop 三端是什么、各端负责什么、共享什么、未来怎么演进"压在 **一张矩阵 + 一张决策树**里，让人 5 分钟内能定位。

---

## 1. 三端矩阵（速查）

| 维度 | Web (`apps/workbench`) | Mobile (`apps/workbench-mobile`) | Desktop (`apps/workbench-desktop`) |
| --- | --- | --- | --- |
| **形态** | Vite + React SPA，浏览器全屏 | Vite + React SPA，微信式移动壳 | Tauri 2 壳 + WKWebView，**复用 Web 端** |
| **入口** | `pnpm dev:workbench` / `pnpm dev:web` | `pnpm dev:mobile` | `pnpm dev:desktop` |
| **默认端口** | 5173 | 5174 | n/a（用 vite dev server 的 5183） |
| **路由体系** | React Router（Axi Dashboard Chrome + sidebar + tabs） | React Router（居中顶栏 + 四项底栏 + 红点） | 同 Web，但 webview 嵌在 macOS NSWindow 里 |
| **登录形态** | `/login` 路由（双栏 + 扫码 + 邮箱/密码） | `/login` 路由（独立 IA） | **独立 macOS 登录窗**（900×600 / B 站形态） |
| **主窗** | `MainLayout`（无限宽度，sidebar + tabs） | 自定义 `Layout`（顶栏 + 底栏） | 同 `MainLayout` |
| **是否复用 web SPA** | — | ❌（独立 IA） | ✅ **1:1 套壳** |
| **壳渲染框架** | @axi/shell + @axi/widgets + @axi/crud | 自定义（移动专用组件） | **macOS NSWindow**（wkwebview 嵌入） |
| **状态** | ✅ 主端 | ✅ 主端 | ⚠️ MVP（依赖 Apple Developer ID） |
| **路线** | 持续演进 | 持续演进 | 等 cert 接入后真 release |

---

## 2. 共享契约（不变的部分）

| 契约 | 出处 | 谁用 |
| --- | --- | --- |
| **API 合同** | `@epap/api-client` + `@axi/workstation-contracts` | Web / Mobile / Desktop（Desktop 套壳 → 走 web） |
| **认证 & 语言** | `@axi/workbench-foundation` | Web / Mobile（Desktop 透传 web session） |
| **设计令牌** | `@axi/tokens` + `@axi/core` | Web / Mobile（Desktop 套壳 → 走 web） |
| **六层控制面规则** | `services/control-plane` + 控制面 client | Web 主 / Mobile 只读 / Desktop 套壳 |
| **后端入口** | `services/api-gateway`（Go API） | 全部端唯一入口 |

> 核心原则：**任何端都通过 `@epap/api-client` 调业务 API，不直连后端模块**。

---

## 3. 三端的差异（容易踩的坑）

### 3.1 Web 端 ≠ Mobile 端的 CSS 分支

`apps/workbench-mobile` 不是 `apps/workbench` 在窄屏下的一套 CSS 分支（见 `apps/workbench-mobile/README.md` 第 29–31 行）。  
它有**独立的 IA + 独立路由 + 独立 layout**，仅复用 `workbench-foundation` 共享层。

**判断标准**：  
- 如果改动影响 Axi Dashboard Chrome / sidebar / tabs → **Web 端**  
- 如果改动影响居中顶栏 / 四项底栏 / 扫码 → **Mobile 端**

### 3.2 Desktop 端 ≠ Web 端的 CSS 分支

`apps/workbench-desktop` 是 **Tauri 2 壳 + WKWebView**，**1:1 套 web 端 UI**（Mac App 形态对齐 B 站）。

UI 改动 → **Web 端**；macOS 壳行为（菜单栏 / 托盘 / 单实例 / 通知 / 全局快捷键） → **Desktop 端**。

**Desktop 端不做的事**：  
- ❌ 不重写 Login.tsx 视觉（保持现有双栏 + 扫码 + 邮箱/密码）  
- ❌ 不在登录窗加业务导航 / 标签栏  
- ❌ 不做登录窗嵌主窗的"嵌套模式" —— 独立窗口是产品决策  
- ❌ 不改 AuthContext / session API

### 3.3 不归类的端

| 路径 | 角色 | 说明 |
| --- | --- | --- |
| `apps/devsvc-dashboard` | Host / 运维壳 | 不是第三个用户门户，负责本地服务和可挂载应用的状态 |
| `apps/axi-coder` | Hosted 编码工具 | devsvc-dashboard 内打开，不是独立用户端 |
| `apps/verification-inbox` | Hosted OTP 工具 | 同上 |
| `apps/app-search-system` | 嵌入式独立运行时 | React + Electron + Python，与 workbench 无关 |
| `apps/ollama-menu-assistant` | 嵌入式独立运行时 | Swift Package |
| `infra/fleet-console/dashboard` | 独立 dashboard | 物理服务清单 |

详见 `docs/architecture/source-catalog.md`。

---

## 4. 决策树：某个需求应该在哪端做？

```
新需求来了
   │
   ├─ Q1: 用户在哪种设备上用？
   │     │
   │     ├─ PC 浏览器 → Web
   │     ├─ 移动设备 → Mobile
   │     └─ macOS 桌面 → Desktop（套 web）
   │
   ├─ Q2: 改动是 UI 还是壳行为？
   │     │
   │     ├─ UI → Web 端（Desktop 自动跟随）
   │     └─ 壳行为（菜单栏/托盘/通知/快捷键）→ Desktop
   │
   └─ Q3: 是否需要新增共享契约？
         │
         ├─ 否 → 直接在对应端实现
         └─ 是 → 先在 packages/* 加 API / schema，
                 三端共用 → 不重复实现
```

**决策示例**：

| 场景 | 决策 |
| --- | --- |
| 新增"项目管理"二级页 | Web（路由 `/admin/project/:id`） |
| 新增 Dock 红点逻辑 | Desktop IPC + Web `lib/shell.ts` emit |
| 新增消息 tab 红点 | Web `MainLayout.tsx` + Desktop `lib.rs::apply_unread` |
| 新增扫码登录页 | Web `Login.tsx` + Desktop 独立登录窗形态 |
| 改六层控制面 | 服务端 + `@axi/workstation-contracts`，三端共用 |
| macOS 全屏按钮收口 | Desktop `tauri.conf.json` + NSWindowToolbar（M7 后续） |

---

## 5. 演进时间线（已做 / 在做 / 计划）

| 阶段 | 状态 | 端 |
| --- | --- | --- |
| MVP 形态（B 站 Mac 客户端） | ✅ `agent/workbench-desktop` 分支 | Desktop |
| 独立登录窗 + 状态切换 | ✅ 已 commit | Desktop |
| 6 个 `shell://` IPC 协议 + 11 单测 | ✅ 已 commit | Desktop + Web |
| Web ↔ Shell 通知按 tag 合并 | ✅ Rust 1.5s 短时窗 | Desktop |
| CI 自动签名 `.dmg` (`.github/workflows/axi-desktop-macos.yml`) | ✅ workflow 落地 | Desktop |
| **Apple Developer ID 接入** | ⏸️ 阻塞 release 真签名 | Desktop |
| macOS 13+ 全屏按钮收口 | ⏸️ 需 `NSWindowToolbar` API | Desktop |
| Windows / Linux 跨平台 | ⏸️ `bundle.targets` 加 `nsis`/`deb`/`appimage` | Desktop |
| 自动更新 (`tauri-plugin-updater`) | ⏸️ | Desktop |

---

## 6. 跨端共享变更协议

任何**同时影响 ≥2 个端**的改动必须：

1. 在 `docs/specs/<date>-<topic>/` 起一个 SPEC
2. SPEC 包含 **CAPABILITY-INVENTORY**（哪个端受影响、影响什么 action、谁负责）
3. PR 标题用 `<type>(<scope>): <summary>` 格式（项目惯例）
4. CI 验证：`pnpm -r type-check && pnpm -r test` 三端都过

参考现有范例：`docs/specs/2026-08-09-multi-surface-admin-positioning/`。

---

## 7. 接下来要做什么（你定）

1. **修 Desktop 在 main 上的入口文案**（README 第 17 行的端口 5173 → 5183）
2. **把 Mobile 端 `apps/workbench-mobile/android/` 改成 gitignore**（当前 untracked）
3. **Desktop 端 Apple Developer ID 接入**：CI secrets 配置 + 真签名 release
4. **新建 `apps/workbench-shared/` 包**：把三端共用的 hook / util 集中

—— 任意一个你点头，我就在这个分支内做。

### 当前已在 `agent/workbench-multi-surface-architecture` 完成

- ✅ §8.1 把 `apps/workbench-mobile/{android,ios,dist}/` 加入 `.gitignore`（原生工程不应混入 SPA 仓库）
- 同步在本 SPEC 中维护三端矩阵，避免各端 README 各自漂移

### 跨端相关事项（提醒，不在本分支处理）

- ⚠️ `agent/workbench-desktop` 分支 README 的"5173"端口与 `vite.config.ts` 已修正的"5183"不一致——属于 desktop 分支工作，由 desktop 分支 owner 修。
- ⚠️ `apps/workbench-mobile/android/` 当前 untracked + 已 gitignore，后续 mobile 团队若要做原生工程应走独立仓库。

---

## 9. 决策树实战案例

### 案例 A：未读消息徽章（已实现）

**需求**：消息 tab 显示未读数；Mac App Dock 显示未读红点。

**走决策树**：
1. 用户在浏览器、Mac App 上用 → **Web + Desktop**
2. UI 显示在 tab bar / Dock 上 → UI 改 Web + 壳行为改 Desktop
3. 共享数据流（unread 总数）→ 三端都需要吗？**目前只需要 web + desktop**（mobile 走自己的 IA）

**实际落地**：
- Web `MainLayout.tsx` 拉 `/api/v1/notifications/nav-badges` → `unreadTotal`
- Web `MainLayout.tsx` 用 `useEffect` emit `shell://unread { count }` → `@axi/workbench-desktop` contracts
- Desktop `lib.rs` 监听 `shell://unread` → `apply_unread()` 调 `window.set_badge_label` + `tray.set_title`
- IPC payload type：`ShellUnread = { count: number }`（@axi/workbench-shared/types 候选放处）

**教训**：
- 数据源在 Web 端（单一来源）；Desktop 是**镜像**，不主动拉
- `lib.rs` 改 count 时 Rust 端**不调任何 API**，纯转发 web 状态

### 案例 B：扫码登录（已实现）

**需求**：手机扫桌面端登录窗的二维码确认登录。

**走决策树**：
1. Web / Mac App / Mobile 都涉及
2. UI 在 Mac App 登录窗 → UI 走 Desktop（独立窗）+ Web 内容来源
3. 跨端协议：Desktop 登录窗显示二维码（web 渲染）→ Mobile 扫码 → 后端回调 → Desktop 收到登录成功

**实际落地**：
- Desktop `tauri.conf.json` 新增 `label: "login"` 窗（900×600 / B 站形态）
- Web `Login.tsx` 调用 `createWebDeviceLoginQr()` 拉二维码 URL
- Web `Login.tsx` 轮询 `getWebDeviceLoginQrStatus()` 等待扫描
- Web `Login.tsx` 检测到 `approved` → 调 `consumeWebDeviceLoginQr()` + `refreshSession()`
- Web 检测到 `isAuthenticated === true` → emit `shell://login-success`
- Desktop `lib.rs` 监听 → `switch_to_main()` 关 login 窗、开 main 窗
- Mobile 走自己的扫描逻辑（不在本多端架构讨论内）

**教训**：
- Desktop 不重写扫码 UI，直接 1:1 套 web Login.tsx 视觉
- 协议端点定义在 `@axi/workbench-desktop/contracts`（端到端），不放 `@axi/workbench-shared`（端间共享）

### 案例 C：消息通知（已实现）

**需求**：消息推送；macOS 通知中心弹系统通知；同 tag 1.5s 内合并。

**走决策树**：
1. Web / Mac App 都要
2. UI = 系统通知（macOS Notification Center） → 壳行为 = Desktop
3. 数据 = 消息内容（任何端都可能 push） → 三端共享 protocol，**但只有 Desktop 消费系统通知**

**实际落地**：
- Web 端在 SSE / WebSocket 收到新消息 → emit `shell://notify { title, body, url?, tag? }`
- Desktop `lib.rs` 监听 → `deliver_notification()` 调 `tauri-plugin-notification`
- 同 tag 1.5s 短时窗去重（`NOTIFY_DEDUPE` 静态 `HashMap`）→ 后续推送被吞
- Mobile 不参与（mobile 走自己的推送通道）

**教训**：
- 通知协议是**单向**（web → shell），不要反向设计
- dedupe 在 shell 端做（web 端 debounce 200ms 即可，shell 1.5s 兜底）

### 决策树使用记录

| 案例 | 路径 | 结论 |
| --- | --- | --- |
| 未读徽章 | Q1=web+desktop, Q2=UI + 壳, Q3=否 | Web + Desktop 各自负责 |
| 扫码登录 | Q1=三端, Q2=壳（独立窗）, Q3=是 → contracts | Desktop 主导 + web 套壳 |
| 系统通知 | Q1=web+desktop, Q2=壳, Q3=是 → contracts | Web push → Desktop consume |

- `docs/specs/2026-08-09-multi-surface-admin-positioning/` —— 多端能力清单（PRD + INVENTORY + DESIGN）
- `docs/specs/2026-09-01-workbench-mac-packaging/` —— Desktop 端 PRD + DESIGN
- `docs/architecture/source-catalog.md` —— 源码拓扑基线
- `apps/workbench/README.md` —— Web 端入口
- `apps/workbench-mobile/README.md` —— Mobile 端边界
- `apps/workbench-desktop/README.md` —— Desktop 端入口