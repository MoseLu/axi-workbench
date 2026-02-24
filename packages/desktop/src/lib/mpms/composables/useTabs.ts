import { useState, useCallback } from 'react';
import type { TabItem } from '../types';

/** Tab management hook */
export function useTabs(initialTabs: TabItem[] = [], initialActive = '') {
  const [tabs, setTabs] = useState<TabItem[]>(initialTabs);
  const [activeTab, setActiveTab] = useState(initialActive || initialTabs[0]?.key || '');

  const addTab = useCallback((tab: TabItem) => {
    setTabs(prev => {
      if (prev.find(t => t.key === tab.key)) return prev;
      return [...prev, tab];
    });
    setActiveTab(tab.key);
  }, []);

  const removeTab = useCallback((key: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === key);
      if (idx === -1 || prev[idx].closable === false) return prev;
      const next = prev.filter(t => t.key !== key);
      return next;
    });
    setActiveTab(prev => {
      if (prev !== key) return prev;
      const currentTabs = tabs;
      const idx = currentTabs.findIndex(t => t.key === key);
      const next = currentTabs[idx + 1] || currentTabs[idx - 1];
      return next?.key || '';
    });
  }, [tabs]);

  const closeLeft = useCallback(() => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === activeTab);
      return prev.filter((t, i) => i >= idx || t.closable === false);
    });
  }, [activeTab]);

  const closeRight = useCallback(() => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === activeTab);
      return prev.filter((t, i) => i <= idx || t.closable === false);
    });
  }, [activeTab]);

  const closeOther = useCallback(() => {
    setTabs(prev => prev.filter(t => t.key === activeTab || t.closable === false));
  }, [activeTab]);

  const closeAll = useCallback(() => {
    setTabs(prev => prev.filter(t => t.closable === false));
    setActiveTab(prev => {
      const pinned = tabs.find(t => t.closable === false);
      return pinned?.key || prev;
    });
  }, [tabs]);

  const togglePin = useCallback((key: string) => {
    setTabs(prev => prev.map(t =>
      t.key === key ? { ...t, closable: t.closable === false ? true : false } : t
    ));
  }, []);

  return {
    tabs, activeTab, setActiveTab, addTab, removeTab,
    closeLeft, closeRight, closeOther, closeAll, togglePin, setTabs,
  } as const;
}
