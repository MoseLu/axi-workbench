import React, { useMemo } from 'react';
import { Button, Input, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AxiCrud,
  AxiCrudTable,
  AxiTableGroup,
  type AxiTableColumn,
  type AxiTableOpButton,
} from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import { useI18n } from '../../i18n';
import {
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
} from '../workspaceRegistry';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';
import { desktopCrudPagination } from './tenantMemberCrud';
import './Dashboard.css';

type ProjectRow = {
  branch: string;
  id: string;
  label: string;
  state: string;
  workspace: string;
};

type DashboardCopy = {
  branchUnregistered: string;
  stateAvailable: string;
  stateUnknown: string;
  workspaceChanges: string;
  workspacePending: string;
  workspaceClean: string;
};

/** 工作台概览只显示控制面快照中的可操作数据，不再用统计卡模拟桌面首页。 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const [keywordDraft, setKeywordDraft] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<'all' | 'available' | 'attention'>('all');
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const copy: DashboardCopy = {
    branchUnregistered: t('projects.branch.unregistered'),
    stateAvailable: t('projects.state.available'),
    stateUnknown: t('projects.state.unknown'),
    workspaceChanges: t('projects.workspace.changes'),
    workspacePending: t('projects.workspace.pending'),
    workspaceClean: t('projects.workspace.clean'),
  };
  const projectRows = useMemo<ProjectRow[]>(
    () => projects.map((project) => {
      const git = getProjectGitStatus(project);
      return {
        branch: git.branch || copy.branchUnregistered,
        id: getProjectResourceId(project),
        label: getProjectResourceLabel(project),
        state: project.status === 'available' ? copy.stateAvailable : project.status || copy.stateUnknown,
        workspace: git.changedEntries > 0
          ? copy.workspaceChanges.replace('{value}', `${git.changedEntries}`)
          : git.clean === false
            ? copy.workspacePending
            : copy.workspaceClean,
      };
    }),
    [copy, projects],
  );
  const filteredProjectRows = useMemo(
    () => filterProjectRows(projectRows, { keyword, state: stateFilter, availableState: copy.stateAvailable }),
    [copy.stateAvailable, keyword, projectRows, stateFilter],
  );
  const projectColumns: AxiTableColumn<ProjectRow>[] = [
    { alwaysVisible: true, title: t('projects.column.index'), type: 'index', width: 64 },
    { align: 'left', dataIndex: 'label', title: t('projects.column.label'), width: 280 },
    {
      dataIndex: 'state',
      dict: [
        { color: 'green', label: copy.stateAvailable, value: copy.stateAvailable },
        { color: 'orange', label: copy.stateUnknown, value: copy.stateUnknown },
      ],
      title: t('operations.column.status'),
      width: 110,
    },
    { dataIndex: 'workspace', title: t('projects.column.workspace'), width: 160 },
    { align: 'left', dataIndex: 'branch', title: t('projects.column.branch'), width: 180 },
    { alwaysVisible: true, title: t('projects.column.actionHeader'), type: 'op', width: 92 },
  ];
  const projectOperationButtons = useMemo<AxiTableOpButton<ProjectRow>[]>(
    () => [{
      key: 'open',
      label: t('dashboard.view'),
      tone: 'primary',
      type: 'link',
      onClick: ({ row }) => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
    }],
    [navigate, t],
  );

  const runSearch = () => setKeyword(keywordDraft.trim());
  const showError = Boolean(error && !snapshot);
  const showLoading = Boolean(isLoading && !snapshot);

  return (
    <AxiCrud dataSource={filteredProjectRows} permission={{ extraFields: { page: true, list: true, info: true, add: false, update: false, delete: false } }}>
      <DesktopCrudFrame
        ariaLabel={t('dashboard.title')}
        className="dashboard-crud"
        search={!showError && !showLoading ? (
          <div className="wb-crud-query-cluster">
            <Select
              aria-label={t('dashboard.filter.ariaLabel')}
              options={[
                { label: t('dashboard.filter.all'), value: 'all' },
                { label: copy.stateAvailable, value: 'available' },
                { label: copy.stateUnknown, value: 'attention' },
              ]}
              style={{ width: 140 }}
              value={stateFilter}
              onChange={(value) => setStateFilter(value as typeof stateFilter)}
            />
            <Input
              allowClear
              aria-label={t('dashboard.search.ariaLabel')}
              placeholder={t('dashboard.search.placeholder')}
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
            <Button disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? t('dashboard.refreshing') : t('dashboard.refresh')}
            </Button>
          </div>
        )}
      >
        {showError ? (
          <ControlPlaneState
            actionLabel={t('dashboard.error.retry')}
            actionLoading={isFetching}
            description={t('dashboard.error.description')}
            title={t('dashboard.error.title')}
            onAction={() => void refetch()}
          />
        ) : showLoading ? (
          <ControlPlaneState description={t('dashboard.loading.description')} loading title={t('dashboard.loading.title')} />
        ) : (
          <AxiTableGroup className="dashboard-crud__table">
            <AxiCrudTable
              columns={projectColumns}
              data={filteredProjectRows}
              operationButtons={projectOperationButtons}
              pagination={desktopCrudPagination(filteredProjectRows.length)}
              rowKey="id"
              rowSelection={false}
              onRow={(row) => ({
                onClick: () => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
                style: { cursor: 'pointer' },
              })}
            />
          </AxiTableGroup>
        )}
      </DesktopCrudFrame>
    </AxiCrud>
  );
};

function filterProjectRows(
  rows: ProjectRow[],
  options: { keyword: string; state: 'all' | 'available' | 'attention'; availableState: string },
): ProjectRow[] {
  const normalized = options.keyword.trim().toLocaleLowerCase('zh-CN');
  return rows.filter((row) => {
    if (options.state === 'available' && row.state !== options.availableState) return false;
    if (options.state === 'attention' && row.state === options.availableState) return false;
    if (!normalized) return true;
    return [row.label, row.branch, row.state, row.workspace]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(normalized);
  });
}

export default Dashboard;
