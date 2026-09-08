import { describe, expect, it } from 'vitest';
import {
  clearOneTimeCodeSlot,
  createOneTimeCode,
  insertOneTimeCodeDigits,
  oneTimeCodeValue,
  toOneTimeCodeSlots,
} from './oneTimeCode';

describe('one-time code slots', () => {
  it('keeps six independent slots while normalizing legacy string state', () => {
    expect(createOneTimeCode()).toEqual(['', '', '', '', '', '']);
    expect(toOneTimeCodeSlots('1a234567')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('distributes pasted digits from the selected slot and ignores non-digits', () => {
    const result = insertOneTimeCodeDigits(['', '', '', '', '', ''], 1, '2a34567');

    expect(result).toEqual({
      value: ['', '2', '3', '4', '5', '6'],
      focusIndex: 5,
      inserted: true,
    });
  });

  it('clears only the requested slot and produces the submission value', () => {
    const remaining = clearOneTimeCodeSlot(['1', '2', '3', '4', '5', '6'], 3);

    expect(remaining).toEqual(['1', '2', '3', '', '5', '6']);
    expect(oneTimeCodeValue(remaining)).toBe('12356');
  });
});
