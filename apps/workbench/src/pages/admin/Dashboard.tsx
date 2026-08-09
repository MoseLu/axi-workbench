import React, { useMemo } from 'react';
import { Button, Input, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AxiCrud,
  AxiCrudTable,
  AxiTable,
  AxiTableGroup,
  type AxiTableColumn,
  type AxiTableOpButton,
} from '@axi/crud';
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
import { desktopCrudPagination } from './tenantMemberCrud';
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
  const [keywordDraft, setKeywordDraft] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<'all' | 'available' | 'attention'>('all');
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
  const filteredProjectRows = useMemo(
    () => filterProjectRows(projectRows, { keyword, state: stateFilter }),
    [keyword, projectRows, stateFilter],
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
    { alwaysVisible: true, title: '序号', type: 'index', width: 64 },
    { align: 'left', dataIndex: 'label', title: '项目', width: 280 },
    {
      dataIndex: 'state',
      dict: [
        { color: 'green', label: '可用', value: '可用' },
        { color: 'orange', label: '待校验', value: '待校验' },
      ],
      title: '状态',
      width: 110,
    },
    { dataIndex: 'workspace', title: '工作区状态', width: 160 },
    { align: 'left', dataIndex: 'branch', title: '分支', width: 180 },
    { alwaysVisible: true, title: '操作', type: 'op', width: 92 },
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
  const projectOperationButtons = useMemo<AxiTableOpButton<ProjectRow>[]>(
    () => [{
      key: 'open',
      label: '查看',
      tone: 'primary',
      type: 'link',
      onClick: ({ row }) => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
    }],
    [navigate],
  );

  const runSearch = () => setKeyword(keywordDraft.trim());
  const showError = Boolean(error && !snapshot);
  const showLoading = Boolean(isLoading && !snapshot);

  return (
    <AxiCrud dataSource={filteredProjectRows} permission={{ extraFields: { page: true, list: true, info: true, add: false, update: false, delete: false } }}>
      <DesktopCrudFrame
        ariaLabel="概览"
        className="dashboard-crud"
        description="统一查看已登记项目的健康状态、工作区变更和当前分支。"
        filters={!showError && !showLoading ? (
          <Select
            aria-label="项目状态筛选"
            options={[
              { label: '全部项目', value: 'all' },
              { label: '可用', value: 'available' },
              { label: '待校验', value: 'attention' },
            ]}
            value={stateFilter}
            onChange={(value) => setStateFilter(value as typeof stateFilter)}
          />
        ) : undefined}
        search={!showError && !showLoading ? (
          <div className="wb-crud-search-cluster">
            <Input
              allowClear
              aria-label="搜索项目"
              placeholder="搜索项目、分支或工作区状态"
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
        title="项目目录"
        top={(
          <div className="wb-crud-action-cluster">
            <Button disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? '同步中…' : '刷新'}
            </Button>
            <span className="wb-crud-page__readonly-hint">只读控制面投影</span>
          </div>
        )}
      >
        {showError ? (
          <ControlPlaneState
            actionLabel="重新连接"
            actionLoading={isFetching}
            description="当前无法连接控制面（默认 http://127.0.0.1:8092）。请确认 control-plane 已启动后点击重新连接。"
            title="概览数据暂不可用"
            onAction={() => void refetch()}
          />
        ) : showLoading ? (
          <ControlPlaneState description="正在从控制面读取概览数据。" loading title="正在同步概览" />
        ) : (
          <div className="dashboard-crud__grid">
            <AxiTableGroup
              className="dashboard-crud__projects"
              description={`显示 ${filteredProjectRows.length} / ${projectRows.length} 个已登记项目`}
              title="项目"
            >
              <AxiCrudTable
                columns={projectColumns}
                data={filteredProjectRows}
                operationButtons={projectOperationButtons}
                pagination={desktopCrudPagination(filteredProjectRows.length)}
                rowKey="id"
                rowSelection={false}
                storageKey="axi-workbench:dashboard-projects"
                toolbar={{
                  layout: ['size', 'columns', 'style'],
                  storageKey: 'axi-workbench:dashboard-projects',
                  visible: true,
                }}
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
    </AxiCrud>
  );
};

function filterProjectRows(
  rows: ProjectRow[],
  options: { keyword: string; state: 'all' | 'available' | 'attention' },
): ProjectRow[] {
  const normalized = options.keyword.trim().toLocaleLowerCase('zh-CN');
  return rows.filter((row) => {
    if (options.state === 'available' && row.state !== '可用') return false;
    if (options.state === 'attention' && row.state === '可用') return false;
    if (!normalized) return true;
    return [row.label, row.branch, row.state, row.workspace]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(normalized);
  });
}

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
