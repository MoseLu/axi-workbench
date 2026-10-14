import type { AdapterSearchResult, CacheScope, Intent } from "@axi/gateway-contracts";
import type { CacheEntry, RouteDefinition, Target } from "../route";
import type { CircuitBreaker } from "../circuit-breaker";
import type { BackpressurePolicy, BackpressureRegistry } from "../runtime/backpressure";
import type { ProviderFailure } from "../runtime/failure";
import type { CoalescingRegistry } from "../runtime/coalesce";
import type { VersionedCache } from "../runtime/cache";
import type { HealthRegistry } from "../registries/health-registry";
import type { SharedStateManager } from "../shared-state/shared-state-manager";

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

export const DEFAULT_POLICY: DispatchPolicy = {
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

/** GHA-NEXT-035 — non-idempotent-route idempotency lock. Returns
 *   `{ status: "proceed" }` when the caller holds the lock (or the
 *   store is unreachable, fail-closed default);
 *   `{ status: "join", result }` when a peer already produced the
 *   result and the caller should short-circuit with that result;
 *   `{ status: "conflict" }` when the lock is held but the result
 *   hasn't been published yet — caller surfaces 409 and aborts. */
export type IdempotencyOutcome =
  | { readonly status: "proceed" }
  | { readonly status: "join"; readonly result: AdapterSearchResult }
  | { readonly status: "conflict" };

export interface TargetAttempt {
  target: Target;
  result: AdapterSearchResult | null;
  failure: ProviderFailure | null;
  attempts: number;
}

/** Mutable per-dispatch bookkeeping shared between the `dispatchRoute`
 *  entry point and the per-route handler. Extracted verbatim from the
 *  original `dispatchRoute` closure so the handler can live in its own
 *  module without changing behaviour. */
export interface DispatchRunState {
  /** Route that actually served the result. Defaults to the primary;
   *  updated whenever a route (or its shared-cache hit path) produces
   *  the value so the cache mirror keys on the serving route id. */
  servingRoute: RouteDefinition;
  /** Policy of the serving route (its OWN cacheTtlMs / cacheScope). */
  servingPolicy: DispatchPolicy;
  /** True when the result came from the shared cache hit path. The
   *  post-processing tail must NOT rewrite the same entry back. */
  servedFromCache: boolean;
  /** Per-route idempotency lock bookkeeping for non-idempotent routes,
   *  keyed on routeId so primary and fallback each own their lock. */
  readonly idempotencyBookkeeping: Map<string, { idemKey: string; idemTtlMs: number }>;
}
