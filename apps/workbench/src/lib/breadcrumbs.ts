/**
 * Route-derived breadcrumb chain for the workbench admin shell.
 *
 * Inspired by:
 *  - apps/devsvc-dashboard/src/app-registry.tsx:285
 *    (reverse-lookup map `appGroupByRoute` + `findHostedMenuMatch` for prefix match)
 *  - shared/axi-ui/packages/shell/src/layout.tsx:411
 *    (three-state item: current / href / onClick)
 *
 * Contract:
 *  - `resolveBreadcrumbs(pathname)` is the single source of truth.
 *  - The returned chain ALWAYS ends at the current item with `isActive: true`.
 *  - `path` on an intermediate item is the click target; absence means static label.
 *  - Prefix-match fallback uses the longest registered path prefix when no
 *    exact key is found, mirroring what `devsvc-dashboard` does for hosted apps.
 */

import React from 'react';
import { AxiSvgIcon, type AxiIconName } from '@axi/core';

export interface BreadcrumbItem {
  /** Visible label. */
  label: string;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Optional click target. When omitted the item is static. */
  path?: string;
  /** Marks the current page item; renders with `aria-current="page"` and is not clickable. */
  isActive?: boolean;
}

/** A hierarchy node rendered before the current route. */
export interface BreadcrumbNode {
  label: string;
  icon?: React.ReactNode;
  /** Optional route for a navigable ancestor. */
  path?: string;
}

/** A registered primary route. `match` allows multi-segment active matching. */
export interface BreadcrumbRoute {
  label: string;
  icon?: React.ReactNode;
  /** One-level compatibility field for callers that only have one parent. */
  parent?: BreadcrumbNode;
  /** Ordered ancestors, from the top-level group to the immediate parent. */
  parents?: BreadcrumbNode[];
  /** Extra paths that should activate this entry even though they are not in `path`. */
  match?: string[];
}

/**
 * Registry of admin routes known to the breadcrumb builder.
 * Keys are absolute paths; values describe the route's display.
 *
 * Order in `getBreadcrumb` keys matters only when multiple prefixes tie —
 * longest match wins, ties are resolved by registry insertion order.
 */
const WORKBENCH_PARENT: BreadcrumbNode = {
  label: '工作台',
  icon: 'admin-dashboard',
  path: '/admin/dashboard',
};

const ACCOUNT_PARENT: BreadcrumbNode = {
  label: '账号与设置',
  icon: 'admin-settings',
};

const PROFILE_PARENT: BreadcrumbNode = {
  label: '个人中心',
  icon: 'admin-user',
  path: '/admin/me',
};

export const BREADCRUMB_REGISTRY: Record<string, BreadcrumbRoute> = {
  '/admin/dashboard': { label: '概览', icon: 'admin-dashboard' },
  '/admin/project': { label: '项目', icon: 'admin-project', parents: [WORKBENCH_PARENT] },
  '/admin/task': { label: '工作区', icon: 'admin-folder', parents: [WORKBENCH_PARENT] },
  '/admin/team': { label: '团队', icon: 'admin-team', parents: [WORKBENCH_PARENT] },
  '/admin/scan': { label: '扫一扫', icon: 'admin-scan', parents: [WORKBENCH_PARENT] },
  '/admin/search': { label: '搜索', icon: 'search', parents: [WORKBENCH_PARENT] },
  '/admin/me': {
    label: '个人中心',
    icon: 'admin-user',
    parents: [ACCOUNT_PARENT],
  },
  '/admin/me/account': {
    label: '账号信息',
    icon: 'admin-profile',
    parents: [ACCOUNT_PARENT, PROFILE_PARENT],
  },
  '/admin/me/devices': {
    label: '设备管理',
    icon: 'admin-mobile',
    parents: [ACCOUNT_PARENT, PROFILE_PARENT],
  },
  '/admin/me/notifications': {
    label: '通知设置',
    icon: 'notice',
    parents: [ACCOUNT_PARENT, PROFILE_PARENT],
  },
  '/admin/me/theme': {
    label: '主题外观',
    icon: 'theme',
    parents: [ACCOUNT_PARENT, PROFILE_PARENT],
  },
  '/admin/me/settings': {
    label: '设置',
    icon: 'settings',
    parents: [ACCOUNT_PARENT, PROFILE_PARENT],
  },
  '/admin/settings/menu': {
    label: '菜单列表',
    icon: 'admin-menu',
    parents: [ACCOUNT_PARENT],
  },
  '/admin/settings/user': {
    label: '账号信息',
    icon: 'admin-user',
    parents: [ACCOUNT_PARENT],
  },
  '/admin/settings/role': {
    label: '角色列表',
    icon: 'admin-safety',
    parents: [ACCOUNT_PARENT],
  },
};

/** Map semantic route hints to the shared Axi icon registry. */
const ICON_HINTS: Record<string, AxiIconName> = {
  'admin-dashboard': 'admin-dashboard',
  'admin-folder': 'admin-folder',
  'admin-menu': 'admin-menu',
  'admin-mobile': 'admin-mobile',
  'admin-profile': 'admin-profile',
  'admin-project': 'admin-project',
  'admin-safety': 'admin-safety',
  'admin-scan': 'admin-scan',
  'admin-settings': 'admin-settings',
  'admin-team': 'admin-team',
  'admin-user': 'admin-user',
  notice: 'notice',
  search: 'search',
  settings: 'settings',
  theme: 'theme',
};

function hint(icon: string | React.ReactNode | undefined): React.ReactNode | undefined {
  if (icon === undefined) return undefined;
  if (typeof icon !== 'string') return icon;
  const iconName = ICON_HINTS[icon];
  return iconName ? React.createElement(AxiSvgIcon, { name: iconName, size: 14 }) : undefined;
}

/**
 * Find the best matching registered route for a given pathname.
 * Falls back to the longest registered prefix; returns `null` if nothing matches.
 */
function resolveRoute(pathname: string): { path: string; route: BreadcrumbRoute } | null {
  if (BREADCRUMB_REGISTRY[pathname]) {
    return { path: pathname, route: BREADCRUMB_REGISTRY[pathname] };
  }
  // Longest-prefix match. We also honor `route.match` for explicit aliases.
  let best: { path: string; route: BreadcrumbRoute; score: number } | null = null;
  for (const [key, route] of Object.entries(BREADCRUMB_REGISTRY)) {
    const candidates = [key, ...(route.match ?? [])];
    for (const candidate of candidates) {
      if (
        pathname === candidate ||
        (candidate !== '/' && pathname.startsWith(candidate + '/'))
      ) {
        const score = candidate.length;
        if (!best || score > best.score) {
          best = { path: key, route, score };
        }
      }
    }
  }
  return best ? { path: best.path, route: best.route } : null;
}

/**
 * Resolve the breadcrumb chain for a pathname.
 *
 * Rules:
 *  - Root path (`/`, `''`) and `/admin/dashboard` collapse to a single
 *    "概览" item (current).
 *  - If the pathname is unknown, returns an empty chain rather than inventing
 *    a synthetic 首页 node.
 *  - Otherwise: ordered ancestors → current registered entry.
 */
export function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const trimmed = pathname || '/';

  if (trimmed === '/' || trimmed === '/admin/dashboard' || trimmed === '') {
    return [{ label: '概览', isActive: true }];
  }

  const found = resolveRoute(trimmed);
  if (!found) {
    return [];
  }

  const chain: BreadcrumbItem[] = [];

  const parents = found.route.parents ?? (found.route.parent ? [found.route.parent] : []);
  parents.forEach((parent) => {
    chain.push({
      label: parent.label,
      icon: hint(parent.icon),
      path: parent.path,
    });
  });

  chain.push({
    label: found.route.label,
    icon: hint(found.route.icon),
    path: found.path,
    isActive: true,
  });

  return chain;
}
