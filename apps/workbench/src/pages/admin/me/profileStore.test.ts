import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_AVATAR_SRC,
  loadProfile,
  profileFallbackFromIdentity,
  resolveAvatarSrc,
} from './profileStore';

const profileStorageKey = 'wb_user_profile_v1';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }

  clear() { this.values.clear(); }

  getItem(key: string) { return this.values.get(key) ?? null; }

  key(index: number) { return [...this.values.keys()][index] ?? null; }

  removeItem(key: string) { this.values.delete(key); }

  setItem(key: string, value: string) { this.values.set(key, value); }
}

const originalStorage = globalThis.localStorage;

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: originalStorage,
  });
});

describe('profileStore', () => {
  it('uses the authenticated identity for a profile with no local customization', () => {
    expect(profileFallbackFromIdentity({
      email: 'member@example.com',
      id: 'member-1',
      name: '成员甲',
      status: 'active',
    })).toMatchObject({
      email: 'member@example.com',
      nickname: '成员甲',
      status: '正常',
    });

    expect(loadProfile({
      email: 'member@example.com',
      id: 'member-1',
      name: '成员甲',
      status: 'active',
    })).toMatchObject({
      email: 'member@example.com',
      nickname: '成员甲',
      status: '正常',
    });
  });

  it('migrates the retired demo profile to the authenticated identity', () => {
    localStorage.setItem(profileStorageKey, JSON.stringify({
      email: 'zhangsan@workbench.dev',
      nickname: '张三',
      status: '正常',
    }));

    expect(loadProfile({
      email: 'member@example.com',
      id: 'member-1',
      name: '成员甲',
      status: 'active',
    })).toMatchObject({
      email: 'member@example.com',
      nickname: '成员甲',
      status: '正常',
    });
  });

  it('does not keep an email-shaped or overlong username in the profile', () => {
    localStorage.setItem(profileStorageKey, JSON.stringify({
      nickname: 'alexandria.long.lastname@outlook.com',
    }));

    const profile = loadProfile({
      email: 'alexandria.long.lastname@outlook.com',
      id: 'member-1',
      name: 'alexandria.long.lastname@outlook.com',
      status: 'active',
    });

    expect(profile.nickname).not.toContain('@');
    expect(Array.from(profile.nickname)).toHaveLength(12);
  });

  it('prefers the server identity over a stale local username', () => {
    localStorage.setItem(profileStorageKey, JSON.stringify({
      nickname: 'old-local-name',
    }));

    expect(loadProfile({
      email: 'member@example.com',
      id: 'member-1',
      name: 'server-name',
      status: 'active',
    }).nickname).toBe('server-name');
  });

  it('falls back to the product default avatar when no custom image is set', () => {
    expect(DEFAULT_AVATAR_SRC).toBeTruthy();
    expect(resolveAvatarSrc('')).toBe(DEFAULT_AVATAR_SRC);
    expect(resolveAvatarSrc(null)).toBe(DEFAULT_AVATAR_SRC);
    expect(resolveAvatarSrc('   ')).toBe(DEFAULT_AVATAR_SRC);
    expect(resolveAvatarSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });
});
