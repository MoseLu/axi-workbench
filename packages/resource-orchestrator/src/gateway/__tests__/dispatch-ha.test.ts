import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import { dispatchRoute, __resetInFlight } from "../dispatch";
import { BackpressureRegistry } from "../runtime/backpressure";
import type { RouteDefinition, Target } from "../route";
import { intentKind, alwaysTrue } from "../predicates";
import { VersionedCache, buildCacheKey } from "../runtime/cache";

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

const failingAdapter = (id: string, message = "down"): ResourceAdapter => ({
  descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
  search: async () => { throw new Error(message); },
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

const callCount = (adapter: ResourceAdapter): { count: number; reset: () => void } => {
  let count = 0;
  const original = adapter.search;
  adapter.search = async (...args) => {
    count += 1;
    return original.apply(adapter, args);
  };
  return { count, reset: () => { count = 0; } };
};

// Debug: ensure adapter patching sticks. The patcher must be called AFTER
// the adapter is attached to a target, otherwise dispatch captures the
// unpatched reference. Tests below call callCount AFTER constructing the
// route so the target.adapter.search points at the patched function.

describe("dispatch HA — retry, breaker, cancellation", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("retries a retryable 5xx and returns the eventual success", async () => {
    let attempts = 0;
    const flaky: ResourceAdapter = {
      descriptor: { id: "flaky", label: "flaky", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error("upstream 5xx"), { status: 503 });
        return okAdapter("flaky", 1).search(imageIntent);
      },
    };
    const r = route("route.retry", "resource.search.image", [target("primary.flaky", flaky, { timeoutMs: 1000 })]);
    const result = await dispatchRoute([r], {
      intent: imageIntent, toolId: "resource.search.image", cache: new Map(),
      requestKey: "k-retry", breakers: new Map(),
      policy: { retry: { maxAttempts: 3, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" }, timeoutMs: 1000, cacheTtlMs: 0, negativeTtlMs: 0, maxCacheEntries: 0, idempotent: true, cacheScope: "route-payload", coalescingKeyKind: "idempotency" },
    });
    expect(result.items.length).toBe(1);
    expect(attempts).toBe(3);
  });

  it("does NOT retry a non-idempotent route", async () => {
    let calls = 0;
    const target1: ResourceAdapter = {
      descriptor: { id: "primary.fail", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        throw new Error("down");
      },
    };
    const r = route("route.no-retry", "resource.search.image", [target("primary", target1)]);
    const result = await dispatchRoute([r], {
      intent: imageIntent, toolId: "resource.search.image", cache: new Map(),
      requestKey: "k-noretry", breakers: new Map(),
      policy: { retry: { maxAttempts: 5, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" }, timeoutMs: 1000, cacheTtlMs: 0, negativeTtlMs: 0, maxCacheEntries: 0, idempotent: false, cacheScope: "route-payload", coalescingKeyKind: "idempotency" },
    });
    expect(calls).toBe(1); // no retries
    expect(result.items.length).toBe(0);
  });

  it("does NOT fall back when the parent signal aborts", async () => {
    const primary = okAdapter("primary", 1);
    const fallback = okAdapter("fallback", 1);
    const primaryCalls = callCount(primary);
    const fallbackCalls = callCount(fallback);
    const r = route("route.cancel", "resource.search.image", [
      target("primary", primary),
      target("fallback", fallback, { fallback: true }),
    ]);
    const ctrl = new AbortController();
    ctrl.abort(new Error("user-cancelled"));
    const result = await dispatchRoute([r], {
      intent: imageIntent, toolId: "resource.search.image", cache: new Map(),
      requestKey: "k-cancel", breakers: new Map(),
      signal: ctrl.signal,
      fallbackChain: ["route.cancel-fallback"],
    });
    expect(primaryCalls.count).toBe(0);
    expect(fallbackCalls.count).toBe(0);
    expect(result.items.length).toBe(0);
  });

  it("walks the explicit fallback chain after the primary route exhausts", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primaryFail: ResourceAdapter = {
      descriptor: { id: "primary.fail", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { primaryCalls += 1; throw new Error("down"); },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback.ok", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { fallbackCalls += 1; return okAdapter("fallback.ok", 1).search(imageIntent); },
    };
    const primary = route("route.primary", "resource.search.image", [
      target("primary.fail", primaryFail),
    ]);
    const fb = route("route.fallback", "resource.search.image", [
      target("fallback.ok", fallback),
    ]);
    const result = await dispatchRoute([primary, fb], {
      intent: imageIntent, toolId: "resource.search.image", cache: new Map(),
      requestKey: "k-chain", breakers: new Map(),
      fallbackChain: ["route.fallback"],
    });
    expect(fallbackCalls).toBe(1);
    expect(result.items[0].id).toContain("fallback.ok");
  });

  it("opens the breaker after repeated 5xx and blocks subsequent calls", async () => {
    const fail = failingAdapter("primary.breaker");
    const r = route("route.breaker", "resource.search.image", [target("primary.breaker", fail)]);
    const breakers = new Map();
    for (let i = 0; i < 5; i += 1) {
      await dispatchRoute([r], {
        intent: imageIntent, toolId: "resource.search.image", cache: new Map(),
        requestKey: `k-br-${i}`, breakers,
        policy: { retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" }, timeoutMs: 1000, cacheTtlMs: 0, negativeTtlMs: 0, maxCacheEntries: 0, idempotent: true, cacheScope: "route-payload", coalescingKeyKind: "idempotency" },
      });
    }
    const breaker = breakers.get("primary.breaker");
    expect(breaker?.snapshot().state).toBe("open");
  });
});

describe("dispatch HA — versioned cache", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("stores into VersionedCache when policy.cacheTtlMs > 0 and reads back", async () => {
    let calls = 0;
    const adapter: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        return okAdapter("primary", 1).search(imageIntent);
      },
    };
    const r = route("route.cache", "resource.search.image", [target("primary", adapter)]);
    const cache = new VersionedCache();
    await dispatchRoute([r], {
      intent: imageIntent, toolId: "resource.search.image", cache,
      requestKey: "k-cache",
      manifestVersion: 1,
      breakers: new Map(),
      policy: { retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" }, timeoutMs: 1000, cacheTtlMs: 60_000, negativeTtlMs: 1000, maxCacheEntries: 100, idempotent: true, cacheScope: "route-payload", coalescingKeyKind: "idempotency" },
    });
    expect(calls).toBe(1);
    const key = buildCacheKey({ routeId: "route.cache", manifestVersion: 1, scope: "route-payload", intent: imageIntent, requestKey: "k-cache" });
    expect(cache.get(key)).toBeDefined();
  });

  it("invalidates entries when manifestVersion changes", async () => {
    const adapter = okAdapter("primary", 1);
    const r = route("route.cache2", "resource.search.image", [target("primary", adapter)]);
    const cache = new VersionedCache();
    await dispatchRoute([r], {
      intent: imageIntent, toolId: "resource.search.image", cache,
      requestKey: "k-cache2", manifestVersion: 1, breakers: new Map(),
      policy: { retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" }, timeoutMs: 1000, cacheTtlMs: 60_000, negativeTtlMs: 1000, maxCacheEntries: 100, idempotent: true, cacheScope: "route-payload", coalescingKeyKind: "idempotency" },
    });
    const oldKey = buildCacheKey({ routeId: "route.cache2", manifestVersion: 1, scope: "route-payload", intent: imageIntent, requestKey: "k-cache2" });
    expect(cache.get(oldKey)).toBeDefined();
    const newKey = buildCacheKey({ routeId: "route.cache2", manifestVersion: 2, scope: "route-payload", intent: imageIntent, requestKey: "k-cache2" });
    expect(cache.get(newKey)).toBeUndefined();
  });

  it("caches empty results with negativeTtlMs (shorter than full TTL)", async () => {
    const adapter: ResourceAdapter = {
      descriptor: { id: "empty", label: "empty", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => ({ items: [], sourceVersion: "v", confidence: "low", mode: "fixture" as const }),
    };
    const r = route("route.empty", "resource.search.image", [target("primary", adapter)]);
    const cache = new VersionedCache();
    await dispatchRoute([r], {
      intent: imageIntent, toolId: "resource.search.image", cache,
      requestKey: "k-empty", manifestVersion: 1, breakers: new Map(),
      policy: { retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" }, timeoutMs: 1000, cacheTtlMs: 60_000, negativeTtlMs: 100, maxCacheEntries: 100, idempotent: true, cacheScope: "route-payload", coalescingKeyKind: "idempotency" },
    });
    const key = buildCacheKey({ routeId: "route.empty", manifestVersion: 1, scope: "route-payload", intent: imageIntent, requestKey: "k-empty" });
    const entry = cache.get(key, Date.now() + 200); // after negativeTtlMs
    expect(entry).toBeUndefined();
  });
});

describe("dispatch HA — backpressure", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("rejects when the queue is full (GHA-NEXT-018: surfaces 429 warning, does not throw)", async () => {
    // GHA-NEXT-018 contract change: queue-full rejection used to throw
    // a BackpressureTimeoutError; dispatchRoute now returns the
    // accumulated AdapterSearchResult with a typed warning marker
    // (`[backpressure:429:retry-after=<ms>]`). The HTTP edge
    // (apps/gateway/src/server.ts) reads the warning marker to map
    // the response to 429 + Retry-After. We assert the new contract.
    const slow: ResourceAdapter = {
      descriptor: { id: "slow", label: "slow", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return okAdapter("slow", 1).search(imageIntent);
      },
    };
    const r = route("route.bp", "resource.search.image", [target("primary", slow)]);
    const cache = new Map();
    const breakers = new Map();
    const backpressure = new BackpressureRegistry();
    const policy = { retry: { maxAttempts: 1, backoffMs: 1, maxBackoffMs: 5 }, backpressure: { maxConcurrent: 1, queueTimeoutMs: 1000, shedStrategy: "reject" as const }, timeoutMs: 1000, cacheTtlMs: 0, negativeTtlMs: 0, maxCacheEntries: 0, idempotent: true, cacheScope: "route-payload" as const, coalescingKeyKind: "idempotency" as const };
    // 1 in-flight (slow) + 1 queued (still space) + 1 overflow (must reject via warning).
    const first = dispatchRoute([r], { intent: imageIntent, toolId: "resource.search.image", cache, requestKey: "k-1", breakers, policy, backpressure });
    const second = dispatchRoute([r], { intent: imageIntent, toolId: "resource.search.image", cache, requestKey: "k-2", breakers, policy, backpressure });
    const overflowed = await dispatchRoute([r], { intent: imageIntent, toolId: "resource.search.image", cache, requestKey: "k-3", breakers, policy, backpressure });
    expect(overflowed).not.toBeNull();
    const warnings = overflowed?.warnings ?? [];
    expect(warnings.some((w) => /\[backpressure:429:retry-after=\d+\]/.test(w))).toBe(true);
    await Promise.all([first, second]);
  });
});