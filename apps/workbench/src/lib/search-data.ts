export type SearchHitKind = 'navigation' | 'utility';

export type SearchHit = {
  id: string;
  kind: SearchHitKind;
  title: string;
  titleKey: string;
  subtitle: string;
  subtitleKey: string;
  path: string;
};

/**
 * Shared, source-backed navigation corpus for the Web search page and command
 * palette. It intentionally contains only real routes; projects and documents
 * are not fabricated before their authoritative sources are connected.
 *
 * Each hit carries the canonical Chinese literal (used by tests and as a
 * fallback) plus an i18n key consumed by the renderer via useI18n(). Adding
 * a hit requires both fields.
 */
export const SEARCH_CORPUS: SearchHit[] = [
  { id: 'personal-os-today', kind: 'navigation', title: '今日', titleKey: 'personalOs.nav.today', subtitle: '焦点项目、活动与需要处理的项目', subtitleKey: 'personalOs.search.todaySubtitle', path: '/admin/personal-os/today' },
  { id: 'personal-os-workbench', kind: 'navigation', title: '项目队列', titleKey: 'personalOs.nav.workbench', subtitle: '生命周期、运行时与项目完成定义', subtitleKey: 'personalOs.search.workbenchSubtitle', path: '/admin/personal-os/workbench' },
  { id: 'dashboard', kind: 'navigation', title: '工作台概览', titleKey: 'nav.dashboard', subtitle: '跨项目状态、任务与运行环境概览', subtitleKey: 'search.dashboard.subtitle', path: '/admin/dashboard' },
  { id: 'operations', kind: 'navigation', title: '运行状态', titleKey: 'nav.operations', subtitle: '项目健康、受管运行环境与需要处理事项', subtitleKey: 'search.operations.subtitle', path: '/admin/operations' },
  { id: 'projects', kind: 'navigation', title: '项目组合', titleKey: 'nav.projects', subtitle: '跨项目筛选、比较与详情', subtitleKey: 'search.projects.subtitle', path: '/admin/project' },
  { id: 'workspace', kind: 'navigation', title: '工作项', titleKey: 'nav.tasks', subtitle: '受管任务与待处理审批队列', subtitleKey: 'search.tasks.subtitle', path: '/admin/task' },
  { id: 'team', kind: 'navigation', title: '团队', titleKey: 'nav.team', subtitle: '协作成员', subtitleKey: 'search.team.subtitle', path: '/admin/team' },
  { id: 'profile', kind: 'utility', title: '个人中心', titleKey: 'nav.crumb.profile', subtitle: '个人资料', subtitleKey: 'search.profile.subtitle', path: '/admin/me' },
  { id: 'notifications', kind: 'utility', title: '通知中心', titleKey: 'nav.crumb.notifications', subtitle: '工作台提醒', subtitleKey: 'search.notifications.subtitle', path: '/admin/me/notifications' },
  { id: 'menu', kind: 'utility', title: '菜单配置', titleKey: 'nav.settings.menu.configure', subtitle: '导航入口管理', subtitleKey: 'search.menu.subtitle', path: '/admin/settings/menu' },
  { id: 'roles', kind: 'utility', title: '角色权限', titleKey: 'nav.settings.role.permission', subtitle: '权限事实源', subtitleKey: 'search.roles.subtitle', path: '/admin/settings/role' },
];

export const SEARCH_SECTIONS: { key: SearchHitKind; label: string; labelKey: string }[] = [
  { key: 'navigation', label: '页面', labelKey: 'search.section.navigation' },
  { key: 'utility', label: '工具', labelKey: 'search.section.utility' },
];

export function filterSearchCorpus(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [] as SearchHit[];
  return SEARCH_CORPUS.filter((hit) =>
    [hit.title, hit.subtitle].some((value) => value.toLowerCase().includes(normalized)),
  );
}
