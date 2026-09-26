import { describe, expect, it } from 'vitest';
import {
  GENERATED_USERNAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  generateUsername,
  isValidUsername,
  resolveUsername,
  usernameLength,
} from '@axi/workbench-foundation';

describe('username identity rules', () => {
  it('generates a compact stable username for a long Outlook or iCloud prefix', () => {
    const email = 'alexandria.long.lastname@outlook.com';
    const first = generateUsername(email, 'subject-1');
    const second = generateUsername(email, 'subject-1');

    expect(first).toBe(second);
    expect(usernameLength(first)).toBeLessThanOrEqual(GENERATED_USERNAME_MAX_LENGTH);
    expect(first).not.toContain('@');
    expect(first).not.toContain('outlook');
  });

  it('keeps ordinary email prefixes readable and removes plus tags', () => {
    expect(generateUsername('Alice.Wang+work@icloud.com', 'subject-2')).toBe('alice.wang');
  });

  it('adds a stable fallback for a prefix shorter than the minimum', () => {
    const username = generateUsername('a@icloud.com', 'subject-3');

    expect(usernameLength(username)).toBeGreaterThanOrEqual(3);
    expect(usernameLength(username)).toBeLessThanOrEqual(GENERATED_USERNAME_MAX_LENGTH);
    expect(isValidUsername(username)).toBe(true);
  });

  it('rejects invalid or overlong user-edited usernames', () => {
    expect(isValidUsername('a')).toBe(false);
    expect(isValidUsername('a username')).toBe(false);
    expect(isValidUsername('a'.repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
    expect(isValidUsername('axi_user-01')).toBe(true);
  });

  it('does not allow an email address or an overlong upstream name to become the username', () => {
    expect(resolveUsername({ candidate: 'person@icloud.com', email: 'person@icloud.com', subject: 'subject-4' })).toBe('person');
    expect(usernameLength(resolveUsername({ candidate: 'a'.repeat(40), email: 'short@icloud.com', subject: 'subject-5' }))).toBeLessThanOrEqual(GENERATED_USERNAME_MAX_LENGTH);
  });
});
