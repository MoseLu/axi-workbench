import React, { useMemo, useState } from 'react';
import { Button, Input, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import { useI18n } from '../../i18n';
import {
  getApprovalRiskLabel,
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  getRuntimePresentation,
  getTaskStatusLabel,
  projectNeedsAttention,
} from '../workspaceRegistry';
import { ControlPlaneState } from './ControlPlaneState';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { desktopCrudPagination } from './tenantMemberCrud';
import './Operations.css';

type AttentionRow = {
  createdAt?: Date | string;
  id: string;
  kind: string;
  priority: string;
  projectId?: string;
  projectLabel?: string;
  status: string;
  summary: string;
};

type ProjectHealthRow = {
  branch: string;
  id: string;
  label: string;
  state: string;
  workspace: string;
};

type RuntimeRow = {
  available: string;
  key: string;
  name: string;
  summary: string;
};

type ProjectFilter = 'all' | 'attention' | 'ok';

type OperationsCopy = {
  attentionKindTask: string;
  attentionKindApproval: string;
  attentionPriorityFailed: string;
  attentionPriorityPending: string;
  attentionStatusPending: string;
  attentionFallbackSummary: string;
  projectBranchUnregistered: string;
  projectStateAttention: string;
  projectStateHealthy: string;
  projectWorkspaceChanges: string;
  projectWorkspacePending: string;
  projectWorkspaceClean: string;
  runtimeAvailable: string;
  runtimeUnavailable: string;
  projectFilterAll: string;
  projectFilterAttention: string;
  projectFilterOk: string;
  unknownTime: string;
};

/**
 * Desktop-only operations view. It aggregates the real control-plane snapshot
 * across projects instead of reproducing the Mobile scanner or card flow.
 */
const Operations: React.FC = () => {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { data: snapshot, isFetching, isLoading, isError, refetch } = useControlSnapshot();
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');

  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [getProjectResourceId(project), getProjectResourceLabel(project)])),
    [projects],
  );
  const copy: OperationsCopy = {
    attentionKindTask: t('operations.attention.kind.task'),
    attentionKindApproval: t('operations.attention.kind.approval'),
    attentionPriorityFailed: t('operations.attention.priority.failed'),
    attentionPriorityPending: t('operations.attention.priority.pending'),
    attentionStatusPending: t('operations.attention.status.pending'),
    attentionFallbackSummary: t('operations.attention.fallbackSummary'),
    projectBranchUnregistered: t('projects.branch.unregistered'),
    projectStateAttention: t('operations.project.state.attention'),
    projectStateHealthy: t('operations.project.state.healthy'),
    projectWorkspaceChanges: t('projects.workspace.changes'),
    projectWorkspacePending: t('projects.workspace.pending'),
    projectWorkspaceClean: t('projects.workspace.clean'),
    runtimeAvailable: t('workspace.runtime.available'),
    runtimeUnavailable: t('operations.runtime.unavailable'),
    projectFilterAll: t('operations.filter.all'),
    projectFilterAttention: t('operations.filter.attention'),
    projectFilterOk: t('operations.filter.ok'),
    unknownTime: t('workspace.time.unknown'),
  };
  const projectStateOptions = [
    { color: 'red', label: copy.projectStateAttention, value: copy.projectStateAttention },
    { color: 'green', label: copy.projectStateHealthy, value: copy.projectStateHealthy },
  ];
  const runtimeStateOptions = [
    { color: 'green', label: copy.runtimeAvailable, value: copy.runtimeAvailable },
    { color: 'default', label: copy.runtimeUnavailable, value: copy.runtimeUnavailable },
  ];
  const attentionRows = useMemo<AttentionRow[]>(() => {
    const tasks = (snapshot?.agentTasks ?? [])
      .filter((task) => task.status === 'awaiting_approval' || task.status === 'failed')
      .map((task) => ({
        createdAt: task.createdAt,
        id: `task:${task.id}`,
        kind: copy.attentionKindTask,
        priority: task.status === 'failed' ? copy.attentionPriorityFailed : copy.attentionPriorityPending,
        projectId: task.targetId,
        projectLabel: task.targetId ? projectNames.get(task.targetId) : undefined,
        status: getTaskStatusLabel(task.status),
        summary: task.summary || task.prompt || copy.attentionFallbackSummary,
      }));
    const approvals = (snapshot?.approvals ?? [])
      .filter((approval) => approval.status === 'pending')
      .map((approval) => ({
        createdAt: approval.createdAt,
        id: `approval:${approval.id}`,
        kind: copy.attentionKindApproval,
        priority: getApprovalRiskLabel(approval.riskLevel),
        status: copy.attentionStatusPending,
        summary: approval.actionSummary,
      }));
    return [...tasks, ...approvals].sort((left, right) => asTimestamp(right.createdAt) - asTimestamp(left.createdAt));
  }, [copy, projectNames, snapshot?.agentTasks, snapshot?.approvals]);
  const projectRows = useMemo<ProjectHealthRow[]>(
    () => projects.map((project) => {
      const git = getProjectGitStatus(project);
      return {
        branch: git.branch || copy.projectBranchUnregistered,
        id: getProjectResourceId(project),
        label: getProjectResourceLabel(project),
        state: projectNeedsAttention(project) ? copy.projectStateAttention : copy.projectStateHealthy,
        workspace: git.changedEntries > 0
          ? copy.projectWorkspaceChanges.replace('{value}', `${git.changedEntries}`)
          : git.clean === false
            ? copy.projectWorkspacePending
            : copy.projectWorkspaceClean,
      };
    }),
    [copy, projects],
  );
  const runtimeRows = useMemo<RuntimeRow[]>(
    () => (snapshot?.runtimes ?? []).map((runtime) => {
      const presentation = getRuntimePresentation(runtime.kind, runtime.summary);
      return {
        available: runtime.available ? copy.runtimeAvailable : copy.runtimeUnavailable,
        key: runtime.kind,
        name: presentation.label,
        summary: presentation.summary,
      };
    }),
    [copy, snapshot?.runtimes],
  );

  const filteredAttention = useMemo(
    () => filterByKeyword(attentionRows, keyword, (row) => [row.kind, row.summary, row.status, row.priority, row.projectLabel]),
    [attentionRows, keyword],
  );
  const filteredProjects = useMemo(() => {
    const byState = projectRows.filter((row) => {
      if (projectFilter === 'attention') return row.state === copy.projectStateAttention;
      if (projectFilter === 'ok') return row.state === copy.projectStateHealthy;
      return true;
    });
    return filterByKeyword(byState, keyword, (row) => [row.label, row.state, row.workspace, row.branch]);
  }, [copy, keyword, projectFilter, projectRows]);
  const filteredRuntimes = useMemo(
    () => filterByKeyword(runtimeRows, keyword, (row) => [row.name, row.available, row.summary]),
    [keyword, runtimeRows],
  );

  const attentionColumns: AxiTableColumn<AttentionRow>[] = [
    { dataIndex: 'kind', title: t('operations.column.kind'), width: 120 },
    { dataIndex: 'summary', title: t('operations.column.summary') },
    {
      dataIndex: 'priority',
      dict: [
        { color: 'red', label: t('operations.priority.failed'), value: t('operations.priority.failed') },
        { color: 'orange', label: t('operations.priority.pending'), value: t('operations.priority.pending') },
        { color: 'default', label: t('operations.priority.confirm'), value: t('operations.priority.confirm') },
      ],
      title: t('operations.column.priority'),
      width: 120,
    },
    { dataIndex: 'status', title: t('operations.column.status'), width: 120 },
    {
      dataIndex: 'projectLabel',
      render: (value, row) => value && row.projectId
        ? <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.projectId!)}`)}>{value}</Button>
        : '—',
      title: t('operations.column.target'),
      width: 180,
    },
    { dataIndex: 'createdAt', render: (value) => formatTime(value, locale, copy.unknownTime), title: t('operations.column.updatedAt'), width: 150 },
  ];
  const projectColumns: AxiTableColumn<ProjectHealthRow>[] = [
    { dataIndex: 'label', title: t('projects.column.label') },
    { dataIndex: 'state', dict: projectStateOptions, title: t('operations.column.status'), width: 100 },
    { dataIndex: 'workspace', title: t('projects.column.workspace'), width: 150 },
    { dataIndex: 'branch', title: t('projects.column.branch'), width: 150 },
  ];
  const runtimeColumns: AxiTableColumn<RuntimeRow>[] = [
    { dataIndex: 'name', title: t('operations.column.runtime'), width: 180 },
    { dataIndex: 'available', dict: runtimeStateOptions, title: t('operations.column.status'), width: 100 },
    { dataIndex: 'summary', title: t('operations.column.summary') },
  ];

  const runSearch = () => setKeyword(keywordDraft.trim());
  const showError = isError && !snapshot;
  const showLoading = isLoading && !snapshot;

  return (
    <DesktopCrudFrame
      ariaLabel={t('operations.title')}
      className="operations-crud"
      filters={!showError && !showLoading ? (
        <Select
          aria-label={t('operations.filter.ariaLabel')}
          options={[
            { label: copy.projectFilterAll, value: 'all' },
            { label: copy.projectFilterAttention, value: 'attention' },
            { label: copy.projectFilterOk, value: 'ok' },
          ]}
          style={{ minWidth: 128 }}
          value={projectFilter}
          onChange={(value) => setProjectFilter(value as ProjectFilter)}
        />
      ) : undefined}
      search={!showError && !showLoading ? (
        <div className="wb-crud-search-cluster">
          <Input
            allowClear
            aria-label={t('operations.search.ariaLabel')}
            placeholder={t('operations.search.placeholder')}
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
          <Button loading={isFetching} onClick={() => void refetch()}>
            {t('operations.refresh')}
          </Button>
        </div>
      )}
    >
      {showError ? (
        <ControlPlaneState
          actionLabel={t('operations.error.retry')}
          actionLoading={isFetching}
          description={t('operations.error.description')}
          title={t('operations.error.title')}
          onAction={() => void refetch()}
        />
      ) : showLoading ? (
        <ControlPlaneState description={t('operations.loading.description')} loading title={t('operations.loading.title')} />
      ) : (
        <div className="operations-crud__grid">
          <div className="operations-crud__main">
            <AxiTableGroup
              className="operations-crud__attention"
              description={
                filteredAttention.length
                  ? `${filteredAttention.length}/${attentionRows.length}${t('operations.attention.count')}`
                  : attentionRows.length
                    ? t('operations.attention.emptyFiltered')
                    : t('operations.attention.emptyAll')
              }
              title={t('operations.attention.title')}
            >
              <AxiTable
                columns={attentionColumns}
                data={filteredAttention}
                pagination={desktopCrudPagination(filteredAttention.length)}
                rowKey="id"
                size="small"
              />
            </AxiTableGroup>
            <AxiTableGroup
              className="operations-crud__projects"
              description={`${filteredProjects.length}/${projectRows.length}${t('operations.projects.count')}`}
              title={t('operations.projects.title')}
            >
              <AxiTable
                columns={projectColumns}
                data={filteredProjects}
                pagination={desktopCrudPagination(filteredProjects.length)}
                rowKey="id"
                size="small"
                onRow={(row) => ({
                  onClick: () => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
                  style: { cursor: 'pointer' },
                })}
              />
            </AxiTableGroup>
          </div>
          <aside className="operations-crud__side">
            <AxiTableGroup
              className="operations-crud__runtimes"
              description={`${filteredRuntimes.length}/${runtimeRows.length}${t('operations.runtimes.count')}`}
              title={t('operations.runtimes.title')}
            >
              <AxiTable
                columns={runtimeColumns}
                data={filteredRuntimes}
                pagination={false}
                rowKey="key"
                size="small"
              />
            </AxiTableGroup>
          </aside>
        </div>
      )}
    </DesktopCrudFrame>
  );
};

function asTimestamp(value: Date | string | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatTime(value: Date | string | undefined, locale: string, unknownText: string): string {
  if (!value) return unknownText;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return unknownText;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}

function filterByKeyword<T>(
  rows: T[],
  keyword: string,
  fields: (row: T) => Array<string | undefined | null>,
): T[] {
  const normalized = keyword.trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return rows;
  return rows.filter((row) => fields(row)
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(normalized));
}

export default Operations;
