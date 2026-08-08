import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  type ProjectResource,
} from './workspaceRegistry';
import './ProjectDetail.css';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = decodeURIComponent(id || '');
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const project = projects.find((item) => getProjectResourceId(item) === projectId);
  const agentTasks = (snapshot?.agentTasks ?? []).filter((task) => task.targetId === projectId);

  if (isLoading) return <ProjectDetailSkeleton />;

  if (error && !project) {
    return (
      <ProjectDetailState
        actionLabel="重新连接"
        description={error instanceof Error ? error.message : '项目状态暂时无法同步。'}
        icon="notification"
        onAction={() => void refetch()}
        onBack={() => navigate('/admin/project')}
        title="控制面暂不可用"
      />
    );
  }

  if (!project) {
    return (
      <ProjectDetailState
        description="该项目未出现在最新控制面快照中。它可能尚未接入工作区图谱，或已被移除。"
        icon="project"
        onBack={() => navigate('/admin/project')}
        title="未找到该项目"
      />
    );
  }

  return (
    <ProjectDetailView
      agentTasks={agentTasks}
      isFetching={isFetching}
      onBack={() => navigate('/admin/project')}
      onRefresh={() => void refetch()}
      project={project}
    />
  );
};

const ProjectDetailView: React.FC<{
  agentTasks: Array<{ id: string; runtime: string; status: string; summary?: string; prompt?: string; createdAt?: Date | string }>;
  isFetching: boolean;
  onBack: () => void;
  onRefresh: () => void;
  project: ProjectResource;
}> = ({ agentTasks, isFetching, onBack, onRefresh, project }) => {
  const projectId = getProjectResourceId(project);
  const git = getProjectGitStatus(project);
  const consumers = getProjectConsumers(project);
  const attention = projectNeedsAttention(project);
  const status = project.status === 'available' ? '可用' : project.status || '待校验';

  return (
    <main className="project-detail" aria-labelledby="project-detail-title">
      <div className="project-detail__nav">
        <button onClick={onBack} type="button"><WorkbenchIcon name="back" size={15} /> 返回项目</button>
        <button className="project-detail__refresh" disabled={isFetching} onClick={onRefresh} type="button">
          {isFetching ? '同步中…' : '刷新状态'}
        </button>
      </div>

      <header className={`project-detail__hero${attention ? ' is-attention' : ''}`}>
        <span className="project-detail__mark"><WorkbenchIcon name="project" size={23} /></span>
        <div className="project-detail__heading">
          <div className="project-detail__heading-line">
            <h1 id="project-detail-title">{getProjectResourceLabel(project)}</h1>
            <span className={`project-detail__status${project.status === 'available' ? ' is-available' : ''}`}><i aria-hidden="true" />{status}</span>
          </div>
          <code>{projectId}</code>
          <p>{getProjectResourceSummary(project)}</p>
        </div>
        <dl className="project-detail__headline-stats">
          <DetailMetric label="受管命令" value={`${project.commands.length}`} />
          <DetailMetric label="关联任务" value={`${agentTasks.length}`} />
          <DetailMetric label="依赖项目" value={`${project.consumes.length}`} />
        </dl>
      </header>

      <div className="project-detail__grid">
        <section className="project-detail__panel project-detail__panel--workspace">
          <PanelTitle icon="workspace" title="工作区状态" />
          <dl className="project-detail__facts">
            <DetailFact label="资源类型" value={project.kind} />
            <DetailFact label="所属层级" value={project.layer || 'software'} />
            <DetailFact label="当前分支" value={git.branch || '未登记'} />
            <DetailFact label="工作区改动" value={git.changedEntries > 0 ? `${git.changedEntries} 项` : git.clean === false ? '待检查' : '干净'} />
            <DetailFact label="资源路径" value={project.path || '未登记'} wide />
          </dl>
        </section>

        <section className="project-detail__panel">
          <PanelTitle icon="settings" title="依赖与消费关系" />
          <DetailTagGroup emptyLabel="暂无下游消费方" label="消费方" values={consumers} />
          <DetailTagGroup emptyLabel="暂无上游依赖" label="依赖" values={project.consumes} />
          <DetailTagGroup emptyLabel="暂无契约记录" label="契约" values={project.contracts} />
        </section>

        <section className="project-detail__panel">
          <PanelTitle icon="check" title="已提供能力" />
          <DetailTagGroup emptyLabel="暂无对外能力记录" label="能力" values={project.provides} prominent />
          <div className="project-detail__command-summary">
            <span><WorkbenchIcon name="workspace" size={15} /></span>
            <p>
              <strong>{project.commands.length} 个受管命令</strong>
              <small>命令仅由控制面调度，本页展示项目状态，不直接执行工作区操作。</small>
            </p>
          </div>
        </section>

        <section className="project-detail__panel project-detail__panel--tasks">
          <PanelTitle icon="notification" title="关联任务" />
          {agentTasks.length > 0 ? (
            <div className="project-detail__tasks">
              {agentTasks.slice(0, 6).map((task) => (
                <article key={task.id}>
                  <span className={`project-detail__task-status is-${task.status}`} />
                  <div>
                    <strong>{task.summary || task.prompt || '受管任务'}</strong>
                    <small>{task.runtime} · {task.status}{task.createdAt ? ` · ${formatTaskTime(task.createdAt)}` : ''}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="project-detail__empty">
              <WorkbenchIcon name="workspace" size={18} />
              <span>当前没有关联到此项目的受管任务。</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

const PanelTitle: React.FC<{ icon: 'workspace' | 'settings' | 'check' | 'notification'; title: string }> = ({ icon, title }) => (
  <h2 className="project-detail__panel-title"><WorkbenchIcon name={icon} size={16} />{title}</h2>
);

const DetailMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><dt>{label}</dt><dd>{value}</dd></div>
);

const DetailFact: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={wide ? 'is-wide' : undefined}><dt>{label}</dt><dd title={value}>{value}</dd></div>
);

const DetailTagGroup: React.FC<{ emptyLabel: string; label: string; prominent?: boolean; values: string[] }> = ({ emptyLabel, label, prominent = false, values }) => (
  <div className={`project-detail__tag-group${prominent ? ' is-prominent' : ''}`}>
    <span>{label}</span>
    <div>
      {values.length > 0 ? values.map((value) => <em key={value} title={value}>{value}</em>) : <small>{emptyLabel}</small>}
    </div>
  </div>
);

const ProjectDetailState: React.FC<{
  actionLabel?: string;
  description: string;
  icon: 'notification' | 'project';
  onAction?: () => void;
  onBack: () => void;
  title: string;
}> = ({ actionLabel, description, icon, onAction, onBack, title }) => (
  <main className="project-detail project-detail--state">
    <button className="project-detail__back-plain" onClick={onBack} type="button"><WorkbenchIcon name="back" size={15} /> 返回项目</button>
    <section className="project-detail__state-panel">
      <span><WorkbenchIcon name={icon} size={22} /></span>
      <h1>{title}</h1>
      <p>{description}</p>
      {actionLabel && onAction ? <button onClick={onAction} type="button">{actionLabel}</button> : null}
    </section>
  </main>
);

const ProjectDetailSkeleton: React.FC = () => (
  <main className="project-detail" aria-label="正在加载项目详情">
    <div className="project-detail__skeleton project-detail__skeleton--nav" />
    <div className="project-detail__skeleton project-detail__skeleton--hero" />
    <div className="project-detail__skeleton-grid">
      {[0, 1, 2, 3].map((index) => <div className="project-detail__skeleton" key={index} />)}
    </div>
  </main>
);

function formatTaskTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default ProjectDetail;
