import { api } from "../../lib/api";

export const RESOURCE_LIFECYCLE_STATUSES = [
  'registered',
  'path-found',
  'verified',
  'stale',
  'failed',
  'missing'
] as const;

export type ResourceLifecycleStatus = typeof RESOURCE_LIFECYCLE_STATUSES[number];

const RESOURCE_LIFECYCLE_STATUS_SET: ReadonlySet<ResourceLifecycleStatus> = new Set(
  RESOURCE_LIFECYCLE_STATUSES
);

/**
 * Normalize an externally supplied lifecycle status into the strict
 * `ResourceLifecycleStatus` union.
 *
 * The Workbench Resource Registry receives `status` over the API boundary
 * from the Node-side registry script and static configuration. Both
 * sources may carry unknown strings (legacy entries, graph drift, manual
 * overrides). The UI must not let arbitrary strings bypass the type
 * contract: unknown values collapse to a deterministic fallback
 * (`'path-found'`) and emit a single `console.warn` per offending value.
 *
 * Returns the same reference for known values so callers and tests can
 * compare strictly without losing identity.
 */
export function normalizeResourceStatus(value: unknown): ResourceLifecycleStatus {
  if (typeof value === 'string' && RESOURCE_LIFECYCLE_STATUS_SET.has(value as ResourceLifecycleStatus)) {
    return value as ResourceLifecycleStatus;
  }
  // Unknown / null / undefined / wrong type → safe fallback.
  // `'path-found'` is the conservative choice: the project is registered
  // in the graph but verification has not produced authoritative evidence.
  // It signals "needs verification" rather than "verified" or "failed".
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    const observed = value === undefined ? 'undefined' : JSON.stringify(value);
    console.warn(
      `[axi-resources] Unknown ResourceLifecycleStatus ${observed}; ` +
      'normalizing to "path-found". Update graph or static config to a known status.'
    );
  }
  return 'path-found';
}

// Verification command descriptor (read-only, from graph config)
export type VerifyCommand = {
  id: string;
  label: string;
  command: string[];  // Array of command parts (not shell string)
  runner?: 'local' | 'ci';
};

// Health check configuration for registry resources
export type HealthCheck = {
  type: "http";
  endpoint: string;
  interval: number;
};

// Rule family metadata for axiom-rules
export type AxiRulesMetadata = {
  ruleFamilies?: string[];           // e.g., ["AR-BOOTSTRAP-*", "AR-ADMISSION-*"]
  applicableScopes?: string[];       // e.g., ["project", "workspace", "system"]
  sourcePrecedence?: string[];       // e.g., ["CLAUDE.md", "AGENTS.md", "INDEX.md"]
};

// Skill metadata for axiom-skills
export type AxiSkillsMetadata = {
  skillCategories?: string[];        // e.g., ["agentic", "workspace-ops", "frontend"]
  version?: string;                 // e.g., "3.2.0"
  i18nStatus?: "full" | "partial" | "none";
  skillCount?: number;
};

// Registry metadata for axiom-registry
export type AxiRegistryMetadata = {
  registryUrl?: string;             // e.g., "http://127.0.0.1:4873"
  packageCount?: number;
  healthStatus?: "healthy" | "unhealthy" | "unknown";
  healthEndpoint?: string;
};

// Governance metadata for axiom-workspace-governance
export type AxiGovernanceMetadata = {
  projectCount?: number;
  graphValidation?: {
    valid: boolean;
    errorCount?: number;
    warningCount?: number;
  };
  lastValidatedAt?: string;
};

export type AxiResource = {
  id: string;
  title: string;
  kind: string;
  surface: string;
  status: ResourceLifecycleStatus;
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

  // Cache provenance (WFB-REG-003): which tier served the cached record.
  //   - "persistent" — loaded from disk during this process (typical after restart)
  //   - "in-memory"  — written during this process
  //   - "none"       — no cached record was available
  cacheSource?: 'persistent' | 'in-memory' | 'none';
  fromCache?: boolean;          // true when a cache hit (any tier) was used

  // Verify commands (read-only, from graph config only)
  verifyCommands?: VerifyCommand[];

  // Type-specific metadata (populated from backend or static config)
  health?: HealthCheck;
  rulesMetadata?: AxiRulesMetadata;
  skillsMetadata?: AxiSkillsMetadata;
  registryMetadata?: AxiRegistryMetadata;
  governanceMetadata?: AxiGovernanceMetadata;
};

export type AxiResourcesPayload = {
  generatedAt: string;
  resources: AxiResource[];
};

export async function listAxiResources(): Promise<AxiResource[]> {
  const body = await api("/api/axi/resources") as AxiResourcesPayload;
  const resources = body.resources || [];
  // The API boundary can deliver arbitrary strings in `status`; the
  // front-end must never let them escape the typed surface. Normalize
  // here once, at the parse boundary, so downstream consumers (page,
  // status chip, search, detail view) can rely on the strict union.
  return resources.map((resource) => ({
    ...resource,
    status: normalizeResourceStatus(resource.status)
  }));
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
