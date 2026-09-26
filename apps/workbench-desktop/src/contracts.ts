// Workbench Mac App — web ↔ Tauri shell IPC contracts.
//
// 与 canonical `@axi/workbench-foundation/shell-contracts` 对齐：
// - 8 个事件，所有事件名以 `shell://` 为命名空间。
// - desktop 端不再保留 READY/PING 死代码（这两个事件在 Rust 壳层从未 emit，
//   也没有被 web 端消费，2026-09 桌面化复审后清理）。
// - LOCAL_RUNTIME_STATUS 与本地项目模式的运行时心跳保持同步；payload 含
//   `localRuntimeOnline` / `lastHeartbeat` / `mode` 三个核心字段。
//
// web 端通过 `@tauri-apps/api/event::{emit,listen}` 使用；shell 端通过 `app.emit/listen`。
// 本文件**只在 TS 层使用**，不参与 Rust 编译（Rust 端 `lib.rs` 镜像定义同名常量）。

export const SHELL_EVENTS = {
  UNREAD: 'shell://unread', // web → shell（推未读总数）
  NOTIFY: 'shell://notify', // web → shell（推系统通知）
  MENU: 'shell://menu', // shell → web（菜单项点击透传）
  SHOW_MAIN: 'shell://show-main', // shell → web（主窗口被唤起）
  LOGIN_SUCCESS: 'shell://login-success', // web → shell（登录成功 → 关 login、开 main）
  LOGIN_FAILED: 'shell://login-failed', // web → shell（登录失败）
  LOGOUT: 'shell://logout', // web → shell（主窗登出 → 回 login 窗）
  LOCAL_RUNTIME_STATUS: 'shell://local-runtime-status', // shell → web（本地运行时心跳）
} as const

export type ShellEventName = (typeof SHELL_EVENTS)[keyof typeof SHELL_EVENTS]

export type ShellUnread = {
  count: number // 0..n；< 0 由 shell 视为非法并忽略
}

export type ShellNotify = {
  title: string // 必填，≤ 64 字符
  body: string // 可空字符串（macOS 会显示空标题）
  url?: string // 相对路径（'/inbox/123'），点击通知时打开
  tag?: string // 同 tag 通知合并；缺省不合并
}

export type ShellMenuEvent = {
  id: string // 见 DESIGN.md §4 菜单项 id 映射表
}

export type ShellShowMain = Record<string, never> // 纯信号

export type ShellLoginSuccess = Record<string, never> // 纯信号
export type ShellLoginFailed = { reason?: string }
export type ShellLogout = Record<string, never> // 纯信号

/**
 * 本地运行时心跳 payload。`mode` 标识当前是否本地项目模式；`localRuntimeOnline`
 * 给出最近一次心跳结果；`lastHeartbeat` 为毫秒 Unix 时间戳，便于 web 端判断
 * "距上次心跳多久"并决定是否进入降级态。
 */
export type LocalRuntimeStatus = {
  mode: 'local-project'
  localRuntimeOnline: boolean
  lastHeartbeat: number // Unix 毫秒；缺省值 0 表示从未上报
}

// 工具类型：给定事件名查 payload
export interface ShellEventPayloadMap {
  [SHELL_EVENTS.UNREAD]: ShellUnread
  [SHELL_EVENTS.NOTIFY]: ShellNotify
  [SHELL_EVENTS.MENU]: ShellMenuEvent
  [SHELL_EVENTS.SHOW_MAIN]: ShellShowMain
  [SHELL_EVENTS.LOGIN_SUCCESS]: ShellLoginSuccess
  [SHELL_EVENTS.LOGIN_FAILED]: ShellLoginFailed
  [SHELL_EVENTS.LOGOUT]: ShellLogout
  [SHELL_EVENTS.LOCAL_RUNTIME_STATUS]: LocalRuntimeStatus
}

// 业务菜单 id 枚举（与 lib.rs::build_app_menu 保持一致）
export const SHELL_MENU_IDS = {
  FILE_NEW: 'file_new',
  // 后续扩展：file_open, file_save_as, view_zoom_in, ...
} as const

export type ShellMenuId = (typeof SHELL_MENU_IDS)[keyof typeof SHELL_MENU_IDS] | string

// 通知文案长度上限（macOS UNNotification 限制）
export const SHELL_NOTIFY_TITLE_MAX = 64
export const SHELL_NOTIFY_BODY_MAX = 256