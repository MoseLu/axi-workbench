import React from 'react';
import { useNavBadges } from '../../hooks/useNavBadges';
import type { NavBadge } from '../../lib/navBadges';
import './MobileBottomNav.css';

export type MobileNavKey = 'home' | 'projects' | 'workspace' | 'scan' | 'me';

/**
 * 图标按真机 WorkBench 截图像素还原（非 ant-design 默认风格）：
 * - 选中「概览」：2×2 圆角方块 + 浅蓝胶囊底
 * - 未选中：深灰线框，无底
 */
/** 微信式：选中 = currentColor 涂色；无白底图标、无胶囊 */
function IconHome({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
        <rect x="3.2" y="3.2" width="7.2" height="7.2" rx="1.8" fill="currentColor" />
        <rect x="13.6" y="3.2" width="7.2" height="7.2" rx="1.8" fill="currentColor" />
        <rect x="3.2" y="13.6" width="7.2" height="7.2" rx="1.8" fill="currentColor" />
        <rect x="13.6" y="13.6" width="7.2" height="7.2" rx="1.8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <rect x="3.2" y="3.2" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.6" y="3.2" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.2" y="13.6" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.6" y="13.6" width="7.2" height="7.2" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconProjects({ active }: { active: boolean }) {
  // 选中实心涂色，未选中线框 — 微信同理
  if (active) {
    return (
      <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
        <path
          d="M3 7.2c0-.94.76-1.7 1.7-1.7h4.05l1.55 1.65h9c.94 0 1.7.76 1.7 1.7v9.15c0 .94-.76 1.7-1.7 1.7H4.7c-.94 0-1.7-.76-1.7-1.7V7.2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <path
        d="M3.5 9h17v9.2c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V9z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 9.2V7.8c0-1 .8-1.8 1.8-1.8h4.1l1.4 1.6h7.9c1 0 1.8.8 1.8 1.8V9.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWorkspace({ active }: { active: boolean }) {
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <circle cx="12" cy="6.8" r="2.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
      <circle cx="7.2" cy="16.2" r="2.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
      <circle cx="16.8" cy="16.2" r="2.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
    </svg>
  );
}

function IconScan({ active }: { active: boolean }) {
  // 底栏用 currentColor；选中绿 / 未选中灰由父级 color 控制
  return (
    <svg className="wb-nav-svg" viewBox="0 0 1024 1024" width="24" height="24" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity={active ? 1 : 0.95}
        d="M954.026667 476.16c-3.413333-3.413333-10.24-5.12-15.36-5.12l-81.92 17.066667c-25.6 5.12-44.373333 25.6-49.493334 51.2l-15.36 92.16H240.64c-5.12 0-10.24 3.413333-13.653333 6.826666-3.413333 5.12-3.413333 10.24-1.706667 15.36l46.08 112.64c3.413333 6.826667 8.533333 10.24 15.36 10.24H546.133333l42.666667 129.706667c15.36 44.373333 56.32 73.386667 102.4 73.386667h138.24c59.733333 0 107.52-47.786667 107.52-107.52V648.533333l22.186667-157.013333c0-5.12-1.706667-10.24-5.12-15.36zM783.36 392.533333c5.12 0 10.24-3.413333 13.653333-6.826666 3.413333-5.12 3.413333-10.24 1.706667-15.36l-44.373333-112.64c-3.413333-6.826667-8.533333-10.24-15.36-10.24H479.573333l-42.666666-129.706667c-15.36-44.373333-56.32-73.386667-102.4-73.386667h-138.24C136.533333 42.666667 87.04 90.453333 87.04 150.186667V375.466667l-22.186667 157.013333c0 5.12 1.706667 10.24 5.12 15.36 3.413333 3.413333 6.826667 5.12 11.946667 5.12H85.333333l81.92-17.066667c25.6-5.12 44.373333-25.6 49.493334-51.2l15.36-90.453333h551.253333z"
      />
    </svg>
  );
}

function IconMe({ active }: { active: boolean }) {
  return (
    <svg className="wb-nav-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <circle cx="12" cy="8" r="3.4" fill="currentColor" fillOpacity={active ? 1 : 0.95} />
      <path d="M5 19.5c.9-3.4 3.6-5.2 7-5.2s6.1 1.8 7 5.2" fill="currentColor" fillOpacity={active ? 1 : 0.95} />
    </svg>
  );
}

/** 微信式导航徽标：无 / 红点 / 数字（>99 → 99+） — 类型与 lib/navBadges 对齐 */
export type { NavBadge };

export function formatNavBadgeCount(value: number): string {
  if (value <= 0) return '';
  return value > 99 ? '99+' : String(value);
}

export type MobileNavItem = {
  key: MobileNavKey;
  label: string;
  path: string;
  Icon: React.FC<{ active: boolean }>;
  /** 由 API 注入；扫一扫无角标 */
  badge?: NavBadge;
};

/** 静态导航定义（角标不在这里写死，见 useNavBadges） */
export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { key: 'home', label: '概览', path: '/admin/dashboard', Icon: IconHome },
  { key: 'projects', label: '项目', path: '/admin/project', Icon: IconProjects },
  { key: 'workspace', label: '工作区', path: '/admin/task', Icon: IconWorkspace },
  { key: 'scan', label: '扫一扫', path: '/admin/scan', Icon: IconScan },
  { key: 'me', label: '我的', path: '/admin/me', Icon: IconMe },
];

function NavBadgeMark({ badge }: { badge?: NavBadge }) {
  if (!badge || badge.kind === 'none') return null;
  if (badge.kind === 'dot') {
    return <span className="wb-nav-badge wb-nav-badge--dot" aria-hidden />;
  }
  // kind === 'count'
  if (badge.value <= 0) return null;
  const wide = badge.value > 9;
  return (
    <span
      className={`wb-nav-badge wb-nav-badge--count${wide ? ' is-wide' : ''}`}
      aria-label={`${badge.value} 条未读`}
    >
      {formatNavBadgeCount(badge.value)}
    </span>
  );
}

export function matchNavKey(pathname: string): MobileNavKey {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin/scan' || path.startsWith('/admin/scan/')) return 'scan';
  if (path === '/admin/project' || path.startsWith('/admin/project/')) return 'projects';
  if (
    path === '/admin/task' ||
    path.startsWith('/admin/task/') ||
    path === '/admin/team' ||
    path.startsWith('/admin/team/')
  ) {
    return 'workspace';
  }
  if (path === '/admin/me' || path.startsWith('/admin/me/') || path.startsWith('/admin/settings')) {
    return 'me';
  }
  if (path === '/admin/dashboard' || path === '/' || path === '') return 'home';
  return 'home';
}

type Props = {
  pathname: string;
  onNavigate: (path: string) => void;
};

const MobileBottomNav: React.FC<Props> = ({ pathname, onNavigate }) => {
  const active = matchNavKey(pathname);
  // Real API: GET /api/v1/notifications/nav-badges (seed: home=12, workspace=dot, me=3)
  const tabBadges = useNavBadges(true);

  return (
    <nav className="wb-bottom-nav" aria-label="主导航">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        const { Icon } = item;
        const badge =
          item.key === 'home'
            ? tabBadges.home
            : item.key === 'projects'
              ? tabBadges.projects
              : item.key === 'workspace'
                ? tabBadges.workspace
                : item.key === 'me'
                  ? tabBadges.me
                  : undefined;
        return (
          <button
            key={item.key}
            type="button"
            className={`wb-bottom-nav__item ${isActive ? 'is-active' : ''}`}
            onClick={() => onNavigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            data-nav-key={item.key}
            data-active={isActive ? 'true' : 'false'}
          >
            <span className={`wb-bottom-nav__icon-wrap ${isActive ? 'is-active' : ''}`}>
              <Icon active={isActive} />
              <NavBadgeMark badge={badge} />
            </span>
            <span className="wb-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
