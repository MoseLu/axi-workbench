// Workbench Mac App — web ↔ Tauri shell IPC contracts.
//
// 6 个事件，所有事件名以 `shell://` 为命名空间。
// web 端通过 `@tauri-apps/api/event::{emit,listen}` 使用；shell 端通过 `app.emit/listen`。
// 本文件**只在 TS 层使用**，不参与 Rust 编译（Rust 端 `lib.rs` 镜像定义同名常量）。

export const SHELL_EVENTS = {
  READY: 'shell://ready', // shell → web
  UNREAD: 'shell://unread', // web → shell（推未读总数）
  NOTIFY: 'shell://notify', // web → shell（推系统通知）
  MENU: 'shell://menu', // shell → web（菜单项点击透传）
  SHOW_MAIN: 'shell://show-main', // shell → web（主窗口被唤起）
  PING: 'shell://ping', // 双向（健康检查）
  LOGIN_SUCCESS: 'shell://login-success', // web → shell（登录成功 → 关 login、开 main）
  LOGIN_FAILED: 'shell://login-failed', // web → shell（登录失败）
  LOGOUT: 'shell://logout', // web → shell（主窗登出 → 回 login 窗）
} as const

export type ShellEventName = (typeof SHELL_EVENTS)[keyof typeof SHELL_EVENTS]

export type ShellReady = {
  version: string // Tauri 版本，如 '2.11.5'
}

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

export type ShellPing = {
  ts: number // Unix 毫秒
}

export type ShellLoginSuccess = Record<string, never> // 纯信号
export type ShellLoginFailed = { reason?: string }
export type ShellLogout = Record<string, never> // 纯信号

// 工具类型：给定事件名查 payload
export interface ShellEventPayloadMap {
  [SHELL_EVENTS.READY]: ShellReady
  [SHELL_EVENTS.UNREAD]: ShellUnread
  [SHELL_EVENTS.NOTIFY]: ShellNotify
  [SHELL_EVENTS.MENU]: ShellMenuEvent
  [SHELL_EVENTS.SHOW_MAIN]: ShellShowMain
  [SHELL_EVENTS.PING]: ShellPing
  [SHELL_EVENTS.LOGIN_SUCCESS]: ShellLoginSuccess
  [SHELL_EVENTS.LOGIN_FAILED]: ShellLoginFailed
  [SHELL_EVENTS.LOGOUT]: ShellLogout
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