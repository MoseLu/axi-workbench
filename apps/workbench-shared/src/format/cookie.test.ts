import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  deleteCookie,
  readAllCookies,
  readCookie,
  useCookie,
  writeCookie,
} from './cookie';

afterEach(() => {
  // Clear all cookies
  document.cookie.split('; ').forEach((c) => {
    const eq = c.indexOf('=');
    if (eq > -1) {
      const k = c.slice(0, eq);
      document.cookie = `${k}=; max-age=0; path=/`;
    }
  });
});

describe('@axi/workbench-shared/format/cookie', () => {
  describe('readCookie', () => {
    it('returns null when cookie is missing', () => {
      expect(readCookie('missing')).toBeNull();
    });

    it('returns value when cookie is set', () => {
      writeCookie('token', 'abc123');
      expect(readCookie('token')).toBe('abc123');
    });

    it('decodes URI-encoded values', () => {
      writeCookie('greeting', 'hello world');
      expect(readCookie('greeting')).toBe('hello world');
    });
  });

  describe('writeCookie', () => {
    it('sets a cookie that can be read back', () => {
      writeCookie('k1', 'v1', { maxAge: 3600 });
      expect(readCookie('k1')).toBe('v1');
    });

    it('returns false in SSR (typeof document === "undefined")', () => {
      const original = globalThis.document;
      delete (globalThis as { document?: unknown }).document;
      expect(writeCookie('k', 'v')).toBe(false);
      // restore
      (globalThis as { document?: unknown }).document = original;
    });
  });

  describe('deleteCookie', () => {
    it('removes an existing cookie', () => {
      writeCookie('temp', 'x');
      expect(readCookie('temp')).toBe('x');
      deleteCookie('temp');
      expect(readCookie('temp')).toBeNull();
    });
  });

  describe('readAllCookies', () => {
    it('parses all cookies into a record', () => {
      writeCookie('a', '1');
      writeCookie('b', '2');
      expect(readAllCookies()).toMatchObject({ a: '1', b: '2' });
    });
  });

  describe('useCookie', () => {
    it('returns default value when no cookie exists', () => {
      const { result } = renderHook(() => useCookie('theme', 'light'));
      expect(result.current[0]).toBe('light');
    });

    it('reads existing cookie value on mount', () => {
      writeCookie('theme', 'dark');
      const { result } = renderHook(() => useCookie('theme', 'light'));
      expect(result.current[0]).toBe('dark');
    });

    it('updater writes and reflects value', () => {
      const { result } = renderHook(() => useCookie('lang', 'en'));
      act(() => {
        result.current[1]('zh');
      });
      expect(result.current[0]).toBe('zh');
      expect(readCookie('lang')).toBe('zh');
    });
  });
});