/**
 * Tests for the route-derived breadcrumb builder.
 *
 * Strategy:
 *  - The builder is pure (no React state, no router), so we can exercise it
 *    without a renderer or DOM.
 *  - We strip icons from the assertion when they are React nodes (string
 *    hints are not converted to nodes today, so we mostly assert metadata).
 *  - Coverage targets: root, dashboard collapse, exact match, prefix match,
 *    alias match via `match[]`, parent chain, unknown fallback.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveBreadcrumbs,
  BREADCRUMB_REGISTRY,
} from './breadcrumbs';

const stripIcons = (items: ReturnType<typeof resolveBreadcrumbs>) =>
  items.map(({ icon: _icon, ...rest }) => rest);

describe('resolveBreadcrumbs', () => {
  it('root path collapses to a single active "概览" item', () => {
    expect(stripIcons(resolveBreadcrumbs('/'))).toEqual([
      { label: '概览', isActive: true },
    ]);
    expect(stripIcons(resolveBreadcrumbs(''))).toEqual([
      { label: '概览', isActive: true },
    ]);
    expect(stripIcons(resolveBreadcrumbs('/admin/dashboard'))).toEqual([
      { label: '概览', isActive: true },
    ]);
  });

  it('returns no invented root item for unknown paths', () => {
    expect(stripIcons(resolveBreadcrumbs('/admin/this-does-not-exist'))).toEqual([]);
  });

  it('builds the workbench hierarchy before the current project item', () => {
    const chain = stripIcons(resolveBreadcrumbs('/admin/project'));
    expect(chain.map((item) => item.label)).toEqual(['工作台', '项目']);
    expect(chain[0]?.path).toBe('/admin/dashboard');
    expect(chain[1]).toEqual({
      label: '项目',
      path: '/admin/project',
      isActive: true,
    });
  });

  it('inserts the parent group for task routes', () => {
    const chain = stripIcons(resolveBreadcrumbs('/admin/task'));
    expect(chain.map((c) => c.label)).toEqual(['工作台', '工作区']);
    expect(chain[0]?.path).toBe('/admin/dashboard');
    expect(chain[1]?.path).toBe('/admin/task');
    expect(chain[1]?.isActive).toBe(true);
  });

  it('inserts the account hierarchy for settings/* routes', () => {
    const chain = stripIcons(resolveBreadcrumbs('/admin/settings/role'));
    expect(chain.map((c) => c.label)).toEqual(['账号与设置', '角色列表']);
    expect(chain[0]?.path).toBeUndefined();
    expect(chain[1]?.path).toBe('/admin/settings/role');
    expect(chain[1]?.isActive).toBe(true);
  });

  it('builds a three-level hierarchy for personal subpages', () => {
    const chain = stripIcons(resolveBreadcrumbs('/admin/me/notifications'));
    expect(chain.map((c) => c.label)).toEqual(['账号与设置', '个人中心', '通知设置']);
    expect(chain[1]?.path).toBe('/admin/me');
    expect(chain[2]?.path).toBe('/admin/me/notifications');
    expect(chain[2]?.isActive).toBe(true);
  });

  it('falls back to the registered personal center route', () => {
    const chain = stripIcons(resolveBreadcrumbs('/admin/me'));
    expect(chain.map((c) => c.label)).toEqual(['账号与设置', '个人中心']);
    expect(chain[chain.length - 1]?.isActive).toBe(true);
  });

  it('respects `match[]` aliases when the path is not a registered key', () => {
    // To verify alias support we register a temporary alias and look it up.
    BREADCRUMB_REGISTRY['/admin/team/group'] = {
      label: '分组',
      parent: { label: '团队' },
      match: ['/admin/team/g-123', '/admin/team/g-456'],
    };
    try {
      const chain = stripIcons(resolveBreadcrumbs('/admin/team/g-123'));
      expect(chain.map((c) => c.label)).toEqual(['团队', '分组']);
      // Active item should keep the registered path, not the alias.
      expect(chain[chain.length - 1]?.path).toBe('/admin/team/group');
    } finally {
      delete BREADCRUMB_REGISTRY['/admin/team/group'];
    }
  });

  it('exact-match wins over prefix-match regardless of key length', () => {
    // Register two paths, one being a prefix of the other, then verify the
    // exact match still wins (otherwise the more specific route would lose
    // its identity to the generic parent).
    const originalTaskRoute = BREADCRUMB_REGISTRY['/admin/task'];
    BREADCRUMB_REGISTRY['/admin/task'] = { label: '工作区' };
    BREADCRUMB_REGISTRY['/admin/task/board'] = {
      label: '看板',
      parent: { label: '工作区' },
    };
    try {
      const chain = stripIcons(resolveBreadcrumbs('/admin/task/board'));
      expect(chain.map((c) => c.label)).toEqual(['工作区', '看板']);
      const active = chain[chain.length - 1];
      expect(active?.isActive).toBe(true);
      expect(active?.path).toBe('/admin/task/board');
    } finally {
      delete BREADCRUMB_REGISTRY['/admin/task/board'];
      BREADCRUMB_REGISTRY['/admin/task'] = originalTaskRoute;
    }
  });
});
