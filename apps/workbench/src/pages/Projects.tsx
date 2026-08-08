import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import { WorkbenchIcon } from '../components/WorkbenchIcon';
import {
  getProjectConsumers,
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResourceSummary,
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
  const projectIds = useMemo(() => new Set(projects.map(getProjectResourceId)), [projects]);
  const availableCount = projects.filter((project) => project.status === 'available').length;
  const attentionCount = projects.filter(projectNeedsAttention).length;
  const commandCount = projects.reduce((count, project) => count + project.commands.length, 0);
  const activeTaskCount = (snapshot?.agentTasks ?? []).filter((task) => task.targetId && projectIds.has(task.targetId)).length;

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
    <main className="projects-page" aria-labelledby="projects-page-title">
      <header className="projects-page__hero">
        <div className="projects-page__hero-copy">
          <span className="projects-page__eyebrow">WORKBENCH · PROJECT INDEX</span>
          <h1 id="projects-page-title">项目</h1>
          <p>来自控制面的已登记项目。状态、分支、依赖与受管命令均以实时快照为准。</p>
        </div>
        <div className="projects-page__hero-actions">
          <span className={`projects-page__source${snapshot ? ' is-connected' : ''}`}>
            <i aria-hidden="true" />
            {snapshot ? '控制面已连接' : '等待控制面连接'}
          </span>
          <button className="projects-page__refresh" disabled={isFetching} onClick={() => void refetch()} type="button">
            {isFetching ? '同步中…' : '刷新状态'}
          </button>
        </div>
      </header>

      <section className="projects-stats" aria-label="项目状态摘要">
        <ProjectStat icon="project" label="登记项目" value={projects.length} tone="brand" />
        <ProjectStat icon="check" label="可用" value={availableCount} tone="success" />
        <ProjectStat icon="notification" label="需关注" value={attentionCount} tone="warning" />
        <ProjectStat icon="workspace" label="进行任务" value={activeTaskCount} hint={`${commandCount} 个受管命令`} tone="violet" />
      </section>

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
          <span className="projects-catalog__count">显示 {visibleProjects.length} / {projects.length}</span>
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
          <div className="projects-grid">
            {visibleProjects.map((project) => (
              <ProjectCard
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

const ProjectStat: React.FC<{
  icon: 'project' | 'check' | 'notification' | 'workspace';
  label: string;
  value: number;
  hint?: string;
  tone: 'brand' | 'success' | 'warning' | 'violet';
}> = ({ icon, label, value, hint, tone }) => (
  <article className={`projects-stat projects-stat--${tone}`}>
    <span className="projects-stat__icon"><WorkbenchIcon name={icon} size={18} /></span>
    <span className="projects-stat__copy">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </span>
  </article>
);

const ProjectCard: React.FC<{ project: ProjectResource; onOpen: () => void }> = ({ project, onOpen }) => {
  const git = getProjectGitStatus(project);
  const consumers = getProjectConsumers(project);
  const projectId = getProjectResourceId(project);
  const attention = projectNeedsAttention(project);
  const status = project.status === 'available' ? '可用' : project.status || '待校验';

  return (
    <button
      className={`project-card${attention ? ' is-attention' : ''}`}
      onClick={onOpen}
      type="button"
    >
      <span className="project-card__topline">
        <span className="project-card__mark"><WorkbenchIcon name="project" size={18} /></span>
        <span className={`project-card__status${project.status === 'available' ? ' is-available' : ''}`}>
          <i aria-hidden="true" />
          {status}
        </span>
      </span>
      <span className="project-card__identity">
        <strong>{getProjectResourceLabel(project)}</strong>
        <small>{projectId}</small>
      </span>
      <span className="project-card__summary">{getProjectResourceSummary(project)}</span>
      <span className="project-card__metrics" aria-label={`${projectId} 的项目状态`}>
        <ProjectMetric label="分支" value={git.branch || '未登记'} />
        <ProjectMetric label="工作区" value={git.changedEntries > 0 ? `${git.changedEntries} 项改动` : git.clean === false ? '待检查' : '干净'} />
        <ProjectMetric label="依赖" value={`${project.consumes.length} 项`} />
        <ProjectMetric label="消费方" value={`${consumers.length} 个`} />
      </span>
      <span className="project-card__capabilities">
        {project.provides.slice(0, 3).map((capability) => <em key={capability}>{capability}</em>)}
        {project.provides.length === 0 ? <em className="is-muted">尚未登记对外能力</em> : null}
      </span>
      <span className="project-card__footer">
        <span>{project.commands.length > 0 ? `${project.commands.length} 个受管命令` : '无受管命令'}</span>
        <span>查看详情 <WorkbenchIcon name="forward" size={14} /></span>
      </span>
    </button>
  );
};

const ProjectMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span>
    <small>{label}</small>
    <strong title={value}>{value}</strong>
  </span>
);

const ProjectSkeletons: React.FC = () => (
  <div className="projects-grid" aria-label="正在加载项目">
    {[0, 1, 2, 3, 4, 5].map((index) => <div className="project-card project-card--skeleton" key={index} />)}
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
