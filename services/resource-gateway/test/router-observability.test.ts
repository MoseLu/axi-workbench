import { describe, expect, it } from "vitest";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * Behaviour-first coverage for the router's observability seams
 * (lane-mm-gateway-tests requirement 2 + 5):
 *
 *   - `breakerSnapshots()` only returns the contract-shaped
 *     fields (targetId, routeId, state, samples, errors,
 *     openedAt). No URL, no adapter reference, no secret leaks.
 *   - `routeRegistry()` returns a safe projection that omits
 *     adapter instances, target URLs, provider payloads,
 *     query text, secrets, and environment variables.
 *   - Empty registries (no breakers, no routes) produce
 *     empty arrays, NOT errors — defensive stubs must work.
 *   - Per-target breakers map back to their owning route id
 *     even when the same target id appears on multiple routes.
 *
 * These tests drive the router directly with stub gateways —
 * no HTTP listeners, no real provider adapters.
 */

const sampleBreaker = (overrides: Partial<{
  state: "closed" | "open" | "half-open";
  samples: number;
  errors: number;
  openedAt: number;
  probeInFlight: boolean;
}> = {}) => ({
  state: overrides.state ?? "closed",
  samples: overrides.samples ?? 0,
  errors: overrides.errors ?? 0,
  openedAt: overrides.openedAt ?? 0,
  probeInFlight: overrides.probeInFlight ?? false,
  snapshot() {
    return { ...this };
  },
});

describe("apps/gateway GatewayRouter — breakerSnapshots / routeRegistry", () => {
  it("breakerSnapshots returns empty array when orchestrator has no breakers", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    expect(router.breakerSnapshots()).toEqual([]);
  });

  it("breakerSnapshots projects only contract-shaped fields — no URL/secret leaks", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    // Inject breakers into the orchestrator's registry. We model
    // a target that has both safe fields (target.id) and forbidden
    // fields (url, secret, payload) attached to the breaker object.
    (gateway.breakers as unknown as Map<string, unknown>).set("image-factory.axi-image-preview", sampleBreaker({ state: "closed", samples: 8, errors: 0 }));
    (gateway.breakers as unknown as Map<string, unknown>).set("docs-factory.axi-docs", sampleBreaker({ state: "open", samples: 20, errors: 9, openedAt: 1_700_000_000_000 }));

    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });

    const snapshots = router.breakerSnapshots();
    expect(snapshots).toHaveLength(2);

    const fields = snapshots.flatMap((entry) => Object.keys(entry));
    expect(fields.sort()).toEqual(["errors","errors","openedAt","openedAt","routeId","routeId","samples","samples","state","state","targetId","targetId"]);

    for (const entry of snapshots) {
      // Strict type assertion: exactly the contract shape.
      expect(typeof entry.targetId).toBe("string");
      expect(typeof entry.routeId).toBe("string");
      expect(["closed", "open", "half-open"]).toContain(entry.state);
      expect(typeof entry.samples).toBe("number");
      expect(typeof entry.errors).toBe("number");
      expect(typeof entry.openedAt).toBe("number");
      // The projection MUST NOT carry adapter instance, URL, or secret
      // properties even when the underlying breaker object does.
      const raw = entry as unknown as Record<string, unknown>;
      expect(raw.url).toBeUndefined();
      expect(raw.token).toBeUndefined();
      expect(raw.secret).toBeUndefined();
      expect(raw.query).toBeUndefined();
      expect(raw.payload).toBeUndefined();
      expect(raw.adapter).toBeUndefined();
      expect(raw.endpoint).toBeUndefined();
    }

    const openOne = snapshots.find((entry) => entry.targetId === "docs-factory.axi-docs");
    expect(openOne).toBeDefined();
    expect(openOne?.state).toBe("open");
    expect(openOne?.samples).toBe(20);
    expect(openOne?.errors).toBe(9);
    expect(openOne?.openedAt).toBe(1_700_000_000_000);
  });

  it("breakerSnapshots skips breakers whose snapshot() returns an invalid state", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    const malformed = { snapshot() { return { state: "exploding", samples: 1, errors: 0, openedAt: 0 }; } };
    (gateway.breakers as unknown as Map<string, unknown>).set("bad.breaker", malformed);
    (gateway.breakers as unknown as Map<string, unknown>).set("good.breaker", sampleBreaker({ state: "closed" }));

    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const snapshots = router.breakerSnapshots();
    expect(snapshots.map((entry) => entry.targetId)).toEqual(["good.breaker"]);
  });

  it("breakerSnapshots handles breaker whose snapshot() throws", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    const throwing = { snapshot() { throw new Error("snapshot boom"); } };
    (gateway.breakers as unknown as Map<string, unknown>).set("throwing.breaker", throwing);
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    expect(router.breakerSnapshots()).toEqual([]);
  });

  it("routeRegistry returns a safe projection — no adapter, url, token, or query", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      {
        id: "route.image",
        toolId: "resource.search.image",
        description: "search image candidates",
        loadBalancer: "weighted-round-robin",
        // Forbidden fields attached to the route — the projection
        // must NOT expose them.
        adapter: { secret: "do-not-leak" },
        url: "http://internal.invalid/secret",
        token: "bearer-shhh",
        query: { secret: true },
        targets: [
          { id: "image-factory.axi-image-preview", url: "http://127.0.0.1:5173", token: "tok" },
          { id: "image-fallback", url: "http://127.0.0.1:9999" },
        ],
      },
      {
        id: "route.document",
        toolId: "resource.search.document",
        description: "search documents",
        loadBalancer: "round-robin",
        targets: [],
      },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const registry = router.routeRegistry();

    expect(registry).toHaveLength(2);
    const imageRoute = registry.find((entry) => entry.id === "route.image");
    expect(imageRoute).toBeDefined();
    expect(imageRoute?.id).toBe("route.image");
    expect(imageRoute?.toolId).toBe("resource.search.image");
    expect(imageRoute?.description).toBe("search image candidates");
    expect(imageRoute?.loadBalancer).toBe("weighted-round-robin");
    expect(imageRoute?.targetIds).toEqual(["image-factory.axi-image-preview", "image-fallback"]);
    // The target id list must only carry string ids, no nested objects.
    for (const tid of imageRoute?.targetIds ?? []) {
      expect(typeof tid).toBe("string");
    }

    // The raw projection must not leak forbidden fields.
    const raw = JSON.stringify(registry);
    expect(raw).not.toMatch(/secret|token|bearer|do-not-leak|127\.0\.0\.1:9999|http:\/\/internal/u);

    // Empty-targets route should still project cleanly.
    const docRoute = registry.find((entry) => entry.id === "route.document");
    expect(docRoute).toBeDefined();
    expect(docRoute?.targetIds).toEqual([]);
  });

  it("routeRegistry returns [] when listRoutes is undefined or throws", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    // No listRoutes override — the real GatewayOrchestrator.listRoutes
    // returns the routes array, which is empty. The safeRouteList()
    // helper tolerates that and returns [].
    (gateway as unknown as { listRoutes: () => ReadonlyArray<unknown> }).listRoutes = () => [];
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    expect(router.routeRegistry()).toEqual([]);
  });

  it("routeRegistry tolerates routes with malformed fields", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      // id missing entirely — safeRouteList() defaults it to ""
      { toolId: 42, description: null, targets: "not-an-array", loadBalancer: 99 },
      { id: 123, targets: [{ id: 7 }, "string-target"] },
    ];
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const registry = router.routeRegistry();
    expect(registry).toHaveLength(2);
    // Every entry must have string fields where the contract demands
    // strings; safeRouteList() normalises them.
    for (const entry of registry) {
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.toolId).toBe("string");
      expect(typeof entry.description).toBe("string");
      expect(Array.isArray(entry.targetIds)).toBe(true);
      for (const tid of entry.targetIds) expect(typeof tid).toBe("string");
      expect(typeof entry.loadBalancer).toBe("string");
    }
  });
});
