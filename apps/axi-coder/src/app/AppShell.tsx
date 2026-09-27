import {
  AxiDashboardShell,
  AxiSidebarSearchResults,
  type AxiDashboardAvatarAction,
  type AxiDashboardAction,
  type AxiDashboardNavGroup,
} from "@axi/shell";
import { useAxiTheme } from "@axi/core";
import { useMemo, useState, type ReactNode } from "react";
import appLogo from "../assets/axi-coder-logo.png";
import {
  appNavGroups,
  filterNavGroups,
  makeBreadcrumbItems,
  makeSearchItems,
  routeLabel,
  type AppRouteKey,
} from "./appRegistry";

const avatarStorageKey = "axi-coder.avatar.data-url";

export type AppShellProps = {
  activeRoute: AppRouteKey;
  busy: string | null;
  children: ReactNode;
  notice?: string;
  rightActions?: ReactNode;
  onNavigate: (route: AppRouteKey) => void;
  onNotice: (message: string) => void;
  onRefresh: () => void;
  onSettings: () => void;
};

export function AppShell({
  activeRoute,
  busy,
  children,
  notice,
  rightActions,
  onNavigate,
  onNotice,
  onRefresh,
  onSettings,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [sidebarKeyword, setSidebarKeyword] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState(() => window.localStorage.getItem(avatarStorageKey) || "");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(appNavGroups.map((group) => [group.key, true])),
  );
  const [visitedRoutes, setVisitedRoutes] = useState<AppRouteKey[]>(() =>
    activeRoute === "/overview" ? ["/overview"] : ["/overview", activeRoute],
  );
  const { toggleMode } = useAxiTheme();
  const filteredGroups = useMemo(() => filterNavGroups(sidebarKeyword), [sidebarKeyword]);
  const searchItems = useMemo(() => makeSearchItems(), []);
  const searchMatches = useMemo(() => {
    const keyword = sidebarKeyword.trim().toLowerCase();
    if (!keyword) {
      return searchItems.slice(0, 5);
    }
    return searchItems.filter((item) => item.keywords.includes(keyword)).slice(0, 6);
  }, [searchItems, sidebarKeyword]);
  const breadcrumbs = useMemo(() => makeBreadcrumbItems(activeRoute), [activeRoute]);
  const dashboardNavGroups = useMemo<AxiDashboardNavGroup[]>(() => (
    filteredGroups.map((group) => {
      const GroupIcon = group.icon;
      return {
        key: group.key,
        label: group.label,
        icon: <GroupIcon size={15} />,
        children: group.children.map((item) => {
          const Icon = item.icon;
          return {
            key: item.key,
            label: item.label,
            icon: <Icon size={17} />,
            title: item.label,
          };
        }),
      };
    })
  ), [filteredGroups]);
  const sidebarExpandedKeys = sidebarKeyword
    ? dashboardNavGroups.map((group) => group.key)
    : Object.entries(openGroups).filter(([, expanded]) => expanded).map(([key]) => key);

  function navigate(route: AppRouteKey) {
    setVisitedRoutes((current) => (current.includes(route) ? current : [...current, route]));
    onNavigate(route);
  }

  function closeTab(route: AppRouteKey) {
    const nextRoutes = visitedRoutes.filter((item) => item !== route);
    const normalized: AppRouteKey[] = nextRoutes.length > 0 ? nextRoutes : ["/overview"];
    setVisitedRoutes(normalized);
    if (route === activeRoute) {
      onNavigate(normalized[normalized.length - 1] ?? "/overview");
    }
  }

  function changeAvatar(file: File) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const nextValue = typeof reader.result === "string" ? reader.result : "";
      setAvatarDataUrl(nextValue);
      if (nextValue) {
        window.localStorage.setItem(avatarStorageKey, nextValue);
      }
    });
    reader.readAsDataURL(file);
  }

  function leaveConsoleSession() {
    setVisitedRoutes(["/overview"]);
    onNavigate("/overview");
  }

  const avatarMenuItems: AxiDashboardAvatarAction[] = [
    { iconName: "my", key: "profile", label: "个人中心", onClick: onSettings },
    { iconName: "exit", key: "logout", label: "退出登录", onClick: leaveConsoleSession },
  ];
  const topbarPluginActions = useMemo<AxiDashboardAction[]>(() => [
    {
      href: "https://github.com/MoseLu/axi-coder",
      iconName: "github",
      key: "github",
      label: "代码仓库",
      target: "_blank",
    },
    {
      badge: busy ? 1 : undefined,
      badgeTone: "warning",
      iconName: "notice",
      key: "notice",
      label: "通知",
      onClick: () => onNotice(busy ? "当前有 1 个运行中的任务。" : "暂无新通知。"),
    },
    {
      badge: notice ? 1 : undefined,
      badgeTone: "success",
      iconName: "msg",
      key: "message",
      label: "消息",
      onClick: () => onNotice(notice || "暂无新消息。"),
    },
    {
      iconName: "lang",
      key: "language",
      label: "语言",
      onClick: () => onNotice("当前界面语言：简体中文。"),
    },
    {
      iconName: "theme",
      key: "theme",
      label: "切换主题",
      onClick: (event) => toggleMode(event.currentTarget),
    },
    {
      iconName: "theme",
      key: "settings",
      label: "设置",
      onClick: onSettings,
    },
  ], [busy, notice, onNotice, onSettings, toggleMode]);

  return (
    <>
      <AxiDashboardShell
        activeNavKey={activeRoute}
        activeTabKey={activeRoute}
        avatarConfig={{
          avatar: <span>AX</span>,
          description: "team@cool-js.com",
          imageSrc: avatarDataUrl || undefined,
          label: "Axi Coder",
          menuItems: avatarMenuItems,
          name: "管理员",
          onChange: changeAvatar,
          previewCloseLabel: "关闭头像预览",
          previewLabel: "预览头像",
          previewTitle: "头像预览",
          uploadLabel: "更换头像",
        }}
        brand={{
          logo: <img className="brand-logo" src={appLogo} alt="" aria-hidden="true" />,
          title: "Axi Coder",
        }}
        breadcrumbLabel="页面位置"
        breadcrumbs={breadcrumbs}
        contentFullscreen={contentFullscreen}
        globalSearchLabel="搜索"
        globalSearchShortcut="⌘ K"
        labels={{
          account: "账号",
          avatarPreview: "预览头像",
          avatarPreviewClose: "关闭头像预览",
          avatarPreviewTitle: "头像预览",
          avatarUpload: "更换头像",
          back: "返回",
          contentFullscreen: "内容全屏",
          contentRestore: "退出内容全屏",
          github: "代码仓库",
          home: "首页",
          openPages: "打开页面",
          reload: "刷新",
          settings: "设置",
          sidebarCollapse: "收起侧栏",
          sidebarExpand: "展开侧栏",
          tabMenu: "标签页菜单",
          theme: "切换主题",
        }}
        onBack={() => window.history.back()}
        onFullscreenToggle={() => setContentFullscreen((current) => !current)}
        onGlobalSearch={() => setSidebarKeyword("")}
        onHome={() => navigate("/overview")}
        onNavGroupToggle={(groupKey, expanded) => setOpenGroups((current) => ({ ...current, [groupKey]: expanded }))}
        onNavSelect={(route) => navigate(route as AppRouteKey)}
        onReload={busy === "refresh" ? undefined : onRefresh}
        onSidebarSearchChange={setSidebarKeyword}
        onSidebarToggle={() => setSidebarCollapsed((current) => !current)}
        onTabClose={(route) => closeTab(route as AppRouteKey)}
        onTabMenu={onSettings}
        onTabSelect={(route) => navigate(route as AppRouteKey)}
        pageProps={{ fluid: true }}
        sidebarCollapsed={sidebarCollapsed}
        sidebarExpandedKeys={sidebarExpandedKeys}
        sidebarFooter={!sidebarCollapsed && sidebarKeyword ? (
          <AxiSidebarSearchResults>
            {searchMatches.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.key} onClick={() => navigate(item.key)} type="button">
                  <Icon size={15} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.breadcrumb}</small>
                  </span>
                </button>
              );
            })}
          </AxiSidebarSearchResults>
        ) : null}
        sidebarSearchValue={sidebarKeyword}
        sidebar={!dashboardNavGroups.length ? null : undefined}
        navGroups={dashboardNavGroups}
        tabs={visitedRoutes.map((route) => ({
          key: route,
          label: routeLabel(route),
          closable: route !== "/overview",
          pinned: route === "/overview",
        }))}
        topbarActions={{
          github: topbarPluginActions[0],
          notice: topbarPluginActions[1],
          message: topbarPluginActions[2],
          language: topbarPluginActions[3],
          theme: topbarPluginActions[4],
          settings: topbarPluginActions[5],
        }}
        topbarPlugins={rightActions}
      >
        {children}
      </AxiDashboardShell>
      {notice ? <div className="notice">{notice}</div> : null}
    </>
  );
}
