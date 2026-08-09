import type { AxiDashboardNavGroup } from '@axi/shell';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';

/**
 * Canonical desktop navigation registration.  Both the application shell and
 * the settings page consume this definition so the UI never shows a separate
 * sample menu inventory.
 */
export const workbenchDesktopNavGroups: AxiDashboardNavGroup[] = [
  {
    key: 'overview',
    label: '概览',
    iconName: axiWorkbenchIconMap.overview,
    children: [
      { key: '/admin/dashboard', label: '工作台概览', iconName: axiWorkbenchIconMap.overview },
      { key: '/admin/operations', label: '运行状态', iconName: axiWorkbenchIconMap.laptop },
    ],
  },
  {
    key: 'work',
    label: '项目与工作',
    iconName: axiWorkbenchIconMap.project,
    children: [
      { key: '/admin/project', label: '项目组合', iconName: axiWorkbenchIconMap.project },
      { key: '/admin/task', label: '工作项', iconName: axiWorkbenchIconMap.workspace },
    ],
  },
  {
    key: 'organization',
    label: '组织与访问',
    iconName: axiWorkbenchIconMap.team,
    children: [
      { key: '/admin/team', label: '团队', iconName: axiWorkbenchIconMap.team },
      { key: '/admin/settings/menu', label: '菜单配置', iconName: axiWorkbenchIconMap.menu },
      { key: '/admin/settings/role', label: '角色权限', iconName: axiWorkbenchIconMap.roles },
    ],
  },
  {
    key: 'account',
    label: '账号与设置',
    iconName: axiWorkbenchIconMap.settings,
    children: [
      { key: '/admin/me', label: '个人中心', iconName: axiWorkbenchIconMap.account },
      { key: '/admin/me/notifications', label: '通知中心', iconName: axiWorkbenchIconMap.notification },
    ],
  },
];

export const workbenchMenuRouteMap: Record<string, { label: string }> = {
  '/admin/dashboard': { label: '工作台概览' },
  '/admin/operations': { label: '运行状态' },
  '/admin/project': { label: '项目组合' },
  '/admin/task': { label: '工作项' },
  '/admin/team': { label: '团队' },
  '/admin/handoff': { label: '跨端续办' },
  '/admin/me': { label: '个人中心' },
  '/admin/settings/menu': { label: '菜单列表' },
  '/admin/settings/role': { label: '角色列表' },
};

export type RegisteredDesktopRoute = {
  groupKey: string;
  groupLabel: string;
  iconName: string;
  label: string;
  order: number;
  path: string;
};

export function getRegisteredDesktopRoutes(): RegisteredDesktopRoute[] {
  return workbenchDesktopNavGroups.flatMap((group) =>
    group.children.map((item, order) => ({
      groupKey: String(group.key),
      groupLabel: String(group.label),
      iconName: String(item.iconName ?? axiWorkbenchIconMap.menu),
      label: String(item.label),
      order: order + 1,
      path: String(item.key),
    })),
  );
}
