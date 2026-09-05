import { MobileIcon } from '../components/MobileIcons';
import { MobileProjectionState, formatProjectionTime } from '../components/MobileProjectionState';
import { useMobileDeviceSession, useMobileWorkspaceQuery } from '../lib/mobileControl';

export default function ProjectsPage() {
  const session = useMobileDeviceSession();
  const workspace = useMobileWorkspaceQuery();
  const snapshot = workspace.data;

  return (
    <section className="axi-mobile-page">
      <div className="axi-mobile-page-intro axi-mobile-page-intro--with-action">
        <div><h1>项目</h1><p>仅显示控制面向本设备投影的项目状态。</p></div>
        {snapshot ? <button type="button" onClick={() => void workspace.refetch()}>刷新</button> : null}
      </div>
      <MobileProjectionState session={session} isLoading={workspace.isPending} error={workspace.error} onRefresh={() => void workspace.refetch()} />
      {snapshot ? (
        <>
          <p className="axi-mobile-projection-meta">更新于 {formatProjectionTime(snapshot.generatedAt)}</p>
          {snapshot.projects.length ? (
            <div className="axi-mobile-card-list axi-mobile-card-list--spaced">
              {snapshot.projects.map((project) => (
                <article className="axi-mobile-project-card axi-mobile-project-card--full" key={project.id}>
                  <span className="axi-mobile-project-card__mark is-blue">{project.name.slice(0, 1)}</span>
                  <span className="axi-mobile-project-card__body">
                    <strong>{project.name}</strong>
                    <small>{project.progress.summary}</small>
                    <small>最近核验：{formatProjectionTime(project.lastVerifiedAt)}</small>
                  </span>
                  <span className="axi-mobile-project-card__aside"><b>{project.health}</b><MobileIcon name="arrow-right" size={17} /></span>
                </article>
              ))}
            </div>
          ) : <div className="axi-mobile-empty-card">暂无可见项目；这不是样例数据。</div>}
        </>
      ) : null}
    </section>
  );
}
