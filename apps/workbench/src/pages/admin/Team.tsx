import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import {
  getProjectCollaborationLinks,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
} from '../workspaceRegistry';
import './Team.css';

const Team: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const collaborationLinks = useMemo(() => getProjectCollaborationLinks(projects), [projects]);
  const consumerLinkCount = collaborationLinks.reduce((count, link) => count + link.consumers.length, 0);
  const capabilityCount = projects.reduce((count, project) => count + project.provides.length, 0);
  const availableRuntimes = (snapshot?.runtimes ?? []).filter((runtime) => runtime.available).length;
  const errorMessage = error instanceof Error ? error.message : '控制面暂时无法同步。';

  return (
    <main className="team-live" aria-labelledby="team-live-title">
      <header className="team-live__hero">
        <div>
          <span className="team-live__eyebrow">WORKBENCH · COLLABORATION MAP</span>
          <h1 id="team-live-title">团队</h1>
          <p>以工作区图谱中的项目消费关系与可用运行环境呈现协作网络，不虚构未登记的成员信息。</p>
        </div>
        <div className="team-live__actions">
          <span className={`team-live__connection${snapshot ? ' is-connected' : ''}`}><i aria-hidden="true" />{snapshot ? '控制面已连接' : '等待控制面连接'}</span>
          <button disabled={isFetching} onClick={() => void refetch()} type="button">{isFetching ? '同步中…' : '刷新状态'}</button>
        </div>
      </header>

      {error ? <div className="team-live__alert" role="status"><WorkbenchIcon name="notification" size={16} />{errorMessage}</div> : null}

      <section className="team-live__metrics" aria-label="协作网络摘要">
        <Metric icon="project" label="登记项目" value={projects.length} tone="brand" />
        <Metric icon="team" label="显式协作关系" value={consumerLinkCount} tone="violet" />
        <Metric icon="check" label="已提供能力" value={capabilityCount} tone="success" />
        <Metric icon="laptop" label="可用运行环境" value={availableRuntimes} tone="warning" />
      </section>

      {isLoading ? <TeamSkeleton /> : (
        <section className="team-live__grid" aria-label="团队协作网络">
          <section className="team-live__panel team-live__panel--relationships">
            <header className="team-live__panel-header">
              <h2><WorkbenchIcon name="team" size={16} />项目协作关系</h2>
              <button onClick={() => navigate('/admin/project')} type="button">项目目录<WorkbenchIcon name="forward" size={13} /></button>
            </header>
            {collaborationLinks.length > 0 ? (
              <div className="team-live__relationship-list">
                {collaborationLinks.slice(0, 8).map((link) => (
                  <button
                    className="team-live__relationship"
                    key={getProjectResourceId(link.project)}
                    onClick={() => navigate(`/admin/project/${encodeURIComponent(getProjectResourceId(link.project))}`)}
                    type="button"
                  >
                    <span className="team-live__relationship-mark"><WorkbenchIcon name="project" size={16} /></span>
                    <span className="team-live__relationship-copy"><strong>{getProjectResourceLabel(link.project)}</strong><small>{getProjectResourceId(link.project)}</small></span>
                    <span className="team-live__consumers">{link.consumers.slice(0, 3).map((consumer) => <em key={consumer}>{consumer}</em>)}{link.consumers.length > 3 ? <em>+{link.consumers.length - 3}</em> : null}</span>
                    <WorkbenchIcon name="forward" size={14} />
                  </button>
                ))}
              </div>
            ) : <EmptyPanel icon="team" text="当前图谱中还没有声明项目消费关系。" />}
          </section>

          <section className="team-live__panel">
            <header className="team-live__panel-header"><h2><WorkbenchIcon name="laptop" size={16} />协作运行环境</h2></header>
            {(snapshot?.runtimes ?? []).length > 0 ? (
              <div className="team-live__runtime-list">
                {snapshot!.runtimes.map((runtime) => (
                  <article className="team-live__runtime" key={runtime.kind}>
                    <span className={`team-live__runtime-status${runtime.available ? ' is-available' : ''}`}><i aria-hidden="true" />{runtime.available ? '可用' : '降级'}</span>
                    <strong>{runtime.kind}</strong>
                    <small>{runtime.summary || runtime.fallbackKind || '已登记运行环境'}</small>
                  </article>
                ))}
              </div>
            ) : <EmptyPanel icon="laptop" text="当前快照未登记运行环境。" />}
          </section>

          <section className="team-live__source-note">
            <span><WorkbenchIcon name="notification" size={17} /></span>
            <div><strong>成员目录尚未接入控制面</strong><p>当前页面只展示可验证的项目协作事实。成员、角色和权限会在具备权威目录来源后再显示，避免把样例数据当作真实团队。</p></div>
          </section>
        </section>
      )}
    </main>
  );
};

const Metric: React.FC<{
  icon: 'project' | 'team' | 'check' | 'laptop';
  label: string;
  value: number;
  tone: 'brand' | 'success' | 'warning' | 'violet';
}> = ({ icon, label, value, tone }) => (
  <article className={`team-live__metric team-live__metric--${tone}`}><span><WorkbenchIcon name={icon} size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article>
);

const EmptyPanel: React.FC<{ icon: 'team' | 'laptop'; text: string }> = ({ icon, text }) => (
  <div className="team-live__empty"><WorkbenchIcon name={icon} size={18} /><span>{text}</span></div>
);

const TeamSkeleton: React.FC = () => (
  <section className="team-live__grid" aria-label="正在加载协作网络"><div className="team-live__skeleton" /><div className="team-live__skeleton" /><div className="team-live__skeleton" /></section>
);

export default Team;
