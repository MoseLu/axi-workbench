import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadProfile, profileFallbackFromIdentity } from './profileStore';

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
});
