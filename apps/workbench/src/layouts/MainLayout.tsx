import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';import { AxiLogoMark, useAxiTheme } from "@axi/core";
import { AxiSvgIcon } from "@axi/icons";

import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { axiStylePresets } from '@axi/presets';
import { AxiAdminSettingsPanel, useAxiAdminSettings } from '@axi/settings';
import {
  AxiDashboardShell,
  AxiFloatingToolDock,
  createAxiShellPlugins,
  type AxiDashboardNavGroup,
  type AxiDashboardTopbarPluginAction,
} from '@axi/shell';
import { AxiPluginProvider } from '@axi/core';
// Component CSS — colocated with the JS modules that actually consume them so
// Vite stops hoisting every @axi/* stylesheet into the main entry's <head>.
// `main.tsx` keeps only antd reset + @axi/tokens (≈8 KB) plus our local
// `MainLayout.css`. MainLayout is mounted only after auth (via <RequireSession>),
// so these styles do not block /login's first paint.
import '@axi/core/styles.css';
import '@axi/crud/styles.css';
import '@axi/shell/styles.css';
import '@axi/settings/styles.css';
import '@axi/widgets/styles.css';
import type { TabItem } from '../lib/tabs';
import GlobalSearchDialog, { type GlobalSearchItem } from '../components/Layout/GlobalSearchDialog';
import { SystemSettingsPanel } from '../components/Layout/SystemSettingsPanel';
import { useI18n } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { SEARCH_CORPUS, SEARCH_SECTIONS } from '../lib/search-data';
import { openTab, localizeTabLabels } from '../lib/tabs';
import { useNavBadges } from '../hooks/useNavBadges';
import { emitShellLogout, emitShellUnread } from '../lib/shell';
import { workbenchDesktopNavGroupsWithKeys } from '../lib/navigationRegistry';
import { loadProfile, resolveAvatarSrc, type UserProfile } from '../pages/admin/me/profileStore';
import { WorkbenchFloatingToolArrow } from '../lib/floatingToolArrow';
import { getUserRole, type UserRole } from '../config';
import {
  buildDesktopBreadcrumbs,
  buildPersonalOsNavGroups,
  buildVisibleDesktopNavGroups,
  resolveMenuRoute,
} from './MainLayout/navigation';
import { TABS_STORAGE_KEY, loadPersistedTabs } from './MainLayout/persistence';
import { useTabHandlers } from './MainLayout/tabHandlers';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(user));
  const [collapsed, setCollapsed] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [systemSettingsOpen, setSystemSettingsOpen] = useState(false);
  const [sidebarSearchValue, setSidebarSearchValue] = useState('');
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const persistedTabs = useMemo(loadPersistedTabs, []);
  const [tabs, setTabs] = useState<TabItem[]>(persistedTabs.tabs);
  const [activeTab, setActiveTab] = useState<string>(persistedTabs.activeTab);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isPersonalOsRoute = location.pathname.startsWith('/admin/personal-os');
  const { mode, preference, setPreference, setStylePreset, themeColor, setThemeColor, toggleMode } = useAxiTheme();
  const { settings, updateSetting } = useAxiAdminSettings({
    applyToDocument: true,
    storageKey: 'axi.workbench.admin-settings',
    userId: user?.id ?? null,
  });

  // Web 顶栏通知角标。
  const tabBadges = useNavBadges(true);
  const unreadCount = tabBadges.unreadTotal;

  // 推未读总数到 Tauri shell（用于 Dock 红点 / 托盘 title）。
  // 见 docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md §5。
  // shell.ts 内置降级：纯浏览器下走 CustomEvent，永不抛错。
  useEffect(() => {
    void emitShellUnread(unreadCount);
  }, [unreadCount]);

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
    const navItems = workbenchDesktopNavGroupsWithKeys.flatMap((group) =>
      group.children.map((item) => ({
        key: `nav:${item.key}`,
        label: t(item.labelKey),
        description: t('common.search.description'),
        group: t(group.labelKey),
        path: item.key,
        iconName: (item.iconName ?? axiWorkbenchIconMap.menu) as GlobalSearchItem['iconName'],
      })),
    );
    const corpusItems = SEARCH_CORPUS.map((hit) => ({
      key: `content:${hit.id}`,
      label: t(hit.titleKey),
      description: t(hit.subtitleKey),
      group: t(SEARCH_SECTIONS.find((section) => section.key === hit.kind)?.labelKey ?? 'search.section.utility'),
      path: hit.path,
      iconName: (hit.kind === 'navigation' ? axiWorkbenchIconMap.menu : axiWorkbenchIconMap.search) as GlobalSearchItem['iconName'],
    }));
    return [...navItems, ...corpusItems];
  }, [t]);

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
    setTabs((prev) => {
      const localized = localizeTabLabels(prev, (tabPath) => {
        const tabRouteInfo = resolveMenuRoute(tabPath);
        return tabRouteInfo ? t(tabRouteInfo.labelKey) : undefined;
      });
      if (!routeInfo) return localized;
      const result = openTab(localized, {
        key: path,
        label: t(routeInfo.labelKey),
        path,
      });
      return result.tabs;
    });
    setActiveTab(path);
  }, [location.pathname, t]);

  const {
    handleTabChange,
    handleTabClose,
    handleCloseLeft,
    handleCloseRight,
    handleCloseOther,
    handleCloseAll,
  } = useTabHandlers({ activeTab, tabs, setTabs, setActiveTab, navigate });

  // 从本地配置读取用户角色
  const userRole = useMemo<UserRole>(() => getUserRole(), []);

  const visibleDesktopNavGroups = useMemo<AxiDashboardNavGroup[]>(
    () => buildVisibleDesktopNavGroups({ sidebarSearchValue, t, userRole }),
    [sidebarSearchValue, t, userRole],
  );

  const shellNavGroups = useMemo<AxiDashboardNavGroup[]>(
    () => buildPersonalOsNavGroups({ isPersonalOsRoute, t, visibleDesktopNavGroups }),
    [isPersonalOsRoute, t, visibleDesktopNavGroups],
  );

  const desktopBreadcrumbs = useMemo(
    () => buildDesktopBreadcrumbs({ pathname: location.pathname, t, navigate }),
    [location.pathname, navigate, t],
  );

  const desktopTabs = useMemo(
    () => localizeTabLabels(tabs, (path) => {
      const routeInfo = resolveMenuRoute(path);
      return routeInfo ? t(routeInfo.labelKey) : undefined;
    }).map((tab) => ({
      key: tab.key,
      label: tab.label,
      closable: tab.closable !== false,
      pinned: tab.closable === false,
      status: 'ready' as const,
    })),
    [t, tabs],
  );

  const stylePresetOptions = useMemo(
    () => axiStylePresets.map((item) => ({ id: item.id, label: item.label, labelKey: item.id })),
    [],
  );

  const floatingTools = useMemo(() => (
    <AxiFloatingToolDock
      label={t('layout.floatingTools.label')}
      triggerLabel={t('layout.floatingTools.open')}
      closeLabel={t('layout.floatingTools.close')}
      brandIcon={<AxiLogoMark size={14} />}
      triggerIcon={<WorkbenchFloatingToolArrow direction="up-left" />}
      openTriggerIcon={<WorkbenchFloatingToolArrow direction="down-right" />}
      items={[
        {
          key: 'search',
          label: t('layout.globalSearch.label'),
          icon: <AxiSvgIcon name={axiWorkbenchIconMap.search} size={16} />,
          onClick: openGlobalSearch,
        },
        {
          key: 'notifications',
          label: t('nav.crumb.notifications'),
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
          <strong>{item?.label ?? t('layout.floatingTools.fallback')}</strong>
          <span>{t('layout.floatingTools.panelHint')}</span>
        </div>
      )}
    />
  ), [navigate, openGlobalSearch, t]);

  const shellPlugins = useMemo(() => createAxiShellPlugins({
    github: {
      href: 'https://github.com/axiomaticworld/axi-workbench',
      target: '_blank',
      label: 'GitHub',
    },
    notification: {
      count: unreadCount || undefined,
      label: t('layout.topbar.notifications'),
      name: 'notice',
      tone: 'danger',
      onClick: () => navigate('/admin/me/notifications'),
    },
    locale: {
      value: locale,
      items: [
        { key: 'zh-CN', label: t('layout.locale.zh-CN') },
        { key: 'en-US', label: t('layout.locale.en-US') },
      ],
      onChange: (value) => setLocale(value as 'zh-CN' | 'en-US'),
    },
  }), [locale, navigate, setLocale, t, unreadCount]);

  const topbarPluginActions = useMemo<AxiDashboardTopbarPluginAction[]>(() => [
    {
      key: 'preferences',
      iconName: axiWorkbenchIconMap.preferences,
      label: t('layout.topbar.preferences'),
      onClick: () => {
        setSystemSettingsOpen(false);
        setPreferencesOpen(true);
      },
    },
  ], [t]);

  /* ---------- Web: shared Axi admin chrome ---------- */
  return (
    <AxiPluginProvider plugins={shellPlugins}>
      <AxiDashboardShell
        activeNavKey={location.pathname.startsWith('/admin/project/') ? '/admin/project' : location.pathname}
        activeTabKey={activeTab}
        avatarConfig={{
          avatar: <AxiSvgIcon name={axiWorkbenchIconMap.account} size={16} />,
          description: profile.email,
          imageSrc: resolveAvatarSrc(profile.avatarDataUrl),
          label: displayName,
          previewCloseLabel: t('account.avatar.previewClose'),
          previewLabel: t('account.avatar.preview'),
          previewTitle: t('account.avatar.previewTitle'),
          menuItems: [
            {
              key: 'profile',
              label: t('nav.crumb.profile'),
              iconName: axiWorkbenchIconMap.account,
              onClick: () => navigate('/admin/me'),
            },
            {
              key: 'logout',
              label: t('layout.avatar.logout'),
              iconName: axiWorkbenchIconMap.logout,
              onClick: async () => {
                await logout();
                await emitShellLogout();
                navigate('/login');
              },
            },
          ],
          name: displayName,
        }}
        brand={{
          logo: <AxiLogoMark size={24} className="workbench-axi-brand-mark" />,
          subtitle: isPersonalOsRoute ? t('personalOs.shell.subtitle') : undefined,
          title: isPersonalOsRoute ? t('personalOs.shell.brand') : t('app.name'),
        }}
        breadcrumbs={settings.breadcrumb ? desktopBreadcrumbs : []}
        breadcrumbLabel={t('layout.breadcrumbLabel')}
        className={`workbench-axi-shell${isPersonalOsRoute ? ' workbench-axi-shell--personal-os' : ''}`}
        contentClassName="workbench-axi-content"
        contentLayout={isPersonalOsRoute ? 'flush' : 'inset'}
        contentFullscreen={contentFullscreen}
        floatingTools={floatingTools}
        githubHref={undefined}
        globalSearchLabel={t('layout.globalSearch.label')}
        globalSearchShortcut="⌘ K"
        navGroups={shellNavGroups}
        onBack={() => window.history.back()}
        onFullscreenToggle={() => setContentFullscreen((value) => !value)}
        onGlobalSearch={openGlobalSearch}
        onHome={() => navigate('/admin/dashboard')}
        onNavSelect={(key) => {
          if (key.startsWith('/')) navigate(key);
        }}
        onReload={() => window.location.reload()}
        onSettings={() => {
          setPreferencesOpen(false);
          setSystemSettingsOpen(true);
        }}
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
        sidebarSearchPlaceholder={t('common.search.placeholder')}
        sidebarSearchValue={sidebarSearchValue}
        tabs={settings.multiTab ? desktopTabs : []}
        topbarActionOrder={['settings', 'preferences', 'theme']}
        topbarActions={{
          notice: false,
          // 没有独立即时通讯领域时，不渲染会误导到通知中心的消息入口。
          message: false,
          language: false,
          theme: {
            className: 'axi-theme-toggle',
            iconName: mode === 'dark' ? axiWorkbenchIconMap.sun : axiWorkbenchIconMap.moon,
            key: 'theme',
            label: mode === 'dark' ? t('common.theme.light') : t('common.theme.dark'),
            onClick: (event) => toggleMode(event.currentTarget),
          },
          settings: {
            iconName: axiWorkbenchIconMap.settings,
            key: 'settings',
            label: t('common.settings.title'),
            onClick: () => {
              setPreferencesOpen(false);
              setSystemSettingsOpen(true);
            },
          },
        }}
        topbarPluginActions={topbarPluginActions}
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

      {preferencesOpen ? (
        <AxiAdminSettingsPanel
          activeStylePreset={settings.stylePreset}
          open={preferencesOpen}
          stylePresetOptions={stylePresetOptions}
          themePreference={preference}
          value={settings}
          onChange={updateSetting}
          onOpenChange={setPreferencesOpen}
          onStylePresetChange={(stylePreset) => {
            updateSetting('stylePreset', stylePreset);
            setStylePreset(stylePreset);
          }}
          onThemePreferenceChange={setPreference}
          onThemeColorChange={setThemeColor}
        />
      ) : null}

      <SystemSettingsPanel
        activeStylePreset={settings.stylePreset}
        locale={locale}
        onChange={updateSetting}
        onNavigate={(path) => {
          setSystemSettingsOpen(false);
          navigate(path);
        }}
        onOpenChange={setSystemSettingsOpen}
        onStylePresetChange={(stylePreset) => {
          updateSetting('stylePreset', stylePreset);
          setStylePreset(stylePreset);
        }}
        onThemePreferenceChange={setPreference}
        onThemeColorChange={setThemeColor}
        open={systemSettingsOpen}
        settings={settings}
        stylePresetOptions={stylePresetOptions}
        themePreference={preference}
      />
    </AxiPluginProvider>
  );
};

export default MainLayout;
