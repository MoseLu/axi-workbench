export type WebLoginQrPayload = Readonly<{
  kind: 'axi-web-login-v1';
  webLoginId: string;
  scanToken: string;
}>;

const WEB_LOGIN_ID_PATTERN = /^weblogin_[A-Za-z0-9_-]{16,}$/;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const WEB_LOGIN_QR_FIELDS = new Set(['kind', 'webLoginId', 'scanToken']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accept only the short-lived, browser-safe QR JSON emitted by the Web client.
 * The browser poll token and cookies are deliberately absent from this payload.
 */
export function parseWebLoginQrPayload(rawValue: string): WebLoginQrPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('Invalid web login QR payload');
  }

  if (
    !isRecord(parsed)
    || Object.keys(parsed).some((key) => !WEB_LOGIN_QR_FIELDS.has(key))
    || parsed.kind !== 'axi-web-login-v1'
    || typeof parsed.webLoginId !== 'string'
    || typeof parsed.scanToken !== 'string'
    || !WEB_LOGIN_ID_PATTERN.test(parsed.webLoginId)
    || !OPAQUE_TOKEN_PATTERN.test(parsed.scanToken)
  ) {
    throw new Error('Invalid web login QR payload');
  }

  return {
    kind: 'axi-web-login-v1',
    webLoginId: parsed.webLoginId,
    scanToken: parsed.scanToken,
  };
}
