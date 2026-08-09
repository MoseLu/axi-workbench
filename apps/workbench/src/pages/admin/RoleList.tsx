import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Select, message } from 'antd';
import {
  AxiCrud,
  AxiCrudTable,
  AxiTableGroup,
  AxiUpsert,
  type AxiCrudRef,
  type AxiFormItem,
  type AxiTableColumn,
  type CrudService,
} from '@axi/crud';
import {
  useCreateTenant,
  useSaveTenantMember,
  useTenantMembers,
  useTenants,
  type TenantRole,
} from '@epap/api-client';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';
import {
  desktopCrudPagination,
  filterTenantMembers,
  formatTenantMemberTime,
  tenantRoleOptions,
  toTenantMemberRow,
  type TenantMemberRow,
} from './tenantMemberCrud';
import './RoleList.css';

const memberFormItems: AxiFormItem<TenantMemberRow>[] = [
  {
    component: ({ disabled, form }: { disabled?: boolean; form: TenantMemberRow }) => (
      <Input
        disabled={disabled || Boolean(form.createdAt)}
        placeholder="身份系统中的成员标识"
      />
    ),
    label: '成员标识',
    prop: 'subject',
    required: true,
    rules: [
      { required: true, message: '请输入成员标识' },
      { whitespace: true, message: '成员标识不能只包含空白字符' },
    ],
  },
  {
    label: '角色',
    options: tenantRoleOptions,
    prop: 'role',
    required: true,
    type: 'select',
  },
];

const memberColumns: AxiTableColumn<TenantMemberRow>[] = [
  { alwaysVisible: true, title: '', type: 'selection', width: 48 },
  { alwaysVisible: true, title: '序号', type: 'index', width: 64 },
  { align: 'left', dataIndex: 'subject', title: '成员标识', width: 280 },
  {
    dataIndex: 'role',
    dict: tenantRoleOptions,
    title: '角色',
    width: 120,
  },
  {
    dataIndex: 'updatedAt',
    render: (value: string) => formatTenantMemberTime(value),
    title: '更新时间',
    width: 176,
  },
  { alwaysVisible: true, title: '操作', type: 'op', width: 100 },
];

/**
 * Web C 级组织访问入口（Cool Admin cl-crud 编排样板）：
 * 左工具栏刷新/新增 · 中筛选 · 右搜索 · 表格分页 · Upsert 弹窗。
 * 列表来自 Platform Core；写入经 Gateway 鉴权审计。无删除 API 故不暴露批量删除。
 */
const RoleList: React.FC = () => {
  const crudRef = useRef<AxiCrudRef<TenantMemberRow>>(null);
  const [tenantId, setTenantId] = useState('');
  const [roleFilter, setRoleFilter] = useState<TenantRole | ''>('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const tenantsQuery = useTenants();
  const createTenant = useCreateTenant();
  const tenants = tenantsQuery.data ?? [];
  const selectedTenantId = tenantId && tenants.some((tenant) => tenant.id === tenantId)
    ? tenantId
    : tenants[0]?.id ?? '';

  useEffect(() => {
    if (tenantId === selectedTenantId) return;
    setTenantId(selectedTenantId);
  }, [selectedTenantId, tenantId]);

  const membersQuery = useTenantMembers(selectedTenantId);
  const saveMember = useSaveTenantMember(selectedTenantId);
  const memberRows = useMemo(
    () => (membersQuery.data ?? []).map(toTenantMemberRow),
    [membersQuery.data],
  );
  const visibleRows = useMemo(
    () => filterTenantMembers(memberRows, { keyword, role: roleFilter }),
    [keyword, memberRows, roleFilter],
  );
  const service = useMemo<CrudService<TenantMemberRow>>(() => ({
    page: async () => {
      if (!selectedTenantId) return [];
      const result = await membersQuery.refetch();
      if (result.error) throw result.error;
      return (result.data ?? []).map(toTenantMemberRow);
    },
    add: async (data) => {
      const member = data as TenantMemberRow | undefined;
      const subject = String(member?.subject ?? '').trim();
      const role = member?.role as TenantRole | undefined;
      if (!selectedTenantId || !subject || !role) throw new Error('成员标识和角色不能为空');
      await saveMember.mutateAsync({ role, subject });
    },
    update: async (data) => {
      const member = data as TenantMemberRow | undefined;
      const subject = String(member?.subject ?? '').trim();
      const role = member?.role as TenantRole | undefined;
      if (!selectedTenantId || !subject || !role) throw new Error('成员标识和角色不能为空');
      await saveMember.mutateAsync({ role, subject });
    },
  }), [membersQuery, saveMember, selectedTenantId]);

  const refresh = () => {
    void tenantsQuery.refetch().then(() => {
      if (!selectedTenantId) return;
      return crudRef.current?.refresh();
    }).catch(() => {
      message.error('成员目录暂时无法刷新，请检查平台服务和当前权限。');
    });
  };

  const runSearch = () => {
    setKeyword(keywordDraft);
  };

  const bootstrapTenant = async () => {
    const slugBase = 'axi-workbench';
    const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`;
    try {
      const tenant = await createTenant.mutateAsync({
        name: 'Axi Workbench',
        slug,
      });
      setTenantId(tenant.id);
      message.success(`已创建组织「${tenant.name}」`);
    } catch {
      message.error('创建组织失败。请确认 Platform Core（:8082）与 API Gateway 会话可用。');
    }
  };

  const tenantOptions = tenants.map((tenant) => ({ label: tenant.name, value: tenant.id }));
  const platformUnavailable = tenantsQuery.isError && !tenantsQuery.data;
  const membersUnavailable = Boolean(selectedTenantId) && membersQuery.isError && !membersQuery.data;
  const loading = (tenantsQuery.isLoading && !tenantsQuery.data)
    || (Boolean(selectedTenantId) && membersQuery.isLoading && !membersQuery.data);
  const hasTenantDirectory = !platformUnavailable && !loading && tenants.length > 0;
  const canListMembers = hasTenantDirectory && Boolean(selectedTenantId) && !membersUnavailable && !membersQuery.isLoading;

  return (
    <AxiCrud
      dataSource={memberRows}
      key={selectedTenantId || 'no-tenant'}
      permission={{
        add: Boolean(selectedTenantId),
        delete: false,
        page: Boolean(selectedTenantId),
        update: Boolean(selectedTenantId),
      }}
      ref={crudRef}
      service={service}
    >
      <DesktopCrudFrame
        ariaLabel="成员与角色"
        className="authority-status"
        filters={hasTenantDirectory ? (
          <>
            <Select
              aria-label="选择组织"
              loading={tenantsQuery.isFetching}
              options={tenantOptions}
              placeholder="选择组织"
              style={{ minWidth: 160 }}
              value={selectedTenantId || undefined}
              onChange={setTenantId}
            />
            {canListMembers ? (
              <Select
                allowClear
                aria-label="按角色筛选"
                options={tenantRoleOptions}
                placeholder="角色"
                style={{ minWidth: 120 }}
                value={roleFilter || undefined}
                onChange={(value) => setRoleFilter((value as TenantRole | undefined) ?? '')}
              />
            ) : null}
          </>
        ) : undefined}
        search={canListMembers ? (
          <div className="wb-crud-search-cluster">
            <Input
              allowClear
              aria-label="搜索成员或角色"
              placeholder="搜索成员标识、角色"
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              onClear={() => {
                setKeywordDraft('');
                setKeyword('');
              }}
              onPressEnter={runSearch}
            />
            <Button type="primary" onClick={runSearch}>搜索</Button>
          </div>
        ) : undefined}
        top={(
          <div className="wb-crud-action-cluster">
            <Button
              disabled={tenantsQuery.isFetching || membersQuery.isFetching}
              loading={tenantsQuery.isFetching || membersQuery.isFetching}
              onClick={refresh}
            >
              刷新
            </Button>
            {canListMembers ? (
              <Button
                disabled={saveMember.isPending}
                type="primary"
                onClick={() => crudRef.current?.rowAdd()}
              >
                新增
              </Button>
            ) : null}
            {!platformUnavailable && !loading && !selectedTenantId ? (
              <Button
                loading={createTenant.isPending}
                type="primary"
                onClick={() => void bootstrapTenant()}
              >
                创建组织
              </Button>
            ) : null}
          </div>
        )}
      >
        {platformUnavailable ? (
          <ControlPlaneState
            actionLabel="重新连接"
            actionLoading={tenantsQuery.isFetching}
            description="无法连接 Platform Core（默认 http://127.0.0.1:8082，经 Gateway :8088 代理）。请执行 pnpm --filter @axi/platform-core dev 后点击重新连接。"
            title="组织访问数据暂不可用"
            onAction={() => void tenantsQuery.refetch()}
          />
        ) : loading ? (
          <ControlPlaneState
            description="正在读取当前主体的组织和成员角色。"
            loading
            title="正在同步成员与角色"
          />
        ) : membersUnavailable ? (
          <ControlPlaneState
            actionLabel="重试"
            actionLoading={membersQuery.isFetching}
            description="组织已选定，但成员目录读取失败；请检查当前组织权限或平台服务状态。"
            title="成员目录暂不可用"
            onAction={() => void membersQuery.refetch()}
          />
        ) : !selectedTenantId ? (
          <ControlPlaneState
            actionLabel="创建组织"
            actionLoading={createTenant.isPending}
            description="当前登录主体还没有可管理的组织。可创建默认组织「Axi Workbench」，你将自动成为所有者。"
            title="没有可管理的组织"
            onAction={() => void bootstrapTenant()}
          />
        ) : (
          <AxiTableGroup
            description={
              visibleRows.length
                ? `显示 ${visibleRows.length} / ${memberRows.length} 条 · 保存由服务端鉴权并审计`
                : memberRows.length
                  ? '当前筛选条件下没有匹配成员。'
                  : '该组织尚无成员。点击「新增」写入已授权的身份主体。'
            }
            title="成员与角色"
          >
            <AxiCrudTable
              columns={memberColumns}
              data={visibleRows}
              operationButtons={['edit']}
              pagination={desktopCrudPagination(visibleRows.length)}
              rowKey="subject"
              rowSelection="multiple"
              storageKey="axi-workbench:tenant-members"
              toolbar={{
                layout: ['size', 'columns', 'style'],
                storageKey: 'axi-workbench:tenant-members',
                visible: true,
              }}
            />
          </AxiTableGroup>
        )}
      </DesktopCrudFrame>
      <AxiUpsert
        items={memberFormItems}
        onSubmit={(form, event) => {
          void event.next(form).catch(() => {
            event.done();
            message.error('成员角色未保存。请确认当前组织权限后重试。');
          });
        }}
      />
    </AxiCrud>
  );
};

export default RoleList;