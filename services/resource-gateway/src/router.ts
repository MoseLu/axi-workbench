import type { AdapterSearchResult, CacheKey, Intent, ProviderFailure } from "@axi/gateway-contracts";
import { gatewayErrorCodeForKind, hashCacheKey, makeProviderFailure } from "@axi/gateway-contracts";
import type { BackpressureRegistry, CoalescingRegistry, GatewayOrchestrator, SharedStateManager, VersionedCache } from "@axi/resource-orchestrator";

import type { MetricsState, SnapshotBreaker } from "./metrics.js";
import { recordRequestEnd, recordRequestStart } from "./metrics.js";
import { deriveCapabilities } from "./routes.js";

/**
 * GHA-NEXT-007 / GHA-NEXT-008 — router that wraps GatewayOrchestrator
 * with manifest-versioned policy wiring.
 *
 * Stage 1.5 Gate: cache/coalescing single-track. The router no longer
 * keeps its own `this.cache` Map or `this.inFlight` Map. HTTP-edge
 * cache reads/writes flow through the orchestrator's `VersionedCache`
 * (manifest-versioned store); HTTP-edge in-flight coalescing flows
 * through the orchestrator's `CoalescingRegistry`. When either is
 * wired, the orchestrator is the single owner; when neither is wired
 * (legacy test stubs / pre-composition bootstrapping) the router
 * degrades to a stateless pass-through (no cache, no coalescing).
 *
 * The router owns:
 *   - metrics counters (request count, cache hit, coalesced, latency),
 *   - the typed-failure → ErrorEnvelope mapping,
 *   - per-caller abort isolation (the orchestrator's coalescing
 *     registry tracks shared work, but per-caller aborts are handled
 *     here so one cancelling caller does NOT cancel the shared work).
 *
 * Tests inject a stub gateway; production wires the real one together
 * with the orchestrator's `versionedCache` and `coalescing` accessors.
 *
 * Coalesced-caller cancellation contract (GHA-090 / lane instruction):
 *   - The orchestrator's `CoalescingRegistry` is the single owner of
 *     in-flight state. Concurrent identical requests share one
 *     orchestrator dispatch via `register()`, which automatically
 *     joins subsequent callers.
 *   - The shared dispatch ALWAYS runs with an internal AbortController
 *     that is NOT directly tied to any single caller's signal. A
 *     caller's `abort()` therefore does NOT cancel the underlying
 *     dispatch — the shared work keeps running until the orchestrator
 *     itself decides to stop (timeout, backpressure, breaker).
 *   - Each caller races its own signal against the shared promise so
 *     the caller's own await short-circuits on cancellation, but the
 *     shared promise and other coalesced callers are unaffected.
 *   - The caller-abort outcome is mapped to a typed ProviderFailure
 *     with `kind: "cancelled"`, never to "provider_error" or "retry".
 */

export interface RouterOptions {
  /** Mutable so the reload path (GHA-NEXT-036) can atomically swap
   *  the orchestrator reference after a successful manifest rebuild.
   *  Direct writes outside of `replaceGateway()` are unsupported. */
  gateway: GatewayOrchestrator;
  readonly manifestVersion: number;
  readonly metrics: MetricsState;
  /**
   * Cache TTL in ms. Defaults to 60_000. Set to 0 to disable HTTP-edge
   * cache writes (the router still reads through the orchestrator's
   * VersionedCache; with TTL=0 no new entries are inserted).
   *
   * Forwarded to the orchestrator's VersionedCache as the route TTL.
   * The router no longer keeps a private Map — the orchestrator owns
   * TTL policy for HTTP-edge cache reads/writes.
   */
  readonly cacheTtlMs?: number;
  /** Negative cache TTL in ms. Defaults to 5_000. Forwarded to the
   *  orchestrator's VersionedCache for empty-result entries. */
  readonly negativeTtlMs?: number;
  /** Max cached entries per route. Defaults to 256. Forwarded to the
   *  orchestrator's VersionedCache as `configure(routeId, …)` on
   *  first dispatch for that route. */
  readonly maxCacheEntries?: number;
  /** Clock factory for deterministic latency tests. */
  readonly now?: () => number;
  /**
   * Optional SharedStateManager — when supplied, `sharedBreakerSnapshots()`
   * reads cross-instance breaker state from
   * `sharedState.breaker.snapshotAll()` and merges with the local
   * orchestrator breakers. The local breakers always win for the
   * own-instance targetId so /metrics reflects the truth on this node.
   *
   * GHA-NEXT-028 — Phase D / P0.
   */
  readonly sharedState?: SharedStateManager;
  /**
   * GHA-NEXT-007 — orchestrator's VersionedCache. When supplied, the
   * router reads cache hits through this store and writes dispatched
   * results back into it. When absent (legacy stubs / pre-composition)
   * the router dispatches every request as a cache miss with no
   * writeback (HTTP-edge cache is unavailable in that mode).
   *
   * Stage 1.5 Gate: the router no longer keeps a local `this.cache`
   * Map. The orchestrator's VersionedCache is the single owner of
   * HTTP-edge cache state.
   */
  readonly versionedCache?: VersionedCache;
  /**
   * GHA-NEXT-008 — orchestrator's CoalescingRegistry. When supplied,
   * the router registers / joins shared in-flight dispatches through
   * this registry. Per-caller abort isolation stays in the router so
   * one cancelling caller does not cancel the shared work. When
   * absent (legacy stubs / pre-composition) the router dispatches
   * every request independently (no coalescing).
   *
   * Stage 1.5 Gate: the router no longer keeps a local `this.inFlight`
   * Map. The orchestrator's CoalescingRegistry is the single owner
   * of in-flight state.
   */
  readonly coalescing?: CoalescingRegistry;
  /**
   * GHA-NEXT-018 — orchestrator's BackpressureRegistry. The
   * reload path forwards it across reloads so manifest bumps do
   * not reset the per-route backpressure state. When absent the
   * router's dispatch path falls back to the orchestrator's
   * per-instance backpressure (which is always present).
   */
  readonly backpressure?: BackpressureRegistry;
}

export interface RouterDispatchInput {
  readonly intent: Intent;
  readonly toolId: string;
  readonly signal: AbortSignal;
  readonly requestKey: string;
  /** Manifest version observed by the caller; defaults to manifestVersion. */
  readonly manifestVersion?: number;
  /** Optional routeId (used as cache key prefix). Defaults to toolId. */
  readonly routeId?: string;
}

export interface RouterDispatchFailure {
  readonly kind: "failure";
  readonly failure: ProviderFailure;
}

export interface RouterDispatchSuccess {
  readonly kind: "success";
  readonly result: AdapterSearchResult;
  readonly fromCache: boolean;
}

export type RouterDispatchOutcome = RouterDispatchSuccess | RouterDispatchFailure;

/**
 * Safe projection of the orchestrator's route table for `/routes`
 * and `/metrics` consumers. The shape deliberately omits adapter
 * instances, target URLs, provider payloads, query text, secrets,
 * and environment variables.
 */
export interface RouteRegistryEntry {
  readonly id: string;
  readonly toolId: string;
  readonly description: string;
  readonly targetIds: ReadonlyArray<string>;
  readonly loadBalancer: string;
  readonly capabilities: ReadonlyArray<string>;
  /** Predicate ids from the manifest (GHA-NEXT-002). */
  readonly predicates: ReadonlyArray<string>;
}

const buildKey = (input: {
  routeId: string;
  manifestVersion: number;
  intent: Intent;
  requestKey: string;
}): CacheKey => ({
  scope: "route-payload",
  routeId: input.routeId,
  manifestVersion: input.manifestVersion,
  hash: hashCacheKey(`${input.manifestVersion}|${input.requestKey}|${stablePayloadString(input.intent)}`),
});

const stablePayloadString = (intent: Intent): string => {
  const constraints = intent.constraints || {};
  const keys = Object.keys(constraints).sort();
  const parts = keys.map((key) => `${key}=${stableStringify(constraints[key])}`);
  parts.push(`kinds=${(intent.resourceKinds || []).slice().sort().join(",")}`);
  return parts.join(";");
};

const stableStringify = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${k}:${stableStringify(v)}`).join(",")}}`;
  }
  return String(value);
};

export class GatewayRouter {
  private readonly cacheTtlMs: number;
  private readonly negativeTtlMs: number;
  private readonly maxCacheEntries: number;
  /** Track routes we've already configured on the wired VersionedCache
   *  so we don't re-`configure` the same route on every dispatch. */
  private readonly configuredRoutes = new Set<string>();

  constructor(private readonly options: RouterOptions) {
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.negativeTtlMs = options.negativeTtlMs ?? 5_000;
    this.maxCacheEntries = options.maxCacheEntries ?? 256;
  }

  /** Read-only access to the underlying orchestrator. Used by tests
   *  and by the reload path to verify the swap took effect. */
  currentGateway(): GatewayOrchestrator {
    return this.options.gateway;
  }

  /** GHA-NEXT-036 — Atomically swap the orchestrator reference.
   *  Callers MUST have built the new orchestrator outside of this
   *  method (so a failed build does not partially swap). The swap
   *  is synchronous and synchronous reads of `currentGateway()`
   *  after this call observe the new reference. The configured-routes
   *  set is preserved on purpose — re-configuring a route that the
   *  new orchestrator's VersionedCache already knows about is
   *  idempotent (we still skip the call). */
  replaceGateway(next: GatewayOrchestrator): void {
    this.options.gateway = next;
  }

  /**
   * GHA-NEXT-040 — pass-through accessors for the reload path.
   * `reloadRoutesAndSwap` in server.ts needs to forward the
   * in-process registries (versionedCache, coalescing,
   * backpressure) to the new orchestrator so a manifest bump
   * does not reset their state. Exposing them through the router
   * keeps the swap atomic from the caller's point of view.
   */
  get versionedCache(): VersionedCache | undefined {
    return this.options.versionedCache;
  }
  get coalescing(): CoalescingRegistry | undefined {
    return this.options.coalescing;
  }
  get backpressure(): BackpressureRegistry | undefined {
    return this.options.backpressure;
  }

  /** GHA-NEXT-036 — Flush the HTTP-edge cache. Used by the reload
   *  path so stale entries don't linger if the new manifest version
   *  is identical (e.g. an idempotent reload). The manifest-version
   *  bump is the canonical invalidation signal; this manual flush
   *  makes idempotent reloads safe.
   *
   *  GHA-NEXT-007 — flushes the orchestrator's VersionedCache. The
   *  router no longer owns a private cache Map, so there is nothing
   *  else to clear. */
  flushCache(): void {
    this.options.versionedCache?.clear();
  }

  /**
   * Dispatch one request. The router picks the cache + coalescing
   * strategy, increments metrics, and converts ProviderFailure into a
   * typed envelope. Callers (the HTTP layer) translate that envelope
   * into the wire-format ErrorEnvelope.
   *
   * Stage 1.5 Gate: cache reads/writes flow through
   * `this.options.versionedCache` (when wired) and coalescing flows
   * through `this.options.coalescing` (when wired). The router no
   * longer keeps local Map state.
   */
  async dispatch(input: RouterDispatchInput): Promise<RouterDispatchOutcome> {
    const start = this.now();
    const routeId = input.routeId ?? input.toolId;
    const manifestVersion = input.manifestVersion ?? this.options.manifestVersion;
    recordRequestStart(this.options.metrics, routeId);

    const cacheKey = buildKey({ routeId, manifestVersion, intent: input.intent, requestKey: input.requestKey });
    if (this.cacheTtlMs > 0) {
      // GHA-NEXT-007 — read the orchestrator's VersionedCache when
      // wired. When the orchestrator owns the manifest-versioned
      // store, dispatch reads MUST hit it so cross-instance
      // invalidation works as the single source of truth. Without a
      // wired cache the dispatch path falls through to a real
      // dispatch (no HTTP-edge caching).
      const cached = this.readVersionedCache(cacheKey);
      if (cached) {
        recordRequestEnd(this.options.metrics, routeId, { cacheHit: true, latencyMs: 0 });
        return { kind: "success", result: cached, fromCache: true };
      }
    }

    // Detach the caller's signal so a single caller cancelling does
    // NOT tear down the shared work. The underlying dispatch runs
    // with an internal AbortController that is forwarded the caller's
    // signal ONLY for the dispatch duration — but the shared promise
    // we hand to coalesced callers resolves based on the orchestrator's
    // own completion, not on caller cancellation. The
    // raceWithCallerAbort wrapper handles the caller's local cancel.
    // CRITICAL: the internal AbortController is INDEPENDENT of any
    // single caller's signal. We NEVER wire a caller-signal abort
    // listener into it. The orchestrator decides when to stop the
    // shared work (timeout, backpressure, breaker), and per-caller
    // cancellation is handled by `raceWithCallerAbort` below.
    const internalController = new AbortController();

    let sharedPromise: Promise<AdapterSearchResult>;
    let ownsSharedPromise: boolean;
    if (this.options.coalescing) {
      // GHA-NEXT-008 — single-track coalescing via the orchestrator's
      // CoalescingRegistry. `register()` is a join-or-start primitive:
      // the first caller for a key starts the dispatch, subsequent
      // concurrent callers automatically share the same promise. The
      // registry cleans itself up when the promise settles.
      ownsSharedPromise = false;
      const coalesceKey = {
        routeId,
        idempotencyKey: `${routeId}|${input.requestKey}|${manifestVersion}`,
        manifestVersion,
      };
      // `register` joins an existing in-flight entry when one exists;
      // we detect that via `shareCount` so we can apply the per-caller
      // abort race to coalesced callers (matching the dual-track
      // semantics callers expect from the contract).
      const existingShare = this.options.coalescing.shareCount(coalesceKey);
      sharedPromise = this.options.coalescing.register(
        coalesceKey,
        () => this.options.gateway.dispatch({
          intent: input.intent,
          toolId: input.toolId,
          signal: internalController.signal,
          requestKey: input.requestKey,
        }),
      );
      if (existingShare > 0) {
        // Coalesced caller path — mirror the dual-track behaviour:
        // record the coalesced metric and race the shared promise
        // against this caller's signal. The shared controller is NOT
        // touched — a single caller's abort does not affect other
        // coalesced callers or the underlying dispatch.
        recordRequestEnd(this.options.metrics, routeId, { coalesced: true });
        try {
          const result = await raceWithCallerAbort(sharedPromise, input.signal);
          const latencyMs = this.now() - start;
          recordRequestEnd(this.options.metrics, routeId, { latencyMs });
          return { kind: "success", result, fromCache: false };
        } catch (error) {
          if (isCallerAbortError(input.signal)) {
            const latencyMs = this.now() - start;
            const failure = makeProviderFailure({
              kind: "cancelled",
              message: "request aborted by client",
              targetId: routeId,
              routeId,
              attempt: 1,
            });
            recordRequestEnd(this.options.metrics, routeId, { failureKind: failure.kind, latencyMs });
            return { kind: "failure", failure };
          }
          const latencyMs = this.now() - start;
          const failure = normaliseFailure(error, routeId, 1);
          recordRequestEnd(this.options.metrics, routeId, { failureKind: failure.kind, latencyMs });
          return { kind: "failure", failure };
        }
      }
      // First caller for this coalesce key — we own the shared
      // promise for the duration of the dispatch; the registry's
      // finally handler removes the entry on settlement.
      ownsSharedPromise = true;
    } else {
      // No CoalescingRegistry wired — every dispatch is independent.
      sharedPromise = this.options.gateway.dispatch({
        intent: input.intent,
        toolId: input.toolId,
        signal: internalController.signal,
        requestKey: input.requestKey,
      });
      ownsSharedPromise = true;
    }

    try {
      const result = await raceWithCallerAbort(sharedPromise, input.signal);
      const latencyMs = this.now() - start;
      recordRequestEnd(this.options.metrics, routeId, { latencyMs });
      // GHA-NEXT-007 — write through the orchestrator's VersionedCache
      // when wired. The orchestrator owns TTL/negative-TTL/route-cap
      // policy; the router just forwards the configured values. With
      // no versioned cache wired (test stubs / pre-composition), the
      // HTTP-edge cache is unavailable and we skip the write.
      if (this.cacheTtlMs > 0) {
        this.writeVersionedCache(cacheKey, result);
      }
      return { kind: "success", result, fromCache: false };
    } catch (error) {
      if (isCallerAbortError(input.signal)) {
        const latencyMs = this.now() - start;
        const failure = makeProviderFailure({
          kind: "cancelled",
          message: "request aborted by client",
          targetId: routeId,
          routeId,
          attempt: 1,
        });
        recordRequestEnd(this.options.metrics, routeId, { failureKind: failure.kind, latencyMs });
        return { kind: "failure", failure };
      }
      const latencyMs = this.now() - start;
      const failure = normaliseFailure(error, routeId, 1);
      recordRequestEnd(this.options.metrics, routeId, { failureKind: failure.kind, latencyMs });
      return { kind: "failure", failure };
    } finally {
      // If we own the shared dispatch and the caller aborted while
      // it was still pending, free the underlying orchestrator call.
      // Coalesced callers do not own the controller — they raced
      // against the shared promise and never touched it.
      if (ownsSharedPromise && !internalController.signal.aborted && input.signal.aborted) {
        internalController.abort();
      }
    }
  }

  /** Diagnostic: number of cache entries the HTTP edge observes.
   *  Delegates to the orchestrator's VersionedCache when wired; returns
   *  0 when no versioned cache is wired (the router no longer keeps
   *  a private Map). Used by /metrics consumers and tests. */
  cacheSize(): number {
    return this.options.versionedCache?.size() ?? 0;
  }

  /**
   * Snapshot every circuit breaker the orchestrator has registered.
   * Returns one `SnapshotBreaker` per `target.id` using the
   * orchestrator's `breakers` map (keyed on target id, shared across
   * routes that target the same adapter). The projection is
   * contract-shaped: only `state / samples / errors / openedAt` are
   * exposed; the underlying `CircuitBreaker` instance stays private
   * to the orchestrator package.
   *
   * Targets that have not been observed yet yield an empty array;
   * the orchestrator lazily allocates breakers on first dispatch.
   *
   * GHA-NEXT-028: when a SharedStateManager is wired, the existing
   * /metrics endpoint automatically reflects cross-instance breaker
   * state via `sharedBreakerSnapshots()`; this method is the
   * local-only accessor for tests and the composition root.
   */
  breakerSnapshots(): ReadonlyArray<SnapshotBreaker> {
    const orchestratorBreakers = this.readOrchestratorBreakers();
    if (!orchestratorBreakers) return [];
    const snapshots: SnapshotBreaker[] = [];
    for (const [targetId, breaker] of orchestratorBreakers.entries()) {
      const snap = readBreakerSnapshot(breaker);
      if (!snap) continue;
      const routeId = this.findRouteIdForTarget(targetId) ?? targetId;
      snapshots.push({
        targetId,
        routeId,
        state: snap.state,
        samples: snap.samples,
        errors: snap.errors,
        openedAt: snap.openedAt,
      });
    }
    return snapshots;
  }

  /**
   * Cross-instance breaker snapshot view (GHA-NEXT-028).
   *
   * Returns the merged set of:
   *   - local orchestrator breakers (authoritative for own-instance),
   *   - shared-state breaker snapshots from other instances
   *     (cross-instance, eventually consistent within
   *     `config.propagationMs`).
   *
   * Local breakers always win on `targetId` collisions so the
   * /metrics response reflects truth on the current node first.
   *
   * When `sharedState` is absent or its breaker is `isAvailable()===false`
   * the local set is returned unchanged.
   */
  sharedBreakerSnapshots(): ReadonlyArray<SnapshotBreaker> {
    const local = this.breakerSnapshots();
    const shared = this.options.sharedState;
    if (!shared) return local;
    if (!shared.breaker.isAvailable()) return local;
    const remoteMap = shared.breaker.snapshotAll();
    if (!remoteMap.size) return local;
    const byTarget = new Map<string, SnapshotBreaker>();
    for (const entry of local) byTarget.set(entry.targetId, entry);
    for (const [targetId, snapshot] of remoteMap) {
      if (byTarget.has(targetId)) continue;
      const routeId = this.findRouteIdForTarget(targetId) ?? targetId;
      byTarget.set(targetId, {
        targetId,
        routeId,
        state: snapshot.state,
        samples: snapshot.samples,
        errors: snapshot.errors,
        openedAt: snapshot.openedAt,
      });
    }
    return Array.from(byTarget.values());
  }

  /**
   * Safe projection of the orchestrator's route table for `/routes`
   * and `/metrics` consumers. The shape deliberately omits adapter
   * instances, target URLs, provider payloads, query text, secrets,
   * and environment variables.
   *
   * GHA-NEXT-002 fix: `capabilities` is populated by calling
   * `deriveCapabilities(toolId)` so the projection is never empty
   * for a matched toolId pattern. `predicates` carries the manifest
   * predicate ids (string only — no adapter/URL/secret/query).
   */
  routeRegistry(): ReadonlyArray<RouteRegistryEntry> {
    return this.safeRouteList().map((route) => ({
      id: route.id,
      toolId: route.toolId,
      description: route.description,
      targetIds: route.targets.map((target) => target.id),
      loadBalancer: route.loadBalancer,
      capabilities: deriveCapabilities(route.toolId),
      predicates: route.predicates,
    }));
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  /**
   * GHA-NEXT-007 — read through the orchestrator's VersionedCache.
   * The versioned store handles manifest-version invalidation
   * natively via `(routeId, manifestVersion, scope, hash)` keys,
   * so the router just forwards the cache key. Empty/negative-TTL
   * bookkeeping lives in `runtime/cache.ts` `set`. Returns `null`
   * when no VersionedCache is wired — the dispatch path then falls
   * through to a real orchestrator dispatch.
   */
  private readVersionedCache(key: CacheKey): AdapterSearchResult | null {
    const primary = this.options.versionedCache;
    if (!primary) return null;
    const entry = primary.get(key, this.now());
    if (!entry) return null;
    return entry.result;
  }

  /**
   * GHA-NEXT-007 — write through the orchestrator's VersionedCache.
   * The router passes its configured `cacheTtlMs` / `negativeTtlMs`
   * for the route so the versioned store applies the same TTL
   * semantics as the dual-track Map used to. The per-route cap
   * (`maxCacheEntries`) is configured on the cache the first time
   * we observe a route — `configure` is idempotent.
   */
  private writeVersionedCache(key: CacheKey, result: AdapterSearchResult): void {
    const primary = this.options.versionedCache;
    if (!primary) return;
    if (!this.configuredRoutes.has(key.routeId)) {
      primary.configure(key.routeId, this.maxCacheEntries);
      this.configuredRoutes.add(key.routeId);
    }
    primary.set(key, result, { ttlMs: this.cacheTtlMs, negativeTtlMs: this.negativeTtlMs }, this.now());
  }

  /**
   * Read the orchestrator's breaker registry without importing the
   * `@axi/resource-orchestrator` private types. The orchestrator
   * exposes `GatewayOrchestrator.breakers` as `Map<string, unknown>`
   * (the value type is `CircuitBreaker`). We accept any object whose
   * `.entries()` yields `[string, { snapshot(): unknown }]` pairs so
   * future orchestrator refactors do not break this lane.
   */
  private readOrchestratorBreakers(): Map<string, unknown> | null {
    const gateway = this.options.gateway as unknown as {
      breakers?: { entries(): Iterable<[string, unknown]> };
    };
    if (!gateway || !gateway.breakers) return null;
    const collected = new Map<string, unknown>();
    for (const [id, breaker] of gateway.breakers.entries()) {
      collected.set(id, breaker);
    }
    return collected;
  }

  /**
   * Resolve a route id for a given target id by walking the route
   * table. Used by `breakerSnapshots` so the projected snapshot
   * carries the contract-required `routeId` even though the
   * orchestrator registers breakers per target (not per route).
   */
  private findRouteIdForTarget(targetId: string): string | null {
    const routes = this.safeRouteList();
    for (const route of routes) {
      for (const target of route.targets) {
        if (target.id === targetId) return route.id;
      }
    }
    return null;
  }

  /**
   * Walk the orchestrator's `listRoutes()` defensively. Tests inject
   * stub gateways whose `listRoutes` may return `[]` or omit fields,
   * so we tolerate both. The result is normalised into a shape we can
   * safely publish through `/routes` and `/metrics`.
   *
   * GHA-NEXT-002 fix: `predicates` is extracted from the route's
   * `predicates` array (which the orchestrator stores as
   * `ReadonlyArray<Predicate>`, each with a string `id`). Only the
   * id strings are included — no predicate objects, adapters, URLs,
   * or secrets.
   */
  private safeRouteList(): ReadonlyArray<{
    id: string;
    toolId: string;
    description: string;
    targets: ReadonlyArray<{ id: string }>;
    loadBalancer: string;
    predicates: ReadonlyArray<string>;
  }> {
    const gateway = this.options.gateway as unknown as {
      listRoutes?: () => ReadonlyArray<{
        id?: unknown;
        toolId?: unknown;
        description?: unknown;
        targets?: ReadonlyArray<{ id?: unknown }>;
        loadBalancer?: unknown;
        predicates?: ReadonlyArray<{ id?: unknown } | string>;
      }>;
    };
    const raw = typeof gateway.listRoutes === "function" ? gateway.listRoutes() : [];
    return raw.map((route) => ({
      id: typeof route.id === "string" ? route.id : "",
      toolId: typeof route.toolId === "string" ? route.toolId : "",
      description: typeof route.description === "string" ? route.description : "",
      targets: Array.isArray(route.targets)
        ? route.targets.map((target) => ({ id: typeof target.id === "string" ? target.id : "" }))
        : [],
      loadBalancer: typeof route.loadBalancer === "string" ? route.loadBalancer : "round-robin",
      predicates: extractPredicateIds(route.predicates),
    }));
  }
}

/**
 * Map any error thrown by the orchestrator into a typed ProviderFailure.
 * Caller-abort errors are deliberately NOT routed through this helper —
 * `raceWithCallerAbort` produces synthetic AbortError objects that the
 * dispatch wrapper short-circuits before `normaliseFailure` is reached,
 * so we never classify a client cancellation as `provider_error`,
 * `timeout`, or `internal`.
 */
const normaliseFailure = (error: unknown, routeId: string, attempt: number): ProviderFailure => {
  if (error && typeof error === "object" && "kind" in error && "code" in error && "targetId" in error) {
    return error as ProviderFailure;
  }
  const message = error instanceof Error ? error.message : String(error);
  const cancelled = /abort(ed)?/iu.test(message);
  const kind = cancelled ? "cancelled" : /timeout/iu.test(message) ? "timeout" : "internal";
  return makeProviderFailure({
    kind,
    message: message.slice(0, 400),
    targetId: routeId,
    routeId,
    attempt,
  });
};

/**
 * Race the shared promise against the caller's abort signal. If the
 * caller aborts, we return a synthetic abort error WITHOUT rejecting
 * the shared promise (the underlying dispatch keeps running until it
 * resolves on its own or the orchestrator's own timeout/backpressure
 * fires). If the shared promise resolves first, the caller's signal
 * is ignored — which is the right behaviour because the work the
 * caller was waiting for already finished.
 */
const raceWithCallerAbort = async <T>(
  shared: Promise<T>,
  callerSignal: AbortSignal,
): Promise<T> => {
  if (!callerSignal || callerSignal.aborted) {
    throw makeAbortError(callerSignal?.reason);
  }
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (typeof callerSignal.removeEventListener === "function") {
        callerSignal.removeEventListener("abort", onAbort);
      }
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(makeAbortError(callerSignal.reason));
    };
    if (callerSignal.aborted) {
      onAbort();
      return;
    }
    if (typeof callerSignal.addEventListener === "function") {
      callerSignal.addEventListener("abort", onAbort, { once: true });
    }
    shared.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
};

const makeAbortError = (reason: unknown): Error => {
  const error = new Error("request aborted by client");
  error.name = "AbortError";
  (error as Error & { code?: string }).code = "ABORT_ERR";
  if (reason !== undefined) (error as Error & { reason?: unknown }).reason = reason;
  return error;
};

const isCallerAbortError = (signal: AbortSignal | undefined): boolean => {
  if (!signal) return false;
  return signal.aborted === true;
};

/**
 * Read a `snapshot()` off a `CircuitBreaker`-shaped object. The
 * orchestrator's breaker exposes `snapshot()` returning
 * `{ state, samples, errors, openedAt, probeInFlight }`. We accept
 * any object that returns a compatible shape so future orchestrator
 * refactors do not break this lane. The `probeInFlight` field is
 * intentionally ignored — it is internal to the half-open single
 * probe invariant.
 */
const readBreakerSnapshot = (breaker: unknown): {
  state: "closed" | "open" | "half-open";
  samples: number;
  errors: number;
  openedAt: number;
} | null => {
  if (!breaker || typeof breaker !== "object") return null;
  const snap = (breaker as { snapshot?: () => unknown }).snapshot;
  if (typeof snap !== "function") return null;
  let raw: unknown;
  try { raw = snap.call(breaker); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const state = r.state;
  if (state !== "closed" && state !== "open" && state !== "half-open") return null;
  return {
    state,
    samples: typeof r.samples === "number" && r.samples >= 0 ? Math.floor(r.samples) : 0,
    errors: typeof r.errors === "number" && r.errors >= 0 ? Math.floor(r.errors) : 0,
    openedAt: typeof r.openedAt === "number" && r.openedAt >= 0 ? Math.floor(r.openedAt) : 0,
  };
};

/** Map a typed failure into a stable GatewayErrorCode (for the wire
 *  format and /metrics labels). */
export const errorCodeFor = (failure: ProviderFailure): string => gatewayErrorCodeForKind(failure.kind);

/**
 * Extract predicate ids from a route's predicates field.
 *
 * The orchestrator stores predicates as `ReadonlyArray<Predicate>` where
 * each `Predicate` has a string `id`. Some stub gateways (tests) may
 * store them as plain string arrays or a single string. We tolerate all
 * three shapes so the projection never throws on a defensively-
 * constructed stub.
 *
 * Shape tolerance:
 *   - `string`               → ["string"]
 *   - `string[]`            → string[] (filtered, non-strings removed)
 *   - `Predicate[]`         → id strings only (filtered, empty ids removed)
 *   - anything else         → []
 *
 * GHA-NEXT-002: only id strings are published; no predicate objects,
 * adapter references, URLs, or secrets appear in the projection.
 */
const extractPredicateIds = (
  raw: unknown,
): ReadonlyArray<string> => {
  // GHA-NEXT-002-fix: tolerate a single string by wrapping it.
  if (typeof raw === "string") return [raw];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && "id" in entry) {
        const id = (entry as Record<string, unknown>).id;
        return typeof id === "string" ? id : "";
      }
      return "";
    })
    .filter((id): id is string => id.length > 0);
};