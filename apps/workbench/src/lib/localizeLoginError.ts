/**
 * Gateway and identity-adapter errors are English internals. The login banner
 * is a user-facing surface, so map those strings onto i18n copy instead of
 * rendering them raw (which also made short vs wrapped banners jump).
 */
export function localizeLoginError(message: string, t: (key: string) => string): string {
  const text = message.trim();
  if (!text) return t('auth.login.requestFailed');
  const lower = text.toLowerCase();

  if (
    lower.includes('temporarily unavailable')
    || lower.includes('identity service')
    || lower.includes('identity persistence')
    || lower.includes('session store unavailable')
  ) {
    return t('auth.login.identityUnavailable');
  }

  if (
    lower.includes('invalid password')
    || lower.includes('incorrect password')
    || lower.includes('invalid credentials')
    || lower.includes('unauthorized')
    || lower.includes('user not found')
  ) {
    return t('auth.login.invalidCredentials');
  }

  if (/发送验证码失败/.test(text)) return t('auth.login.sendFailed');

  if (
    lower === 'not found'
    || lower.includes('not found')
    || lower.includes('requested resource was not found')
    || /\b404\b/.test(lower)
  ) {
    return t('auth.login.requestFailed');
  }

  // Remaining ASCII/service errors must not leak onto a zh-CN banner.
  if (!/[\u3400-\u9fff]/.test(text)) {
    return t('auth.login.requestFailed');
  }

  return text;
}
