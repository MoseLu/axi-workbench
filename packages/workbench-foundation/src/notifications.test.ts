/**
 * Tests for the notification projection in `@axi/workbench-foundation`.
 *
 * The `decodeNotification` shape is private to the module; the public surface
 * (`fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead`)
 * is exercised here through a mocked `fetch`. We verify that:
 *
 *  - well-formed payloads are projected into the strict `WorkbenchNotification`
 *    shape (no extra fields, `sentAt` only present when sent),
 *  - payloads missing required fields or with invalid enums throw so the UI
 *    surfaces a configuration error rather than a half-decoded list,
 *  - HTTP errors propagate as `NotificationApiError` with the right status.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationApiError,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications';

const sampleSent = {
  id: 'note-1',
  type: 'email',
  userId: 'user-1',
  recipient: 'user-1@example.test',
  subject: 'Welcome',
  content: 'Hello world',
  category: 'me',
  dotOnly: false,
  read: false,
  status: 'sent',
  createdAt: '2026-01-01T00:00:00.000Z',
  sentAt: '2026-01-01T00:00:05.000Z',
};

const samplePending = {
  ...sampleSent,
  id: 'note-2',
  status: 'pending',
  sentAt: undefined,
};

function mockFetchOnce(payload: unknown, init?: { status?: number; ok?: boolean }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => payload,
  } as unknown as Response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('fetchNotifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('projects each entry into the WorkbenchNotification shape', async () => {
    mockFetchOnce({ notifications: [sampleSent, samplePending] });

    const result = await fetchNotifications();

    expect(result).toEqual([
      expect.objectContaining({
        id: 'note-1',
        status: 'sent',
        sentAt: '2026-01-01T00:00:05.000Z',
      }),
      expect.objectContaining({
        id: 'note-2',
        status: 'pending',
      }),
    ]);
    expect(result[1]).not.toHaveProperty('sentAt');
  });

  it('forwards the unreadOnly filter to the query string', async () => {
    const fetchMock = mockFetchOnce({ notifications: [] });

    await fetchNotifications({ unreadOnly: true });

    const calledURL = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledURL).toContain('/api/v1/notifications');
    expect(calledURL).toContain('unreadOnly=true');
  });

  it('rejects payloads that are missing the notifications array', async () => {
    mockFetchOnce({ items: [] });

    await expect(fetchNotifications()).rejects.toThrow(/notification list payload is invalid/);
  });

  it('rejects payloads where a notification has an invalid type', async () => {
    mockFetchOnce({
      notifications: [{ ...sampleSent, type: 'sms' }],
    });

    await expect(fetchNotifications()).rejects.toThrow(/unsupported type/);
  });
});

describe('markNotificationRead', () => {
  it('requires a non-empty id', async () => {
    await expect(markNotificationRead('   ')).rejects.toThrow(/notification id is required/);
  });

  it('returns the decoded notification on success', async () => {
    mockFetchOnce({ ...sampleSent, read: true });

    const result = await markNotificationRead('note-1');

    expect(result.id).toBe('note-1');
    expect(result.read).toBe(true);
  });
});

describe('markAllNotificationsRead', () => {
  it('returns the marked count from the payload', async () => {
    mockFetchOnce({ marked: 7 });

    const count = await markAllNotificationsRead();

    expect(count).toBe(7);
  });

  it('coerces negative or fractional values to 0', async () => {
    mockFetchOnce({ marked: -2 });

    await expect(markAllNotificationsRead()).resolves.toBe(0);
  });
});

describe('NotificationApiError', () => {
  it('preserves the HTTP status from the upstream response', async () => {
    mockFetchOnce({ error: 'forbidden' }, { ok: false, status: 403 });

    await expect(fetchNotifications()).rejects.toMatchObject({
      name: 'NotificationApiError',
      status: 403,
    });
  });

  it('falls back to a status-derived message when the body is not JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(fetchNotifications()).rejects.toMatchObject({
      name: 'NotificationApiError',
      status: 502,
      message: expect.stringContaining('502'),
    });
  });
});