import React, { useMemo, useState } from 'react';
import { Button, Input, Select } from 'antd';
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

const projectStateOptions = [
  { color: 'red', label: '需关注', value: '需关注' },
  { color: 'green', label: '正常', value: '正常' },
];

const runtimeStateOptions = [
  { color: 'green', label: '可用', value: '可用' },
  { color: 'default', label: '不可用', value: '不可用' },
];

/**
 * Desktop-only operations view. It aggregates the real control-plane snapshot
 * across projects instead of reproducing the Mobile scanner or card flow.
 */
const Operations: React.FC = () => {
  const navigate = useNavigate();
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

  const filteredAttention = useMemo(
    () => filterByKeyword(attentionRows, keyword, (row) => [row.kind, row.summary, row.status, row.priority, row.projectLabel]),
    [attentionRows, keyword],
  );
  const filteredProjects = useMemo(() => {
    const byState = projectRows.filter((row) => {
      if (projectFilter === 'attention') return row.state === '需关注';
      if (projectFilter === 'ok') return row.state === '正常';
      return true;
    });
    return filterByKeyword(byState, keyword, (row) => [row.label, row.state, row.workspace, row.branch]);
  }, [keyword, projectFilter, projectRows]);
  const filteredRuntimes = useMemo(
    () => filterByKeyword(runtimeRows, keyword, (row) => [row.name, row.available, row.summary]),
    [keyword, runtimeRows],
  );

  const attentionColumns: AxiTableColumn<AttentionRow>[] = [
    { dataIndex: 'kind', title: '类型', width: 120 },
    { dataIndex: 'summary', title: '事项' },
    {
      dataIndex: 'priority',
      dict: [
        { color: 'red', label: '需要处理', value: '需要处理' },
        { color: 'orange', label: '等待决定', value: '等待决定' },
        { color: 'default', label: '需要确认', value: '需要确认' },
      ],
      title: '优先级',
      width: 120,
    },
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
    { dataIndex: 'state', dict: projectStateOptions, title: '状态', width: 100 },
    { dataIndex: 'workspace', title: '工作区状态', width: 150 },
    { dataIndex: 'branch', title: '分支', width: 150 },
  ];
  const runtimeColumns: AxiTableColumn<RuntimeRow>[] = [
    { dataIndex: 'name', title: '运行环境', width: 180 },
    { dataIndex: 'available', dict: runtimeStateOptions, title: '状态', width: 100 },
    { dataIndex: 'summary', title: '说明' },
  ];

  const runSearch = () => setKeyword(keywordDraft.trim());
  const showError = isError && !snapshot;
  const showLoading = isLoading && !snapshot;

  return (
    <DesktopCrudFrame
      ariaLabel="运行状态"
      className="operations-crud"
      filters={!showError && !showLoading ? (
        <Select
          aria-label="项目健康筛选"
          options={[
            { label: '全部项目', value: 'all' },
            { label: '需关注', value: 'attention' },
            { label: '正常', value: 'ok' },
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
            aria-label="搜索运行状态"
            placeholder="搜索事项、项目、运行环境"
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            onClear={() => {
              setKeywordDraft('');
              setKeyword('');
            }}
            onPressEnter={runSearch}
          />
          <Button type="primary" onClick={runSearch}>搜索</Button>
        </div>
      ) : undefined}
      top={(
        <div className="wb-crud-action-cluster">
          <Button loading={isFetching} onClick={() => void refetch()}>
            刷新
          </Button>
        </div>
      )}
    >
      {showError ? (
        <ControlPlaneState
          actionLabel="重新连接"
          actionLoading={isFetching}
          description="当前无法连接控制面（默认 http://127.0.0.1:8092）。请确认已执行 pnpm --filter @axi/workstation-control-plane dev，然后点击重新连接。"
          title="运行状态暂不可用"
          onAction={() => void refetch()}
        />
      ) : showLoading ? (
        <ControlPlaneState description="正在从控制面读取跨项目运行状态。" loading title="正在同步运行状态" />
      ) : (
        <div className="operations-crud__grid">
          <div className="operations-crud__main">
            <AxiTableGroup
              className="operations-crud__attention"
              description={
                filteredAttention.length
                  ? `显示 ${filteredAttention.length} / ${attentionRows.length} 项需要处理`
                  : attentionRows.length
                    ? '当前筛选条件下没有匹配事项'
                    : '当前快照没有需要处理的任务或审批'
              }
              title="需要处理"
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
              description={`显示 ${filteredProjects.length} / ${projectRows.length} 个已登记项目`}
              title="项目健康"
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
              description={`显示 ${filteredRuntimes.length} / ${runtimeRows.length} 个运行环境`}
              title="运行环境"
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
