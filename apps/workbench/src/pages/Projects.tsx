import React, { useMemo, useState } from 'react';
import { Alert, Button, Input, Segmented, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import {
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  projectNeedsAttention,
  projectSearchText,
  type ProjectResource,
} from './workspaceRegistry';
import { DesktopCrudFrame } from './admin/DesktopCrudFrame';
import './Projects.css';

type ProjectFilter = 'all' | 'available' | 'attention';

type ProjectRow = {
  branch: string;
  id: string;
  label: string;
  state: string;
  workspace: string;
};

const projectFilters: Array<{ label: string; value: ProjectFilter }> = [
  { label: '全部', value: 'all' },
  { label: '可用', value: 'available' },
  { label: '需关注', value: 'attention' },
];

/** 项目目录使用共享表格、检索和筛选，不再将项目呈现为手机式单列卡片。 */
const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [query, setQuery] = useState('');
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const visibleProjects = useMemo(
    () => filterProjects(projects, filter, query),
    [filter, projects, query],
  );
  const rows = useMemo<ProjectRow[]>(
    () => visibleProjects.map((project) => toProjectRow(project)),
    [visibleProjects],
  );
  const errorMessage = '项目数据暂时不可用，请稍后刷新。';
  const columns: AxiTableColumn<ProjectRow>[] = [
    { dataIndex: 'label', title: '项目', width: 300 },
    { dataIndex: 'state', title: '状态', width: 110 },
    { dataIndex: 'workspace', title: '工作区状态', width: 170 },
    { dataIndex: 'branch', title: '分支' },
    {
      align: 'right',
      key: 'action',
      render: (_, row) => <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.id)}`)}>查看详情</Button>,
      title: '操作',
      width: 100,
    },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="项目"
      className="projects-crud"
      search={(
        <Input
          allowClear
          aria-label="搜索项目"
          placeholder="搜索项目名称或能力"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      toolbar={(
        <Space size={8}>
          <Segmented<ProjectFilter>
            options={projectFilters}
            size="small"
            value={filter}
            onChange={(value) => setFilter(value)}
          />
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>{isFetching ? '同步中…' : '刷新状态'}</Button>
        </Space>
      )}
    >
      {error ? <Alert message={errorMessage} showIcon type="warning" /> : null}
      <AxiTableGroup
        description={isLoading ? '正在同步控制面快照…' : `显示 ${rows.length} 个已登记项目`}
        title="项目目录"
      >
        <AxiTable
          columns={columns}
          data={rows}
          pagination={false}
          rowKey="id"
          onRow={(row) => ({
            onClick: () => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
            style: { cursor: 'pointer' },
          })}
        />
      </AxiTableGroup>
    </DesktopCrudFrame>
  );
};

function filterProjects(projects: ProjectResource[], filter: ProjectFilter, query: string): ProjectResource[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  return projects.filter((project) => {
    if (filter === 'available' && project.status !== 'available') return false;
    if (filter === 'attention' && !projectNeedsAttention(project)) return false;
    return !normalizedQuery || projectSearchText(project).includes(normalizedQuery);
  });
}

function toProjectRow(project: ProjectResource): ProjectRow {
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
}

export default Projects;
