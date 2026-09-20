import { describe, expect, it } from "vitest";
import { createContext } from "../context";
import {
  cacheLookupFilter, cacheStoreFilter, dedupFilter, normalizeFilter, traceFilter, composeFilters,
} from "../filters";
import type { RouteContext } from "../route";
import type { AdapterSearchResult, ResourceCandidate } from "@axi/gateway-contracts";

const ctx = (over: Partial<{ requestKey: string; routeId: string }> = {}): RouteContext =>
  createContext({
    requestKey: over.requestKey ?? "request-1",
    routeId: over.routeId ?? "r1",
    intent: { operation: "search", resourceKinds: ["image"], constraints: { query: "头像" }, needsClarification: false },
    toolId: "resource.search.image",
    cache: new Map(),
  });

const mkItem = (id: string): ResourceCandidate => ({
  id, kind: "image", title: id, facts: {}, provenance: { provider: "p", ref: "r" }, safety: "safe",
});

const result = (items: ResourceCandidate[], version = "v1"): AdapterSearchResult => ({
  items, sourceVersion: version, confidence: "high", mode: "live",
});

describe("filter chain", () => {
  it("trace filter records start and done lines", async () => {
    const context = ctx();
    context.result = result([]);
    await traceFilter().apply(context, async () => context);
    expect(context.trace).toEqual(["[r1] start", "[r1] done (0 items)"]);
  });

  it("cache lookup short-circuits when an unexpired entry exists", async () => {
    const context = ctx();
    const cache = new Map();
    const stored = result([mkItem("image:1")]);
    cache.set(context.requestKey, { result: stored, expiresAt: Date.now() + 1000, source: "previous" });
    (context as unknown as { cache: Map<string, unknown> }).cache = cache;
    let nextCalled = false;
    await cacheLookupFilter().apply(context, async () => { nextCalled = true; return context; });
    expect(nextCalled).toBe(false);
    expect(context.shortCircuit).toBe(true);
    expect(context.result?.items).toEqual(stored.items);
  });

  it("cache lookup misses when the entry is expired", async () => {
    const context = ctx();
    const cache = new Map();
    cache.set(context.requestKey, { result: result([]), expiresAt: Date.now() - 1, source: "old" });
    (context as unknown as { cache: Map<string, unknown> }).cache = cache;
    let nextCalled = false;
    await cacheLookupFilter().apply(context, async () => { nextCalled = true; return context; });
    expect(nextCalled).toBe(true);
  });

  it("cache store persists the result with TTL", async () => {
    const context = ctx();
    const cache = new Map();
    (context as unknown as { cache: Map<string, unknown> }).cache = cache;
    context.result = result([]);
    await cacheStoreFilter(5000).apply(context, async () => context);
    const entry = cache.get(context.requestKey) as { result: AdapterSearchResult; expiresAt: number } | undefined;
    expect(entry).toBeTruthy();
    expect(entry?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("normalize clamps items to 12", async () => {
    const context = ctx();
    context.result = result(Array.from({ length: 20 }, (_, i) => mkItem(`i-${i}`)));
    await normalizeFilter().apply(context, async () => context);
    expect(context.result?.items).toHaveLength(12);
  });

  it("dedup removes duplicates by id while preserving order", async () => {
    const context = ctx();
    context.result = result([mkItem("a"), mkItem("b"), mkItem("a")]);
    await dedupFilter().apply(context, async () => context);
    expect(context.result?.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("composeFilters runs filters in order", async () => {
    const context = ctx();
    context.result = result([mkItem("i-0"), mkItem("i-1"), mkItem("i-2")]);
    const chain = composeFilters([traceFilter(), normalizeFilter(), dedupFilter()]);
    await chain.apply(context, async () => context);
    expect(context.result?.items).toHaveLength(3);
    expect(context.trace.length).toBeGreaterThan(0);
  });
});
