import { useNavigate } from 'react-router-dom';
import { useAuth } from '@axi/workbench-foundation';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const projects = [
  { name: 'Axi WorkBench', detail: '设计系统整理', progress: 72, tone: 'blue' },
  { name: 'Story Graph', detail: '时间线校对', progress: 48, tone: 'violet' },
  { name: 'Axi Pet', detail: '桌面体验迭代', progress: 30, tone: 'amber' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useMobileI18n();
  const displayName = user?.name || t('profile.guest');

  return (
    <section className="axi-mobile-page axi-mobile-home">
      <div className="axi-mobile-home__hero">
        <p>{t('home.eyebrow')}</p>
        <h1>{displayName}</h1>
        <span>{t('home.greeting')}</span>
        <div className="axi-mobile-home__progress" aria-label={t('home.progress')}>
          <div className="axi-mobile-home__progress-row">
            <span>{t('home.progress')}</span>
            <strong>68%</strong>
          </div>
          <div className="axi-mobile-progress-track"><i style={{ width: '68%' }} /></div>
        </div>
      </div>

      <div className="axi-mobile-stat-grid">
        <div className="axi-mobile-stat-card">
          <span>{t('home.complete')}</span>
          <strong>18</strong>
          <em>+6</em>
        </div>
        <div className="axi-mobile-stat-card">
          <span>{t('home.focus')}</span>
          <strong>4</strong>
          <em className="is-quiet">2h</em>
        </div>
      </div>

      <div className="axi-mobile-section-heading">
        <h2>{t('home.quickActions')}</h2>
      </div>
      <div className="axi-mobile-action-grid">
        <button type="button" onClick={() => navigate('/projects')}><span className="is-blue"><MobileIcon name="plus" size={19} /></span>{t('home.action.project')}</button>
        <button type="button" onClick={() => navigate('/workspace')}><span className="is-violet"><MobileIcon name="focus" size={19} /></span>{t('home.action.task')}</button>
        <button type="button" onClick={() => navigate('/search')}><span className="is-amber"><MobileIcon name="search" size={19} /></span>{t('home.action.search')}</button>
      </div>

      <div className="axi-mobile-section-heading axi-mobile-section-heading--split">
        <h2>{t('home.recent')}</h2>
        <button type="button" onClick={() => navigate('/projects')}>{t('home.viewAll')}<MobileIcon name="arrow-right" size={15} /></button>
      </div>
      <div className="axi-mobile-card-list">
        {projects.map((project) => (
          <button type="button" key={project.name} className="axi-mobile-project-card" onClick={() => navigate('/projects')}>
            <span className={`axi-mobile-project-card__mark is-${project.tone}`}>{project.name.slice(0, 1)}</span>
            <span className="axi-mobile-project-card__body">
              <strong>{project.name}</strong>
              <small>{project.detail}</small>
              <span className="axi-mobile-project-card__progress"><i style={{ width: `${project.progress}%` }} /></span>
            </span>
            <span className="axi-mobile-project-card__percent">{project.progress}%</span>
          </button>
        ))}
      </div>
    </section>
  );
}
