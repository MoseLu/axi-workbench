import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  get,
  invertObject,
  mapKeys,
  mapValues,
  omit,
  omitBy,
  pick,
  pickBy,
  safeUseLocalStorage,
  set,
} from './object';

describe('@axi/workbench-shared/format/object', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  describe('pick', () => {
    it('returns a new object with only the picked keys', () => {
      expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('skips keys not present in the source', () => {
      expect(pick({ a: 1 }, ['a', 'x'] as ('a' | 'x')[])).toEqual({ a: 1 });
    });

    it('does not mutate the input object', () => {
      const input = { a: 1, b: 2 };
      pick(input, ['a']);
      expect(input).toEqual({ a: 1, b: 2 });
    });
  });

  describe('omit', () => {
    it('returns a new object without the omitted keys', () => {
      expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
    });

    it('does not mutate the input', () => {
      const input = { a: 1, b: 2 };
      omit(input, ['a']);
      expect(input).toEqual({ a: 1, b: 2 });
    });
  });

  describe('set', () => {
    it('sets a top-level key', () => {
      expect(set({ a: 1 }, ['b'], 2)).toEqual({ a: 1, b: 2 });
    });

    it('creates nested path', () => {
      expect(set({} as Record<string, unknown>, ['a', 'b', 'c'], 1)).toEqual({
        a: { b: { c: 1 } },
      });
    });

    it('preserves other keys at the same level', () => {
      expect(set({ a: { b: 1, d: 2 } }, ['a', 'c'], 3)).toEqual({
        a: { b: 1, c: 3, d: 2 },
      });
    });
  });

  describe('get', () => {
    it('returns the nested value', () => {
      expect(get({ a: { b: { c: 1 } } }, ['a', 'b', 'c'])).toBe(1);
    });

    it('returns undefined for missing path', () => {
      expect(get({ a: 1 }, ['a', 'b'])).toBeUndefined();
    });

    it('returns undefined when intermediate is null', () => {
      expect(get({ a: null }, ['a', 'b'])).toBeUndefined();
    });
  });

  describe('pickBy', () => {
    it('keeps entries matching the predicate', () => {
      expect(pickBy({ a: 1, b: 2, c: 3 }, (v) => v > 1)).toEqual({ b: 2, c: 3 });
    });

    it('keeps entries with matching key', () => {
      expect(pickBy({ aaa: 1, bb: 2, ccc: 3 }, (_v, k) => k.length === 2)).toEqual({ bb: 2 });
    });
  });

  describe('omitBy', () => {
    it('drops entries matching the predicate', () => {
      expect(omitBy({ a: 1, b: 2, c: 3 }, (v) => v > 1)).toEqual({ a: 1 });
    });
  });

  describe('mapValues', () => {
    it('transforms each value', () => {
      expect(mapValues({ a: 1, b: 2 }, (v) => v * 10)).toEqual({ a: 10, b: 20 });
    });
  });

  describe('mapKeys', () => {
    it('transforms each key', () => {
      expect(mapKeys({ a: 1, b: 2 }, (k) => k.toUpperCase())).toEqual({ A: 1, B: 2 });
    });
  });

  describe('invertObject', () => {
    it('swaps keys and values', () => {
      expect(invertObject({ a: 1, b: 2 })).toEqual({ 1: 'a', 2: 'b' });
    });
  });

  describe('safeUseLocalStorage', () => {
    interface User { id: string; name: string }
    const isUser = (v: unknown): v is User =>
      typeof v === 'object' && v !== null && 'id' in v && 'name' in v;

    it('returns initial value when key is missing', () => {
      const { result } = renderHook(() => safeUseLocalStorage<User>('user', { id: '', name: '' }, isUser));
      expect(result.current[0]).toEqual({ id: '', name: '' });
    });

    it('persists writes and validates on next read', () => {
      window.localStorage.setItem('user', JSON.stringify({ id: '1', name: 'foo' }));
      const { result } = renderHook(() => safeUseLocalStorage<User>('user', { id: '', name: '' }, isUser));
      expect(result.current[0]).toEqual({ id: '1', name: 'foo' });
    });

    it('falls back to initial value when stored JSON fails validation', () => {
      window.localStorage.setItem('user', JSON.stringify({ wrong: 'shape' }));
      const { result } = renderHook(() => safeUseLocalStorage<User>('user', { id: '', name: '' }, isUser));
      expect(result.current[0]).toEqual({ id: '', name: '' });
      // Bad storage remains in place until next set (validation runs lazily on read)
      // The point is: reads return safe initial value, not the bad data
    });

    it('falls back to initial value when stored JSON is corrupted', () => {
      window.localStorage.setItem('user', '{not-valid-json');
      const { result } = renderHook(() => safeUseLocalStorage<User>('user', { id: '', name: '' }, isUser));
      expect(result.current[0]).toEqual({ id: '', name: '' });
    });
  });
});