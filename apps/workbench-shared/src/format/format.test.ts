import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCompact,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTimestamp,
  formatUnreadCount,
} from './index';

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

  describe('formatBytes', () => {
    it('returns empty string for negative or non-finite input', () => {
      expect(formatBytes(-1)).toBe('');
      expect(formatBytes(Number.NaN)).toBe('');
    });

    it('returns "0 B" for zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('scales up by 1024 and picks the right unit', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatBytes(1024 ** 4)).toBe('1.0 TB');
    });

    it('caps at PB for insanely large values', () => {
      // 2^100 ≈ 1.27e30 bytes; we cap at PB and report raw value in PB
      const out = formatBytes(1024 ** 10);
      expect(out).toMatch(/PB$/);
      expect(out).not.toContain('e+'); // no scientific notation
    });
  });

  describe('formatDuration', () => {
    it('returns empty string for negative or non-finite input', () => {
      expect(formatDuration(-5)).toBe('');
      expect(formatDuration(Number.NaN)).toBe('');
    });

    it('sub-second durations stay in ms', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(300)).toBe('300ms');
    });

    it('seconds at low precision below 10s, integer above', () => {
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(2300)).toBe('2.3s');
      expect(formatDuration(10_000)).toBe('10s');
    });

    it('minutes + leftover seconds', () => {
      expect(formatDuration(90_000)).toBe('1m 30s');
      expect(formatDuration(120_000)).toBe('2m');
    });

    it('hours + leftover minutes', () => {
      expect(formatDuration(3_600_000)).toBe('1h');
      expect(formatDuration(3_900_000)).toBe('1h 5m');
    });
  });

  describe('formatRelativeTime', () => {
    const NOW = new Date('2026-09-02T12:00:00Z');

    it('returns empty string for invalid input', () => {
      expect(formatRelativeTime('not-a-date', NOW)).toBe('');
    });

    it('returns a localized relative time for seconds / minutes / hours / days', () => {
      expect(formatRelativeTime(new Date('2026-09-02T11:59:30Z'), NOW)).toMatch(/秒|前|now/);
      expect(formatRelativeTime(new Date('2026-09-02T11:55:00Z'), NOW)).toMatch(/分钟|前/);
      expect(formatRelativeTime(new Date('2026-09-02T09:00:00Z'), NOW)).toMatch(/小时|前/);
      expect(formatRelativeTime(new Date('2026-09-01T12:00:00Z'), NOW)).toMatch(/天|前/);
    });

    it('falls back to absolute timestamp for future dates', () => {
      const future = new Date('2026-09-03T12:00:00Z');
      const out = formatRelativeTime(future, NOW);
      expect(out).toMatch(/\d{4}/); // absolute date format
    });
  });

  describe('formatNumber', () => {
    it('groups thousands with zh-CN locale', () => {
      expect(formatNumber(1234)).toBe('1,234');
      expect(formatNumber(1_234_567, 0)).toBe('1,234,567');
      expect(formatNumber(1234.5, 1)).toBe('1,234.5');
    });

    it('returns empty for non-finite input', () => {
      expect(formatNumber(Number.NaN)).toBe('');
      expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('');
    });

    it('honors explicit decimals and locale', () => {
      expect(formatNumber(1234.5, 2, 'de-DE')).toMatch(/1\.234,50/);
    });
  });

  describe('formatPercent', () => {
    it('renders 0..1 as percentage string', () => {
      expect(formatPercent(0.834)).toBe('83.4%');
      expect(formatPercent(0.5, 0)).toBe('50%');
      expect(formatPercent(1)).toBe('100.0%');
    });

    it('returns empty for non-finite input', () => {
      expect(formatPercent(Number.NaN)).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('renders USD / CNY with locale-aware currency symbols', () => {
      expect(formatCurrency(1234.5, 'USD', 'en-US')).toMatch(/\$1,234\.50/);
      expect(formatCurrency(1234.5, 'CNY', 'zh-CN')).toMatch(/¥1,234\.50/);
      expect(formatCurrency(1234.5, 'EUR', 'de-DE')).toMatch(/1\.234,50/);
    });

    it('returns empty for non-finite input', () => {
      expect(formatCurrency(Number.NaN)).toBe('');
    });
  });

  describe('formatCompact', () => {
    it('renders compact notation per locale', () => {
      expect(formatCompact(1_234_567)).toMatch(/万/);
      expect(formatCompact(1_234_567, 'en-US')).toMatch(/M/);
    });

    it('returns empty for non-finite input', () => {
      expect(formatCompact(Number.NaN)).toBe('');
    });
  });
});