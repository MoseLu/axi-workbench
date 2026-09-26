import { describe, expect, it } from 'vitest';
import { buildQueryString, buildUrl, parseQueryString } from './url';

describe('@axi/workbench-shared/format/url', () => {
  describe('parseQueryString', () => {
    it('parses simple key=value pairs', () => {
      expect(parseQueryString('a=1&b=hello')).toEqual({ a: '1', b: 'hello' });
    });

    it('strips leading ?', () => {
      expect(parseQueryString('?a=1&b=2')).toEqual({ a: '1', b: '2' });
    });

    it('groups repeated keys into arrays', () => {
      expect(parseQueryString('tag=a&tag=b&tag=c')).toEqual({ tag: ['a', 'b', 'c'] });
    });

    it('handles empty values', () => {
      expect(parseQueryString('a=&b=2')).toEqual({ a: '', b: '2' });
    });

    it('handles keys without values', () => {
      expect(parseQueryString('flag&other=v')).toEqual({ flag: '', other: 'v' });
    });

    it('decodes URI-encoded values by default', () => {
      expect(parseQueryString('q=hello%20world&x=%E4%B8%AD')).toEqual({
        q: 'hello world',
        x: '中',
      });
    });

    it('skips decode when option disabled', () => {
      expect(parseQueryString('q=hello%20world', false)).toEqual({ q: 'hello%20world' });
    });

    it('returns empty object for non-string input', () => {
      expect(parseQueryString(null as unknown as string)).toEqual({});
    });

    it('returns empty object for empty / only-separator input', () => {
      expect(parseQueryString('')).toEqual({});
      expect(parseQueryString('&&&')).toEqual({});
    });
  });

  describe('buildQueryString', () => {
    it('serializes basic params', () => {
      expect(buildQueryString({ a: 1, b: 'hello' })).toBe('a=1&b=hello');
    });

    it('encodes special characters', () => {
      expect(buildQueryString({ q: 'hello world&foo=bar' })).toBe('q=hello%20world%26foo%3Dbar');
    });

    it('drops null / undefined / empty', () => {
      expect(buildQueryString({ a: 1, b: null, c: undefined, d: '' })).toBe('a=1');
    });

    it('serializes booleans to true/false', () => {
      expect(buildQueryString({ active: true, deleted: false })).toBe('active=true&deleted=false');
    });

    it('expands arrays with repeat keys', () => {
      expect(buildQueryString({ tag: ['a', 'b', 'c'] })).toBe('tag=a&tag=b&tag=c');
    });

    it('skips encode when option disabled', () => {
      expect(buildQueryString({ q: 'hello world' }, { encode: false })).toBe('q=hello world');
    });
  });

  describe('buildUrl', () => {
    it('appends ? when base has no query', () => {
      expect(buildUrl('/api/users', { id: 1 })).toBe('/api/users?id=1');
    });

    it('appends & when base already has ?', () => {
      expect(buildUrl('/api/users?type=admin', { id: 1 })).toBe(
        '/api/users?type=admin&id=1',
      );
    });

    it('returns base unchanged when params are empty', () => {
      expect(buildUrl('/api/users', {})).toBe('/api/users');
      expect(buildUrl('/api/users', { skip: null, drop: undefined, empty: '' })).toBe('/api/users');
    });
  });
});