import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationApiError,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@axi/workbench-foundation';

const notification = {
  id: 'notification-1',
  type: 'in_app',
  userId: 'user-1',
  recipient: 'user-1',
  subject: '任务已创建',
  content: '任务 API 审查已创建',
  category: 'workspace',
  dotOnly: true,
  read: false,
  status: 'sent',
  createdAt: '2026-08-08T00:00:00Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notification API client', () => {
  it('loads the persisted notification list through the gateway session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ notifications: [notification] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchNotifications()).resolves.toEqual([notification]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/notifications$/), expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ Accept: 'application/json' }),
    }));
  });

  it('writes read transitions to the scoped notification routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...notification, read: true }))
      .mockResolvedValueOnce(Response.json({ marked: 4 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(markNotificationRead('notification/1')).resolves.toMatchObject({ read: true });
    await expect(markAllNotificationsRead()).resolves.toBe(4);

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/api\/v1\/notifications\/notification%2F1\/read$/), expect.objectContaining({ method: 'PUT', credentials: 'include' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/api\/v1\/notifications\/read-all$/), expect.objectContaining({ method: 'PUT', credentials: 'include' }));
  });

  it('surfaces a gateway error instead of inventing notification data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'authorization header required' }, { status: 401 })));

    await expect(fetchNotifications()).rejects.toEqual(expect.objectContaining<Partial<NotificationApiError>>({
      name: 'NotificationApiError',
      status: 401,
      message: 'authorization header required',
    }));
  });
});
