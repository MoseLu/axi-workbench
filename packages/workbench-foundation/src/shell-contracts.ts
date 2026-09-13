// Workbench renderer ↔ native shell contracts.
//
// The Web renderer and the Tauri host both consume this neutral contract. The
// Rust implementation mirrors the event names and payloads independently;
// this TypeScript module must not depend on Tauri or any UI package.

export const SHELL_EVENTS = {
  READY: 'shell://ready',
  UNREAD: 'shell://unread',
  NOTIFY: 'shell://notify',
  MENU: 'shell://menu',
  SHOW_MAIN: 'shell://show-main',
  PING: 'shell://ping',
  LOGIN_SUCCESS: 'shell://login-success',
  LOGIN_FAILED: 'shell://login-failed',
  LOGOUT: 'shell://logout',
} as const;

export type ShellEventName = (typeof SHELL_EVENTS)[keyof typeof SHELL_EVENTS];

export type ShellReady = {
  version: string;
};

export type ShellUnread = {
  count: number;
};

export type ShellNotify = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type ShellMenuEvent = {
  id: string;
};

export type ShellShowMain = Record<string, never>;

export type ShellPing = {
  ts: number;
};

export type ShellLoginSuccess = Record<string, never>;
export type ShellLoginFailed = { reason?: string };
export type ShellLogout = Record<string, never>;

export interface ShellEventPayloadMap {
  [SHELL_EVENTS.READY]: ShellReady;
  [SHELL_EVENTS.UNREAD]: ShellUnread;
  [SHELL_EVENTS.NOTIFY]: ShellNotify;
  [SHELL_EVENTS.MENU]: ShellMenuEvent;
  [SHELL_EVENTS.SHOW_MAIN]: ShellShowMain;
  [SHELL_EVENTS.PING]: ShellPing;
  [SHELL_EVENTS.LOGIN_SUCCESS]: ShellLoginSuccess;
  [SHELL_EVENTS.LOGIN_FAILED]: ShellLoginFailed;
  [SHELL_EVENTS.LOGOUT]: ShellLogout;
}

export const SHELL_MENU_IDS = {
  FILE_NEW: 'file_new',
} as const;

export type ShellMenuId = (typeof SHELL_MENU_IDS)[keyof typeof SHELL_MENU_IDS] | string;

export const SHELL_NOTIFY_TITLE_MAX = 64;
export const SHELL_NOTIFY_BODY_MAX = 256;
