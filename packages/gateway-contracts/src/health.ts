import { z } from "zod";

/**
 * GHA-051 / GHA-061 — health, readiness, metrics contract.
 *
 * The gateway exposes three HTTP endpoints:
 *
 *   GET /health/live   → liveness  (process is up)
 *   GET /health/ready  → readiness (composition root finished,
 *                                    route snapshot loaded,
 *                                    required providers registered)
 *   GET /metrics       → metrics snapshot
 *
 * The wire format is defined here so the workbench, monitoring, and
 * tests all parse the same shape. The gateway never leaks secrets
 * through these endpoints: target ids and route ids are public, but
 * tokens / paths / query text are not.
 */

export const healthContractVersion = 1 as const;

/** Stable component statuses used by /health/ready. */
export const componentStatusSchema = z.enum([
  "up",
  "down",
  "degraded",
  "starting",
]);
export type ComponentStatus = z.infer<typeof componentStatusSchema>;

/** Single component report. The gateway emits one entry per
 *  required-side dependency (manifest, registry, breaker registry). */
export const componentHealthSchema = z.object({
  /** Stable component id (e.g. "manifest", "registry", "provider:image"). */
  id: z.string().min(1).max(120),
  status: componentStatusSchema,
  /** Optional detail message; must not contain secrets or query text. */
  detail: z.string().max(400).optional(),
  /** Wall-clock timestamp of the last successful check. */
  lastCheckedAt: z.string().datetime(),
}).strict();
export type ComponentHealth = z.infer<typeof componentHealthSchema>;

/** /health/live response. Always 200 unless the process is in a
 *  fatal state. */
export const livenessResponseSchema = z.object({
  contractVersion: z.literal(healthContractVersion),
  status: z.literal("ok"),
  /** Process uptime in milliseconds. */
  uptimeMs: z.number().int().min(0),
}).strict();
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;

/** /health/ready response. 200 when status="ready"; 503 otherwise.
 *  A single non-essential component can be "degraded" without
 *  failing readiness — only "down" and "starting" are fatal. */
export const readinessResponseSchema = z.object({
  contractVersion: z.literal(healthContractVersion),
  status: z.enum(["ready", "not_ready"]),
  /** Manifest version currently loaded. Mirrors the registry's
   *  active snapshot so monitoring can correlate metric series
   *  with a specific manifest revision. */
  manifestVersion: z.number().int().min(0).max(1000),
  /** Number of routes the snapshot contains. */
  routeCount: z.number().int().min(0).max(1024),
  /** Per-component breakdown. */
  components: z.array(componentHealthSchema).max(64),
}).strict();
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

/** Per-target circuit breaker snapshot. Exposed through /metrics so
 *  monitoring can alert when a target's breaker is open for too long. */
export const breakerSnapshotSchema = z.object({
  targetId: z.string().min(1).max(200),
  routeId: z.string().min(1).max(120),
  /** "closed" = healthy, "open" = rejecting, "half-open" = probing. */
  state: z.enum(["closed", "open", "half-open"]),
  /** Number of samples in the sliding window. */
  samples: z.number().int().min(0).max(10_000),
  /** Number of error samples in the sliding window. */
  errors: z.number().int().min(0).max(10_000),
  /** Wall-clock timestamp at which the breaker opened, or 0 when
   *  closed. */
  openedAt: z.number().int().min(0),
}).strict();
export type BreakerSnapshot = z.infer<typeof breakerSnapshotSchema>;

/** Per-route metrics summary. The dispatcher increments counters on
 *  each request and the /metrics endpoint reads the snapshot. */
export const routeMetricsSchema = z.object({
  routeId: z.string().min(1).max(120),
  requestCount: z.number().int().min(0).max(1e15),
  cacheHitCount: z.number().int().min(0).max(1e15),
  coalescedCount: z.number().int().min(0).max(1e15),
  /** Per-failure-kind counts (timeout, 5xx, etc.). */
  failureCounts: z.record(z.string().min(1).max(40), z.number().int().min(0).max(1e15)).refine(
    (value) => Object.keys(value).length <= 32,
    { message: "failureCounts may contain at most 32 entries" },
  ),
  /** Latency samples (milliseconds). p50 / p95 / p99 are computed
   *  server-side; the field name is stable so dashboards can pin to
   *  it. */
  p50Ms: z.number().int().min(0).max(600_000),
  p95Ms: z.number().int().min(0).max(600_000),
  p99Ms: z.number().int().min(0).max(600_000),
}).strict();
export type RouteMetrics = z.infer<typeof routeMetricsSchema>;

/** /metrics response. Contains one entry per active route plus the
 *  breaker snapshots. The drain counters are GHA-NEXT-035 additions
 *  (optional, default 0) so existing dashboards parsing the
 *  pre-GHA-NEXT-035 shape keep working. */
export const metricsResponseSchema = z.object({
  contractVersion: z.literal(healthContractVersion),
  manifestVersion: z.number().int().min(0).max(1000),
  capturedAt: z.string().datetime(),
  routes: z.array(routeMetricsSchema).max(1024),
  breakers: z.array(breakerSnapshotSchema).max(1024),
  drainInitiatedTotal: z.number().int().min(0).max(10_000_000).optional(),
  drainCompletedTotal: z.number().int().min(0).max(10_000_000).optional(),
  drainTimeoutTotal: z.number().int().min(0).max(10_000_000).optional(),
  childHardTimeoutTotal: z.number().int().min(0).max(10_000_000).optional(),
}).strict();
export type MetricsResponse = z.infer<typeof metricsResponseSchema>;

/** Decide whether a readiness response with `status: "ready"` is
 *  healthy enough to pass an external probe. Components in `down`
 *  or `starting` state always fail; `degraded` is allowed only when
 *  the caller opts in (e.g. when the broken component is non-essential). */
export const isReadinessAcceptable = (
  response: ReadinessResponse,
  options: { allowDegraded?: boolean } = {},
): boolean => {
  if (response.status !== "ready") return false;
  for (const component of response.components) {
    if (component.status === "down" || component.status === "starting") return false;
    if (component.status === "degraded" && !options.allowDegraded) return false;
  }
  return true;
};