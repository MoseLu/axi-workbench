import { describe, expect, it } from 'vitest';
import { formatTimestamp, formatUnreadCount } from './index';

describe('@axi/workbench-shared/format', () => {
  describe('formatUnreadCount', () => {
    it('returns empty string for non-positive or invalid counts', () => {
      expect(formatUnreadCount(0)).toBe('');
      expect(formatUnreadCount(-1)).toBe('');
      expect(formatUnreadCount(Number.NaN)).toBe('');
    });

    it('truncates to "99+" beyond two digits', () => {
      expect(formatUnreadCount(100)).toBe('99+');
      expect(formatUnreadCount(12345)).toBe('99+');
    });

    it('passes through 1-99 as-is and floors fractions', () => {
      expect(formatUnreadCount(1)).toBe('1');
      expect(formatUnreadCount(42)).toBe('42');
      expect(formatUnreadCount(7.9)).toBe('7');
    });
  });

  describe('formatTimestamp', () => {
    it('returns empty string for invalid input', () => {
      expect(formatTimestamp('not-a-date')).toBe('');
      expect(formatTimestamp(new Date('not-a-date'))).toBe('');
    });

    it('renders a zh-CN date+time string for ISO input', () => {
      const out = formatTimestamp('2026-09-02T18:30:00Z');
      expect(out).toMatch(/\d{4}\/\d{2}\/\d{2}/);
    });
  });
});