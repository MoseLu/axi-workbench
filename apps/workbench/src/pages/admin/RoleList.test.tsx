import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const members = [
  {
    tenantId: 'tenant-axi',
    subject: 'alice@example.com',
    role: 'admin' as const,
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
];

vi.mock('@epap/api-client', () => ({
  useCreateTenant: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSaveTenantMember: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useTenantMembers: () => ({
    data: members,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(async () => ({ data: members, error: null })),
  }),
  useTenants: () => ({
    data: [{ id: 'tenant-axi', name: 'Axi Workbench', slug: 'axi-workbench', createdAt: '2026-08-09T00:00:00.000Z' }],
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(async () => ({ data: [], error: null })),
  }),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;

  return {
    AxiCrud: ({ children }: { children?: React.ReactNode }) => element('section', { 'data-axi': 'crud' }, children),
    AxiCrudLayout: ({ children, search, toolbar, top }: { children?: React.ReactNode; search?: React.ReactNode; toolbar?: React.ReactNode; top?: React.ReactNode }) => element(
      'div',
      { 'data-axi': 'crud-layout' },
      top,
      toolbar,
      search,
      children,
    ),
    AxiCrudTable: ({ data }: { data?: Array<{ subject?: string }> }) => element(
      'div',
      { 'data-axi': 'crud-table' },
      data?.map((row) => row.subject).join(','),
    ),
    AxiTableGroup: ({ children }: { children?: React.ReactNode }) => element('section', { 'data-axi': 'table-group' }, children),
    AxiUpsert: () => element('div', { 'data-axi': 'upsert' }),
  };
});

import RoleList from './RoleList';

describe('RoleList', () => {
  it('以 AxiCrud、AxiCrudTable 和 AxiUpsert 组合真实的租户成员投影', () => {
    const markup = renderToStaticMarkup(<RoleList />);

    expect(markup).toContain('data-axi="crud"');
    expect(markup).toContain('data-axi="crud-table"');
    expect(markup).toContain('data-axi="upsert"');
    expect(markup).toContain('alice@example.com');
    // antd 两字按钮中间会插入空格（刷 新 / 新 增 / 搜 索）
    expect(markup.replace(/\s/g, '')).toContain('刷新');
    expect(markup.replace(/\s/g, '')).toContain('新增');
    expect(markup.replace(/\s/g, '')).toContain('搜索');
    expect(markup).not.toContain('当前会话');
    expect(markup).not.toContain('由控制面审批快照提供');
  });
});
