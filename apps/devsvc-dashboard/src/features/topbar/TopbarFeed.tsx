import type { ReactNode } from "react";

import type { AppTFunction, NavRouteKey } from "../../app-registry";
import { AxiPopoverMenu } from "@axi/crud";
import { AxiSvgIcon, type AxiIconName } from "@axi/core";
import { statusLabelKeys } from "../status/status";

export type TopbarFeedItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  path?: NavRouteKey;
  read?: boolean;
  tone?: "danger" | "success" | "info";
};

export function formatTopbarFeedTime(value: unknown, t: AppTFunction) {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return t("刚刚");
  if (minutes < 60) return t("{{count}} 分钟前", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{{count}} 小时前", { count: hours });
  return date.toLocaleDateString();
}

export function makeTopbarNoticeItems(projects: any[], t: AppTFunction): TopbarFeedItem[] {
  return projects
    .filter((project) => project.pm2?.status !== "online" || project.health?.status !== "ok")
    .slice(0, 6)
    .map((project) => {
      const pm2Label = statusLabelKeys[project.pm2?.status] ? t(statusLabelKeys[project.pm2.status]) : project.pm2?.status || "-";
      const healthLabel = project.health?.status === "ok" ? t("正常") : t("异常");

      return {
        id: project.id,
        title: project.title || project.id,
        description: `${t("整体状态")} ${pm2Label} / ${t("健康")} ${healthLabel}`,
        meta: t("查看服务"),
        path: "/services",
        read: false,
        tone: "danger" as const
      };
    });
}

export function makeTopbarMessageItems(projects: any[], generatedAt: string | undefined, statusMessage: string, t: AppTFunction): TopbarFeedItem[] {
  const items: TopbarFeedItem[] = [];

  if (statusMessage) {
    items.push({
      id: "operation-message",
      title: t("操作消息"),
      description: statusMessage,
      meta: formatTopbarFeedTime(generatedAt, t),
      path: "/overview",
      read: false,
      tone: statusMessage.includes(t("失败")) ? "danger" : "success"
    });
  }

  if (projects.length) {
    const online = projects.filter((project) => project.pm2?.status === "online").length;
    const healthy = projects.filter((project) => project.health?.ok).length;
    items.push({
      id: "service-snapshot",
      title: t("服务快照"),
      description: t("在线 {{online}}/{{total}} · 健康 {{healthy}}/{{total}}", {
        online,
        healthy,
        total: projects.length
      }),
      meta: formatTopbarFeedTime(generatedAt, t),
      path: "/overview",
      read: true,
      tone: healthy === projects.length ? "success" : "info"
    });
  }

  return items;
}

export function TopbarFeedPanel({
  emptyText,
  iconName,
  items,
  title,
  onItemClick
}: {
  emptyText: string;
  iconName: AxiIconName;
  items: TopbarFeedItem[];
  title: string;
  onItemClick?: (item: TopbarFeedItem) => void;
}) {
  return (
    <div className="topbar-feed-panel">
      <div className="topbar-feed-panel-header">
        <span>{title}</span>
        {items.length ? <span className="topbar-feed-panel-count">{items.length}</span> : null}
      </div>
      <div className="topbar-feed-panel-body">
        {items.length ? (
          items.map((item) => (
            <button
              className={`topbar-feed-item is-${item.tone || "info"} ${item.read ? "" : "is-unread"}`.trim()}
              key={item.id}
              type="button"
              onClick={() => onItemClick?.(item)}
            >
              <span className="topbar-feed-item-icon">
                <AxiSvgIcon name={iconName} size={15} />
              </span>
              <span className="topbar-feed-item-content">
                <span className="topbar-feed-item-title">{item.title}</span>
                {item.description ? <span className="topbar-feed-item-description">{item.description}</span> : null}
                {item.meta ? <span className="topbar-feed-item-meta">{item.meta}</span> : null}
              </span>
            </button>
          ))
        ) : (
          <div className="topbar-feed-empty">
            <AxiSvgIcon name={iconName} size={24} />
            <span>{emptyText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TopbarFeedTrigger({
  children,
  iconName,
  label,
  unreadCount,
  unreadTone = "warning"
}: {
  children: ReactNode;
  iconName: AxiIconName;
  label: string;
  unreadCount: number;
  unreadTone?: "success" | "warning";
}) {
  const title = unreadCount ? `${label} (${unreadCount})` : label;

  return (
    <AxiPopoverMenu content={<>{children}</>} rootClassName="topbar-feed-popover-root">
      <button className={`theme-trigger topbar-feed-trigger ${unreadCount ? `has-unread is-${unreadTone}` : ""}`.trim()} type="button" aria-label={title} title={title}>
        <AxiSvgIcon name={iconName} size={16} animation="grow" animationDuration={0.22} />
      </button>
    </AxiPopoverMenu>
  );
}
