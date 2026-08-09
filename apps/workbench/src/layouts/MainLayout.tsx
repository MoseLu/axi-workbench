import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AxiLogoMark, AxiSvgIcon, useAxiTheme } from '@axi/core';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { axiStylePresets } from '@axi/presets';
import { AxiAdminSettingsPanel, useAxiAdminSettings } from '@axi/settings';
import {
  AxiDashboardShell,
  AxiFloatingToolDock,
  createAxiShellPlugins,
} from '@axi/shell';
import { AxiPluginProvider } from '@axi/core';
import type { TabItem } from '../lib/tabs';
import GlobalSearchDialog, { type GlobalSearchItem } from '../components/Layout/GlobalSearchDialog';
import { useI18n } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { resolveBreadcrumbs } from '../lib/breadcrumbs';
import { SEARCH_CORPUS } from '../lib/search-data';
import {
  HOME_TAB,
  openTab,
  focusTab,
  closeTab,
  closeLeft,
  closeRight,
  closeOther,
  closeAll,
} from '../lib/tabs';
import { useNavBadges } from '../hooks/useNavBadges';
import { workbenchDesktopNavGroups, workbenchMenuRouteMap } from '../lib/navigationRegistry';
import { loadProfile, resolveAvatarSrc, type UserProfile } from '../pages/admin/me/profileStore';
import './MainLayout.css';

function resolveMenuRoute(path: string): { label: string } | undefined {
  if (path.startsWith('/admin/project/')) return { label: '项目详情' };
  if (path.startsWith('/admin/handoff/')) return { label: '跨端续办' };
  return workbenchMenuRouteMap[path];
}

const TABS_STORAGE_KEY = 'axi.workbench.tabs.v1';

function loadPersistedTabs(): { tabs: TabItem[]; activeTab: string } {
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

const MainLayout: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(user));
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarSearchValue, setSidebarSearchValue] = useState('');
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const persistedTabs = useMemo(loadPersistedTabs, []);
  const [tabs, setTabs] = useState<TabItem[]>(persistedTabs.tabs);
  const [activeTab, setActiveTab] = useState<string>(persistedTabs.activeTab);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { preference, preset, setPreference, setPreset } = useAxiTheme();
  const { settings, updateSetting } = useAxiAdminSettings({
    applyToDocument: true,
    storageKey: 'axi.workbench.admin-settings',
    userId: user?.id ?? null,
  });

  // Web 顶栏通知角标。
  const tabBadges = useNavBadges(true);
  const unreadCount = tabBadges.unreadTotal;

  useEffect(() => {
    try {
      window.localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ tabs, activeTab }));
    } catch {
      // Private browsing/storage-disabled environments still retain tabs in memory.
    }
  }, [activeTab, tabs]);

  const displayName = profile.nickname || user?.name || t('common.user.admin') || '用户';

  useEffect(() => {
    const onProfileChange = () => setProfile(loadProfile(user));
    onProfileChange();
    window.addEventListener('wb-profile-changed', onProfileChange);
    return () => window.removeEventListener('wb-profile-changed', onProfileChange);
  }, [user]);

  const globalSearchItems = useMemo<GlobalSearchItem[]>(() => {
    const navItems = workbenchDesktopNavGroups.flatMap((group) =>
      group.children.map((item) => ({
        key: `nav:${item.key}`,
        label: String(item.label),
        description: '打开后台页面',
        group: String(group.label),
        path: item.key,
        iconName: item.iconName ?? axiWorkbenchIconMap.menu,
      })),
    );
    const corpusItems = SEARCH_CORPUS.map((hit) => ({
      key: `content:${hit.id}`,
      label: hit.title,
      description: hit.subtitle,
      group: hit.kind === 'navigation' ? '页面' : '工具',
      path: hit.path,
      iconName: (hit.kind === 'navigation' ? axiWorkbenchIconMap.menu : axiWorkbenchIconMap.search) as GlobalSearchItem['iconName'],
    }));
    return [...navItems, ...corpusItems];
  }, []);

  const recentSearchItems = useMemo(() => {
    const preferredPaths = [
      location.pathname,
      '/admin/dashboard',
      '/admin/project',
      '/admin/task',
      '/admin/me/notifications',
    ];
    const seen = new Set<string>();
    return preferredPaths
      .map((path) => globalSearchItems.find((item) => item.path === path))
      .filter((item): item is GlobalSearchItem => {
        if (!item || seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      })
      .slice(0, 5);
  }, [globalSearchItems, location.pathname]);

  const openGlobalSearch = useCallback(() => {
    setGlobalSearchQuery('');
    setGlobalSearchOpen(true);
  }, []);

  const closeGlobalSearch = useCallback(() => {
    setGlobalSearchOpen(false);
    setGlobalSearchQuery('');
  }, []);

  const handleGlobalSearchSelect = useCallback((item: GlobalSearchItem) => {
    closeGlobalSearch();
    navigate(item.path);
  }, [closeGlobalSearch, navigate]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openGlobalSearch();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openGlobalSearch]);

  useEffect(() => {
    const path = location.pathname;
    const routeInfo = resolveMenuRoute(path);
    if (!routeInfo) {
      setActiveTab(path);
      return;
    }
    setTabs((prev) => {
      const result = openTab(prev, {
        key: path,
        label: routeInfo.label,
        path,
      });
      return result.tabs;
    });
    setActiveTab(path);
  }, [location.pathname]);

  const handleTabChange = useCallback(
    (key: string) => {
      const result = focusTab(tabs, key);
      setActiveTab(result.nextActive ?? key);
      navigate(key);
    },
    [navigate, tabs],
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
    [activeTab, navigate],
  );

  const handleCloseLeft = useCallback(() => {
    setTabs((prev) => closeLeft(prev, activeTab).tabs);
  }, [activeTab]);

  const handleCloseRight = useCallback(() => {
    setTabs((prev) => closeRight(prev, activeTab).tabs);
  }, [activeTab]);

  const handleCloseOther = useCallback(() => {
    setTabs((prev) => closeOther(prev, activeTab).tabs);
  }, [activeTab]);

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
  }, [navigate]);

  const visibleDesktopNavGroups = useMemo(() => {
    const keyword = sidebarSearchValue.trim().toLowerCase();
    if (!keyword) return workbenchDesktopNavGroups;
    return workbenchDesktopNavGroups
      .map((group) => ({
        ...group,
        children: group.children.filter((item) => String(item.label).toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.children.length > 0);
  }, [sidebarSearchValue]);

  const desktopBreadcrumbs = useMemo(
    () => resolveBreadcrumbs(location.pathname).map((item, index) => ({
      key: `${item.label}-${index}`,
      label: item.label,
      icon: item.icon,
      current: item.isActive,
      href: item.isActive ? undefined : item.path,
      onClick: item.path && !item.isActive ? () => navigate(item.path!) : undefined,
    })),
    [location.pathname, navigate],
  );

  const desktopTabs = useMemo(
    () => tabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      closable: tab.closable !== false,
      pinned: tab.closable === false,
      status: 'ready' as const,
    })),
    [tabs],
  );

  const stylePresetOptions = useMemo(
    () => axiStylePresets.map((item) => ({ id: item.id, label: item.label, labelKey: item.id })),
    [],
  );

  const floatingTools = useMemo(() => (
    <AxiFloatingToolDock
      label="Workbench 快捷工具"
      triggerLabel="打开快捷工具"
      closeLabel="关闭快捷工具"
      brandIcon={<AxiLogoMark size={14} />}
      triggerIcon={<AxiSvgIcon name={axiWorkbenchIconMap.menu} size={16} />}
      openTriggerIcon={<AxiSvgIcon name={axiWorkbenchIconMap.close} size={16} />}
      items={[
        {
          key: 'search',
          label: '快速搜索',
          icon: <AxiSvgIcon name={axiWorkbenchIconMap.search} size={16} />,
          onClick: openGlobalSearch,
        },
        {
          key: 'notifications',
          label: '通知中心',
          icon: <AxiSvgIcon name={axiWorkbenchIconMap.notification} size={16} />,
          onClick: () => navigate('/admin/me/notifications'),
        },
        {
          key: 'github',
          label: 'GitHub',
          href: 'https://github.com/axiomaticworld/axi-workbench',
          target: '_blank' as const,
          icon: <AxiSvgIcon name={axiWorkbenchIconMap.github} size={16} />,
        },
      ]}
      renderPanel={(item) => (
        <div className="workbench-floating-tool-panel">
          <strong>{item?.label ?? '快捷工具'}</strong>
          <span>当前工作区快捷入口</span>
        </div>
      )}
    />
  ), [navigate, openGlobalSearch]);

  const shellPlugins = useMemo(() => createAxiShellPlugins({
    github: {
      href: 'https://github.com/axiomaticworld/axi-workbench',
      target: '_blank',
      label: 'GitHub',
    },
    notification: {
      count: unreadCount || undefined,
      label: '通知',
      name: 'notice',
      tone: 'danger',
      onClick: () => navigate('/admin/me/notifications'),
    },
    locale: {
      value: locale,
      items: [
        { key: 'zh-CN', label: '中文' },
        { key: 'en-US', label: 'English' },
      ],
      onChange: (value) => setLocale(value as 'zh-CN' | 'en-US'),
    },
    theme: {
      value: preference,
      onChange: setPreference,
    },
  }), [locale, navigate, preference, setLocale, setPreference, unreadCount]);

  /* ---------- Web: shared Axi admin chrome ---------- */
  return (
    <AxiPluginProvider plugins={shellPlugins}>
      <AxiDashboardShell
        activeNavKey={location.pathname.startsWith('/admin/project/') ? '/admin/project' : location.pathname}
        activeTabKey={activeTab}
        avatarConfig={{
          avatar: <AxiSvgIcon name={axiWorkbenchIconMap.account} size={16} />,
          imageSrc: resolveAvatarSrc(profile.avatarDataUrl),
          label: displayName,
          menuItems: [
            {
              key: 'profile',
              label: '个人中心',
              iconName: axiWorkbenchIconMap.account,
              onClick: () => navigate('/admin/me'),
            },
            {
              key: 'logout',
              label: '退出登录',
              iconName: axiWorkbenchIconMap.logout,
              onClick: () => {
                logout();
                navigate('/login');
              },
            },
          ],
          name: displayName,
        }}
        brand={{
          logo: <AxiLogoMark size={24} className="workbench-axi-brand-mark" />,
          title: 'Axi WorkBench',
        }}
        breadcrumbs={settings.breadcrumb ? desktopBreadcrumbs : []}
        breadcrumbLabel="页面位置"
        className="workbench-axi-shell"
        contentClassName="workbench-axi-content"
        contentFullscreen={contentFullscreen}
        floatingTools={floatingTools}
        githubHref={undefined}
        globalSearchLabel="快速搜索"
        globalSearchShortcut="⌘ K"
        navGroups={visibleDesktopNavGroups}
        onBack={() => window.history.back()}
        onFullscreenToggle={() => setContentFullscreen((value) => !value)}
        onGlobalSearch={openGlobalSearch}
        onHome={() => navigate('/admin/dashboard')}
        onNavSelect={(key) => {
          if (key.startsWith('/')) navigate(key);
        }}
        onReload={() => window.location.reload()}
        onSettings={() => setSettingsOpen(true)}
        onSidebarCollapsedChange={setCollapsed}
        onSidebarSearchChange={setSidebarSearchValue}
        onTabClose={handleTabClose}
        onTabCloseAll={() => handleCloseAll()}
        onTabCloseLeft={() => handleCloseLeft()}
        onTabCloseOthers={() => handleCloseOther()}
        onTabCloseRight={() => handleCloseRight()}
        onTabSelect={handleTabChange}
        pageProps={{ fluid: true, padded: true }}
        preferences={settings}
        sidebarCollapsed={collapsed}
        sidebarSearchPlaceholder="搜索菜单"
        sidebarSearchValue={sidebarSearchValue}
        tabs={settings.multiTab ? desktopTabs : []}
        topbarActions={{
          notice: false,
          // 没有独立即时通讯领域时，不渲染会误导到通知中心的消息入口。
          message: false,
          language: false,
          theme: false,
          settings: {
            iconName: axiWorkbenchIconMap.settings,
            key: 'settings',
            label: '系统设置',
            onClick: () => setSettingsOpen(true),
          },
        }}
      >
        <Outlet />
      </AxiDashboardShell>

      <GlobalSearchDialog
        open={globalSearchOpen}
        query={globalSearchQuery}
        items={globalSearchItems}
        recentItems={recentSearchItems}
        onChange={setGlobalSearchQuery}
        onClose={closeGlobalSearch}
        onSelect={handleGlobalSearchSelect}
      />

      {settingsOpen ? (
        <AxiAdminSettingsPanel
          activeStylePreset={settings.stylePreset}
          activeTheme={preset.name}
          open={settingsOpen}
          stylePresetOptions={stylePresetOptions}
          themePreference={preference}
          value={settings}
          onChange={updateSetting}
          onOpenChange={setSettingsOpen}
          onStylePresetChange={(stylePreset) => updateSetting('stylePreset', stylePreset)}
          onThemeChange={(name) => {
            updateSetting('themeColor', '');
            setPreset(name);
          }}
          onThemeColorChange={(color) => updateSetting('themeColor', color)}
          onThemePreferenceChange={setPreference}
        />
      ) : null}
    </AxiPluginProvider>
  );
};

export default MainLayout;
