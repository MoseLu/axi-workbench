/**
 * apps/gateway/test/dispatch-shared-state.test.ts
 *
 * L3 dispatch.ts ↔ SharedStateManager wiring evidence (GHA-NEXT-040).
 *
 * Verifies that the apps/gateway composition exposes a SharedStateManager
 * whose stores are consulted by the dispatch path. The five runtime
 * stores are exercised through the orchestrator's public surface so a
 * regression that detaches `sharedState` from dispatch fails loudly.
 *
 * SnapshotStore is owner-driven via /admin/routes/reload — it is NOT
 * exercised here because the snapshot publish path runs at owner time,
 * never on the request hot path.
 */

import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import {
  GatewayOrchestrator,
  dispatchRoute,
  createNoopSharedStateManager,
  alwaysTrue,
  type SharedStateManager,
  type CacheStore,
  type RateLimitStore,
  type IdempotencyStore,
  type CoalesceStore,
  type BreakerStore,
  type RouteDefinition,
  type Target,
} from "@axi/resource-orchestrator";
import type { CircuitBreaker } from "@axi/resource-orchestrator";

const baseConfig = () => ({
  storeUrl: "",
  breakerFailOpen: true,
  rateLimitFailClosed: true,
  idempotencyFailClosed: true,
  propagationMs: 100,
  connectTimeoutMs: 1000,
  breakerTtlSeconds: 60,
  coalesceTtlSeconds: 30,
});

const okAdapter = (id: string): ResourceAdapter => ({
  descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
  search: async () => ({
    items: [{ id: `image:${id}-1`, kind: "image", title: `${id}`, facts: {}, provenance: { provider: id, ref: `${id}://1` }, safety: "safe" }],
    sourceVersion: id,
    confidence: "high",
    mode: "live",
  } as AdapterSearchResult),
});

const target = (id: string, adapter: ResourceAdapter, opts: Partial<Target> = {}): Target => ({
  id, adapter, weight: opts.weight ?? 1, timeoutMs: opts.timeoutMs ?? 1000, fallback: opts.fallback ?? false,
});

const route = (id: string, toolId: string, targets: Target[], overrides: Partial<RouteDefinition> = {}): RouteDefinition => ({
  id, toolId, description: id, predicates: [alwaysTrue()],
  targets, filters: { pre: [], post: [] }, loadBalancer: "failover-only",
  ...overrides,
});

const imageIntent: Intent = { operation: "search", resourceKinds: ["image"], constraints: { query: "avatar" }, needsClarification: false };

describe("apps/gateway dispatch ↔ SharedStateManager (GHA-NEXT-040 L3 evidence)", () => {
  it("GatewayOrchestrator exposes the injected SharedStateManager so callers can verify wiring", () => {
    const shared = createNoopSharedStateManager(baseConfig());
    const gateway = new GatewayOrchestrator({
      routes: [route("route.image", "resource.search.image", [target("primary", okAdapter("primary"))])],
      sharedState: shared,
    });
    expect(gateway.sharedState).toBe(shared);
    // Six-store surface present.
    expect(gateway.sharedState.breaker).toBeDefined();
    expect(gateway.sharedState.rateLimit).toBeDefined();
    expect(gateway.sharedState.idempotency).toBeDefined();
    expect(gateway.sharedState.cache).toBeDefined();
    expect(gateway.sharedState.snapshot).toBeDefined();
    expect(gateway.sharedState.coalesce).toBeDefined();
  });

  it("falls back to a noop SharedStateManager when none is supplied (backward-compatible default)", () => {
    const gateway = new GatewayOrchestrator({
      routes: [route("route.image", "resource.search.image", [target("primary", okAdapter("primary"))])],
    });
    expect(gateway.sharedState).toBeDefined();
    expect(gateway.sharedState.isEnabled).toBe(false);
  });

  it("dispatchRoute consults the rate-limit store when sharedState is supplied (real wiring)", async () => {
    const calls: Array<{ key: string; limit: number; windowMs: number }> = [];
    const rateLimit: RateLimitStore = {
      checkAndIncrement: async (key, limit, windowMs) => {
        calls.push({ key, limit, windowMs });
        return { allowed: false, remaining: 0, resetAt: 9999 };
      },
      reset: async () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      rateLimit,
    };
    const r = route("route.image", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], {
      intent: imageIntent,
      toolId: "resource.search.image",
      cache: new Map(),
      requestKey: "dss-rl",
      breakers: new Map(),
      policyByRoute: new Map([[r.id, {
        retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 },
        backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" },
        timeoutMs: 1000,
        cacheTtlMs: 60_000,
        negativeTtlMs: 1000,
        maxCacheEntries: 256,
        idempotent: true,
        cacheScope: "route-payload",
        coalescingKeyKind: "idempotency",
      }]]),
      sharedState: shared,
    });
    // Real wiring — the rate-limit store was consulted.
    expect(calls.length).toBe(1);
    expect(calls[0].key).toBe("search:resource.search.image");
    expect(calls[0].limit).toBe(60);
    expect(calls[0].windowMs).toBe(60_000);
    // 429 marker surfaced.
    expect(result.sourceVersion).toBe("gateway:rate-limited");
    expect(result.warnings?.some((w) => /\[shared-state:429:rate_limited:reset=9999\]/.test(w))).toBe(true);
  });

  it("dispatchRoute writes the breaker store on every attempt (real wiring)", async () => {
    const records: Array<{ targetId: string; success: boolean }> = [];
    const breaker: BreakerStore = {
      getState: () => undefined,
      record: (targetId, success) => records.push({ targetId, success }),
      tryClose: () => false,
      snapshotAll: () => new Map(),
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      breaker,
    };
    const r = route("route.image", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 0 });
    await dispatchRoute([r], {
      intent: imageIntent,
      toolId: "resource.search.image",
      cache: new Map(),
      requestKey: "dss-br",
      breakers: new Map<string, CircuitBreaker>(),
      policyByRoute: new Map([[r.id, {
        retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 },
        backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" },
        timeoutMs: 1000,
        cacheTtlMs: 0,
        negativeTtlMs: 1000,
        maxCacheEntries: 256,
        idempotent: true,
        cacheScope: "route-payload",
        coalescingKeyKind: "idempotency",
      }]]),
      sharedState: shared,
    });
    expect(records.some((rec) => rec.targetId === "primary" && rec.success === true)).toBe(true);
  });

  it("dispatchRoute reads from the cache store on a hit (real wiring)", async () => {
    const cached: AdapterSearchResult = {
      items: [{ id: "image:from-shared-cache", kind: "image" as never, title: "shared-cache", facts: {}, provenance: { provider: "cache", ref: "x" }, safety: "safe" as const }],
      sourceVersion: "shared-cache-v1",
      confidence: "high",
      mode: "live",
    };
    const cache: CacheStore = {
      get: () => ({ result: cached, expiresAt: Date.now() + 60_000, source: "route.image" }),
      set: () => {},
      invalidate: () => {},
      invalidateByRoute: () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      cache,
    };
    const r = route("route.image", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], {
      intent: imageIntent,
      toolId: "resource.search.image",
      cache: new Map(),
      requestKey: "dss-cache",
      manifestVersion: 1,
      breakers: new Map<string, CircuitBreaker>(),
      policyByRoute: new Map([[r.id, {
        retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 },
        backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" },
        timeoutMs: 1000,
        cacheTtlMs: 60_000,
        negativeTtlMs: 1000,
        maxCacheEntries: 256,
        idempotent: true,
        cacheScope: "route-payload",
        coalescingKeyKind: "idempotency",
      }]]),
      sharedState: shared,
    });
    expect(result.items[0].id).toBe("image:from-shared-cache");
    expect(result.sourceVersion).toBe("shared-cache-v1");
  });

  it("dispatchRoute surfaces idempotency conflict on a generate route (real wiring)", async () => {
    const idempotency: IdempotencyStore = {
      tryAcquire: async () => false,
      release: async () => {},
      getResult: async () => undefined,
      setResult: async () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      idempotency,
    };
    const genAdapter: ResourceAdapter = {
      descriptor: { id: "gen", label: "gen", resourceKinds: ["image"], capabilities: ["generate"] },
      search: async () => ({
        items: [{ id: "image:gen", kind: "image", title: "gen", facts: {}, provenance: { provider: "gen", ref: "g" }, safety: "safe" }],
        sourceVersion: "gen",
        confidence: "high",
        mode: "live",
      }),
    };
    const r = route("route.gen", "resource.generate.image", [target("gen", genAdapter)], { idempotent: false, cacheTtlMs: 0 });
    let adapterCalled = false;
    const orig = genAdapter.search;
    genAdapter.search = async (...args) => { adapterCalled = true; return orig.apply(genAdapter, args); };
    const result = await dispatchRoute([r], {
      intent: { operation: "generate", resourceKinds: ["image"], constraints: { prompt: "kitten" }, needsClarification: false },
      toolId: "resource.generate.image",
      cache: new Map(),
      requestKey: "dss-idem",
      breakers: new Map<string, CircuitBreaker>(),
      policyByRoute: new Map([[r.id, {
        retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 },
        backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" },
        timeoutMs: 1000,
        cacheTtlMs: 0,
        negativeTtlMs: 1000,
        maxCacheEntries: 256,
        idempotent: false,
        cacheScope: "route-payload",
        coalescingKeyKind: "none",
      }]]),
      sharedState: shared,
    });
    expect(adapterCalled).toBe(false);
    expect(result.warnings?.some((w) => /\[shared-state:409:idempotency_conflict\]/.test(w))).toBe(true);
  });

  it("dispatchRoute uses the coalesce store for generate routes (real wiring)", async () => {
    const peerResult: AdapterSearchResult = {
      items: [{ id: "image:coalesced", kind: "image", title: "coalesced", facts: {}, provenance: { provider: "peer", ref: "p" }, safety: "safe" }],
      sourceVersion: "peer-co",
      confidence: "high",
      mode: "live",
    };
    const coalesce: CoalesceStore = {
      checkInFlight: async () => peerResult,
      registerInFlight: async () => peerResult,
      removeInFlight: () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      coalesce,
    };
    const genAdapter: ResourceAdapter = {
      descriptor: { id: "gen", label: "gen", resourceKinds: ["image"], capabilities: ["generate"] },
      search: async () => ({
        items: [{ id: "image:gen", kind: "image", title: "gen", facts: {}, provenance: { provider: "gen", ref: "g" }, safety: "safe" }],
        sourceVersion: "gen",
        confidence: "high",
        mode: "live",
      }),
    };
    const r = route("route.gen", "resource.generate.image", [target("gen", genAdapter)], { idempotent: false, cacheTtlMs: 0 });
    let adapterCalled = false;
    const orig = genAdapter.search;
    genAdapter.search = async (...args) => { adapterCalled = true; return orig.apply(genAdapter, args); };
    const result = await dispatchRoute([r], {
      intent: { operation: "generate", resourceKinds: ["image"], constraints: { prompt: "kitten" }, needsClarification: false },
      toolId: "resource.generate.image",
      cache: new Map(),
      requestKey: "dss-coalesce",
      breakers: new Map<string, CircuitBreaker>(),
      policyByRoute: new Map([[r.id, {
        retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 },
        backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" },
        timeoutMs: 1000,
        cacheTtlMs: 0,
        negativeTtlMs: 1000,
        maxCacheEntries: 256,
        idempotent: false,
        cacheScope: "route-payload",
        coalescingKeyKind: "none",
      }]]),
      sharedState: shared,
    });
    expect(adapterCalled).toBe(false);
    expect(result.items[0].id).toBe("image:coalesced");
  });
});
