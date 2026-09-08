import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNavBadges } from './navBadges';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNavBadges', () => {
  it('keeps the server unread total so dot-only categories count in the topbar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      home: { kind: 'count', value: 12 },
      projects: { kind: 'none' },
      workspace: { kind: 'dot' },
      me: { kind: 'count', value: 3 },
      unreadTotal: 16,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchNavBadges()).resolves.toEqual({
      home: { kind: 'count', value: 12 },
      projects: { kind: 'none' },
      workspace: { kind: 'dot' },
      me: { kind: 'count', value: 3 },
      unreadTotal: 16,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/notifications/nav-badges', expect.objectContaining({
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }));
  });
});
