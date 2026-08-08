import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import { WorkbenchIcon } from '../components/WorkbenchIcon';
import {
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  projectNeedsAttention,
  projectSearchText,
  type ProjectResource,
} from './workspaceRegistry';
import './Projects.css';

type ProjectFilter = 'all' | 'available' | 'attention';

const projectFilters: Array<{ id: ProjectFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'available', label: '可用' },
  { id: 'attention', label: '需关注' },
];

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [query, setQuery] = useState('');

  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    return projects.filter((project) => {
      if (filter === 'available' && project.status !== 'available') return false;
      if (filter === 'attention' && !projectNeedsAttention(project)) return false;
      return !normalizedQuery || projectSearchText(project).includes(normalizedQuery);
    });
  }, [filter, projects, query]);

  const errorMessage = error instanceof Error ? error.message : '项目状态暂时无法同步。';

  return (
    <main className="projects-page" aria-label="项目">
      <section className="projects-catalog" aria-label="项目目录">
        <div className="projects-catalog__toolbar">
          <label className="projects-search">
            <WorkbenchIcon name="search" size={16} />
            <input
              aria-label="搜索项目"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索项目 ID、名称或能力"
              type="search"
              value={query}
            />
          </label>
          <div className="projects-filter" aria-label="项目状态筛选">
            {projectFilters.map((item) => (
              <button
                aria-pressed={filter === item.id}
                className={filter === item.id ? 'is-active' : undefined}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="projects-catalog__count">{visibleProjects.length} 个项目</span>
          <button className="projects-page__refresh" disabled={isFetching} onClick={() => void refetch()} type="button">
            {isFetching ? '同步中…' : '刷新'}
          </button>
        </div>

        {isLoading ? (
          <ProjectSkeletons />
        ) : error && projects.length === 0 ? (
          <StatePanel
            actionLabel="重新连接"
            description={errorMessage}
            icon="notification"
            onAction={() => void refetch()}
            title="控制面暂不可用"
          />
        ) : projects.length === 0 ? (
          <StatePanel
            description="控制面已响应，但当前没有登记的软件层项目。项目接入工作区图谱后会自动出现在这里。"
            icon="project"
            title="暂无登记项目"
          />
        ) : visibleProjects.length === 0 ? (
          <StatePanel
            description="换一个关键词或状态筛选条件，继续查找已登记的项目。"
            icon="search"
            onAction={() => {
              setFilter('all');
              setQuery('');
            }}
            actionLabel="清除筛选"
            title="没有匹配的项目"
          />
        ) : (
          <div className="projects-list">
            {visibleProjects.map((project) => (
              <ProjectRow
                key={getProjectResourceId(project)}
                onOpen={() => navigate(`/admin/project/${encodeURIComponent(getProjectResourceId(project))}`)}
                project={project}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

const ProjectRow: React.FC<{ project: ProjectResource; onOpen: () => void }> = ({ project, onOpen }) => {
  const git = getProjectGitStatus(project);
  const projectId = getProjectResourceId(project);
  const status = project.status === 'available' ? '可用' : project.status || '待校验';
  const workspaceState = git.changedEntries > 0
    ? `工作区有 ${git.changedEntries} 项改动`
    : git.clean === false
      ? '工作区待检查'
      : '工作区正常';

  return (
    <button
      className="project-row"
      onClick={onOpen}
      type="button"
    >
      <span className="project-row__mark"><WorkbenchIcon name="project" size={17} /></span>
      <span className="project-row__identity">
        <strong>{getProjectResourceLabel(project)}</strong>
        <small>{workspaceState}</small>
      </span>
      <span className={`project-row__status${project.status === 'available' ? ' is-available' : ''}`}>
        <i aria-hidden="true" />
        {status}
      </span>
      <WorkbenchIcon aria-label={`${projectId} 详情`} name="forward" size={15} />
    </button>
  );
};

const ProjectSkeletons: React.FC = () => (
  <div className="projects-list" aria-label="正在加载项目">
    {[0, 1, 2, 3, 4, 5].map((index) => <div className="project-row project-row--skeleton" key={index} />)}
  </div>
);

const StatePanel: React.FC<{
  actionLabel?: string;
  description: string;
  icon: 'notification' | 'project' | 'search';
  onAction?: () => void;
  title: string;
}> = ({ actionLabel, description, icon, onAction, title }) => (
  <div className="projects-state-panel">
    <span><WorkbenchIcon name={icon} size={22} /></span>
    <h2>{title}</h2>
    <p>{description}</p>
    {actionLabel && onAction ? <button onClick={onAction} type="button">{actionLabel}</button> : null}
  </div>
);

export default Projects;
