export type HostedAppStatus = "idle" | "starting" | "ready" | "stopped" | "error";

export type HostedAppMenuItem = {
  key: string;
  label: string;
  icon?: string;
  route: string;
};

export type HostedAppMenuGroup = {
  key: string;
  label: string;
  icon?: string;
  children: HostedAppMenuItem[];
};

export type HostedApp = {
  appId: string;
  capabilities: string[];
  defaultRoute: string;
  frameRoute: string;
  hostedMode: boolean;
  icon?: string;
  menuGroups: HostedAppMenuGroup[];
  nativeFallback: boolean;
  route: string;
  routes: string[];
  running: boolean;
  status: HostedAppStatus;
  title: string;
  updatedAt: string | null;
};

export async function listHostedApps(): Promise<HostedApp[]> {
  const response = await fetch("/api/apps");
  if (!response.ok) throw new Error(await response.text());
  const body = await response.json() as { apps?: HostedApp[] };
  return body.apps || [];
}

export async function startHostedApp(appId: string): Promise<HostedApp> {
  const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/start`, { method: "POST" });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<HostedApp>;
}

export function hostedAppRoute(app: Pick<HostedApp, "appId" | "defaultRoute">, route = app.defaultRoute) {
  return `/apps/${app.appId}${route.startsWith("/") ? route : `/${route}`}`;
}

export function frameRouteForVisibleRoute(route: string) {
  const nextUrl = new URL(route, window.location.origin);
  nextUrl.searchParams.set("__axi_frame", "1");
  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}
