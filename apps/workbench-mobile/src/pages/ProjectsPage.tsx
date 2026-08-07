import { useState } from 'react';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const projects = [
  { name: 'Axi WorkBench', updated: '30 分钟前', progress: 72, members: 5, tone: 'blue', active: true },
  { name: 'Story Graph', updated: '2 小时前', progress: 48, members: 3, tone: 'violet', active: true },
  { name: 'Axi Pet', updated: '昨天', progress: 30, members: 4, tone: 'amber', active: true },
  { name: 'Research Lab', updated: '8 月 3 日', progress: 84, members: 2, tone: 'mint', active: false },
];

export default function ProjectsPage() {
  const [activeOnly, setActiveOnly] = useState(true);
  const { t } = useMobileI18n();
  const visibleProjects = projects.filter((project) => !activeOnly || project.active);

  return (
    <section className="axi-mobile-page">
      <div className="axi-mobile-page-intro">
        <h1>{t('page.projects')}</h1>
        <p>{t('projects.subtitle')}</p>
      </div>
      <div className="axi-mobile-filter-row" role="tablist" aria-label={t('page.projects')}>
        <button type="button" className={activeOnly ? 'is-active' : ''} onClick={() => setActiveOnly(true)}>{t('projects.active')}</button>
        <button type="button" className={!activeOnly ? 'is-active' : ''} onClick={() => setActiveOnly(false)}>{t('projects.paused')}</button>
      </div>
      <div className="axi-mobile-card-list axi-mobile-card-list--spaced">
        {visibleProjects.map((project) => (
          <article className="axi-mobile-project-card axi-mobile-project-card--full" key={project.name}>
            <span className={`axi-mobile-project-card__mark is-${project.tone}`}>{project.name.slice(0, 1)}</span>
            <span className="axi-mobile-project-card__body">
              <strong>{project.name}</strong>
              <small>{project.updated} · {project.members} {t('projects.members')}</small>
              <span className="axi-mobile-project-card__progress"><i style={{ width: `${project.progress}%` }} /></span>
            </span>
            <span className="axi-mobile-project-card__aside"><b>{project.progress}%</b><MobileIcon name="arrow-right" size={17} /></span>
          </article>
        ))}
      </div>
    </section>
  );
}
