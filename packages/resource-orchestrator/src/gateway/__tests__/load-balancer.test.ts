import { describe, expect, it } from "vitest";
import { pickTarget } from "../load-balancer";
import { createContext } from "../context";
import type { Target } from "../route";
import type { AdapterSearchResult, AdapterDescriptor } from "@axi/gateway-contracts";

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

describe("load balancer", () => {
  it("returns undefined for an empty pool", () => {
    expect(pickTarget([], "round-robin", ctx())).toBeUndefined();
  });

  it("round-robin cycles through targets", () => {
    const pool = [target("a"), target("b")];
    const c = ctx();
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("a");
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("b");
    expect(pickTarget(pool, "round-robin", c)?.id).toBe("a");
  });

  it("weighted-round-robin honors weight ratios", () => {
    const pool = [target("a", 3), target("b", 1)];
    const c = ctx();
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 8; i += 1) {
      const picked = pickTarget(pool, "weighted-round-robin", c);
      if (picked) counts[picked.id as "a" | "b"] += 1;
    }
    expect(counts.a).toBe(6);
    expect(counts.b).toBe(2);
  });

  it("sticky-by-query is stable for the same query", () => {
    const pool = [target("a"), target("b")];
    const first = pickTarget(pool, "sticky-by-query", ctx({ query: "avatar" }));
    const second = pickTarget(pool, "sticky-by-query", ctx({ query: "avatar" }));
    expect(first?.id).toBe(second?.id);
  });

  it("sticky-by-query distributes across different queries", () => {
    const pool = [target("a"), target("b"), target("c"), target("d")];
    const ids = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const picked = pickTarget(pool, "sticky-by-query", ctx({ query: `q-${i}` }));
      if (picked) ids.add(picked.id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it("failover-only picks the first non-fallback target", () => {
    const pool = [target("primary"), target("backup", 1, true)];
    expect(pickTarget(pool, "failover-only", ctx())?.id).toBe("primary");
  });

  it("excludes fallback targets when healthy alternatives exist", () => {
    const pool = [target("a"), target("fallback", 1, true)];
    expect(pickTarget(pool, "round-robin", ctx())?.id).toBe("a");
  });
});
