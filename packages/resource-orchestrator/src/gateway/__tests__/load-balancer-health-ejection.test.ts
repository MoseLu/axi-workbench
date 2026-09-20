import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pickTarget, cachedHealthStatus, __resetHealthCacheForTests } from "../load-balancer";
import { createContext } from "../context";
import type { Target } from "../route";
import type { AdapterSearchResult, AdapterDescriptor } from "@axi/gateway-contracts";
import type { HealthRegistry, HealthStatus } from "../registries/health-registry";

/* -------------------------------------------------------------------------- */
/*  Test fixtures                                                              */
/* -------------------------------------------------------------------------- */

const dummyAdapter = (id: string): Target["adapter"] => ({
  descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] } as AdapterDescriptor,
  search: async () => ({ items: [], sourceVersion: "x", confidence: "low", mode: "fixture" } as AdapterSearchResult),
});

const target = (id: string, weight = 1, fallback = false): Target => ({
  id, adapter: dummyAdapter(id) as unknown as Target["adapter"], weight, timeoutMs: 1000, fallback,
});

const ctx = (over: { query?: string; toolId?: string; routeId?: string } = {}) =>
  createContext({
    requestKey: "k",
    intent: { operation: "search", resourceKinds: ["image"], constraints: { query: over.query ?? "头像" }, needsClarification: false },
    routeId: over.routeId ?? "r",
    toolId: over.toolId ?? "resource.search.image",
    cache: new Map(),
  });

/** Programmable HealthRegistry double. Counts how many times
 *  `forFactory` is called so cache-hit assertions can read the
 *  counter directly without spying on a Map.get. */
class FakeHealthRegistry implements HealthRegistry {
  private readonly states = new Map<string, HealthStatus>();
  readonly forFactoryCalls: Array<{ factoryId: string; at: number }> = [];
  private now = 0;

  set(factoryId: string, status: HealthStatus): void {
    this.states.set(factoryId, status);
  }

  /** Advance the test clock by `ms`. The cache TTL is wall-clock, so
   *  advancing the clock past 1s invalidates every entry. */
  advance(ms: number): void {
    this.now += ms;
  }

  forFactory(factoryId: string): HealthStatus {
    this.forFactoryCalls.push({ factoryId, at: this.now });
    return this.states.get(factoryId) ?? "unknown";
  }

  snapshot() {
    return {
      factories: Array.from(this.states.entries()).map(([factoryId, status]) => ({ factoryId, status })),
      overall: "unknown" as HealthStatus,
    };
  }

  registerCheck(): void { /* unused */ }
  stop(): void { /* unused */ }
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe("load balancer — GHA-NEXT-037 health ejection", () => {
  let registry: FakeHealthRegistry;

  beforeEach(() => {
    registry = new FakeHealthRegistry();
    __resetHealthCacheForTests(registry);
  });

  afterEach(() => {
    __resetHealthCacheForTests(registry);
  });

  it("excludes factories marked ejected from the candidate pool", () => {
    registry.set("a", "healthy");
    registry.set("b", "ejected");
    const pool = [target("a"), target("b")];
    const c = ctx();
    for (let i = 0; i < 5; i += 1) {
      expect(pickTarget(pool, "round-robin", c, { healthRegistry: registry })?.id).toBe("a");
    }
  });

  it("weighted-round-robin drops ejected factories and ignores their weight", () => {
    registry.set("a", "healthy");
    registry.set("b", "ejected");
    const pool = [target("a", 1), target("b", 99)];
    const c = ctx();
    for (let i = 0; i < 12; i += 1) {
      expect(pickTarget(pool, "weighted-round-robin", c, { healthRegistry: registry })?.id).toBe("a");
    }
  });

  it("sticky-by-query only hashes over the non-ejected sub-pool", () => {
    registry.set("a", "healthy");
    registry.set("b", "ejected");
    const pool = [target("a"), target("b")];
    const c = ctx();
    for (let i = 0; i < 20; i += 1) {
      expect(pickTarget(pool, "sticky-by-query", c, { healthRegistry: registry })?.id).toBe("a");
    }
  });

  it("failover-only skips an ejected head target", () => {
    registry.set("primary", "ejected");
    registry.set("backup", "healthy");
    const pool = [target("primary"), target("backup")];
    expect(pickTarget(pool, "failover-only", ctx(), { healthRegistry: registry })?.id).toBe("backup");
  });

  it("falls back to the unfiltered pool when every target is ejected", () => {
    registry.set("a", "ejected");
    registry.set("b", "ejected");
    const pool = [target("a"), target("b")];
    const c = ctx();
    const picks = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      const picked = pickTarget(pool, "round-robin", c, { healthRegistry: registry });
      if (picked) picks.add(picked.id);
    }
    expect(picks.has("a") || picks.has("b")).toBe(true);
  });

  it("does not call forFactory more than once per factory within the 1s TTL", () => {
    registry.set("a", "healthy");
    registry.set("b", "healthy");
    const pool = [target("a"), target("b")];
    const c = ctx();
    for (let i = 0; i < 100; i += 1) {
      pickTarget(pool, "round-robin", c, { healthRegistry: registry, now: () => 0 });
    }
    const counts = new Map<string, number>();
    for (const call of registry.forFactoryCalls) {
      counts.set(call.factoryId, (counts.get(call.factoryId) ?? 0) + 1);
    }
    expect(counts.get("a") ?? 0).toBe(1);
    expect(counts.get("b") ?? 0).toBe(1);
  });

  it("re-reads forFactory after the TTL window expires", () => {
    registry.set("a", "healthy");
    const pool = [target("a")];
    let now = 0;
    pickTarget(pool, "round-robin", ctx(), { healthRegistry: registry, now: () => now });
    expect(registry.forFactoryCalls.length).toBe(1);
    now = 999;
    pickTarget(pool, "round-robin", ctx(), { healthRegistry: registry, now: () => now });
    expect(registry.forFactoryCalls.length).toBe(1);
    now = 1_000;
    pickTarget(pool, "round-robin", ctx(), { healthRegistry: registry, now: () => now });
    expect(registry.forFactoryCalls.length).toBe(2);
  });

  it("reflects a status flip (healthy → ejected) after the TTL window expires", () => {
    registry.set("b", "healthy");
    const pool = [target("b")];
    const c = ctx();
    pickTarget(pool, "round-robin", c, { healthRegistry: registry, now: () => 0 });
    expect(registry.forFactoryCalls.length).toBe(1);
    registry.set("b", "ejected");
    pickTarget(pool, "round-robin", c, { healthRegistry: registry, now: () => 500 });
    expect(registry.forFactoryCalls.length).toBe(1);
    pickTarget(pool, "round-robin", c, { healthRegistry: registry, now: () => 1_500 });
    expect(registry.forFactoryCalls.length).toBe(2);
  });

  it("preserves legacy behaviour when no HealthRegistry is supplied", () => {
    const pool = [target("a"), target("b"), target("c")];
    const c = ctx();
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("a");
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("b");
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("c");
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("a");
  });

  it("treats non-ejected statuses (healthy / degraded / unknown / recovering) as eligible", () => {
    registry.set("healthy", "healthy");
    registry.set("degraded", "degraded");
    registry.set("unknown", "unknown");
    registry.set("recovering", "recovering");
    registry.set("unhealthy", "unhealthy");
    registry.set("ejected", "ejected");
    const pool = [
      target("healthy"),
      target("degraded"),
      target("unknown"),
      target("recovering"),
      target("unhealthy"),
      target("ejected"),
    ];
    const c = ctx();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const picked = pickTarget(pool, "round-robin", c, { healthRegistry: registry, now: () => 0 });
      if (picked) seen.add(picked.id);
    }
    expect(seen.has("ejected")).toBe(false);
    expect(seen.has("healthy")).toBe(true);
    expect(seen.has("degraded")).toBe(true);
    expect(seen.has("unknown")).toBe(true);
    expect(seen.has("recovering")).toBe(true);
    expect(seen.has("unhealthy")).toBe(true);
  });

  it("cachedHealthStatus exposes the same TTL cache used by pickTarget", () => {
    registry.set("a", "healthy");
    expect(cachedHealthStatus(registry, "a", 0)).toBe("healthy");
    expect(registry.forFactoryCalls.length).toBe(1);
    expect(cachedHealthStatus(registry, "a", 500)).toBe("healthy");
    expect(registry.forFactoryCalls.length).toBe(1);
    registry.set("a", "ejected");
    expect(cachedHealthStatus(registry, "a", 999)).toBe("healthy");
    expect(registry.forFactoryCalls.length).toBe(1);
    expect(cachedHealthStatus(registry, "a", 1_500)).toBe("ejected");
    expect(registry.forFactoryCalls.length).toBe(2);
  });

  it("does not pollute the cache across two registries", () => {
    const other = new FakeHealthRegistry();
    __resetHealthCacheForTests(other);
    try {
      registry.set("a", "ejected");
      other.set("a", "healthy");
      const pool = [target("a")];
      expect(pickTarget(pool, "failover-only", ctx(), { healthRegistry: registry, now: () => 0 })?.id).toBe("a");
      expect(pickTarget(pool, "failover-only", ctx(), { healthRegistry: other, now: () => 0 })?.id).toBe("a");
      expect(registry.forFactoryCalls.length).toBe(1);
      expect(other.forFactoryCalls.length).toBe(1);
    } finally {
      __resetHealthCacheForTests(other);
    }
  });
});