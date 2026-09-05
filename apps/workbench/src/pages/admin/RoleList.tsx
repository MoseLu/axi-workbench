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
import { useI18n } from '../../i18n';
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

const RoleList: React.FC = () => {
  const { t } = useI18n();
  const crudRef = useRef<AxiCrudRef<TenantMemberRow>>(null);
  const [tenantId, setTenantId] = useState('');
  const [roleFilter, setRoleFilter] = useState<TenantRole | ''>('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');

  const memberFormItems = useMemo<AxiFormItem<TenantMemberRow>[]>(() => [
    {
      component: ({ disabled, form }: { disabled?: boolean; form: TenantMemberRow }) => (
        <Input
          disabled={disabled || Boolean(form.createdAt)}
          placeholder={t('authority.member.subject.placeholder')}
        />
      ),
      label: t('authority.member.subject.label'),
      prop: 'subject',
      required: true,
      rules: [
        { required: true, message: t('authority.member.subject.required') },
        { whitespace: true, message: t('authority.member.subject.whitespace') },
      ],
    },
    {
      label: t('authority.member.role.label'),
      options: tenantRoleOptions,
      prop: 'role',
      required: true,
      type: 'select',
    },
  ], [t]);

  const memberColumns = useMemo<AxiTableColumn<TenantMemberRow>[]>(() => [
    { alwaysVisible: true, title: '', type: 'selection', width: 48 },
    { alwaysVisible: true, title: t('authority.column.index'), type: 'index', width: 64 },
    { align: 'left', dataIndex: 'subject', title: t('authority.member.subject.label'), width: 280 },
    {
      dataIndex: 'role',
      dict: tenantRoleOptions,
      title: t('authority.member.role.label'),
      width: 120,
    },
    {
      dataIndex: 'updatedAt',
      render: (value: string) => formatTenantMemberTime(value),
      title: t('authority.column.updatedAt'),
      width: 176,
    },
    { alwaysVisible: true, title: t('authority.column.actions'), type: 'op', width: 100 },
  ], [t]);

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
      if (!selectedTenantId || !subject || !role) throw new Error(t('authority.member.subjectOrRoleRequired'));
      await saveMember.mutateAsync({ role, subject });
    },
    update: async (data) => {
      const member = data as TenantMemberRow | undefined;
      const subject = String(member?.subject ?? '').trim();
      const role = member?.role as TenantRole | undefined;
      if (!selectedTenantId || !subject || !role) throw new Error(t('authority.member.subjectOrRoleRequired'));
      await saveMember.mutateAsync({ role, subject });
    },
  }), [membersQuery, saveMember, selectedTenantId, t]);

  const refresh = () => {
    void tenantsQuery.refetch().then(() => {
      if (!selectedTenantId) return;
      return crudRef.current?.refresh();
    }).catch(() => {
      message.error(t('authority.refresh.failed'));
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
      message.success(t('authority.bootstrap.success').replace('{name}', tenant.name));
    } catch {
      message.error(t('authority.bootstrap.failed'));
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
        ariaLabel={t('authority.title')}
        className="authority-status"
        filters={hasTenantDirectory ? (
          <>
            <Select
              aria-label={t('authority.tenant.ariaLabel')}
              loading={tenantsQuery.isFetching}
              options={tenantOptions}
              placeholder={t('authority.tenant.placeholder')}
              style={{ minWidth: 160 }}
              value={selectedTenantId || undefined}
              onChange={setTenantId}
            />
            {canListMembers ? (
              <Select
                allowClear
                aria-label={t('authority.role.ariaLabel')}
                options={tenantRoleOptions}
                placeholder={t('authority.role.placeholder')}
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
              aria-label={t('authority.search.ariaLabel')}
              placeholder={t('authority.search.placeholder')}
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              onClear={() => {
                setKeywordDraft('');
                setKeyword('');
              }}
              onPressEnter={runSearch}
            />
            <Button type="primary" onClick={runSearch}>{t('common.search')}</Button>
          </div>
        ) : undefined}
        top={(
          <div className="wb-crud-action-cluster">
            <Button
              disabled={tenantsQuery.isFetching || membersQuery.isFetching}
              loading={tenantsQuery.isFetching || membersQuery.isFetching}
              onClick={refresh}
            >
              {t('authority.refresh')}
            </Button>
            {canListMembers ? (
              <Button
                disabled={saveMember.isPending}
                type="primary"
                onClick={() => crudRef.current?.rowAdd()}
              >
                {t('authority.add')}
              </Button>
            ) : null}
            {!platformUnavailable && !loading && !selectedTenantId ? (
              <Button
                loading={createTenant.isPending}
                type="primary"
                onClick={() => void bootstrapTenant()}
              >
                {t('authority.bootstrap.cta')}
              </Button>
            ) : null}
          </div>
        )}
      >
        {platformUnavailable ? (
          <ControlPlaneState
            actionLabel={t('authority.error.reconnect')}
            actionLoading={tenantsQuery.isFetching}
            description={t('authority.platformUnavailable.description')}
            title={t('authority.platformUnavailable.title')}
            onAction={() => void tenantsQuery.refetch()}
          />
        ) : loading ? (
          <ControlPlaneState
            description={t('authority.loading.description')}
            loading
            title={t('authority.loading.title')}
          />
        ) : membersUnavailable ? (
          <ControlPlaneState
            actionLabel={t('authority.error.retry')}
            actionLoading={membersQuery.isFetching}
            description={t('authority.membersUnavailable.description')}
            title={t('authority.membersUnavailable.title')}
            onAction={() => void membersQuery.refetch()}
          />
        ) : !selectedTenantId ? (
          <ControlPlaneState
            actionLabel={t('authority.bootstrap.cta')}
            actionLoading={createTenant.isPending}
            description={t('authority.noTenant.description')}
            title={t('authority.noTenant.title')}
            onAction={() => void bootstrapTenant()}
          />
        ) : (
          <AxiTableGroup
            description={
              visibleRows.length
                ? `${visibleRows.length}/${memberRows.length}${t('authority.count')}`
                : memberRows.length
                  ? t('authority.emptyFiltered')
                  : t('authority.emptyAll')
            }
            title={t('authority.title')}
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
            message.error(t('authority.save.failed'));
          });
        }}
      />
    </AxiCrud>
  );
};

export default RoleList;