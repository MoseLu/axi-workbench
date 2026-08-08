import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import type { AxiWorkbenchIconName } from '@axi/workbench-foundation/icons';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import {
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  projectNeedsAttention,
  summarizeAgentTasks,
  type ProjectResource,
} from '../workspaceRegistry';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const taskSummary = summarizeAgentTasks(snapshot?.agentTasks ?? []);
  const attentionCount = projects.filter(projectNeedsAttention).length;
  const availableRuntimeCount = (snapshot?.runtimes ?? []).filter((runtime) => runtime.available).length;
  const recentProjects = projects.slice(0, 5);
  const recentTasks = (snapshot?.agentTasks ?? []).slice(0, 4);
  const errorMessage = error instanceof Error ? error.message : '控制面暂时无法同步。';

  return (
    <main className="dashboard-live" aria-labelledby="dashboard-live-title">
      <header className="dashboard-live__hero">
        <div>
          <span className="dashboard-live__eyebrow">WORKBENCH · LIVE OVERVIEW</span>
          <h1 id="dashboard-live-title">概览</h1>
          <p>项目、任务和运行环境均来自控制面实时快照，不展示演示数据。</p>
        </div>
        <div className="dashboard-live__actions">
          <span className={`dashboard-live__connection${snapshot ? ' is-connected' : ''}`}><i aria-hidden="true" />{snapshot ? '控制面已连接' : '等待控制面连接'}</span>
          <button disabled={isFetching} onClick={() => void refetch()} type="button">{isFetching ? '同步中…' : '刷新状态'}</button>
        </div>
      </header>

      {error ? <div className="dashboard-live__alert" role="status"><WorkbenchIcon name="notification" size={16} />{errorMessage}</div> : null}

      <section className="dashboard-live__metrics" aria-label="工作台状态摘要">
        <Metric icon="project" label="登记项目" value={projects.length} tone="brand" />
        <Metric icon="notification" label="需关注" value={attentionCount} tone="warning" />
        <Metric icon="workspace" label="进行任务" value={taskSummary.active} hint={taskSummary.needsAttention ? `${taskSummary.needsAttention} 项需处理` : undefined} tone="violet" />
        <Metric icon="check" label="可用运行环境" value={availableRuntimeCount} hint={`${snapshot?.runtimes.length ?? 0} 个已登记`} tone="success" />
      </section>

      {isLoading ? <DashboardSkeleton /> : (
        <section className="dashboard-live__grid" aria-label="工作台实时数据">
          <section className="dashboard-live__panel dashboard-live__panel--projects">
            <PanelHeader actionLabel="项目目录" icon="project" onAction={() => navigate('/admin/project')} title="项目动态" />
            {recentProjects.length > 0 ? (
              <div className="dashboard-live__project-list">
                {recentProjects.map((project) => (
                  <ProjectRow
                    key={getProjectResourceId(project)}
                    onOpen={() => navigate(`/admin/project/${encodeURIComponent(getProjectResourceId(project))}`)}
                    project={project}
                  />
                ))}
              </div>
            ) : <EmptyPanel icon="project" text="控制面中还没有已登记项目。" />}
          </section>

          <section className="dashboard-live__panel dashboard-live__panel--tasks">
            <PanelHeader actionLabel="工作区" icon="workspace" onAction={() => navigate('/admin/task')} title="受管任务" />
            {recentTasks.length > 0 ? (
              <div className="dashboard-live__task-list">
                {recentTasks.map((task) => (
                  <article className="dashboard-live__task" key={task.id}>
                    <span className={`dashboard-live__task-dot is-${task.status}`} aria-hidden="true" />
                    <div>
                      <strong>{task.summary || '受管任务（暂无摘要）'}</strong>
                      <small>{task.runtime} · {task.status} · {formatTaskTime(task.createdAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel icon="workspace" text="当前没有受管任务。" />}
          </section>

          <section className="dashboard-live__panel dashboard-live__panel--runtime">
            <PanelHeader actionLabel="协作网络" icon="team" onAction={() => navigate('/admin/team')} title="运行环境" />
            {(snapshot?.runtimes ?? []).length > 0 ? (
              <div className="dashboard-live__runtime-list">
                {snapshot!.runtimes.slice(0, 6).map((runtime) => (
                  <article className="dashboard-live__runtime" key={runtime.kind}>
                    <span className={`dashboard-live__runtime-status${runtime.available ? ' is-available' : ''}`}><i aria-hidden="true" />{runtime.available ? '可用' : '降级'}</span>
                    <strong>{runtime.kind}</strong>
                    <small>{runtime.summary || runtime.fallbackKind || '已登记运行环境'}</small>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel icon="check" text="当前快照未登记运行环境。" />}
          </section>
        </section>
      )}
    </main>
  );
};

const Metric: React.FC<{
  icon: AxiWorkbenchIconName;
  label: string;
  value: number;
  hint?: string;
  tone: 'brand' | 'success' | 'warning' | 'violet';
}> = ({ icon, label, value, hint, tone }) => (
  <article className={`dashboard-live__metric dashboard-live__metric--${tone}`}>
    <span><WorkbenchIcon name={icon} size={18} /></span>
    <div><small>{label}</small><strong>{value}</strong>{hint ? <em>{hint}</em> : null}</div>
  </article>
);

const PanelHeader: React.FC<{ actionLabel: string; icon: AxiWorkbenchIconName; onAction: () => void; title: string }> = ({ actionLabel, icon, onAction, title }) => (
  <header className="dashboard-live__panel-header">
    <h2><WorkbenchIcon name={icon} size={16} />{title}</h2>
    <button onClick={onAction} type="button">{actionLabel}<WorkbenchIcon name="forward" size={13} /></button>
  </header>
);

const ProjectRow: React.FC<{ onOpen: () => void; project: ProjectResource }> = ({ onOpen, project }) => {
  const git = getProjectGitStatus(project);
  const attention = projectNeedsAttention(project);
  const projectId = getProjectResourceId(project);

  return (
    <button className="dashboard-live__project" onClick={onOpen} type="button">
      <span className={`dashboard-live__project-mark${attention ? ' is-attention' : ''}`}><WorkbenchIcon name="project" size={16} /></span>
      <span className="dashboard-live__project-copy"><strong>{getProjectResourceLabel(project)}</strong><small>{projectId} · {git.branch || '未登记分支'}</small></span>
      <span className="dashboard-live__project-state">{git.changedEntries > 0 ? `${git.changedEntries} 项改动` : project.status === 'available' ? '可用' : project.status || '待校验'}</span>
      <WorkbenchIcon name="forward" size={14} />
    </button>
  );
};

const EmptyPanel: React.FC<{ icon: AxiWorkbenchIconName; text: string }> = ({ icon, text }) => (
  <div className="dashboard-live__empty"><WorkbenchIcon name={icon} size={18} /><span>{text}</span></div>
);

const DashboardSkeleton: React.FC = () => (
  <section className="dashboard-live__grid" aria-label="正在加载控制面快照">
    {[0, 1, 2].map((index) => <div className="dashboard-live__skeleton" key={index} />)}
  </section>
);

function formatTaskTime(value: Date | string | undefined): string {
  if (!value) return '时间未知';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default Dashboard;
