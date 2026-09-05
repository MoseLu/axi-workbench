export const ONE_TIME_CODE_LENGTH = 6;

export type OneTimeCode = string[];

function digit(value: string | undefined): string {
  return value?.match(/\d/)?.[0] ?? '';
}

export function createOneTimeCode(): OneTimeCode {
  return Array.from({ length: ONE_TIME_CODE_LENGTH }, () => '');
}

/** Normalizes legacy string state as well, so a Vite hot update cannot break an in-progress code entry. */
export function toOneTimeCodeSlots(value: readonly string[] | string): OneTimeCode {
  if (typeof value === 'string') {
    const digits = value.replace(/\D/g, '').slice(0, ONE_TIME_CODE_LENGTH);
    return Array.from({ length: ONE_TIME_CODE_LENGTH }, (_, index) => digits[index] ?? '');
  }

  return Array.from({ length: ONE_TIME_CODE_LENGTH }, (_, index) => digit(value[index]));
}

export function insertOneTimeCodeDigits(
  value: readonly string[] | string,
  startIndex: number,
  rawValue: string,
): { value: OneTimeCode; focusIndex: number; inserted: boolean } {
  const next = toOneTimeCodeSlots(value);
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return { value: next, focusIndex: startIndex, inserted: false };

  const index = Math.max(0, Math.min(startIndex, ONE_TIME_CODE_LENGTH - 1));
  for (let offset = 0; offset < digits.length && index + offset < ONE_TIME_CODE_LENGTH; offset += 1) {
    next[index + offset] = digits[offset]!;
  }

  return {
    value: next,
    focusIndex: Math.min(index + digits.length, ONE_TIME_CODE_LENGTH - 1),
    inserted: true,
  };
}

export function clearOneTimeCodeSlot(value: readonly string[] | string, index: number): OneTimeCode {
  const next = toOneTimeCodeSlots(value);
  if (index >= 0 && index < ONE_TIME_CODE_LENGTH) next[index] = '';
  return next;
}

export function oneTimeCodeValue(value: readonly string[] | string): string {
  return toOneTimeCodeSlots(value).join('');
}
