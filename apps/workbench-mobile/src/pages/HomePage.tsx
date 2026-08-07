import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const overviewItems = [
  { labelKey: 'home.stat.activeProjects', value: '12' },
  { labelKey: 'home.stat.todayTasks', value: '5' },
  { labelKey: 'home.stat.downloaded', value: '23' },
  { labelKey: 'home.stat.storage', value: '8.2 GB' },
] as const;

const projects = [
  { titleKey: 'home.project.mobileRedesign', detailKey: 'home.project.mobileRedesign.meta', progress: 82, mark: 'A' },
  { titleKey: 'home.project.docsRefactor', detailKey: 'home.project.docsRefactor.meta', progress: 45, mark: 'B' },
] as const;

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();

  return (
    <section className="axi-mobile-page axi-mobile-home">
      <div className="axi-mobile-overview-grid" aria-label={t('page.home')}>
        {overviewItems.map((item) => (
          <article className="axi-mobile-overview-card" key={item.labelKey}>
            <span>{t(item.labelKey)}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="axi-mobile-section-heading axi-mobile-section-heading--split">
        <h2>{t('home.recent')}</h2>
        <button type="button" onClick={() => navigate('/projects')}>{t('home.viewAll')}<MobileIcon name="arrow-right" size={15} /></button>
      </div>
      <div className="axi-mobile-card-list">
        {projects.map((project) => (
          <button type="button" key={project.titleKey} className="axi-mobile-project-card" onClick={() => navigate('/projects')}>
            <span className="axi-mobile-project-card__mark is-green">{project.mark}</span>
            <span className="axi-mobile-project-card__body">
              <strong>{t(project.titleKey)}</strong>
              <small>{t(project.detailKey)}</small>
              <span className="axi-mobile-project-card__progress"><i style={{ width: `${project.progress}%` }} /></span>
            </span>
            <span className="axi-mobile-project-card__percent">{project.progress}%</span>
          </button>
        ))}
      </div>
    </section>
  );
}
