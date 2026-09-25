import type { AxiDashboardNavGroup } from '@axi/shell';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import type { UserRole } from '../config';

/**
 * 导航项的可见性角色要求。
 * - undefined: 对所有角色可见
 * - 单个角色: 只对该角色可见
 * - 多个角色: 对其中任一角色可见
 */
export type VisibilityRole = UserRole | UserRole[] | undefined;

/**
 * Canonical desktop navigation registration for the primary application
 * sidebar. Profile and notification routes are intentionally absent: they are
 * topbar utilities / special pages, not workbench menu destinations.
 *
 * Each group and item carries a Chinese label literal (used by tests and as
 * a literal fallback) plus an i18n `labelKey` consumed by renderers through
 * useI18n(). Keep both fields in sync when adding entries.
 *
 * The shape is exported as `WorkbenchNavGroup`, which is `AxiDashboardNavGroup`
 * plus `labelKey` on both group and item. `workbenchDesktopNavGroups` is the
 * strict shell-typed projection; `workbenchDesktopNavGroupsWithKeys` carries
 * the i18n keys for renderer consumers.
 */
export type WorkbenchNavItem = {
  children?: WorkbenchNavItem[];
  disabled?: boolean;
  hidden?: boolean;
  href?: string;
  icon?: unknown;
  iconName?: string;
  key: string;
  label: string;
  labelKey: string;
  target?: string;
  title?: string;
  /** 可见性角色要求，不设置则对所有角色可见 */
  visibility?: VisibilityRole;
};

export type WorkbenchNavGroup = {
  children: WorkbenchNavItem[];
  hidden?: boolean;
  icon?: unknown;
  iconName?: string;
  key: string;
  label: string;
  labelKey: string;
  /** 可见性角色要求，不设置则对所有角色可见 */
  visibility?: VisibilityRole;
};

export const workbenchDesktopNavGroupsWithKeys: WorkbenchNavGroup[] = [
  {
    key: 'overview',
    label: '概览',
    labelKey: 'nav.group.overview',
    iconName: axiWorkbenchIconMap.overview,
    children: [
      { key: '/admin/dashboard', label: '工作台概览', labelKey: 'nav.dashboard', iconName: axiWorkbenchIconMap.overview },
      { key: '/admin/operations', label: '运行状态', labelKey: 'nav.operations', iconName: axiWorkbenchIconMap.laptop },
      { key: '/admin/operations/eps', label: 'API 资产审计', labelKey: 'nav.epsAudit', iconName: axiWorkbenchIconMap.operations },
    ],
  },
  {
    key: 'personal-os',
    label: '个人操作系统',
    labelKey: 'nav.group.personalOs',
    iconName: axiWorkbenchIconMap.overview,
    children: [
      { key: '/admin/personal-os/today', label: '今日', labelKey: 'personalOs.nav.today', iconName: axiWorkbenchIconMap.overview },
      { key: '/admin/personal-os/workbench', label: '项目队列', labelKey: 'personalOs.nav.workbench', iconName: axiWorkbenchIconMap.project },
    ],
  },
  {
    key: 'ops',
    label: '运维',
    labelKey: 'nav.group.ops',
    iconName: axiWorkbenchIconMap.operations,
    children: [
      { key: '/admin/operations/commit-ledger', label: 'Commit Ledger', labelKey: 'nav.commitLedger', iconName: axiWorkbenchIconMap.commit },
      { key: '/admin/operations/observability', label: '可观测性', labelKey: 'nav.observability', iconName: axiWorkbenchIconMap.operations },
    ],
  },
  {
    key: 'work',
    label: '项目与工作',
    labelKey: 'nav.group.work',
    iconName: axiWorkbenchIconMap.project,
    children: [
      { key: '/admin/project', label: '项目组合', labelKey: 'nav.projects', iconName: axiWorkbenchIconMap.project },
    ],
  },
  {
    key: 'organization',
    label: '组织与访问',
    labelKey: 'nav.group.organization',
    iconName: axiWorkbenchIconMap.team,
    children: [
      { key: '/admin/team', label: '团队', labelKey: 'nav.team', iconName: axiWorkbenchIconMap.team },
      { key: '/admin/settings/menu', label: '菜单配置', labelKey: 'nav.settings.menu.configure', iconName: axiWorkbenchIconMap.menu, visibility: 'admin' },
      { key: '/admin/settings/role', label: '角色权限', labelKey: 'nav.settings.role.permission', iconName: axiWorkbenchIconMap.roles, visibility: 'admin' },
    ],
  },
];

/**
 * Strict shell-typed projection of `workbenchDesktopNavGroupsWithKeys`.
 * The shell renders `label` directly; renderer code that wants i18n should
 * import `workbenchDesktopNavGroupsWithKeys` and use `t(item.labelKey)` to
 * build the visible label.
 */
export const workbenchDesktopNavGroups: AxiDashboardNavGroup[] =
  workbenchDesktopNavGroupsWithKeys as unknown as AxiDashboardNavGroup[];

export interface MenuRoute {
  /** Canonical Chinese label used by tests and as a literal fallback. */
  label: string;
  /** i18n dictionary key consumed by the renderer via useI18n(). */
  labelKey: string;
}

/**
 * Tab-label lookup. The desktop shell reads this whenever the route changes
 * and assigns `labelKey` to the active tab. The renderer calls `t(labelKey)`.
 */
export const workbenchMenuRouteMap: Record<string, MenuRoute> = {
  '/admin/personal-os/today': { label: '今日', labelKey: 'personalOs.nav.today' },
  '/admin/personal-os/workbench': { label: '项目队列', labelKey: 'personalOs.nav.workbench' },
  '/admin/dashboard': { label: '工作台概览', labelKey: 'nav.dashboard' },
  '/admin/operations': { label: '运行状态', labelKey: 'nav.operations' },
  '/admin/operations/eps': { label: 'API 资产审计', labelKey: 'nav.epsAudit' },
  '/admin/operations/commit-ledger': { label: 'Commit Ledger', labelKey: 'nav.commitLedger' },
  '/admin/operations/observability': { label: '可观测性', labelKey: 'nav.observability' },
  '/admin/project': { label: '项目组合', labelKey: 'nav.projects' },
  '/admin/team': { label: '团队', labelKey: 'nav.team' },
  '/admin/handoff': { label: '跨端续办', labelKey: 'nav.handoff' },
  // These routes open from the avatar menu and topbar notification action.
  // They remain addressable as tabs without becoming sidebar menu entries.
  '/admin/me': { label: '个人中心', labelKey: 'nav.crumb.profile' },
  '/admin/me/notifications': { label: '通知中心', labelKey: 'nav.crumb.notifications' },
  // Settings routes share their labelKey with the sidebar menu so the tab,
  // breadcrumb, and menu all read from the same i18n entry. See
  // `workbenchDesktopNavGroupsWithKeys` for the canonical definitions.
  '/admin/settings/menu': { label: '菜单配置', labelKey: 'nav.settings.menu.configure' },
  '/admin/settings/role': { label: '角色权限', labelKey: 'nav.settings.role.permission' },
};

export type RegisteredDesktopRoute = {
  groupKey: string;
  groupLabel: string;
  iconName: string;
  label: string;
  labelKey: string;
  order: number;
  path: string;
};

export function getRegisteredDesktopRoutes(): RegisteredDesktopRoute[] {
  return workbenchDesktopNavGroupsWithKeys.flatMap((group) =>
    group.children.map((item, order) => ({
      groupKey: String(group.key),
      groupLabel: String(group.label),
      iconName: String(item.iconName ?? axiWorkbenchIconMap.menu),
      label: String(item.label),
      labelKey: String(item.labelKey ?? ''),
      order: order + 1,
      path: String(item.key),
    })),
  );
}

/**
 * 检查用户角色是否符合可见性要求
 */
function checkVisibility(userRole: UserRole, visibility: VisibilityRole): boolean {
  if (visibility === undefined) return true;
  if (Array.isArray(visibility)) return visibility.includes(userRole);
  return userRole === visibility;
}

/**
 * 根据用户角色过滤导航项
 * - 移除不符合 visibility 要求的导航项
 * - 如果一个分组的所有子项都被过滤掉，该分组也会被移除
 * - 如果分组有 visibility 要求但不满足，分组及其所有子项都会被移除
 */
export function filterNavGroupsByRole(
  groups: WorkbenchNavGroup[],
  userRole: UserRole
): WorkbenchNavGroup[] {
  return groups
    .map((group) => {
      // 检查分组级别的 visibility
      if (group.visibility !== undefined && !checkVisibility(userRole, group.visibility)) {
        return null;
      }
      // 过滤子项
      const filteredChildren = group.children.filter((item) =>
        checkVisibility(userRole, item.visibility)
      );
      // 如果没有子项了，返回 null（分组会被过滤掉）
      if (filteredChildren.length === 0) {
        return null;
      }
      return { ...group, children: filteredChildren };
    })
    .filter((group): group is WorkbenchNavGroup => group !== null);
}

/**
 * 获取默认的 WorkbenchNavGroup（未过滤）
 * 用于向后兼容
 */
export function getDefaultNavGroups(): WorkbenchNavGroup[] {
  return workbenchDesktopNavGroupsWithKeys;
}
