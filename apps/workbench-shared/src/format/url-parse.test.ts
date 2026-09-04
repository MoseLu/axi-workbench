import { describe, expect, it } from 'vitest';
import { mergeUrl, parseSearchParams, parseUrl } from './url-parse';

describe('@axi/workbench-shared/format/url-parse', () => {
  describe('parseUrl', () => {
    it('parses a valid URL', () => {
      const url = parseUrl('https://example.com/path?a=1');
      expect(url).not.toBeNull();
      expect(url?.host).toBe('example.com');
    });

    it('returns null for malformed input', () => {
      expect(parseUrl('not a url')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(parseUrl('')).toBeNull();
      expect(parseUrl('   ')).toBeNull();
    });

    it('rejects disallowed protocols by default', () => {
      expect(parseUrl('javascript:alert(1)')).toBeNull();
      expect(parseUrl('data:text/plain,hello')).toBeNull();
    });

    it('honors custom allowed protocols', () => {
      expect(parseUrl('ftp://x.y', ['ftp:'])).not.toBeNull();
      expect(parseUrl('https://x.y', ['ftp:'])).toBeNull();
    });
  });

  describe('parseSearchParams', () => {
    it('extracts simple params', () => {
      expect(parseSearchParams('https://x.com?a=1&b=2')).toEqual({ a: '1', b: '2' });
    });

    it('groups repeated keys into arrays', () => {
      expect(parseSearchParams('https://x.com?tag=a&tag=b')).toEqual({ tag: ['a', 'b'] });
    });

    it('accepts a URL instance', () => {
      const u = new URL('https://x.com?a=1');
      expect(parseSearchParams(u)).toEqual({ a: '1' });
    });

    it('returns empty object for invalid URL string', () => {
      expect(parseSearchParams('not a url')).toEqual({});
    });
  });

  describe('mergeUrl', () => {
    it('appends path with leading slash', () => {
      expect(mergeUrl('https://api.com/users', '1')).toBe('https://api.com/users/1');
    });

    it('strips trailing slash from base before appending', () => {
      expect(mergeUrl('https://api.com/users/', '1')).toBe('https://api.com/users/1');
    });

    it('appends query params', () => {
      expect(mergeUrl('https://api.com/users', undefined, { id: 1 })).toBe('https://api.com/users?id=1');
    });

    it('appends & when base already has ?', () => {
      expect(mergeUrl('https://api.com/users?type=admin', undefined, { id: 1 })).toBe(
        'https://api.com/users?type=admin&id=1'
      );
    });

    it('drops null / undefined params', () => {
      expect(mergeUrl('https://api.com', undefined, { a: 1, b: null, c: undefined })).toBe(
        'https://api.com?a=1'
      );
    });

    it('expands arrays with repeat keys', () => {
      expect(mergeUrl('https://api.com', undefined, { tag: ['a', 'b'] })).toBe('https://api.com?tag=a&tag=b');
    });
  });
});