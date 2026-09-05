import { describe, expect, it, vi } from 'vitest';
import {
  consumeWebDeviceLoginQr,
  createWebDeviceLoginQr,
  getWebDeviceLoginQrStatus,
  webDeviceLoginQrPayload,
} from './webDeviceLogin';

describe('Web device QR login', () => {
  const transaction = {
    webLoginId: 'weblogin_a8e4d721-388a-4b17-90fa-170a91dd9e4d',
    scanToken: 'Q4TkWcT5OmmuZECnsYBEEipOFGT4K0J9pKX1vTcrdOw',
    pollToken: 'R5UkXdU6PnnvAFDotaCFFjqPGHU5L1K0qLY2wUdsfPx',
    expiresAt: 1_800_000_000,
  };

  it('creates an anonymous QR transaction but keeps the browser polling credential off the QR', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, ...transaction }), { status: 200 }));

    await expect(createWebDeviceLoginQr(fetcher)).resolves.toEqual(transaction);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/device-login/qr'),
      expect.objectContaining({ method: 'POST', credentials: 'include', body: '{}' }),
    );
    expect(JSON.parse(webDeviceLoginQrPayload(transaction))).toEqual({
      kind: 'axi-web-login-v1',
      webLoginId: transaction.webLoginId,
      scanToken: transaction.scanToken,
    });
  });

  it('polls and consumes only with the browser-held poll token', async () => {
    const statusFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      status: 'approved',
      expiresAt: transaction.expiresAt,
      ownerSubject: 'must-not-leak',
    }), { status: 200 }));
    await expect(getWebDeviceLoginQrStatus(transaction, statusFetcher)).resolves.toEqual({
      status: 'approved',
      expiresAt: transaction.expiresAt,
    });
    expect(statusFetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/auth/device-login/qr/${transaction.webLoginId}`),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Axi-QR-Poll-Token': transaction.pollToken }),
      }),
    );

    const consumeFetcher = vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    await expect(consumeWebDeviceLoginQr(transaction, consumeFetcher)).resolves.toEqual({ authenticated: true });
    expect(consumeFetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/auth/device-login/qr/${transaction.webLoginId}/consume`),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Axi-QR-Poll-Token': transaction.pollToken }),
      }),
    );
  });

  it('rejects malformed browser transactions before network access', async () => {
    const fetcher = vi.fn();
    await expect(getWebDeviceLoginQrStatus({ ...transaction, pollToken: 'bad' }, fetcher)).rejects.toThrow('电脑登录二维码无效');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
