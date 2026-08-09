import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOBILE_REQUEST_TIMEOUT_MS,
  MobileControlError,
  clearMobileDeviceSession,
  confirmMobileDevicePairing,
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
    // Ed25519 WebCrypto key generation is asynchronous; wait until the
    // request timer is installed before advancing the fake clock.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(MOBILE_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toMatchObject({ error: {
      code: 'service_unavailable',
      status: 503,
    } satisfies Partial<MobileControlError> });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('uses an Ed25519 public key, web-owner approval, and an Ed25519 nonce signature', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/v1/mobile/pair/start')) {
        return new Response(JSON.stringify({ pairingId: 'pair_test', codeExpiresAt: 123 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/control-plane/mobile/pair-approval')) {
        return new Response(JSON.stringify({ ownerApprovalToken: 'a'.repeat(64) }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/pair/confirm')) {
        return new Response(JSON.stringify({ deviceId: 'dev_test01', nonce: { nonceId: 'nonce_test', nonce: 'nonce-value' } }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/token')) {
        return new Response(JSON.stringify({ accessToken: 'jwt-test', expiresAt: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unexpected route' }), { status: 404 });
    }));

    await startMobileDevicePairing();
    const startBody = JSON.parse(String(calls[0].init?.body));
    expect(startBody.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

    await confirmMobileDevicePairing('123456');
    const approvalBody = JSON.parse(String(calls[1].init?.body));
    expect(calls[1].url).toContain('/api/v1/control-plane/mobile/pair-approval');
    expect(approvalBody).toEqual({ pairingId: 'pair_test', code: '123456' });
    const confirmBody = JSON.parse(String(calls[2].init?.body));
    expect(confirmBody.ownerApprovalToken).toBe('a'.repeat(64));
    const tokenBody = JSON.parse(String(calls[3].init?.body));
    expect(tokenBody.signatureHex).toMatch(/^[0-9a-f]{128}$/);
  });
});
