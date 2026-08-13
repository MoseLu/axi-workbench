import { resolveGatewayURL } from '@axi/workbench-foundation';

export type MobilePairingApproval = {
  ok: true;
  status: 'approved';
  deviceName?: string;
};

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
