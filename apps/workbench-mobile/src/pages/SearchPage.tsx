import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const corpus = [
  { title: 'Axi WorkBench', subtitle: '项目 · 设计系统整理', path: '/projects', tone: 'blue' },
  { title: 'Story Graph', subtitle: '项目 · 时间线校对', path: '/projects', tone: 'violet' },
  { title: '后台导航与标签栏审查', subtitle: '待办 · 今天 10:30', path: '/workspace', tone: 'amber' },
  { title: '工作台同步状态', subtitle: '消息 · 昨天', path: '/inbox', tone: 'mint' },
];

export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const [query, setQuery] = useState('');
  const results = useMemo(() => corpus.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  return (
    <section className="axi-mobile-page axi-mobile-search-page">
      <div className="axi-mobile-search-input"><MobileIcon name="search" size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search.placeholder')} /><button type="button" onClick={() => navigate(-1)}>{t('common.back')}</button></div>
      <div className="axi-mobile-section-heading"><h2>{t('search.recent')}</h2></div>
      <div className="axi-mobile-card-list axi-mobile-card-list--spaced">
        {results.map((item) => (
          <button type="button" className="axi-mobile-search-result" key={item.title} onClick={() => navigate(item.path)}>
            <span className={`axi-mobile-search-result__mark is-${item.tone}`}>{item.title.slice(0, 1)}</span>
            <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
            <MobileIcon name="arrow-right" size={17} />
          </button>
        ))}
        {!results.length && <div className="axi-mobile-empty-search"><MobileIcon name="search" size={22} /><span>{t('search.noResults')}</span></div>}
      </div>
    </section>
  );
}
