import { describe, expect, it } from 'vitest';

import {
  desktopCrudPagination,
  filterTenantMembers,
  tenantRoleLabels,
  tenantRoleOptions,
  toTenantMemberRow,
} from './tenantMemberCrud';

const rows = [
  toTenantMemberRow({
    tenantId: 'tenant-a',
    subject: 'alice@example.com',
    role: 'owner',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  }),
  toTenantMemberRow({
    tenantId: 'tenant-a',
    subject: 'ops-bot',
    role: 'viewer',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  }),
];

describe('租户成员 CRUD 投影', () => {
  it('只筛选服务端成员投影，空检索返回全部行', () => {
    expect(filterTenantMembers(rows, '   ')).toEqual(rows);
    expect(filterTenantMembers(rows, 'alice').map((row) => row.subject)).toEqual(['alice@example.com']);
  });

  it('可按服务端角色及其中文显示名筛选', () => {
    expect(filterTenantMembers(rows, 'viewer').map((row) => row.subject)).toEqual(['ops-bot']);
    expect(filterTenantMembers(rows, tenantRoleLabels.owner).map((row) => row.subject)).toEqual(['alice@example.com']);
  });

  it('支持角色精确过滤 + 关键字组合', () => {
    expect(filterTenantMembers(rows, { role: 'viewer' }).map((row) => row.subject)).toEqual(['ops-bot']);
    expect(filterTenantMembers(rows, { role: 'owner', keyword: 'ops' })).toEqual([]);
    expect(filterTenantMembers(rows, { role: 'owner', keyword: 'alice' }).map((row) => row.subject)).toEqual([
      'alice@example.com',
    ]);
  });

  it('角色字典带 Cool Admin 风格颜色', () => {
    expect(tenantRoleOptions.every((option) => option.color && option.label && option.value)).toBe(true);
  });

  it('默认分页展示共 N 条', () => {
    const pagination = desktopCrudPagination(42);
    expect(pagination.showTotal(42)).toBe('共 42 条');
    expect(pagination.defaultPageSize).toBe(20);
  });
});
