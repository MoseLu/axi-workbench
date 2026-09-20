import type { AdapterSearchResult, Intent, ResourceAdapter, CacheScope } from "@axi/gateway-contracts";
import type { CacheEntry, Filter, RouteContext, RouteDefinition, Target } from "./route";
import { CircuitBreaker } from "./circuit-breaker";
import { composeFilters } from "./filters";
import { pickTarget, cachedHealthStatus } from "./load-balancer";
import { createContext } from "./context";
import type { HealthRegistry } from "./registries/health-registry";
import { classifyFailure, emptyResultFailure, isEmptyResult, shouldFallbackFor, summarizeFailure, type ProviderFailure } from "./runtime/failure";
import { deriveAbortSignal, abortable } from "./runtime/signal";
import { retryDecisionFor, scheduleRetry } from "./runtime/retry";
import { BackpressureRegistry, BackpressureTimeoutError, decisionFromError, type BackpressurePolicy } from "./runtime/backpressure";
import { CoalescingRegistry } from "./runtime/coalesce";
import { VersionedCache, buildCacheKey } from "./runtime/cache";
import type { CoalescingKey, CacheKey } from "@axi/gateway-contracts";
import type { SharedStateManager } from "./shared-state/shared-state-manager";
import { selectBestRoute, selectFallbackChain } from "./runtime/route-selection";

/**
 * Gateway dispatch — the gateway's only side-effectful function.
 *
 * Responsibilities (GHA-021 / GHA-031..039):
 *   1. Match a route for an intent and toolId via deterministic scoring
 *      (selectBestRoute). Higher score wins; ties break on
 *      predicate count then lexicographic id.
 *   2. Compose pre/post filter chains.
 *   3. Run a target through its per-target circuit breaker with the
 *      strict half-open single-probe invariant.
 *   4. Wrap each adapter call with a derived AbortSignal that fans in
 *      the caller's signal AND a per-target timeout. Cancellation of
 *      the caller propagates to the in-flight call; retry is gated on
 *      `failure.retryable && routeIdempotent`.
 *   5. Honour per-route retry/backoff policy via contracts/runtime.decideRetry.
 *   6. Honour per-route bounded concurrency + queue timeout via the
 *      BackpressureRegistry. When the queue is full or times out, the
 *      dispatcher rejects the call rather than piling on the provider.
 *   7. Fan out parallel calls for multi-target routes (concurrency > 1)
 *      using the same bounded semaphore.
 *   8. Coalesce concurrent identical requests via a per-gateway
 *      CoalescingRegistry so two callers sharing a requestKey share
 *      one in-flight adapter call.
 *   9. Cache results via a VersionedCache keyed on
 *      (routeId, manifestVersion, scope, payloadHash). Negative
 *      results use the route's `negativeTtlMs` so a sick provider
 *      isn't pounded.
 *  10. Walk the explicit fallback chain only AFTER the primary route
 *      has fully exhausted its target pool. Cancellation NEVER triggers
 *      a fallback.
 */

export interface DispatchOptions {
  intent: Intent;
  toolId: string;
  signal?: AbortSignal;
  cache: Map<string, CacheEntry> | VersionedCache;
  requestKey: string;
  /** Per-run breaker registry — kept by the caller so state outlives a single dispatch. */
  breakers?: Map<string, CircuitBreaker>;
  /** Explicit fallback chain (route ids). Optional; when present the
   *  dispatcher walks the chain after primary exhausts. */
  fallbackChain?: ReadonlyArray<string>;
  /** Route policy; when omitted the dispatcher uses safe defaults
   *  (1 retry, no backpressure cap, ttlMs=0). */
  policy?: DispatchPolicy;
  /** Per-gateway coalescing registry. Wired to GatewayOrchestrator.coalescing
   *  so identical adapter calls share one in-flight promise across dispatchers. */
  coalescing?: CoalescingRegistry;
  /** Per-route resolved policy map. GatewayOrchestrator precomputes
   *  this for every route id (primary + fallback) so each route
   *  inside the chain observes its OWN concurrency / timeout /
   *  retry / cacheTtlMs / coalescingKeyKind. When omitted the
   *  dispatcher falls back to a single shared `policy` for every
   *  route in the chain (legacy behaviour, preserved for direct
   *  callers that already pass `policy`). */
  policyByRoute?: ReadonlyMap<string, DispatchPolicy>;
  /** Optional VersionedCache; when set, the dispatcher mirrors its result into
   *  the versioned store at dispatch end so manifest-version invalidation
   *  works for callers that don't go through cacheStoreFilter. */
  versionedCache?: VersionedCache;
  /** Manifest version for cache invalidation. Defaults to 1. */
  manifestVersion?: number;
  /** Shared backpressure registry. When omitted the dispatcher
   *  instantiates a per-call registry, which means the queue depth
   *  never exceeds the policy — useful for tests but wrong for
   *  production. GatewayOrchestrator always passes a shared one. */
  backpressure?: BackpressureRegistry;
  /** GHA-NEXT-018 / 020 / 035 / 040 — cross-instance SharedStateManager
   *  threading. When supplied the dispatcher consults the five runtime
   *  stores (rate-limit / cache / idempotency / coalesce / breaker)
   *  BEFORE invoking any target adapter, and mirrors outcomes back so
   *  multiple gateway instances agree on circuit / quota / idempotency
   *  state. When omitted (legacy direct callers, tests) the dispatcher
   *  skips every sharedState call and behaves exactly as before — this
   *  preserves the no-shared-state local-only contract. */
  sharedState?: SharedStateManager;
  /** GHA-NEXT-037 — HealthRegistry used by `pickTarget` to drop
   *  ejected factories from the candidate pool. When absent the LB
   *  ignores ejection state (legacy behaviour). */
  healthRegistry?: HealthRegistry;
}

export interface DispatchPolicy {
  readonly retry: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
    readonly maxBackoffMs: number;
  };
  readonly backpressure: BackpressurePolicy;
  readonly timeoutMs: number;
  readonly cacheTtlMs: number;
  readonly negativeTtlMs: number;
  readonly maxCacheEntries: number;
  readonly idempotent: boolean;
  readonly cacheScope: CacheScope;
  readonly coalescingKeyKind: "idempotency" | "request-key" | "none";
}

const DEFAULT_POLICY: DispatchPolicy = {
  retry: { maxAttempts: 2, backoffMs: 50, maxBackoffMs: 500 },
  backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" },
  timeoutMs: 30_000,
  cacheTtlMs: 0,
  negativeTtlMs: 1_000,
  maxCacheEntries: 256,
  idempotent: true,
  cacheScope: "route-payload",
  coalescingKeyKind: "idempotency",
};

const legacyMapFor = (options: DispatchOptions): Map<string, CacheEntry> => {
  const supplied = options.cache;
  if (supplied instanceof VersionedCache) return supplied.asMap();
  return supplied;
};

const versionedCacheFor = (options: DispatchOptions): VersionedCache | undefined => {
  if (options.versionedCache) return options.versionedCache;
  if (options.cache instanceof VersionedCache) return options.cache;
  return undefined;
};

const coalescingKeyFor = (
  options: DispatchOptions,
  routeId: string,
  targetId: string,
): CoalescingKey => {
  // Stable per (routeId, targetId, manifestVersion, requestKey). Two
  // concurrent calls sharing all four fields join the same in-flight
  // adapter invocation. The `coalescingKeyKind` gate lives at the
  // call site, not in this helper, so "none" simply means we never
  // reach here for that route.
  return {
    routeId,
    idempotencyKey: `${routeId}|${targetId}|${options.manifestVersion || 1}|${options.requestKey}`,
    manifestVersion: options.manifestVersion || 1,
  };
};

/** Resolve the `DispatchPolicy` that applies to `routeId`. When
 *  `options.policyByRoute` is supplied by the caller (GatewayOrchestrator
 *  does this), we use the route-specific entry. Otherwise we fall back
 *  to a single shared `options.policy` for every route in the chain —
 *  this preserves the historical behaviour for direct callers that
 *  only know the primary route's policy. */
const policyForRouteId = (
  options: DispatchOptions,
  routeId: string,
): DispatchPolicy => {
  const perRoute = options.policyByRoute?.get(routeId);
  if (perRoute) return perRoute;
  return { ...DEFAULT_POLICY, ...(options.policy || {}) };
};

const breakerFor = (options: DispatchOptions, target: Target, config?: RouteDefinition["circuit"]): CircuitBreaker => {
  if (!options.breakers) {
    throw new Error("breaker registry missing; pass options.breakers to dispatchRoute().");
  }
  const existing = options.breakers.get(target.id);
  if (existing) return existing;
  const breaker = new CircuitBreaker(config || {
    minSamples: 5,
    errorRateThreshold: 0.5,
    openMs: 30_000,
  });
  options.breakers.set(target.id, breaker);
  return breaker;
};

// ---------------------------------------------------------------------------
// Shared-state helpers (GHA-NEXT-018 / 020 / 035 / 040)
//
// Every helper that touches `options.sharedState` is wrapped in try/catch
// so a misbehaving store backend NEVER throws inside the dispatch hot path.
// Fail-open / fail-closed defaults mirror the Wave 2 design (see
// shared-state-manager.ts §11):
//
//   - rateLimitFailClosed=true (default): allow when store unreachable,
//     since the noop default returns allowed=true.
//   - breakerFailOpen=true (default): skip cross-instance breaker sync
//     when store unreachable; the in-process CircuitBreaker still runs.
//   - idempotencyFailClosed=true (default): skip lock when store
//     unreachable; local CoalescingRegistry handles within-instance
//     dedup.
//   - cache / coalesce: fail-open — local VersionedCache /
//     CoalescingRegistry is the source of truth.
//
// The dispatcher reads these helpers BEFORE any target adapter call so
// fail-closed rejections short-circuit cleanly with a typed warning
// marker (`[shared-state:429:rate_limited:reset=<ms>]` and
// `[shared-state:409:idempotency_conflict]`) the HTTP edge maps to
// 429 / 409 responses.
// ---------------------------------------------------------------------------

/** Resolve the per-toolId rate-limit key. Cross-instance quota is
 *  bucketed by toolId so two unrelated callers don't starve each other.
 *  When the route's toolId is `resource.search.*` we use a fixed
 *  "search:{toolId}" namespace; "resource.generate.*" uses
 *  "generate:{toolId}". */
const rateLimitKeyFor = (toolId: string): string => {
  const namespace = toolId.startsWith("resource.generate.") ? "generate" : "search";
  return `${namespace}:${toolId}`;
};

/** Resolve the idempotency key for non-idempotent routes. Stable per
 *  (toolId, requestKey) so two concurrent identical requests against
 *  the same generation route collide on the same lock and join the
 *  same in-flight invocation. */
const idempotencyKeyFor = (toolId: string, requestKey: string, manifestVersion: number): string =>
  `idemp:${toolId}:${manifestVersion}:${requestKey}`;

/** Resolve the cross-instance coalesce key for non-idempotent routes.
 *  CoalesceStore.registerInFlight uses this to dedupe concurrent
 *  generation requests across gateway instances. */
const coalesceStoreKeyFor = (
  routeId: string,
  toolId: string,
  manifestVersion: number,
  requestKey: string,
): CoalescingKey => ({
  routeId,
  idempotencyKey: `${toolId}|${manifestVersion}|${requestKey}`,
  manifestVersion,
});

/** Build the cross-instance cache key. Reuses `buildCacheKey` so the
 *  payload hashing stays consistent with the in-process VersionedCache;
 *  the dispatcher writes through to both stores on cache miss so a
 *  cache hit on any instance resolves the same key. */
const sharedCacheKeyFor = (
  options: DispatchOptions,
  routeId: string,
  cacheScope: CacheScope,
): CacheKey => buildCacheKey({
  routeId,
  manifestVersion: options.manifestVersion || 1,
  scope: cacheScope,
  intent: options.intent,
  requestKey: options.requestKey,
});

/** GHA-NEXT-018 — cross-instance rate-limit gate. Returns `null` when
 *  the call is allowed; returns a typed warning marker when the
 *  shared store denies. Wrapped in try/catch: an unreachable store
 *  falls open (caller proceeds with no quota) per Wave 2 defaults. */
const sharedRateLimitCheck = async (
  sharedState: SharedStateManager | undefined,
  toolId: string,
): Promise<string | null> => {
  if (!sharedState) return null;
  // GHA-NEXT-025 — honour the operator's `rateLimitFailClosed`
  // config for BOTH the unreachable (`!isAvailable()`) and
  // exception paths. Default true ⇒ unavailable store allows the
  // call through (fail-open); set to false to reject with a
  // typed failure. The previous implementation bailed out
  // early on `!isAvailable()` and never read the config, which
  // meant the operator's "fail-closed" preference was silently
  // ignored on the unreachable path.
  const failClosed = sharedState.config?.rateLimitFailClosed ?? true;
  if (!sharedState.rateLimit.isAvailable()) {
    return failClosed ? null : `[shared-state:429:rate_limit_unavailable] route=${toolId}`;
  }
  try {
    // 60 calls / minute per toolId is a sensible default; manifest
    // overrides are a Phase 2 follow-up (GHA-NEXT-018 escalation
    // path). Window chosen so a sick deploy can't cascade into a
    // self-inflicted quota exhaustion on the upstream.
    const decision = await sharedState.rateLimit.checkAndIncrement(
      rateLimitKeyFor(toolId),
      60,
      60_000,
    );
    if (decision.allowed) return null;
    return `[shared-state:429:rate_limited:reset=${decision.resetAt}] route=${toolId} remaining=${decision.remaining}`;
  } catch (err) {
    if (failClosed) return null;
    return `[shared-state:429:rate_limit_unavailable] route=${toolId}`;
  }
};

/** GHA-NEXT-020 / GHA-NEXT-040 — shared cache read. Returns the entry
 *  on a hit (caller short-circuits) and `undefined` on miss / when the
 *  store is unreachable / when the dispatcher hasn't opted into the
 *  shared cache. Fail-open: unreachable store returns undefined so
 *  the dispatcher falls back to the in-process VersionedCache. */
const sharedCacheRead = async (
  sharedState: SharedStateManager | undefined,
  key: CacheKey,
): Promise<CacheEntry | undefined> => {
  if (!sharedState) return undefined;
  if (!sharedState.cache.isAvailable()) return undefined;
  // GHA-NEXT-020 — try the async cross-instance read first
  // (`ValkeyCacheStore.readAsync`); fall back to the sync getter
  // for in-process mirrors / noop stores that do not implement
  // the async hook. This is the only place where a cross-instance
  // cache hit actually lands in the dispatch path.
  if (typeof sharedState.cache.readAsync === "function") {
    try {
      return await sharedState.cache.readAsync(key);
    } catch {
      return undefined;
    }
  }
  try {
    return sharedState.cache.get(key);
  } catch {
    return undefined;
  }
};

/** GHA-NEXT-020 / GHA-NEXT-040 — shared cache write. Stores the
 *  entry using the serving route's `cacheTtlMs` so cache entries
 *  honour the per-route TTL semantics. Fail-open: unreachable store
 *  silently skips. */
const sharedCacheWrite = (
  sharedState: SharedStateManager | undefined,
  key: CacheKey,
  result: AdapterSearchResult,
  cacheTtlMs: number,
  negativeTtlMs: number,
): void => {
  if (!sharedState) return;
  if (!sharedState.cache.isAvailable()) return;
  if (cacheTtlMs <= 0) return;
  try {
    const isEmpty = !result.items || result.items.length === 0;
    const ttl = isEmpty ? Math.min(cacheTtlMs, negativeTtlMs) : cacheTtlMs;
    if (ttl <= 0) return;
    // The shared CacheStore stores CacheEntry values; mirror the
    // VersionedCache.set semantics (expiresAt + source) so reads on
    // another instance observe the same expiry contract.
    sharedState.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
      source: key.routeId,
    }, ttl);
  } catch {
    // Fail-open — unreachable store must not break dispatch.
  }
};

/** GHA-NEXT-035 — non-idempotent-route idempotency lock. Returns
 *   `{ status: "proceed" }` when the caller holds the lock (or the
 *   store is unreachable, fail-closed default);
 *   `{ status: "join", result }` when a peer already produced the
 *   result and the caller should short-circuit with that result;
 *   `{ status: "conflict" }` when the lock is held but the result
 *   hasn't been published yet — caller surfaces 409 and aborts. */
type IdempotencyOutcome =
  | { readonly status: "proceed" }
  | { readonly status: "join"; readonly result: AdapterSearchResult }
  | { readonly status: "conflict" };

const sharedIdempotencyAcquire = async (
  sharedState: SharedStateManager | undefined,
  key: string,
  ttlMs: number,
): Promise<IdempotencyOutcome> => {
  if (!sharedState) return { status: "proceed" };
  // GHA-NEXT-025 — honour the operator's `idempotencyFailClosed`
  // config for BOTH the unreachable (`!isAvailable()`) and
  // exception paths. Default true ⇒ unavailable store allows
  // the call through (local CoalescingRegistry handles
  // within-instance dedup); set to false to reject with a
  // typed conflict. The previous implementation bailed out
  // early on `!isAvailable()` and never read the config, which
  // meant the operator's "fail-closed" preference was silently
  // ignored on the unreachable path.
  const failClosed = sharedState.config?.idempotencyFailClosed ?? true;
  if (!sharedState.idempotency.isAvailable()) {
    return failClosed ? { status: "proceed" } : { status: "conflict" };
  }
  try {
    const acquired = await sharedState.idempotency.tryAcquire(key, ttlMs);
    if (acquired) return { status: "proceed" };
    // Lock NOT acquired — peer holds it. Try to join a published
    // result first; if absent, surface 409.
    const peerResult = await sharedState.idempotency.getResult(key);
    if (peerResult) return { status: "join", result: peerResult };
    return { status: "conflict" };
  } catch {
    if (failClosed) return { status: "proceed" };
    return { status: "conflict" };
  }
};

/** Publish the result for a non-idempotent route so future
 *  concurrent callers can join instead of re-executing. Called after
 *  a successful dispatch on a `idempotent=false` route. Fail-open:
 *  an unreachable store is silently skipped. */
const sharedIdempotencyPublish = async (
  sharedState: SharedStateManager | undefined,
  key: string,
  result: AdapterSearchResult,
  ttlMs: number,
): Promise<void> => {
  if (!sharedState) return;
  if (!sharedState.idempotency.isAvailable()) return;
  try {
    await sharedState.idempotency.setResult(key, result, ttlMs);
  } catch {
    // Fail-open.
  }
};

/** Release the lock when execution FAILED. Successful executions
 *  keep the lock until the result TTL fires — releasing would let a
 *  peer re-execute a generation call that already succeeded. */
const sharedIdempotencyRelease = async (
  sharedState: SharedStateManager | undefined,
  key: string,
): Promise<void> => {
  if (!sharedState) return;
  if (!sharedState.idempotency.isAvailable()) return;
  try {
    await sharedState.idempotency.release(key);
  } catch {
    // Fail-open.
  }
};

/** GHA-NEXT-035 — cross-instance coalesce for non-idempotent routes
 *  only. `addInFlight` returns either an in-flight AdapterSearchResult
 *  (caller joins) or `undefined` (caller proceeds to execute). The
 *  per-call CoalescingRegistry still runs for within-instance dedup;
 *  the shared CoalesceStore handles cross-instance dedup. */
const sharedCoalesceCheck = async (
  sharedState: SharedStateManager | undefined,
  key: CoalescingKey,
): Promise<AdapterSearchResult | undefined> => {
  if (!sharedState) return undefined;
  if (!sharedState.coalesce.isAvailable()) return undefined;
  try {
    const inFlight = await sharedState.coalesce.checkInFlight(key);
    return inFlight;
  } catch {
    return undefined;
  }
};

/** Register the in-flight entry so peer instances can join. The
 *  factory builds the underlying promise; the store removes the entry
 *  when the promise settles. */
const sharedCoalesceRegister = async (
  sharedState: SharedStateManager | undefined,
  key: CoalescingKey,
  factory: () => Promise<AdapterSearchResult>,
): Promise<AdapterSearchResult> => {
  if (!sharedState || !sharedState.coalesce.isAvailable()) {
    return factory();
  }
  try {
    return await sharedState.coalesce.registerInFlight(key, factory);
  } catch {
    return factory();
  }
};

/** GHA-NEXT-040 — record the outcome of a single adapter attempt on
 *  the shared breaker store so peer instances see the same circuit
 *  state within `propagationMs`. Fail-open: an unreachable store is
 *  silently skipped (the in-process CircuitBreaker still runs). */
const sharedBreakerRecord = (
  sharedState: SharedStateManager | undefined,
  targetId: string,
  success: boolean,
): void => {
  if (!sharedState) return;
  if (!sharedState.breaker.isAvailable()) return;
  try {
    sharedState.breaker.record(targetId, success);
  } catch {
    // Fail-open.
  }
};

const invokeTargetOnce = async (
  adapter: ResourceAdapter,
  intent: Intent,
  timeoutMs: number,
  parentSignal: AbortSignal | undefined,
  coalescing: CoalescingRegistry | undefined,
  coalescingKey: CoalescingKey | undefined,
  coalescingEnabled: boolean,
): Promise<AdapterSearchResult> => {
  // Shared-work factory: only the per-route timeout is honoured.
  // We deliberately do NOT wire `parentSignal` here — coalescing
  // treats AbortSignals as a join of promises, not of signals. A
  // caller cancelling its own dispatch must not cancel the shared
  // work that other joined callers are still waiting on.
  const sharedFactory = async (): Promise<AdapterSearchResult> => {
    const derived = deriveAbortSignal({ timeoutMs });
    try {
      return await abortable(adapter.search(intent, derived.signal), derived.signal);
    } finally {
      derived.dispose();
    }
  };
  // Per-caller factory: the caller's signal IS honoured so retries,
  // fallbacks, and breaker accounting react to caller cancellation.
  const callerFactory = async (): Promise<AdapterSearchResult> => {
    const derived = deriveAbortSignal({ parent: parentSignal, timeoutMs });
    try {
      return await abortable(adapter.search(intent, derived.signal), derived.signal);
    } finally {
      derived.dispose();
    }
  };
  if (coalescing && coalescingKey && coalescingEnabled) {
    const shared = coalescing.register(coalescingKey, sharedFactory);
    // Per-caller cancellation wrapper. The shared work itself is NOT
    // bound to the caller's signal (other joiners still want the
    // result), but the caller IS allowed to observe its own
    // cancellation. We wrap the joined promise with `abortable` so a
    // cancelling caller rejects with a `cancelled`-classifiable
    // error, which is what makes `runTargetWithRetry` short-circuit
    // (no retry, no fallback, breaker not charged) while the
    // underlying shared promise keeps running for joined callers.
    return abortable(shared, parentSignal);
  }
  return callerFactory();
};

interface TargetAttempt {
  target: Target;
  result: AdapterSearchResult | null;
  failure: ProviderFailure | null;
  attempts: number;
}

/** Run a target with retry/backoff/breaker accounting. Returns the
 *  final result plus the typed failure (when the final attempt
 *  failed). */
const runTargetWithRetry = async (
  target: Target,
  intent: Intent,
  signal: AbortSignal | undefined,
  breaker: CircuitBreaker,
  policy: DispatchPolicy,
  routeId: string,
  options: DispatchOptions,
): Promise<TargetAttempt> => {
  // Coalescing is OFF whenever the route's policy says so. The
  // downstream factories then take the per-caller path.
  const coalescingEnabled = policy.coalescingKeyKind !== "none" && policy.idempotent === true;
  // GHA-NEXT-035 — cross-instance coalescing for non-idempotent routes.
  // The local CoalescingRegistry refuses to coalesce generation
  // calls (idempotent=false => coalescingKeyKind="none" => off), so
  // a deploy with two gateway instances can still duplicate the
  // same generation request. The shared CoalesceStore closes that
  // gap for `resource.generate.*` routes ONLY — idempotent routes
  // keep using the local CoalescingRegistry because their key shape
  // and dedup semantics are well-defined there.
  const sharedCoalesceEnabled = policy.idempotent === false && options.sharedState !== undefined;
  let lastFailure: ProviderFailure | null = null;
  for (let attempt = 1; attempt <= policy.retry.maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      const failure = classifyFailure({ error: signal.reason, targetId: target.id, routeId: routeId, attempt, cancelled: true });
      return { target, result: null, failure, attempts: attempt };
    }
    if (!breaker.canPass()) {
      const failure = classifyFailure({ error: new Error("circuit is open"), targetId: target.id, routeId: routeId, attempt, cancelled: signal?.aborted === true });
      // Circuit-open does not count against the breaker — it IS the
      // breaker firing — so we record the caller's view of the slot
      // without recording an additional error.
      return { target, result: null, failure, attempts: attempt };
    }
    try {
      const key = coalescingEnabled ? coalescingKeyFor(options, routeId, target.id) : undefined;
      // Wrap the local coalescing call in a shared-coalesce adapter
      // when this is a non-idempotent route on a multi-instance
      // gateway. addInFlight is checked at the OUTER boundary so two
      // concurrent identical requests on different instances join the
      // SAME in-flight work; the local CoalescingRegistry still runs
      // for within-instance dedup. Shared check is the only place
      // where peer-instance dedup actually happens.
      let result: AdapterSearchResult;
      if (sharedCoalesceEnabled) {
        const sharedKey = coalesceStoreKeyFor(
          routeId,
          options.toolId,
          options.manifestVersion || 1,
          options.requestKey,
        );
        // First check: is a peer instance already running this work?
        const peerResult = await sharedCoalesceCheck(options.sharedState, sharedKey);
        if (peerResult) {
          result = peerResult;
        } else {
          // Register as the owner of this in-flight work. The store
          // removes the entry when the factory resolves; if a peer
          // raced past us, the store returns their result and we
          // never call the adapter.
          result = await sharedCoalesceRegister(
            options.sharedState,
            sharedKey,
            () => invokeTargetOnce(
              target.adapter,
              intent,
              policy.timeoutMs,
              signal,
              options.coalescing,
              key,
              coalescingEnabled,
            ),
          );
        }
      } else {
        result = await invokeTargetOnce(
          target.adapter,
          intent,
          policy.timeoutMs,
          signal,
          options.coalescing,
          key,
          coalescingEnabled,
        );
      }
      // Empty results are not errors — the provider is healthy but has no
      // data. We classify them so the negative TTL is applied and the
      // sliding window records a success entry so empty results do NOT
      // contribute to the error rate and cannot open the circuit.
      if (result.items.length === 0) {
        const emptyFailure = emptyResultFailure(target.id, routeId, attempt);
        // Record as success: empty_result is not a provider failure, and
        // recording it as false (failure) would wrongly inflate the error
        // rate and risk opening the breaker for a healthy provider.
        breaker.record(true);
        // GHA-NEXT-040: mirror the success into the shared breaker so
        // peer instances observe the same circuit state. Fail-open
        // when the store is unreachable.
        sharedBreakerRecord(options.sharedState, target.id, true);
        // GHA-NEXT-016 — mirror the success into the HealthRegistry
        // so passive failure counts AND the active probe loop both
        // see real dispatch outcomes. Without this, the registry's
        // `ejected` state is only reachable via the probe timer and
        // never reflects what dispatch actually observed.
        options.healthRegistry?.recordOutcome?.(target.id, true);
        return { target, result, failure: emptyFailure, attempts: attempt };
      }
      breaker.record(true);
      sharedBreakerRecord(options.sharedState, target.id, true);
      options.healthRegistry?.recordOutcome?.(target.id, true);
      return { target, result, failure: null, attempts: attempt };
    } catch (error) {
      const failure = classifyFailure({ error, targetId: target.id, routeId: routeId, attempt, cancelled: signal?.aborted === true });
      if (failure.kind !== "cancelled" && failure.countsAgainstBreaker) {
        breaker.record(false);
        // GHA-NEXT-040: mirror the failure into the shared breaker.
        sharedBreakerRecord(options.sharedState, target.id, false);
        // GHA-NEXT-016 — mirror the failure into the HealthRegistry
        // so passive counts + active probes jointly drive ejection.
        // The `failure.kind` is recorded for diagnosis.
        options.healthRegistry?.recordOutcome?.(target.id, false, `dispatch_${failure.kind}`);
      }
      lastFailure = failure;
      const decision = retryDecisionFor({
        attempt,
        maxAttempts: policy.retry.maxAttempts,
        backoffMs: policy.retry.backoffMs,
        maxBackoffMs: policy.retry.maxBackoffMs,
        failure,
        routeIdempotent: policy.idempotent,
      });
      if (decision.action !== "retry") break;
      await scheduleRetry({ decision, signal });
    }
  }
  return { target, result: null, failure: lastFailure, attempts: policy.retry.maxAttempts };
};

const mergeResults = (parts: ReadonlyArray<AdapterSearchResult>): AdapterSearchResult => {
  const seen = new Set<string>();
  const items = parts.flatMap((part) => part.items).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const warnings = parts.flatMap((part) => part.warnings || []);
  const confidence = parts.some((part) => part.confidence === "high") ? "high"
    : parts.some((part) => part.confidence === "medium") ? "medium"
    : "low";
  const mode: AdapterSearchResult["mode"] = parts.some((part) => part.mode === "live") ? "live" : "fixture";
  const clarification = parts.flatMap((part) => part.clarification || []).slice(0, 6);
  const single = parts.length === 1 ? parts[0] : undefined;
  return {
    items: items.slice(0, 12),
    sourceVersion: parts.map((part) => part.sourceVersion).filter(Boolean).join("|") || "gateway:merged",
    confidence,
    warnings: warnings.length ? warnings : undefined,
    clarification: clarification.length ? clarification : undefined,
    mode,
    ...(single ? {
      page: single.page,
      pageSize: single.pageSize,
      totalItems: single.totalItems,
      hasMore: single.hasMore,
    } : {}),
  };
};

/** Backwards-compatible selectRoute: deterministic specificity via scoreFor. */
const selectRoute = (routes: ReadonlyArray<RouteDefinition>, toolId: string, intent: Intent): RouteDefinition | undefined => selectBestRoute(routes, toolId, intent);

export const dispatchRoute = async (
  routes: ReadonlyArray<RouteDefinition>,
  options: DispatchOptions,
): Promise<AdapterSearchResult> => {
  const route = selectRoute(routes, options.toolId, options.intent);
  if (!route) {
    return {
      items: [],
      sourceVersion: "gateway:no-route",
      confidence: "low",
      warnings: [`no route matched toolId=${options.toolId}`],
      mode: "fixture",
    };
  }

  // GHA-NEXT-018 — cross-instance rate-limit gate. Runs BEFORE any
  // target adapter call so a quota-exhausted toolId short-circuits
  // cleanly with a typed 429 marker. The shared store is consulted
  // once per dispatch (per (toolId, requestKey) bucket). Fail-open:
  // an unreachable store falls through to the local dispatch path
  // so a Redis outage cannot cascade into a gateway outage.
  const rateLimitMarker = await sharedRateLimitCheck(options.sharedState, options.toolId);
  if (rateLimitMarker) {
    return {
      items: [],
      sourceVersion: "gateway:rate-limited",
      confidence: "low",
      warnings: [rateLimitMarker],
      mode: "fixture",
    };
  }

  const cache = versionedCacheFor(options);
  // Per-route cache cap: when policyByRoute is provided we configure
  // the cap for EVERY route the dispatcher might walk (primary +
  // fallback). When it is omitted we keep the legacy single-configure
  // behaviour for direct callers.
  if (cache && options.policyByRoute) {
    for (const [routeId, routePolicy] of options.policyByRoute.entries()) {
      cache.configure(routeId, routePolicy.maxCacheEntries);
    }
  }
  const primaryPolicy: DispatchPolicy = policyForRouteId(options, route.id);
  if (cache && !options.policyByRoute) cache.configure(route.id, primaryPolicy.maxCacheEntries);
  // Tracks the route that actually served the result so the cache
  // mirror keys on the serving route id + its OWN cacheTtlMs (not the
  // primary's). Defaults to the primary for the legacy single-policy
  // path where every route shares the same policy.
  let servingRoute: RouteDefinition = route;
  let servingPolicy: DispatchPolicy = primaryPolicy;

  const ctx = createContext({
    requestKey: options.requestKey,
    intent: options.intent,
    routeId: route.id,
    toolId: route.toolId,
    signal: options.signal,
    cache: legacyMapFor(options),
  });

  const preChain: Filter = composeFilters(route.filters.pre);
  const postChain: Filter = composeFilters(route.filters.post);

  const backpressure = options.backpressure || new BackpressureRegistry();

  // Per-route idempotency bookkeeping for non-idempotent routes. We
  // capture the lock key + TTL in this Map when tryRoute acquires a
  // lock so the post-processing tail can release on failure or
  // publish on success. Keyed on routeId so the primary and a
  // fallback route each own their own lock.
  const idempotencyBookkeeping = new Map<string, { idemKey: string; idemTtlMs: number }>();
  // Set to true when a route's result was served from the shared
  // cache hit path. The post-processing tail must NOT rewrite the
  // same entry back into the shared cache (the entry is already
  // there and re-writing would only refresh the TTL — surprising
  // for callers that observe a TTL countdown). The local
  // VersionedCache mirror still happens because it's a different
  // store.
  let servedFromCache = false;

  const tryRoute = async (targetRoute: RouteDefinition): Promise<AdapterSearchResult | null> => {
    // Per-route policy: this is the route-local override of every
    // policy knob (timeout / retry / backpressure / cacheTtlMs /
    // coalescingKeyKind). When policyByRoute is absent we fall back
    // to the single legacy policy for every route.
    const routePolicy = policyForRouteId(options, targetRoute.id);

    // GHA-NEXT-020 / 040 — shared cache read. Runs at the route
    // boundary BEFORE any target is acquired so a cache hit
    // short-circuits without ever paying for backpressure / breaker /
    // retry. We key on the route's own cacheScope so different
    // policies observe different entries; the shared store honours
    // the same TTL contract as the in-process VersionedCache.
    if (routePolicy.cacheTtlMs > 0) {
      const sharedKey = sharedCacheKeyFor(options, targetRoute.id, routePolicy.cacheScope);
      // GHA-NEXT-020 — `sharedCacheRead` is async so a cross-instance
      // hit on a peer instance can actually land. The local
      // VersionedCache mirror in `options.cache` is still consulted
      // by the filter pipeline after a hit so legacy filter reads
      // observe the entry.
      const cached = await sharedCacheRead(options.sharedState, sharedKey);
      if (cached && cached.expiresAt > Date.now()) {
        servingRoute = targetRoute;
        servingPolicy = routePolicy;
        servedFromCache = true;
        return cached.result;
      }
    }

    // GHA-NEXT-035 — non-idempotent-route idempotency gate. The lock
    // is acquired BEFORE any target adapter call so a peer instance
    // holding the lock forces the local caller to either join the
    // already-published result (status=join) or surface 409
    // (status=conflict). Idempotent routes skip this gate entirely
    // — retry / coalesce / cache handle their own dedup.
    if (routePolicy.idempotent === false) {
      const idemKey = idempotencyKeyFor(
        targetRoute.toolId,
        options.requestKey,
        options.manifestVersion || 1,
      );
      // Lock TTL: maxAttempts * timeoutMs + 5s safety margin. Long
      // enough that a healthy generation call NEVER expires before
      // the result is published; short enough that a crashed peer
      // releases the lock within a reasonable window.
      const idemTtlMs = Math.max(
        routePolicy.retry.maxAttempts * routePolicy.timeoutMs + 5_000,
        30_000,
      );
      const outcome = await sharedIdempotencyAcquire(
        options.sharedState,
        idemKey,
        idemTtlMs,
      );
      if (outcome.status === "join") {
        servingRoute = targetRoute;
        servingPolicy = routePolicy;
        return outcome.result;
      }
      if (outcome.status === "conflict") {
        // Lock held by a peer, no published result yet. Surface a
        // typed 409 marker so the HTTP edge can map it to 409 without
        // an error channel. Do NOT call any target — the peer owns
        // the work.
        ctx.warnings.push(`[shared-state:409:idempotency_conflict] route=${targetRoute.id} key=${idemKey}`);
        return null;
      }
      // outcome.status === "proceed": we hold the lock. Stash the
      // key + TTL in the bookkeeping map so the post-processing tail
      // can release on failure / publish on success.
      idempotencyBookkeeping.set(targetRoute.id, { idemKey, idemTtlMs });
    }

    const primary = targetRoute.targets.filter((target) => !target.fallback);
    const fallback = targetRoute.targets.filter((target) => target.fallback);

    const breakersByTarget = new Map<string, CircuitBreaker>();
    for (const target of targetRoute.targets) breakersByTarget.set(target.id, breakerFor(options, target, targetRoute.circuit));

    const concurrency = Math.max(1, targetRoute.concurrency ?? 1);
    // GHA-NEXT-010: track the last failure from this pool so the
    // per-route fallback skip rule can read it without re-parsing the
    // warning strings.
    const tryPool = async (pool: ReadonlyArray<Target>): Promise<{ result: AdapterSearchResult | null; lastFailure: ProviderFailure | null }> => {
      if (!pool.length) return { result: null, lastFailure: null };
      if (concurrency === 1) {
        let lastFailure: ProviderFailure | null = null;
        for (const target of pool) {
          let slot;
          try {
            slot = await backpressure.acquire(targetRoute.id, routePolicy.backpressure, options.signal);
          } catch (error) {
            // GHA-NEXT-018: BackpressureRegistry rejected (queue full
            // or queue timeout). Surface a typed warning that the
            // HTTP edge can read to produce a 429 + Retry-After
            // response. We do NOT throw — the dispatch contract is to
            // return an AdapterSearchResult; the warning marker is
            // `[backpressure:429:retry-after=<ms>]` so the gateway
            // router (Phase C) can map it without needing a separate
            // error channel.
            const decision = decisionFromError(error);
            if (decision && decision.action === "reject") {
              ctx.warnings.push(`[backpressure:429:retry-after=${decision.retryAfterMs}] route=${targetRoute.id} reason=${decision.reason}`);
            } else {
              ctx.warnings.push(`[backpressure:error] route=${targetRoute.id}`);
            }
            return { result: null, lastFailure };
          }
          try {
            if (options.signal?.aborted) break;
            // GHA-NEXT-017: load-balancer strategy is read from
            // targetRoute.loadBalancer so the manifest / route
            // definition actually drives the pickTarget path. With a
            // single-target pool the choice is moot, but we keep the
            // dispatch contract uniform so multi-target pools below
            // can also branch on the same route-level knob.
            // GHA-NEXT-037: pass `options.healthRegistry` so ejected
            // factories are excluded from the candidate pool. If
            // the single candidate is ejected, `pickTarget` returns
            // `undefined`; in that case we must NOT fall back to
            // the original target because that defeats the ejection
            // (the whole point of recording the outcome is to keep
            // the LB from re-routing traffic to a known-bad
            // provider). Surface a typed `provider_error` instead.
            const strategy = targetRoute.loadBalancer ?? "failover-only";
            const picked = pickTarget([target], strategy, ctx, { healthRegistry: options.healthRegistry });
            if (!picked) {
              const failure: ProviderFailure = {
                kind: "server_error",
                code: "provider_error",
                message: `single-target route ${targetRoute.id} is ejected; no fallback candidate`,
                routeId: targetRoute.id,
                targetId: target.id,
                countsAgainstBreaker: false,
                at: new Date().toISOString(),
                retryable: true,
                attempt: 1,
              };
              return { result: null, lastFailure: failure };
            }
            const breaker = breakersByTarget.get(picked.id)!;
            const attempt = await runTargetWithRetry(picked, options.intent, options.signal, breaker, routePolicy, targetRoute.id, options);
            if (attempt.failure) {
              ctx.warnings.push(summarizeFailure(attempt.failure));
              lastFailure = attempt.failure;
              if (!shouldFallbackFor(attempt.failure)) {
                // Cancellation / not_configured / 4xx / invalid_payload: stop right here.
                return { result: null, lastFailure };
              }
              continue;
            }
            if (attempt.result && attempt.result.items.length > 0) {
              servingRoute = targetRoute;
              servingPolicy = routePolicy;
              return { result: attempt.result, lastFailure };
            }
          } finally {
            slot.release();
          }
        }
        return { result: null, lastFailure };
      }
      // Multi-target concurrency>1 path: same wrap for acquire().
      // GHA-NEXT-037 — drop ejected factories before fanning out so a
      // sick factory doesn't soak up a backpressure slot. Falls back to
      // the unfiltered pool when every target is ejected (matches the
      // pickTarget semantic and prevents deadlock when the only
      // registered factory is sick). Reuses the same 1s TTL cache as
      // pickTarget so both code paths observe consistent status.
      const eligible = (() => {
        if (!options.healthRegistry) return pool;
        const registry = options.healthRegistry;
        const filtered = pool.filter((t) => cachedHealthStatus(registry, t.id) !== "ejected");
        return filtered.length ? filtered : pool;
      })();
      const settled = await Promise.allSettled(eligible.map(async (target) => {
        let slot;
        try {
          slot = await backpressure.acquire(targetRoute.id, routePolicy.backpressure, options.signal);
        } catch (error) {
          const decision = decisionFromError(error);
          if (decision && decision.action === "reject") {
            ctx.warnings.push(`[backpressure:429:retry-after=${decision.retryAfterMs}] route=${targetRoute.id} reason=${decision.reason} target=${target.id}`);
          } else {
            ctx.warnings.push(`[backpressure:error] route=${targetRoute.id} target=${target.id}`);
          }
          // Treat backpressure rejection as a non-retryable, non-fallback
          // condition for this slot; the Promise.allSettled still
          // resolves with null so other slots proceed.
          return null;
        }
        try {
          const breaker = breakersByTarget.get(target.id)!;
          const attempt = await runTargetWithRetry(target, options.intent, options.signal, breaker, routePolicy, targetRoute.id, options);
          if (attempt.failure) {
            ctx.warnings.push(summarizeFailure(attempt.failure));
            if (!shouldFallbackFor(attempt.failure)) {
              throw new Error("cancelled");
            }
            return null;
          }
          return attempt.result;
        } finally {
          slot.release();
        }
      }));
      const successful = settled
        .map((entry) => entry.status === "fulfilled" ? entry.value : null)
        .filter((value): value is AdapterSearchResult => value !== null && value.items.length > 0);
      if (!successful.length) return { result: null, lastFailure: null };
      servingRoute = targetRoute;
      servingPolicy = routePolicy;
      return { result: mergeResults(successful), lastFailure: null };
    };

    const primaryOutcome = await tryPool(primary);
    if (primaryOutcome.result) return primaryOutcome.result;
    // Cancellation: do NOT fall back. The caller asked to stop.
    if (options.signal?.aborted) return null;
    // GHA-NEXT-010: 4xx (client_error) and invalid_payload are caller /
    // input bugs. The next per-target fallback would face the same
    // payload and almost certainly fail identically. Skip the
    // per-route fallback pool for these so a bad request doesn't
    // cascade to a healthy fallback target. Other transient failures
    // (5xx, timeout, network, rate_limited) still walk the fallback.
    if (primaryOutcome.lastFailure && !shouldFallbackFor(primaryOutcome.lastFailure)) return null;
    const fallbackOutcome = await tryPool(fallback);
    if (fallbackOutcome.result) {
      return {
        ...fallbackOutcome.result,
        warnings: [...ctx.warnings, ...(fallbackOutcome.result.warnings || [])],
      };
    }
    return null;
  };

  const inner = async (): Promise<RouteContext> => {
    if (ctx.shortCircuit) return ctx;
    const primaryResult = await tryRoute(route);
    if (primaryResult) {
      ctx.result = primaryResult;
      return ctx;
    }
    if (options.fallbackChain?.length) {
      const chain = selectFallbackChain(routes, options.toolId, options.fallbackChain);
      for (const fallbackRoute of chain) {
        if (fallbackRoute.id === route.id) continue;
        if (options.signal?.aborted) break;
        const fallbackResult = await tryRoute(fallbackRoute);
        if (fallbackResult) {
          ctx.result = {
            ...fallbackResult,
            warnings: [...ctx.warnings, ...(fallbackResult.warnings || [])],
          };
          return ctx;
        }
      }
    }
    ctx.result = {
      items: [],
      sourceVersion: "gateway:empty",
      confidence: "low",
      warnings: ctx.warnings.slice(),
      mode: "fixture",
    };
    return ctx;
  };

  const wrapped = async (): Promise<RouteContext> => postChain.apply(ctx, () => preChain.apply(ctx, inner));
  const final = await wrapped();
  const result = final.result || {
    items: [],
    sourceVersion: "gateway:no-result",
    confidence: "low",
    mode: "fixture",
  };
  // When the caller supplied a VersionedCache and the route policy
  // enables caching, mirror the dispatch result into the versioned
  // store. Legacy filters (cacheLookupFilter / cacheStoreFilter) keep
  // reading through the Map shape, but new callers that want
  // manifest-version invalidation should observe this entry directly.
  // Always mirror into the versioned store when provided, regardless of
  // whether the legacy cache filters fired — this is what gives callers
  // manifest-version invalidation without depending on filter wiring.
  // Cache mirror: key on the SERVING route id + its OWN cacheTtlMs
  // and cacheScope. This is what guarantees a fallback route with a
  // different cacheTtlMs does NOT inherit the primary's TTL and
  // invalidate the wrong entries on a manifest-version bump.
  // GHA-NEXT-020 / 040 — mirror the entry into the shared cache so
  // peer instances observe the same hit. Key is identical so the
  // manifest-version invalidation contract is preserved end-to-end.
  // The shared write runs independently of whether the caller passed
  // a VersionedCache: callers that only want cross-instance caching
  // (no in-process VersionedCache) still get the shared write through.
  // On a cache-hit short-circuit we MUST skip the shared writeback
  // because the entry is already there; re-writing would just refresh
  // the TTL and confuse TTL-counting observers.
  if (servingPolicy.cacheTtlMs > 0) {
    const key = buildCacheKey({
      routeId: servingRoute.id,
      manifestVersion: options.manifestVersion || 1,
      scope: servingPolicy.cacheScope,
      intent: options.intent,
      requestKey: options.requestKey,
    });
    if (cache) {
      cache.set(key, result, { ttlMs: servingPolicy.cacheTtlMs, negativeTtlMs: servingPolicy.negativeTtlMs });
    }
    if (!servedFromCache) {
      sharedCacheWrite(
        options.sharedState,
        key,
        result,
        servingPolicy.cacheTtlMs,
        servingPolicy.negativeTtlMs,
      );
    }
  }

  // GHA-NEXT-035 — publish or release the non-idempotent-route
  // idempotency lock. Successful execution publishes the result so
  // concurrent callers join; failure releases so the next request can
  // retry the generation. Lock presence is sufficient evidence we
  // held one — `idempotencyBookkeeping` only contains routes that
  // passed the `tryAcquire` gate.
  for (const [, bookkeeping] of idempotencyBookkeeping) {
    if (result.items.length > 0) {
      await sharedIdempotencyPublish(
        options.sharedState,
        bookkeeping.idemKey,
        result,
        bookkeeping.idemTtlMs,
      );
    } else {
      await sharedIdempotencyRelease(
        options.sharedState,
        bookkeeping.idemKey,
      );
    }
  }

  return result;
};

/** Dispatch multiple routes concurrently, coalescing identical requestKeys.
 *  GHA-NEXT-008 — uses a per-call `CoalescingRegistry` instead of the
 *  legacy module-level `legacyInFlight` Map. The registry is created
 *  on first use and discarded when the call returns, so two
 *  `dispatchParallel` calls do NOT share state. Tests that need a
 *  shared coalescing registry across multiple `dispatchParallel`
 *  calls must pass `options.coalescing` themselves. */
export const dispatchParallel = async (
  routes: ReadonlyArray<RouteDefinition>,
  optionsList: ReadonlyArray<DispatchOptions>,
): Promise<AdapterSearchResult[]> => {
  const coalescing = optionsList.find((options) => options.coalescing)?.coalescing ?? new CoalescingRegistry();
  return Promise.all(optionsList.map((options) => {
    const sharedOptions = options.coalescing ? options : { ...options, coalescing };
    return dispatchRoute(routes, sharedOptions);
  }));
};

/** Test-only: convenience export for tests that want to reset their
 *  own coalescing registry state. The legacy module-level in-flight
 *  map was removed as part of GHA-NEXT-008; callers that relied on
 *  the global reset must now hold a `CoalescingRegistry` reference
 *  and call `reset()` on it directly. */
export const __resetInFlight = (registry?: CoalescingRegistry): void => {
  registry?.reset();
};

/** Bridge a VersionedCache back to a legacy `Map<string, CacheEntry>`
 *  so the existing filters (cacheLookupFilter / cacheStoreFilter)
 *  keep reading and writing through the same Map-shaped interface
 *  they always did. New code should read the VersionedCache directly. */

export {
  classifyFailure,
  emptyResultFailure,
  isEmptyResult,
  shouldFallbackFor,
  summarizeFailure,
  deriveAbortSignal,
  abortable,
  retryDecisionFor,
  scheduleRetry,
  BackpressureRegistry,
  CoalescingRegistry,
  VersionedCache,
  selectBestRoute,
  selectFallbackChain,
};
export type { ProviderFailure };