import React, { useMemo } from 'react';
import { useControlSnapshot } from '@epap/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import { getProjectResources } from '../workspaceRegistry';
import './RoleList.css';

const RoleList: React.FC = () => {
  const { user } = useAuth();
  const { data: snapshot, error, isFetching, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const pendingApprovals = (snapshot?.approvals ?? []).filter((approval) => approval.status === 'pending');
  const managedCommandCount = projects.reduce((count, project) => count + project.commands.length, 0);
  const errorMessage = error instanceof Error ? error.message : '控制面暂时无法同步。';

  return (
    <main className="authority-status" aria-labelledby="authority-status-title">
      <header className="authority-status__hero">
        <div>
          <span className="authority-status__eyebrow">WORKBENCH · ACCESS STATUS</span>
          <h1 id="authority-status-title">角色权限</h1>
          <p>角色目录尚未接入权威身份源，因此本页只显示可验证的会话和控制面授权状态。</p>
        </div>
        <button disabled={isFetching} onClick={() => void refetch()} type="button">{isFetching ? '同步中…' : '刷新状态'}</button>
      </header>

      {error ? <div className="authority-status__alert" role="status"><WorkbenchIcon name="notification" size={16} />{errorMessage}</div> : null}

      <section className="authority-status__metrics" aria-label="权限数据源状态">
        <Metric icon="account" label="当前会话" value={user ? '已认证' : '未认证'} tone={user ? 'success' : 'warning'} />
        <Metric icon="project" label="受管项目" value={`${projects.length}`} tone="brand" />
        <Metric icon="workspace" label="受管命令" value={`${managedCommandCount}`} tone="violet" />
        <Metric icon="notification" label="待审批请求" value={`${pendingApprovals.length}`} tone={pendingApprovals.length ? 'warning' : 'success'} />
      </section>

      <section className="authority-status__grid" aria-label="权限来源说明">
        <article className="authority-status__panel">
          <h2><WorkbenchIcon name="check" size={16} />已接入事实源</h2>
          <dl>
            <SourceFact label="当前会话" value={user ? '由身份登录流程提供' : '尚未取得会话'} />
            <SourceFact label="命令审批" value="由控制面审批快照提供" />
            <SourceFact label="项目命令" value="仅由控制面调度，不在本页直接执行" />
          </dl>
        </article>
        <article className="authority-status__panel authority-status__panel--pending">
          <h2><WorkbenchIcon name="notification" size={16} />成员与角色目录</h2>
          <p>尚未有可读取的成员、角色、权限策略权威源。页面不会用管理员、编辑、访客等样例角色替代真实数据。</p>
          <span><i aria-hidden="true" />等待目录接入</span>
        </article>
      </section>
    </main>
  );
};

const Metric: React.FC<{ icon: 'account' | 'project' | 'workspace' | 'notification'; label: string; tone: 'brand' | 'success' | 'warning' | 'violet'; value: string }> = ({ icon, label, tone, value }) => (
  <article className={`authority-status__metric authority-status__metric--${tone}`}><span><WorkbenchIcon name={icon} size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article>
);

const SourceFact: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt>{label}</dt><dd>{value}</dd></div>;

export default RoleList;
