import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Select, Space, message } from 'antd';
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
  useSaveTenantMember,
  useTenantMembers,
  useTenants,
  type TenantRole,
} from '@epap/api-client';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';
import {
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
  { alwaysVisible: true, title: '序号', type: 'index', width: 64 },
  { align: 'left', dataIndex: 'subject', title: '成员标识', width: 300 },
  {
    dataIndex: 'role',
    dict: tenantRoleOptions,
    title: '角色',
    width: 130,
  },
  {
    dataIndex: 'updatedAt',
    render: (value: string) => formatTenantMemberTime(value),
    title: '更新时间',
    width: 176,
  },
  { alwaysVisible: true, title: '操作', type: 'op', width: 88 },
];

/**
 * Web 的 C 级组织访问入口：列表由 Platform Core 投影，新增和编辑均通过
 * Gateway 进入服务端授权、重验和审计链路。没有租户或服务不可用时不展示样例角色。
 */
const RoleList: React.FC = () => {
  const crudRef = useRef<AxiCrudRef<TenantMemberRow>>(null);
  const [tenantId, setTenantId] = useState('');
  const [keyword, setKeyword] = useState('');
  const tenantsQuery = useTenants();
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
    () => filterTenantMembers(memberRows, keyword),
    [keyword, memberRows],
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
    void crudRef.current?.refresh().catch(() => {
      message.error('成员目录暂时无法刷新，请检查平台服务和当前权限。');
    });
  };
  const tenantOptions = tenants.map((tenant) => ({ label: tenant.name, value: tenant.id }));
  const platformUnavailable = tenantsQuery.isError;
  const membersUnavailable = Boolean(selectedTenantId) && membersQuery.isError;
  const loading = tenantsQuery.isLoading || (Boolean(selectedTenantId) && membersQuery.isLoading);
  const hasTenantDirectory = !platformUnavailable && !tenantsQuery.isLoading && tenants.length > 0;
  const canListMembers = hasTenantDirectory && Boolean(selectedTenantId) && !membersUnavailable && !membersQuery.isLoading;

  return (
    <AxiCrud
      dataSource={memberRows}
      key={selectedTenantId || 'no-tenant'}
      permission={{ add: Boolean(selectedTenantId), page: Boolean(selectedTenantId), update: Boolean(selectedTenantId) }}
      ref={crudRef}
      service={service}
    >
      <DesktopCrudFrame
        ariaLabel="成员与角色"
        className="authority-status"
        search={canListMembers ? (
          <Input
            allowClear
            aria-label="搜索成员或角色"
            placeholder="搜索成员或角色"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        ) : undefined}
        toolbar={hasTenantDirectory ? (
          <Space size={6} wrap>
            <Select
              aria-label="选择组织"
              loading={tenantsQuery.isFetching}
              options={tenantOptions}
              placeholder="选择组织"
              value={selectedTenantId || undefined}
              onChange={setTenantId}
            />
            <Button disabled={!selectedTenantId || membersQuery.isFetching} size="small" onClick={refresh}>
              {membersQuery.isFetching ? '同步中…' : '刷新'}
            </Button>
            {canListMembers ? (
              <Button
                disabled={saveMember.isPending}
                size="small"
                type="primary"
                onClick={() => crudRef.current?.rowAdd()}
              >
                添加成员
              </Button>
            ) : null}
          </Space>
        ) : undefined}
      >
        {platformUnavailable ? (
          <ControlPlaneState
            description="无法从 Platform Core 获取当前主体可管理的组织；未显示静态角色或本地样例。"
            title="组织访问数据暂不可用"
          />
        ) : loading ? (
          <ControlPlaneState
            description="正在读取当前主体的组织和成员角色。"
            loading
            title="正在同步成员与角色"
          />
        ) : membersUnavailable ? (
          <ControlPlaneState
            description="组织已选定，但成员目录读取失败；请检查当前组织权限或平台服务状态。"
            title="成员目录暂不可用"
          />
        ) : !selectedTenantId ? (
          <ControlPlaneState
            description="当前主体尚未加入可管理的组织，因此没有可编辑的成员或角色。"
            title="没有可管理的组织"
          />
        ) : (
          <AxiTableGroup
            description={memberRows.length
              ? '成员与角色来自 Platform Core；保存操作由服务端重新鉴权并写入审计。'
              : '该组织当前没有成员记录。可通过“添加成员”写入已授权的身份主体。'}
            title="成员与角色"
          >
            <AxiCrudTable
              columns={memberColumns}
              data={visibleRows}
              operationButtons={['edit']}
              pagination={false}
              rowKey="subject"
              rowSelection={false}
              storageKey="axi-workbench:tenant-members"
              toolbar={{ layout: ['size', 'columns', 'style'], storageKey: 'axi-workbench:tenant-members', visible: true }}
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
