import { describe, expect, it, vi } from 'vitest';
import { approveMobilePairing, normalizeMobilePairingCode } from './mobilePairing';

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
