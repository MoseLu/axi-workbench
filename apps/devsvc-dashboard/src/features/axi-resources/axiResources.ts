import { api } from "../../lib/api";

export type AxiResource = {
  id: string;
  title: string;
  kind: string;
  surface: string;
  status: string;
  ownerPath: string;
  ownerPathExists?: boolean;
  dashboardRoute?: string;
  capabilities?: string[];
  notes?: string;
};

export type AxiResourcesPayload = {
  generatedAt: string;
  resources: AxiResource[];
};

export async function listAxiResources(): Promise<AxiResource[]> {
  const body = await api("/api/axi/resources") as AxiResourcesPayload;
  return body.resources || [];
}

export function axiResourceRoute(resource: Pick<AxiResource, "dashboardRoute" | "id" | "surface">) {
  if (resource.dashboardRoute && resource.dashboardRoute !== "/axi-resources" && (resource.surface === "hosted-app" || resource.surface === "hosted-subroute")) {
    return resource.dashboardRoute;
  }
  return `/axi-resources/${resource.id}`;
}

export function axiResourceIdFromRoute(route: string) {
  return route.startsWith("/axi-resources/") ? decodeURIComponent(route.slice("/axi-resources/".length).split("/")[0] || "") : null;
}

export function findAxiResourceByRoute(route: string, resources: AxiResource[]) {
  const resourceId = axiResourceIdFromRoute(route);
  if (resourceId) return resources.find((resource) => resource.id === resourceId);
  return resources.find((resource) => axiResourceRoute(resource) === route);
}
