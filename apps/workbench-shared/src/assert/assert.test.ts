import { describe, expect, it } from 'vitest';
import { assertNever, assertPresent, safeCall, tryOr } from './index';

describe('@axi/workbench-shared/assert', () => {
  describe('assertNever', () => {
    it('throws when invoked (should only happen in unhandled switch branches)', () => {
      // Construct a never at runtime via never-typed cast
      const unreachable = undefined as never;
      expect(() => assertNever(unreachable)).toThrow(/assertNever/);
    });
  });

  describe('safeCall', () => {
    it('returns ok=true with value when function succeeds', () => {
      const result = safeCall(() => 42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('returns ok=false with error when function throws', () => {
      const result = safeCall(() => {
        throw new Error('boom');
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as Error).message).toBe('boom');
      }
    });

    it('preserves thrown non-Error values (string, number, etc.)', () => {
      const result = safeCall(() => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'plain string';
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('plain string');
      }
    });
  });

  describe('tryOr', () => {
    it('returns function result on success', () => {
      expect(tryOr(() => 7, 99)).toBe(7);
    });

    it('returns fallback on throw', () => {
      expect(tryOr<number>(() => { throw new Error(); }, 99)).toBe(99);
    });

    it('returns fallback for synchronous JSON.parse failures', () => {
      expect(tryOr(() => JSON.parse('not-json'), { fallback: true } as { fallback: true })).toEqual({ fallback: true });
    });
  });

  describe('assertPresent', () => {
    it('returns the value when not null/undefined', () => {
      expect(assertPresent('hello', 'msg')).toBe('hello');
      expect(assertPresent(0, 'msg')).toBe(0);
      expect(assertPresent(false, 'msg')).toBe(false);
      expect(assertPresent('', 'msg')).toBe('');
    });

    it('throws on null or undefined with provided message', () => {
      expect(() => assertPresent(null, 'user lookup failed')).toThrow(/user lookup failed/);
      expect(() => assertPresent(undefined, 'config missing')).toThrow(/config missing/);
    });
  });
});