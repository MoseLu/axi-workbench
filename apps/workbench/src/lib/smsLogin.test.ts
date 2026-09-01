import { describe, expect, it, vi } from 'vitest';
import { confirmSmsCode, isValidSmsPhone, normalizeSmsPhone, requestSmsCode } from './smsLogin';

describe('SMS login adapter', () => {
  it('normalizes and validates mainland mobile numbers', () => {
    expect(normalizeSmsPhone('138 0013-8000')).toBe('13800138000');
    expect(isValidSmsPhone('13800138000')).toBe(true);
    expect(isValidSmsPhone('12800138000')).toBe(false);
  });

  it('requests a challenge through the dedicated SMS endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      challengeId: 'sms_challenge_123',
      expiresAt: '2026-09-01T10:00:00.000Z',
    }), { status: 200 }));

    await expect(requestSmsCode('13800138000', fetcher)).resolves.toEqual({
      challengeId: 'sms_challenge_123',
      expiresAt: '2026-09-01T10:00:00.000Z',
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/sms-verifications'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ countryCode: '+86', phone: '13800138000', purpose: 'login' }),
      }),
    );
  });

  it('confirms a six-digit challenge through the SMS login endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), { status: 200 }));

    await expect(confirmSmsCode('sms_challenge_123', '123456', fetcher)).resolves.toEqual({ authenticated: true });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/login/sms/confirm'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ challengeId: 'sms_challenge_123', token: '123456' }),
      }),
    );
  });

  it('rejects an invalid phone before making a request', async () => {
    const fetcher = vi.fn();
    await expect(requestSmsCode('not-a-phone', fetcher)).rejects.toThrow('请输入有效的手机号');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
