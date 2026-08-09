import React, { useMemo, useState } from 'react';
import { Button, Input, Segmented, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
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
import './Workspace.css';

export type WorkQueueFilter = 'all' | 'active' | 'attention' | 'completed';

export type TaskRow = {
  createdAt?: Date | string;
  id: string;
  runtime: string;
  status: string;
  statusKey: string;
  summary: string;
  targetId?: string;
  targetLabel?: string;
};

export type ApprovalRow = {
  createdAt?: Date | string;
  id: string;
  risk: string;
  summary: string;
};

type RuntimeRow = {
  available: string;
  key: string;
  name: string;
  summary: string;
};

const workQueueFilters: Array<{ label: string; value: WorkQueueFilter }> = [
  { label: '全部', value: 'all' },
  { label: '处理中', value: 'active' },
  { label: '需处理', value: 'attention' },
  { label: '已结束', value: 'completed' },
];

/** 软件层工作区：以可筛读的任务、审批和运行环境表格取代移动端纵向信息流。 */
const Workspace: React.FC = () => {
  const navigate = useNavigate();
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
  const taskRows = useMemo<TaskRow[]>(
    () => (snapshot?.agentTasks ?? []).map((task) => ({
      createdAt: task.createdAt,
      id: task.id,
      runtime: task.runtime,
      status: getTaskStatusLabel(task.status),
      statusKey: task.status,
      summary: task.summary || '受管任务（暂无摘要）',
      targetId: task.targetId,
      targetLabel: task.targetId ? projectNames.get(task.targetId) : undefined,
    })),
    [projectNames, snapshot?.agentTasks],
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
        available: runtime.available ? '可用' : '降级',
        key: runtime.kind,
        name: presentation.label,
        summary: presentation.summary,
      };
    }),
    [snapshot?.runtimes],
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
    { dataIndex: 'summary', title: '任务' },
    { dataIndex: 'status', title: '状态', width: 110 },
    { dataIndex: 'runtime', title: '运行环境', width: 150 },
    {
      dataIndex: 'targetLabel',
      render: (value, row) => value && row.targetId
        ? <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.targetId!)}`)}>{value}</Button>
        : '—',
      title: '关联项目',
      width: 180,
    },
    { dataIndex: 'createdAt', render: (value) => formatTime(value), title: '创建时间', width: 150 },
  ];
  const approvalColumns: AxiTableColumn<ApprovalRow>[] = [
    { dataIndex: 'summary', title: '待审批事项' },
    { dataIndex: 'risk', title: '风险级别', width: 110 },
    { dataIndex: 'createdAt', render: (value) => formatTime(value), title: '创建时间', width: 150 },
  ];
  const runtimeColumns: AxiTableColumn<RuntimeRow>[] = [
    { dataIndex: 'name', title: '运行环境', width: 180 },
    { dataIndex: 'available', title: '状态', width: 100 },
    { dataIndex: 'summary', title: '说明' },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="工作项"
      className="workspace-crud"
      search={(
        <Input
          allowClear
          aria-label="搜索工作项"
          placeholder="搜索任务、项目或审批事项"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      toolbar={(
        <Space size={8}>
          <Segmented<WorkQueueFilter>
            options={workQueueFilters}
            size="small"
            value={filter}
            onChange={(value) => setFilter(value)}
          />
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>
            {isFetching ? '同步中…' : '刷新状态'}
          </Button>
        </Space>
      )}
    >
      {error ? (
        <ControlPlaneState
          description="当前无法连接控制面；受管任务、待处理审批和运行环境会在连接恢复后显示。"
          title="工作项暂不可用"
        />
      ) : isLoading ? (
        <ControlPlaneState description="正在从控制面读取工作项数据。" loading title="正在同步工作项" />
      ) : (
        <div className="workspace-crud__grid">
          <AxiTableGroup
            className="workspace-crud__tasks"
            description={`显示 ${visibleTaskRows.length} 项受管工作项`}
            title="受管工作项"
          >
            <AxiTable columns={taskColumns} data={visibleTaskRows} pagination={false} rowKey="id" />
          </AxiTableGroup>
          <AxiTableGroup description={`显示 ${visibleApprovalRows.length} 项待处理审批`} title="待处理审批">
            <AxiTable columns={approvalColumns} data={visibleApprovalRows} pagination={false} rowKey="id" />
          </AxiTableGroup>
          <AxiTableGroup description={`共 ${runtimeRows.length} 个已登记环境`} title="关联运行环境">
            <AxiTable columns={runtimeColumns} data={runtimeRows} pagination={false} rowKey="key" />
          </AxiTableGroup>
        </div>
      )}
    </DesktopCrudFrame>
  );
};

export function filterTaskRows(rows: TaskRow[], filter: WorkQueueFilter, query: string): TaskRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  return rows.filter((row) => {
    const terminal = row.statusKey === 'succeeded' || row.statusKey === 'failed' || row.statusKey === 'cancelled';
    const needsAttention = row.statusKey === 'awaiting_approval' || row.statusKey === 'failed';
    if (filter === 'active' && terminal) return false;
    if (filter === 'attention' && !needsAttention) return false;
    if (filter === 'completed' && !terminal) return false;
    if (!normalizedQuery) return true;
    return [row.id, row.runtime, row.status, row.summary, row.targetId, row.targetLabel]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(normalizedQuery);
  });
}

export function filterApprovalRows(rows: ApprovalRow[], query: string): ApprovalRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  if (!normalizedQuery) return rows;
  return rows.filter((row) => [row.id, row.risk, row.summary]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(normalizedQuery));
}

function formatTime(value: Date | string | undefined): string {
  if (!value) return '时间未知';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}

export default Workspace;
