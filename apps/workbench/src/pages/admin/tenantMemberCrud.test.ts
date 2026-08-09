import { describe, expect, it } from 'vitest';

import { filterTenantMembers, tenantRoleLabels, toTenantMemberRow } from './tenantMemberCrud';

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
  it('只筛选服务端成员投影，空检索保留原数组', () => {
    expect(filterTenantMembers(rows, '   ')).toBe(rows);
    expect(filterTenantMembers(rows, 'alice').map((row) => row.subject)).toEqual(['alice@example.com']);
  });

  it('可按服务端角色及其中文显示名筛选', () => {
    expect(filterTenantMembers(rows, 'viewer').map((row) => row.subject)).toEqual(['ops-bot']);
    expect(filterTenantMembers(rows, tenantRoleLabels.owner).map((row) => row.subject)).toEqual(['alice@example.com']);
  });
});
