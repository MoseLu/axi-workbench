# Axi Workbench 多端架构整理（2026-09-02）

> 状态：草稿 v0.1
> 配套：`docs/specs/2026-08-09-multi-surface-admin-positioning/`（PRD + CAPABILITY-INVENTORY）、`docs/architecture/source-catalog.md`（源码拓扑基线）
> 目的：把"Web / Mobile / Desktop 三端是什么、各端负责什么、共享什么、未来怎么演进"压在 **一张矩阵 + 一张决策树**里，让人 5 分钟内能定位。

---

## 1. 三端矩阵（速查）

| 维度 | Web (`apps/workbench`) | Mobile (`apps/workbench-mobile`) | Desktop (`apps/workbench-desktop`) |
| --- | --- | --- | --- |
| **形态** | Vite + React SPA，浏览器全屏 | Vite + React SPA，微信式移动壳；原生 Android 为 Kotlin + Jetpack Compose | Tauri 2 壳 + WKWebView，**复用 Web 端** |
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
它有**独立的 IA + 独立路由 + 独立 layout**；Web 移动端与原生 Android 各自实现 UI，仅复用产品契约、认证/API 边界和共享基础能力。

**判断标准**：
- 如果改动影响 Axi Dashboard Chrome / sidebar / tabs → **Web 端**
- 如果改动影响居中顶栏 / 四项底栏 / 扫码 → **Mobile 端（Web 或原生 Android）**

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
   │     ├─ 移动设备 → Mobile（Web 或原生 Android）
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
4. CI 验证：Web/Mobile 执行 `pnpm -r type-check && pnpm -r test`；Android 执行 `./gradlew test assembleDebug`

参考现有范例：`docs/specs/2026-08-09-multi-surface-admin-positioning/`。

---

## 7. 后续演进

1. **修 Desktop 在 main 上的入口文案**（README 第 17 行的端口 5173 → 5183）
2. **补充原生 Android 的 release 签名与发布流水线**（源码收敛已完成）
3. **Desktop 端 Apple Developer ID 接入**：CI secrets 配置 + 真签名 release
4. **继续扩展跨端共享契约**：Web/Mobile 使用 `apps/workbench-shared`，Android 通过明确的 API/schema 合同接入

### 本次收敛后状态

- ✅ 原生 Android 源码已迁移到 `apps/workbench-mobile/android`，并纳入 monorepo 版本控制
- ✅ Android Debug 构建、单元测试和真机安装启动已验证
- ✅ `apps/workbench-shared` 已纳入 monorepo，并保留 Web/Mobile/桌面共享工具边界
- ✅ 本 SPEC 与 `docs/architecture/source-catalog.md` 已同步新的 Android 归属

### 跨端相关事项

- ⚠️ `agent/workbench-desktop` 分支 README 的"5173"端口与 `vite.config.ts` 已修正的"5183"不一致——属于 desktop 分支工作，由 desktop 分支 owner 修。
- ⚠️ Android release 签名、Play 发布和 Apple notarization 仍未验证；它们不影响本地 Debug 构建与真机安装。

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

---

## 10. shared 包的"反模式"（什么不要放进来）

`apps/workbench-shared` 是跨端**纯函数 + 通用 hooks** 包。**容易越界**放错地方的内容：

### ❌ 不要放的：UI 组件
```ts
// ❌ 错：在 shared 里导出 <Button /> <Modal />
// 原因：组件依赖 antd / @axi/shell / @axi/widgets；shared 必须零 UI 依赖
```
**放哪**：`apps/workbench/src/components/` 或 `shared/axi-ui`（独立 UI 包）。

### ❌ 不要放的：平台 API 调用
```ts
// ❌ 错：直接 fetch / Tauri.invoke / WKWebView API
export async function fetchUser(id) { return fetch(`/api/users/${id}`); }
export function getTauriWindow() { return window.__TAURI_INTERNALS__; }
```
**放哪**：
- `fetch` 包装 → `apps/workbench/src/lib/api/`
- Tauri 通信 → `@axi/workbench-desktop`（已在 contracts 路径）
- 平台特性 → 各端包内

### ❌ 不要放的：路由 / 导航
```ts
// ❌ 错：useSearchParams / useNavigate
import { useSearchParams } from 'react-router-dom';
```
**原因**：mobile / desktop 套 web 走 React Router，但 native mobile 不一定用相同 router。

### ❌ 不要放的：业务 DTO
```ts
// ❌ 错：把 inbox 消息体放这里
export interface InboxMessage { id: string; subject: string; body: string; ... }
```
**原因**：inbox 是 web 业务领域，不是跨端通用。放 `@axi/workstation-contracts` 或 web 端自己。

### ❌ 不要放的：CSS / class 拼接
```ts
// ❌ 错：在 shared 用 tailwindcss / clsx / styled-components
import clsx from 'clsx';
```
**放哪**：web/mobile 各自组装。`cn()` 是唯一例外（零依赖纯函数）。

### ❌ 不要放的：localStorage 业务数据
```ts
// ❌ 错：把 "user inbox cache" 放 shared
export function saveInboxCache(id: string, data: unknown) { localStorage.setItem(...); }
```
**放哪**：`@axi/workstation-contracts`（schema）或各端 `lib/cache/`。

### ❌ 不要放的：Tauri IPC payload type
```ts
// ❌ 错：把 ShellUnread / ShellNotify 放 shared
export type ShellUnread = { count: number };
```
**放哪**：`@axi/workbench-desktop` 的 `contracts.ts`（端到端 contract，不跨端共享）。

### ❌ 不要放的：环境变量
```ts
// ❌ 错：读 process.env / import.meta.env
export const API_URL = process.env.API_URL;
```
**放哪**：`@axi/workstation-contracts` 的 `runtime.ts`，各端启动时注入。

---

## 11. 何时迁移到 shared 包

不是所有东西都该共享。判断标准：

### ✅ 适合共享的
- **纯函数**：无副作用、无外部依赖、输入 → 输出
- **通用 hooks**：跨 ≥2 个端都需要的 React hooks
- **基础类型**：Surface / NavBadge 这种**端无关**的领域类型
- **格式化工具**：Intl / 时间 / 字节 / class 拼接
- **校验工具**：email / url / uuid / phone 正则

### ❌ 不适合共享的
- 仅在**一个端**用 → 直接放那个端
- 依赖**框架**（antd、react-router、styled-components）→ 放各端自己
- 依赖**平台 API**（fetch、Tauri、WKWebView）→ 放各端自己
- **业务 DTO**（消息、订单、任务）→ 放 workstation-contracts

### 迁移流程

1. **发现重复**：在 web/mobile 看到同一函数实现 ≥2 次
2. **起 PR**：`docs/specs/.../<date>-shared-migration.md` 列函数签名 + 引用点
3. **抽到 shared**：在新分支 agent/workbench-multi-surface-architecture 实现 + 单测
4. **改端**：web owner 切到 `from '@axi/workbench-shared'`（或本地 re-export）；mobile 同
5. **删除重复**：端内 inline 实现删除
6. **CI 验证**：shared 测试 + 端测试都过

### 当前 shared 包对外 API（46 工具）

| 模块 | 数量 | 工具 |
| --- | --- | --- |
| `hooks/` | 17 | useDebouncedValue / useInterval / useThrottledValue / useLocalStorage / useToggle / useDisclosure / usePrevious / useEventListener / useClickOutside / useKeyPress / useDebouncedCallback / useThrottledCallback / useMediaQuery / useWindowSize / useBreakpoint / useAsyncFn / useAsync |
| `format/` | 24 | formatUnreadCount / formatTimestamp / formatBytes / formatDuration / formatRelativeTime / formatNumber / formatPercent / formatCurrency / formatCompact / truncate / slugify / camelCase / pascalCase / kebabCase / cn / parseQueryString / buildQueryString / buildUrl / validateEmail / validateUrl / validateUUID / validatePhone / validateLength / validateNonEmpty |
| `assert/` | 4 | assertNever / safeCall / tryOr / assertPresent |
| `types/` | 6 | NavBadge / NavBadgeDto / toNavBadge / Surface / NavBadgeKind / SafeResult |

---

## 12. 相关文档
- `docs/specs/2026-09-01-workbench-mac-packaging/` —— Desktop 端 PRD + DESIGN
- `docs/architecture/source-catalog.md` —— 源码拓扑基线
- `apps/workbench/README.md` —— Web 端入口
- `apps/workbench-mobile/README.md` —— Web 与原生 Android Mobile 端边界
- `apps/workbench-desktop/README.md` —— Desktop 端入口
---

## 12. 如何把 web 代码迁移到 shared 包

### 触发条件

发现 web / mobile 端有**重复实现 ≥ 2 次**的纯函数 / hook / 工具，**或**SPEC 流程中 §4 决策树判断该逻辑该进 shared。

### 6 步迁移流程

```
1. 识别重复   web/mobile owner 在 §3 看到 ≥2 个端同一函数
   ↓
2. 起 SPEC   docs/specs/<date>-shared-migration.md
   - 列出函数签名（输入 / 输出 / 副作用）
   - 列出 web / mobile 当前调用点（grep）
   - 列出边界条件 / 跨端差异
   ↓
3. 抽到 shared   PR 到 agent/workbench-multi-surface-architecture
   - 新增 src/<module>/<file>.ts
   - 在 src/<module>/index.ts re-export
   - 在 package.json exports 字段暴露（如果新模块）
   - 单测覆盖 ≥4 个边界（含 SSR-safe / 跨端差异）
   ↓
4. 各端 owner 切   import { fn } from '@axi/workbench-shared'
   ↓
5. 删重复实现   端内 inline 删；re-export 可选保留 1 个 release 周期
   ↓
6. CI 验证   shared 测试 + 端测试都过；type-check 都过
```

### 实战示例 1：把 web 端 `useIsMobile` 抽到 shared

**Step 1 识别重复**：
- `apps/workbench/src/hooks/useIsMobile.ts` (25 行)
- `apps/workbench-mobile/src/hooks/useIsMobile.ts` (28 行)
- 几乎相同，只差断点

**Step 2 SPEC**（`docs/specs/2026-09-15-shared-use-is-mobile.md`）：
```yaml
hook: useIsMobile(breakpoint: number = 768) → boolean
useMediaQuery wrapper
```

**Step 3 抽到 shared**（M30 已经做了类似的 `useMediaQuery` / `useBreakpoint`）：
- `apps/workbench-shared/src/hooks/index.ts` 已有 `useMediaQuery`
- 各端 owner 直接用 `useMediaQuery('(max-width: 768px)')` 不再需要 wrapper

**Step 4 切**：web/mobile owner 把 `useIsMobile` 删了，换 `useMediaQuery`

**Step 5 删重复**：本地 import 一并清理

**Step 6 验**：`pnpm --filter @axi/workbench test` + `pnpm --filter @axi/workbench-mobile test`

### 实战示例 2：把 web 端 `navBadges.ts` 的 `dtoToBadge` 抽到 shared

**Step 1 识别**：仅 web 端有，但 mobile / desktop IPC payload type 都基于这个 shape

**Step 2 SPEC**：
```yaml
function: toNavBadge(dto?: NavBadgeDto) → NavBadge
type: NavBadgeDto / NavBadge
```

**Step 3 抽到 shared**（已做， M21 `apps/workbench-shared/src/types/index.ts`）：
- `NavBadge` / `NavBadgeDto` / `toNavBadge`

**Step 4 切**：web 端 `navBadges.ts` 的本地 `dtoToBadge` 删，换 `import { toNavBadge } from '@axi/workbench-shared'`

**Step 5 删**：`apps/workbench/src/lib/navBadges.ts` 的本地 `dtoToBadge` 删除

**Step 6 验**：web 133 tests + shared 6 tests 都过

### 迁移 checklist（PR 模板）

```markdown
## Shared migration: <name>

### What
- 函数 / hook / type 签名：
- 是否纯函数：
- 是否依赖 React：
- 是否依赖 fetch / Tauri：

### Where used now
- apps/workbench/<...>
- apps/workbench-mobile/<...>
- apps/workbench-desktop/<...>

### Risks
- [ ] 端内调用方有特殊处理（error swallowing / 缓存 / 转换）？
- [ ] 跨端类型不严格一致？
- [ ] SSR / mobile / desktop 任何一端不能用？

### Plan
- [ ] shared package 加实现 + 单测
- [ ] web 切换 + 删本地实现
- [ ] mobile 切换 + 删本地实现
- [ ] desktop 切换（如需要）
- [ ] CI 三端 type-check + test 通过
```

### 什么时候不要迁移

- 仅**一端**用 + 未来不会跨端 → 直接放那端
- 依赖**框架**（antd / react-router）→ 放各端
- 依赖**平台 API**（fetch / Tauri / WKWebView）→ 放各端
- **业务 DTO**（inbox 消息、订单）→ 放 workstation-contracts

详细见 §10 / §11。

---

## 13. 相关文档

- `docs/specs/2026-08-09-multi-surface-admin-positioning/` —— 多端能力清单（PRD + INVENTORY + DESIGN）
- `docs/specs/2026-09-01-workbench-mac-packaging/` —— Desktop 端 PRD + DESIGN
- `docs/architecture/source-catalog.md` —— 源码拓扑基线
- `apps/workbench/README.md` —— Web 端入口
- `apps/workbench-mobile/README.md` —— Web 与原生 Android Mobile 端边界
- `apps/workbench-desktop/README.md` —— Desktop 端入口
- `apps/workbench-shared/README.md` —— Shared 包使用说明
- `docs/logs/submit/20260902-axi-shared-skeleton-verified.md` —— shared 包验证战报
