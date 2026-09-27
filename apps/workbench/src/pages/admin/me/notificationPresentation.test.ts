import { describe, expect, it } from 'vitest';
import { formatNotificationTime } from './notificationPresentation';

describe('formatNotificationTime', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it('uses the supplied current time for relative notification text', () => {
    expect(formatNotificationTime(new Date(now - 30_000).toISOString(), 'en-US', now)).toBe('30 seconds ago');
    expect(formatNotificationTime(new Date(now + 2 * 60 * 60 * 1_000).toISOString(), 'en-US', now)).toBe('in 2 hours');
  });

  it('returns no text for malformed timestamps', () => {
    expect(formatNotificationTime('not-a-date', 'zh-CN', now)).toBe('');
  });
});
