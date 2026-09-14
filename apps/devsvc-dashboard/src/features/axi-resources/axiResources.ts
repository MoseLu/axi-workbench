import { api } from "../../lib/api";

// Resource lifecycle status for registration → verification → expiration lifecycle
export type ResourceLifecycleStatus =
  | 'registered'  // Project exists in graph with path
  | 'path-found'   // ownerPath resolved but not yet verified
  | 'verified'     // Recent successful verification
  | 'stale'        // Verification older than 24 hours
  | 'failed'       // Verification failed
  | 'missing';     // Path does not exist

// Verification command descriptor (read-only, from graph config)
export type VerifyCommand = {
  id: string;
  label: string;
  command: string[];  // Array of command parts (not shell string)
  runner?: 'local' | 'ci';
};

export type AxiResource = {
  id: string;
  title: string;
  kind: string;
  surface: string;
  status: ResourceLifecycleStatus | string;
  ownerPath: string;
  ownerPathExists?: boolean;
  dashboardRoute?: string;
  capabilities?: string[];
  notes?: string;

  // Presentation override fields
  visibility?: 'always' | 'deferred' | 'hidden' | 'admin';
  menuGroup?: string;
  audience?: 'user' | 'developer' | 'admin';
  docsRoute?: string;
  owner?: string;

  // Verification metadata
  lastVerifiedAt?: string;      // ISO-8601 timestamp
  verificationSource?: string;  // 'local' | 'ci' | 'remote'
  verificationSummary?: string; // Human-readable summary
  evidenceLink?: string;       // Evidence URL

  // Verify commands (read-only, from graph config only)
  verifyCommands?: VerifyCommand[];
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
