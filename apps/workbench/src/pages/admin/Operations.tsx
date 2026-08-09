import React, { useMemo } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
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

/**
 * Desktop-only operations view. It aggregates the real control-plane snapshot
 * across projects instead of reproducing the Mobile scanner or card flow.
 */
const Operations: React.FC = () => {
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
  const attentionRows = useMemo<AttentionRow[]>(() => {
    const tasks = (snapshot?.agentTasks ?? [])
      .filter((task) => task.status === 'awaiting_approval' || task.status === 'failed')
      .map((task) => ({
        createdAt: task.createdAt,
        id: `task:${task.id}`,
        kind: '受管任务',
        priority: task.status === 'failed' ? '需要处理' : '等待决定',
        projectId: task.targetId,
        projectLabel: task.targetId ? projectNames.get(task.targetId) : undefined,
        status: getTaskStatusLabel(task.status),
        summary: task.summary || task.prompt || '受管任务（暂无摘要）',
      }));
    const approvals = (snapshot?.approvals ?? [])
      .filter((approval) => approval.status === 'pending')
      .map((approval) => ({
        createdAt: approval.createdAt,
        id: `approval:${approval.id}`,
        kind: '待处理审批',
        priority: getApprovalRiskLabel(approval.riskLevel),
        status: '等待决定',
        summary: approval.actionSummary,
      }));
    return [...tasks, ...approvals].sort((left, right) => asTimestamp(right.createdAt) - asTimestamp(left.createdAt));
  }, [projectNames, snapshot?.agentTasks, snapshot?.approvals]);
  const projectRows = useMemo<ProjectHealthRow[]>(
    () => projects.map((project) => {
      const git = getProjectGitStatus(project);
      return {
        branch: git.branch || '未登记',
        id: getProjectResourceId(project),
        label: getProjectResourceLabel(project),
        state: projectNeedsAttention(project) ? '需关注' : '正常',
        workspace: git.changedEntries > 0
          ? `有 ${git.changedEntries} 项改动`
          : git.clean === false
            ? '待检查'
            : '正常',
      };
    }),
    [projects],
  );
  const runtimeRows = useMemo<RuntimeRow[]>(
    () => (snapshot?.runtimes ?? []).map((runtime) => {
      const presentation = getRuntimePresentation(runtime.kind, runtime.summary);
      return {
        available: runtime.available ? '可用' : '不可用',
        key: runtime.kind,
        name: presentation.label,
        summary: presentation.summary,
      };
    }),
    [snapshot?.runtimes],
  );

  const attentionColumns: AxiTableColumn<AttentionRow>[] = [
    { dataIndex: 'kind', title: '类型', width: 120 },
    { dataIndex: 'summary', title: '事项' },
    { dataIndex: 'priority', title: '优先级', width: 120 },
    { dataIndex: 'status', title: '状态', width: 120 },
    {
      dataIndex: 'projectLabel',
      render: (value, row) => value && row.projectId
        ? <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.projectId!)}`)}>{value}</Button>
        : '—',
      title: '关联项目',
      width: 180,
    },
    { dataIndex: 'createdAt', render: (value) => formatTime(value), title: '更新时间', width: 150 },
  ];
  const projectColumns: AxiTableColumn<ProjectHealthRow>[] = [
    { dataIndex: 'label', title: '项目' },
    { dataIndex: 'state', title: '状态', width: 100 },
    { dataIndex: 'workspace', title: '工作区状态', width: 150 },
    { dataIndex: 'branch', title: '分支', width: 150 },
  ];
  const runtimeColumns: AxiTableColumn<RuntimeRow>[] = [
    { dataIndex: 'name', title: '运行环境', width: 180 },
    { dataIndex: 'available', title: '状态', width: 100 },
    { dataIndex: 'summary', title: '说明' },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="运行状态"
      className="operations-crud"
      toolbar={(
        <Button disabled={isFetching} size="small" onClick={() => void refetch()}>
          {isFetching ? '同步中…' : '刷新状态'}
        </Button>
      )}
    >
      {error ? (
        <ControlPlaneState
          description="当前无法连接控制面；项目健康、待处理事项和运行环境会在连接恢复后显示。"
          title="运行状态暂不可用"
        />
      ) : isLoading ? (
        <ControlPlaneState description="正在从控制面读取跨项目运行状态。" loading title="正在同步运行状态" />
      ) : (
        <div className="operations-crud__grid">
          <AxiTableGroup
            className="operations-crud__attention"
            description={attentionRows.length ? `共 ${attentionRows.length} 项需要处理` : '当前快照没有需要处理的任务或审批'}
            title="需要处理"
          >
            <AxiTable columns={attentionColumns} data={attentionRows} pagination={false} rowKey="id" />
          </AxiTableGroup>
          <AxiTableGroup description={`已登记 ${projectRows.length} 个项目`} title="项目健康">
            <AxiTable
              columns={projectColumns}
              data={projectRows}
              pagination={false}
              rowKey="id"
              onRow={(row) => ({
                onClick: () => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
                style: { cursor: 'pointer' },
              })}
            />
          </AxiTableGroup>
          <AxiTableGroup description={`已登记 ${runtimeRows.length} 个运行环境`} title="运行环境">
            <AxiTable columns={runtimeColumns} data={runtimeRows} pagination={false} rowKey="key" />
          </AxiTableGroup>
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

export default Operations;
