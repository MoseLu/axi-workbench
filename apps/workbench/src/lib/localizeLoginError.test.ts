import { describe, expect, it } from 'vitest';
import { localizeLoginError } from './localizeLoginError';

const copy: Record<string, string> = {
  'auth.login.identityUnavailable': '身份服务暂时不可用，请稍后重试',
  'auth.login.invalidCredentials': '邮箱或密码不正确',
  'auth.login.requestFailed': '登录失败，请稍后重试',
  'auth.login.sendFailed': '无法发送验证码',
};

function t(key: string): string {
  return copy[key] ?? key;
}

describe('localizeLoginError', () => {
  it('maps identity-adapter unavailability', () => {
    expect(localizeLoginError('identity service temporarily unavailable', t)).toBe(copy['auth.login.identityUnavailable']);
    expect(localizeLoginError('identity persistence unavailable', t)).toBe(copy['auth.login.identityUnavailable']);
  });

  it('maps gateway Not Found instead of leaking English', () => {
    expect(localizeLoginError('Not Found', t)).toBe(copy['auth.login.requestFailed']);
    expect(localizeLoginError('The requested resource was not found', t)).toBe(copy['auth.login.requestFailed']);
  });

  it('maps credential failures', () => {
    expect(localizeLoginError('user not found', t)).toBe(copy['auth.login.invalidCredentials']);
    expect(localizeLoginError('unauthorized', t)).toBe(copy['auth.login.invalidCredentials']);
  });

  it('keeps already-localized Chinese copy', () => {
    expect(localizeLoginError('密码登录失败，请检查邮箱和密码。', t)).toBe('密码登录失败，请检查邮箱和密码。');
  });

  it('maps leftover ASCII service errors', () => {
    expect(localizeLoginError('Internal Server Error', t)).toBe(copy['auth.login.requestFailed']);
    expect(localizeLoginError('', t)).toBe(copy['auth.login.requestFailed']);
  });
});
