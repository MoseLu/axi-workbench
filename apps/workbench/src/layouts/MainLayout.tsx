import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AxiLogoMark, useAxiTheme } from '@axi/core';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { axiStylePresets } from '@axi/presets';
import { AxiAdminSettingsPanel, useAxiAdminSettings } from '@axi/settings';
import {
  AxiDashboardShell,
  type AxiDashboardNavGroup,
} from '@axi/shell';
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
import { WorkbenchIcon } from '../components/WorkbenchIcon';
import './MainLayout.css';

const menuRouteMap: Record<string, { label: string }> = {
  '/admin/dashboard': { label: '概览' },
  '/admin/project': { label: '项目' },
  '/admin/task': { label: '工作区' },
  '/admin/team': { label: '团队' },
  '/admin/scan': { label: '扫一扫' },
  '/admin/me': { label: '我的' },
  '/admin/settings/menu': { label: '菜单列表' },
  '/admin/settings/user': { label: '我的' },
  '/admin/settings/role': { label: '角色列表' },
};

/**
 * Web 管理端专属导航。移动端由独立的 @axi/workbench-mobile 应用拥有自己的
 * 信息架构、页面组合和底部导航，不导入本树。
 */
const desktopNavGroups: AxiDashboardNavGroup[] = [
  {
    key: 'workbench',
    label: '工作台',
    iconName: axiWorkbenchIconMap.overview,
    children: [
      { key: '/admin/dashboard', label: '概览', iconName: axiWorkbenchIconMap.overview },
      { key: '/admin/project', label: '项目', iconName: axiWorkbenchIconMap.project },
      { key: '/admin/task', label: '工作区', iconName: axiWorkbenchIconMap.workspace },
      { key: '/admin/team', label: '团队', iconName: axiWorkbenchIconMap.team },
      { key: '/admin/scan', label: '扫一扫', iconName: axiWorkbenchIconMap.scan },
    ],
  },
  {
    key: 'account',
    label: '账号与设置',
    iconName: axiWorkbenchIconMap.settings,
    children: [
      { key: '/admin/me', label: '个人中心', iconName: axiWorkbenchIconMap.account },
      { key: '/admin/me/notifications', label: '通知中心', iconName: axiWorkbenchIconMap.notification },
      { key: '/admin/settings/menu', label: '菜单配置', iconName: axiWorkbenchIconMap.menu },
      { key: '/admin/settings/role', label: '角色权限', iconName: axiWorkbenchIconMap.roles },
    ],
  },
];

const MainLayout: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarSearchValue, setSidebarSearchValue] = useState('');
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [tabs, setTabs] = useState<TabItem[]>([HOME_TAB]);
  const [activeTab, setActiveTab] = useState<string>(HOME_TAB.key);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, preference, preset, setPreference, setPreset, toggleMode } = useAxiTheme();
  const { settings, updateSetting } = useAxiAdminSettings({
    applyToDocument: true,
    storageKey: 'axi.workbench.admin-settings',
    userId: user?.id ?? null,
  });

  // Web 顶栏通知角标。
  const tabBadges = useNavBadges(true);
  const unreadCount = tabBadges.unreadTotal;

  const displayName = user?.name || t('common.user.admin') || '用户';

  const globalSearchItems = useMemo<GlobalSearchItem[]>(() => {
    const navItems = desktopNavGroups.flatMap((group) =>
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
      group: hit.kind === 'project' ? '项目' : hit.kind === 'doc' ? '文档' : '相关内容',
      path: hit.path,
      iconName: (hit.kind === 'project' ? axiWorkbenchIconMap.project : hit.kind === 'doc' ? axiWorkbenchIconMap.file : axiWorkbenchIconMap.search) as GlobalSearchItem['iconName'],
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
    const routeInfo = menuRouteMap[path];
    if (!routeInfo) {
      setActiveTab(path);
      return;
    }
    let nextActive: string | null = null;
    setTabs((prev) => {
      const result = openTab(prev, {
        key: path,
        label: routeInfo.label,
        path,
      });
      nextActive = result.nextActive;
      return result.tabs;
    });
    if (nextActive !== null) setActiveTab(nextActive);
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
    if (!keyword) return desktopNavGroups;
    return desktopNavGroups
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

  /* ---------- Web: shared Axi admin chrome ---------- */
  return (
    <>
      <AxiDashboardShell
        activeNavKey={location.pathname}
        activeTabKey={activeTab}
        avatarConfig={{
          avatar: <WorkbenchIcon name="account" size={16} />,
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
        githubHref="https://github.com/axiomaticworld/axi-workbench"
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
          notice: {
            badge: unreadCount || undefined,
            badgeTone: 'danger',
            iconName: axiWorkbenchIconMap.notification,
            key: 'notice',
            label: '通知',
            onClick: () => navigate('/admin/me/notifications'),
          },
          // 没有独立即时通讯领域时，不渲染会误导到通知中心的消息入口。
          message: false,
          language: {
            iconName: axiWorkbenchIconMap.language,
            key: 'language',
            label: locale === 'zh-CN' ? '切换为 English' : '切换为中文',
            onClick: () => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN'),
          },
          theme: {
            iconName: mode === 'dark' ? axiWorkbenchIconMap.sun : axiWorkbenchIconMap.moon,
            key: 'theme',
            label: mode === 'dark' ? '切换亮色模式' : '切换暗色模式',
            onClick: (event) => toggleMode(event.currentTarget),
          },
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
    </>
  );
};

export default MainLayout;
