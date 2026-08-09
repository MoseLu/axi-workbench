import { describe, expect, it } from 'vitest';

import { filterMenuRows, type MenuRow } from './MenuList';

const rows: MenuRow[] = [
  { group: '组织与访问', id: '/admin/settings/menu', label: '菜单配置', path: '/admin/settings/menu' },
  { group: '项目与工作', id: '/admin/project', label: '项目组合', path: '/admin/project' },
];

describe('导航入口 CRUD 视图', () => {
  it('只检索已登记的入口，空检索保留原始注册表投影', () => {
    expect(filterMenuRows(rows, '   ')).toBe(rows);
    expect(filterMenuRows(rows, '组织').map((row) => row.id)).toEqual(['/admin/settings/menu']);
    expect(filterMenuRows(rows, '/admin/project').map((row) => row.label)).toEqual(['项目组合']);
  });
});
