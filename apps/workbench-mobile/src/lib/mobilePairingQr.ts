export type MobilePairingQrPayload = Readonly<{
  kind: 'axi-mobile-pair-v1';
  webPairingId: string;
  scanToken: string;
}>;

const webPairingIdPattern = /^webpair_[A-Za-z0-9_-]{16,}$/;
const scanTokenPattern = /^[A-Za-z0-9_-]{32,}$/;

/**
 * The Web client serializes only this short-lived, one-time pairing bearer into
 * the QR image. It is deliberately parsed as JSON rather than accepting URLs
 * or arbitrary query strings, so a QR from another flow cannot be submitted to
 * the mobile pairing endpoint by accident.
 */
export function parseMobilePairingQrPayload(rawValue: string): MobilePairingQrPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(rawValue.trim());
  } catch {
    throw new Error('二维码内容不是有效的手机配对请求');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('二维码内容不是有效的手机配对请求');
  }
  const record = payload as Record<string, unknown>;
  if (
    record.kind !== 'axi-mobile-pair-v1'
    || typeof record.webPairingId !== 'string'
    || !webPairingIdPattern.test(record.webPairingId)
    || typeof record.scanToken !== 'string'
    || !scanTokenPattern.test(record.scanToken)
    || Object.keys(record).some((key) => !['kind', 'webPairingId', 'scanToken'].includes(key))
  ) {
    throw new Error('二维码内容不是有效的手机配对请求');
  }
  return {
    kind: 'axi-mobile-pair-v1',
    webPairingId: record.webPairingId,
    scanToken: record.scanToken,
  };
}
