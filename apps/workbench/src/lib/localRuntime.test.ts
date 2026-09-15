import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLocalRuntimeStatus,
  isLocalRuntimeBlocked,
  LOCAL_RUNTIME_ORIGIN,
  retryLocalRuntime,
} from './localRuntime';

describe('localRuntime bridge', () => {
  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('reads the native local runtime status', async () => {
    const invoke = vi.fn().mockResolvedValue({
      mode: 'local-project',
      phase: 'ready',
      services: { 'api-gateway': 'ready' },
      gatewayOrigin: LOCAL_RUNTIME_ORIGIN,
      error: null,
    });
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke };

    await expect(getLocalRuntimeStatus()).resolves.toMatchObject({ phase: 'ready' });
    expect(invoke).toHaveBeenCalledWith('local_runtime_status');
  });

  it('requests a native local runtime retry', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke };

    await retryLocalRuntime();
    expect(invoke).toHaveBeenCalledWith('retry_local_runtime');
  });

  it('blocks login until a required local runtime is resolved and ready', () => {
    expect(isLocalRuntimeBlocked(false, false, null)).toBe(false);
    expect(isLocalRuntimeBlocked(true, false, null)).toBe(true);
    expect(isLocalRuntimeBlocked(true, true, { mode: 'local-project', phase: 'ready', services: {}, gatewayOrigin: LOCAL_RUNTIME_ORIGIN })).toBe(false);
    expect(isLocalRuntimeBlocked(true, true, { mode: 'local-project', phase: 'failed', services: {}, gatewayOrigin: LOCAL_RUNTIME_ORIGIN, error: 'boom' })).toBe(true);
  });
});
