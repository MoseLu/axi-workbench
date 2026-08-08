import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import {
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
  summarizeAgentTasks,
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
  const taskSummary = summarizeAgentTasks(tasks);
  const pendingApprovals = (snapshot?.approvals ?? []).filter((approval) => approval.status === 'pending');
  const availableRuntimes = (snapshot?.runtimes ?? []).filter((runtime) => runtime.available).length;
  const errorMessage = error instanceof Error ? error.message : '控制面暂时无法同步。';

  return (
    <main className="workspace-live" aria-labelledby="workspace-live-title">
      <header className="workspace-live__hero">
        <div>
          <span className="workspace-live__eyebrow">WORKBENCH · RUNTIME VIEW</span>
          <h1 id="workspace-live-title">工作区</h1>
          <p>这里只展示控制面登记的任务、审批和运行环境；不会从页面直接执行工作区命令。</p>
        </div>
        <div className="workspace-live__actions">
          <span className={`workspace-live__connection${snapshot ? ' is-connected' : ''}`}><i aria-hidden="true" />{snapshot ? '控制面已连接' : '等待控制面连接'}</span>
          <button disabled={isFetching} onClick={() => void refetch()} type="button">{isFetching ? '同步中…' : '刷新状态'}</button>
        </div>
      </header>

      {error ? <div className="workspace-live__alert" role="status"><WorkbenchIcon name="notification" size={16} />{errorMessage}</div> : null}

      <section className="workspace-live__metrics" aria-label="工作区任务摘要">
        <Metric icon="workspace" label="受管任务" value={taskSummary.total} tone="brand" />
        <Metric icon="check" label="进行中" value={taskSummary.active} hint={taskSummary.running ? `${taskSummary.running} 项运行中` : undefined} tone="success" />
        <Metric icon="notification" label="待审批" value={pendingApprovals.length} hint={taskSummary.awaitingApproval ? `${taskSummary.awaitingApproval} 个任务等待审批` : undefined} tone="warning" />
        <Metric icon="laptop" label="可用运行环境" value={availableRuntimes} hint={`${snapshot?.runtimes.length ?? 0} 个已登记`} tone="violet" />
      </section>

      {isLoading ? <WorkspaceSkeleton /> : (
        <section className="workspace-live__grid" aria-label="工作区实时状态">
          <section className="workspace-live__panel workspace-live__panel--tasks">
            <PanelHeader icon="workspace" title="受管任务" />
            {tasks.length > 0 ? (
              <div className="workspace-live__task-list">
                {tasks.map((task) => {
                  const targetLabel = task.targetId ? projectNames.get(task.targetId) || task.targetId : '工作区';
                  return (
                    <article className="workspace-live__task" key={task.id}>
                      <span className={`workspace-live__task-state is-${task.status}`} aria-hidden="true" />
                      <div className="workspace-live__task-copy">
                        <strong>{task.summary || '受管任务（暂无摘要）'}</strong>
                        <small>{task.runtime} · {task.status} · {formatTaskTime(task.createdAt)}</small>
                      </div>
                      {task.targetId && projectNames.has(task.targetId) ? (
                        <button onClick={() => navigate(`/admin/project/${encodeURIComponent(task.targetId!)}`)} type="button">{targetLabel}<WorkbenchIcon name="forward" size={13} /></button>
                      ) : <span className="workspace-live__task-target">{targetLabel}</span>}
                    </article>
                  );
                })}
              </div>
            ) : <EmptyPanel icon="workspace" text="当前没有受管任务。" />}
          </section>

          <section className="workspace-live__panel">
            <PanelHeader icon="notification" title="待处理审批" />
            {pendingApprovals.length > 0 ? (
              <div className="workspace-live__approval-list">
                {pendingApprovals.map((approval) => (
                  <article className="workspace-live__approval" key={approval.id}>
                    <span>{approval.riskLevel}</span>
                    <strong>{approval.actionSummary}</strong>
                    <small>{formatTaskTime(approval.createdAt)}</small>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel icon="check" text="当前没有待处理审批。" />}
          </section>

          <section className="workspace-live__panel workspace-live__panel--runtimes">
            <PanelHeader icon="laptop" title="运行环境" />
            {(snapshot?.runtimes ?? []).length > 0 ? (
              <div className="workspace-live__runtime-grid">
                {snapshot!.runtimes.map((runtime) => (
                  <article className="workspace-live__runtime" key={runtime.kind}>
                    <span className={`workspace-live__runtime-state${runtime.available ? ' is-available' : ''}`}><i aria-hidden="true" />{runtime.available ? '可用' : '降级'}</span>
                    <strong>{runtime.kind}</strong>
                    <small>{runtime.summary || runtime.fallbackKind || '已登记运行环境'}</small>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel icon="laptop" text="当前快照未登记运行环境。" />}
          </section>
        </section>
      )}
    </main>
  );
};

const Metric: React.FC<{
  icon: 'workspace' | 'check' | 'notification' | 'laptop';
  label: string;
  value: number;
  hint?: string;
  tone: 'brand' | 'success' | 'warning' | 'violet';
}> = ({ icon, label, value, hint, tone }) => (
  <article className={`workspace-live__metric workspace-live__metric--${tone}`}>
    <span><WorkbenchIcon name={icon} size={18} /></span>
    <div><small>{label}</small><strong>{value}</strong>{hint ? <em>{hint}</em> : null}</div>
  </article>
);

const PanelHeader: React.FC<{ icon: 'workspace' | 'notification' | 'laptop'; title: string }> = ({ icon, title }) => (
  <h2 className="workspace-live__panel-header"><WorkbenchIcon name={icon} size={16} />{title}</h2>
);

const EmptyPanel: React.FC<{ icon: 'workspace' | 'check' | 'laptop'; text: string }> = ({ icon, text }) => (
  <div className="workspace-live__empty"><WorkbenchIcon name={icon} size={18} /><span>{text}</span></div>
);

const WorkspaceSkeleton: React.FC = () => (
  <section className="workspace-live__grid" aria-label="正在加载工作区状态">
    {[0, 1, 2].map((index) => <div className="workspace-live__skeleton" key={index} />)}
  </section>
);

function formatTaskTime(value: Date | string | undefined): string {
  if (!value) return '时间未知';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default Workspace;
