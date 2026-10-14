import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { App as AntApp, ConfigProvider } from "antd";
import { AxiDashboardShell, type AxiDashboardNavGroup } from "@axi/shell";
import "@axi/shell/styles.css";
import "@axi/settings/styles.css";
import "@axi/widgets/styles.css";

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
} from "../../app-registry";
import { antdLocaleByAppLocale } from "../../i18n";
import { useRecentAccessTracker } from "../../recent-access";
import { useAppSettings } from "../../settings/useAppSettings";
import { normalizeTabKeys, readPinnedTabKeys, writePinnedTabKeys } from "../../tab-state";
import { adminUsername, readAvatarFile, type AuthUser } from "../../features/auth/auth";
import { useDashboardData } from "../../features/dashboard/useDashboardData";
import { hostedAppRoute } from "../../features/hosted/hostedApps";
import { OverviewPage } from "../../features/overview/OverviewPage";
import { useThemeState } from "../../features/theme/useThemeState";
import { ToolbarSlotContext } from "../toolbarSlot";
import { GlobalSearchBox } from "../../features/search/GlobalSearchBox";
import { SettingsPanel } from "../../features/settings/SettingsPanel";
import { makeTopbarMessageItems, makeTopbarNoticeItems } from "../../features/topbar/TopbarFeed";
import { RouteFallback } from "./RouteFallback";
import { ShellContentArea } from "./ShellContentArea";
import { ShellNotFoundPage } from "./ShellNotFoundPage";
import { ShellSidebarSearch } from "./ShellSidebarSearch";
import { makeShellTopbarActions } from "./ShellTopbar";
import { makeShellAvatarConfig, makeShellBrand, makeShellClassName } from "./shellChrome";
import { makeOverviewMetrics } from "./shellMetrics";
import { AlertsPage, AxiResourcesPage, DeployPage, HostedAppPage, ObservabilityPage, ServersPage, ServicesPage } from "./shellPages";
import { makeAntdShellThemeConfig } from "./shellTheme";
import { useShellCatalog } from "./useShellCatalog";
import { makeShellTabHandlers } from "./shellTabs";

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
  const { notification } = AntApp.useApp();
  const language = i18n.resolvedLanguage || i18n.language;
  const data = useDashboardData();
  const themeState = useThemeState();
  const settingsState = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, settings } = settingsState;
  const { axiResources, hostedApps } = useShellCatalog({ notification, t });
  const selectedKey = getRouteKey(location.pathname);
  const isHostedPage = selectedKey.startsWith("/apps/");
  const isTablePage = selectedKey === "/services" || selectedKey === "/alerts" || selectedKey.startsWith("/axi-resources");
  const hasTableToolbarSlot = selectedKey === "/services" || selectedKey === "/alerts" || selectedKey === "/servers" || selectedKey === "/deploy" || selectedKey.startsWith("/axi-resources");
  const [tableToolbarContainer, setTableToolbarContainer] = useState<HTMLDivElement | null>(null);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("host");
  const previousHostedAppIdRef = useRef<string | null>(null);
  const { recentAccess, addRecentAccess, clearRecentAccess } = useRecentAccessTracker(selectedKey);
  const [pinnedTabKeys, setPinnedTabKeys] = useState<NavRouteKey[]>(() => readPinnedTabKeys());
  const [visitedTabKeys, setVisitedTabKeys] = useState<NavRouteKey[]>(() => normalizeTabKeys([...readPinnedTabKeys(), selectedKey]));
  const [sidebarKeyword, setSidebarKeyword] = useState("");
  const currentHostedAppId = hostedRouteAppId(selectedKey);
  const currentHostedApp = useMemo(() => findHostedApp(selectedKey, hostedApps), [hostedApps, selectedKey]);
  const canUseSubappMode = Boolean(isHostedPage && currentHostedApp?.menuGroups.length);
  const visibleNavigationMode: NavigationMode = canUseSubappMode && navigationMode === "subapp" ? "subapp" : "host";
  const hostNavGroups = useMemo(() => translateNavGroups(t, hostedApps, axiResources, user.role), [axiResources, hostedApps, language, t, user.role]);
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
  const { closeOtherTabs, closeTab } = makeShellTabHandlers({
    navigate,
    pinnedTabKeySet,
    pinnedTabKeys,
    selectedKey,
    setPinnedTabKeys,
    setVisitedTabKeys,
    visitedTabKeys
  });
  const breadcrumbActions = hasTableToolbarSlot ? (
    <div className="app-breadcrumb-table-toolbar" ref={setTableToolbarContainer} />
  ) : null;
  const hostedSidebarControls = isHostedPage ? (
    <ShellSidebarSearch
      ariaLabel={t("搜索关键字")}
      clearLabel={t("清空搜索")}
      keyword={sidebarKeyword}
      placeholder={visibleNavigationMode === "subapp" ? t("搜索子应用菜单") : t("搜索关键字")}
      onChange={setSidebarKeyword}
      onClear={() => setSidebarKeyword("")}
    />
  ) : null;
  const hostedModeSwitchConfig = isHostedPage && currentHostedApp ? {
    ariaLabel: t("菜单模式"),
    className: "hosted-navigation-switch",
    currentHostedApp: {
      icon: hostedAppIcon(currentHostedApp, 14),
      title: hostedAppTitle(currentHostedApp, t)
    },
    hostLabel: t("宿主菜单"),
    mode: visibleNavigationMode,
    onChange: (mode: "host" | "subapp") => {
      setNavigationMode(mode);
      setSidebarKeyword("");
    }
  } : undefined;

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
  const metrics = useMemo(() => makeOverviewMetrics(projects), [projects]);
  const noticeItems = useMemo(() => makeTopbarNoticeItems(projects, t), [language, projects, t]);
  const messageItems = useMemo(() => makeTopbarMessageItems(projects, data.overview?.generatedAt, data.message, t), [data.message, data.overview?.generatedAt, language, projects, t]);
  const displayName = user.displayName === adminUsername ? t("管理员") : user.displayName;
  const routedPages = (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage data={data} metrics={metrics} />} />
        <Route path="/services" element={<ServicesPage data={data} />} />
        <Route path="/deploy" element={<DeployPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/axi-resources" element={<AxiResourcesPage userRole={user.role} />} />
        <Route path="/axi-resources/:resourceId" element={<AxiResourcesPage userRole={user.role} />} />
        <Route path="/apps/:appId/*" element={<HostedAppPage mode={themeState.mode} preference={themeState.preference} theme={themeState.theme} />} />
        <Route path="/logs" element={<Navigate to="/services" replace />} />
        <Route
          path="*"
          element={
            <ShellNotFoundPage
              backLabel={t("返回总览")}
              label={t("页面未实现")}
              message={t("该菜单暂未提供，请联系管理员或返回总览")}
              onBack={() => navigate('/overview')}
            />
          }
        />
      </Routes>
    </Suspense>
  );
  const antdThemeConfig = useMemo(() => makeAntdShellThemeConfig(themeState.mode, themeState.theme, settings.radius), [settings.radius, themeState.mode, themeState.theme]);

  return (
    <ConfigProvider locale={antdLocaleByAppLocale[locale]} theme={antdThemeConfig}>
      <ToolbarSlotContext.Provider value={{ tableToolbarContainer }}>
        <AxiDashboardShell
          activeNavKey={activeNavKey}
          activeTabKey={selectedKey}
          avatarConfig={makeShellAvatarConfig({
            avatarDataUrl: user.avatarDataUrl,
            displayName,
            logoutLabel: t("退出登录"),
            onChange: handleAvatarChange,
            onLogout,
            previewCloseLabel: t("关闭头像预览"),
            previewLabel: t("预览头像"),
            previewTitle: t("头像预览"),
            profileLabel: t("个人中心"),
            uploadLabel: t("更换头像")
          })}
          brand={makeShellBrand(t("Axi DevSvc Dashboard"))}
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
          className={makeShellClassName({ isHostedPage, navigationMode: visibleNavigationMode, settings })}
          contentClassName={`${isTablePage ? "app-page app-page-table services-content" : "app-page"} ${isHostedPage ? "app-page-hosted" : ""}`}
          contentFullscreen={contentFullscreen}
          globalSearch={<GlobalSearchBox axiResources={axiResources} hostedApps={hostedApps} projects={projects} recentAccessKeys={recentAccess.map((item) => item.key)} onClearRecentAccess={clearRecentAccess} onSelectSearchItem={addRecentAccess} userRole={user.role} />}
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
          hostedModeSwitch={hostedModeSwitchConfig}
          tabs={settings.multiTab ? visitedTabs.map((tab) => ({
            closable: !tab.pinned,
            key: tab.key,
            label: tab.title,
            pinned: tab.pinned
          })) : []}
          topbarActions={makeShellTopbarActions({
            locale,
            messageItems,
            navigate,
            noticeItems,
            onLanguageChange: settingsState.setLocale,
            onSettingsOpen: () => setSettingsOpen(true),
            onThemeToggle: (element) => themeState.toggleMode(element),
            showLanguage: settings.language,
            t,
            themeMode: themeState.mode
          })}
        >
          {isHostedPage ? (
            routedPages
          ) : (
            <ShellContentArea
              isTablePage={isTablePage}
              loadingLabel={t("正在加载")}
              pageTransition={settings.pageTransition}
              pathname={location.pathname}
              showProgress={Boolean(settings.progressBar && data.loading)}
              showWatermark={Boolean(settings.watermark)}
              watermarkText={t("Axi DevSvc Dashboard")}
            >
              {routedPages}
            </ShellContentArea>
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
