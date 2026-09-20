import type { AdapterSearchResult, Intent } from "@axi/gateway-contracts";
import type { RouteDefinition } from "./route";
import { dispatchRoute } from "./dispatch";
import type { DispatchPolicy } from "./dispatch";
import { BackpressureRegistry } from "./runtime/backpressure";
import { CoalescingRegistry } from "./runtime/coalesce";
import { VersionedCache, attachLegacyMap } from "./runtime/cache";
import { CircuitBreaker } from "./circuit-breaker";
import type { RouteRegistry, PolicyRegistry, HealthRegistry } from "./registries";
import {
  NoopRouteRegistry,
  NoopPolicyRegistry,
  NoopHealthRegistry,
} from "./registries";
import type { SharedStateManager } from "./shared-state/shared-state-manager";
import { configFromEnv } from "./shared-state/shared-state-manager";
import { createNoopSharedStateManager } from "./shared-state/noop-impl";

/**
 * GatewayOrchestrator — the public entrypoint.
 *
 * Drop-in replacement for the legacy "call one tool → one adapter" lookup
 * that ResourceOrchestrator used. It owns:
 *   - the route table (the caller passes it in, so test fixtures are easy),
 *   - the circuit-breaker registry (per-target `CircuitBreaker` instances,
 *     keyed by `target.id`, reused across all dispatches on this gateway),
 *   - a VersionedCache (lives in this orchestrator so cache entries survive
 *     across calls and across manifest versions; a legacy
 *     `Map<string, CacheEntry>` mirror is exposed as `cache` for the
 *     existing filter contract),
 *   - the BackpressureRegistry (one semaphore state per route id),
 *   - the CoalescingRegistry (one in-flight set keyed on
 *     `(routeId, idempotencyKey, manifestVersion)`).
 *
 * All four registries are constructed once when the gateway is built and
 * passed into the dispatch path as instance state — never reconstructed
 * per dispatch. This is the contract that lets the gateway share
 * breakers, cache hits, queued concurrency, and request coalescing
 * across the lifetime of one instance.
 *
 * It does NOT own state machines, validation, presentation, or pipeline
 * extension — those stay in ResourceOrchestrator, which now calls
 * dispatchRoute() instead of executeStep().
 */

export interface GatewayOrchestratorOptions {
  routes: ReadonlyArray<RouteDefinition>;
  /** Defaults to weighted-round-robin. */
  cacheTtlMs?: number;
  /** Explicit manifest fallback chains keyed by tool id. */
  fallbackChains?: ReadonlyArray<{
    readonly toolId: string;
    readonly chain: ReadonlyArray<string>;
  }>;
  /** Manifest version used to isolate runtime cache entries. */
  manifestVersion?: number;
  /** Optional override: inject a VersionedCache from the integration lane. */
  versionedCache?: VersionedCache;
  /** Optional override: inject a CoalescingRegistry from the integration lane. */
  coalescing?: CoalescingRegistry;
  /**
   * Optional override: inject a RouteRegistry.
   * When absent a NoopRouteRegistry is used (backward-compatible).
   * GHA-NEXT-005.
   */
  routeRegistry?: RouteRegistry;
  /**
   * Optional override: inject a PolicyRegistry.
   * When absent a NoopPolicyRegistry is used (backward-compatible).
   * GHA-NEXT-005.
   */
  policyRegistry?: PolicyRegistry;
  /**
   * Optional override: inject a HealthRegistry.
   * When absent a NoopHealthRegistry is used (backward-compatible).
   * GHA-NEXT-005.
   */
  healthRegistry?: HealthRegistry;
  /**
   * Optional override: inject a BackpressureRegistry from the
   * integration lane. When absent a per-instance
   * BackpressureRegistry is constructed. GHA-NEXT-040
   * reload path forwards the existing registry across reloads
   * so manifest bumps do not reset per-route semaphore state.
   */
  backpressure?: BackpressureRegistry;
  /**
   * Optional override: inject a SharedStateManager.
   * When absent a noop SharedStateManager is constructed (backward-compatible).
   * GHA-NEXT-025 — Phase D / P0.
   */
  sharedState?: SharedStateManager;
}

export class GatewayOrchestrator {
  readonly breakers = new Map<string, CircuitBreaker>();
  /**
   * Legacy Map-shaped cache mirror used by the existing
   * `cacheLookupFilter` and `cacheStoreFilter` contracts. Writes
   * through to `versionedCache` so versioned-key reads on the new
   * path stay consistent with the legacy Map.
   */
  readonly cache = new Map<string, import("./route").CacheEntry>();
  /** Shared for the lifetime of this gateway instance, not recreated per request. */
  readonly backpressure = new BackpressureRegistry();
  /** Shared for the lifetime of this gateway instance, not recreated per request. */
  readonly coalescing: CoalescingRegistry;
  /** Versioned cache (manifest-aware key invalidation). Bridged to `cache`. */
  readonly versionedCache: VersionedCache;
  /**
   * Route registry. Uses NoopRouteRegistry when not injected.
   * GHA-NEXT-005.
   */
  readonly routeRegistry: RouteRegistry;
  /**
   * Policy registry. Uses NoopPolicyRegistry when not injected.
   * GHA-NEXT-005.
   */
  readonly policyRegistry: PolicyRegistry;
  /**
   * Health registry. Uses NoopHealthRegistry when not injected.
   * GHA-NEXT-005.
   */
  readonly healthRegistry: HealthRegistry;
  /**
   * Shared-state manager (cross-instance breaker / rate-limit /
   * idempotency / cache / snapshot / coalesce). Defaults to a noop
   * manager when no `sharedState` option is supplied, which keeps
   * the orchestrator backwards-compatible with single-instance
   * deployments.
   * GHA-NEXT-025.
   */
  readonly sharedState: SharedStateManager;

  /** Internal store for the options that drive dispatch. */
  private readonly opts: Readonly<GatewayOrchestratorOptions>;

  constructor(options: GatewayOrchestratorOptions) {
    this.opts = options;
    this.coalescing = options.coalescing ?? new CoalescingRegistry();
    this.versionedCache = options.versionedCache ?? new VersionedCache();
    // GHA-NEXT-040 — honour the injected backpressure registry so
    // the reload path can forward per-route semaphore state.
    if (options.backpressure) {
      (this as unknown as { backpressure: BackpressureRegistry }).backpressure = options.backpressure;
    }
    // Mirror legacy filter reads/writes through to the versioned store.
    attachLegacyMap(this.versionedCache, this.cache);

    // GHA-NEXT-005: optional registry injection with backward-compatible noop fallback.
    this.routeRegistry = options.routeRegistry ?? new NoopRouteRegistry(options.routes);
    this.policyRegistry = options.policyRegistry ?? new NoopPolicyRegistry({
      routes: options.routes,
      fallbackChains: options.fallbackChains,
      defaultCacheTtlMs: options.cacheTtlMs,
    });
    this.healthRegistry = options.healthRegistry ?? new NoopHealthRegistry();
    // GHA-NEXT-025: optional SharedStateManager with backward-compatible
    // noop fallback. Construction is cheap (noop stores are stateless),
    // so we always have a manager — even single-instance deployments
    // pass through this surface without paying for a real backend.
    this.sharedState = options.sharedState ?? createNoopSharedStateManager(configFromEnv({}));
  }

  /**
   * Build a `DispatchPolicy` for the given route. Targets timeouts,
   * route `concurrency`, route `cacheTtlMs`, and circuit config are
   * read from the route itself; only the route-agnostic knobs come
   * from gateway-level options. Fallback routes reuse this helper
   * independently of the primary route so a chain with different
   * `concurrency` or `cacheTtlMs` per route does not silently
   * inherit the primary's policy.
   *
   * GHA-NEXT-001: manifest-driven policy fields are preferred. When
   * `route.idempotent` / `route.retry` / `route.backpressure` are
   * absent the gateway falls back to the toolId-derived defaults
   * (resource.generate.* => idempotent=false, everything else => true)
   * and the hardcoded retry/backpressure defaults. This preserves
   * backward compatibility for existing manifests.
   */
  policyForRoute(route: RouteDefinition): DispatchPolicy {
    const targetTimeouts = route.targets
      .map((target) => target.timeoutMs)
      .filter((value) => Number.isFinite(value) && value > 0);

    // GHA-NEXT-001: explicit manifest field is preferred; toolId-derived
    // fallback is the backward-compatible default.
    const idempotent = route.idempotent !== undefined
      ? route.idempotent
      : !route.toolId.startsWith("resource.generate.");

    // GHA-NEXT-001: explicit manifest retry is preferred; hardcoded
    // default is preserved for backward compatibility.
    const retry = route.retry !== undefined
      ? route.retry
      : { maxAttempts: 2, backoffMs: 50, maxBackoffMs: 500 };

    // GHA-NEXT-001: explicit manifest backpressure is preferred; fallback
    // derives from route.concurrency (also backward-compatible).
    const maxConcurrent = route.backpressure?.maxConcurrent ?? Math.max(1, route.concurrency ?? 4);
    const backpressure = route.backpressure !== undefined
      ? route.backpressure
      : { maxConcurrent, queueTimeoutMs: 1_000, shedStrategy: "reject" as const };

    return {
      retry,
      backpressure,
      timeoutMs: targetTimeouts.length ? Math.min(...targetTimeouts) : 30_000,
      cacheTtlMs: route.cacheTtlMs ?? this.opts.cacheTtlMs ?? 0,
      negativeTtlMs: 1_000,
      maxCacheEntries: 256,
      idempotent,
      cacheScope: "route-payload",
      // Coalescing is keyed on idempotency for read-style routes.
      // Generate-style (non-idempotent) routes explicitly disable
      // coalescing so two concurrent calls do NOT share a single
      // adapter invocation — generation is stateful and side-effectful.
      coalescingKeyKind: idempotent ? "idempotency" : "none",
    };
  }

  /**
   * Pick the primary route for `toolId`. A route whose id ends with
   * `-fallback` is treated as a fallback entry and excluded; its
   * policy comes from `policyForRoute()` once a primary exists.
   */
  primaryRouteFor(toolId: string): RouteDefinition | undefined {
    return this.opts.routes.find(
      (candidate) => candidate.toolId === toolId && !candidate.id.endsWith("-fallback"),
    );
  }

  /** Diagnostic: number of distinct target ids with a registered breaker. */
  breakerCount(): number {
    return this.breakers.size;
  }

  /**
   * Build a per-route policy map covering every route the dispatcher
   * could walk in this gateway instance: the primary for each toolId
   * + every route id listed in `opts.fallbackChains`. The dispatcher
   * uses this map so each route observes its OWN concurrency /
   * timeout / retry / cacheTtlMs / coalescingKeyKind instead of
   * inheriting the primary's policy. Read-only snapshot; callers
   * must not mutate it.
   */
  policyByRoute(): ReadonlyMap<string, DispatchPolicy> {
    const out = new Map<string, DispatchPolicy>();
    const seen = new Set<string>();
    for (const route of this.opts.routes) {
      if (seen.has(route.id)) continue;
      seen.add(route.id);
      out.set(route.id, this.policyForRoute(route));
    }
    const chains = this.opts.fallbackChains || [];
    for (const entry of chains) {
      for (const routeId of entry.chain) {
        if (seen.has(routeId)) continue;
        const route = this.opts.routes.find((candidate) => candidate.id === routeId);
        if (!route) continue;
        seen.add(routeId);
        out.set(routeId, this.policyForRoute(route));
      }
    }
    return out;
  }

  /** Look up routes (read-only snapshot). Delegates to the injected RouteRegistry. */
  listRoutes(): ReadonlyArray<RouteDefinition> {
    return this.routeRegistry.list();
  }

  /**
   * Dispatch a single intent against a tool id.
   *
   * The path passes:
   *   - `cache`          : the legacy Map mirror (filters read it),
   *   - `breakers`       : the shared registry,
   *   - `backpressure`   : the shared semaphore registry,
   *   - `coalescing`     : the shared in-flight registry,
   *   - `fallbackChain`  : resolved from gateway options for this toolId,
   *   - `manifestVersion`: resolved from gateway options (defaults to 1),
   *   - `policy`         : derived from the primary route via
   *                          `policyForRoute()` so cache TTL, timeout,
   *                          and backpressure concurrency match the
   *                          route that actually serves the call.
   */
  async dispatch(input: {
    intent: Intent;
    toolId: string;
    signal?: AbortSignal;
    requestKey: string;
  }): Promise<AdapterSearchResult> {
    const fallbackChain = this.opts.fallbackChains?.find((entry) => entry.toolId === input.toolId)?.chain;
    const route = this.primaryRouteFor(input.toolId);
    const policy: DispatchPolicy = route ? this.policyForRoute(route) : {
      retry: { maxAttempts: 2, backoffMs: 50, maxBackoffMs: 500 },
      backpressure: { maxConcurrent: 4, queueTimeoutMs: 1_000, shedStrategy: "reject" },
      timeoutMs: 30_000,
      cacheTtlMs: 0,
      negativeTtlMs: 1_000,
      maxCacheEntries: 256,
      idempotent: !input.toolId.startsWith("resource.generate."),
      cacheScope: "route-payload",
      coalescingKeyKind: "idempotency",
    };
    return dispatchRoute(this.opts.routes, {
      intent: input.intent,
      toolId: input.toolId,
      signal: input.signal,
      cache: this.cache,
      requestKey: input.requestKey,
      breakers: this.breakers,
      fallbackChain,
      manifestVersion: this.opts.manifestVersion,
      policy,
      // Per-route policy map covering primary + fallback routes; the
      // dispatcher reads it inside tryRoute so every route uses its
      // OWN timeout / concurrency / retry / cacheTtlMs /
      // coalescingKeyKind. This is the contract that prevents the
      // primary's policy from silently leaking into fallback routes.
      policyByRoute: this.policyByRoute(),
      backpressure: this.backpressure,
      coalescing: this.coalescing,
      versionedCache: this.versionedCache,
      // GHA-NEXT-037 — wire the gateway's HealthRegistry into the
      // dispatcher so `pickTarget` can drop ejected factories from
      // the candidate pool. NoopHealthRegistry reports `unknown` for
      // every factory, so legacy callers stay unchanged.
      healthRegistry: this.healthRegistry,
      // GHA-NEXT-018 / GHA-NEXT-020 / GHA-NEXT-025 — forward the
      // shared-state manager so the dispatcher actually consumes
      // rate-limit / shared cache / shared idempotency / shared
      // coalescing / shared breaker record on the real HTTP path.
      // Without this wire, dispatchRoute runs with `sharedState`
      // undefined and silently bypasses every cross-instance store
      // — the L3 wiring would only live in tests, never in prod.
      sharedState: this.sharedState,
    });
  }
}

/** Adapter factory signature used by ProviderRegistry; exported for tests. */
export type { AdapterFactory } from "./route";
export { BackpressureRegistry, BackpressureTimeoutError } from "./runtime/backpressure";

export {
  providerManifestSchema,
  parseManifest,
  validateManifest,
  loadBalancerStrategySchema,
  circuitBreakerConfigSchema,
  retryConfigSchema,
  backpressureConfigSchema,
  targetSchema,
  routeSchema,
  fallbackChainSchema,
  type ProviderManifestInput,
} from "./manifest-schema";
export { CircuitBreaker } from "./circuit-breaker";

export {
  validateManifestSemantics,
  validateTargetCapabilities,
  formatIssues,
  type ManifestIssue,
  type SemanticValidatorOptions,
} from "./manifest-validator";

export {
  NoopRouteRegistry,
  NoopPolicyRegistry,
  NoopHealthRegistry,
  ActiveHealthRegistry,
  deriveOverall,
  HEALTH_STATUS_TO_COMPONENT,
  type RouteRegistry,
  type PolicyRegistry,
  type HealthRegistry,
  type RouteRegistrySnapshot,
  type PolicyRegistryOptions,
  type HealthRegistrySnapshot,
  type HealthCheck,
  type HealthStatus,
  type FactoryHealth,
  type HealthEndpoint,
  type ActiveHealthRegistryOptions,
} from "./registries";

// Re-export the shared-state public surface so consumers can wire
// a SharedStateManager without reaching into a sibling file. The
// full barrel lives in `./shared-state/index.ts` for direct imports.
// GHA-NEXT-025 — Phase D / P0.
export type { SharedStateManager, SharedStateConfig } from "./shared-state/shared-state-manager";
export { configFromEnv } from "./shared-state/shared-state-manager";
export {
  createNoopSharedStateManager,
  createUnreachableSharedStateManager,
} from "./shared-state/noop-impl";
