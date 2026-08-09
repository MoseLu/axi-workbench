import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOBILE_REQUEST_TIMEOUT_MS,
  MobileControlError,
  clearMobileDeviceSession,
  startMobileDevicePairing,
} from './mobileControl';

afterEach(() => {
  clearMobileDeviceSession();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mobile control transport', () => {
  it('converts an unreachable gateway into the truthful unavailable state instead of loading forever', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const request = startMobileDevicePairing().then(
      () => ({ error: null }),
      (error) => ({ error }),
    );
    await vi.advanceTimersByTimeAsync(MOBILE_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toMatchObject({ error: {
      code: 'service_unavailable',
      status: 503,
    } satisfies Partial<MobileControlError> });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
