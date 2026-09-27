import type { CSSProperties } from 'react';
import { useI18n } from '../../i18n';
import './SessionLoading.css';

const ORBIT_DANGO_SOURCES = [
  '/loading-dango/01-grandfather-blue.png',
  '/loading-dango/02-grandmother-pink.png',
  '/loading-dango/03-father-yellow.png',
  '/loading-dango/05-mother-green.png',
  '/loading-dango/06-young-cyan.png',
  '/loading-dango/07-young-purple.png',
] as const;

type OrbitStyle = CSSProperties & {
  '--orbit-angle': string;
  '--orbit-delay': string;
};

export default function SessionLoading() {
  const { t } = useI18n();
  const label = t('requireSession.checking');

  return (
    <main className="session-loading" aria-live="polite" aria-label={label}>
      <div className="session-loading__scene">
        <div className="session-loading__orbit" aria-hidden="true">
          {ORBIT_DANGO_SOURCES.map((src, index) => {
            const angle = index * (360 / ORBIT_DANGO_SOURCES.length);
            const style: OrbitStyle = {
              '--orbit-angle': `${angle}deg`,
              '--orbit-delay': `${index * -110}ms`,
            };
            return (
              <span className="session-loading__orbit-item" key={angle} style={style}>
                <img className="session-loading__dango" data-testid="session-loading-dango" src={src} alt="" />
              </span>
            );
          })}
        </div>
        <div className="session-loading__core" aria-hidden="true">
          <img className="session-loading__dango session-loading__dango--core" data-testid="session-loading-dango" src="/loading-dango/08-dango-family.png" alt="" />
        </div>
        <p className="session-loading__label">{label}</p>
      </div>
    </main>
  );
}
