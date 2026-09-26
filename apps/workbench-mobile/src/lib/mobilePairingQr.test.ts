import { describe, expect, it } from 'vitest';
import { parseMobilePairingQrPayload } from './mobilePairingQr';

const payload = JSON.stringify({
  kind: 'axi-mobile-pair-v1',
  webPairingId: 'webpair_1234567890abcdef',
  scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
});

describe('手机扫码配对载荷', () => {
  it('只接受 Web 生成的严格配对载荷', () => {
    expect(parseMobilePairingQrPayload(payload)).toEqual(JSON.parse(payload));
  });

  it.each([
    '',
    'https://example.test/login',
    JSON.stringify({ kind: 'axi-web-login-v1', webLoginId: 'weblogin_1234567890abcdef', scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345' }),
    JSON.stringify({ kind: 'axi-mobile-pair-v1', webPairingId: 'webpair_short', scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345' }),
    JSON.stringify({ kind: 'axi-mobile-pair-v1', webPairingId: 'webpair_1234567890abcdef', scanToken: 'short' }),
    JSON.stringify({ kind: 'axi-mobile-pair-v1', webPairingId: 'webpair_1234567890abcdef', scanToken: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345', extra: 'nope' }),
  ])('拒绝非手机配对载荷：%s', (value) => {
    expect(() => parseMobilePairingQrPayload(value)).toThrow();
  });
});
