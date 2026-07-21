import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Fullscreen, Home, Pin, PinOff, RefreshCw, Shrink, X } from "lucide-react";

import type { NavRouteKey, RouteTab } from "../app-registry";
import { AxiPopoverMenu } from "@axi/crud";
import { AxiSvgIcon } from "@axi/core";
import { AxiTabMenu, type AxiTabMenuActionKey } from "@axi/shell";
import type { AppSettings } from "../settings/useAppSettings";

export function AppToolbar({
  children,
  contentFullscreen,
  settings,
  tabs,
  activeKey,
  onContentFullscreenToggle,
  onCloseLeft,
  onCloseOthers,
  onCloseRight,
  onCloseTab,
  onCloseAll,
  onTogglePin
}: {
  children?: ReactNode;
  contentFullscreen: boolean;
  settings: AppSettings;
  tabs: RouteTab[];
  activeKey: NavRouteKey;
  onContentFullscreenToggle: () => void;
  onCloseLeft: () => void;
  onCloseOthers: () => void;
  onCloseRight: () => void;
  onCloseTab: (key: NavRouteKey) => void;
  onCloseAll: () => void;
  onTogglePin: (key: NavRouteKey) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTabIndex = tabs.findIndex((tab) => tab.key === activeKey);
  const activeTab = tabs[activeTabIndex];
  const showRouteTabs = settings.multiTab;

  const disabledActions: AxiTabMenuActionKey[] = [];
  if (activeTabIndex <= 0) disabledActions.push("close-left");
  if (activeTabIndex < 0 || activeTabIndex >= tabs.length - 1) disabledActions.push("close-right");
  if (tabs.length <= 1) disabledActions.push("close-others", "close-all");

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleAction(action: AxiTabMenuActionKey | string) {
    switch (action) {
      case "reload":
        closeMenu();
        window.location.reload();
        return;
      case "toggle-pin":
        onTogglePin(activeKey);
        closeMenu();
        return;
      case "close-left":
        onCloseLeft();
        closeMenu();
        return;
      case "close-right":
        onCloseRight();
        closeMenu();
        return;
      case "close-others":
        onCloseOthers();
        closeMenu();
        return;
      case "close-all":
        onCloseAll();
        closeMenu();
        return;
      default:
        return;
    }
  }

  const menuContent = (
    <AxiTabMenu
      activeKey={activeKey}
      customActions={() => (
        <button
          className="tabbar-menu-action tabbar-menu-action--legacy"
          type="button"
          onClick={() => {
            onCloseTab(activeKey);
            closeMenu();
          }}
        >
          <X size={16} />
          <span>{t("关闭当前")}</span>
        </button>
      )}
      disabledActions={disabledActions}
      items={tabs.map((tab) => ({
        key: tab.key,
        label: tab.title,
        pinned: tab.pinned,
        closable: !tab.pinned
      }))}
      labels={{
        reload: t("刷新"),
        "toggle-pin": activeTab?.pinned ? t("取消固定") : t("固定"),
        "close-left": t("关闭左侧"),
        "close-right": t("关闭右侧"),
        "close-others": t("关闭其他"),
        "close-all": t("关闭全部")
      }}
      onAction={handleAction}
    />
  );

  return (
    <div className={`app-toolbar tab-style-${settings.tabStyle} ${children ? "" : "app-toolbar-empty"}`}>
      <div className="toolbar-leading">
        {settings.quickEntry || settings.reloadButton ? (
          <div className="toolbar-nav">
            {settings.quickEntry ? (
              <button className="toolbar-icon-button" type="button" aria-label={t("返回")} onClick={() => navigate(-1)}>
                <ChevronLeft size={17} />
              </button>
            ) : null}
            {settings.reloadButton ? (
              <button className="toolbar-icon-button" type="button" aria-label={t("刷新")} onClick={() => window.location.reload()}>
                <RefreshCw size={16} />
              </button>
            ) : null}
            {settings.quickEntry ? (
              <button className="toolbar-icon-button" type="button" aria-label={t("首页")} onClick={() => navigate("/overview")}>
                <Home size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
        {showRouteTabs ? (
          <nav className="route-tabs" aria-label={t("已打开页面")}>
            {tabs.map((tab) => (
              <button
                className={`route-tab ${tab.key === activeKey ? "is-active" : ""} ${tab.pinned ? "is-pinned" : ""}`}
                key={tab.key}
                type="button"
                aria-current={tab.key === activeKey ? "page" : undefined}
                onClick={() => navigate(tab.key)}
              >
                {tab.pinned ? (
                  <span className="route-tab-pin" title={t("已固定")}>
                    <Pin size={12} />
                  </span>
                ) : null}
                <span className="route-tab-title">{tab.title}</span>
                {!tab.pinned ? (
                  <span
                    className="route-tab-close"
                    aria-hidden="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseTab(tab.key);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <X size={13} />
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      <div className="toolbar-right">
        {children ? <div className="toolbar-slot">{children}</div> : null}
        <div className="toolbar-actions">
          <button
            className="toolbar-icon-button"
            type="button"
            aria-label={contentFullscreen ? t("退出内容全屏") : t("内容区域全屏")}
            title={contentFullscreen ? t("退出内容全屏") : t("内容区域全屏")}
            onClick={onContentFullscreenToggle}
          >
            {contentFullscreen ? <Shrink size={16} /> : <Fullscreen size={16} />}
          </button>
          <AxiPopoverMenu
            content={menuContent}
            open={menuOpen}
            rootClassName="tabbar-menu-root"
            onOpenChange={setMenuOpen}
          >
            <button className="toolbar-icon-button" type="button" aria-label={t("标签页菜单")} title={t("标签页菜单")}>
              <AxiSvgIcon name="tabbar-menu" size={16} />
            </button>
          </AxiPopoverMenu>
        </div>
      </div>
    </div>
  );
}
