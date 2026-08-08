import { describe, expect, it } from 'vitest';

import { getRegisteredDesktopRoutes, workbenchMenuRouteMap } from './navigationRegistry';

describe('navigationRegistry', () => {
  it('exposes the same real routes used by the desktop shell', () => {
    expect(getRegisteredDesktopRoutes().map((item) => item.path)).toEqual([
      '/admin/dashboard',
      '/admin/project',
      '/admin/task',
      '/admin/team',
      '/admin/scan',
      '/admin/me',
      '/admin/me/notifications',
      '/admin/settings/menu',
      '/admin/settings/role',
    ]);
  });

  it('keeps menu routes addressable by the shell tab registry', () => {
    expect(workbenchMenuRouteMap['/admin/settings/menu']).toEqual({ label: '菜单列表' });
    expect(workbenchMenuRouteMap['/admin/settings/role']).toEqual({ label: '角色列表' });
  });
});
