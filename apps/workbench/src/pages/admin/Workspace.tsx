import React, { useMemo } from 'react';
import { Alert, Button } from 'antd';
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
import './Workspace.css';

type TaskRow = {
  createdAt?: Date | string;
  id: string;
  runtime: string;
  status: string;
  summary: string;
  targetId?: string;
  targetLabel?: string;
};

type ApprovalRow = {
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

/** 软件层工作区：以可筛读的任务、审批和运行环境表格取代移动端纵向信息流。 */
const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
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
  const errorMessage = '控制面暂时不可用，请稍后刷新。';

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
      ariaLabel="工作区"
      className="workspace-crud"
      toolbar={(
        <Button disabled={isFetching} size="small" onClick={() => void refetch()}>
          {isFetching ? '同步中…' : '刷新状态'}
        </Button>
      )}
    >
      {error ? <Alert message={errorMessage} showIcon type="warning" /> : null}
      <div className="workspace-crud__grid">
        <AxiTableGroup
          className="workspace-crud__tasks"
          description={isLoading ? '正在同步控制面快照…' : `共 ${taskRows.length} 项受管任务`}
          title="受管任务"
        >
          <AxiTable columns={taskColumns} data={taskRows} pagination={false} rowKey="id" />
        </AxiTableGroup>
        <AxiTableGroup description={isLoading ? '正在同步控制面快照…' : `共 ${approvalRows.length} 项待处理审批`} title="待处理审批">
          <AxiTable columns={approvalColumns} data={approvalRows} pagination={false} rowKey="id" />
        </AxiTableGroup>
        <AxiTableGroup description={isLoading ? '正在同步控制面快照…' : `共 ${runtimeRows.length} 个已登记环境`} title="运行环境">
          <AxiTable columns={runtimeColumns} data={runtimeRows} pagination={false} rowKey="key" />
        </AxiTableGroup>
      </div>
    </DesktopCrudFrame>
  );
};

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
