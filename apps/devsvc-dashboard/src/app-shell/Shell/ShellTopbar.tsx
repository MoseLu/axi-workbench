import type { MouseEvent } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { AxiDashboardShellProps } from "@axi/shell";

import type { AppTFunction } from "../../app-registry";
import { appLocaleOptions } from "../../i18n";
import type { AppLocale } from "../../i18n/types";
import { TopbarFeedPanel, type TopbarFeedItem } from "../../features/topbar/TopbarFeed";
import type { ThemeMode } from "../../theme/tokens";

/**
 * Topbar region: builds the host topbar action rail (github / notice / message /
 * language / theme / settings) consumed by the shared dashboard shell.
 */
export function makeShellTopbarActions({
  locale,
  messageItems,
  navigate,
  noticeItems,
  onLanguageChange,
  onSettingsOpen,
  onThemeToggle,
  showLanguage,
  t,
  themeMode
}: {
  locale: AppLocale;
  messageItems: TopbarFeedItem[];
  navigate: NavigateFunction;
  noticeItems: TopbarFeedItem[];
  onLanguageChange: (locale: AppLocale) => void;
  onSettingsOpen: () => void;
  onThemeToggle: (element: HTMLElement) => void;
  showLanguage: boolean;
  t: AppTFunction;
  themeMode: ThemeMode;
}): AxiDashboardShellProps["topbarActions"] {
  return {
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
    language: showLanguage ? {
      iconName: "lang",
      key: "language",
      label: t("切换语言"),
      popover: (
        <div className="language-menu">
          {appLocaleOptions.map((item) => (
            <button className={item.value === locale ? "is-active" : ""} key={item.value} type="button" onClick={() => onLanguageChange(item.value)}>
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      )
    } : false,
    theme: { iconName: themeMode === "dark" ? "light" : "dark", key: "theme", label: themeMode === "dark" ? t("切换亮色模式") : t("切换暗色模式"), onClick: (event: MouseEvent<HTMLElement>) => onThemeToggle(event.currentTarget) },
    settings: { iconName: "theme", key: "settings", label: t("系统设置"), onClick: () => onSettingsOpen() }
  };
}
