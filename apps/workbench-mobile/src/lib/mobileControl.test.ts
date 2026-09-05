import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOBILE_REQUEST_TIMEOUT_MS,
  MobileControlError,
  approveMobileWebLoginQr,
  clearMobileDeviceSession,
  completeScannedMobilePairing,
  confirmMobileDevicePairing,
  mobileDeviceRestoreMessage,
  restoreMobileDeviceSession,
  scanMobilePairingQr,
  setMobileDeviceKeyStoreForTest,
  startMobileDevicePairing,
} from './mobileControl';

let restoreDeviceKeyStore: (() => void) | undefined;

function installDeviceKeyStore(initial: { deviceId: string; privateKey: CryptoKey; publicKeyHex: string } | null = null) {
  let record = initial;
  const read = vi.fn(async () => record);
  const write = vi.fn(async (next: { deviceId: string; privateKey: CryptoKey; publicKeyHex: string }) => { record = next; });
  const remove = vi.fn(async () => { record = null; });
  restoreDeviceKeyStore = setMobileDeviceKeyStoreForTest({ read, write, remove });
  return { read, write, remove, record: () => record };
}

afterEach(async () => {
  await clearMobileDeviceSession();
  restoreDeviceKeyStore?.();
  restoreDeviceKeyStore = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mobile control transport', () => {
  it('keeps restoration failures actionable without claiming the pairing was erased', () => {
    expect(mobileDeviceRestoreMessage(new MobileControlError('service_unavailable', 503)))
      .toContain('未被清除');
    expect(mobileDeviceRestoreMessage(new MobileControlError('device_missing', 401)))
      .toContain('重新配对');
    expect(mobileDeviceRestoreMessage(new MobileControlError('device_key_storage_unavailable', 503)))
      .toContain('安全存储');
  });

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
    const keyStore = installDeviceKeyStore();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/v1/mobile/pair/start')) {
        return new Response(JSON.stringify({ pairingId: 'pair_test', code: '123456', codeExpiresAt: 123 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/control-plane/mobile/pair-approval')) {
        return new Response(JSON.stringify({ ownerApprovalToken: 'a'.repeat(64) }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/pair/confirm')) {
        return new Response(JSON.stringify({ deviceId: 'dev_test01', nonce: { nonceId: 'nonce_test', nonce: 'nonce-value' } }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/nonce')) {
        return new Response(JSON.stringify({ nonceId: 'nonce_test', nonce: 'nonce-value' }), { status: 200 });
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
    const tokenBody = JSON.parse(String(calls[4].init?.body));
    expect(tokenBody.signatureHex).toMatch(/^[0-9a-f]{128}$/);
    expect(keyStore.write).toHaveBeenCalledOnce();
    expect(keyStore.record()?.privateKey.extractable).toBe(false);
  });

  it('restores a paired device with its persisted non-extractable key and a fresh short-lived token', async () => {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['sign', 'verify'],
    ) as CryptoKeyPair;
    const publicKey = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = Array.from(new Uint8Array(publicKey), (part) => part.toString(16).padStart(2, '0')).join('');
    installDeviceKeyStore({ deviceId: 'dev_restore01', privateKey: keyPair.privateKey, publicKeyHex });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/v1/mobile/auth/nonce')) {
        return new Response(JSON.stringify({ nonceId: 'nonce_restore', nonce: 'restore-value' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/token')) {
        return new Response(JSON.stringify({ accessToken: 'jwt-restored', expiresAt: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unexpected route' }), { status: 404 });
    }));

    const restored = await restoreMobileDeviceSession();

    expect(restored).toMatchObject({ deviceId: 'dev_restore01' });
    expect(keyPair.privateKey.extractable).toBe(false);
    expect(calls.map((call) => call.url)).toEqual([
      expect.stringContaining('/api/v1/mobile/auth/nonce'),
      expect.stringContaining('/api/v1/mobile/auth/token'),
    ]);
    const tokenBody = JSON.parse(String(calls[1].init?.body));
    expect(tokenBody).toMatchObject({ deviceId: 'dev_restore01', nonceId: 'nonce_restore', nonce: 'restore-value' });
    expect(tokenBody.signatureHex).toMatch(/^[0-9a-f]{128}$/);
  });

  it('confirms a computer-login QR only with the restored paired-device bearer', async () => {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['sign', 'verify'],
    ) as CryptoKeyPair;
    const publicKey = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = Array.from(new Uint8Array(publicKey), (part) => part.toString(16).padStart(2, '0')).join('');
    installDeviceKeyStore({ deviceId: 'dev_web_login', privateKey: keyPair.privateKey, publicKeyHex });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/v1/mobile/auth/nonce')) {
        return new Response(JSON.stringify({ nonceId: 'nonce_web_login', nonce: 'web-login-value' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/token')) {
        return new Response(JSON.stringify({ accessToken: 'jwt-web-login', expiresAt: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/web-login/qr/scan')) {
        return new Response(JSON.stringify({ ok: true, status: 'approved' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unexpected route' }), { status: 404 });
    }));

    await restoreMobileDeviceSession();
    await expect(approveMobileWebLoginQr({
      webLoginId: 'weblogin_0123456789abcdef',
      scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEF',
    })).resolves.toEqual({ ok: true, status: 'approved' });

    const scan = calls[calls.length - 1]!;
    expect(scan.url).toContain('/api/v1/mobile/web-login/qr/scan');
    expect(new Headers(scan.init?.headers).get('Authorization')).toBe('Bearer jwt-web-login');
    expect(JSON.parse(String(scan.init?.body))).toEqual({
      webLoginId: 'weblogin_0123456789abcdef',
      scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEF',
    });
  });

  it('registers a Web-owned QR scan and activates only after Web approval', async () => {
    const keyStore = installDeviceKeyStore();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let statusCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/v1/mobile/pair/qr/scan')) {
        return new Response(JSON.stringify({ pairingId: 'pair_12345678-1234-1234-1234-123456789012', code: '123456', expiresAt: 1_800_000_000 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/pair/status')) {
        statusCalls += 1;
        return new Response(JSON.stringify(statusCalls === 1 ? { status: 'pending' } : { status: 'approved', deviceId: 'dev_qr_test' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/nonce')) {
        return new Response(JSON.stringify({ nonceId: 'nonce_qr_test', nonce: 'nonce-value' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/token')) {
        return new Response(JSON.stringify({ accessToken: 'jwt-qr-test', expiresAt: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unexpected route' }), { status: 404 });
    }));

    await expect(scanMobilePairingQr({
      webPairingId: 'webpair_1234567890abcdef',
      scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    })).resolves.toMatchObject({ pairingId: 'pair_12345678-1234-1234-1234-123456789012' });
    const scanBody = JSON.parse(String(calls[0].init?.body));
    expect(scanBody).toEqual(expect.objectContaining({
      webPairingId: 'webpair_1234567890abcdef',
      scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
      publicKeyAlgorithm: 'Ed25519',
      deviceName: 'Axi 工作台移动端',
    }));
    expect(scanBody.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(scanBody).sort()).toEqual([
      'deviceName',
      'publicKeyAlgorithm',
      'publicKeyHex',
      'scanToken',
      'webPairingId',
    ]);
    await expect(completeScannedMobilePairing()).resolves.toBeNull();
    await expect(completeScannedMobilePairing()).resolves.toMatchObject({ deviceId: 'dev_qr_test' });
    expect(keyStore.write).toHaveBeenCalledOnce();
    expect(statusCalls).toBe(2);
  });
});
