import { describe, expect, it } from 'vitest';
import { get, omit, pick, set } from './object';

describe('@axi/workbench-shared/format/object', () => {
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
});