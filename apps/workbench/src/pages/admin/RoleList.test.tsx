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

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => {
      const dict: Record<string, string> = {
        'authority.title': '成员与角色',
        'authority.refresh': '刷新',
        'authority.add': '新增',
        'authority.bootstrap.cta': '创建组织',
        'authority.bootstrap.success': '已创建组织「{name}」',
        'authority.bootstrap.failed': '创建组织失败。请确认 Platform Core（:8082）与 API Gateway 会话可用。',
        'authority.tenant.ariaLabel': '选择组织',
        'authority.tenant.placeholder': '选择组织',
        'authority.role.ariaLabel': '按角色筛选',
        'authority.role.placeholder': '角色',
        'authority.search.ariaLabel': '搜索成员或角色',
        'authority.search.placeholder': '搜索成员标识、角色',
        'authority.member.subject.label': '成员标识',
        'authority.member.subject.placeholder': '身份系统中的成员标识',
        'authority.member.subject.required': '请输入成员标识',
        'authority.member.subject.whitespace': '成员标识不能只包含空白字符',
        'authority.member.subjectOrRoleRequired': '成员标识和角色不能为空',
        'authority.member.role.label': '角色',
        'authority.column.index': '序号',
        'authority.column.updatedAt': '更新时间',
        'authority.column.actions': '操作',
        'authority.count': ' 条 · 保存由服务端鉴权并审计',
        'authority.emptyFiltered': '当前筛选条件下没有匹配成员。',
        'authority.emptyAll': '该组织尚无成员。点击「新增」写入已授权的身份主体。',
        'authority.error.reconnect': '重新连接',
        'authority.error.retry': '重试',
        'authority.platformUnavailable.title': '组织访问数据暂不可用',
        'authority.platformUnavailable.description': '无法连接 Platform Core（默认 http://127.0.0.1:8082，经 Gateway :8088 代理）。请执行 pnpm --filter @axi/platform-core dev 后点击重新连接。',
        'authority.loading.title': '正在同步成员与角色',
        'authority.loading.description': '正在读取当前主体的组织和成员角色。',
        'authority.membersUnavailable.title': '成员目录暂不可用',
        'authority.membersUnavailable.description': '组织已选定，但成员目录读取失败；请检查当前组织权限或平台服务状态。',
        'authority.noTenant.title': '没有可管理的组织',
        'authority.noTenant.description': '当前登录主体还没有可管理的组织。可创建默认组织「Axi Workbench」，你将自动成为所有者。',
        'authority.save.failed': '成员角色未保存。请确认当前组织权限后重试。',
        'authority.refresh.failed': '成员目录暂时无法刷新，请检查平台服务和当前权限。',
        'common.search': '搜索',
      };
      return dict[key] ?? fallback ?? key;
    },
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
