# DESIGN — Workbench Mac App（2026-09-01）

> 状态：草稿 v0.1
> 配套：`PRD.md`（决策/目标/不做什么）、`apps/workbench-desktop/`（Tauri 壳工程）
> 范围：**web ↔ shell IPC 协议 + 托盘未读红点数据流 + 通知送达 + 错误处理**

## 1. 设计原则

1. **Web 为源、Shell 为面**：未读数、消息状态由 web 端业务逻辑说了算；Tauri 壳只**镜像**到 Dock / 托盘 / 通知中心，不持有业务状态。
2. **单向事件流**：web → shell 通过 Tauri `emit`；shell → web 通过 `eval` 或 `emit`。禁止 shell 直接调用 web 业务函数（保持 SPA 完整可独立运行）。
3. **降级即默认**：壳层所有"增强能力"必须可降级——若 IPC 失败，shell 退化为"无红点、无通知"，web 端体验不破。
4. **窄 IPC 协议**：只用 6 个事件，覆盖托盘红点、通知送达、菜单项透传、就绪握手、心跳、健康检查。

## 2. 现有 web 端契约（已确认）

| 项 | 路径 | 备注 |
| --- | --- | --- |
| 未读总数 | `GET /api/v1/notifications/nav-badges` | 返回 `{ home, projects, workspace, me, unreadTotal }` |
| 业务数据源 | `apps/workbench/src/lib/navBadges.ts` `fetchNavBadges()` | 已封装 |
| 业务消费点 | `apps/workbench/src/layouts/MainLayout.tsx:103` `unreadCount = tabBadges.unreadTotal` | 已挂在"消息"Tab 红点 |

> 不动现有 API、不动 web 业务。**只增加一个 web → shell 的 emit 通道**。

## 3. Web ↔ Shell IPC 协议

### 3.1 通道清单

| 事件名 | 方向 | payload | 说明 |
| --- | --- | --- | --- |
| `shell://ready` | shell → web | `{ version: string }` | Tauri 入口初始化完成，web 可发起 IPC |
| `shell://unread` | web → shell | `{ count: number }` | 推未读总数；count=0 清空红点 |
| `shell://notify` | web → shell | `{ title, body, url?, tag? }` | 推系统通知；url 点击时跳路由 |
| `shell://menu` | shell → web | `{ id: string }` | 用户点了 web 关心的菜单项（如 `file_new`） |
| `shell://show-main` | shell → web | `{}` | 收到全局快捷键 / 托盘单击 / Dock 点击，告知 web"主窗口已可见" |
| `shell://ping` | 双向 | `{ ts: number }` | 健康检查（每秒一次，仅调试） |

> **命名空间约定**：`shell://` 前缀的事件名走 Tauri `emit/listen`；web 端用 `@tauri-apps/api/event::listen('shell://xxx', cb)` 订阅，shell 端 `app.emit("shell://xxx", payload)`。
> **类型共享**：`apps/workbench-desktop/src/contracts.ts` 提供 TS 类型，web 端可选 import（不强制；保持壳可独立 build）。

### 3.2 事件 payload 严格定义

```ts
// apps/workbench-desktop/src/contracts.ts
export type ShellUnread = { count: number }            // 0..n，整数
export type ShellNotify = {
  title: string                                       // 必填，≤ 64 字符
  body: string                                        // 可空字符串
  url?: string                                        // 相对路径（'/inbox/123'），点击通知时打开
  tag?: string                                        // 同 tag 通知合并；缺省不合并
}
export type ShellMenuEvent = { id: string }            // 见 §4 菜单项 id 映射表
export type ShellReady = { version: string }           // Tauri 版本（如 '2.11.5'）
export type ShellShowMain = Record<string, never>      // 纯信号，无 payload
```

### 3.3 错误模型

| 错误 | 处理 |
| --- | --- |
| web 端 `emit('shell://unread', { count: -1 })` | shell 忽略 + 记录 `tracing::warn!` |
| shell 在 web 还未 ready 时收到 `shell://unread` | shell 缓存到 `Mutex<Option<ShellUnread>>`，等 `shell://ready` 到达后 flush |
| IPC 通道未注册（开发期 web 跑在纯浏览器） | web 端 try/catch + `console.debug`，**永不抛错** |
| 通知权限未授予（macOS 通知中心偏好） | shell 调用 `tauri-plugin-notification` 失败时静默降级，不弹错误 UI |

## 4. 菜单项 id 映射

壳层菜单（`lib.rs::build_app_menu`）触发后，**业务类菜单**透传给 web，**壳行为类菜单**就地处理。

| id | 类型 | 处理 |
| --- | --- | --- |
| `app_about` | 壳 | 弹 Tauri 默认 about 对话框（或 web 自定义） |
| `app_hide` | 壳 | `window.hide()` |
| `app_quit` | 壳 | `app.exit(0)` |
| `file_new` | **业务** | emit `shell://menu` → web 处理（新标签 / 新窗口） |
| `file_close` | 壳 | `window.close()` → 触发隐藏到托盘 |
| `edit_undo/redo/cut/copy/paste/select_all` | 壳 | 直接走 `window.eval('document.execCommand(...)')`（macOS 标准做法） |
| `view_reload` | 壳 | `window.location.reload()` |
| `view_toggle_devtools` | 壳 | `window.open/close_devtools()`（仅 debug_assertions） |
| `window_minimize/zoom` | 壳 | `window.minimize()/maximize()` |
| `tray_show/hide/quit` | 壳 | 同菜单 |

## 5. 未读红点数据流

```
┌──────────────────────────────────────┐
│ Backend API                          │
│ GET /api/v1/notifications/nav-badges │
└───────────────┬──────────────────────┘
                │ HTTP /api/...
                ▼
┌──────────────────────────────────────┐
│ Web SPA (apps/workbench)            │
│                                      │
│ 1. fetchNavBadges() 拉一次（启动）    │
│ 2. Web 自身轮询 / SSE / WebSocket    │
│    （与现有 web 浏览器形态一致）      │
│ 3. 拿到新 unreadTotal 时：            │
│    const { count } = data.unreadTotal│
│    if (window.__TAURI__)            │
│      emit('shell://unread',{count})  │
│                                      │
│ 4. 用户点击消息 tab 清空未读时：       │
│    emit('shell://unread',{count:0})  │
└───────────────┬──────────────────────┘
                │ Tauri event
                ▼
┌──────────────────────────────────────┐
│ Tauri shell (apps/workbench-desktop) │
│                                      │
│ 1. on 'shell://unread' →             │
│    app.tray.set_title(count == 0     │
│      ? '' : String(count))           │
│    app.set_badge_count(count)  // Dock
│                                      │
│ 2. 缓存 pending_unread，web 未 ready │
│    时先入队，ready 后 flush。          │
└──────────────────────────────────────┘
```

**关键约束**：
- **shell 不发起 HTTP 请求** —— 不绕过 web 业务去拉 `/api/v1/notifications/nav-badges`。理由：保持会话/cookie/SSO 一致性、避免双倍网络流量、避免双套鉴权。
- **shell 不持有 polling 状态** —— web 决定轮询频率。
- **Dock 红点**走 macOS 原生 `setBadgeLabel`（Tauri 2 已暴露）；**托盘红点**走 `tray.set_title(...)`。

## 6. 通知送达流

```
Web 收到 inbox 新消息（SSE / WebSocket / 轮询）
    │
    ▼
Web 调用 emit('shell://notify', {
  title: '新消息',
  body:  msg.preview,
  url:   `/inbox/${msg.id}`,
  tag:   `inbox-${msg.id}`,   // 同 tag 替换不堆叠
})
    │
    ▼
Tauri shell 调用 tauri-plugin-notification
    │
    ▼
macOS Notification Center
    │
用户点击通知
    │
    ▼
shell on notification click → app.show + focus main
    │
    ▼
emit('shell://show-main', {}) + window.eval(`location.href='${url}'`)
```

## 7. 全局快捷键流

```
用户在任意应用按 ⌘⇧W
    │
    ▼
tauri-plugin-global-shortcut 触发回调
    │
    ▼
shell：window.show() + unminimize() + set_focus()
    │
    ▼
emit('shell://show-main', {})  ← web 知道"自己刚刚被唤起"
    │
    ▼
web 收到事件 → 如果在登录页 / 锁屏，恢复会话
```

## 8. 单实例锁流

```
用户第二次启动 Workbench.app
    │
    ▼
tauri-plugin-single-instance 拦截
    │
    ▼
回调里：app.get_webview_window("main").show() + unminimize() + set_focus()
    │
    ▼
第二次进程立即退出，无窗口创建
```

## 9. 开发期 vs 发布期差异

| 能力 | 开发期 (`pnpm dev:desktop`) | 发布期 (`pnpm build:desktop`) |
| --- | --- | --- |
| `frontendDist` | `devUrl: http://127.0.0.1:5173` | `workbench-dist/`（web 端构建产物） |
| DevTools | 可用（`view_toggle_devtools` 菜单生效） | 编译期移除 |
| 单实例锁 | 关（避免 dev server 调试冲突） | 开 |
| 全局快捷键 | 注册（dev 阶段也方便测） | 注册 |
| CSP | `null`（dev 灵活） | 加严（待 M5 决定） |

> 开发期关单实例：在 `tauri.conf.json` 用 `--no-default-features` 或运行时判断 `cfg!(debug_assertions)` 跳过插件注册。

## 10. 安全模型

| 威胁 | 缓解 |
| --- | --- |
| 恶意网页通过 `window.__TAURI__` 调本地能力 | `capabilities/default.json` 严格白名单（窗口操作 + 通知 + 全局快捷键） |
| 全局快捷键劫持其它应用 | 只注册 `CmdOrCtrl+Shift+W` 一个，冲突时 `tauri-plugin-global-shortcut` 自动让出 |
| 通知 spam | web 端保证 `tag` 唯一 + 去重；shell 不做去重（信任 web） |
| 跨 origin 注入 | Tauri 2 默认同源策略 + 关闭外部 webview |

## 11. 实施 checklist

- [x] 在 `apps/workbench-desktop/src/contracts.ts` 定义 6 个事件 TS 类型（M4-1）
- [x] 在 `apps/workbench/src/lib/shell.ts` 新增 web → shell emit 封装（含 `__TAURI_INTERNALS__` 探测 + 降级）（M4-2）
- [x] 在 `MainLayout` 拉取 `navBadges` 后 emit `shell://unread`（M4-3）
- [x] 在 `lib.rs` 增加 `on_shell_unread`、`on_shell_notify` 监听 + Dock/托盘更新（M4-4）
- [x] 写 vitest 单测覆盖 `shell.ts` 的降级路径（**11 tests passed**，M4-5）
- [x] 跑通 `pnpm dev:desktop`，手动验：消息 tab 红点 → Dock 红点同步（M4-6，需用户在 macOS 实机验证）
- [x] CI 自动签名 `.dmg`：`.github/workflows/axi-desktop-macos.yml`（M5）
- [x] 通知按 `tag` 合并：Rust 端 1.5s 短时窗去重（M6-1；macOS 11+ 不再支持直接覆盖系统通知，故采用"窗口去重 + 让最后一次自然送达"）

## 13. 独立登录窗口（M7，2026-09-02 加入）

### 13.1 背景

`apps/workbench` 当前登录页是 `/login` 路由，与主 UI 共用一个 webview（路由切换）。Bilibili Mac 客户端、B 站 web 客户端等桌面应用把登录拆为**独立 macOS 窗口**——登录窗与主窗是不同 label、不同尺寸、不同 frontmatter。

### 13.2 目标

1. **G5 — 启动即登录窗**：`.app` 启动只创建 `login` 窗，不创建 `main` 窗；登录窗为仅承载登录面板的紧凑窗口，保留 macOS 标准三颗可用交通灯，并支持通过 Overlay 标题栏拖拽移动。
2. **G6 — 登录成功 → 切主窗**：web 端 `useAuth().isAuthenticated` 翻 true 时 emit `shell://login-success`；shell 关闭 login 窗、创建/显示 main 窗。
3. **G7 — 登录窗可独立关闭**：用户按红钮关 login 窗 = 退出整个 `.app`（不残留后台进程）；与单实例锁 + 关闭到托盘策略不冲突。
4. **G8 — 已有会话跳过登录**：冷启动时 web 先打 `GET /api/v1/auth/session`；若已认证则不发 `login-success`，shell 直接开 main 窗。

### 13.3 不做什么

- ❌ 不重写 Login.tsx 视觉（保持现有双栏 + 扫码 + 邮箱/密码）。
- ❌ 不在登录窗加业务导航 / 标签栏。
- ❌ 不做登录窗嵌主窗的"嵌套模式"——独立窗口是产品决策。
- ❌ 不改 AuthContext / session API。

### 13.4 窗口规格

| 项 | login | main |
| --- | --- | --- |
| label | `login` | `main` |
| 尺寸 | 800×365（仅承载登录面板），min 800×365 | 1280×800（已有） |
| 位置 | 居中 | 居中 |
| 装饰 | macOS 交通灯可见 | macOS 交通灯可见 |
| title | `Workbench — 登录` | `Workbench` |
| resizable | true | true |
| maximizable | true（保留绿色交通灯） | true |
| minimizable | true | true |
| closable | true（关 = 退出 app） | true（关 = 隐藏到托盘，已有） |
| fullscreen | **false** | false |
| 启动可见 | **true**（默认） | **false**（默认），登录成功后 show |

### 13.5 IPC 新增事件

| 事件 | 方向 | payload | 时机 |
| --- | --- | --- | --- |
| `shell://login-success` | web → shell | `{}` | 任意登录路径成功后（web 端在 `isAuthenticated` 翻 true 后 emit） |
| `shell://login-failed` | web → shell | `{ reason: string }` | 登录失败且不可恢复（web 端主动 emit，可选） |
| `shell://logout` | web → shell | `{}` | 主窗用户退出登录；shell 关 main、回 login 窗 |

### 13.6 状态机

```
[启动] → 创建 login 窗
  ↓
login web 加载 /login
  ↓
[web 检查 session]
  ├─ 已认证 → 立即 emit shell://login-success
  └─ 未认证 → 用户登录
       ├─ 成功 → emit shell://login-success
       └─ 失败 → 留在 login 窗（不 emit）
  ↓
[shell 收到 shell://login-success]
  ├─ 关 login 窗
  ├─ 创建/显示 main 窗（label=main）
  └─ emit shell://ready 给 main（DESIGN §3.1）
  ↓
[用户登出]
  web emit shell://logout
  shell 关 main 窗、显示 login 窗
```

### 13.7 文件改动

| 文件 | 改动 |
| --- | --- |
| `apps/workbench-desktop/src/contracts.ts` | + SHELL_EVENTS.LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT |
| `apps/workbench/src/lib/shell.ts` | + emitShellLoginSuccess / emitShellLoginFailed / emitShellLogout / listenShellLogin* |
| `apps/workbench/src/pages/Login.tsx` | + useEffect 监听 isAuthenticated → emitShellLoginSuccess |
| `apps/workbench-desktop/src-tauri/tauri.conf.json` | + login 窗口（独立尺寸）；main 窗口 visible:false |
| `apps/workbench-desktop/src-tauri/src/lib.rs` | + register_ipc_listeners 加 3 个监听；handle_login_success 关 login、开 main；handle_logout 反向；注册 close_login_window → app.exit |

### 13.8 验收

- [ ] `pnpm build:desktop:dmg` 重出 `.app`；启动 `.app` 只弹 800×365 居中登录窗，无 main 窗，登录面板无额外外圈留白。
- [ ] 邮箱/密码登录成功后 → 登录窗关、主窗弹。
- [ ] 扫码登录成功后 → 同上。
- [ ] 主窗登出 → 主窗关、登录窗回。
- [ ] 登录窗点红钮 → `.app` 完全退出（无后台进程）。
- [ ] web 端 `pnpm test` 仍绿、新增 shell login 单测 4 条。
