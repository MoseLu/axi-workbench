import type { RouteDefinition } from "../route";
import type { DispatchPolicy } from "../dispatch";

/**
 * GHA-NEXT-005 — PolicyRegistry interface.
 *
 * Centralises the logic that derives a `DispatchPolicy` from a `RouteDefinition`.
 * This includes:
 *   - `idempotent` flag (explicit manifest field or toolId-derived fallback),
 *   - `cacheTtlMs` (per-route hint or gateway-level default),
 *   - full policy derivation (`retry` / `backpressure` / `timeoutMs` / etc.).
 *
 * The noop implementation reproduces the exact same derivation that
 * `GatewayOrchestrator.policyForRoute()` and `GatewayOrchestrator.policyByRoute()`
 * currently perform inline, so injecting this registry does NOT change
 * the behaviour of an existing orchestrator that doesn't pass it.
 *
 * GHA-NEXT-001 future work: this registry is the natural home for manifest-driven
 * retry/backpressure/circuit/loadBalancer fields once GHA-NEXT-001 lands.
 */

export interface PolicyRegistry {
  /**
   * Derive the complete `DispatchPolicy` for a single route.
   * The returned policy covers retry, backpressure, timeout, caching,
   * idempotency, and coalescing key kind.
   */
  policyFor(route: RouteDefinition): DispatchPolicy;

  /**
   * Return a map of every route id to its derived policy, covering
   * primary routes and every route id mentioned in the fallback chain.
   * This is the precomputed snapshot that `GatewayOrchestrator.policyByRoute()`
   * currently builds inline.
   */
  allPolicies(): ReadonlyMap<string, DispatchPolicy>;

  /**
   * Compute the idempotency flag for a route. Returns `true` when the
   * route is safe to retry / cache / coalesce; `false` when the route
   * is stateful or has side effects.
   *
   * Resolution order (matches `policyForRoute`):
   *   1. `route.idempotent` if explicitly set,
   *   2. `!route.toolId.startsWith("resource.generate.")` as the backward-
   *      compatible default.
   */
  deriveIdempotent(route: RouteDefinition): boolean;

  /**
   * Compute the cache TTL hint for a route. Returns the per-route
   * `cacheTtlMs` when present, or the gateway-level default when absent.
   * Zero means "do not cache this route".
   */
  deriveCacheTtl(route: RouteDefinition): number;
}

export interface PolicyRegistryOptions {
  readonly routes: ReadonlyArray<RouteDefinition>;
  readonly fallbackChains?: ReadonlyArray<{
    readonly toolId: string;
    readonly chain: ReadonlyArray<string>;
  }>;
  readonly defaultCacheTtlMs?: number;
  readonly defaultRetry?: DispatchPolicy["retry"];
  readonly defaultBackpressure?: DispatchPolicy["backpressure"];
}

/** Noop implementation that reproduces `GatewayOrchestrator.policyForRoute()`. */
export class NoopPolicyRegistry implements PolicyRegistry {
  private readonly routes: ReadonlyArray<RouteDefinition>;
  private readonly fallbackChains?: ReadonlyArray<{
    readonly toolId: string;
    readonly chain: ReadonlyArray<string>;
  }>;
  private readonly defaultCacheTtlMs: number;
  private readonly defaultRetry: DispatchPolicy["retry"];
  private readonly defaultBackpressure: DispatchPolicy["backpressure"];

  constructor(options: PolicyRegistryOptions) {
    this.routes = options.routes;
    this.fallbackChains = options.fallbackChains;
    this.defaultCacheTtlMs = options.defaultCacheTtlMs ?? 0;
    this.defaultRetry = options.defaultRetry ?? { maxAttempts: 2, backoffMs: 50, maxBackoffMs: 500 };
    this.defaultBackpressure = options.defaultBackpressure ?? {
      maxConcurrent: 4,
      queueTimeoutMs: 1_000,
      shedStrategy: "reject",
    };
  }

  deriveIdempotent(route: RouteDefinition): boolean {
    if (route.idempotent !== undefined) return route.idempotent;
    return !route.toolId.startsWith("resource.generate.");
  }

  deriveCacheTtl(route: RouteDefinition): number {
    return route.cacheTtlMs ?? this.defaultCacheTtlMs;
  }

  policyFor(route: RouteDefinition): DispatchPolicy {
    const targetTimeouts = route.targets
      .map((target) => target.timeoutMs)
      .filter((value) => Number.isFinite(value) && value > 0);

    const idempotent = this.deriveIdempotent(route);

    const retry = route.retry !== undefined
      ? route.retry
      : this.defaultRetry;

    const maxConcurrent = route.backpressure?.maxConcurrent ?? Math.max(1, route.concurrency ?? 4);
    const backpressure = route.backpressure !== undefined
      ? route.backpressure
      : { maxConcurrent, queueTimeoutMs: 1_000, shedStrategy: "reject" as const };

    return {
      retry,
      backpressure,
      timeoutMs: targetTimeouts.length ? Math.min(...targetTimeouts) : 30_000,
      cacheTtlMs: this.deriveCacheTtl(route),
      negativeTtlMs: 1_000,
      maxCacheEntries: 256,
      idempotent,
      cacheScope: "route-payload",
      coalescingKeyKind: idempotent ? "idempotency" : "none",
    };
  }

  allPolicies(): ReadonlyMap<string, DispatchPolicy> {
    const out = new Map<string, DispatchPolicy>();
    const seen = new Set<string>();
    for (const route of this.routes) {
      if (seen.has(route.id)) continue;
      seen.add(route.id);
      out.set(route.id, this.policyFor(route));
    }
    const chains = this.fallbackChains || [];
    for (const entry of chains) {
      for (const routeId of entry.chain) {
        if (seen.has(routeId)) continue;
        const route = this.routes.find((candidate) => candidate.id === routeId);
        if (!route) continue;
        seen.add(routeId);
        out.set(routeId, this.policyFor(route));
      }
    }
    return out;
  }
}
