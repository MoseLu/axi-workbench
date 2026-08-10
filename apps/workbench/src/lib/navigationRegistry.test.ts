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
    ]);
  });

  it('keeps menu routes addressable by the shell tab registry', () => {
    expect(workbenchMenuRouteMap['/admin/settings/menu']).toEqual({
      label: '菜单列表',
      labelKey: 'nav.settings.menu',
    });
    expect(workbenchMenuRouteMap['/admin/settings/role']).toEqual({
      label: '角色列表',
      labelKey: 'nav.settings.role',
    });
  });

  it('keeps profile and notifications as tab-addressable topbar utilities, not sidebar entries', () => {
    expect(workbenchMenuRouteMap['/admin/me']).toEqual({
      label: '个人中心',
      labelKey: 'nav.crumb.profile',
    });
    expect(workbenchMenuRouteMap['/admin/me/notifications']).toEqual({
      label: '通知中心',
      labelKey: 'nav.crumb.notifications',
    });
  });
});
