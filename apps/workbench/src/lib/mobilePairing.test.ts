import { describe, expect, it, vi } from 'vitest';
import {
  approveMobilePairing,
  approveMobilePairingQr,
  createMobilePairingQr,
  getMobilePairingQrStatus,
  mobilePairingQrPayload,
  normalizeMobilePairingCode,
} from './mobilePairing';

describe('normalizeMobilePairingCode', () => {
  it('keeps only six decimal digits', () => {
    expect(normalizeMobilePairingCode(' 12-34 56 ')).toBe('123456');
    expect(normalizeMobilePairingCode('12345')).toBeNull();
    expect(normalizeMobilePairingCode('1234567')).toBeNull();
  });
});

describe('approveMobilePairing', () => {
  it('uses the authenticated gateway control-plane boundary and never submits malformed codes', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, status: 'approved', deviceName: 'Android' }), { status: 200 }));

    await expect(approveMobilePairing('123456', fetcher)).resolves.toMatchObject({ ok: true, status: 'approved' });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/control-plane/mobile/pair/approve'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ code: '123456' }),
      }),
    );

    await expect(approveMobilePairing('invalid', fetcher)).rejects.toThrow('配对码必须是 6 位数字');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Web QR mobile pairing', () => {
  const pairing = {
    webPairingId: 'webpair_a8e4d721-388a-4b17-90fa-170a91dd9e4d',
    scanToken: 'Q4TkWcT5OmmuZECnsYBEEipOFGT4K0J9pKX1vTcrdOw',
    expiresAt: 1_800_000_000_000,
  };

  it('creates an owner-bound one-time QR transaction through the authenticated gateway', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, ...pairing }), { status: 201 }));

    await expect(createMobilePairingQr(fetcher)).resolves.toEqual(pairing);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/control-plane/mobile/pair/qr'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: '{}',
      }),
    );
  });

  it('encodes only an opaque transaction and one-time scan bearer for the phone camera', () => {
    expect(JSON.parse(mobilePairingQrPayload(pairing))).toEqual({
      kind: 'axi-mobile-pair-v1',
      webPairingId: pairing.webPairingId,
      scanToken: pairing.scanToken,
    });
  });

  it('observes and confirms a scanned device without exposing the scan bearer again', async () => {
    const statusFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      status: 'scanned',
      expiresAt: pairing.expiresAt,
      deviceName: '我的 Android',
      scanToken: 'must-not-leak',
    }), { status: 200 }));

    await expect(getMobilePairingQrStatus(pairing.webPairingId, statusFetcher)).resolves.toEqual({
      status: 'scanned',
      expiresAt: pairing.expiresAt,
      deviceName: '我的 Android',
    });
    expect(statusFetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/control-plane/mobile/pair/qr/${pairing.webPairingId}`),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );

    const approveFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      status: 'approved',
      deviceName: '我的 Android',
    }), { status: 200 }));
    await expect(approveMobilePairingQr(pairing.webPairingId, approveFetcher)).resolves.toEqual({
      status: 'approved',
      deviceName: '我的 Android',
    });
    expect(approveFetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/control-plane/mobile/pair/qr/${pairing.webPairingId}/approve`),
      expect.objectContaining({ method: 'POST', credentials: 'include', body: '{}' }),
    );
  });

  it('rejects malformed QR transactions before making a request', async () => {
    const fetcher = vi.fn();
    await expect(getMobilePairingQrStatus('not-a-pairing-id', fetcher)).rejects.toThrow('二维码配对请求无效');
    await expect(approveMobilePairingQr('not-a-pairing-id', fetcher)).rejects.toThrow('二维码配对请求无效');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
