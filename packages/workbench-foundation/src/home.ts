/**
 * 跨端主页的稳定语义模型。
 *
 * Web 和 Mobile 可以用不同的壳层、控件和布局，但主页展示的项目状态
 * 必须先归一到这里，避免两个端各自解释控制面数据。
 */
export type WorkbenchHomeProjectStatus = 'available' | 'attention' | 'unknown';

export type WorkbenchHomeProject = {
  id: string;
  name: string;
  status: WorkbenchHomeProjectStatus;
  health: 'healthy' | 'attention' | 'blocked' | 'stale' | 'unknown';
  summary: string;
  branch: string | null;
  workspace: {
    changedEntries: number;
    clean: boolean | null;
  };
};

export type WorkbenchHomeFilter = {
  keyword: string;
  status: 'all' | WorkbenchHomeProjectStatus;
};

/**
 * 主页的筛选规则是产品语义，不属于桌面表格或移动卡片的实现细节。
 */
export function filterWorkbenchHomeProjects(
  projects: readonly WorkbenchHomeProject[],
  filter: WorkbenchHomeFilter,
): WorkbenchHomeProject[] {
  const keyword = filter.keyword.trim().toLocaleLowerCase('zh-CN');
  return projects.filter((project) => {
    if (filter.status === 'available' && project.status !== 'available') return false;
    // “需要关注”包含控制面无法确认状态的项目，避免各端出现不同筛选结果。
    if (filter.status === 'attention' && project.status === 'available') return false;
    if (!keyword) return true;

    return [
      project.name,
      project.branch ?? '',
      project.summary,
      project.status,
      project.health,
    ].join(' ').toLocaleLowerCase('zh-CN').includes(keyword);
  });
}
