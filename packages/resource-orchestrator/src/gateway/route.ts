import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";

/**
 * Resource Gateway — public type surface.
 *
 * A Route is the gateway's atomic dispatch decision: it binds a tool id and
 * an ordered set of predicates to a list of weighted targets (adapters +
 * their load-balancing/circuit-breaker metadata). Filters wrap the whole
 * route invocation as a `(ctx, next) => Promise<ctx>` chain so pre/post
 * stages compose without touching the orchestrator.
 *
 * Style rules (matching the rest of the orchestrator package):
 * - Pure types and tiny factories; no class hierarchies that hide control flow.
 * - Deterministic names; side effects only live in `dispatch.ts`.
 * - All cross-module interaction flows through `RouteContext`.
 */

/** A predicate scores a candidate intent against a route. Higher score wins. */
export interface Predicate {
  readonly id: string;
  matches(intent: Intent): boolean;
  /** Returns 0 when not applicable; default 1. Allows ordered tie-breaks. */
  score?(intent: Intent): number;
}

/** A filter is middleware around a single route invocation. */
export interface Filter {
  readonly id: string;
  apply(ctx: RouteContext, next: () => Promise<RouteContext>): Promise<RouteContext>;
}

/** A target is an adapter instance plus the metadata the gateway needs to
 *  call it, weight it, and recover when it fails. */
export interface Target {
  readonly id: string;
  readonly adapter: ResourceAdapter;
  readonly weight: number;
  readonly timeoutMs: number;
  readonly healthEndpoint?: string;
  /** When true, this target is part of the fallback chain (degraded signal). */
  readonly fallback?: boolean;
}

export type LoadBalancerStrategy =
  | "round-robin"
  | "weighted-round-robin"
  | "sticky-by-query"
  | "failover-only";

export interface CircuitBreakerConfig {
  /** Minimum number of samples before evaluating the error rate. */
  readonly minSamples: number;
  /** Error rate in [0, 1] that opens the circuit. */
  readonly errorRateThreshold: number;
  /** Time the circuit stays open before transitioning to half-open. */
  readonly openMs: number;
}

export interface RouteDefinition {
  readonly id: string;
  readonly toolId: string;
  readonly description: string;
  readonly predicates: ReadonlyArray<Predicate>;
  readonly targets: ReadonlyArray<Target>;
  readonly filters: {
    readonly pre: ReadonlyArray<Filter>;
    readonly post: ReadonlyArray<Filter>;
  };
  readonly loadBalancer: LoadBalancerStrategy;
  /** Explicit idempotency flag from manifest; absent means derived from toolId. */
  readonly idempotent?: boolean;
  /** Explicit retry policy from manifest; absent means hardcoded defaults. */
  readonly retry?: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
    readonly maxBackoffMs: number;
  };
  /** Explicit backpressure policy from manifest; absent means derived from concurrency. */
  readonly backpressure?: {
    readonly maxConcurrent: number;
    readonly queueTimeoutMs: number;
    readonly shedStrategy: "reject" | "coalesce";
  };
  readonly circuit?: CircuitBreakerConfig;
  readonly concurrency?: number;
  /** Soft cache TTL hint for the cache filter; 0 disables caching for this route. */
  readonly cacheTtlMs?: number;
}

/** Cache entry shared across the gateway. Mutable on purpose so the cache
 *  filter can update hits without rebuilding the context. */
export interface CacheEntry {
  result: AdapterSearchResult;
  expiresAt: number;
  source: string;
}

/** Mutable request-scoped state carried through the filter chain. The
 *  orchestrator builds it once; filters and dispatch mutate it in place. */
export interface RouteContext {
  readonly requestKey: string;
  readonly intent: Intent;
  readonly routeId: string;
  readonly toolId: string;
  readonly signal?: AbortSignal;
  readonly cache: Map<string, CacheEntry>;
  /** Trace lines emitted by trace filter / dispatch. */
  readonly trace: string[];
  /** Names of filters already executed; used to detect re-entrancy. */
  readonly filtersVisited: Set<string>;
  /** The dispatch result; filters can replace it during post-processing. */
  result: AdapterSearchResult | null;
  /** Bookkeeping for the load balancer and circuit breaker. */
  readonly startedAt: number;
  warnings: string[];
  /** When true, dispatch should short-circuit on the first healthy target. */
  shortCircuit?: boolean;
}

export interface ManifestRoute {
  readonly id: string;
  readonly toolId: string;
  readonly description: string;
  readonly predicates: ReadonlyArray<string>;
  readonly targetIds: ReadonlyArray<string>;
  readonly loadBalancer?: LoadBalancerStrategy;
  readonly cacheTtlMs?: number;
  readonly timeoutMs?: number;
  readonly concurrency?: number;
  /** Explicit idempotency flag. When absent, defaults to !toolId.startsWith("resource.generate."). */
  readonly idempotent?: boolean;
  /** Explicit retry policy. When absent, defaults to { maxAttempts:2, backoffMs:50, maxBackoffMs:500 }. */
  readonly retry?: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
    readonly maxBackoffMs: number;
  };
  /** Explicit backpressure policy. When absent, derives from route.concurrency.
   *  shedStrategy must match runtime BackpressurePolicy.ShedStrategy
   *  ("reject" | "coalesce"); "queue" is not a valid runtime value. */
  readonly backpressure?: {
    readonly maxConcurrent: number;
    readonly queueTimeoutMs: number;
    readonly shedStrategy: "reject" | "coalesce";
  };
  readonly circuit?: CircuitBreakerConfig;
}

export interface ManifestTarget {
  readonly id: string;
  /** Provider id (must match an adapter descriptor.id registered by the factory). */
  readonly providerId: string;
  readonly weight?: number;
  readonly fallback?: boolean;
  readonly timeoutMs?: number;
  readonly healthEndpoint?: string;
}

export interface ProviderManifest {
  readonly providers: ReadonlyArray<{
    readonly id: string;
    readonly factory: string;
  }>;
  readonly targets: ReadonlyArray<ManifestTarget>;
  readonly routes: ReadonlyArray<ManifestRoute>;
  readonly fallbackChains?: ReadonlyArray<{
    readonly toolId: string;
    readonly chain: ReadonlyArray<string>;
  }>;
}

/** Minimal shape a provider factory must satisfy. Returns one or more
 *  adapter instances — factories are responsible for env lookups. */
export type AdapterFactory = () => ResourceAdapter | ReadonlyArray<ResourceAdapter>;
