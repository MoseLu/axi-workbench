export type SearchHitKind = 'project' | 'doc' | 'content';

export type SearchHit = {
  id: string;
  kind: SearchHitKind;
  title: string;
  subtitle: string;
  path: string;
};

/**
 * Shared search corpus for the mobile search page and the desktop command
 * palette. The data stays local until the search API is connected, but the
 * navigation contract is already the same on both surfaces.
 */
export const SEARCH_CORPUS: SearchHit[] = [
  { id: 'p1', kind: 'project', title: '项目 A · Mobile Redesign', subtitle: '进行中 · 5 成员', path: '/admin/project' },
  { id: 'p2', kind: 'project', title: '项目 B · 文档重构', subtitle: '进行中 · 3 成员', path: '/admin/project' },
  { id: 'p3', kind: 'project', title: '项目 C · 设计系统 v2', subtitle: '规划中 · 4 成员', path: '/admin/project' },
  { id: 'd1', kind: 'doc', title: 'README.md', subtitle: '项目 A · 文档', path: '/admin/project' },
  { id: 'd2', kind: 'doc', title: 'API 设计说明', subtitle: '项目 B · 文档', path: '/admin/project' },
  { id: 'd3', kind: 'doc', title: '设计系统规范', subtitle: '项目 C · 文档', path: '/admin/project' },
  { id: 'c1', kind: 'content', title: '登录页改版任务', subtitle: '项目 A · 任务', path: '/admin/task' },
  { id: 'c2', kind: 'content', title: '扫一扫授权流程', subtitle: '项目 A · 需求', path: '/admin/scan' },
  { id: 'c3', kind: 'content', title: '底栏导航规范', subtitle: '项目 C · 设计', path: '/admin/task' },
];

export const SEARCH_SECTIONS: { key: SearchHitKind; label: string }[] = [
  { key: 'project', label: '项目' },
  { key: 'doc', label: '文档' },
  { key: 'content', label: '相关内容' },
];

export function filterSearchCorpus(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [] as SearchHit[];
  return SEARCH_CORPUS.filter((hit) =>
    [hit.title, hit.subtitle].some((value) => value.toLowerCase().includes(normalized)),
  );
}
