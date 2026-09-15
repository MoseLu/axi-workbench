import { describe, expect, it } from 'vitest';
import {
  mask,
  maskBankCard,
  maskEmail,
  maskIdCard,
  maskName,
  maskPhone,
} from './privacy';

describe('@axi/workbench-shared/format/privacy', () => {
  describe('maskPhone', () => {
    it('masks CN 11-digit phone keeping 3 + 4', () => {
      expect(maskPhone('13800138000')).toBe('138****8000');
    });

    it('strips spaces / dashes / parens before masking', () => {
      // '(010) 1234-5678' cleaned → '01012345678' = 11 digits
      expect(maskPhone('(010) 1234-5678')).toBe('010****5678');
    });

    it('returns empty for too-short input', () => {
      expect(maskPhone('123')).toBe('');
    });

    it('honors HK 8-digit format', () => {
      expect(maskPhone('23456789', 'HK')).toBe('23****89');
    });

    it('honors any region with 3+2 keep', () => {
      // '13800138000' = 11 digits → keep 3 head + 2 tail → 6 stars
      expect(maskPhone('13800138000', 'any')).toBe('138******00');
    });
  });

  describe('maskIdCard', () => {
    it('masks 18-digit Chinese ID card keeping 6 + 4', () => {
      expect(maskIdCard('110101199001011234')).toBe('110101********1234');
    });

    it('returns empty for too-short input', () => {
      expect(maskIdCard('12345')).toBe('');
    });
  });

  describe('maskEmail', () => {
    it('keeps first char of local part', () => {
      expect(maskEmail('foo@bar.com')).toBe('f**@bar.com');
    });

    it('handles single-char local', () => {
      expect(maskEmail('a@bar.com')).toBe('a@bar.com');
    });

    it('returns empty for non-email input', () => {
      expect(maskEmail('not-an-email')).toBe('');
    });
  });

  describe('maskName', () => {
    it('keeps first char of 2-char name', () => {
      expect(maskName('张三')).toBe('张*');
    });

    it('keeps first char of 4-char name (复姓 + 双字名)', () => {
      expect(maskName('欧阳娜娜')).toBe('欧***');
    });

    it('returns single char unchanged', () => {
      expect(maskName('王')).toBe('王');
    });

    it('returns empty for empty input', () => {
      expect(maskName('')).toBe('');
    });
  });

  describe('maskBankCard', () => {
    it('keeps 6 + 4 (industry standard)', () => {
      // '6222021234567890' = 16 digits → 6 head + 4 tail + 6 stars
      expect(maskBankCard('6222021234567890')).toBe('622202******7890');
    });

    it('returns empty for too-short input', () => {
      expect(maskBankCard('12345')).toBe('');
    });
  });

  describe('mask (generic)', () => {
    it('keeps N head + M tail with default 2 + 2', () => {
      // '13800138000' = 11 chars → 2 head + 2 tail + 7 stars
      expect(mask('13800138000')).toBe('13*******00');
    });

    it('honors custom keepHead / keepTail', () => {
      // 'abcdefghij' = 10 chars → 3 head + 3 tail + 4 stars
      expect(mask('abcdefghij', 3, 3)).toBe('abc****hij');
    });

    it('returns input unchanged when length <= keepHead + keepTail', () => {
      expect(mask('abc', 2, 2)).toBe('abc');
    });

    it('honors custom char (e.g. dot)', () => {
      expect(mask('13800138000', 3, 4, '.')).toBe('138....8000');
    });
  });
});