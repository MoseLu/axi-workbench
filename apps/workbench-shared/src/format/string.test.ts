import { describe, expect, it } from 'vitest';
import { camelCase, kebabCase, pascalCase, slugify, truncate } from './string';

describe('@axi/workbench-shared/format/string', () => {
  describe('truncate', () => {
    it('returns the original when shorter than max', () => {
      expect(truncate('hi', 8)).toBe('hi');
    });

    it('appends default suffix when over max', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('honors a custom suffix', () => {
      expect(truncate('hello world', 9, '…')).toBe('hello wo…');
    });

    it('returns empty string for non-string input', () => {
      expect(truncate(null as unknown as string, 5)).toBe('');
    });

    it('counts each CJK character as 1', () => {
      // CJK: each character is one JS char (length is char count, not bytes).
      expect(truncate('测试字符串', 5)).toBe('测试字符串'); // length 5 <= max 5 → unchanged
      expect(truncate('测试字符串', 6)).toBe('测试字符串'); // length 5 < max 6 → unchanged
      expect(truncate('测试字符串', 4)).toBe('测...');       // slice(0, 1) + '...' = 4 chars
      expect(truncate('测试字符串', 10)).toBe('测试字符串'); // length 5 < max 10 → unchanged
    });

    it('falls back to slice if suffix is longer than max', () => {
      expect(truncate('hello world', 2, '...')).toBe('he');
    });
  });

  describe('slugify', () => {
    it('lowercases and replaces spaces with hyphens', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('strips punctuation', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('collapses multiple non-alphanumerics into one hyphen', () => {
      expect(slugify('  Axi / Workbench  ')).toBe('axi-workbench');
    });

    it('strips leading and trailing hyphens', () => {
      expect(slugify('---abc---')).toBe('abc');
    });

    it('handles diacritics', () => {
      expect(slugify('Café résumé')).toBe('cafe-resume');
    });

    it('returns empty string for non-ASCII-only input', () => {
      expect(slugify('你好世界')).toBe('');
    });
  });

  describe('camelCase', () => {
    it('converts kebab-case', () => {
      expect(camelCase('hello-world')).toBe('helloWorld');
    });

    it('converts snake_case', () => {
      expect(camelCase('hello_world')).toBe('helloWorld');
    });

    it('converts space separated', () => {
      expect(camelCase('Hello World')).toBe('helloWorld');
    });
  });

  describe('pascalCase', () => {
    it('capitalizes the first letter after camelCase', () => {
      expect(pascalCase('hello-world')).toBe('HelloWorld');
      expect(pascalCase('hello_world')).toBe('HelloWorld');
    });
  });

  describe('kebabCase', () => {
    it('converts camelCase', () => {
      expect(kebabCase('helloWorld')).toBe('hello-world');
    });

    it('converts PascalCase', () => {
      expect(kebabCase('HelloWorld')).toBe('hello-world');
    });

    it('handles snake_case input', () => {
      expect(kebabCase('hello_world')).toBe('hello-world');
    });
  });
});