import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { MobileProjectionState } from '../components/MobileProjectionState';
import { useMobileDeviceSession, useMobileWorkspaceQuery } from '../lib/mobileControl';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const session = useMobileDeviceSession();
  const workspace = useMobileWorkspaceQuery();
  const snapshot = workspace.data;
  const corpus = useMemo(() => {
    if (!snapshot) return [];
    return [
      ...snapshot.projects.map((project) => ({ title: project.name, subtitle: project.summary, mark: project.name.slice(0, 1), path: '/projects', tone: 'blue' })),
      ...snapshot.attentionItems.map((item) => ({ title: item.title, subtitle: item.summary, mark: '!', path: '/workspace', tone: 'amber' })),
      ...snapshot.runningTasks.map((task) => ({ title: task.summary, subtitle: task.status, mark: '·', path: '/workspace', tone: 'violet' })),
    ];
  }, [snapshot]);
  const results = useMemo(
    () => corpus.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())),
    [corpus, query],
  );

  return (
    <section className="axi-mobile-page axi-mobile-search-page">
      <div className="axi-mobile-search-input"><MobileIcon name="search" size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索当前可见工作区" /><button type="button" onClick={() => navigate(-1)}>返回</button></div>
      <MobileProjectionState session={session} isLoading={workspace.isPending} error={workspace.error} onRefresh={() => void workspace.refetch()} />
      {snapshot ? <><div className="axi-mobile-section-heading"><h2>当前可见内容</h2></div>
      <div className="axi-mobile-card-list axi-mobile-card-list--spaced">
        {results.map((item) => (
          <button type="button" className="axi-mobile-search-result" key={`${item.path}:${item.title}:${item.subtitle}`} onClick={() => navigate(item.path)}>
            <span className={`axi-mobile-search-result__mark is-${item.tone}`}>{item.mark}</span>
            <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
            <MobileIcon name="arrow-right" size={17} />
          </button>
        ))}
        {!results.length && <div className="axi-mobile-empty-search"><MobileIcon name="search" size={22} /><span>没有匹配的当前工作区内容。</span></div>}
      </div></> : null}
    </section>
  );
}
