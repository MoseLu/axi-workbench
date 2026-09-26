import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import { ProviderRegistry } from "../provider-registry";
import { dispatchRoute, dispatchParallel, __resetInFlight } from "../dispatch";
import type { RouteDefinition } from "../route";
import { intentKind } from "../predicates";
import { traceFilter, cacheStoreFilter, cacheLookupFilter, composeFilters } from "../filters";
import { GatewayOrchestrator } from "..";

const makeAdapter = (descriptor: ResourceAdapter["descriptor"], result: AdapterSearchResult): ResourceAdapter => ({
  descriptor, search: async () => result,
});

const imageAdapter = (id: string, items: number, confidence: AdapterSearchResult["confidence"] = "high"): ResourceAdapter =>
  makeAdapter(
    { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
    {
      items: Array.from({ length: items }, (_, i) => ({
        id: `image:${id}-${i}`, kind: "image", title: `${id}-${i}`, facts: { tags: [id] },
        provenance: { provider: id, ref: `${id}://${i}` }, safety: "safe",
      })),
      sourceVersion: id, confidence, mode: "live",
    },
  );

const skillAdapter = (id: string, items: number): ResourceAdapter =>
  makeAdapter(
    { id, label: id, resourceKinds: ["skill"], capabilities: ["search"] },
    {
      items: Array.from({ length: items }, (_, i) => ({
        id: `skill:${id}-${i}`, kind: "skill", title: `${id}-${i}`, facts: {},
        provenance: { provider: id, ref: `${id}://${i}` }, safety: "safe",
      })),
      sourceVersion: id, confidence: "high", mode: "live",
    },
  );

const fixtureAdapter = (id: string): ResourceAdapter =>
  makeAdapter(
    { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
    {
      items: [{ id: `fixture:${id}`, kind: "image", title: "fixture", facts: {},
        provenance: { provider: id, ref: "fixture://x" }, safety: "safe" }],
      sourceVersion: "fixture-v1", confidence: "high", mode: "fixture",
    },
  );

const buildRoutes = (): RouteDefinition[] => [
  {
    id: "route.image",
    toolId: "resource.search.image",
    description: "image search",
    predicates: [intentKind("image")],
    targets: [
      { id: "primary.axi-image-preview", adapter: imageAdapter("axi-image-preview", 3), weight: 5, timeoutMs: 1000 },
      { id: "primary.minimax-image", adapter: imageAdapter("minimax-tokenplan-image", 1), weight: 1, timeoutMs: 1000 },
      { id: "fallback.fixture-image", adapter: fixtureAdapter("fixture-image"), weight: 1, timeoutMs: 1000, fallback: true },
    ],
    filters: { pre: [traceFilter()], post: [composeFilters([])] },
    loadBalancer: "weighted-round-robin",
    concurrency: 2,
  },
  {
    id: "route.skill",
    toolId: "resource.search.skill",
    description: "skill search",
    predicates: [intentKind("skill")],
    targets: [
      { id: "primary.axi-docs", adapter: skillAdapter("axi-docs", 2), weight: 1, timeoutMs: 1000 },
      { id: "fallback.fixture-skill", adapter: skillAdapter("fixture-skill", 1), weight: 1, timeoutMs: 1000, fallback: true },
    ],
    filters: { pre: [], post: [] },
    loadBalancer: "failover-only",
  },
];

const imageIntent = (query = "头像"): Intent => ({
  operation: "search", resourceKinds: ["image"], constraints: { query }, needsClarification: false,
});

const skillIntent = (): Intent => ({
  operation: "search", resourceKinds: ["skill"], constraints: { query: "PPT" }, needsClarification: false,
});

describe("dispatchRoute", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("returns no-route when no route matches the toolId", async () => {
    const r = await dispatchRoute(buildRoutes(), {
      intent: imageIntent(), toolId: "resource.search.unknown",
      cache: new Map(), requestKey: "k1", breakers: new Map(),
    });
    expect(r.warnings?.some((w) => w.includes("no route matched"))).toBe(true);
  });

  it("returns adapter results from a successful target", async () => {
    const r = await dispatchRoute(buildRoutes(), {
      intent: imageIntent(), toolId: "resource.search.image",
      cache: new Map(), requestKey: "k2", breakers: new Map(),
    });
    expect(r.mode).toBe("live");
    expect(r.items.length).toBeGreaterThan(0);
  });

  it("falls back to fallback targets when primary fails", async () => {
    const failing: ResourceAdapter = {
      descriptor: { id: "failing-primary", label: "Failing primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { throw new Error("provider down"); },
    };
    const route: RouteDefinition = {
      id: "route.fallback",
      toolId: "resource.search.image",
      description: "fallback test",
      predicates: [intentKind("image")],
      targets: [
        { id: "primary.failing", adapter: failing, weight: 1, timeoutMs: 1000 },
        { id: "fallback.fixture", adapter: fixtureAdapter("fixture-fallback"), weight: 1, timeoutMs: 1000, fallback: true },
      ],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
    };
    const r = await dispatchRoute([route], {
      intent: imageIntent(), toolId: "resource.search.image",
      cache: new Map(), requestKey: "k3", breakers: new Map(),
    });
    expect(r.mode).toBe("fixture");
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.warnings?.some((w) => w.includes("primary.failing"))).toBe(true);
  });

  it("returns empty gateway result when all targets fail", async () => {
    const failing: ResourceAdapter = {
      descriptor: { id: "failing", label: "failing", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { throw new Error("down"); },
    };
    const route: RouteDefinition = {
      id: "route.empty",
      toolId: "resource.search.image",
      description: "all failing",
      predicates: [intentKind("image")],
      targets: [
        { id: "primary", adapter: failing, weight: 1, timeoutMs: 1000 },
        { id: "fallback", adapter: failing, weight: 1, timeoutMs: 1000, fallback: true },
      ],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
    };
    const r = await dispatchRoute([route], {
      intent: imageIntent(), toolId: "resource.search.image",
      cache: new Map(), requestKey: "k4", breakers: new Map(),
    });
    expect(r.items).toEqual([]);
    expect(r.sourceVersion).toBe("gateway:empty");
  });

  it("routes skill searches through the skill route", async () => {
    const r = await dispatchRoute(buildRoutes(), {
      intent: skillIntent(), toolId: "resource.search.skill",
      cache: new Map(), requestKey: "k5", breakers: new Map(),
    });
    expect(r.items.every((i) => i.kind === "skill")).toBe(true);
  });

  it("fans out parallel targets when concurrency > 1 and merges", async () => {
    const counters = { a: 0, b: 0 };
    const mk = (id: "a" | "b"): ResourceAdapter => ({
      descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        counters[id] += 1;
        await new Promise((r) => setTimeout(r, 20));
        return {
          items: [{ id: `image:${id}`, kind: "image", title: id, facts: {}, provenance: { provider: id, ref: "x" }, safety: "safe" }],
          sourceVersion: id, confidence: "high", mode: "live",
        };
      },
    });
    const route: RouteDefinition = {
      id: "route.parallel",
      toolId: "resource.search.image",
      description: "parallel",
      predicates: [intentKind("image")],
      targets: [
        { id: "primary.a", adapter: mk("a"), weight: 1, timeoutMs: 1000 },
        { id: "primary.b", adapter: mk("b"), weight: 1, timeoutMs: 1000 },
      ],
      filters: { pre: [], post: [] },
      loadBalancer: "round-robin",
      concurrency: 2,
    };
    const r = await dispatchRoute([route], {
      intent: imageIntent(), toolId: "resource.search.image",
      cache: new Map(), requestKey: "k6", breakers: new Map(),
    });
    expect(counters.a).toBe(1);
    expect(counters.b).toBe(1);
    expect(r.items.length).toBe(2);
  });

  it("writes to cache after a successful dispatch and short-circuits on next hit", async () => {
    let calls = 0;
    const adapter: ResourceAdapter = {
      descriptor: { id: "cached", label: "cached", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        return {
          items: [{ id: "image:cached-1", kind: "image", title: "cached", facts: {}, provenance: { provider: "cached", ref: "x" }, safety: "safe" }],
          sourceVersion: "v1", confidence: "high", mode: "live",
        };
      },
    };
    const route: RouteDefinition = {
      id: "route.cached",
      toolId: "resource.search.image",
      description: "cached",
      predicates: [intentKind("image")],
      targets: [{ id: "primary", adapter, weight: 1, timeoutMs: 1000 }],
      filters: { pre: [traceFilter()], post: [cacheStoreFilter(60_000)] },
      loadBalancer: "failover-only",
    };
    const cache = new Map();
    const first = await dispatchRoute([route], {
      intent: imageIntent(), toolId: "resource.search.image",
      cache, requestKey: "k-cache", breakers: new Map(),
    });
    expect(first.items.length).toBeGreaterThan(0);
    expect(calls).toBe(1);
    expect(cache.size).toBe(1);

    const lookupRoute: RouteDefinition = {
      ...route,
      filters: { pre: [traceFilter(), cacheLookupFilter()], post: [] },
    };
    const second = await dispatchRoute([lookupRoute], {
      intent: imageIntent(), toolId: "resource.search.image",
      cache, requestKey: "k-cache", breakers: new Map(),
    });
    expect(second.items.length).toBeGreaterThan(0);
    expect(calls).toBe(1);
  });
});

describe("dispatchParallel", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("runs multiple routes concurrently", async () => {
    const results = await dispatchParallel(buildRoutes(), [
      { intent: imageIntent(), toolId: "resource.search.image", cache: new Map(), requestKey: "kA", breakers: new Map() },
      { intent: skillIntent(), toolId: "resource.search.skill", cache: new Map(), requestKey: "kB", breakers: new Map() },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].items.every((i) => i.kind === "image")).toBe(true);
    expect(results[1].items.every((i) => i.kind === "skill")).toBe(true);
  });

  it("coalesces identical concurrent dispatches in the same run", async () => {
    let calls = 0;
    const adapter: ResourceAdapter = {
      descriptor: { id: "coalesce", label: "coalesce", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return {
          items: [{ id: "image:co", kind: "image", title: "co", facts: {}, provenance: { provider: "coalesce", ref: "x" }, safety: "safe" }],
          sourceVersion: "v", confidence: "high", mode: "live",
        };
      },
    };
    const route: RouteDefinition = {
      id: "route.coalesce",
      toolId: "resource.search.image",
      description: "coalesce",
      predicates: [intentKind("image")],
      targets: [{ id: "primary", adapter, weight: 1, timeoutMs: 1000 }],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
    };
    const cache = new Map();
    const breakers = new Map();
    // GHA-NEXT-008 — share a single `CoalescingRegistry` across both
    // options inside ONE `dispatchParallel` call. Each top-level
    // `dispatchParallel` invocation now constructs its own
    // coalescing registry, so two separate calls no longer share
    // state. This matches the new contract: callers that need
    // cross-call coalescing must pass `options.coalescing`.
    const results = await dispatchParallel([route], [
      { intent: imageIntent(), toolId: "resource.search.image", cache, requestKey: "same", breakers },
      { intent: imageIntent(), toolId: "resource.search.image", cache, requestKey: "same", breakers },
    ]);
    expect(calls).toBe(1);
    expect(results).toHaveLength(2);
    expect(results[0].items).toEqual(results[1].items);
  });
});

describe("GatewayOrchestrator", () => {
  it("dispatches through the registered routes", async () => {
    const orchestrator = new GatewayOrchestrator({ routes: buildRoutes() });
    const r = await orchestrator.dispatch({ intent: imageIntent(), toolId: "resource.search.image", requestKey: "k-orch" });
    expect(r.items.length).toBeGreaterThan(0);
  });

  it("keeps breakers across dispatches", async () => {
    const orchestrator = new GatewayOrchestrator({ routes: buildRoutes() });
    expect(orchestrator.breakers.size).toBe(0);
    await orchestrator.dispatch({ intent: imageIntent(), toolId: "resource.search.image", requestKey: "k-orch-2" });
    expect(orchestrator.breakers.size).toBeGreaterThan(0);
  });

  it("lists routes", () => {
    const orchestrator = new GatewayOrchestrator({ routes: buildRoutes() });
    expect(orchestrator.listRoutes().map((r) => r.id)).toEqual(["route.image", "route.skill"]);
  });
});

describe("ProviderRegistry", () => {
  it("rejects duplicate factory ids", () => {
    const registry = new ProviderRegistry();
    registry.registerFactory("f", () => imageAdapter("a", 1));
    expect(() => registry.registerFactory("f", () => imageAdapter("b", 1))).toThrow();
  });

  it("builds routes from a manifest", () => {
    const registry = new ProviderRegistry({ freezeOnBuild: true });
    registry.registerFactory("image-factory", () => imageAdapter("axi-image-preview", 2));
    registry.registerFactory("fixture-factory", () => fixtureAdapter("fixture-image"));
    registry.buildFromManifest({
      providers: [
        { id: "image-factory", factory: "image-factory" },
        { id: "fixture-factory", factory: "fixture-factory" },
      ],
      targets: [
        { id: "image-factory.axi-image-preview", providerId: "axi-image-preview" },
        { id: "fixture-factory.fixture-image", providerId: "fixture-image", fallback: true },
      ],
      routes: [
        {
          id: "route.image", toolId: "resource.search.image", description: "image",
          predicates: ["by-resource-kind-image"], targetIds: ["image-factory.axi-image-preview"],
          loadBalancer: "failover-only",
        },
        {
          id: "route.image-fallback", toolId: "resource.search.image", description: "image fallback",
          predicates: ["by-resource-kind-image"], targetIds: ["fixture-factory.fixture-image"],
          loadBalancer: "failover-only",
        },
      ],
    });
    expect(registry.listRoutes()).toHaveLength(2);
    expect(registry.routeFor("resource.search.image")).toBeTruthy();
    expect(registry.adapterFor("image-factory.axi-image-preview")).toBeTruthy();
  });

  it("throws UnknownTargetError when manifest references an unknown target", () => {
    const registry = new ProviderRegistry();
    registry.registerFactory("image-factory", () => imageAdapter("axi-image-preview", 1));
    expect(() => registry.buildFromManifest({
      providers: [{ id: "image-factory", factory: "image-factory" }],
      targets: [{ id: "image-factory.axi-image-preview", providerId: "axi-image-preview" }],
      routes: [{ id: "r", toolId: "t", description: "d", predicates: ["always-true"], targetIds: ["missing"] }],
    })).toThrow(/Unknown target id/);
  });

  it("throws when manifest target id is not strictly two-level", () => {
    const registry = new ProviderRegistry();
    registry.registerFactory("f", () => imageAdapter("p", 1));
    expect(() => registry.buildFromManifest({
      providers: [{ id: "f", factory: "f" }],
      targets: [{ id: "single-level", providerId: "p" }],
      routes: [{ id: "r", toolId: "t", description: "d", predicates: ["always-true"], targetIds: ["single-level"] }],
    })).toThrow(/strictly two-level|<factoryId>\.<providerId>/);
  });
});
