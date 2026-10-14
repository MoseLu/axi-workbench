/**
 * 导航相关辅助函数 + 工作区导航投影。
 *
 * 仅做位置搬迁 + import 路径本地化，不修改业务逻辑。
 */
import type { I18nContextValue } from '../../i18n';
import { resolveBreadcrumbs } from '../../lib/breadcrumbs';
import {
  filterNavGroupsByRole,
  workbenchDesktopNavGroupsWithKeys,
  workbenchMenuRouteMap,
  type WorkbenchNavGroup,
} from '../../lib/navigationRegistry';
import type { UserRole } from '../../config';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import type { AxiDashboardNavGroup } from '@axi/shell';

export const ROUTE_PREFIX_LABEL_KEYS: Array<{ prefix: string; labelKey: string }> = [
  { prefix: '/admin/project/', labelKey: 'nav.projectDetail' },
  { prefix: '/admin/handoff/', labelKey: 'nav.handoff' },
];

export function resolveMenuRoute(path: string): { labelKey: string } | undefined {
  const prefixEntry = ROUTE_PREFIX_LABEL_KEYS.find((entry) => path.startsWith(entry.prefix));
  if (prefixEntry) return { labelKey: prefixEntry.labelKey };
  return workbenchMenuRouteMap[path];
}

export function buildVisibleDesktopNavGroups({
  sidebarSearchValue,
  t,
  userRole,
}: {
  sidebarSearchValue: string;
  t: I18nContextValue['t'];
  userRole: UserRole;
}): AxiDashboardNavGroup[] {
  const keyword = sidebarSearchValue.trim().toLowerCase();
  // 根据用户角色过滤导航分组
  const roleFiltered = filterNavGroupsByRole(workbenchDesktopNavGroupsWithKeys, userRole);
  const localized = roleFiltered.map((group: WorkbenchNavGroup) => ({
    ...group,
    label: t(group.labelKey),
    children: group.children.map((item) => ({
      ...item,
      label: t(item.labelKey),
    })),
  }));
  const filtered = keyword
    ? localized
        .map((group) => ({
          ...group,
          children: group.children.filter((item) => String(item.label).toLowerCase().includes(keyword)),
        }))
        .filter((group) => group.children.length > 0)
    : localized;
  return filtered as unknown as AxiDashboardNavGroup[];
}

export function buildPersonalOsNavGroups({
  isPersonalOsRoute,
  t,
  visibleDesktopNavGroups,
}: {
  isPersonalOsRoute: boolean;
  t: I18nContextValue['t'];
  visibleDesktopNavGroups: AxiDashboardNavGroup[];
}): AxiDashboardNavGroup[] {
  // Personal OS is a dedicated surface that intentionally lives outside the
  // shared sidebar registry. When the route enters /admin/personal-os/* we
  // swap the sidebar to a one-group projection so other workbench sections
  // stay out of view, matching the fold-into-shared-AxiDashboardShell
  // contract.
  if (!isPersonalOsRoute) {
    return visibleDesktopNavGroups;
  }
  const localizedToday = t('personalOs.nav.today');
  const localizedWorkbench = t('personalOs.nav.workbench');
  return [{
    key: 'personal-os',
    label: t('nav.group.personalOs'),
    iconName: axiWorkbenchIconMap.overview,
    children: [
      {
        key: '/admin/personal-os/today',
        label: localizedToday,
        iconName: axiWorkbenchIconMap.overview,
      },
      {
        key: '/admin/personal-os/workbench',
        label: localizedWorkbench,
        iconName: axiWorkbenchIconMap.project,
      },
    ],
  }];
}

export function buildDesktopBreadcrumbs({
  pathname,
  t,
  navigate,
}: {
  pathname: string;
  t: I18nContextValue['t'];
  navigate: (path: string) => void;
}) {
  return resolveBreadcrumbs(pathname).map((item, index) => ({
    key: `${item.label}-${index}`,
    label: item.labelKey ? t(item.labelKey) : item.label,
    icon: item.icon,
    current: item.isActive,
    href: item.isActive ? undefined : item.path,
    onClick: item.path && !item.isActive ? () => navigate(item.path!) : undefined,
  }));
}