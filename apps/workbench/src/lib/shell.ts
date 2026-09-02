/**
 * Web → Tauri shell IPC bridge.
 *
 * 设计原则（见 DESIGN.md §3）：
 * 1. 探测优先：`window.__TAURI_INTERNALS__` 是 Tauri 2 注入的内部句柄，存
 *    在即认为跑在 Tauri 壳内。
 * 2. 永远不抛错：emit 失败时静默降级为 `CustomEvent` 派发，便于在纯浏览
 *    器下也能跑（E2E、Storybook）。
 * 3. payload 校验：未读数为负、通知标题为空等非法输入就地修正，不抛给
 *    调用方。
 *
 * 不引入 `@tauri-apps/api` 依赖：保持 web 端包零新增依赖；运行时只需
 * `window.__TAURI_INTERNALS__.invoke('plugin:event|emit', ...)` 一条命令。
 */

import {
  SHELL_EVENTS,
  SHELL_NOTIFY_BODY_MAX,
  SHELL_NOTIFY_TITLE_MAX,
  type ShellEventName,
  type ShellNotify,
  type ShellUnread,
} from '@axi/workbench-desktop/contracts';

type TauriInternals = {
  invoke: (cmd: string, payload?: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
    __TAURI__?: unknown;
  }
}

function getTauri(): TauriInternals | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__TAURI_INTERNALS__;
}

/**
 * 探测当前页面是否跑在 Tauri 壳内。供 UI 层做"是否启用托盘红点"等条件渲染。
 */
export function isTauriShell(): boolean {
  return getTauri() !== undefined;
}

/**
 * 内部 emit：Tauri 模式下走 `plugin:event|emit`；否则降级为 CustomEvent
 * 派发（DOM 上可被同一页面的其它组件订阅，方便开发态调试）。
 */
async function rawEmit(name: ShellEventName, payload: unknown): Promise<void> {
  const tauri = getTauri();
  if (tauri) {
    try {
      await tauri.invoke('plugin:event|emit', {
        event: name,
        payload,
      });
      return;
    } catch (err) {
      // 失败时仍尝试 DOM 降级，但**绝不抛错**
      // eslint-disable-next-line no-console
      console.debug('[shell] Tauri emit failed, falling back to DOM event', err);
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: payload }));
    } catch {
      /* noop */
    }
  }
}

/**
 * 推未读总数到 shell（用于 Dock 红点 / 托盘 title）。
 * count < 0 时视为 0；非整数向下取整。
 */
export async function emitShellUnread(count: number): Promise<void> {
  const safe: ShellUnread = {
    count: Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0)),
  };
  await rawEmit(SHELL_EVENTS.UNREAD, safe);
}

/**
 * 推系统通知到 shell。title 为空时直接 noop；超长字段就地截断。
 */
export async function emitShellNotify(input: ShellNotify): Promise<void> {
  const title = String(input.title || '').trim();
  if (!title) return; // 必填，缺省直接吞掉

  const safe: ShellNotify = {
    title: title.slice(0, SHELL_NOTIFY_TITLE_MAX),
    body: String(input.body || '').slice(0, SHELL_NOTIFY_BODY_MAX),
    ...(input.url ? { url: input.url } : {}),
    ...(input.tag ? { tag: input.tag } : {}),
  };

  await rawEmit(SHELL_EVENTS.NOTIFY, safe);
}

/**
 * 通知 shell：登录成功 → 关 login 窗、开 main 窗。
 * Login.tsx 在 isAuthenticated 翻 true 时调用。
 */
export async function emitShellLoginSuccess(): Promise<void> {
  await rawEmit(SHELL_EVENTS.LOGIN_SUCCESS, {});
}

/**
 * 通知 shell：登录失败（可选，shell 当前仅记录）。
 */
export async function emitShellLoginFailed(reason?: string): Promise<void> {
  await rawEmit(SHELL_EVENTS.LOGIN_FAILED, { reason: reason ?? null });
}

/**
 * 通知 shell：主窗登出 → 关 main、回 login 窗。
 */
export async function emitShellLogout(): Promise<void> {
  await rawEmit(SHELL_EVENTS.LOGOUT, {});
}

/**
 * 订阅 shell → web 事件（如 `shell://menu`、`shell://show-main`）。
 * 返回 unsubscribe 函数。
 *
 * 在 Tauri 模式下走 `plugin:event|listen`；在浏览器模式下走 addEventListener。
 */
export async function listenShell<T = unknown>(
  name: ShellEventName,
  handler: (payload: T) => void,
): Promise<() => void> {
  const tauri = getTauri();
  if (tauri) {
    try {
      const unlistenFn = (await tauri.invoke('plugin:event|listen', {
        event: name,
        target: { kind: 'Any' },
        handler: handler as unknown,
      })) as unknown;
      // Tauri 2 返回 Promise<UnlistenFn>；旧版可能直接返回函数。两种都兜底。
      return typeof unlistenFn === 'function' ? (unlistenFn as () => void) : () => unlistenFn;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('[shell] Tauri listen failed, falling back to DOM', err);
    }
  }
  if (typeof window === 'undefined') return () => undefined;
  const wrapped = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    handler(detail as T);
  };
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}