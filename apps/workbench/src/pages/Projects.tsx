import React, { useMemo, useState } from 'react';
import { Button, Input, Segmented, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import { useI18n } from '../i18n';
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
import { ControlPlaneState } from './admin/ControlPlaneState';
import './Projects.css';

type ProjectFilter = 'all' | 'available' | 'attention';

type ProjectRow = {
  branch: string;
  id: string;
  label: string;
  state: string;
  workspace: string;
};

type ProjectsContextValue = {
  projectStateAvailable: string;
  projectStateUnknown: string;
  projectBranchUnregistered: string;
  projectWorkspaceChanges: string;
  projectWorkspacePending: string;
  projectWorkspaceClean: string;
};

/** 项目目录使用共享表格、检索和筛选，不再将项目呈现为手机式单列卡片。 */
const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [query, setQuery] = useState('');
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const projectFilters: Array<{ label: string; value: ProjectFilter }> = [
    { label: t('projects.filter.all'), value: 'all' },
    { label: t('projects.filter.available'), value: 'available' },
    { label: t('projects.filter.attention'), value: 'attention' },
  ];
  const visibleProjects = useMemo(
    () => filterProjects(projects, filter, query),
    [filter, projects, query],
  );
  const projectState: ProjectsContextValue = {
    projectStateAvailable: t('projects.state.available'),
    projectStateUnknown: t('projects.state.unknown'),
    projectBranchUnregistered: t('projects.branch.unregistered'),
    projectWorkspaceChanges: t('projects.workspace.changes'),
    projectWorkspacePending: t('projects.workspace.pending'),
    projectWorkspaceClean: t('projects.workspace.clean'),
  };
  const rows = useMemo<ProjectRow[]>(
    () => visibleProjects.map((project) => toProjectRow(project, projectState)),
    [visibleProjects, projectState],
  );
  const columns: AxiTableColumn<ProjectRow>[] = [
    { dataIndex: 'label', title: t('projects.column.label'), width: 300 },
    { dataIndex: 'state', title: t('projects.column.state'), width: 110 },
    { dataIndex: 'workspace', title: t('projects.column.workspace'), width: 170 },
    { dataIndex: 'branch', title: t('projects.column.branch') },
    {
      align: 'right',
      key: 'action',
      render: (_, row) => <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.id)}`)}>{t('projects.column.action')}</Button>,
      title: t('projects.column.actionHeader'),
      width: 100,
    },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel={t('projects.title')}
      className="projects-crud"
      search={(
        <Input
          allowClear
          aria-label={t('projects.search.ariaLabel')}
          placeholder={t('projects.search.placeholder')}
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
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>{isFetching ? t('projects.refreshing') : t('projects.refresh')}</Button>
        </Space>
      )}
    >
      {error ? (
        <ControlPlaneState
          description={t('projects.error.description')}
          title={t('projects.error.title')}
        />
      ) : isLoading ? (
        <ControlPlaneState description={t('projects.loading.description')} loading title={t('projects.loading.title')} />
      ) : (
        <AxiTableGroup description={`${rows.length}${t('projects.count')}`} title={t('projects.title')}>
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
      )}
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

function toProjectRow(project: ProjectResource, ctx: ProjectsContextValue): ProjectRow {
  const git = getProjectGitStatus(project);
  return {
    branch: git.branch || ctx.projectBranchUnregistered,
    id: getProjectResourceId(project),
    label: getProjectResourceLabel(project),
    state: project.status === 'available' ? ctx.projectStateAvailable : project.status || ctx.projectStateUnknown,
    workspace: git.changedEntries > 0
      ? ctx.projectWorkspaceChanges.replace('{value}', `${git.changedEntries}`)
      : git.clean === false
        ? ctx.projectWorkspacePending
        : ctx.projectWorkspaceClean,
  };
}

export default Projects;
