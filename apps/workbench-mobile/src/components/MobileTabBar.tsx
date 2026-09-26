import { useLocation, useNavigate } from 'react-router-dom';
import { useNavBadges } from '../hooks/useNavBadges';
import { type NavBadge } from '../lib/navBadges';
import { MOBILE_NAV_ITEMS, resolveMobileNavKey, type MobileNavKey } from '../lib/navigation';
import { useMobileI18n } from '../i18n';
import { MobileIcon, type MobileIconName } from './MobileIcons';

const navIcons: Record<MobileNavKey, MobileIconName> = {
  home: 'home',
  projects: 'projects',
  workspace: 'workspace',
  me: 'profile',
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

/** 微信式四项底栏；扫一扫由顶部圆形加号承载，不使用桌面 TabBar 或面包屑。 */
export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const activeKey = resolveMobileNavKey(location.pathname);
  const badges = useNavBadges(true);

  return (
    <nav className="wb-bottom-nav" aria-label={t('nav.aria')}>
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = item.key === activeKey;
        const iconName = navIcons[item.key];
        const badge = badges[item.key];
        return (
          <button
            key={item.key}
            type="button"
            className={`wb-bottom-nav__item ${active ? 'is-active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={active ? 'page' : undefined}
            data-nav-key={item.key}
          >
            <span className="wb-bottom-nav__icon-wrap"><MobileIcon className="wb-nav-svg" name={iconName} size={22} /><NavBadgeMark badge={badge} /></span>
            <span className="wb-bottom-nav__label">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
