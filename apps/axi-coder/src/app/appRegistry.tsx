import {
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  Network,
  Smartphone,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type AppRouteKey = "/overview" | "/terminal" | "/providers" | "/mobile" | "/agent" | "/logs";

export type AppNavItem = {
  key: AppRouteKey;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
};

export type AppNavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  children: AppNavItem[];
};

export type AppBreadcrumbItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  current?: boolean;
};

export type AppSearchItem = {
  key: AppRouteKey;
  label: string;
  group: string;
  description: string;
  icon: LucideIcon;
  breadcrumb: string;
  keywords: string;
};

export const appNavGroups: AppNavGroup[] = [
  {
    key: "workbench",
    label: "编码工作台",
    icon: LayoutDashboard,
    children: [
      {
        key: "/overview",
        label: "总览",
        description: "工作站链路、桌面端、移动端、模型路由和证据评审",
        icon: LayoutDashboard,
        keywords: ["overview", "workbench", "workspace", "artifact"],
      },
      {
        key: "/terminal",
        label: "终端",
        description: "Claude / Codex / Gemini 终端会话",
        icon: Terminal,
        keywords: ["terminal", "cli", "claude", "codex", "gemini"],
      },
      {
        key: "/agent",
        label: "任务执行",
        description: "工作站任务、任务参数和证据评审",
        icon: Bot,
        keywords: ["agent", "task", "workstation", "parameters"],
      },
    ],
  },
  {
    key: "contracts",
    label: "合同与伴随端",
    icon: Network,
    children: [
      {
        key: "/providers",
        label: "模型供应商",
        description: "供应商配置、凭据引用、Ollama 扫描和 CLI 路由",
        icon: Network,
        keywords: ["provider", "credential", "ollama", "route", "model"],
      },
      {
        key: "/mobile",
        label: "移动伴随端",
        description: "Android 伴随端、通知中继、深链和真机验证证据",
        icon: Smartphone,
        keywords: ["mobile", "android", "notify", "deep link", "goal70"],
      },
    ],
  },
  {
    key: "diagnostics",
    label: "诊断",
    icon: Database,
    children: [
      {
        key: "/logs",
        label: "日志",
        description: "请求日志、健康检查和诊断证据",
        icon: FileText,
        keywords: ["logs", "health", "diagnostics", "request"],
      },
    ],
  },
];

export const appRouteKeys = appNavGroups.flatMap((group) => group.children.map((item) => item.key));

export const appNavItems = Object.fromEntries(
  appNavGroups.flatMap((group) => group.children.map((item) => [item.key, item])),
) as Record<AppRouteKey, AppNavItem>;

export const appGroupByRoute = Object.fromEntries(
  appNavGroups.flatMap((group) => group.children.map((item) => [item.key, group])),
) as Record<AppRouteKey, AppNavGroup>;

export function isAppRouteKey(value: unknown): value is AppRouteKey {
  return typeof value === "string" && appRouteKeys.includes(value as AppRouteKey);
}

export function getRouteKey(pathname: string): AppRouteKey {
  const normalized = pathname === "/" ? "/overview" : pathname;
  return appRouteKeys.find((route) => normalized.startsWith(route)) ?? "/overview";
}

export function makeBreadcrumbItems(route: AppRouteKey): AppBreadcrumbItem[] {
  const group = appGroupByRoute[route];
  const item = appNavItems[route];
  const GroupIcon = group.icon;
  const ItemIcon = item.icon;
  return [
    { key: group.key, label: group.label, icon: <GroupIcon size={14} /> },
    { key: item.key, label: item.label, icon: <ItemIcon size={14} />, current: true },
  ];
}

export function makeSearchItems(): AppSearchItem[] {
  return appNavGroups.flatMap((group) =>
    group.children.map((item) => ({
      key: item.key,
      label: item.label,
      group: group.label,
      description: item.description,
      icon: item.icon,
      breadcrumb: `${group.label} / ${item.label}`,
      keywords: [group.label, item.label, item.description, item.key, ...item.keywords].join(" ").toLowerCase(),
    })),
  );
}

export function filterNavGroups(keyword: string): AppNavGroup[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return appNavGroups;
  }

  return appNavGroups
    .map((group) => {
      const groupMatches = `${group.key} ${group.label}`.toLowerCase().includes(normalized);
      const children = group.children.filter((item) =>
        groupMatches || `${item.key} ${item.label} ${item.description} ${item.keywords.join(" ")}`.toLowerCase().includes(normalized),
      );
      return children.length > 0 ? { ...group, children } : null;
    })
    .filter(Boolean) as AppNavGroup[];
}

export function routeLabel(route: AppRouteKey) {
  return appNavItems[route].label;
}
