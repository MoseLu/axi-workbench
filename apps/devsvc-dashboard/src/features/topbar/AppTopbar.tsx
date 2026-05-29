import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout as AntLayout, Popover } from "antd";
import { Github, Languages } from "lucide-react";

import type { NavRouteKey } from "../../app-registry";
import { appLocaleOptions, type AppLocale } from "../../i18n";
import type { AppSettings } from "../../settings/useAppSettings";
import type { ThemeMode, ThemeName, ThemePreference, ThemePreset } from "../../theme/tokens";
import { AxiSvgIcon } from "@axi/core";
import { type AuthUser } from "../auth/auth";
import { UserMenu } from "../auth/UserMenu";
import { GlobalSearchBox } from "../search/GlobalSearchBox";
import { SettingsPanel, ThemeModeTrigger } from "../settings/SettingsPanel";
import { makeTopbarMessageItems, makeTopbarNoticeItems, TopbarFeedPanel, TopbarFeedTrigger } from "./TopbarFeed";

const { Header: AntHeader } = AntLayout;

export function AppTopbar({
  generatedAt,
  locale,
  preference,
  projects,
  recentAccessKeys,
  settings,
  statusMessage,
  theme,
  mode,
  user,
  sidebarCollapsed,
  onLocaleChange,
  onModeChange,
  onClearRecentAccess,
  onSettingsChange,
  onSidebarToggle,
  onSelectSearchItem,
  onThemeChange,
  onModeToggle,
  onAvatarChange,
  onLogout
}: {
  generatedAt?: string;
  locale: AppLocale;
  preference: ThemePreference;
  projects: any[];
  recentAccessKeys: NavRouteKey[];
  settings: AppSettings;
  statusMessage: string;
  theme: ThemePreset;
  mode: ThemeMode;
  user: AuthUser;
  sidebarCollapsed: boolean;
  onLocaleChange: (locale: AppLocale) => void;
  onModeChange: (mode: ThemePreference, trigger?: HTMLElement | null) => void;
  onClearRecentAccess: () => void;
  onSettingsChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onSidebarToggle: () => void;
  onSelectSearchItem: (key: NavRouteKey) => void;
  onThemeChange: (name: ThemeName) => void;
  onModeToggle: (trigger?: HTMLElement | null) => void;
  onAvatarChange: (avatarDataUrl: string) => void;
	  onLogout: () => void;
	}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const noticeItems = useMemo(() => makeTopbarNoticeItems(projects, t), [projects, t]);
  const messageItems = useMemo(() => makeTopbarMessageItems(projects, generatedAt, statusMessage, t), [generatedAt, projects, statusMessage, t]);
	  return (
    <AntHeader className="app-topbar">
      <div className="topbar-left">
        {settings.collapseButton ? (
	          <button className="topbar-icon-button" type="button" aria-label={sidebarCollapsed ? t("展开侧栏") : t("收起侧栏")} onClick={onSidebarToggle}>
            <AxiSvgIcon name={sidebarCollapsed ? "fold" : "expand"} size={17} animation="grow" animationDuration={0.22} />
          </button>
        ) : null}
        <GlobalSearchBox projects={projects} recentAccessKeys={recentAccessKeys} onClearRecentAccess={onClearRecentAccess} onSelectSearchItem={onSelectSearchItem} />
      </div>
      <div className="topbar-right">
        <a
          className="theme-trigger topbar-github-link"
          href="https://github.com/MoseLu/devsvc-dashboard"
          target="_blank"
          rel="noopener noreferrer"
	          aria-label={t("打开 GitHub 仓库")}
	          title={t("打开 GitHub 仓库")}
        >
          <Github size={16} />
        </a>
        <TopbarFeedTrigger iconName="notice" label={t("通知")} unreadCount={noticeItems.filter((item) => !item.read).length}>
          <TopbarFeedPanel
            emptyText={t("暂无通知")}
            iconName="notice"
            items={noticeItems}
            title={t("通知")}
            onItemClick={(item) => {
              if (item.path) navigate(item.path);
            }}
          />
        </TopbarFeedTrigger>
        <TopbarFeedTrigger iconName="msg" label={t("消息")} unreadCount={messageItems.filter((item) => !item.read).length} unreadTone="success">
          <TopbarFeedPanel
            emptyText={t("暂无消息")}
            iconName="msg"
            items={messageItems}
            title={t("消息")}
            onItemClick={(item) => {
              if (item.path) navigate(item.path);
            }}
          />
        </TopbarFeedTrigger>
        {settings.language ? (
          <Popover
            arrow={false}
            content={(
              <div className="language-menu">
	                {appLocaleOptions.map((item) => (
	                  <button className={item.value === locale ? "is-active" : ""} key={item.value} type="button" onClick={() => onLocaleChange(item.value)}>
	                    {t(item.labelKey)}
	                  </button>
	                ))}
              </div>
            )}
            placement="bottomRight"
            trigger="click"
          >
	            <button className="theme-trigger" type="button" aria-label={t("切换语言")} title={t("切换语言")}>
              <Languages size={16} />
            </button>
          </Popover>
        ) : null}
        <ThemeModeTrigger
          mode={mode}
          onModeToggle={onModeToggle}
        />
        <SettingsPanel
          preference={preference}
          settings={settings}
          theme={theme}
          onModeChange={onModeChange}
          onSettingsChange={onSettingsChange}
          onThemeChange={onThemeChange}
        />
        <UserMenu user={user} onAvatarChange={onAvatarChange} onLogout={onLogout} />
      </div>
    </AntHeader>
  );
}
