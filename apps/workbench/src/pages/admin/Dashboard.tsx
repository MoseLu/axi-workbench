import React, { useMemo } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import {
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  summarizeAgentTasks,
} from '../workspaceRegistry';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';
import './Dashboard.css';

type ProjectRow = {
  branch: string;
  id: string;
  label: string;
  state: string;
  workspace: string;
};

type TaskRow = {
  createdAt?: Date | string;
  id: string;
  runtime: string;
  status: string;
  summary: string;
};

type RuntimeRow = {
  available: string;
  key: string;
  kind: string;
  summary: string;
};

/** 工作台概览只显示控制面快照中的可操作数据，不再用统计卡模拟桌面首页。 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const projectRows = useMemo<ProjectRow[]>(
    () => projects.map((project) => {
      const git = getProjectGitStatus(project);
      return {
        branch: git.branch || '未登记',
        id: getProjectResourceId(project),
        label: getProjectResourceLabel(project),
        state: project.status === 'available' ? '可用' : project.status || '待校验',
        workspace: git.changedEntries > 0
          ? `有 ${git.changedEntries} 项改动`
          : git.clean === false
            ? '待检查'
            : '正常',
      };
    }),
    [projects],
  );
  const taskRows = useMemo<TaskRow[]>(
    () => (snapshot?.agentTasks ?? []).map((task) => ({
      createdAt: task.createdAt,
      id: task.id,
      runtime: task.runtime,
      status: task.status,
      summary: task.summary || '受管任务（暂无摘要）',
    })),
    [snapshot?.agentTasks],
  );
  const runtimeRows = useMemo<RuntimeRow[]>(
    () => (snapshot?.runtimes ?? []).map((runtime) => ({
      available: runtime.available ? '可用' : '降级',
      key: runtime.kind,
      kind: runtime.kind,
      summary: runtime.summary || runtime.fallbackKind || '已登记运行环境',
    })),
    [snapshot?.runtimes],
  );
  const taskSummary = summarizeAgentTasks(snapshot?.agentTasks ?? []);
  const projectColumns: AxiTableColumn<ProjectRow>[] = [
    { dataIndex: 'label', title: '项目', width: 260 },
    { dataIndex: 'state', title: '状态', width: 100 },
    { dataIndex: 'workspace', title: '工作区状态', width: 160 },
    { dataIndex: 'branch', title: '分支' },
  ];
  const taskColumns: AxiTableColumn<TaskRow>[] = [
    { dataIndex: 'summary', title: '任务' },
    { dataIndex: 'status', title: '状态', width: 100 },
    { dataIndex: 'runtime', title: '运行环境', width: 150 },
    { dataIndex: 'createdAt', render: (value) => formatTaskTime(value), title: '创建时间', width: 150 },
  ];
  const runtimeColumns: AxiTableColumn<RuntimeRow>[] = [
    { dataIndex: 'kind', title: '运行环境', width: 180 },
    { dataIndex: 'available', title: '状态', width: 100 },
    { dataIndex: 'summary', title: '说明' },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="概览"
      className="dashboard-crud"
      toolbar={(
        <Button disabled={isFetching} size="small" onClick={() => void refetch()}>
          {isFetching ? '同步中…' : '刷新状态'}
        </Button>
      )}
    >
      {error ? (
        <ControlPlaneState
          description="当前无法连接控制面；项目、受管任务和运行环境会在连接恢复后显示。"
          title="概览数据暂不可用"
        />
      ) : isLoading ? (
        <ControlPlaneState description="正在从控制面读取概览数据。" loading title="正在同步概览" />
      ) : (
        <div className="dashboard-crud__grid">
          <AxiTableGroup
            className="dashboard-crud__projects"
            description={`已登记 ${projectRows.length} 个项目`}
            title="项目"
          >
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

          <AxiTableGroup description={`${taskSummary.active} 项正在处理`} title="受管任务">
            <AxiTable columns={taskColumns} data={taskRows} pagination={false} rowKey="id" />
          </AxiTableGroup>

          <AxiTableGroup description={`${runtimeRows.length} 个已登记环境`} title="运行环境">
            <AxiTable columns={runtimeColumns} data={runtimeRows} pagination={false} rowKey="key" />
          </AxiTableGroup>
        </div>
      )}
    </DesktopCrudFrame>
  );
};

function formatTaskTime(value: Date | string | undefined): string {
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

export default Dashboard;
