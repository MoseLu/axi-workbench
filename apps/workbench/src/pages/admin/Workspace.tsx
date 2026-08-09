import React, { useMemo, useState } from 'react';
import { Button, Input, Segmented, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import { useI18n } from '../../i18n';
import {
  getApprovalRiskLabel,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  getRuntimePresentation,
  getTaskStatusLabel,
} from '../workspaceRegistry';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';
import {
  filterApprovalRows,
  filterTaskRows,
  workQueueFilters,
  type ApprovalRow,
  type TaskRow,
  type WorkQueueFilter,
} from './workQueue';
import './Workspace.css';

type RuntimeRow = {
  available: string;
  key: string;
  name: string;
  summary: string;
};

/** 软件层工作区：以可筛读的任务、审批和运行环境表格取代移动端纵向信息流。 */
const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const [filter, setFilter] = useState<WorkQueueFilter>('all');
  const [query, setQuery] = useState('');
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [getProjectResourceId(project), getProjectResourceLabel(project)])),
    [projects],
  );
  const fallbackTaskSummary = t('workspace.task.fallbackSummary');
  const runtimeAvailable = t('workspace.runtime.available');
  const runtimeDegraded = t('workspace.runtime.degraded');
  const unknownTime = t('workspace.time.unknown');
  const taskRows = useMemo<TaskRow[]>(
    () => (snapshot?.agentTasks ?? []).map((task) => ({
      createdAt: task.createdAt,
      id: task.id,
      runtime: task.runtime,
      status: getTaskStatusLabel(task.status),
      statusKey: task.status,
      summary: task.summary || fallbackTaskSummary,
      targetId: task.targetId,
      targetLabel: task.targetId ? projectNames.get(task.targetId) : undefined,
    })),
    [fallbackTaskSummary, projectNames, snapshot?.agentTasks],
  );
  const approvalRows = useMemo<ApprovalRow[]>(
    () => (snapshot?.approvals ?? [])
      .filter((approval) => approval.status === 'pending')
      .map((approval) => ({
        createdAt: approval.createdAt,
        id: approval.id,
        risk: getApprovalRiskLabel(approval.riskLevel),
        summary: approval.actionSummary,
      })),
    [snapshot?.approvals],
  );
  const runtimeRows = useMemo<RuntimeRow[]>(
    () => (snapshot?.runtimes ?? []).map((runtime) => {
      const presentation = getRuntimePresentation(runtime.kind, runtime.summary);
      return {
        available: runtime.available ? runtimeAvailable : runtimeDegraded,
        key: runtime.kind,
        name: presentation.label,
        summary: presentation.summary,
      };
    }),
    [runtimeAvailable, runtimeDegraded, snapshot?.runtimes],
  );
  const visibleTaskRows = useMemo(
    () => filterTaskRows(taskRows, filter, query),
    [filter, query, taskRows],
  );
  const visibleApprovalRows = useMemo(
    () => filterApprovalRows(approvalRows, query),
    [approvalRows, query],
  );
  const taskColumns: AxiTableColumn<TaskRow>[] = [
    { dataIndex: 'summary', title: t('workspace.column.task') },
    { dataIndex: 'status', title: t('workspace.column.status'), width: 110 },
    { dataIndex: 'runtime', title: t('workspace.column.runtime'), width: 150 },
    {
      dataIndex: 'targetLabel',
      render: (value, row) => value && row.targetId
        ? <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.targetId!)}`)}>{value}</Button>
        : '—',
      title: t('workspace.column.target'),
      width: 180,
    },
    { dataIndex: 'createdAt', render: (value) => formatTime(value, locale, unknownTime), title: t('workspace.column.createdAt'), width: 150 },
  ];
  const approvalColumns: AxiTableColumn<ApprovalRow>[] = [
    { dataIndex: 'summary', title: t('workspace.column.approval') },
    { dataIndex: 'risk', title: t('workspace.column.risk'), width: 110 },
    { dataIndex: 'createdAt', render: (value) => formatTime(value, locale, unknownTime), title: t('workspace.column.createdAt'), width: 150 },
  ];
  const runtimeColumns: AxiTableColumn<RuntimeRow>[] = [
    { dataIndex: 'name', title: t('workspace.column.runtime'), width: 180 },
    { dataIndex: 'available', title: t('workspace.column.status'), width: 100 },
    { dataIndex: 'summary', title: t('workspace.column.summary') },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel={t('workspace.title')}
      className="workspace-crud"
      search={(
        <Input
          allowClear
          aria-label={t('workspace.search.ariaLabel')}
          placeholder={t('workspace.search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      toolbar={(
        <Space size={8}>
          <Segmented<WorkQueueFilter>
            options={workQueueFilters.map((entry) => ({
              label: t(entry.labelKey),
              value: entry.value,
            }))}
            size="small"
            value={filter}
            onChange={(value) => setFilter(value)}
          />
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>
            {isFetching ? t('workspace.refreshing') : t('workspace.refresh')}
          </Button>
        </Space>
      )}
    >
      {error ? (
        <ControlPlaneState
          description={t('workspace.error.description')}
          title={t('workspace.error.title')}
        />
      ) : isLoading ? (
        <ControlPlaneState description={t('workspace.loading.description')} loading title={t('workspace.loading.title')} />
      ) : (
        <div className="workspace-crud__grid">
          <AxiTableGroup
            className="workspace-crud__tasks"
            description={`${visibleTaskRows.length}${t('workspace.tasks.count')}`}
            title={t('workspace.tasks.title')}
          >
            <AxiTable columns={taskColumns} data={visibleTaskRows} pagination={false} rowKey="id" />
          </AxiTableGroup>
          <AxiTableGroup
            description={`${visibleApprovalRows.length}${t('workspace.approvals.count')}`}
            title={t('workspace.approvals.title')}
          >
            <AxiTable columns={approvalColumns} data={visibleApprovalRows} pagination={false} rowKey="id" />
          </AxiTableGroup>
          <AxiTableGroup
            description={`${runtimeRows.length}${t('workspace.runtimes.count')}`}
            title={t('workspace.runtimes.title')}
          >
            <AxiTable columns={runtimeColumns} data={runtimeRows} pagination={false} rowKey="key" />
          </AxiTableGroup>
        </div>
      )}
    </DesktopCrudFrame>
  );
};

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

export default Workspace;
