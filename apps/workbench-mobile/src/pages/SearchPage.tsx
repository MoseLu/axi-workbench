import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const corpus = [
  { titleKey: 'search.item.workbench.title', subtitleKey: 'search.item.workbench.subtitle', mark: 'A', path: '/projects', tone: 'blue' },
  { titleKey: 'search.item.storyGraph.title', subtitleKey: 'search.item.storyGraph.subtitle', mark: 'S', path: '/projects', tone: 'violet' },
  { titleKey: 'search.item.navigationReview.title', subtitleKey: 'search.item.navigationReview.subtitle', mark: 'R', path: '/workspace', tone: 'amber' },
  { titleKey: 'search.item.syncStatus.title', subtitleKey: 'search.item.syncStatus.subtitle', mark: 'W', path: '/inbox', tone: 'mint' },
] as const;

export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => corpus.filter((item) => `${t(item.titleKey)} ${t(item.subtitleKey)}`.toLowerCase().includes(query.trim().toLowerCase())),
    [query, t],
  );

  return (
    <section className="axi-mobile-page axi-mobile-search-page">
      <div className="axi-mobile-search-input"><MobileIcon name="search" size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search.placeholder')} /><button type="button" onClick={() => navigate(-1)}>{t('common.back')}</button></div>
      <div className="axi-mobile-section-heading"><h2>{t('search.recent')}</h2></div>
      <div className="axi-mobile-card-list axi-mobile-card-list--spaced">
        {results.map((item) => (
          <button type="button" className="axi-mobile-search-result" key={item.titleKey} onClick={() => navigate(item.path)}>
            <span className={`axi-mobile-search-result__mark is-${item.tone}`}>{item.mark}</span>
            <span><strong>{t(item.titleKey)}</strong><small>{t(item.subtitleKey)}</small></span>
            <MobileIcon name="arrow-right" size={17} />
          </button>
        ))}
        {!results.length && <div className="axi-mobile-empty-search"><MobileIcon name="search" size={22} /><span>{t('search.noResults')}</span></div>}
      </div>
    </section>
  );
}
