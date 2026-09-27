import { z } from "zod";

/**
 * GHA-023 / GHA-024 — versioned resource-route policy contract.
 *
 * The five "受控资源路由" (image / document / project / ui / icon) are the
 * canonical resource kinds the gateway exposes. Each one has a stable
 * route id, a stable tool id, and a route policy that the dispatch
 * layer is allowed to enforce. This module defines those names and
 * the policy shape in one place so that:
 *   - apps/gateway can accept a versioned JSON snapshot of routes
 *   - packages/orchestrator can validate manifest routes against the
 *     same schema and refuse unknown route ids before startup
 *   - apps/workbench can advertise the supported set to the UI
 *
 * Backwards compatibility:
 *   - `routeContractVersion` is a literal `1` for now. Adding a new
 *     route id is non-breaking. Renaming or removing one requires a
 *     contract bump.
 *   - The exported schemas are pure Zod; no transport, no fetch, no
 *     logger. The orchestrator may layer stateful predicates on top.
 */

/** Bumped every time a route id is renamed/removed or a policy field
 *  changes semantics. Additive changes do NOT bump the version. */
export const routeContractVersion = 1 as const;

/** The five resource kinds whose routes the gateway exposes. Adding a
 *  kind here is a contract bump. */
export const supportedResourceKindSchema = z.enum([
  "image",
  "document",
  "project",
  "ui",
  "icon",
]);
export type SupportedResourceKind = z.infer<typeof supportedResourceKindSchema>;

/** Stable tool id convention: `resource.<operation>.<kind>`. The
 *  validator refuses anything that doesn't match. */
export const resourceToolIdPattern = /^resource\.(search|inspect|preview|generate)\.[a-z0-9-]{1,40}$/u;
export const resourceToolIdSchema = z.string().min(1).max(120).refine(
  (value) => resourceToolIdPattern.test(value),
  { message: "toolId must match resource.<operation>.<kind> where operation ∈ {search, inspect, preview, generate}" },
);

/** The full set of supported tool ids, one per (operation, kind). The
 *  set is fixed; consumers should enumerate instead of pattern-matching
 *  so a typo at the manifest level fails validation immediately. */
export const resourceToolIds = {
  searchImage: "resource.search.image",
  inspectImage: "resource.inspect.image",
  previewImage: "resource.preview.image",
  searchDocument: "resource.search.document",
  inspectDocument: "resource.inspect.document",
  previewDocument: "resource.preview.document",
  searchProject: "resource.search.project",
  inspectProject: "resource.inspect.project",
  previewProject: "resource.preview.project",
  searchUi: "resource.search.ui",
  inspectUi: "resource.inspect.ui",
  previewUi: "resource.preview.ui",
  searchIcon: "resource.search.icon",
  inspectIcon: "resource.inspect.icon",
  previewIcon: "resource.preview.icon",
  generateImage: "resource.generate.image",
} as const;
export type ResourceToolId = typeof resourceToolIds[keyof typeof resourceToolIds];

/** Stable route id convention: `route.<kind>` for primary routes and
 *  `route.<kind>-fallback` for the fallback route. The validator refuses
 *  anything outside the convention so a typo in a manifest fails fast. */
export const routeIdPattern = /^route\.(image|document|project|ui|icon)(-fallback)?$/u;
export const routeIdSchema = z.string().min(1).max(120).refine(
  (value) => routeIdPattern.test(value),
  { message: "route id must be route.<kind> or route.<kind>-fallback where kind ∈ {image, document, project, ui, icon}" },
);

/** Resource route registry — the closed set of (kind → primary route id).
 *  Used by validators and by the dispatch layer when scoring intent
 *  resource kinds. This is intentionally not generated from
 *  supportedResourceKindSchema: the explicit mapping below is what the
 *  tests pin and what the manifest validator reads. */
export const resourceKindToRouteId: Readonly<Record<SupportedResourceKind, string>> = {
  image: "route.image",
  document: "route.document",
  project: "route.project",
  ui: "route.ui",
  icon: "route.icon",
} as const;

/** Reverse mapping for diagnostics. */
export const routeIdToResourceKind: Readonly<Record<string, SupportedResourceKind>> = {
  "route.image": "image",
  "route.image-fallback": "image",
  "route.document": "document",
  "route.document-fallback": "document",
  "route.project": "project",
  "route.project-fallback": "project",
  "route.ui": "ui",
  "route.ui-fallback": "ui",
  "route.icon": "icon",
  "route.icon-fallback": "icon",
} as const;

/** Determine the canonical resource kind for a route id. Returns null
 *  when the route id does not map to a known kind. */
export const resourceKindForRouteId = (routeId: string): SupportedResourceKind | null => {
  const mapped = routeIdToResourceKind[routeId];
  return mapped ?? null;
};

/** Determine the primary route id for a resource kind. */
export const primaryRouteIdForKind = (kind: SupportedResourceKind): string => resourceKindToRouteId[kind];

/** Determine the fallback route id for a resource kind. */
export const fallbackRouteIdForKind = (kind: SupportedResourceKind): string => `route.${kind}-fallback`;

/** Per-route load balancing strategy. Mirrors the orchestrator's
 *  LoadBalancerStrategy enum so the two layers stay in sync. */
export const routeLoadBalancerSchema = z.enum([
  "round-robin",
  "weighted-round-robin",
  "sticky-by-query",
  "failover-only",
]);
export type RouteLoadBalancer = z.infer<typeof routeLoadBalancerSchema>;

/** Per-route circuit breaker configuration. The dispatch layer uses
 *  minSamples/errorRate/openMs; the field name `errorRateThreshold`
 *  stays consistent with the existing RouteDefinition shape. */
export const routeCircuitConfigSchema = z.object({
  minSamples: z.number().int().min(1).max(10_000),
  errorRateThreshold: z.number().min(0).max(1),
  openMs: z.number().int().min(0).max(86_400_000),
}).strict();
export type RouteCircuitConfig = z.infer<typeof routeCircuitConfigSchema>;

/** Per-route timeout policy. `firstAttemptMs` is the wall-clock budget
 *  for the first attempt; `totalBudgetMs` is the upper bound for the
 *  entire route including retries. `idempotent` controls whether the
 *  retry/backoff layer may re-issue the call on transient failure. */
export const routeTimeoutPolicySchema = z.object({
  firstAttemptMs: z.number().int().min(1).max(600_000),
  totalBudgetMs: z.number().int().min(1).max(600_000),
  idempotent: z.boolean(),
}).strict().refine(
  (value) => value.totalBudgetMs >= value.firstAttemptMs,
  { message: "totalBudgetMs must be >= firstAttemptMs" },
);
export type RouteTimeoutPolicy = z.infer<typeof routeTimeoutPolicySchema>;

/** Per-route retry policy. `maxAttempts` includes the first attempt
 *  (i.e. maxAttempts=2 means at most one retry). `backoffMs` is the
 *  base; the actual delay is `base * 2^attempt` capped at `maxBackoffMs`
 *  with the orchestrator's jitter strategy. */
export const routeRetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(8),
  backoffMs: z.number().int().min(0).max(60_000),
  maxBackoffMs: z.number().int().min(0).max(60_000),
}).strict().refine(
  (value) => value.maxBackoffMs >= value.backoffMs,
  { message: "maxBackoffMs must be >= backoffMs" },
);
export type RouteRetryPolicy = z.infer<typeof routeRetryPolicySchema>;

/** Per-route backpressure policy. `maxConcurrent` is the semaphore
 *  size; `queueTimeoutMs` is the time a queued caller waits before
 *  receiving `rate_limited`. `shedStrategy` decides what happens when
 *  the queue is full or times out: `reject` returns a 503 envelope;
 *  `coalesce` joins the existing in-flight call if the route key is
 *  identical. */
export const routeBackpressureStrategySchema = z.enum(["reject", "coalesce"]);
export type RouteBackpressureStrategy = z.infer<typeof routeBackpressureStrategySchema>;

export const routeBackpressurePolicySchema = z.object({
  maxConcurrent: z.number().int().min(1).max(1024),
  queueTimeoutMs: z.number().int().min(0).max(60_000),
  shedStrategy: routeBackpressureStrategySchema,
}).strict();
export type RouteBackpressurePolicy = z.infer<typeof routeBackpressurePolicySchema>;

/** Per-route cache policy. `ttlMs=0` disables caching. `keyKind`
 *  declares what the cache key includes: `route-and-payload` is the
 *  default; `route-only` is for routes that explicitly want to share
 *  responses across callers. `negativeTtlMs` controls how long empty
 *  results are cached (prevents a thundering herd against a sick
 *  provider). */
export const routeCacheKeyKindSchema = z.enum(["route-only", "route-and-payload"]);
export type RouteCacheKeyKind = z.infer<typeof routeCacheKeyKindSchema>;

export const routeCachePolicySchema = z.object({
  ttlMs: z.number().int().min(0).max(86_400_000),
  keyKind: routeCacheKeyKindSchema,
  negativeTtlMs: z.number().int().min(0).max(86_400_000),
  maxEntries: z.number().int().min(0).max(100_000),
}).strict();
export type RouteCachePolicy = z.infer<typeof routeCachePolicySchema>;

/** Coalescing key kind. `idempotency` is the default; callers with an
 *  explicit `requestKey` use `request-key`; `none` disables coalescing
 *  entirely (e.g. for non-idempotent routes). */
export const routeCoalescingKeyKindSchema = z.enum(["idempotency", "request-key", "none"]);
export type RouteCoalescingKeyKind = z.infer<typeof routeCoalescingKeyKindSchema>;

export const routeCoalescingPolicySchema = z.object({
  keyKind: routeCoalescingKeyKindSchema,
}).strict();
export type RouteCoalescingPolicy = z.infer<typeof routeCoalescingPolicySchema>;

/** The complete route policy the gateway applies to one route. Every
 *  field is required: callers must opt out explicitly (e.g. ttlMs=0).
 *  This is the wire-format schema; the orchestrator projects it into
 *  RouteDefinition-shaped state internally. */
export const routePolicySchema = z.object({
  routeId: routeIdSchema,
  toolId: resourceToolIdSchema,
  description: z.string().min(1).max(800),
  loadBalancer: routeLoadBalancerSchema,
  timeout: routeTimeoutPolicySchema,
  retry: routeRetryPolicySchema,
  backpressure: routeBackpressurePolicySchema,
  cache: routeCachePolicySchema,
  coalescing: routeCoalescingPolicySchema,
  circuit: routeCircuitConfigSchema.optional(),
}).strict().refine(
  (value) => {
    const expectedKind = resourceKindForRouteId(value.routeId);
    if (!expectedKind) return true; // routeId validator already enforced format
    const expectedToolKind = value.toolId.split(".").pop();
    return expectedToolKind === expectedKind;
  },
  { message: "routeId and toolId.kind must agree on the same resource kind" },
);
export type RoutePolicy = z.infer<typeof routePolicySchema>;

/** A versioned set of policies for every supported route. The
 *  orchestrator validates this on startup and refuses to boot if a
 *  required route is missing or a policy field is invalid. */
export const routePolicySetSchema = z.object({
  contractVersion: z.literal(routeContractVersion),
  /** The set of (kind → primary route) pairs the gateway supports. */
  kinds: z.array(z.object({
    kind: supportedResourceKindSchema,
    primaryRouteId: routeIdSchema,
    fallbackRouteId: routeIdSchema,
  })).min(1),
  policies: z.array(routePolicySchema).min(1),
}).strict().superRefine((value, ctx) => {
  const routeIds = new Set<string>();
  for (const [index, policy] of value.policies.entries()) {
    if (routeIds.has(policy.routeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate route policy for routeId: ${policy.routeId}`,
        path: ["policies", index, "routeId"],
      });
    }
    routeIds.add(policy.routeId);
  }
  for (const [index, entry] of value.kinds.entries()) {
    if (!routeIds.has(entry.primaryRouteId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `primaryRouteId ${entry.primaryRouteId} is missing from policies[]`,
        path: ["kinds", index, "primaryRouteId"],
      });
    }
    if (!routeIds.has(entry.fallbackRouteId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `fallbackRouteId ${entry.fallbackRouteId} is missing from policies[]`,
        path: ["kinds", index, "fallbackRouteId"],
      });
    }
    const expectedPrimary = resourceKindToRouteId[entry.kind];
    const expectedFallback = `route.${entry.kind}-fallback`;
    if (entry.primaryRouteId !== expectedPrimary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `kind ${entry.kind} primaryRouteId must be ${expectedPrimary}`,
        path: ["kinds", index, "primaryRouteId"],
      });
    }
    if (entry.fallbackRouteId !== expectedFallback) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `kind ${entry.kind} fallbackRouteId must be ${expectedFallback}`,
        path: ["kinds", index, "fallbackRouteId"],
      });
    }
  }
});
export type RoutePolicySet = z.infer<typeof routePolicySetSchema>;

/** Build a minimal policy set with safe defaults. Tests use this to
 *  avoid hand-crafting every field; production code may pass overrides
 *  to tighten individual routes. Defaults match the existing
 *  providers.manifest.json behavior (60s cache, 8s timeout). */
export const defaultRoutePolicy = (routeId: string, kind: SupportedResourceKind, overrides: Partial<RoutePolicy> = {}): RoutePolicy => {
  const base: RoutePolicy = {
    routeId,
    toolId: `resource.search.${kind}` as ResourceToolId,
    description: `Default policy for ${kind}`,
    loadBalancer: "weighted-round-robin",
    timeout: { firstAttemptMs: 8_000, totalBudgetMs: 30_000, idempotent: true },
    retry: { maxAttempts: 2, backoffMs: 100, maxBackoffMs: 1_000 },
    backpressure: { maxConcurrent: 4, queueTimeoutMs: 1_000, shedStrategy: "reject" },
    cache: { ttlMs: 60_000, keyKind: "route-and-payload", negativeTtlMs: 5_000, maxEntries: 1_024 },
    coalescing: { keyKind: "idempotency" },
  };
  return { ...base, ...overrides, routeId, toolId: overrides.toolId ?? base.toolId };
};