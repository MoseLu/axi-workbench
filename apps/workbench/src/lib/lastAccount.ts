import { resolveUsername } from '@axi/workbench-foundation';

export const LAST_ACCOUNT_STORAGE_KEY = 'axi.login.lastAccount';
export const LOGIN_DEVICE_ID_STORAGE_KEY = 'axi.login.deviceId';
export const LAST_ACCOUNT_TTL_MS = 10 * 24 * 60 * 60 * 1000;

export type LastAccount = {
  subject: string;
  name: string;
  email: string;
  emailMasked: string;
  expiresAt: number;
};

function randomDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(LOGIN_DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const created = randomDeviceId();
  window.localStorage.setItem(LOGIN_DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(6, local.length - 2))}@${domain}`;
}

export function readLastAccount(now = Date.now()): LastAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastAccount>;
    if (!parsed.subject || !parsed.name || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt <= now) {
      window.localStorage.removeItem(LAST_ACCOUNT_STORAGE_KEY);
      return null;
    }
    return {
      subject: String(parsed.subject),
      name: resolveUsername({
        candidate: String(parsed.name),
        email: String(parsed.email || ''),
        subject: String(parsed.subject),
      }),
      email: String(parsed.email || ''),
      emailMasked: String(parsed.emailMasked || maskEmail(String(parsed.email || ''))),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function writeLastAccount(input: { subject: string; name: string; email?: string }, now = Date.now()): LastAccount {
  const email = input.email?.trim() || '';
  const account: LastAccount = {
    subject: input.subject,
    name: resolveUsername({ candidate: input.name, email, subject: input.subject }),
    email,
    emailMasked: maskEmail(email),
    expiresAt: now + LAST_ACCOUNT_TTL_MS,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  }
  return account;
}

export function clearLastAccount(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LAST_ACCOUNT_STORAGE_KEY);
}

export function accountInitial(account: LastAccount): string {
  const source = account.name.trim() || account.email.trim() || account.subject;
  return source.slice(0, 1).toUpperCase() || 'A';
}
