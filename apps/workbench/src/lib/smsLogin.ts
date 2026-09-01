import { resolveGatewayURL } from '@axi/workbench-foundation';

export type SmsLoginChallenge = {
  challengeId: string;
  expiresAt: string;
};

type JsonRecord = Record<string, unknown>;

const SMS_PHONE_PATTERN = /^1[3-9]\d{9}$/;

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

/** Keep the first SMS surface limited to mainland China mobile numbers. */
export function normalizeSmsPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function isValidSmsPhone(value: string): boolean {
  return SMS_PHONE_PATTERN.test(normalizeSmsPhone(value));
}

/**
 * Browser-side adapter for the future Gateway SMS challenge contract.
 * The current Gateway does not expose these routes yet; its response is
 * surfaced as a configuration error instead of falling back to email.
 */
export async function requestSmsCode(phone: string, fetcher: typeof fetch = fetch): Promise<SmsLoginChallenge> {
  const normalizedPhone = normalizeSmsPhone(phone);
  if (!isValidSmsPhone(normalizedPhone)) throw new Error('请输入有效的手机号');

  const response = await fetcher(resolveGatewayURL('/api/v1/auth/sms-verifications'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: '+86', phone: normalizedPhone, purpose: 'login' }),
  });
  const payload = await jsonPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload, '短信登录服务暂未配置'));
  if (typeof payload.challengeId !== 'string' || !payload.challengeId.trim()) {
    throw new Error('短信验证码挑战未创建，请稍后重试');
  }
  return {
    challengeId: payload.challengeId,
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : '',
  };
}

export async function confirmSmsCode(
  challengeId: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<{ authenticated: true }> {
  const challenge = challengeId.trim();
  const trimmedToken = token.trim();
  if (!challenge || !/^\d{6}$/.test(trimmedToken)) throw new Error('请输入有效的验证码');

  const response = await fetcher(resolveGatewayURL('/api/v1/auth/login/sms/confirm'), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: challenge, token: trimmedToken }),
  });
  const payload = await jsonPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload, '短信验证码无效或已过期'));
  if (payload.authenticated !== true) throw new Error('短信登录未建立会话');
  return { authenticated: true };
}
