import React, { useMemo } from 'react';
// axi-ui-escape-hatch: antd Button/Input/Select 暂时保留 — @axi/ui 暂无等价
// 的「带 allowClear + onPressEnter 的搜索框」「带 loading 的刷新按钮」组合，
// 等 @axi/widgets.AxiSearchInput 上线后再替换。
import { Button, Input, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AxiCrud,
  AxiCrudTable,
  AxiTableGroup,
  type AxiTableColumn,
  type AxiTableOpButton,
} from '@axi/crud';
import { AxiRow } from '@axi/widgets';
import { AxiViewGroup } from '@axi/shell';
import { useControlSnapshot, useRunGovernanceAutomation, useTransitionGovernanceRisk } from '@axi/api-client';
import { filterWorkbenchHomeProjects, type WorkbenchHomeProject } from '@axi/workbench-foundation';
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
import { GovernanceSummary } from './GovernanceSummary';
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
  const riskTransition = useTransitionGovernanceRisk();
  const automationRun = useRunGovernanceAutomation();
  const [keywordDraft, setKeywordDraft] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<'all' | 'available' | 'attention'>('all');
  const [dashboardSection, setDashboardSection] = React.useState<'projects' | 'governance'>('projects');
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
  const homeProjects = useMemo<WorkbenchHomeProject[]>(
    () => projects.map((project) => {
      const git = getProjectGitStatus(project);
      return {
        id: getProjectResourceId(project),
        name: getProjectResourceLabel(project),
        status: project.status === 'available' ? 'available' : project.status === 'attention' ? 'attention' : 'unknown',
        health: project.status === 'available' ? 'healthy' : 'unknown',
        summary: git.clean === false ? copy.workspacePending : copy.workspaceClean,
        branch: git.branch || null,
        workspace: { changedEntries: git.changedEntries, clean: git.clean ?? null },
      };
    }),
    [copy.workspaceClean, copy.workspacePending, projects],
  );
  const filteredHomeProjects = useMemo(
    () => filterWorkbenchHomeProjects(homeProjects, { keyword, status: stateFilter === 'attention' ? 'attention' : stateFilter === 'available' ? 'available' : 'all' }),
    [homeProjects, keyword, stateFilter],
  );
  const projectRows = useMemo<ProjectRow[]>(
    () => filteredHomeProjects.map((project) => ({
      branch: project.branch || copy.branchUnregistered,
      id: project.id,
      label: project.name,
      state: project.status === 'available' ? copy.stateAvailable : project.status === 'attention' ? copy.stateUnknown : copy.stateUnknown,
      workspace: project.workspace.changedEntries > 0
        ? copy.workspaceChanges.replace('{value}', `${project.workspace.changedEntries}`)
        : project.workspace.clean === false ? copy.workspacePending : copy.workspaceClean,
    })),
    [copy, filteredHomeProjects],
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
    <AxiCrud dataSource={projectRows} permission={{ extraFields: { page: true, list: true, info: true, add: false, update: false, delete: false } }}>
      <DesktopCrudFrame
        ariaLabel={t('dashboard.title')}
        className="dashboard-crud"
        search={!showError && !showLoading ? (
          <AxiRow className="wb-crud-query-cluster">
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
          </AxiRow>
        ) : undefined}
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
          <AxiViewGroup
            aria-label={t('dashboard.sections.ariaLabel')}
            asideAriaLabel={t('dashboard.sections.ariaLabel')}
            asideTitle={t('dashboard.sections.title')}
            asideWidth={190}
            asideMenu={[
              { key: 'projects', label: t('dashboard.sections.projects') },
              { key: 'governance', label: t('dashboard.sections.governance') },
            ]}
            asideMenuActiveKey={dashboardSection}
            className="dashboard-crud__view-group"
            onAsideMenuSelect={(key) => {
              if (key === 'projects' || key === 'governance') setDashboardSection(key);
            }}
          >
            {dashboardSection === 'projects' ? (
              <AxiTableGroup className="dashboard-crud__table">
                <AxiCrudTable
                  columns={projectColumns}
                  data={projectRows}
                  operationButtons={projectOperationButtons}
                  pagination={desktopCrudPagination(projectRows.length)}
                  rowKey="id"
                  rowSelection={false}
                  onRow={(row) => ({
                    onClick: () => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
                    style: { cursor: 'pointer' },
                  })}
                />
              </AxiTableGroup>
            ) : (
              <GovernanceSummary
                governance={snapshot?.governance}
                onAutomationRun={async (automationId) => {
                  await automationRun.mutateAsync(automationId);
                  await refetch();
                }}
                automationRunPending={automationRun.isPending}
                onRiskTransition={async ({ riskId, status, reason }) => {
                  await riskTransition.mutateAsync({ riskId, status, reason });
                  await refetch();
                }}
                riskTransitionPending={riskTransition.isPending}
              />
            )}
          </AxiViewGroup>
        )}
      </DesktopCrudFrame>
    </AxiCrud>
  );
};

export default Dashboard;
