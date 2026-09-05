import { resolveGatewayURL } from '@axi/workbench-foundation';

export type WebDeviceLoginQr = {
  webLoginId: string;
  scanToken: string;
  pollToken: string;
  expiresAt: number;
};

export type WebDeviceLoginQrStatus = {
  status: 'waiting_scan' | 'approved' | 'expired' | 'consumed';
  expiresAt: number;
};

const WEB_LOGIN_ID_PATTERN = /^weblogin_[A-Za-z0-9_-]{16,}$/;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const QR_STATUSES = new Set<WebDeviceLoginQrStatus['status']>([
  'waiting_scan',
  'approved',
  'expired',
  'consumed',
]);

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

async function jsonPayload(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => ({}));
  return isJsonRecord(payload) ? payload : {};
}

function errorMessage(payload: JsonRecord, fallback: string): string {
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
}

function assertTransaction(transaction: WebDeviceLoginQr): void {
  if (
    !WEB_LOGIN_ID_PATTERN.test(transaction.webLoginId)
    || !OPAQUE_TOKEN_PATTERN.test(transaction.scanToken)
    || !OPAQUE_TOKEN_PATTERN.test(transaction.pollToken)
    || !Number.isFinite(transaction.expiresAt)
  ) {
    throw new Error('电脑登录二维码无效');
  }
}

function parseTransaction(payload: JsonRecord): WebDeviceLoginQr {
  const { webLoginId, scanToken, pollToken, expiresAt } = payload;
  if (
    typeof webLoginId !== 'string'
    || typeof scanToken !== 'string'
    || typeof pollToken !== 'string'
    || typeof expiresAt !== 'number'
  ) {
    throw new Error('服务端返回的电脑登录二维码无效');
  }
  const parsed: WebDeviceLoginQr = { webLoginId, scanToken, pollToken, expiresAt };
  assertTransaction(parsed);
  return parsed;
}

function parseStatus(payload: JsonRecord): WebDeviceLoginQrStatus {
  if (
    typeof payload.status !== 'string'
    || !QR_STATUSES.has(payload.status as WebDeviceLoginQrStatus['status'])
    || typeof payload.expiresAt !== 'number'
    || !Number.isFinite(payload.expiresAt)
  ) {
    throw new Error('服务端返回的电脑登录二维码状态无效');
  }
  return {
    status: payload.status as WebDeviceLoginQrStatus['status'],
    expiresAt: payload.expiresAt,
  };
}

/** Creates an anonymous browser transaction. The returned poll token stays in
 * component memory; it is deliberately absent from the camera QR payload. */
export async function createWebDeviceLoginQr(fetcher: typeof fetch = fetch): Promise<WebDeviceLoginQr> {
  const response = await fetcher(resolveGatewayURL('/api/v1/auth/device-login/qr'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = await jsonPayload(response);
  if (!response.ok || payload.ok !== true) throw new Error(errorMessage(payload, '无法生成电脑登录二维码'));
  return parseTransaction(payload);
}

/** The phone receives only a short-lived scan bearer, never the browser poll bearer or cookie. */
export function webDeviceLoginQrPayload(transaction: WebDeviceLoginQr): string {
  assertTransaction(transaction);
  return JSON.stringify({
    kind: 'axi-web-login-v1',
    webLoginId: transaction.webLoginId,
    scanToken: transaction.scanToken,
  });
}

export async function getWebDeviceLoginQrStatus(
  transaction: WebDeviceLoginQr,
  fetcher: typeof fetch = fetch,
): Promise<WebDeviceLoginQrStatus> {
  assertTransaction(transaction);
  const response = await fetcher(resolveGatewayURL(`/api/v1/auth/device-login/qr/${transaction.webLoginId}`), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-Axi-QR-Poll-Token': transaction.pollToken },
  });
  const payload = await jsonPayload(response);
  if (!response.ok || payload.ok !== true) throw new Error(errorMessage(payload, '无法读取电脑登录二维码状态'));
  return parseStatus(payload);
}

/** Converts a Control Plane approval into a first-party HttpOnly gateway cookie. */
export async function consumeWebDeviceLoginQr(
  transaction: WebDeviceLoginQr,
  fetcher: typeof fetch = fetch,
): Promise<{ authenticated: true }> {
  assertTransaction(transaction);
  const response = await fetcher(resolveGatewayURL(`/api/v1/auth/device-login/qr/${transaction.webLoginId}/consume`), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Axi-QR-Poll-Token': transaction.pollToken },
    body: '{}',
  });
  const payload = await jsonPayload(response);
  if (!response.ok || payload.authenticated !== true) throw new Error(errorMessage(payload, '电脑登录二维码未获批准'));
  return { authenticated: true };
}
