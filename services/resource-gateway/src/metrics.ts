import { breakerSnapshotSchema, metricsResponseSchema, routeMetricsSchema, type BreakerSnapshot, type MetricsResponse, type RouteMetrics } from "@axi/gateway-contracts";

/**
 * GHA-061 — in-process metrics.
 *
 * The gateway owns its own counter Map. We avoid pulling in prom-client
 * because the contract's `metricsResponseSchema` is what the UI and any
 * downstream exporter will read, and adding a process-runtime dep just
 * to format numbers would bloat the install. Counters are keyed on
 * (routeId, metricKey). The snapshot is taken under a synchronous pass
 * so the response is internally consistent (no half-updated counter).
 *
 * Sensitive values (secrets, file paths, raw query text) are NEVER
 * stored here — only route ids and target ids are public, per the
 * health/contracts documentation.
 */

export interface MetricsCounters {
  requestCount: number;
  cacheHitCount: number;
  coalescedCount: number;
  failureCounts: Record<string, number>;
  /** Latency samples in ms. */
  latenciesMs: number[];
}

export interface MetricsState {
  /** Per-route counters, keyed by routeId. */
  readonly routes: Map<string, MetricsCounters>;
}

export const createMetricsState = (): MetricsState => ({
  routes: new Map(),
});

const ensureRouteCounters = (state: MetricsState, routeId: string): MetricsCounters => {
  let entry = state.routes.get(routeId);
  if (!entry) {
    entry = {
      requestCount: 0,
      cacheHitCount: 0,
      coalescedCount: 0,
      failureCounts: {},
      latenciesMs: [],
    };
    state.routes.set(routeId, entry);
  }
  return entry;
};

export const recordRequestStart = (state: MetricsState, routeId: string): void => {
  const counters = ensureRouteCounters(state, routeId);
  counters.requestCount += 1;
};

export const recordRequestEnd = (
  state: MetricsState,
  routeId: string,
  details: { cacheHit?: boolean; coalesced?: boolean; failureKind?: string; latencyMs?: number },
): void => {
  const counters = ensureRouteCounters(state, routeId);
  if (details.cacheHit) counters.cacheHitCount += 1;
  if (details.coalesced) counters.coalescedCount += 1;
  if (details.failureKind) {
    counters.failureCounts[details.failureKind] = (counters.failureCounts[details.failureKind] ?? 0) + 1;
  }
  if (typeof details.latencyMs === "number" && Number.isFinite(details.latencyMs) && details.latencyMs >= 0) {
    counters.latenciesMs.push(Math.min(details.latencyMs, 600_000));
    if (counters.latenciesMs.length > 1024) counters.latenciesMs.shift();
  }
};

const percentile = (sorted: ReadonlyArray<number>, fraction: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(fraction * (sorted.length - 1))));
  return sorted[index]!;
};

const routeMetricsFor = (routeId: string, counters: MetricsCounters): RouteMetrics => {
  const sorted = counters.latenciesMs.slice().sort((a, b) => a - b);
  // Trim failure counts to the contract's max-32 ceiling.
  const failureCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(counters.failureCounts).slice(0, 32)) {
    failureCounts[k] = v;
  }
  return routeMetricsSchema.parse({
    routeId,
    requestCount: counters.requestCount,
    cacheHitCount: counters.cacheHitCount,
    coalescedCount: counters.coalescedCount,
    failureCounts,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
  });
};

/** Build a full MetricsResponse from the in-memory state. We accept
 *  the gateway's breaker snapshots so /metrics can surface breaker
 *  state without leaking the underlying CircuitBreaker instance. */
export interface SnapshotBreaker {
  targetId: string;
  routeId: string;
  state: "closed" | "open" | "half-open";
  samples: number;
  errors: number;
  openedAt: number;
}

/**
 * GHA-NEXT-035 — drain counters, surfaced on /metrics so operators
 * can see drain pressure and child hard-timeout events without
 * scraping logs. The shape mirrors `Lifecycle.drainCounters()`.
 */
export interface DrainCountersSnapshot {
  drainInitiatedTotal: number;
  drainCompletedTotal: number;
  drainTimeoutTotal: number;
  childHardTimeoutTotal: number;
}

/** Default empty counters — used by /metrics when no drain has run. */
export const emptyDrainCounters = (): DrainCountersSnapshot => ({
  drainInitiatedTotal: 0,
  drainCompletedTotal: 0,
  drainTimeoutTotal: 0,
  childHardTimeoutTotal: 0,
});

export const buildMetricsResponse = (input: {
  state: MetricsState;
  manifestVersion: number;
  breakers: ReadonlyArray<SnapshotBreaker>;
  /**
   * Cross-instance breaker snapshots (GHA-NEXT-028). When supplied
   * the merged list is used; when omitted the local `breakers` are
   * the source of truth.
   */
  sharedBreakers?: ReadonlyArray<SnapshotBreaker>;
  /** GHA-NEXT-035 — drain + child hard-timeout counters from
   *  `Lifecycle.drainCounters()`. When omitted, all-zero defaults
   *  are surfaced. The shape is preserved as-is in the response so
   *  consumers can bind to it. */
  drainCounters?: DrainCountersSnapshot;
  now?: Date;
}): MetricsResponse => {
  const now = input.now ?? new Date();
  const routes: RouteMetrics[] = [];
  for (const [routeId, counters] of input.state.routes.entries()) {
    routes.push(routeMetricsFor(routeId, counters));
  }
  // Merge local + shared; local wins on targetId collisions.
  const merged = input.sharedBreakers
    ? mergeBreakerSnapshots(input.breakers, input.sharedBreakers)
    : input.breakers;
  const breakers: BreakerSnapshot[] = merged.map((entry) => breakerSnapshotSchema.parse({
    targetId: entry.targetId,
    routeId: entry.routeId,
    state: entry.state,
    samples: entry.samples,
    errors: entry.errors,
    openedAt: entry.openedAt,
  }));
  const counters = input.drainCounters ?? emptyDrainCounters();
  return metricsResponseSchema.parse({
    contractVersion: 1,
    manifestVersion: input.manifestVersion,
    capturedAt: now.toISOString(),
    routes: routes.slice(0, 1024),
    breakers: breakers.slice(0, 1024),
    drainInitiatedTotal: counters.drainInitiatedTotal,
    drainCompletedTotal: counters.drainCompletedTotal,
    drainTimeoutTotal: counters.drainTimeoutTotal,
    childHardTimeoutTotal: counters.childHardTimeoutTotal,
  });
};

/** Merge two breaker-snapshot arrays. Local entries win on `targetId`
 *  collision so the /metrics endpoint reflects the truth on the
 *  current instance first; remote snapshots fill in any other-instance
 *  breakers. GHA-NEXT-028. */
const mergeBreakerSnapshots = (
  local: ReadonlyArray<SnapshotBreaker>,
  shared: ReadonlyArray<SnapshotBreaker>,
): ReadonlyArray<SnapshotBreaker> => {
  const byTarget = new Map<string, SnapshotBreaker>();
  for (const entry of local) byTarget.set(entry.targetId, entry);
  for (const entry of shared) if (!byTarget.has(entry.targetId)) byTarget.set(entry.targetId, entry);
  return Array.from(byTarget.values());
};

/**
 * GHA-NEXT-037.3 — Prometheus text-format exporter.
 *
 * Renders the in-memory metrics state into the well-known Prometheus
 * text exposition format so an external scrape job (Prometheus server
 * or a sidecar like grafana-agent) can ingest gateway counters without
 * pulling in the prom-client library.
 *
 *   - `gateway_request_total{route_id,result} counter` — total requests
 *     per route, split by result (ok / cache_hit / coalesced / failure).
 *   - `gateway_circuit_breaker_state{target_id,route_id} gauge`
 *     (0=closed, 1=half-open, 2=open) — current breaker state per target.
 *   - `gateway_backpressure{route_id,kind} counter` — backpressure
 *     rejections and queue rejects per route (mapped from the
 *     `queue_full` / `backpressure` failure kinds).
 *
 * The exporter deliberately uses plain text (no JSON, no TSDB framing)
 * to stay compatible with the Prometheus 0.0.4 text exposition format.
 * Latency percentiles are NOT exposed here because Prometheus ingests
 * histograms, not pre-computed percentiles — operators can derive p99
 * via `histogram_quantile` once the histogram instrumentation lands
 * (see backlog; not in scope for GHA-NEXT-037.3).
 */
export const renderPrometheusText = (input: {
  state: MetricsState;
  manifestVersion: number;
  breakers: ReadonlyArray<SnapshotBreaker>;
  sharedBreakers?: ReadonlyArray<SnapshotBreaker>;
}): string => {
  const lines: string[] = [];
  lines.push("# HELP gateway_request_total Total gateway requests by route and result.");
  lines.push("# TYPE gateway_request_total counter");
  const merged = input.sharedBreakers
    ? mergeBreakerSnapshots(input.breakers, input.sharedBreakers)
    : input.breakers;

  for (const [routeId, counters] of input.state.routes.entries()) {
    const safeRouteId = prometheusEscape(routeId);
    const okCount = Math.max(0, counters.requestCount - counters.cacheHitCount - counters.coalescedCount);
    lines.push(`gateway_request_total{route_id="${safeRouteId}",result="ok"} ${okCount}`);
    if (counters.cacheHitCount > 0) {
      lines.push(`gateway_request_total{route_id="${safeRouteId}",result="cache_hit"} ${counters.cacheHitCount}`);
    }
    if (counters.coalescedCount > 0) {
      lines.push(`gateway_request_total{route_id="${safeRouteId}",result="coalesced"} ${counters.coalescedCount}`);
    }
    for (const [kind, count] of Object.entries(counters.failureCounts)) {
      if (!count) continue;
      const safeKind = prometheusEscape(kind);
      lines.push(`gateway_request_total{route_id="${safeRouteId}",result="failure",failure_kind="${safeKind}"} ${count}`);
    }
  }

  lines.push("# HELP gateway_circuit_breaker_state Current circuit breaker state per target (0=closed 1=half-open 2=open).");
  lines.push("# TYPE gateway_circuit_breaker_state gauge");
  for (const breaker of merged) {
    const stateValue = breaker.state === "closed" ? 0 : breaker.state === "half-open" ? 1 : 2;
    lines.push(
      `gateway_circuit_breaker_state{target_id="${prometheusEscape(breaker.targetId)}",route_id="${prometheusEscape(breaker.routeId)}"} ${stateValue}`,
    );
  }

  lines.push("# HELP gateway_backpressure Backpressure events by route and kind.");
  lines.push("# TYPE gateway_backpressure counter");
  for (const [routeId, counters] of input.state.routes.entries()) {
    const safeRouteId = prometheusEscape(routeId);
    const queueFull = counters.failureCounts["queue_full"] ?? 0;
    const backpressure = counters.failureCounts["backpressure"] ?? 0;
    if (queueFull > 0) {
      lines.push(`gateway_backpressure{route_id="${safeRouteId}",kind="queue_full"} ${queueFull}`);
    }
    if (backpressure > 0) {
      lines.push(`gateway_backpressure{route_id="${safeRouteId}",kind="rejected"} ${backpressure}`);
    }
  }

  lines.push("# HELP gateway_manifest_version Current routes manifest version.");
  lines.push("# TYPE gateway_manifest_version gauge");
  lines.push(`gateway_manifest_version ${input.manifestVersion}`);

  return lines.join("\n") + "\n";
};

/** Escape a label value per the Prometheus text exposition format
 *  spec: backslash, double-quote, and newline must be escaped. */
const prometheusEscape = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
