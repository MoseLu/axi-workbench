import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import {
  getApprovalRiskLabel,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  getRuntimePresentation,
  getTaskStatusLabel,
} from '../workspaceRegistry';
import './Workspace.css';

const Workspace: React.FC = () => {
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
  const tasks = snapshot?.agentTasks ?? [];
  const pendingApprovals = (snapshot?.approvals ?? []).filter((approval) => approval.status === 'pending');
  const errorMessage = error instanceof Error ? error.message : '控制面暂时无法同步。';

  return (
    <main className="workspace-live" aria-label="工作区">
      <h1 className="workspace-live__visually-hidden">工作区</h1>
      <section className="workspace-live__toolbar" aria-label="工作区工具">
        <strong>工作区状态</strong>
        <span>{tasks.length} 项任务</span>
        <button disabled={isFetching} onClick={() => void refetch()} type="button">{isFetching ? '同步中…' : '刷新'}</button>
      </section>

      {error ? <div className="workspace-live__alert" role="status"><WorkbenchIcon name="notification" size={16} />{errorMessage}</div> : null}

      {isLoading ? <WorkspaceSkeleton /> : (
        <div className="workspace-live__sections" aria-label="工作区实时状态">
          <section className="workspace-live__section" aria-label="受管任务">
            <SectionHeader count={tasks.length} title="受管任务" />
            {tasks.length > 0 ? (
              <div className="workspace-live__task-list">
                {tasks.map((task) => {
                  const targetLabel = task.targetId ? projectNames.get(task.targetId) : undefined;
                  return (
                    <article className="workspace-live__task" key={task.id}>
                      <span className={`workspace-live__task-state is-${task.status}`} aria-hidden="true" />
                      <div className="workspace-live__task-copy">
                        <strong>{task.summary || '受管任务（暂无摘要）'}</strong>
                        <small>{getTaskStatusLabel(task.status)} · {formatTaskTime(task.createdAt)}</small>
                      </div>
                      {task.targetId && targetLabel ? (
                        <button onClick={() => navigate(`/admin/project/${encodeURIComponent(task.targetId!)}`)} type="button">{targetLabel}<WorkbenchIcon name="forward" size={13} /></button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : <EmptyPanel icon="workspace" text="当前没有受管任务。" />}
          </section>

          <section className="workspace-live__section" aria-label="待处理审批">
            <SectionHeader count={pendingApprovals.length} title="待处理审批" />
            {pendingApprovals.length > 0 ? (
              <div className="workspace-live__approval-list">
                {pendingApprovals.map((approval) => (
                  <article className="workspace-live__approval" key={approval.id}>
                    <span>{getApprovalRiskLabel(approval.riskLevel)}</span>
                    <div><strong>{approval.actionSummary}</strong><small>{formatTaskTime(approval.createdAt)}</small></div>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel icon="check" text="当前没有待处理审批。" />}
          </section>

          <section className="workspace-live__section" aria-label="运行环境">
            <SectionHeader count={(snapshot?.runtimes ?? []).length} title="运行环境" />
            {(snapshot?.runtimes ?? []).length > 0 ? (
              <div className="workspace-live__runtime-list">
                {snapshot!.runtimes.map((runtime) => {
                  const presentation = getRuntimePresentation(runtime.kind, runtime.summary);
                  return (
                    <article className="workspace-live__runtime" key={runtime.kind}>
                      <span className={`workspace-live__runtime-state${runtime.available ? ' is-available' : ''}`}><i aria-hidden="true" />{runtime.available ? '可用' : '降级'}</span>
                      <div><strong>{presentation.label}</strong><small>{presentation.summary}</small></div>
                    </article>
                  );
                })}
              </div>
            ) : <EmptyPanel icon="laptop" text="当前快照未登记运行环境。" />}
          </section>
        </div>
      )}
    </main>
  );
};

const SectionHeader: React.FC<{ count: number; title: string }> = ({ count, title }) => (
  <header className="workspace-live__section-header"><h2>{title}</h2><span>{count} 项</span></header>
);

const EmptyPanel: React.FC<{ icon: 'workspace' | 'check' | 'laptop'; text: string }> = ({ icon, text }) => (
  <div className="workspace-live__empty"><WorkbenchIcon name={icon} size={18} /><span>{text}</span></div>
);

const WorkspaceSkeleton: React.FC = () => (
  <section className="workspace-live__skeleton-list" aria-label="正在加载工作区状态">
    {[0, 1, 2, 3, 4, 5].map((index) => <div className="workspace-live__skeleton" key={index} />)}
  </section>
);

function formatTaskTime(value: Date | string | undefined): string {
  if (!value) return '时间未知';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default Workspace;
