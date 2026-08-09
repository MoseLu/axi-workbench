import { describe, expect, it } from 'vitest';

import { getRegisteredDesktopRoutes, workbenchMenuRouteMap } from './navigationRegistry';

describe('navigationRegistry', () => {
  it('exposes the same real routes used by the desktop shell', () => {
    expect(getRegisteredDesktopRoutes().map((item) => item.path)).toEqual([
      '/admin/dashboard',
      '/admin/operations',
      '/admin/project',
      '/admin/task',
      '/admin/team',
      '/admin/settings/menu',
      '/admin/settings/role',
      '/admin/me',
      '/admin/me/notifications',
    ]);
  });

  it('keeps menu routes addressable by the shell tab registry', () => {
    expect(workbenchMenuRouteMap['/admin/settings/menu']).toEqual({ label: '菜单列表' });
    expect(workbenchMenuRouteMap['/admin/settings/role']).toEqual({ label: '角色列表' });
  });
});
