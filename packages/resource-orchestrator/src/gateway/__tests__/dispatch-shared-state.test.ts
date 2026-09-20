import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import { dispatchRoute, __resetInFlight } from "../dispatch";
import type { RouteDefinition, Target } from "../route";
import { alwaysTrue } from "../predicates";
import { buildCacheKey } from "../runtime/cache";
import {
  createNoopSharedStateManager,
  createUnreachableSharedStateManager,
  type SharedStateManager,
  type CacheStore,
  type RateLimitStore,
  type IdempotencyStore,
  type CoalesceStore,
  type BreakerStore,
} from "../shared-state";
import type { CircuitBreaker } from "../circuit-breaker";

/**
 * dispatch.ts ↔ SharedStateManager integration tests (L3 closure).
 *
 * Verifies the cross-instance plumbing that the dispatcher threads
 * through the five runtime stores (rate-limit / cache / idempotency /
 * coalesce / breaker). SnapshotStore is intentionally NOT exercised
 * here — it's owner-driven via /admin/routes/reload, never on the
 * request hot path.
 *
 * Each store is tested in three modes:
 *   1. sharedState=undefined → dispatch behaviour is unchanged
 *      (legacy direct-callers don't pay any shared-store tax).
 *   2. available → store is consulted BEFORE any target adapter call.
 *   3. unreachable → dispatcher falls open so a Redis outage does not
 *      break dispatch.
 */

const mkAdapter = (descriptor: ResourceAdapter["descriptor"], result: AdapterSearchResult): ResourceAdapter => ({
  descriptor, search: async () => result,
});

const okAdapter = (id: string, n = 1): ResourceAdapter => mkAdapter(
  { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
  {
    items: Array.from({ length: n }, (_, i) => ({
      id: `image:${id}-${i}`, kind: "image", title: `${id}-${i}`, facts: {},
      provenance: { provider: id, ref: `${id}://${i}` }, safety: "safe",
    })),
    sourceVersion: id, confidence: "high", mode: "live",
  },
);

const genAdapter = (id: string, n = 1): ResourceAdapter => mkAdapter(
  { id, label: id, resourceKinds: ["image"], capabilities: ["generate"] },
  {
    items: Array.from({ length: n }, (_, i) => ({
      id: `image:${id}-${i}`, kind: "image", title: `${id}-${i}`, facts: {},
      provenance: { provider: id, ref: `${id}://${i}` }, safety: "safe",
    })),
    sourceVersion: id, confidence: "high", mode: "live",
  },
);

const target = (id: string, adapter: ResourceAdapter, opts: Partial<Target> = {}): Target => ({
  id, adapter, weight: opts.weight ?? 1, timeoutMs: opts.timeoutMs ?? 1000, fallback: opts.fallback ?? false,
});

const route = (id: string, toolId: string, targets: Target[], overrides: Partial<RouteDefinition> = {}): RouteDefinition => ({
  id, toolId, description: id, predicates: [alwaysTrue()],
  targets, filters: { pre: [], post: [] }, loadBalancer: "failover-only",
  ...overrides,
});

const imageIntent: Intent = { operation: "search", resourceKinds: ["image"], constraints: { query: "avatar" }, needsClarification: false };
const genIntent: Intent = { operation: "generate", resourceKinds: ["image"], constraints: { prompt: "kitten" }, needsClarification: false };

// dispatch.ts reads `routePolicy` via `policyForRouteId`, which returns
// the merged policy the caller supplied (or DEFAULT_POLICY). Tests that
// want cacheTtlMs > 0 / idempotent=false MUST therefore pass the policy
// explicitly via `policyByRoute` — passing only the route definition
// would silently fall back to DEFAULT_POLICY (cacheTtlMs=0, idempotent=true).
const buildPolicy = (idempotent: boolean, cacheTtlMs = 60_000) => ({
  retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 },
  backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" as const },
  timeoutMs: 1000,
  cacheTtlMs,
  negativeTtlMs: 1000,
  maxCacheEntries: 256,
  idempotent,
  cacheScope: "route-payload" as const,
  coalescingKeyKind: (idempotent ? "idempotency" : "none") as "idempotency" | "none",
});

// Default test config used across the suite. Tests override individual
// fields via `dispatchOptionsFor(...)`.
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

const dispatchOptionsFor = (
  routeEntry: RouteDefinition,
  extras: {
    intent?: Intent;
    requestKey?: string;
    manifestVersion?: number;
    sharedState?: SharedStateManager;
    breakers?: Map<string, CircuitBreaker>;
    policy?: { idempotent?: boolean; cacheTtlMs?: number };
  } = {},
) => {
  const idempotent = extras.policy?.idempotent ?? routeEntry.idempotent !== false;
  const cacheTtlMs = extras.policy?.cacheTtlMs ?? routeEntry.cacheTtlMs ?? 0;
  return {
    intent: extras.intent ?? imageIntent,
    toolId: routeEntry.toolId,
    cache: new Map(),
    requestKey: extras.requestKey ?? "k",
    manifestVersion: extras.manifestVersion ?? 1,
    breakers: extras.breakers ?? new Map(),
    policyByRoute: new Map([[routeEntry.id, buildPolicy(idempotent, cacheTtlMs)]]),
    sharedState: extras.sharedState,
  };
};

// ---------------------------------------------------------------------------
// RateLimitStore
// ---------------------------------------------------------------------------

describe("dispatch ↔ RateLimitStore (GHA-NEXT-018)", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("returns a typed 429 marker when the shared rate-limit denies", async () => {
    const decisionStore: RateLimitStore = {
      checkAndIncrement: async (_key, _limit, _windowMs) => ({ allowed: false, remaining: 0, resetAt: 12345 }),
      reset: async () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      rateLimit: decisionStore,
    };
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "rl-1", sharedState: shared }));
    expect(result.items).toEqual([]);
    expect(result.sourceVersion).toBe("gateway:rate-limited");
    expect(result.warnings?.some((w) => /\[shared-state:429:rate_limited:reset=12345\]/.test(w))).toBe(true);
  });

  it("falls open when the rate-limit store is unavailable", async () => {
    const shared = createUnreachableSharedStateManager({ ...baseConfig(), storeUrl: "redis://x" });
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "rl-2", sharedState: shared }));
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("does not consult the rate-limit store when sharedState is undefined (legacy contract)", async () => {
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "rl-3" }));
    expect(result.items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CacheStore
// ---------------------------------------------------------------------------

describe("dispatch ↔ CacheStore (GHA-NEXT-020 / 040)", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("short-circuits when the shared cache returns a hit", async () => {
    const cached: AdapterSearchResult = {
      items: [{ id: "image:from-cache", kind: "image", title: "cached", facts: {}, provenance: { provider: "cache", ref: "x" }, safety: "safe" }],
      sourceVersion: "cache-v1",
      confidence: "high",
      mode: "live",
    };
    let setCalled = false;
    const cacheStore: CacheStore = {
      get: (k) => {
        expect(k.routeId).toBe("route.shared");
        return { result: cached, expiresAt: Date.now() + 60_000, source: "route.shared" };
      },
      set: () => { setCalled = true; },
      invalidate: () => {},
      invalidateByRoute: () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      cache: cacheStore,
    };
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "cache-1", sharedState: shared }));
    expect(result.items[0].id).toBe("image:from-cache");
    expect(result.sourceVersion).toBe("cache-v1");
    // No writeback on a cache-hit short-circuit.
    expect(setCalled).toBe(false);
  });

  it("mirrors the dispatch result into the shared cache on a miss", async () => {
    const seenSets: Array<{ routeId: string; expiresAt: number }> = [];
    const cacheStore: CacheStore = {
      get: () => undefined,
      set: (_k, entry) => {
        seenSets.push({ routeId: entry.source, expiresAt: entry.expiresAt });
      },
      invalidate: () => {},
      invalidateByRoute: () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      cache: cacheStore,
    };
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 60_000 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "cache-2", sharedState: shared }));
    expect(result.items.length).toBeGreaterThan(0);
    expect(seenSets.length).toBe(1);
    expect(seenSets[0].routeId).toBe("route.shared");
    expect(seenSets[0].expiresAt).toBeGreaterThan(Date.now());
    // Ensure the key shape matches buildCacheKey for cross-instance consistency.
    const expectedKey = buildCacheKey({ routeId: "route.shared", manifestVersion: 1, scope: "route-payload", intent: imageIntent, requestKey: "cache-2" });
    expect(expectedKey.routeId).toBe("route.shared");
  });
});

// ---------------------------------------------------------------------------
// IdempotencyStore
// ---------------------------------------------------------------------------

describe("dispatch ↔ IdempotencyStore (GHA-NEXT-035)", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("joins a peer's already-published result on a generate route", async () => {
    const peerResult: AdapterSearchResult = {
      items: [{ id: "image:peer", kind: "image", title: "peer", facts: {}, provenance: { provider: "peer", ref: "p" }, safety: "safe" }],
      sourceVersion: "peer-v1",
      confidence: "high",
      mode: "live",
    };
    const idemStore: IdempotencyStore = {
      tryAcquire: async () => false,
      release: async () => {},
      getResult: async () => peerResult,
      setResult: async () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      idempotency: idemStore,
    };
    const gen = genAdapter("gen");
    let adapterCalled = false;
    const origSearch = gen.search;
    gen.search = async () => { adapterCalled = true; return origSearch(genIntent); };
    const r = route("route.gen", "resource.generate.image", [target("gen", gen)], { idempotent: false, cacheTtlMs: 0 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { intent: genIntent, requestKey: "idem-1", sharedState: shared, policy: { idempotent: false, cacheTtlMs: 0 } }));
    expect(adapterCalled).toBe(false);
    expect(result.items[0].id).toBe("image:peer");
  });

  it("surfaces a typed 409 marker when the lock is held but no result is published yet", async () => {
    const idemStore: IdempotencyStore = {
      tryAcquire: async () => false,
      release: async () => {},
      getResult: async () => undefined,
      setResult: async () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      idempotency: idemStore,
    };
    const gen = genAdapter("gen");
    let adapterCalled = false;
    const origSearch = gen.search;
    gen.search = async () => { adapterCalled = true; return origSearch(genIntent); };
    const r = route("route.gen", "resource.generate.image", [target("gen", gen)], { idempotent: false, cacheTtlMs: 0 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { intent: genIntent, requestKey: "idem-2", sharedState: shared, policy: { idempotent: false, cacheTtlMs: 0 } }));
    expect(adapterCalled).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.warnings?.some((w) => /\[shared-state:409:idempotency_conflict\]/.test(w))).toBe(true);
  });

  it("does NOT consult the idempotency store on idempotent routes", async () => {
    let acquireCalls = 0;
    const idemStore: IdempotencyStore = {
      tryAcquire: async () => { acquireCalls += 1; return true; },
      release: async () => {},
      getResult: async () => undefined,
      setResult: async () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      idempotency: idemStore,
    };
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 0 });
    await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "idem-search", sharedState: shared, policy: { idempotent: true, cacheTtlMs: 0 } }));
    expect(acquireCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CoalesceStore
// ---------------------------------------------------------------------------

describe("dispatch ↔ CoalesceStore (GHA-NEXT-035)", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("uses the shared coalesce store for non-idempotent routes (generate only)", async () => {
    let registerCalls = 0;
    const peerResult: AdapterSearchResult = {
      items: [{ id: "image:coalesced", kind: "image", title: "coalesced", facts: {}, provenance: { provider: "peer", ref: "p" }, safety: "safe" }],
      sourceVersion: "peer-co",
      confidence: "high",
      mode: "live",
    };
    const coalesceStore: CoalesceStore = {
      checkInFlight: async () => peerResult,
      registerInFlight: async () => { registerCalls += 1; return peerResult; },
      removeInFlight: () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      coalesce: coalesceStore,
    };
    const gen = genAdapter("gen");
    let adapterCalled = false;
    const origSearch = gen.search;
    gen.search = async () => { adapterCalled = true; return origSearch(genIntent); };
    const r = route("route.gen", "resource.generate.image", [target("gen", gen)], { idempotent: false, cacheTtlMs: 0 });
    const result = await dispatchRoute([r], dispatchOptionsFor(r, { intent: genIntent, requestKey: "coalesce-1", sharedState: shared, policy: { idempotent: false, cacheTtlMs: 0 } }));
    expect(adapterCalled).toBe(false);
    expect(registerCalls).toBe(0);
    expect(result.items[0].id).toBe("image:coalesced");
  });

  it("does NOT consult the shared coalesce store for idempotent routes", async () => {
    let registerCalls = 0;
    const coalesceStore: CoalesceStore = {
      checkInFlight: async () => undefined,
      registerInFlight: async (_k, factory) => { registerCalls += 1; return factory(); },
      removeInFlight: () => {},
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      coalesce: coalesceStore,
    };
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 0 });
    await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "coalesce-search", sharedState: shared, policy: { idempotent: true, cacheTtlMs: 0 } }));
    expect(registerCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BreakerStore
// ---------------------------------------------------------------------------

describe("dispatch ↔ BreakerStore (GHA-NEXT-040)", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("records success into the shared breaker on a healthy adapter call", async () => {
    const records: Array<{ targetId: string; success: boolean }> = [];
    const breakerStore: BreakerStore = {
      getState: () => undefined,
      record: (targetId, success) => records.push({ targetId, success }),
      tryClose: () => false,
      snapshotAll: () => new Map(),
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      breaker: breakerStore,
    };
    const r = route("route.shared", "resource.search.image", [target("primary", okAdapter("primary"))], { idempotent: true, cacheTtlMs: 0 });
    await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "breaker-1", sharedState: shared, policy: { idempotent: true, cacheTtlMs: 0 } }));
    expect(records.some((rec) => rec.targetId === "primary" && rec.success === true)).toBe(true);
  });

  it("records failure into the shared breaker when the adapter throws", async () => {
    const records: Array<{ targetId: string; success: boolean }> = [];
    const breakerStore: BreakerStore = {
      getState: () => undefined,
      record: (targetId, success) => records.push({ targetId, success }),
      tryClose: () => false,
      snapshotAll: () => new Map(),
      isAvailable: () => true,
    };
    const shared: SharedStateManager = {
      ...createNoopSharedStateManager(baseConfig()),
      breaker: breakerStore,
    };
    const failing = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] as Array<"search" | "generate"> },
      search: async () => { throw Object.assign(new Error("upstream 5xx"), { status: 503 }); },
    } as ResourceAdapter;
    const r = route("route.fail", "resource.search.image", [target("primary", failing)], { idempotent: false, cacheTtlMs: 0 });
    await dispatchRoute([r], dispatchOptionsFor(r, { requestKey: "breaker-2", sharedState: shared, policy: { idempotent: false, cacheTtlMs: 0 } }));
    expect(records.some((rec) => rec.targetId === "primary" && rec.success === false)).toBe(true);
  });
});
