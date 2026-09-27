import { afterEach, describe, expect, it } from 'vitest';
import {
  LAST_ACCOUNT_STORAGE_KEY,
  accountInitial,
  clearLastAccount,
  maskEmail,
  readLastAccount,
  writeLastAccount,
} from './lastAccount';

afterEach(() => {
  window.localStorage.clear();
});

describe('lastAccount', () => {
  it('masks the email local part', () => {
    expect(maskEmail('owner@qq.com')).toBe('ow***@qq.com');
  });

  it('stores and expires the last account snapshot', () => {
    const now = Date.parse('2026-09-12T00:00:00.000Z');
    writeLastAccount({ subject: 'owner-subject', name: 'Owner', email: 'owner@qq.com' }, now);
    expect(readLastAccount(now + 1000)?.name).toBe('Owner');
    expect(readLastAccount(now + 11 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(window.localStorage.getItem(LAST_ACCOUNT_STORAGE_KEY)).toBeNull();
  });

  it('uses the first character as the avatar initial', () => {
    expect(accountInitial({
      subject: 'x',
      name: '公理',
      email: 'a@b.c',
      emailMasked: 'a***@b.c',
      expiresAt: 1,
    })).toBe('公');
  });

  it('normalizes a long or email-shaped account name before storing it', () => {
    const account = writeLastAccount({
      subject: 'owner-subject',
      name: 'a'.repeat(40),
      email: 'alexandria.long.lastname@icloud.com',
    });

    expect(account.name).toHaveLength(12);
    expect(account.name).not.toContain('@');
  });

  it('clears the snapshot', () => {
    writeLastAccount({ subject: 'owner-subject', name: 'Owner', email: 'owner@qq.com' });
    clearLastAccount();
    expect(readLastAccount()).toBeNull();
  });
});
