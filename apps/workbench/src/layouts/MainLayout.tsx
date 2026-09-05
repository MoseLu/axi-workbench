import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Modal } from 'antd';
import { AxiLogoMark, AxiSvgIcon, useAxiTheme } from '@axi/core';
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
import type { TabItem } from '../lib/tabs';
import GlobalSearchDialog, { type GlobalSearchItem } from '../components/Layout/GlobalSearchDialog';
import { useI18n } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { resolveBreadcrumbs } from '../lib/breadcrumbs';
import { SEARCH_CORPUS, SEARCH_SECTIONS } from '../lib/search-data';
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
import { emitShellUnread } from '../lib/shell';
import {
  workbenchDesktopNavGroupsWithKeys,
  workbenchMenuRouteMap,
} from '../lib/navigationRegistry';
import { loadProfile, resolveAvatarSrc, type UserProfile } from '../pages/admin/me/profileStore';
import './MainLayout.css';

const ROUTE_PREFIX_LABEL_KEYS: Array<{ prefix: string; labelKey: string }> = [
  { prefix: '/admin/project/', labelKey: 'nav.projectDetail' },
  { prefix: '/admin/handoff/', labelKey: 'nav.handoff' },
];

function resolveMenuRoute(path: string): { labelKey: string } | undefined {
  const prefixEntry = ROUTE_PREFIX_LABEL_KEYS.find((entry) => path.startsWith(entry.prefix));
  if (prefixEntry) return { labelKey: prefixEntry.labelKey };
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
  const { preference, setPreference, setStylePreset } = useAxiTheme();
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
    if (!routeInfo) {
      setActiveTab(path);
      return;
    }
    setTabs((prev) => {
      const result = openTab(prev, {
        key: path,
        label: t(routeInfo.labelKey),
        path,
      });
      return result.tabs;
    });
    setActiveTab(path);
  }, [location.pathname, t]);

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

  const visibleDesktopNavGroups = useMemo<AxiDashboardNavGroup[]>(() => {
    const keyword = sidebarSearchValue.trim().toLowerCase();
    const localized = workbenchDesktopNavGroupsWithKeys.map((group) => ({
      ...group,
      label: t(group.labelKey),
      children: group.children.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    }));
    const filtered = keyword
      ? localized
          .map((group) => ({
            ...group,
            children: group.children.filter((item) => String(item.label).toLowerCase().includes(keyword)),
          }))
          .filter((group) => group.children.length > 0)
      : localized;
    return filtered as unknown as AxiDashboardNavGroup[];
  }, [sidebarSearchValue, t]);

  const shellNavGroups = useMemo(
    () => isPersonalOsRoute
      ? visibleDesktopNavGroups.filter((group) => group.key === 'personal-os')
      : visibleDesktopNavGroups,
    [isPersonalOsRoute, visibleDesktopNavGroups],
  );

  const desktopBreadcrumbs = useMemo(
    () => resolveBreadcrumbs(location.pathname).map((item, index) => ({
      key: `${item.label}-${index}`,
      label: item.labelKey ? t(item.labelKey) : item.label,
      icon: item.icon,
      current: item.isActive,
      href: item.isActive ? undefined : item.path,
      onClick: item.path && !item.isActive ? () => navigate(item.path!) : undefined,
    })),
    [location.pathname, navigate, t],
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
      label={t('layout.floatingTools.label')}
      triggerLabel={t('layout.floatingTools.open')}
      closeLabel={t('layout.floatingTools.close')}
      brandIcon={<AxiLogoMark size={14} />}
      triggerIcon={<AxiSvgIcon name={axiWorkbenchIconMap.menu} size={16} />}
      openTriggerIcon={<AxiSvgIcon name={axiWorkbenchIconMap.close} size={16} />}
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

  const pluginListItems = useMemo(() => shellPlugins.map((plugin) => {
    const iconName = plugin.id === 'shell-github'
      ? axiWorkbenchIconMap.github
      : plugin.id === 'shell-locale'
        ? axiWorkbenchIconMap.language
        : plugin.id === 'shell-notification'
          ? axiWorkbenchIconMap.notification
          : axiWorkbenchIconMap.plugins;
    const label = plugin.id === 'shell-locale'
      ? t('layout.topbar.language')
      : plugin.id === 'shell-notification'
        ? t('layout.topbar.notifications')
        : plugin.label || plugin.id;
    return { id: plugin.id, iconName, label };
  }), [shellPlugins, t]);

  const pluginListPopover = useMemo(() => (
    <div className="workbench-plugin-list">
      <div className="workbench-plugin-list__header">
        <div>
          <strong>{locale === 'zh-CN' ? '插件列表' : 'Plugins'}</strong>
          <span>{locale === 'zh-CN' ? '当前 Web 工作台已启用的扩展' : 'Extensions enabled in this Web workbench'}</span>
        </div>
        <AxiSvgIcon name={axiWorkbenchIconMap.plugins} size={18} />
      </div>
      <div className="workbench-plugin-list__items">
        {pluginListItems.map((plugin) => (
          <button
            className="workbench-plugin-list__item"
            data-axi-popover-close
            key={plugin.id}
            type="button"
          >
            <AxiSvgIcon name={plugin.iconName} size={16} />
            <span>{plugin.label}</span>
            <em>{locale === 'zh-CN' ? '已启用' : 'Enabled'}</em>
          </button>
        ))}
      </div>
    </div>
  ), [locale, pluginListItems]);

  const topbarPluginActions = useMemo<AxiDashboardTopbarPluginAction[]>(() => [
    {
      key: 'plugin-list',
      iconName: axiWorkbenchIconMap.plugins,
      label: locale === 'zh-CN' ? '插件列表' : 'Plugins',
      popover: pluginListPopover,
      popoverClassName: 'workbench-plugin-list-popover',
    },
    {
      key: 'preferences',
      iconName: axiWorkbenchIconMap.preferences,
      label: t('layout.topbar.preferences'),
      onClick: () => {
        setSystemSettingsOpen(false);
        setPreferencesOpen(true);
      },
    },
  ], [locale, pluginListPopover, t]);

  const systemSettingItems = useMemo(() => [
    {
      key: 'profile',
      iconName: axiWorkbenchIconMap.account,
      label: t('nav.crumb.profile'),
      description: locale === 'zh-CN' ? '管理个人资料与账号信息' : 'Manage profile and account details',
      path: '/admin/me',
    },
    {
      key: 'devices',
      iconName: axiWorkbenchIconMap.mobile,
      label: t('nav.crumb.devices'),
      description: locale === 'zh-CN' ? '查看已配对设备与跨端会话' : 'Review paired devices and sessions',
      path: '/admin/me/devices',
    },
    {
      key: 'notifications',
      iconName: axiWorkbenchIconMap.notification,
      label: t('nav.crumb.notifications'),
      description: locale === 'zh-CN' ? '查看工作台提醒与系统通知' : 'Review workbench and system alerts',
      path: '/admin/me/notifications',
    },
  ], [locale, t]);

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
        topbarActions={{
          notice: false,
          // 没有独立即时通讯领域时，不渲染会误导到通知中心的消息入口。
          message: false,
          language: false,
          theme: false,
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
        />
      ) : null}

      <Modal
        centered
        className="workbench-system-settings-modal"
        destroyOnClose
        footer={null}
        onCancel={() => setSystemSettingsOpen(false)}
        open={systemSettingsOpen}
        title={(
          <span className="workbench-system-settings-title">
            <AxiSvgIcon name={axiWorkbenchIconMap.settings} size={18} />
            <span>{t('common.settings.title')}</span>
          </span>
        )}
        width={520}
      >
        <div className="workbench-system-settings">
          <p className="workbench-system-settings__hint">
            {locale === 'zh-CN'
              ? '系统级入口集中在此弹窗，不占用侧边菜单。界面偏好请使用画板图标。'
              : 'System-level shortcuts live in this popup, outside the sidebar. Use the palette icon for interface preferences.'}
          </p>
          <div className="workbench-system-settings__items">
            {systemSettingItems.map((item) => (
              <button
                className="workbench-system-settings__item"
                key={item.key}
                onClick={() => {
                  setSystemSettingsOpen(false);
                  navigate(item.path);
                }}
                type="button"
              >
                <span className="workbench-system-settings__item-icon">
                  <AxiSvgIcon name={item.iconName} size={17} />
                </span>
                <span className="workbench-system-settings__item-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <AxiSvgIcon name={axiWorkbenchIconMap.forward} size={15} />
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </AxiPluginProvider>
  );
};

export default MainLayout;
