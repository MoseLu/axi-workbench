import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { MobileProjectionState, formatProjectionTime } from '../components/MobileProjectionState';
import { useMobileDeviceSession, useMobileWorkspaceQuery } from '../lib/mobileControl';

export default function HomePage() {
  const navigate = useNavigate();
  const session = useMobileDeviceSession();
  const workspace = useMobileWorkspaceQuery();
  const snapshot = workspace.data;

  return (
    <section className="axi-mobile-page axi-mobile-home">
      <div className="axi-mobile-projection-heading">
        <div>
          <p>移动工作区</p>
          <h2>当前责任范围</h2>
        </div>
        {snapshot ? <button type="button" onClick={() => void workspace.refetch()}>刷新</button> : null}
      </div>
      <MobileProjectionState session={session} isLoading={workspace.isPending} error={workspace.error} onRefresh={() => void workspace.refetch()} />
      {snapshot ? (
        <>
          <p className="axi-mobile-projection-meta">来源：{snapshot.source} · 更新于 {formatProjectionTime(snapshot.generatedAt)}</p>
          {snapshot.attentionItems.length ? (
            <button className="axi-mobile-attention-strip" type="button" onClick={() => navigate('/workspace')}>
              <MobileIcon name="bell" size={17} />
              <span>{snapshot.attentionItems.length} 项需要关注</span>
              <MobileIcon name="arrow-right" size={16} />
            </button>
          ) : null}
          <div className="axi-mobile-section-heading axi-mobile-section-heading--split">
            <h2>项目</h2>
            <button type="button" onClick={() => navigate('/projects')}>全部项目<MobileIcon name="arrow-right" size={15} /></button>
          </div>
          {snapshot.projects.length ? (
            <div className="axi-mobile-card-list">
              {snapshot.projects.slice(0, 4).map((project) => (
                <button type="button" key={project.id} className="axi-mobile-project-card" onClick={() => navigate('/projects')}>
                  <span className="axi-mobile-project-card__mark is-green">{project.name.slice(0, 1)}</span>
                  <span className="axi-mobile-project-card__body">
                    <strong>{project.name}</strong>
                    <small>{project.summary}</small>
                  </span>
                  <span className="axi-mobile-project-card__percent">{project.health}</span>
                </button>
              ))}
            </div>
          ) : <div className="axi-mobile-empty-card">控制面尚未登记可见项目。</div>}
        </>
      ) : null}
    </section>
  );
}
