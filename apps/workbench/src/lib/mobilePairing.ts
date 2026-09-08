import { resolveGatewayURL } from '@axi/workbench-foundation';

export type MobilePairingApproval = {
  ok: true;
  status: 'approved';
  deviceName?: string;
};

/**
 * A short-lived QR transaction is created by the authenticated Web owner.
 * The scan bearer is deliberately returned only at creation time: it is QR
 * content for the phone camera, never a value that the status API returns.
 */
export type MobilePairingQr = {
  webPairingId: string;
  scanToken: string;
  expiresAt: number;
};

export type MobilePairingQrStatus = {
  status: 'waiting_scan' | 'scanned' | 'approved' | 'expired';
  expiresAt: number;
  deviceName?: string;
};

const WEB_PAIRING_ID_PATTERN = /^webpair_[A-Za-z0-9_-]{16,}$/;
const SCAN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const QR_STATUSES = new Set<MobilePairingQrStatus['status']>([
  'waiting_scan',
  'scanned',
  'approved',
  'expired',
]);

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function errorMessage(payload: JsonRecord, fallback: string): string {
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
}

function assertWebPairingId(webPairingId: string): void {
  if (!WEB_PAIRING_ID_PATTERN.test(webPairingId)) throw new Error('二维码配对请求无效');
}

function parseQrTransaction(payload: JsonRecord): MobilePairingQr {
  const { webPairingId, scanToken, expiresAt } = payload;
  if (
    typeof webPairingId !== 'string'
    || !WEB_PAIRING_ID_PATTERN.test(webPairingId)
    || typeof scanToken !== 'string'
    || !SCAN_TOKEN_PATTERN.test(scanToken)
    || typeof expiresAt !== 'number'
    || !Number.isFinite(expiresAt)
  ) {
    throw new Error('服务端返回的二维码配对请求无效');
  }
  return { webPairingId, scanToken, expiresAt };
}

function parseQrStatus(payload: JsonRecord): MobilePairingQrStatus {
  const { status, expiresAt, deviceName } = payload;
  if (
    typeof status !== 'string'
    || !QR_STATUSES.has(status as MobilePairingQrStatus['status'])
    || typeof expiresAt !== 'number'
    || !Number.isFinite(expiresAt)
    || (deviceName !== undefined && typeof deviceName !== 'string')
  ) {
    throw new Error('服务端返回的二维码配对状态无效');
  }
  return {
    status: status as MobilePairingQrStatus['status'],
    expiresAt,
    ...(typeof deviceName === 'string' && deviceName.trim() ? { deviceName } : {}),
  };
}

async function jsonPayload(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => ({}));
  return isJsonRecord(payload) ? payload : {};
}

export function normalizeMobilePairingCode(value: string): string | null {
  const normalized = value.replace(/\D/g, '');
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

/** Approves a phone-originated pairing through the authenticated Web gateway boundary. */
export async function approveMobilePairing(
  value: string,
  fetcher: typeof fetch = fetch,
): Promise<MobilePairingApproval> {
  const code = normalizeMobilePairingCode(value);
  if (!code) throw new Error('配对码必须是 6 位数字');

  const response = await fetcher(resolveGatewayURL('/api/v1/control-plane/mobile/pair/approve'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; ok?: boolean; status?: string; deviceName?: string };
  if (!response.ok || payload.ok !== true || payload.status !== 'approved') {
    throw new Error(payload.error || '设备配对未获批准');
  }
  return { ok: true, status: 'approved', deviceName: payload.deviceName };
}

/** Starts a one-time, Web-owner-bound QR pairing transaction. */
export async function createMobilePairingQr(fetcher: typeof fetch = fetch): Promise<MobilePairingQr> {
  const response = await fetcher(resolveGatewayURL('/api/v1/control-plane/mobile/pair/qr'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = await jsonPayload(response);
  if (!response.ok || payload.ok !== true) throw new Error(errorMessage(payload, '无法生成手机配对二维码'));
  return parseQrTransaction(payload);
}

/** QR camera payload; it contains no browser session or server-side owner secret. */
export function mobilePairingQrPayload(pairing: MobilePairingQr): string {
  assertWebPairingId(pairing.webPairingId);
  if (!SCAN_TOKEN_PATTERN.test(pairing.scanToken)) throw new Error('二维码配对请求无效');
  return JSON.stringify({
    kind: 'axi-mobile-pair-v1',
    webPairingId: pairing.webPairingId,
    scanToken: pairing.scanToken,
  });
}

/** Reads owner-visible state only; the server never echoes the scan bearer. */
export async function getMobilePairingQrStatus(
  webPairingId: string,
  fetcher: typeof fetch = fetch,
): Promise<MobilePairingQrStatus> {
  assertWebPairingId(webPairingId);
  const response = await fetcher(resolveGatewayURL(`/api/v1/control-plane/mobile/pair/qr/${webPairingId}`), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const payload = await jsonPayload(response);
  if (!response.ok || payload.ok !== true) throw new Error(errorMessage(payload, '无法读取手机配对状态'));
  return parseQrStatus(payload);
}

/** The Web owner makes the final approval decision after the phone has scanned. */
export async function approveMobilePairingQr(
  webPairingId: string,
  fetcher: typeof fetch = fetch,
): Promise<Pick<MobilePairingQrStatus, 'status' | 'deviceName'>> {
  assertWebPairingId(webPairingId);
  const response = await fetcher(resolveGatewayURL(`/api/v1/control-plane/mobile/pair/qr/${webPairingId}/approve`), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = await jsonPayload(response);
  if (!response.ok || payload.ok !== true || payload.status !== 'approved') {
    throw new Error(errorMessage(payload, '无法确认手机配对'));
  }
  return {
    status: 'approved',
    ...(typeof payload.deviceName === 'string' && payload.deviceName.trim() ? { deviceName: payload.deviceName } : {}),
  };
}
