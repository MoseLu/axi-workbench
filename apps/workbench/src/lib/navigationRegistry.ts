import type { AxiDashboardNavGroup } from '@axi/shell';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';

/**
 * Canonical desktop navigation registration.  Both the application shell and
 * the settings page consume this definition so the UI never shows a separate
 * sample menu inventory.
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
};

export type WorkbenchNavGroup = {
  children: WorkbenchNavItem[];
  hidden?: boolean;
  icon?: unknown;
  iconName?: string;
  key: string;
  label: string;
  labelKey: string;
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
    ],
  },
  {
    key: 'work',
    label: '项目与工作',
    labelKey: 'nav.group.work',
    iconName: axiWorkbenchIconMap.project,
    children: [
      { key: '/admin/project', label: '项目组合', labelKey: 'nav.projects', iconName: axiWorkbenchIconMap.project },
      { key: '/admin/task', label: '工作项', labelKey: 'nav.tasks', iconName: axiWorkbenchIconMap.workspace },
    ],
  },
  {
    key: 'organization',
    label: '组织与访问',
    labelKey: 'nav.group.organization',
    iconName: axiWorkbenchIconMap.team,
    children: [
      { key: '/admin/team', label: '团队', labelKey: 'nav.team', iconName: axiWorkbenchIconMap.team },
      { key: '/admin/settings/menu', label: '菜单配置', labelKey: 'nav.settings.menu.configure', iconName: axiWorkbenchIconMap.menu },
      { key: '/admin/settings/role', label: '角色权限', labelKey: 'nav.settings.role.permission', iconName: axiWorkbenchIconMap.roles },
    ],
  },
  {
    key: 'account',
    label: '账号与设置',
    labelKey: 'nav.group.account',
    iconName: axiWorkbenchIconMap.settings,
    children: [
      { key: '/admin/me', label: '个人中心', labelKey: 'nav.crumb.profile', iconName: axiWorkbenchIconMap.account },
      { key: '/admin/me/notifications', label: '通知中心', labelKey: 'nav.crumb.notifications', iconName: axiWorkbenchIconMap.notification },
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
  '/admin/dashboard': { label: '工作台概览', labelKey: 'nav.dashboard' },
  '/admin/operations': { label: '运行状态', labelKey: 'nav.operations' },
  '/admin/project': { label: '项目组合', labelKey: 'nav.projects' },
  '/admin/task': { label: '工作项', labelKey: 'nav.tasks' },
  '/admin/team': { label: '团队', labelKey: 'nav.team' },
  '/admin/handoff': { label: '跨端续办', labelKey: 'nav.handoff' },
  '/admin/me': { label: '个人中心', labelKey: 'nav.crumb.profile' },
  '/admin/settings/menu': { label: '菜单列表', labelKey: 'nav.settings.menu' },
  '/admin/settings/role': { label: '角色列表', labelKey: 'nav.settings.role' },
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
