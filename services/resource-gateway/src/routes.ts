/**
 * apps/gateway HTTP route path constants (GHA-NEXT-004).
 *
 * Every HTTP path literal used by the gateway server is declared here as
 * an immutable constant.  server.ts MUST import from this file rather than
 * re-declare the strings inline.  This gives us a single source of truth
 * for:
 *
 *   - the six canonical endpoints already documented in
 *     packages/contracts/src/http-api.ts (GET /health/live … /docs),
 *   - the two MiniMax TokenPlan bridge endpoints (POST …/search, …/image),
 *   - the ops-safe /routes projection endpoint added in GHA-NEXT-002.
 *
 * No secrets, no tokens, no adapter references — only public HTTP paths.
 */

/* ------------------------------------------------------------------ *
 * Canonical HTTP API endpoints (matched against http-api.ts constants)  *
 * ------------------------------------------------------------------ */

/** GET /health/live — process liveness probe. */
export const PATH_HEALTH_LIVE = "/health/live" as const;

/** GET /health/ready — readiness probe (manifest + registry + bridge). */
export const PATH_HEALTH_READY = "/health/ready" as const;

/** GET /metrics — in-process metrics snapshot. */
export const PATH_METRICS = "/metrics" as const;

/** GET /metrics/prometheus — Prometheus text-format export (GHA-NEXT-037.3). */
export const PATH_METRICS_PROMETHEUS = "/metrics/prometheus" as const;

/** GET /openapi.json — OpenAPI 3.1 machine-readable document. */
export const PATH_OPENAPI_JSON = "/openapi.json" as const;

/** GET /docs — human-readable HTML API reference. */
export const PATH_DOCS = "/docs" as const;

/** GET /routes — safe ops projection of the route registry. */
export const PATH_ROUTES = "/routes" as const;

/** POST /gateway/run — dispatcher (browser → gateway entrypoint). */
export const PATH_GATEWAY_RUN = "/gateway/run" as const;

/** POST /resource/search — narrow cross-project contract. */
export const PATH_RESOURCE_SEARCH = "/resource/search" as const;

/* ------------------------------------------------------------------ *
 * MiniMax TokenPlan bridge endpoints (server-only, not in public       *
 * contract yet — GHA-NEXT-002 flags them for future inclusion)       *
 * ------------------------------------------------------------------ */

/** POST /provider/minimax-tokenplan/search — web-search via local CLI bridge. */
export const PATH_MINIMAX_SEARCH = "/provider/minimax-tokenplan/search" as const;

/** POST /provider/minimax-tokenplan/image — image-generation via local CLI bridge. */
export const PATH_MINIMAX_IMAGE = "/provider/minimax-tokenplan/image" as const;

/* ------------------------------------------------------------------ *
 * Admin / ops endpoints (GHA-NEXT-034)                                  *
 * ------------------------------------------------------------------ */

/** POST /admin/drain — start a graceful drain. Gated by `GATEWAY_ADMIN_TOKEN`. */
export const PATH_ADMIN_DRAIN = "/admin/drain" as const;

/** POST /admin/routes/reload — hot-reload the route registry. Gated by `GATEWAY_ADMIN_TOKEN`. */
export const PATH_ADMIN_ROUTES_RELOAD = "/admin/routes/reload" as const;

/* ------------------------------------------------------------------ *
 * Aggregate arrays for documentation and validation helpers            *
 * ------------------------------------------------------------------ */

/** All documented public endpoint paths (canonical six). */
export const PUBLIC_API_PATHS = [
  PATH_HEALTH_LIVE,
  PATH_HEALTH_READY,
  PATH_METRICS,
  PATH_OPENAPI_JSON,
  PATH_DOCS,
  PATH_GATEWAY_RUN,
  PATH_RESOURCE_SEARCH,
] as const;

/** All known HTTP endpoint paths (public + internal bridge + admin). */
export const ALL_HTTP_PATHS = [
  ...PUBLIC_API_PATHS,
  PATH_ROUTES,
  PATH_MINIMAX_SEARCH,
  PATH_MINIMAX_IMAGE,
  PATH_ADMIN_DRAIN,
  PATH_ADMIN_ROUTES_RELOAD,
  PATH_METRICS_PROMETHEUS,
] as const;

/* ------------------------------------------------------------------ *
 * Route-grouping tag used by the capability derivation helper          *
 * ------------------------------------------------------------------ */

/**
 * Canonical capability labels the /routes projection exposes.
 * Derived from `toolId` patterns — never from adapter or config.
 */
export type RouteCapability = "search" | "inspect" | "preview" | "generate";

/**
 * Derive the capability label(s) from a toolId.
 *
 * Pattern mapping:
 *   resource.search.*    → ["search"]
 *   resource.inspect.*   → ["inspect"]
 *   resource.preview.*   → ["preview"]
 *   resource.generate.*   → ["generate"]
 *   any other toolId      → []
 *
 * GHA-NEXT-002: `capabilities` is a non-empty array in the
 * `/routes` projection only when the pattern match is conclusive;
 * the empty array means the router could not determine a capability.
 */
export const deriveCapabilities = (toolId: string): ReadonlyArray<RouteCapability> => {
  if (toolId.startsWith("resource.search.")) return ["search"];
  if (toolId.startsWith("resource.inspect.")) return ["inspect"];
  if (toolId.startsWith("resource.preview.")) return ["preview"];
  if (toolId.startsWith("resource.generate.")) return ["generate"];
  return [];
};
