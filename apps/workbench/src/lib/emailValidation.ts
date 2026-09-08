/**
 * The login surface edits the local part separately from a controlled domain
 * suffix. Keep this deliberately narrower than the full RFC mailbox grammar:
 * the configured providers use the common unquoted form only.
 */
export const EMAIL_LOCAL_PART_PATTERN = /^[A-Za-z0-9](?:(?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9]))*[A-Za-z0-9])?$/;
export const EMAIL_LOCAL_PART_MAX_LENGTH = 64;

export function normalizeEmailLocalPart(value: string): string {
  return value.split('@', 1)[0].trim();
}

export function isValidEmailLocalPart(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0
    && normalized.length <= EMAIL_LOCAL_PART_MAX_LENGTH
    && EMAIL_LOCAL_PART_PATTERN.test(normalized);
}
