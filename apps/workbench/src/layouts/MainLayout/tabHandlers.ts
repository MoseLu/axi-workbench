/**
 * 标签页 CRUD 回调：focus / close / closeLeft / closeRight / closeOther / closeAll。
 * 全部从原 MainLayout 中抽出，仅做位置搬迁，不修改业务逻辑。
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { TabItem } from '../../lib/tabs';
import {
  closeAll,
  closeLeft,
  closeOther,
  closeRight,
  closeTab,
  focusTab,
} from '../../lib/tabs';

export interface UseTabHandlersArgs {
  activeTab: string;
  tabs: TabItem[];
  setTabs: Dispatch<SetStateAction<TabItem[]>>;
  setActiveTab: Dispatch<SetStateAction<string>>;
  navigate: NavigateFunction;
}

export function useTabHandlers({ activeTab, tabs, setTabs, setActiveTab, navigate }: UseTabHandlersArgs) {
  const handleTabChange = useCallback(
    (key: string) => {
      const result = focusTab(tabs, key);
      setActiveTab(result.nextActive ?? key);
      navigate(key);
    },
    [navigate, tabs, setActiveTab],
  );

  const handleTabClose = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const result = closeTab(prev, key, activeTab);
        if (result.nextActive !== null && result.nextActive !== activeTab) {
          setActiveTab(result.nextActive);
          const last = result.tabs[result.tabs.length - 1];
          if (last && last.key === result.nextActive) navigate(last.path);
        }
        return result.tabs;
      });
    },
    [activeTab, navigate, setActiveTab, setTabs],
  );

  const handleCloseLeft = useCallback(() => {
    setTabs((prev) => closeLeft(prev, activeTab).tabs);
  }, [activeTab, setTabs]);

  const handleCloseRight = useCallback(() => {
    setTabs((prev) => closeRight(prev, activeTab).tabs);
  }, [activeTab, setTabs]);

  const handleCloseOther = useCallback(() => {
    setTabs((prev) => closeOther(prev, activeTab).tabs);
  }, [activeTab, setTabs]);

  const handleCloseAll = useCallback(() => {
    setTabs((prev) => {
      const result = closeAll(prev);
      if (result.nextActive !== null) {
        setActiveTab(result.nextActive);
        const last = result.tabs[result.tabs.length - 1];
        if (last && last.key === result.nextActive) {
          navigate(last.path);
        }
      }
      return result.tabs;
    });
  }, [navigate, setActiveTab, setTabs]);

  return {
    handleTabChange,
    handleTabClose,
    handleCloseLeft,
    handleCloseRight,
    handleCloseOther,
    handleCloseAll,
  };
}