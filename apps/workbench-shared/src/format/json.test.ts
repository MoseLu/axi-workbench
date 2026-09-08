import { describe, expect, it } from 'vitest';
import {
  parseJsonSafe,
  requireJsonField,
  safeJsonRoundtrip,
  stringifyJsonSafe,
} from './json';

describe('@axi/workbench-shared/format/json', () => {
  describe('parseJsonSafe', () => {
    it('parses valid JSON', () => {
      expect(parseJsonSafe('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    });

    it('rejects invalid JSON', () => {
      expect(parseJsonSafe('not json').ok).toBe(false);
      expect(parseJsonSafe('not json')).toEqual({ ok: false, reason: 'parse_error' });
    });

    it('rejects empty / whitespace-only', () => {
      expect(parseJsonSafe('').ok).toBe(false);
      expect(parseJsonSafe('   ').ok).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(parseJsonSafe(123).ok).toBe(false);
      expect(parseJsonSafe(null).ok).toBe(false);
    });
  });

  describe('stringifyJsonSafe', () => {
    it('serializes objects', () => {
      expect(stringifyJsonSafe({ a: 1 })).toBe('{"a":1}');
    });

    it('returns undefined for circular references', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      expect(stringifyJsonSafe(obj)).toBeUndefined();
    });

    it('returns undefined for BigInt (not JSON-representable)', () => {
      expect(stringifyJsonSafe(10n)).toBeUndefined();
    });
  });

  describe('safeJsonRoundtrip', () => {
    it('preserves simple values', () => {
      expect(safeJsonRoundtrip('{"a":1,"b":"x"}')).toEqual({
        ok: true,
        value: { a: 1, b: 'x' },
      });
    });

    it('fails on invalid input', () => {
      expect(safeJsonRoundtrip('not json').ok).toBe(false);
    });
  });

  describe('requireJsonField', () => {
    it('accepts objects with all required fields', () => {
      expect(requireJsonField<{ id: string; name: string }>(
        '{"id":"1","name":"x"}',
        ['id', 'name']
      )).toEqual({ ok: true, value: { id: '1', name: 'x' } });
    });

    it('rejects objects missing required fields', () => {
      const result = requireJsonField<{ id: string; name: string }>(
        '{"id":"1"}',
        ['id', 'name']
      );
      expect(result.ok).toBe(false);
    });

    it('rejects malformed JSON', () => {
      expect(requireJsonField('not json', ['id']).ok).toBe(false);
    });
  });
});