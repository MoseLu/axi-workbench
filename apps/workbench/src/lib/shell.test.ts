import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitShellNotify,
  emitShellUnread,
  isTauriShell,
  listenShell,
} from './shell';
import { SHELL_EVENTS } from '@axi/workbench-desktop/contracts';

type TauriInternals = { invoke: (cmd: string, payload?: Record<string, unknown>) => Promise<unknown> };

afterEach(() => {
  vi.unstubAllGlobals();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).__TAURI_INTERNALS__;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).__TAURI__;
});

describe('shell.ts', () => {
  describe('isTauriShell', () => {
    it('returns false in plain browser', () => {
      expect(isTauriShell()).toBe(false);
    });

    it('returns true when __TAURI_INTERNALS__ exists', () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };
      expect(isTauriShell()).toBe(true);
    });
  });

  describe('emitShellUnread', () => {
    it('clamps negative counts to zero and emits via Tauri', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };

      await emitShellUnread(-5);
      expect(invoke).toHaveBeenCalledWith('plugin:event|emit', {
        event: SHELL_EVENTS.UNREAD,
        payload: { count: 0 },
      });
    });

    it('truncates fractional counts', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };

      await emitShellUnread(7.9);
      expect(invoke).toHaveBeenCalledWith('plugin:event|emit', {
        event: SHELL_EVENTS.UNREAD,
        payload: { count: 7 },
      });
    });

    it('falls back to CustomEvent when Tauri emit fails', async () => {
      const invoke = vi.fn().mockRejectedValue(new Error('boom'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };

      const handler = vi.fn();
      window.addEventListener(SHELL_EVENTS.UNREAD, handler as EventListener);

      await expect(emitShellUnread(3)).resolves.toBeUndefined();
      // CustomEvent fallback 派发
      expect(handler).toHaveBeenCalled();
      const evt = handler.mock.calls[0][0] as CustomEvent<{ count: number }>;
      expect(evt.detail).toEqual({ count: 3 });
    });

    it('never throws even when no Tauri and no window event', async () => {
      // 仅探测纯函数行为；真实降级路径覆盖在上一个用例里
      await expect(emitShellUnread(0)).resolves.toBeUndefined();
    });
  });

  describe('emitShellNotify', () => {
    it('noops on empty title without throwing', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };
      await emitShellNotify({ title: '   ', body: 'ignored' });
      expect(invoke).not.toHaveBeenCalled();
    });

    it('truncates title to 64 chars', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };
      const longTitle = 'x'.repeat(200);
      await emitShellNotify({ title: longTitle, body: 'b' });
      const call = invoke.mock.calls[0][1] as { payload: { title: string } };
      expect(call.payload.title.length).toBe(64);
    });

    it('preserves url and tag when present', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };
      await emitShellNotify({
        title: '新消息',
        body: 'preview',
        url: '/inbox/123',
        tag: 'inbox-123',
      });
      const call = invoke.mock.calls[0][1] as { payload: Record<string, unknown> };
      expect(call.payload).toEqual({
        title: '新消息',
        body: 'preview',
        url: '/inbox/123',
        tag: 'inbox-123',
      });
    });

    it('strips url/tag when empty', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ = { invoke };
      await emitShellNotify({ title: 't', body: 'b', url: '', tag: '' });
      const call = invoke.mock.calls[0][1] as { payload: Record<string, unknown> };
      expect(call.payload).toEqual({ title: 't', body: 'b' });
      expect(call.payload).not.toHaveProperty('url');
      expect(call.payload).not.toHaveProperty('tag');
    });
  });

  describe('listenShell', () => {
    it('returns unsubscribe function for DOM fallback', async () => {
      const handler = vi.fn();
      const off = await listenShell(SHELL_EVENTS.SHOW_MAIN, handler);
      window.dispatchEvent(new CustomEvent(SHELL_EVENTS.SHOW_MAIN, { detail: {} }));
      expect(handler).toHaveBeenCalled();
      off();
      window.dispatchEvent(new CustomEvent(SHELL_EVENTS.SHOW_MAIN, { detail: {} }));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});

// 让 TS 不抱怨 TauriInternals 类型在测试里被构造（仅作占位）
export type _TestTauriInternals = TauriInternals;