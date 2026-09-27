import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import {
  NoopRouteRegistry,
  NoopPolicyRegistry,
  NoopHealthRegistry,
  type RouteRegistry,
  type PolicyRegistry,
  type HealthRegistry,
} from "../registries";
import { GatewayOrchestrator } from "..";
import { intentKind } from "../predicates";
import type { RouteDefinition } from "../route";

/* -------------------------------------------------------------------------- */
/* Test helpers                                                                */
/* -------------------------------------------------------------------------- */

const makeAdapter = (descriptor: ResourceAdapter["descriptor"], result: AdapterSearchResult): ResourceAdapter => ({
  descriptor, search: async () => result,
});

const imageAdapter = (id: string, items: number): ResourceAdapter =>
  makeAdapter(
    { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
    {
      items: Array.from({ length: items }, (_, i) => ({
        id: `image:${id}-${i}`, kind: "image" as const, title: `${id}-${i}`, facts: { tags: [id] },
        provenance: { provider: id, ref: `${id}://${i}` }, safety: "safe" as const,
      })),
      sourceVersion: id, confidence: "high" as const, mode: "live" as const,
    },
  );

const buildRoutes = (): RouteDefinition[] => [
  {
    id: "route.image",
    toolId: "resource.search.image",
    description: "image search",
    predicates: [intentKind("image")],
    targets: [
      { id: "primary.axi-image", adapter: imageAdapter("axi-image", 2), weight: 5, timeoutMs: 1000 },
      { id: "fallback.fixture-image", adapter: imageAdapter("fixture-image", 1), weight: 1, timeoutMs: 1000, fallback: true },
    ],
    filters: { pre: [], post: [] },
    loadBalancer: "weighted-round-robin",
    concurrency: 2,
    idempotent: true,
    cacheTtlMs: 60_000,
  },
  {
    id: "route.generate.image",
    toolId: "resource.generate.image",
    description: "image generation (non-idempotent)",
    predicates: [intentKind("image")],
    targets: [
      { id: "primary.minimax-image", adapter: imageAdapter("minimax", 1), weight: 1, timeoutMs: 2000 },
    ],
    filters: { pre: [], post: [] },
    loadBalancer: "failover-only",
    idempotent: false,
    cacheTtlMs: 0,
  },
];

const imageIntent = (query = "mountain"): Intent => ({
  operation: "search", resourceKinds: ["image"], constraints: { query }, needsClarification: false,
});

/* -------------------------------------------------------------------------- */
/* NoopRouteRegistry                                                           */
/* -------------------------------------------------------------------------- */

describe("NoopRouteRegistry", () => {
  it("lists all routes", () => {
    const routes = buildRoutes();
    const registry = new NoopRouteRegistry(routes);
    expect(registry.list()).toBe(routes);
    expect(registry.list()).toHaveLength(2);
  });

  it("looks up the primary route for a toolId", () => {
    const routes = buildRoutes();
    const registry = new NoopRouteRegistry(routes);
    const found = registry.lookup("resource.search.image");
    expect(found?.id).toBe("route.image");
  });

  it("returns undefined for an unknown toolId", () => {
    const registry = new NoopRouteRegistry(buildRoutes());
    expect(registry.lookup("resource.search.unknown")).toBeUndefined();
  });

  it("excludes routes ending with -fallback from lookup", () => {
    const routes: RouteDefinition[] = [
      {
        id: "route.image",
        toolId: "resource.search.image",
        description: "primary",
        predicates: [intentKind("image")],
        targets: [
          { id: "p.a", adapter: imageAdapter("a", 1), weight: 1, timeoutMs: 1000 },
        ],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      },
      {
        id: "route.image-fallback",
        toolId: "resource.search.image",
        description: "fallback",
        predicates: [intentKind("image")],
        targets: [
          { id: "f.b", adapter: imageAdapter("b", 1), weight: 1, timeoutMs: 1000 },
        ],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
        // @ts-expect-error — fallback is not in the public schema but allowed at runtime
        fallback: true,
      },
    ];
    const registry = new NoopRouteRegistry(routes);
    const found = registry.lookup("resource.search.image");
    expect(found?.id).toBe("route.image");
  });

  it("returns a snapshot with route count", () => {
    const registry = new NoopRouteRegistry(buildRoutes());
    const snap = registry.snapshot();
    expect(snap.count).toBe(2);
    expect(snap.routes).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* NoopPolicyRegistry                                                          */
/* -------------------------------------------------------------------------- */

describe("NoopPolicyRegistry", () => {
  it("derives idempotent=true for search routes without explicit flag", () => {
    const route = buildRoutes()[0];
    const registry = new NoopPolicyRegistry({ routes: buildRoutes() });
    expect(registry.deriveIdempotent(route)).toBe(true);
  });

  it("derives idempotent=false for resource.generate.* routes without explicit flag", () => {
    const routes: RouteDefinition[] = [
      {
        id: "route.gen",
        toolId: "resource.generate.image",
        description: "gen",
        predicates: [intentKind("image")],
        targets: [{ id: "a", adapter: imageAdapter("a", 1), weight: 1, timeoutMs: 1000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      },
    ];
    const registry = new NoopPolicyRegistry({ routes });
    expect(registry.deriveIdempotent(routes[0])).toBe(false);
  });

  it("uses explicit route.idempotent when present", () => {
    const route: RouteDefinition = {
      id: "route.x",
      toolId: "resource.search.image",
      description: "x",
      predicates: [intentKind("image")],
      targets: [{ id: "a", adapter: imageAdapter("a", 1), weight: 1, timeoutMs: 1000 }],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
      idempotent: false,
    };
    const registry = new NoopPolicyRegistry({ routes: [route] });
    expect(registry.deriveIdempotent(route)).toBe(false);
  });

  it("derives cacheTtlMs from route.cacheTtlMs", () => {
    const route = buildRoutes()[0];
    const registry = new NoopPolicyRegistry({ routes: buildRoutes() });
    expect(registry.deriveCacheTtl(route)).toBe(60_000);
  });

  it("falls back to gateway-level defaultCacheTtlMs", () => {
    const route: RouteDefinition = {
      id: "route.x",
      toolId: "resource.search.image",
      description: "x",
      predicates: [intentKind("image")],
      targets: [{ id: "a", adapter: imageAdapter("a", 1), weight: 1, timeoutMs: 1000 }],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
    };
    const registry = new NoopPolicyRegistry({ routes: [route], defaultCacheTtlMs: 30_000 });
    expect(registry.deriveCacheTtl(route)).toBe(30_000);
  });

  it("policyFor returns a complete DispatchPolicy", () => {
    const routes = buildRoutes();
    const registry = new NoopPolicyRegistry({ routes });
    const policy = registry.policyFor(routes[0]);
    expect(policy.idempotent).toBe(true);
    expect(policy.cacheTtlMs).toBe(60_000);
    expect(policy.coalescingKeyKind).toBe("idempotency");
    expect(policy.retry.maxAttempts).toBe(2);
    expect(policy.backpressure.maxConcurrent).toBeGreaterThan(0);
  });

  it("policyFor for non-idempotent route sets coalescingKeyKind to none", () => {
    const routes = buildRoutes();
    const registry = new NoopPolicyRegistry({ routes });
    const policy = registry.policyFor(routes[1]);
    expect(policy.idempotent).toBe(false);
    expect(policy.coalescingKeyKind).toBe("none");
  });

  it("allPolicies covers every route id", () => {
    const routes = buildRoutes();
    const registry = new NoopPolicyRegistry({ routes });
    const all = registry.allPolicies();
    expect(all.has("route.image")).toBe(true);
    expect(all.has("route.generate.image")).toBe(true);
    expect(all.size).toBe(2);
  });

  it("allPolicies covers fallback chain routes not in the primary list", () => {
    const routes: RouteDefinition[] = [
      {
        id: "route.image",
        toolId: "resource.search.image",
        description: "image",
        predicates: [intentKind("image")],
        targets: [{ id: "a", adapter: imageAdapter("a", 1), weight: 1, timeoutMs: 1000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      },
      {
        id: "route.image-fallback",
        toolId: "resource.search.image",
        description: "image fallback",
        predicates: [intentKind("image")],
        targets: [{ id: "b", adapter: imageAdapter("b", 1), weight: 1, timeoutMs: 1000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      },
    ];
    const registry = new NoopPolicyRegistry({
      routes,
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });
    const all = registry.allPolicies();
    expect(all.has("route.image")).toBe(true);
    expect(all.has("route.image-fallback")).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* NoopHealthRegistry                                                          */
/* -------------------------------------------------------------------------- */

describe("NoopHealthRegistry", () => {
  it("returns unknown for unregistered factories", () => {
    const registry = new NoopHealthRegistry();
    expect(registry.forFactory("axi-docs")).toBe("unknown");
  });

  it("returns unknown even after a check is registered", () => {
    const registry = new NoopHealthRegistry();
    registry.registerCheck("axi-docs", {
      id: "axi-docs-check",
      run: async () => "healthy",
    });
    // Noop always returns "unknown"
    expect(registry.forFactory("axi-docs")).toBe("unknown");
  });

  it("snapshot returns empty factories list when no checks registered", () => {
    const registry = new NoopHealthRegistry();
    const snap = registry.snapshot();
    expect(snap.factories).toEqual([]);
    expect(snap.overall).toBe("unknown");
  });

  it("snapshot returns registered factory with unknown status", () => {
    const registry = new NoopHealthRegistry();
    registry.registerCheck("axi-docs", {
      id: "axi-docs-check",
      run: async () => "healthy",
    });
    const snap = registry.snapshot();
    expect(snap.factories).toHaveLength(1);
    expect(snap.factories[0].factoryId).toBe("axi-docs");
    expect(snap.factories[0].status).toBe("unknown");
  });
});

/* -------------------------------------------------------------------------- */
/* GatewayOrchestrator — registry injection integration                        */
/* -------------------------------------------------------------------------- */

describe("GatewayOrchestrator with registry injection", () => {
  it("uses injected RouteRegistry when provided", () => {
    const routes = buildRoutes();
    // Build a custom registry that wraps the original
    const customRegistry: RouteRegistry = {
      list: () => [routes[0]], // only one route visible
      lookup: (toolId) => routes.find((r) => r.toolId === toolId),
      snapshot: () => ({ routes: [routes[0]], count: 1 }),
    };
    const orchestrator = new GatewayOrchestrator({
      routes,
      routeRegistry: customRegistry,
    });
    expect(orchestrator.listRoutes()).toHaveLength(1);
    expect(orchestrator.listRoutes()[0].id).toBe("route.image");
  });

  it("uses injected PolicyRegistry when provided", () => {
    const routes = buildRoutes();
    const customPolicyRegistry: PolicyRegistry = {
      policyFor: (route) => ({
        retry: { maxAttempts: 99, backoffMs: 1, maxBackoffMs: 2 },
        backpressure: { maxConcurrent: 1, queueTimeoutMs: 100, shedStrategy: "reject" },
        timeoutMs: 5_000,
        cacheTtlMs: 0,
        negativeTtlMs: 500,
        maxCacheEntries: 10,
        idempotent: false,
        cacheScope: "route-payload",
        coalescingKeyKind: "none",
      }),
      allPolicies: () => new Map(),
      deriveIdempotent: (_route) => false,
      deriveCacheTtl: (_route) => 0,
    };
    const orchestrator = new GatewayOrchestrator({
      routes,
      policyRegistry: customPolicyRegistry,
    });
    // We can verify injection by checking that the policy is served from the registry.
    const policy = customPolicyRegistry.policyFor(routes[0]);
    expect(policy.retry.maxAttempts).toBe(99);
    expect(orchestrator.policyRegistry).toBe(customPolicyRegistry);
  });

  it("uses injected HealthRegistry when provided", () => {
    const routes = buildRoutes();
    const customHealthRegistry: HealthRegistry = {
      registerCheck: () => {},
      forFactory: () => "healthy",
      snapshot: () => ({
        factories: [{ factoryId: "axi-docs", status: "healthy" }],
        overall: "healthy",
      }),
    };
    const orchestrator = new GatewayOrchestrator({
      routes,
      healthRegistry: customHealthRegistry,
    });
    expect(orchestrator.healthRegistry).toBe(customHealthRegistry);
    expect(orchestrator.healthRegistry.forFactory("axi-docs")).toBe("healthy");
  });
});

/* -------------------------------------------------------------------------- */
/* GatewayOrchestrator — noop fallback (backward compatibility)                */
/* -------------------------------------------------------------------------- */

describe("GatewayOrchestrator noop registry fallback (backward compatibility)", () => {
  it("without injection, listRoutes returns all routes", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    expect(orchestrator.listRoutes()).toHaveLength(2);
  });

  it("without injection, dispatch still works correctly", async () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    const result = await orchestrator.dispatch({
      intent: imageIntent(),
      toolId: "resource.search.image",
      requestKey: "k-no-injection",
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("without injection, breakers are still shared across dispatches", async () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    expect(orchestrator.breakerCount()).toBe(0);
    await orchestrator.dispatch({
      intent: imageIntent(),
      toolId: "resource.search.image",
      requestKey: "k-breaker-1",
    });
    expect(orchestrator.breakerCount()).toBeGreaterThan(0);
  });

  it("without injection, routeRegistry is a NoopRouteRegistry", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    expect(orchestrator.routeRegistry).toBeInstanceOf(NoopRouteRegistry);
    expect(orchestrator.routeRegistry.list()).toHaveLength(2);
  });

  it("without injection, policyRegistry is a NoopPolicyRegistry", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    expect(orchestrator.policyRegistry).toBeInstanceOf(NoopPolicyRegistry);
    const policy = orchestrator.policyRegistry.policyFor(routes[0]);
    expect(policy.idempotent).toBe(true);
  });

  it("without injection, healthRegistry is a NoopHealthRegistry", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    expect(orchestrator.healthRegistry).toBeInstanceOf(NoopHealthRegistry);
    expect(orchestrator.healthRegistry.forFactory("axi-docs")).toBe("unknown");
  });

  it("policyForRoute result matches PolicyRegistry.policyFor for noop case", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    const route = routes[0];
    const orchPolicy = orchestrator.policyForRoute(route);
    const registryPolicy = orchestrator.policyRegistry.policyFor(route);
    expect(orchPolicy.idempotent).toBe(registryPolicy.idempotent);
    expect(orchPolicy.cacheTtlMs).toBe(registryPolicy.cacheTtlMs);
    expect(orchPolicy.retry.maxAttempts).toBe(registryPolicy.retry.maxAttempts);
  });

  it("policyByRoute result matches PolicyRegistry.allPolicies for noop case", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    const orchMap = orchestrator.policyByRoute();
    const regMap = orchestrator.policyRegistry.allPolicies();
    expect(orchMap.size).toBe(regMap.size);
    for (const [routeId, orchPolicy] of orchMap) {
      const regPolicy = regMap.get(routeId);
      expect(regPolicy).toBeDefined();
      expect(orchPolicy.idempotent).toBe(regPolicy!.idempotent);
    }
  });

  it("breakerCount is consistent with routeRegistry snapshot", () => {
    const routes = buildRoutes();
    const orchestrator = new GatewayOrchestrator({ routes });
    // After a dispatch, breakers are registered for each non-fallback target.
    // The snapshot reflects the number of registered routes.
    const snap = orchestrator.routeRegistry.snapshot();
    expect(snap.count).toBe(2);
    // breakerCount starts at 0 and grows with dispatches
    expect(orchestrator.breakerCount()).toBe(0);
  });
});
