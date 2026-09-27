import { describe, expect, it } from 'vitest';
import {
  EMAIL_LOCAL_PART_MAX_LENGTH,
  isValidEmailLocalPart,
  normalizeEmailLocalPart,
} from './emailValidation';

describe('email local-part validation', () => {
  it('extracts the editable prefix when a full address is pasted', () => {
    expect(normalizeEmailLocalPart('  Alice.Smith@example.com  ')).toBe('Alice.Smith');
  });

  it('accepts common mailbox prefixes', () => {
    for (const value of ['a', 'alice123', 'alice.smith', 'alice_smith', 'alice-smith']) {
      expect(isValidEmailLocalPart(value)).toBe(true);
    }
  });

  it('rejects special characters and invalid dot boundaries', () => {
    for (const value of ['', 'alice+tag', 'alice!smith', 'alice smith', '.alice', 'alice.', 'alice..smith']) {
      expect(isValidEmailLocalPart(value)).toBe(false);
    }
  });

  it('enforces the mailbox local-part length limit', () => {
    expect(isValidEmailLocalPart('a'.repeat(EMAIL_LOCAL_PART_MAX_LENGTH))).toBe(true);
    expect(isValidEmailLocalPart('a'.repeat(EMAIL_LOCAL_PART_MAX_LENGTH + 1))).toBe(false);
  });
});
