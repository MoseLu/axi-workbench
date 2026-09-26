import type { ReactNode } from "react";
import type { TFunction } from "i18next";

import { AxiAppIcon, AxiSvgIcon, axiIconNames, type AxiIconName } from "@axi/core";
import { axiResourceIdFromRoute, axiResourceRoute, findAxiResourceByRoute, type AxiResource } from "./features/axi-resources/axiResources";
import { hostedAppRoute, type HostedApp, type HostedAppMenuGroup, type HostedAppMenuItem } from "./features/hosted/hostedApps";

export type AppTFunction = TFunction<"translation", undefined>;
export type StaticNavRouteKey = "/overview" | "/services" | "/deploy" | "/alerts" | "/servers" | "/axi-resources" | "/observability";
export type AxiResourceRouteKey = `/axi-resources/${string}`;
export type HostedRouteKey = `/apps/${string}`;
export type NavRouteKey = StaticNavRouteKey | AxiResourceRouteKey | HostedRouteKey;

export type NavItem = {
  key: NavRouteKey;
  icon: ReactNode;
  label: string;
};

export type NavGroup = {
  key: string;
  icon: ReactNode;
  label: string;
  children: NavItem[];
};

export type RouteTab = {
  key: NavRouteKey;
  title: string;
  group: string;
  pinned?: boolean;
};

export type AppBreadcrumbItem = {
  className?: string;
  key: string;
  title: string;
  icon?: ReactNode;
  path?: NavRouteKey;
  current?: boolean;
  scope?: "host" | "subapp";
};

export type GlobalSearchItem = {
  key: string;
  path: NavRouteKey;
  trackKey?: NavRouteKey;
  title: string;
  group: string;
  icon: ReactNode;
  breadcrumb: string;
  keywords: string;
};

const iconNameSet = new Set<string>(axiIconNames);

function toAxiIconName(name: string | undefined, fallback: AxiIconName = "app"): AxiIconName {
  return name && iconNameSet.has(name) ? name as AxiIconName : fallback;
}

function navIcon(name: string | undefined, fallback: AxiIconName = "app") {
  const iconName = toAxiIconName(name, fallback);
  return <AxiSvgIcon name={iconName} size={16} />;
}

export function axiAppsIcon(size = 16) {
  return <AxiAppIcon size={size} />;
}

export function hostedAppIcon(app: Pick<HostedApp, "icon"> | undefined, size = 16) {
  const iconName = toAxiIconName(app?.icon, "app");
  return <AxiSvgIcon name={iconName} size={size} />;
}

function resourceIcon(resource: Pick<AxiResource, "kind" | "surface" | "capabilities"> | undefined) {
  if (!resource) return navIcon("app");
  if (resource.surface === "hosted-app" || resource.surface === "hosted-subroute") return navIcon("app");
  if (resource.kind.includes("agent")) return navIcon("work");
  if (resource.kind.includes("mcp") || resource.kind.includes("transport")) return navIcon("iot");
  if (resource.kind.includes("knowledge")) return navIcon("search");
  if (resource.kind.includes("registry")) return navIcon("database");
  if (resource.kind.includes("mobile")) return navIcon("phone");
  if (resource.kind.includes("notification")) return navIcon("notice");
  if (resource.kind.includes("tool")) return navIcon("params");
  if (resource.kind.includes("contract")) return navIcon("auth");
  return navIcon("workbench");
}

// Static nav groups that are not dynamically populated (declared before navGroups)
const staticNavGroups: NavGroup[] = [
  {
    key: "workspace-ops",
    icon: navIcon("workbench"),
    label: "workspace-ops",
    children: [
      { key: "/overview", icon: navIcon("stats"), label: "概览" },
      { key: "/services", icon: navIcon("component"), label: "服务" }
    ]
  },
  {
    key: "release-observe",
    icon: navIcon("activity"),
    label: "release-observe",
    children: [
      { key: "/deploy", icon: navIcon("upload"), label: "上线" },
      { key: "/alerts", icon: navIcon("notice"), label: "告警" },
      { key: "/observability", icon: navIcon("search"), label: "Observability" }
    ]
  },
  {
    key: "infrastructure",
    icon: navIcon("database"),
    label: "infrastructure",
    children: [{ key: "/servers", icon: navIcon("device"), label: "服务器" }]
  },
  {
    key: "axi-resources",
    icon: navIcon("database"),
    label: "axi-resources",
    children: [{ key: "/axi-resources", icon: navIcon("database"), label: "资源索引" }]
  }
];

// menuGroup 配置：标签和图标
// Quick entries (hardcoded) get injected into these groups
const menuGroupConfig: Record<string, { label: string; icon: string }> = {
  "component-library": { label: "component-library", icon: "component" },
  "workspace-ops": { label: "workspace-ops", icon: "workbench" },
  "agent-runtime": { label: "agent-runtime", icon: "work" },
  "system": { label: "system", icon: "database" },
  "axi-apps": { label: "axi-apps", icon: "app" }
};

// Hardcoded quick entry resources (not from API)
// These are injected into the appropriate menuGroup for quick access
const quickEntryResources: Array<{ id: string; title: string; menuGroup: string; icon?: string }> = [
  { id: "axi-ui", title: "Axi UI", menuGroup: "component-library", icon: "component" }
];

// navGroups 仅包含静态导航组，动态 menuGroup 在 makeHostNavGroups 中动态生成
export const navGroups: NavGroup[] = staticNavGroups;

export const navRouteKeys = navGroups.flatMap((group) => group.children).map((item) => item.key);
export const navGroupKeys = Object.fromEntries(navGroups.flatMap((group) => group.children.map((item) => [item.key, group.key]))) as Record<NavRouteKey, string>;
export const navGroupByKey = Object.fromEntries(navGroups.map((group) => [group.key, group])) as Record<string, NavGroup>;
export const navRouteItems = Object.fromEntries(navGroups.flatMap((group) => group.children.map((item) => [item.key, item]))) as Record<NavRouteKey, NavItem>;

export function isNavRouteKey(value: unknown): value is NavRouteKey {
  return typeof value === "string" && (navRouteKeys.includes(value as NavRouteKey) || value.startsWith("/apps/") || value.startsWith("/axi-resources/"));
}

export function getRouteKey(pathname: string): NavRouteKey {
  if (pathname.startsWith("/apps/")) return pathname as HostedRouteKey;
  if (pathname.startsWith("/axi-resources/")) return pathname as AxiResourceRouteKey;
  return navRouteKeys.find((path) => pathname.startsWith(path)) || "/overview";
}

export function hostedRouteAppId(key: NavRouteKey): string | null {
  return key.startsWith("/apps/") ? key.split("/")[2] || null : null;
}

function normalizeHostedRoute(route: string) {
  return route.startsWith("/") ? route : `/${route}`;
}

export function hostedRoutePath(key: NavRouteKey): string {
  if (!key.startsWith("/apps/")) return key;
  const segments = key.split("/").slice(3);
  return normalizeHostedRoute(segments.join("/") || "");
}

export function findHostedApp(key: NavRouteKey, apps: HostedApp[]): HostedApp | undefined {
  const appId = hostedRouteAppId(key);
  return appId ? apps.find((app) => app.appId === appId) : undefined;
}

export function findHostedMenuMatch(key: NavRouteKey, apps: HostedApp[]): { app: HostedApp; group?: HostedAppMenuGroup; item?: HostedAppMenuItem } | null {
  const app = findHostedApp(key, apps);
  if (!app) return null;
  const route = hostedRoutePath(key);
  for (const group of app.menuGroups) {
    const item = group.children.find((child) => normalizeHostedRoute(child.route) === route);
    if (item) return { app, group, item };
  }
  return { app };
}

export function hostedAppTitle(app: HostedApp, t?: AppTFunction): string {
  return t ? t(app.title) : app.title;
}

export function hostedRouteTitle(key: NavRouteKey, apps: HostedApp[] = [], t?: AppTFunction): string {
  const match = findHostedMenuMatch(key, apps);
  if (match?.item) return t ? t(match.item.label) : match.item.label;
  if (match?.app) return hostedAppTitle(match.app, t);
  const appId = hostedRouteAppId(key);
  return appId ? appId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : key;
}

export function makeHostNavGroups(
  apps: HostedApp[] = [],
  resources: AxiResource[] = [],
  userRole: 'user' | 'developer' | 'admin' = 'developer'
): NavGroup[] {
  // Filter hosted apps by hostedMode
  const hostedAppItems: NavItem[] = apps.filter((app) => app.hostedMode).map((app) => ({
    key: hostedAppRoute(app) as HostedRouteKey,
    icon: hostedAppIcon(app),
    label: app.title
  }));

  // Filter resources by visibility and audience
  const rolePriority = { user: 0, developer: 1, admin: 2 };
  const userLevel = rolePriority[userRole];

  const filteredResources = resources.filter((resource) => {
    // Skip hosted apps (they're in the apps section)
    if (resource.surface === "hosted-app") return false;

    // Check visibility field
    if (resource.visibility === 'hidden' && userRole !== 'admin') return false;
    if (resource.visibility === 'deferred') return false;
    if (resource.visibility === 'admin' && userRole !== 'admin') return false;

    // Check audience field - user must have sufficient role level
    if (resource.audience) {
      const audienceLevel = rolePriority[resource.audience] ?? 0;
      if (userLevel < audienceLevel) return false;
    }

    return true;
  });

  // Build combined resources: API resources + quick entries
  const combinedResources = [
    ...filteredResources,
    ...quickEntryResources.map((entry) => ({
      id: entry.id,
      title: entry.title,
      kind: 'shared-runtime',
      surface: 'resource-index',
      status: 'verified',
      ownerPath: '',
      menuGroup: entry.menuGroup,
      icon: entry.icon,
      dashboardRoute: `/axi-ui/${entry.id}`
    }))
  ];

  // Group resources by menuGroup
  const menuGroupMap = new Map<string, NavItem[]>();

  for (const resource of combinedResources) {
    const groupKey = resource.menuGroup || "axi-resources";
    if (!menuGroupMap.has(groupKey)) {
      menuGroupMap.set(groupKey, []);
    }

    // Determine route - use dashboardRoute for quick entries
    const routeKey: NavRouteKey = 'dashboardRoute' in resource && resource.dashboardRoute && resource.dashboardRoute !== "/axi-resources"
      ? resource.dashboardRoute as NavRouteKey
      : axiResourceRoute(resource) as NavRouteKey;

    menuGroupMap.get(groupKey)!.push({
      key: routeKey,
      icon: resourceIcon(resource),
      label: resource.title
    });
  }

  // Build the groups array dynamically based on actual menuGroups
  const groups: NavGroup[] = [...staticNavGroups];

  // Add hosted apps as a separate group (axi-apps)
  if (hostedAppItems.length > 0) {
    groups.push({
      key: "axi-apps",
      icon: axiAppsIcon(),
      label: "axi-apps",
      children: hostedAppItems
    });
  }

  // Add resource groups based on menuGroupMap (excluding 'axi-apps' which is handled above)
  for (const [groupKey, items] of menuGroupMap) {
    if (groupKey === "axi-apps" && hostedAppItems.length > 0) continue;

    const config = menuGroupConfig[groupKey];
    groups.push({
      key: groupKey,
      icon: navIcon(config?.icon || "database"),
      label: config?.label || groupKey,
      children: items
    });
  }

  return groups;
}

export function translateNavGroups(
  t: AppTFunction,
  apps: HostedApp[] = [],
  resources: AxiResource[] = [],
  userRole: 'user' | 'developer' | 'admin' = 'developer'
): NavGroup[] {
  return makeHostNavGroups(apps, resources, userRole).map((group) => ({
    ...group,
    label: t(group.label),
    children: group.children.map((item) => ({ ...item, label: t(item.label) }))
  }));
}

export function makeHostedNavGroups(app: HostedApp | undefined, t: AppTFunction): NavGroup[] {
  if (!app) return [];
  return app.menuGroups.map((group) => ({
    key: `app:${app.appId}:${group.key}`,
    icon: navIcon(group.icon, "app"),
    label: t(group.label),
    children: group.children.map((item) => ({
      key: hostedAppRoute(app, item.route) as HostedRouteKey,
      icon: navIcon(item.icon, "app"),
      label: t(item.label)
    }))
  }));
}

export function filterNavGroups(groups: NavGroup[], keyword: string): NavGroup[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return groups;

  return groups
    .map((group) => {
      const groupMatches = `${group.key} ${group.label}`.toLowerCase().includes(normalized);
      const children = group.children.filter((item) => groupMatches || `${item.key} ${item.label}`.toLowerCase().includes(normalized));
      return children.length ? { ...group, children } : null;
    })
    .filter(Boolean) as NavGroup[];
}

export function makeGlobalSearchItems(
  t: AppTFunction,
  apps: HostedApp[] = [],
  resources: AxiResource[] = [],
  userRole: 'user' | 'developer' | 'admin' = 'developer'
): GlobalSearchItem[] {
  return translateNavGroups(t, apps, resources, userRole).flatMap((group) =>
    group.children.map((item) => {
      const groupTitle = group.label;
      const itemTitle = item.label;
      return {
        key: item.key,
        path: item.key,
        trackKey: item.key,
        title: itemTitle,
        group: groupTitle,
        icon: item.icon,
        breadcrumb: `${groupTitle} / ${itemTitle}`,
        keywords: `${groupTitle} ${itemTitle} ${item.key}`.toLowerCase()
      };
    })
  );
}

/**
 * Return a flat, role-aware list of nav keys + labels for a given role.
 *
 * This is the canonical helper used by security / role-based access tests
 * and the global search box. It mirrors the visibility / audience filtering
 * applied by `makeHostNavGroups`, so the keys returned here are exactly the
 * keys the Shell will render for the same role.
 *
 * Caller MUST pass a role; there is no implicit "developer" default. Tests
 * that compare across roles call this three times with the same input.
 */
export function getNavItemsByRole(
  userRole: 'user' | 'developer' | 'admin',
  apps: HostedApp[] = [],
  resources: AxiResource[] = []
): Array<{ key: NavRouteKey; label: string; group: string }> {
  return makeHostNavGroups(apps, resources, userRole).flatMap((group) =>
    group.children.map((item) => ({
      key: item.key,
      label: item.label,
      group: group.key
    }))
  );
}

export function makeRouteTab(key: NavRouteKey, t: AppTFunction, apps: HostedApp[] = [], resources: AxiResource[] = []): RouteTab {
  if (key.startsWith("/apps/")) {
    const match = findHostedMenuMatch(key, apps);
    return {
      key,
      title: hostedRouteTitle(key, apps, t),
      group: match?.app ? hostedAppTitle(match.app, t) : t("axi-apps")
    };
  }
  const resource = findAxiResourceByRoute(key, resources);
  if (resource || axiResourceIdFromRoute(key)) {
    return {
      key,
      title: resource ? t(resource.title) : axiResourceIdFromRoute(key) || t("资源索引"),
      group: t("axi-resources")
    };
  }
  const route = navRouteItems[key];
  const groupKey = navGroupKeys[key];
  const group = groupKey ? navGroupByKey[groupKey] : undefined;
  return {
    key,
    title: route ? t(route.label) : key,
    group: group ? t(group.label) : t("页面")
  };
}

export function makeBreadcrumbItems(key: NavRouteKey, t: AppTFunction, apps: HostedApp[] = [], resources: AxiResource[] = []): AppBreadcrumbItem[] {
  if (key.startsWith("/apps/")) {
    const match = findHostedMenuMatch(key, apps);
    return [
      { className: "breadcrumb-scope-host", key: "axi-apps", title: t("axi-apps"), icon: axiAppsIcon(), scope: "host" },
      match?.app ? {
        className: "breadcrumb-scope-host",
        key: match.app.appId,
        title: hostedAppTitle(match.app, t),
        icon: hostedAppIcon(match.app),
        path: hostedAppRoute(match.app) as HostedRouteKey,
        scope: "host"
      } : null,
      match?.group ? {
        className: "breadcrumb-scope-subapp",
        key: match.group.key,
        title: t(match.group.label),
        icon: navIcon(match.group.icon, "app"),
        scope: "subapp"
      } : null,
      { className: "breadcrumb-scope-subapp", key, title: hostedRouteTitle(key, apps, t), current: true, scope: "subapp" }
    ].filter(Boolean) as AppBreadcrumbItem[];
  }
  const resource = findAxiResourceByRoute(key, resources);
  if (resource || key.startsWith("/axi-resources")) {
    return [
      { className: "breadcrumb-scope-host", key: "axi-resources", title: t("axi-resources"), icon: navIcon("database"), scope: "host" },
      {
        className: "breadcrumb-scope-host",
        key: "axi-resources-index",
        title: t("资源索引"),
        icon: navIcon("database"),
        path: "/axi-resources",
        current: key === "/axi-resources",
        scope: "host"
      },
      resource ? {
        className: "breadcrumb-scope-host",
        current: true,
        key: resource.id,
        title: t(resource.title),
        icon: resourceIcon(resource),
        scope: "host"
      } : null
    ].filter(Boolean) as AppBreadcrumbItem[];
  }
  const groupKey = navGroupKeys[key];
  const group = groupKey ? navGroupByKey[groupKey] : undefined;
  const route = navRouteItems[key];

  return [
    group ? { key: group.key, title: t(group.label), icon: group.icon } : null,
    route ? { key: route.key, title: t(route.label), icon: route.icon, path: route.key, current: true } : { key, title: key, current: true }
  ].filter(Boolean) as AppBreadcrumbItem[];
}
