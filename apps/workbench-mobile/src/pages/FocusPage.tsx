import { useState } from 'react';
import { MobileIcon } from '../components/MobileIcons';
import { MobileProjectionState, formatProjectionTime } from '../components/MobileProjectionState';
import { runMobileProjectAction, useInvalidateMobileWorkspace, useMobileDeviceSession, useMobileWorkspaceQuery } from '../lib/mobileControl';

export default function FocusPage() {
  const session = useMobileDeviceSession();
  const workspace = useMobileWorkspaceQuery();
  const invalidate = useInvalidateMobileWorkspace();
  const [actionMessage, setActionMessage] = useState('');
  const [runningAction, setRunningAction] = useState('');
  const snapshot = workspace.data;

  const executeAction = async (projectId: string, actionId: string, actionType: string) => {
    setRunningAction(`${projectId}:${actionId}`);
    setActionMessage('');
    try {
      const result = await runMobileProjectAction({ projectId, actionId, actionType }) as { status?: string; actionSummary?: string };
      setActionMessage(result.status === 'pending_approval' ? '已提交审批，等待服务端决定。' : result.actionSummary || '已提交受控动作。');
      await invalidate();
    } catch {
      setActionMessage('动作未执行：请检查设备配对、权限或控制面状态。');
    } finally {
      setRunningAction('');
    }
  };

  return (
    <section className="axi-mobile-page">
      <div className="axi-mobile-page-intro axi-mobile-page-intro--with-action">
        <div><h1>工作区</h1><p>受控待办、项目状态与可执行动作。</p></div>
        {snapshot ? <button type="button" onClick={() => void workspace.refetch()}>刷新</button> : null}
      </div>
      <MobileProjectionState session={session} isLoading={workspace.isPending} error={workspace.error} onRefresh={() => void workspace.refetch()} />
      {snapshot ? (
        <>
          <p className="axi-mobile-projection-meta">控制面更新时间：{formatProjectionTime(snapshot.generatedAt)}</p>
          {actionMessage ? <p className="axi-mobile-action-result" role="status">{actionMessage}</p> : null}
          <div className="axi-mobile-section-heading"><h2>需要关注</h2></div>
          {snapshot.attentionItems.length ? <div className="axi-mobile-task-list">
            {snapshot.attentionItems.map((item) => <article className="axi-mobile-task" key={item.id}>
              <span className="axi-mobile-task__check"><MobileIcon name="bell" size={14} /></span>
              <span className="axi-mobile-task__body"><strong>{item.title}</strong><small>{item.summary}</small></span>
            </article>)}
          </div> : <div className="axi-mobile-empty-card">当前没有待处理的控制面事项。</div>}
          <div className="axi-mobile-section-heading"><h2>可执行动作</h2></div>
          <div className="axi-mobile-action-list">
            {snapshot.projects.flatMap((project) => project.actions.map((action) => ({ project, action }))).map(({ project, action }) => {
              const key = `${project.id}:${action.actionId}`;
              return <article key={key} className="axi-mobile-action-row">
                <div><strong>{action.label}</strong><small>{project.name} · {action.summary}</small></div>
                <button type="button" disabled={Boolean(runningAction)} onClick={() => void executeAction(project.id, action.actionId, action.actionType)}>{runningAction === key ? '处理中' : '执行'}</button>
              </article>;
            })}
            {!snapshot.projects.some((project) => project.actions.length) ? <div className="axi-mobile-empty-card">当前没有已登记、可由移动端执行的动作。</div> : null}
          </div>
          {snapshot.runningTasks.length ? <><div className="axi-mobile-section-heading"><h2>进行中的任务</h2></div><div className="axi-mobile-task-list">{snapshot.runningTasks.map((task) => <article key={task.id} className="axi-mobile-task"><span className="axi-mobile-task__check"><MobileIcon name="focus" size={14} /></span><span className="axi-mobile-task__body"><strong>{task.summary}</strong><small>{formatProjectionTime(task.updatedAt)}</small></span></article>)}</div></> : null}
        </>
      ) : null}
    </section>
  );
}
