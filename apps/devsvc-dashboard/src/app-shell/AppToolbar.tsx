import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CircleX, Fullscreen, Home, Pin, PinOff, RefreshCw, Shrink, X } from "lucide-react";

import type { NavRouteKey, RouteTab } from "../app-registry";
import { AxiPopoverMenu } from "@axi/crud";
import { AxiSvgIcon } from "@axi/core";
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
  const canCloseLeft = activeTabIndex > 0;
  const canCloseRight = activeTabIndex >= 0 && activeTabIndex < tabs.length - 1;
  const showRouteTabs = settings.multiTab;

  function closeMenu() {
    setMenuOpen(false);
  }

  const menuContent = (
    <div className="tabbar-menu-popover">
      <div className="tabbar-menu-section">
        <button className="tabbar-menu-action" type="button" onClick={() => {
          closeMenu();
          window.location.reload();
        }}>
          <RefreshCw size={16} />
	          <span>{t("刷新")}</span>
        </button>
        <button className="tabbar-menu-action" type="button" onClick={() => {
          onTogglePin(activeKey);
          closeMenu();
        }}>
          {activeTab?.pinned ? <PinOff size={16} /> : <Pin size={16} />}
	          <span>{activeTab?.pinned ? t("取消固定") : t("固定")}</span>
        </button>
        <div className="tabbar-menu-divider" role="separator" />
        <button className="tabbar-menu-action" type="button" disabled={!canCloseLeft} onClick={() => {
          onCloseLeft();
          closeMenu();
        }}>
          <ChevronLeft size={16} />
	          <span>{t("关闭左侧")}</span>
        </button>
        <button className="tabbar-menu-action" type="button" disabled={!canCloseRight} onClick={() => {
          onCloseRight();
          closeMenu();
        }}>
          <ChevronRight size={16} />
	          <span>{t("关闭右侧")}</span>
        </button>
        <button className="tabbar-menu-action" type="button" disabled={tabs.length <= 1} onClick={() => {
          onCloseOthers();
          closeMenu();
        }}>
          <X size={16} />
	          <span>{t("关闭其他")}</span>
        </button>
        <button className="tabbar-menu-action" type="button" disabled={tabs.length <= 1} onClick={() => {
          onCloseAll();
          closeMenu();
        }}>
          <CircleX size={16} />
	          <span>{t("关闭全部")}</span>
        </button>
      </div>
    </div>
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
