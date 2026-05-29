import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ConfigProvider, theme as AntTheme } from "antd";
import { createAxiAntdTheme } from "@axi/core";
import { AxiDashboardShell, type AxiDashboardNavGroup } from "@axi/shell";

import devsvcLogoUrl from "../assets/devsvc-logo.svg";
import {
  filterNavGroups,
  findHostedApp,
  getRouteKey,
  hostedAppIcon,
  hostedAppTitle,
  hostedRouteAppId,
  makeBreadcrumbItems,
  makeHostedNavGroups,
  makeRouteTab,
  navGroupKeys,
  translateNavGroups,
  type NavRouteKey
} from "../app-registry";
import { AxiSvgIcon } from "@axi/core";
import { antdLocaleByAppLocale, appLocaleOptions } from "../i18n";
import { useRecentAccessTracker } from "../recent-access";
import { useAppSettings } from "../settings/useAppSettings";
import { normalizeTabKeys, readPinnedTabKeys, writePinnedTabKeys } from "../tab-state";
import { antdModeTokens } from "../theme/tokens";
import { adminUsername, readAvatarFile, type AuthUser } from "../features/auth/auth";
import { AxiResourcesPage } from "../features/axi-resources/AxiResourcesPage";
import { listAxiResources, type AxiResource } from "../features/axi-resources/axiResources";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { DeployPage } from "../features/deploy/DeployPage";
import { AlertsPage } from "../features/alerts/AlertsPage";
import { HostedAppPage } from "../features/hosted/HostedAppPage";
import { hostedAppRoute, listHostedApps, type HostedApp } from "../features/hosted/hostedApps";
import { OverviewPage } from "../features/overview/OverviewPage";
import { ServicesPage } from "../features/services/ServicesPage";
import { ServersPage } from "../features/servers/ServersPage";
import { useThemeState } from "../features/theme/useThemeState";
import { AppScrollbar } from "./AppScrollbar";
import { ToolbarSlotContext } from "./toolbarSlot";
import { GlobalSearchBox } from "../features/search/GlobalSearchBox";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { makeTopbarMessageItems, makeTopbarNoticeItems, TopbarFeedPanel } from "../features/topbar/TopbarFeed";

type NavigationMode = "host" | "subapp";

function findActiveGroupKey(groups: Array<{ key: string; children: Array<{ key: string }> }>, activeKey: string) {
  return groups.find((group) => group.children.some((item) => item.key === activeKey))?.key;
}

export function Shell({
  user,
  onAvatarChange,
  onLogout
}: {
  user: AuthUser;
  onAvatarChange: (avatarDataUrl: string) => void;
  onLogout: () => void;
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const data = useDashboardData();
  const themeState = useThemeState();
  const settingsState = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, settings } = settingsState;
  const selectedKey = getRouteKey(location.pathname);
  const isHostedPage = selectedKey.startsWith("/apps/");
  const isTablePage = selectedKey === "/services" || selectedKey === "/alerts" || selectedKey.startsWith("/axi-resources");
  const hasTableToolbarSlot = selectedKey === "/services" || selectedKey === "/alerts" || selectedKey === "/servers" || selectedKey === "/deploy" || selectedKey.startsWith("/axi-resources");
  const [toolbarContent, setToolbarContent] = useState<ReactNode>(null);
  const [tableToolbarContainer, setTableToolbarContainer] = useState<HTMLDivElement | null>(null);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hostedApps, setHostedApps] = useState<HostedApp[]>([]);
  const [axiResources, setAxiResources] = useState<AxiResource[]>([]);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("host");
  const previousHostedAppIdRef = useRef<string | null>(null);
  const toolbarSlot = useMemo(() => ({ setToolbarContent, tableToolbarContainer }), [tableToolbarContainer]);
  const { recentAccess, addRecentAccess, clearRecentAccess } = useRecentAccessTracker(selectedKey);
  const [pinnedTabKeys, setPinnedTabKeys] = useState<NavRouteKey[]>(() => readPinnedTabKeys());
  const [visitedTabKeys, setVisitedTabKeys] = useState<NavRouteKey[]>(() => normalizeTabKeys([...readPinnedTabKeys(), selectedKey]));
  const [sidebarKeyword, setSidebarKeyword] = useState("");
  const currentHostedAppId = hostedRouteAppId(selectedKey);
  const currentHostedApp = useMemo(() => findHostedApp(selectedKey, hostedApps), [hostedApps, selectedKey]);
  const canUseSubappMode = Boolean(isHostedPage && currentHostedApp?.menuGroups.length);
  const visibleNavigationMode: NavigationMode = canUseSubappMode && navigationMode === "subapp" ? "subapp" : "host";
  const hostNavGroups = useMemo(() => translateNavGroups(t, hostedApps, axiResources), [axiResources, hostedApps, language, t]);
  const subappNavGroups = useMemo(() => makeHostedNavGroups(currentHostedApp, t), [currentHostedApp, language, t]);
  const activeNavGroups = visibleNavigationMode === "subapp" ? subappNavGroups : hostNavGroups;
  const activeNavKey = visibleNavigationMode === "host" && currentHostedApp ? hostedAppRoute(currentHostedApp) as NavRouteKey : selectedKey;
  const selectedGroupKey = findActiveGroupKey(activeNavGroups, activeNavKey) || navGroupKeys[selectedKey] || activeNavGroups[0]?.key || "workspace-ops";
  const [openKeys, setOpenKeys] = useState<string[]>([selectedGroupKey]);
  const filteredNavGroups = useMemo(() => filterNavGroups(activeNavGroups, sidebarKeyword), [activeNavGroups, sidebarKeyword]);
  const breadcrumbs = useMemo(() => makeBreadcrumbItems(selectedKey, t, hostedApps, axiResources), [axiResources, hostedApps, language, selectedKey, t]);
  const dashboardNavGroups = useMemo<AxiDashboardNavGroup[]>(() => (
    filteredNavGroups.map((group) => ({
      key: group.key,
      label: group.label,
      icon: group.icon,
      children: group.children.map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        title: item.label
      }))
    }))
  ), [filteredNavGroups]);
  const sidebarExpandedKeys = sidebarKeyword.trim() ? dashboardNavGroups.map((group) => group.key) : openKeys;
  const pinnedTabKeySet = useMemo(() => new Set(pinnedTabKeys), [pinnedTabKeys]);
  useEffect(() => {
    let cancelled = false;
    void listHostedApps()
      .then((apps) => {
        if (!cancelled) setHostedApps(apps);
      })
      .catch(() => {
        if (!cancelled) setHostedApps([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void listAxiResources()
      .then((resources) => {
        if (!cancelled) setAxiResources(resources);
      })
      .catch(() => {
        if (!cancelled) setAxiResources([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (isHostedPage) setSidebarCollapsed(false);
  }, [isHostedPage]);
  useEffect(() => {
    const previousAppId = previousHostedAppIdRef.current;
    if (!currentHostedAppId) {
      previousHostedAppIdRef.current = null;
      setNavigationMode("host");
      return;
    }
    if (previousAppId !== currentHostedAppId) {
      previousHostedAppIdRef.current = currentHostedAppId;
      setNavigationMode("subapp");
    }
  }, [currentHostedAppId]);
  useEffect(() => {
    writePinnedTabKeys(pinnedTabKeys);
  }, [pinnedTabKeys]);
  useEffect(() => {
    if (sidebarKeyword.trim()) return;
    setOpenKeys((keys) => (keys.includes(selectedGroupKey) ? keys : [...keys, selectedGroupKey]));
  }, [selectedGroupKey, sidebarKeyword]);
  useEffect(() => {
    if (!sidebarKeyword.trim()) return;
    setOpenKeys(filteredNavGroups.map((group) => group.key));
  }, [filteredNavGroups, sidebarKeyword]);
  useEffect(() => {
    setVisitedTabKeys((keys) => normalizeTabKeys(keys.includes(selectedKey) ? keys : [...keys, selectedKey]));
  }, [selectedKey]);
  const visitedTabs = useMemo(() => visitedTabKeys.map((key) => ({ ...makeRouteTab(key, t, hostedApps, axiResources), pinned: pinnedTabKeySet.has(key) })), [axiResources, hostedApps, language, pinnedTabKeySet, t, visitedTabKeys]);
  const breadcrumbActions = toolbarContent || hasTableToolbarSlot ? (
    <div className="app-breadcrumb-actions-group">
      {toolbarContent}
      <div className="app-breadcrumb-table-toolbar" ref={setTableToolbarContainer} />
    </div>
  ) : null;
  const hostedSidebarControls = isHostedPage ? (
    <div className="hosted-sidebar-controls">
      <div className={`hosted-navigation-switch ${visibleNavigationMode === "subapp" ? "is-subapp-mode" : ""}`} role="tablist" aria-label={t("菜单模式")}>
        <button
          aria-selected={visibleNavigationMode === "host"}
          className={visibleNavigationMode === "host" ? "is-active" : ""}
          title={t("宿主菜单")}
          role="tab"
          type="button"
          onClick={() => {
            setNavigationMode("host");
            setSidebarKeyword("");
          }}
        >
          <AxiSvgIcon name="home" size={14} />
          {visibleNavigationMode === "subapp" ? null : <span>{t("宿主菜单")}</span>}
        </button>
        <button
          aria-selected={visibleNavigationMode === "subapp"}
          className={visibleNavigationMode === "subapp" ? "is-active" : ""}
          disabled={!canUseSubappMode}
          role="tab"
          type="button"
          onClick={() => {
            setNavigationMode("subapp");
            setSidebarKeyword("");
          }}
        >
          {hostedAppIcon(currentHostedApp, 14)}
          <span>{currentHostedApp ? hostedAppTitle(currentHostedApp, t) : currentHostedAppId || t("子应用")}</span>
        </button>
      </div>
      <label className="hosted-sidebar-search">
        <AxiSvgIcon name="search" size={15} />
        <input
          aria-label={t("搜索关键字")}
          placeholder={visibleNavigationMode === "subapp" ? t("搜索子应用菜单") : t("搜索关键字")}
          value={sidebarKeyword}
          onChange={(event) => setSidebarKeyword(event.target.value)}
        />
        {sidebarKeyword ? (
          <button type="button" aria-label={t("清空搜索")} onClick={() => setSidebarKeyword("")}>
            <AxiSvgIcon name="close" size={13} />
          </button>
        ) : null}
      </label>
    </div>
  ) : null;

  function closeLeftTabs() {
    const activeIndex = visitedTabKeys.indexOf(selectedKey);
    if (activeIndex <= 0) return;
    setVisitedTabKeys((keys) => keys.filter((key, index) => index >= activeIndex || pinnedTabKeySet.has(key)));
  }

  function closeOtherTabs() {
    setVisitedTabKeys((keys) => normalizeTabKeys(keys.filter((key) => key === selectedKey || pinnedTabKeySet.has(key))));
  }

  function closeRightTabs() {
    const activeIndex = visitedTabKeys.indexOf(selectedKey);
    if (activeIndex < 0 || activeIndex >= visitedTabKeys.length - 1) return;
    setVisitedTabKeys((keys) => keys.filter((key, index) => index <= activeIndex || pinnedTabKeySet.has(key)));
  }

  function closeTab(key: NavRouteKey) {
    if (pinnedTabKeySet.has(key)) return;
    const nextKeys = visitedTabKeys.filter((item) => item !== key);
    const normalizedKeys: NavRouteKey[] = nextKeys.length ? nextKeys : ["/overview"];
    setVisitedTabKeys(normalizedKeys);

    if (key === selectedKey) {
      const closedIndex = visitedTabKeys.indexOf(key);
      navigate(normalizedKeys[Math.min(closedIndex, normalizedKeys.length - 1)] || "/overview");
    }
  }

  function closeAllTabs() {
    const nextKeys: NavRouteKey[] = pinnedTabKeys.length ? pinnedTabKeys : normalizeTabKeys(["/overview"]);
    setVisitedTabKeys(nextKeys);
    if (!nextKeys.includes(selectedKey)) {
      navigate(nextKeys[0] || "/overview", { replace: true });
    }
  }

  function togglePinTab(key: NavRouteKey) {
    setPinnedTabKeys((keys) => keys.includes(key) ? keys.filter((item) => item !== key) : normalizeTabKeys([...keys, key]));
    setVisitedTabKeys((keys) => normalizeTabKeys(keys.includes(key) ? keys : [...keys, key]));
  }

  function toggleContentFullscreen() {
    setContentFullscreen((current) => !current);
  }

  async function handleAvatarChange(file: File) {
    try {
      onAvatarChange(await readAvatarFile(file));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t("头像读取失败"));
    }
  }

  const projects = useMemo(() => data.overview?.projects || [], [data.overview]);
  const metrics = useMemo(() => {
    return {
      total: projects.length,
      healthy: projects.filter((project) => project.pm2.status === "online" && project.health.ok).length,
      online: projects.filter((project) => project.pm2.status === "online").length,
      idle: projects.filter((project) => project.pm2.status === "missing").length
    };
  }, [projects]);
  const noticeItems = useMemo(() => makeTopbarNoticeItems(projects, t), [language, projects, t]);
  const messageItems = useMemo(() => makeTopbarMessageItems(projects, data.overview?.generatedAt, data.message, t), [data.message, data.overview?.generatedAt, language, projects, t]);
  const displayName = user.displayName === adminUsername ? t("管理员") : user.displayName;
  const routedPages = (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<OverviewPage data={data} metrics={metrics} />} />
      <Route path="/services" element={<ServicesPage data={data} />} />
      <Route path="/deploy" element={<DeployPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/servers" element={<ServersPage />} />
      <Route path="/axi-resources" element={<AxiResourcesPage />} />
      <Route path="/axi-resources/:resourceId" element={<AxiResourcesPage />} />
      <Route path="/apps/:appId/*" element={<HostedAppPage mode={themeState.mode} preference={themeState.preference} theme={themeState.theme} />} />
      <Route path="/logs" element={<Navigate to="/services" replace />} />
    </Routes>
  );
  const antdThemeConfig = useMemo(() => {
    const modeTokens = antdModeTokens[themeState.mode];

    return {
      algorithm: themeState.mode === "dark" ? AntTheme.darkAlgorithm : AntTheme.defaultAlgorithm,
      ...createAxiAntdTheme(themeState.mode, themeState.theme, {
        borderRadius: Math.round(settings.radius * 16),
        token: modeTokens
      })
    };
  }, [settings.radius, themeState.mode, themeState.theme.color]);

  return (
    <ConfigProvider locale={antdLocaleByAppLocale[locale]} theme={antdThemeConfig}>
      <ToolbarSlotContext.Provider value={toolbarSlot}>
        <AxiDashboardShell
          activeNavKey={activeNavKey}
          activeTabKey={selectedKey}
          avatarConfig={{
            avatar: <span>{displayName.slice(0, 1).toUpperCase()}</span>,
            description: "team@cool-js.com",
            imageSrc: user.avatarDataUrl,
            label: displayName,
            menuItems: [
              { iconName: "my", key: "profile", label: t("个人中心") },
              { iconName: "exit", key: "logout", label: t("退出登录"), onClick: onLogout }
            ],
            name: displayName,
            onChange: handleAvatarChange,
            previewCloseLabel: t("关闭头像预览"),
            previewLabel: t("预览头像"),
            previewTitle: t("头像预览"),
            uploadLabel: t("更换头像")
          }}
          brand={{
            logo: <img className="brand-logo" src={devsvcLogoUrl} alt="" />,
            title: t("Axi DevSvc Dashboard")
          }}
          breadcrumbActions={settings.breadcrumb ? breadcrumbActions : null}
          breadcrumbLabel={t("页面位置")}
          breadcrumbs={settings.breadcrumb ? breadcrumbs.map((item) => ({
            className: item.className,
            current: item.current,
            icon: item.icon,
            key: item.key,
            label: item.title,
            scope: item.scope
          })) : []}
          className={[
            "app-shell",
            `layout-${settings.menuLayout}`,
            `menu-style-${settings.menuStyle}`,
            `box-style-${settings.boxStyle}`,
            `container-${settings.containerWidth}`,
            isHostedPage ? `navigation-${visibleNavigationMode}` : "",
            settings.colorWeak ? "color-weak" : ""
          ].filter(Boolean).join(" ")}
          contentClassName={`${isTablePage ? "app-page app-page-table services-content" : "app-page"} ${isHostedPage ? "app-page-hosted" : ""}`}
          contentFullscreen={contentFullscreen}
          globalSearch={<GlobalSearchBox axiResources={axiResources} hostedApps={hostedApps} projects={projects} recentAccessKeys={recentAccess.map((item) => item.key)} onClearRecentAccess={clearRecentAccess} onSelectSearchItem={addRecentAccess} />}
          navGroups={dashboardNavGroups}
          onBack={() => navigate(-1)}
          onFullscreenToggle={toggleContentFullscreen}
          onHome={() => {
            setNavigationMode("host");
            navigate("/overview");
          }}
          onNavGroupToggle={(key, expanded) => setOpenKeys((keys) => {
            if (settings.accordion) return expanded ? [key] : [];
            return expanded ? [...new Set([...keys, key])] : keys.filter((item) => item !== key);
          })}
          onNavSelect={(key) => {
            if (!key.startsWith("/")) return;
            if (key.startsWith("/apps/")) {
              setNavigationMode("subapp");
            }
            navigate(key as NavRouteKey);
          }}
          onReload={() => window.location.reload()}
          onSidebarSearchChange={setSidebarKeyword}
          onSidebarToggle={() => setSidebarCollapsed((current) => !current)}
          onTabClose={(key) => closeTab(key as NavRouteKey)}
          onTabMenu={closeOtherTabs}
          onTabSelect={(key) => navigate(key as NavRouteKey)}
          pageProps={{ fluid: true, padded: isTablePage }}
          sidebarCollapsed={sidebarCollapsed}
          sidebarExpandedKeys={sidebarExpandedKeys}
          sidebarSearch={hostedSidebarControls}
          sidebarSearchPlaceholder={t("搜索关键字")}
          sidebarSearchValue={sidebarKeyword}
          tabs={settings.multiTab ? visitedTabs.map((tab) => ({
            closable: !tab.pinned,
            key: tab.key,
            label: tab.title,
            pinned: tab.pinned
          })) : []}
          topbarActions={{
            github: { href: "https://github.com/MoseLu/devsvc-dashboard", iconName: "github", key: "github", label: t("打开 GitHub 仓库"), target: "_blank" },
            notice: {
              badge: noticeItems.filter((item) => !item.read).length || undefined,
              badgeTone: "warning",
              iconName: "notice",
              key: "notice",
              label: t("通知"),
              popover: <TopbarFeedPanel emptyText={t("暂无通知")} iconName="notice" items={noticeItems} title={t("通知")} onItemClick={(item) => item.path ? navigate(item.path) : undefined} />
            },
            message: {
              badge: messageItems.filter((item) => !item.read).length || undefined,
              badgeTone: "success",
              iconName: "msg",
              key: "message",
              label: t("消息"),
              popover: <TopbarFeedPanel emptyText={t("暂无消息")} iconName="msg" items={messageItems} title={t("消息")} onItemClick={(item) => item.path ? navigate(item.path) : undefined} />
            },
            language: settings.language ? {
              iconName: "lang",
              key: "language",
              label: t("切换语言"),
              popover: (
                <div className="language-menu">
                  {appLocaleOptions.map((item) => (
                    <button className={item.value === locale ? "is-active" : ""} key={item.value} type="button" onClick={() => settingsState.setLocale(item.value)}>
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>
              )
            } : false,
            theme: { iconName: themeState.mode === "dark" ? "light" : "dark", key: "theme", label: themeState.mode === "dark" ? t("切换亮色模式") : t("切换暗色模式"), onClick: (event) => themeState.toggleMode(event.currentTarget) },
            settings: { iconName: "theme", key: "settings", label: t("系统设置"), onClick: () => setSettingsOpen(true) }
          }}
        >
          {isHostedPage ? (
            routedPages
          ) : (
            <section className={`app-view-container ${isTablePage ? "app-view-container-services" : ""}`}>
              {settings.progressBar && data.loading ? <div className="top-progress" role="progressbar" aria-label={t("正在加载")} /> : null}
              {settings.watermark ? <div className="global-watermark" data-watermark={t("Axi DevSvc Dashboard")} aria-hidden="true">{t("Axi DevSvc Dashboard")}</div> : null}
              <AppScrollbar className={isTablePage ? "services-scrollbar" : ""}>
                <div className={`page-transition page-transition-${settings.pageTransition}`} key={location.pathname}>
                  {routedPages}
                </div>
              </AppScrollbar>
            </section>
          )}
        </AxiDashboardShell>
        <SettingsPanel
          open={settingsOpen}
          preference={themeState.preference}
          renderTrigger={false}
          settings={settings}
          theme={themeState.theme}
          onModeChange={themeState.changeMode}
          onOpenChange={setSettingsOpen}
          onSettingsChange={settingsState.updateSetting}
          onThemeChange={themeState.changeThemeName}
        />
      </ToolbarSlotContext.Provider>
    </ConfigProvider>
  );
}
