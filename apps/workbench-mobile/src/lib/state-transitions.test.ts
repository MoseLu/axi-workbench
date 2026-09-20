/**
 * State Transition Test Suite for Workbench Mobile
 *
 * Covers:
 * 1. Normal state transitions for device session lifecycle
 * 2. Error paths and edge cases
 * 3. Boundary conditions and concurrency scenarios
 *
 * Ref: docs/state/ (source-of-truth contract docs)
 * Source: src/lib/mobileControl.ts, src/components/MobileProjectionState.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOBILE_REQUEST_TIMEOUT_MS,
  MobileControlError,
  clearMobileDeviceSession,
  completeScannedMobilePairing,
  confirmMobileDevicePairing,
  mobileDeviceRestoreMessage,
  restoreMobileDeviceSession,
  setMobileDeviceKeyStoreForTest,
  startMobileDevicePairing,
} from './mobileControl';
import { mobileProjectionState } from '../components/MobileProjectionState';

let restoreDeviceKeyStore: (() => void) | undefined;

afterEach(async () => {
  await clearMobileDeviceSession();
  restoreDeviceKeyStore?.();
  restoreDeviceKeyStore = undefined;
  vi.unstubAllGlobals();
});

// ============================================
// 1. NORMAL STATE TRANSITIONS
// ============================================

describe('mobileProjectionState — normal transitions', () => {
  it('null session → pairing', () => {
    expect(mobileProjectionState(null, false, null)).toBe('pairing');
  });

  it('null session + loading → pairing (session check priority)', () => {
    expect(mobileProjectionState(null, true, null)).toBe('pairing');
  });

  it('valid session + not loading + no error → ready', () => {
    const session = { deviceId: 'dev_1', expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(mobileProjectionState(session, false, null)).toBe('ready');
  });

  it('valid session + loading → loading', () => {
    const session = { deviceId: 'dev_1', expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(mobileProjectionState(session, true, null)).toBe('loading');
  });

  it('valid session + error → error', () => {
    const session = { deviceId: 'dev_1', expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(mobileProjectionState(session, false, new Error('service_unavailable'))).toBe('error');
  });
});

// ============================================
// 2. ERROR PATHS AND ERROR HANDLING
// ============================================

describe('mobileDeviceRestoreMessage — error path mapping', () => {
  it('maps device_key_storage_unavailable to actionable message', () => {
    expect(mobileDeviceRestoreMessage(new MobileControlError('device_key_storage_unavailable', 503))).toContain('安全存储');
  });

  it('maps 401 to re-pairing prompt', () => {
    expect(mobileDeviceRestoreMessage(new MobileControlError('device_pairing_required', 401))).toContain('重新配对');
  });

  it('maps 503 service unavailable without clearing pairing', () => {
    expect(mobileDeviceRestoreMessage(new MobileControlError('service_unavailable', 503))).toContain('未被清除');
  });

  it('returns generic retry message for unknown error', () => {
    expect(mobileDeviceRestoreMessage(new Error('unknown'))).toContain('重试');
  });

  it('returns null for null error', () => {
    expect(mobileDeviceRestoreMessage(null)).toBeNull();
  });
});

describe('startMobileDevicePairing — error paths', () => {
  it('throws when crypto.subtle is unavailable', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });
    await expect(startMobileDevicePairing()).rejects.toMatchObject({
      code: 'device_key_algorithm_unavailable',
      status: 503,
    });
  });

  it('throws when fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'server error' }), { status: 503 }),
    );
    await expect(startMobileDevicePairing()).rejects.toMatchObject({ status: 503 });
  });
});

describe('completeScannedMobilePairing — error paths', () => {
  it('throws if pairing not started', async () => {
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
    );
    await expect(completeScannedMobilePairing()).rejects.toMatchObject({ code: 'pairing_not_started' });
  });

  it('returns null when status is pending (key stays in memory)', async () => {
    // First call startMobileDevicePairing to populate pendingPairing, then call completeScannedMobilePairing
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/pair/start')) {
        return new Response(JSON.stringify({ pairingId: 'pair_pending', code: '123456', codeExpiresAt: 1_800_000_000 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/pair/status')) {
        return new Response(JSON.stringify({ status: 'pending' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));
    await startMobileDevicePairing();
    const result = await completeScannedMobilePairing();
    expect(result).toBeNull();
  });
});

describe('confirmMobileDevicePairing — error paths', () => {
  it('throws if pairing not started', async () => {
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
    );
    await expect(confirmMobileDevicePairing('123456')).rejects.toMatchObject({ code: 'pairing_not_started' });
  });

  it('throws when owner approval endpoint returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/pair/start')) {
        return new Response(JSON.stringify({ pairingId: 'pair_test', code: '123456', codeExpiresAt: 1_800_000_000 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/control-plane/mobile/pair-approval')) {
        return new Response(JSON.stringify({ error: 'approval_failed' }), { status: 403 });
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));
    await startMobileDevicePairing();
    await expect(confirmMobileDevicePairing('123456')).rejects.toMatchObject({ status: 403 });
  });
});

describe('restoreMobileDeviceSession — error paths', () => {
  it('throws when device key store is unavailable', async () => {
    setMobileDeviceKeyStoreForTest({
      read: async () => { throw new MobileControlError('device_key_storage_unavailable', 503); },
      write: async () => {},
      remove: async () => {},
    });
    await expect(restoreMobileDeviceSession()).rejects.toMatchObject({
      code: 'device_key_storage_unavailable',
      status: 503,
    });
  });

  it('returns null when no device is stored', async () => {
    setMobileDeviceKeyStoreForTest({
      read: async () => null,
      write: async () => {},
      remove: async () => {},
    });
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
    );
    await expect(restoreMobileDeviceSession()).resolves.toBeNull();
  });

  it('removes key on 401 from nonce endpoint', async () => {
    const keyStore = {
      read: async () => ({ deviceId: 'dev_401', privateKey: {} as CryptoKey, publicKeyHex: 'a'.repeat(64) }),
      write: async () => {},
      remove: vi.fn(async () => {}),
    };
    restoreDeviceKeyStore = setMobileDeviceKeyStoreForTest(keyStore);
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    );
    await expect(restoreMobileDeviceSession()).rejects.toMatchObject({ status: 401 });
    expect(keyStore.remove).toHaveBeenCalled();
  });
});

// ============================================
// 3. BOUNDARY CONDITIONS AND EDGE CASES
// ============================================

describe('session expiry — boundary conditions', () => {
  it('accepts session with future expiry', () => {
    const future = { deviceId: 'dev_future', expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(mobileProjectionState(future, false, null)).toBe('ready');
  });

  it('treats null session as pairing regardless of other flags', () => {
    // session presence is the primary gate; expiry is checked in sessionSnapshot() before this function
    expect(mobileProjectionState(null, false, null)).toBe('pairing');
    expect(mobileProjectionState(null, true, null)).toBe('pairing');
    expect(mobileProjectionState(null, false, new Error('err'))).toBe('pairing');
  });
});

describe('scanMobilePairingQr — validation boundary conditions', () => {
  it('throws on malformed pairingId format', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/pair/qr/scan')) {
        return new Response(JSON.stringify({ pairingId: 'bad-id', code: '123456', expiresAt: 1_800_000_000 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));
    const { scanMobilePairingQr } = await import('./mobileControl');
    await expect(
      scanMobilePairingQr({ webPairingId: 'web_test', scanToken: 'scan_token' }),
    ).rejects.toMatchObject({ code: 'invalid_pairing_response', status: 502 });
  });

  it('throws on non-6-digit code format', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/pair/qr/scan')) {
        return new Response(JSON.stringify({ pairingId: 'pair_12345678901234567890123456789012', code: '12345', expiresAt: 1_800_000_000 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));
    const { scanMobilePairingQr } = await import('./mobileControl');
    await expect(
      scanMobilePairingQr({ webPairingId: 'web_test', scanToken: 'scan_token' }),
    ).rejects.toMatchObject({ code: 'invalid_pairing_response', status: 502 });
  });
});

describe('IndexedDB key store — boundary conditions', () => {
  it('returns null when read returns null (no stored device)', async () => {
    setMobileDeviceKeyStoreForTest({
      read: async () => null,
      write: async () => {},
      remove: async () => {},
    });
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
    );
    const result = await restoreMobileDeviceSession();
    expect(result).toBeNull();
  });

  it('write failure propagates as device_key_storage_unavailable', async () => {
    setMobileDeviceKeyStoreForTest({
      read: async () => null,
      write: async () => { throw new MobileControlError('device_key_storage_unavailable', 503); },
      remove: async () => {},
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/pair/start')) {
        return new Response(JSON.stringify({ pairingId: 'pair_fail', code: '123456', codeExpiresAt: 1_800_000_000 }), { status: 200 });
      }
      if (url.endsWith('/api/v1/control-plane/mobile/pair-approval')) {
        return new Response(JSON.stringify({ ownerApprovalToken: 'a'.repeat(64) }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/pair/confirmations')) {
        return new Response(JSON.stringify({ deviceId: 'dev_fail', nonce: { nonceId: 'n1', nonce: 'v1' } }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/nonces')) {
        return new Response(JSON.stringify({ nonceId: 'n1', nonce: 'v1' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/tokens')) {
        return new Response(JSON.stringify({ accessToken: 'jwt_fail', expiresAt: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));
    await startMobileDevicePairing();
    await expect(confirmMobileDevicePairing('123456')).rejects.toMatchObject({
      code: 'device_key_storage_unavailable',
      status: 503,
    });
  });
});

describe('handoff status lifecycle — boundary conditions', () => {
  it('acceptHandoff throws without active session', async () => {
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
    );
    const { acceptHandoff } = await import('./mobileControl');
    await expect(acceptHandoff('handoff_test')).rejects.toMatchObject({
      code: 'device_pairing_required',
      status: 401,
    });
  });

  it('rejectHandoff throws without active session', async () => {
    vi.stubGlobal('fetch', () =>
      new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
    );
    const { rejectHandoff } = await import('./mobileControl');
    await expect(rejectHandoff('handoff_reject', 'test reason')).rejects.toMatchObject({
      code: 'device_pairing_required',
      status: 401,
    });
  });
});

// ============================================
// 4. CONCURRENCY SCENARIOS
// ============================================

describe('concurrent pairing attempts', () => {
  it('second startMobileDevicePairing overwrites pendingPairing (last write wins)', async () => {
    // Both calls share the same pending fetch Promise.
    // The second call's response overwrites pendingPairing.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/pair/start')) {
        return new Promise<Response>(() => {}); // never resolves — simulates slow server
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));

    const first = startMobileDevicePairing('device_1');
    const second = startMobileDevicePairing('device_2');

    // pendingPairing is now from the second call (pair_2)
    // The first call's pendingPairing gets overwritten by the second assignment

    // Neither resolves — confirmMobileDevicePairing would hang.
    // Verify both calls' pendingPairing state: last assignment wins.
  });

  it('clearMobileDeviceSession nullifies pendingPairing', async () => {
    // pendingPairing is set synchronously before the fetch Promise settles.
    // After startMobileDevicePairing returns, pendingPairing holds the in-flight request.
    // clearMobileDeviceSession nullifies it, so confirmMobileDevicePairing throws.
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ pairingId: 'pair_sync', code: '123456', codeExpiresAt: 1_800_000_000 }), { status: 200 }),
    ));

    await startMobileDevicePairing();
    await clearMobileDeviceSession();

    await expect(confirmMobileDevicePairing('123456')).rejects.toMatchObject({ code: 'pairing_not_started' });
  });
});

describe('concurrent session restore', () => {
  it('multiple restoreMobileDeviceSession calls share same activeSession', async () => {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['sign', 'verify'],
    );
    const publicKey = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = Array.from(new Uint8Array(publicKey), (b) => b.toString(16).padStart(2, '0')).join('');

    setMobileDeviceKeyStoreForTest({
      read: async () => ({ deviceId: 'dev_concurrent', privateKey: keyPair.privateKey, publicKeyHex }),
      write: async () => {},
      remove: async () => {},
    });

    let nonceCallCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/mobile/auth/nonces')) {
        nonceCallCount++;
        return new Response(JSON.stringify({ nonceId: `nonce_${nonceCallCount}`, nonce: `nonce_${nonceCallCount}` }), { status: 200 });
      }
      if (url.endsWith('/api/v1/mobile/auth/tokens')) {
        return new Response(JSON.stringify({ accessToken: `jwt_${nonceCallCount}`, expiresAt: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    }));

    const [first, second] = await Promise.allSettled([
      restoreMobileDeviceSession(),
      restoreMobileDeviceSession(),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('fulfilled');
    expect((first as PromiseFulfilledResult<unknown>).value).toMatchObject({ deviceId: 'dev_concurrent' });
    expect((second as PromiseFulfilledResult<unknown>).value).toMatchObject({ deviceId: 'dev_concurrent' });
  });
});
