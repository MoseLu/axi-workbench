export type SearchHitKind = 'navigation' | 'utility';

export type SearchHit = {
  id: string;
  kind: SearchHitKind;
  title: string;
  subtitle: string;
  path: string;
};

/**
 * Shared, source-backed navigation corpus for the Web search page and command
 * palette. It intentionally contains only real routes; projects and documents
 * are not fabricated before their authoritative sources are connected.
 */
export const SEARCH_CORPUS: SearchHit[] = [
  { id: 'dashboard', kind: 'navigation', title: '概览', subtitle: '工作台首页', path: '/admin/dashboard' },
  { id: 'projects', kind: 'navigation', title: '项目', subtitle: '项目工作区', path: '/admin/project' },
  { id: 'workspace', kind: 'navigation', title: '工作区', subtitle: '任务与资源', path: '/admin/task' },
  { id: 'team', kind: 'navigation', title: '团队', subtitle: '协作成员', path: '/admin/team' },
  { id: 'profile', kind: 'navigation', title: '个人中心', subtitle: '账号与设置', path: '/admin/me' },
  { id: 'notifications', kind: 'utility', title: '通知中心', subtitle: '工作台提醒', path: '/admin/me/notifications' },
  { id: 'menu', kind: 'utility', title: '菜单配置', subtitle: '导航入口管理', path: '/admin/settings/menu' },
  { id: 'roles', kind: 'utility', title: '角色权限', subtitle: '权限事实源', path: '/admin/settings/role' },
  { id: 'scan', kind: 'utility', title: '扫码', subtitle: '摄像头与二维码识别', path: '/admin/scan' },
];

export const SEARCH_SECTIONS: { key: SearchHitKind; label: string }[] = [
  { key: 'navigation', label: '页面' },
  { key: 'utility', label: '工具' },
];

export function filterSearchCorpus(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [] as SearchHit[];
  return SEARCH_CORPUS.filter((hit) =>
    [hit.title, hit.subtitle].some((value) => value.toLowerCase().includes(normalized)),
  );
}
