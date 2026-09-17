export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;
export const GENERATED_USERNAME_MAX_LENGTH = 12;

const USERNAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?$/u;
const USERNAME_SEPARATOR_PATTERN = /[._-]{2,}/u;

export type UsernameIdentity = {
  candidate?: string | null;
  email?: string | null;
  subject?: string | null;
};

/** Counts Unicode code points instead of UTF-16 code units. */
export function usernameLength(value: string): number {
  return Array.from(value).length;
}

/** Validates the public username used in compact Workbench surfaces. */
export function isValidUsername(value: string): boolean {
  const normalized = value.normalize('NFKC').trim();
  const length = usernameLength(normalized);
  return length >= USERNAME_MIN_LENGTH
    && length <= USERNAME_MAX_LENGTH
    && USERNAME_PATTERN.test(normalized)
    && !USERNAME_SEPARATOR_PATTERN.test(normalized);
}

function stableSuffix(seed: string): string {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(-3).padStart(3, '0');
}

function emailLocalPart(email: string): string {
  const localPart = email.trim().split('@', 1)[0] || '';
  const withoutTag = localPart.split('+', 1)[0] || '';
  return withoutTag
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, '')
    .replace(/[._-]{2,}/gu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '');
}

/**
 * Generates a compact default username from an email identity.
 * Long prefixes use a stable suffix so truncation cannot silently make
 * multiple accounts look identical across the home page and login card.
 */
export function generateUsername(email = '', subject = ''): string {
  const base = emailLocalPart(email);
  const suffix = stableSuffix(subject.trim() || email.trim() || 'axi-user');
  const baseLength = usernameLength(base);

  if (baseLength >= USERNAME_MIN_LENGTH && baseLength <= GENERATED_USERNAME_MAX_LENGTH) {
    return base;
  }
  if (baseLength > GENERATED_USERNAME_MAX_LENGTH) {
    return `${Array.from(base).slice(0, 8).join('')}-${suffix}`;
  }
  return `${base || 'axi'}-${suffix}`.slice(0, GENERATED_USERNAME_MAX_LENGTH);
}

/** Keeps an upstream identity name only when it already satisfies username rules. */
export function resolveUsername(identity: UsernameIdentity): string {
  const candidate = identity.candidate?.normalize('NFKC').trim() || '';
  return isValidUsername(candidate)
    ? candidate
    : generateUsername(identity.email || '', identity.subject || '');
}
