import { describe, expect, it } from 'vitest';
import { parseWebLoginQrPayload } from './webLoginQr';

const webLoginId = 'weblogin_0123456789abcdef';
const scanToken = 'abcdefghijklmnopqrstuvwxyzABCDEF';
const validPayload = JSON.stringify({ kind: 'axi-web-login-v1', webLoginId, scanToken });

describe('电脑登录二维码载荷', () => {
  it('只接受 Web 端生成的短期扫码载荷', () => {
    expect(parseWebLoginQrPayload(validPayload)).toEqual({
      kind: 'axi-web-login-v1',
      webLoginId,
      scanToken,
    });
  });

  it.each([
    'https://axi.test/api/v1/auth/qr/transactions/approve',
    JSON.stringify({ kind: 'axi-web-login-v1', webLoginId, scanToken, pollToken: 'do-not-accept' }),
    JSON.stringify({ kind: 'axi-web-login-v1', webLoginId: 'weblogin_short', scanToken }),
    JSON.stringify({ kind: 'axi-web-login-v1', webLoginId, scanToken: 'short' }),
    JSON.stringify({ kind: 'other', webLoginId, scanToken }),
    '{}',
  ])('拒绝非电脑登录扫码载荷：%s', (payload) => {
    expect(() => parseWebLoginQrPayload(payload)).toThrow();
  });
});
