import type { ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavBadges } from '../hooks/useNavBadges';
import { type NavBadge } from '../lib/navBadges';
import { MOBILE_NAV_ITEMS, resolveMobileNavKey, type MobileNavKey } from '../lib/navigation';
import { useMobileI18n } from '../i18n';

type NavIconProps = { active: boolean };

function HomeIcon({ active }: NavIconProps) {
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {[['3.2', '3.2'], ['13.6', '3.2'], ['3.2', '13.6'], ['13.6', '13.6']].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="7.2" height="7.2" rx="1.8" {...(active ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', strokeWidth: '1.7' })} />
      ))}
    </svg>
  );
}

function ProjectsIcon({ active }: NavIconProps) {
  const path = active
    ? 'M3 7.2c0-.94.76-1.7 1.7-1.7h4.05l1.55 1.65h9c.94 0 1.7.76 1.7 1.7v9.15c0 .94-.76 1.7-1.7 1.7H4.7c-.94 0-1.7-.76-1.7-1.7V7.2z'
    : 'M3.5 9h17v9.2c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V9z';
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d={path} {...(active ? { fill: 'currentColor' } : { stroke: 'currentColor', strokeWidth: '1.7', strokeLinejoin: 'round' })} />
      {!active ? <path d="M3.5 9.2V7.8c0-1 .8-1.8 1.8-1.8h4.1l1.4 1.6h7.9c1 0 1.8.8 1.8 1.8V9.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /> : null}
    </svg>
  );
}

function WorkspaceIcon({ active }: NavIconProps) {
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="6.8" r="2.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
      <circle cx="7.2" cy="16.2" r="2.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
      <circle cx="16.8" cy="16.2" r="2.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
    </svg>
  );
}

function ScanIcon({ active }: NavIconProps) {
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path fill="currentColor" fillOpacity={active ? 1 : 0.95} d="M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5ZM8 8h8v8H8V8Zm2 2v4h4v-4h-4Z" />
    </svg>
  );
}

function MeIcon({ active }: NavIconProps) {
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" fill="currentColor" fillOpacity={active ? 1 : 0.95} />
      <path d="M5 19.5c.9-3.4 3.6-5.2 7-5.2s6.1 1.8 7 5.2" fill="currentColor" fillOpacity={active ? 1 : 0.95} />
    </svg>
  );
}

const navIcons: Record<MobileNavKey, ComponentType<NavIconProps>> = {
  home: HomeIcon,
  projects: ProjectsIcon,
  workspace: WorkspaceIcon,
  scan: ScanIcon,
  me: MeIcon,
};

export function formatNavBadgeCount(value: number): string {
  if (value <= 0) return '';
  return value > 99 ? '99+' : String(value);
}

function NavBadgeMark({ badge }: { badge?: NavBadge }) {
  if (!badge || badge.kind === 'none') return null;
  if (badge.kind === 'dot') return <span className="wb-nav-badge wb-nav-badge--dot" aria-hidden="true" />;
  if (badge.value <= 0) return null;
  return (
    <span className={`wb-nav-badge wb-nav-badge--count${badge.value > 9 ? ' is-wide' : ''}`} aria-label={formatNavBadgeCount(badge.value)}>
      {formatNavBadgeCount(badge.value)}
    </span>
  );
}

/** 从原工作台迁出的微信式五项底栏，不使用桌面 TabBar 或面包屑。 */
export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const activeKey = resolveMobileNavKey(location.pathname);
  const badges = useNavBadges(true);

  return (
    <nav className="wb-bottom-nav" aria-label="移动端主导航">
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = item.key === activeKey;
        const Icon = navIcons[item.key];
        const badge = item.key === 'home' ? badges.home : item.key === 'projects' ? badges.projects : item.key === 'workspace' ? badges.workspace : item.key === 'me' ? badges.me : undefined;
        return (
          <button
            key={item.key}
            type="button"
            className={`wb-bottom-nav__item ${active ? 'is-active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={active ? 'page' : undefined}
            data-nav-key={item.key}
          >
            <span className="wb-bottom-nav__icon-wrap"><Icon active={active} /><NavBadgeMark badge={badge} /></span>
            <span className="wb-bottom-nav__label">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
