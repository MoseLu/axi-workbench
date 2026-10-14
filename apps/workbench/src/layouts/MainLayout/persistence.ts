/**
 * 标签页持久化相关常量与加载器。
 *
 * 仅做位置搬迁 + import 路径本地化，不修改业务逻辑。
 */
import type { TabItem } from '../../lib/tabs';
import { HOME_TAB } from '../../lib/tabs';

export const TABS_STORAGE_KEY = 'axi.workbench.tabs.v1';

export function loadPersistedTabs(): { tabs: TabItem[]; activeTab: string } {
  if (typeof window === 'undefined') return { tabs: [HOME_TAB], activeTab: HOME_TAB.key };
  try {
    const raw = window.localStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return { tabs: [HOME_TAB], activeTab: HOME_TAB.key };
    const value = JSON.parse(raw) as { tabs?: unknown; activeTab?: unknown };
    if (!Array.isArray(value.tabs)) return { tabs: [HOME_TAB], activeTab: HOME_TAB.key };
    const tabs = value.tabs.filter((tab): tab is TabItem => {
      if (!tab || typeof tab !== 'object') return false;
      const candidate = tab as Partial<TabItem>;
      return typeof candidate.key === 'string' && candidate.key.startsWith('/')
        && typeof candidate.path === 'string' && candidate.path.startsWith('/')
        && typeof candidate.label === 'string';
    });
    const normalized = tabs.some((tab) => tab.key === HOME_TAB.key) ? tabs : [HOME_TAB, ...tabs];
    const activeTab = typeof value.activeTab === 'string' && normalized.some((tab) => tab.key === value.activeTab)
      ? value.activeTab
      : HOME_TAB.key;
    return { tabs: normalized, activeTab };
  } catch {
    return { tabs: [HOME_TAB], activeTab: HOME_TAB.key };
  }
}