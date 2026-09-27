import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateLength,
  validateNonEmpty,
  validatePhone,
  validateUrl,
  validateUUID,
} from './validate';

describe('@axi/workbench-shared/format/validate', () => {
  describe('validateNonEmpty', () => {
    it('returns ok for non-empty strings', () => {
      expect(validateNonEmpty('hi')).toEqual({ ok: true, value: 'hi' });
    });

    it('rejects empty / whitespace-only strings', () => {
      expect(validateNonEmpty('').ok).toBe(false);
      expect(validateNonEmpty('   ').ok).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(validateNonEmpty(123).ok).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('accepts simple email', () => {
      expect(validateEmail('foo@bar.com')).toEqual({ ok: true, value: 'foo@bar.com' });
    });

    it('lowercases accepted emails', () => {
      expect(validateEmail('Foo@Bar.COM')).toEqual({ ok: true, value: 'foo@bar.com' });
    });

    it('rejects missing @ / domain', () => {
      expect(validateEmail('foo').ok).toBe(false);
      expect(validateEmail('foo@').ok).toBe(false);
      expect(validateEmail('foo@bar').ok).toBe(false);
    });

    it('rejects over-length emails (RFC 5321 cap 254)', () => {
      const long = 'a'.repeat(250) + '@b.com';
      expect(validateEmail(long).ok).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('accepts http / https / mailto / ws / wss', () => {
      expect(validateUrl('https://example.com').ok).toBe(true);
      expect(validateUrl('http://x.y').ok).toBe(true);
      expect(validateUrl('mailto:hi@x.com').ok).toBe(true);
    });

    it('rejects javascript: and data: protocols by default', () => {
      expect(validateUrl('javascript:alert(1)').ok).toBe(false);
      expect(validateUrl('data:text/plain,hello').ok).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(validateUrl('not a url').ok).toBe(false);
    });

    it('honors custom allowed protocols', () => {
      expect(validateUrl('ftp://x.y', ['ftp:']).ok).toBe(true);
      expect(validateUrl('https://x.y', ['ftp:']).ok).toBe(false);
    });
  });

  describe('validateUUID', () => {
    it('accepts a valid v4 UUID', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000').ok).toBe(true);
    });

    it('accepts case-insensitive input', () => {
      expect(validateUUID('123E4567-E89B-12D3-A456-426614174000').ok).toBe(true);
    });

    it('rejects non-v4 versions', () => {
      expect(validateUUID('123e4567-e89b-62d3-a456-426614174000').ok).toBe(false);
    });

    it('rejects malformed UUIDs', () => {
      expect(validateUUID('not-a-uuid').ok).toBe(false);
      expect(validateUUID('123e4567-e89b-12d3-a456').ok).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('accepts CN 11-digit phone', () => {
      expect(validatePhone('13800138000')).toEqual({ ok: true, value: '13800138000' });
    });

    it('strips spaces / dashes / parens before validating', () => {
      expect(validatePhone('138 0013 8000')).toEqual({ ok: true, value: '13800138000' });
      expect(validatePhone('(010) 1234-5678', 'any').ok).toBe(true);
    });

    it('rejects invalid CN numbers', () => {
      expect(validatePhone('123').ok).toBe(false);
      expect(validatePhone('23800138000').ok).toBe(false); // starts with 2
    });
  });

  describe('validateLength', () => {
    it('rejects shorter than min', () => {
      expect(validateLength('ab', 3, 10).ok).toBe(false);
    });

    it('rejects longer than max', () => {
      expect(validateLength('abcdefghijklmn', 3, 10).ok).toBe(false);
    });

    it('returns trimmed value when within range', () => {
      expect(validateLength('  hello  ', 3, 10)).toEqual({ ok: true, value: 'hello' });
    });
  });
});