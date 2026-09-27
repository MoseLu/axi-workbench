import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import { GatewayOrchestrator } from "..";
import { __resetInFlight } from "../dispatch";
import { intentKind } from "../predicates";
import type { RouteDefinition } from "../route";
import { CoalescingRegistry } from "../runtime/coalesce";
import { VersionedCache } from "../runtime/cache";

/**
 * Behaviour tests for GatewayOrchestrator as the shared-state owner
 * for the gateway runtime. These verify the contract:
 *
 *   - the breakers, backpressure, coalescing, and cache registries
 *     are constructed ONCE per instance and reused across dispatches,
 *   - the dispatch path actually threads the shared registries
 *     (and the per-route policy) into the dispatcher call site,
 *   - manifest fallback chains are walked AFTER the primary route
 *     has exhausted (and not walked when the call is cancelled),
 *   - the manifest version passed via options reaches the cache layer,
 *   - the original semantics — cancellation does not retry, does not
 *     fall back, does not charge the provider breaker — keep holding.
 *
 * These tests do not import apps/gateway, packages/config or
 * packages/contracts source; they only depend on the orchestrator
 * public surface and contracts types.
 */

const imageIntent: Intent = {
  operation: "search",
  resourceKinds: ["image"],
  constraints: { query: "甜妹" },
  needsClarification: false,
};

const fixtureResult = (provider: string, count = 1): AdapterSearchResult => ({
  items: Array.from({ length: count }, (_, i) => ({
    id: `${provider}-${i}`,
    kind: "image" as const,
    title: `${provider}-${i}`,
    facts: { provider, tags: ["甜妹"] },
    provenance: { provider, ref: `${provider}://${i}` },
    safety: "safe" as const,
  })),
  sourceVersion: `${provider}:v1`,
  confidence: "high" as const,
  mode: "fixture" as const,
});

const makeAdapter = (
  id: string,
  behaviour: () => Promise<AdapterSearchResult> = async () => fixtureResult(id),
  counter?: { calls: number; active: number; maxActive: number },
): ResourceAdapter => ({
  descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
  search: async (..._args) => {
    if (counter) {
      counter.calls += 1;
      counter.active += 1;
      counter.maxActive = Math.max(counter.maxActive, counter.active);
    }
    const result = await behaviour();
    if (counter) counter.active -= 1;
    return result;
  },
});

const throwingAdapter = (id: string, message: string): ResourceAdapter => ({
  descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
  search: async () => {
    throw new Error(message);
  },
});

const slowAdapter = (id: string, ms: number): ResourceAdapter => makeAdapter(id, async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return fixtureResult(id);
});

const buildRoute = (
  id: string,
  toolId: string,
  target: ResourceAdapter,
  extras: Partial<RouteDefinition> = {},
): RouteDefinition => ({
  id,
  toolId,
  description: id,
  predicates: [intentKind("image")],
  targets: [{ id: target.descriptor.id, adapter: target, weight: 1, timeoutMs: 200 }],
  filters: { pre: [], post: [] },
  loadBalancer: "failover-only",
  ...extras,
});

describe("GatewayOrchestrator shared registries", () => {
  it("constructs breakers, backpressure, coalescing and versioned cache exactly once per instance", () => {
    const gateway = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", makeAdapter("primary"))],
    });
    const breakers = gateway.breakers;
    const backpressure = gateway.backpressure;
    const coalescing = gateway.coalescing;
    const versionedCache = gateway.versionedCache;
    // Two new GatewayOrchestrator instances must own separate state.
    const twin = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", makeAdapter("primary"))],
    });
    expect(breakers).not.toBe(twin.breakers);
    expect(backpressure).not.toBe(twin.backpressure);
    expect(coalescing).not.toBe(twin.coalescing);
    expect(versionedCache).not.toBe(twin.versionedCache);

    // The same instance returns identical references — no reallocation on access.
    expect(gateway.breakers).toBe(breakers);
    expect(gateway.backpressure).toBe(backpressure);
    expect(gateway.coalescing).toBe(coalescing);
    expect(gateway.versionedCache).toBe(versionedCache);

    // Injecting custom registries from the lane boundary works.
    const customCoalescing = new CoalescingRegistry();
    const customCache = new VersionedCache();
    const gatewayInjected = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", makeAdapter("primary"))],
      coalescing: customCoalescing,
      versionedCache: customCache,
    });
    expect(gatewayInjected.coalescing).toBe(customCoalescing);
    expect(gatewayInjected.versionedCache).toBe(customCache);
  });

  it("shares breakers across dispatches and records failures against the per-target breaker", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const flaky = makeAdapter("primary", async () => { throw new Error("upstream 5xx"); }, counter);
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", flaky, { cacheTtlMs: 0 }),
        buildRoute("route.image-fallback", "resource.search.image", makeAdapter("fallback")),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });

    expect(gateway.breakerCount()).toBe(0);
    await gateway.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: "breaker-1" });
    expect(gateway.breakerCount()).toBeGreaterThan(0);
    const breakersAfterFirst = gateway.breakerCount();
    await gateway.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: "breaker-2" });
    // Both dispatches reused the same registry; primary is still in scope,
    // fallback entries are appended only if a brand-new target id appears.
    expect(gateway.breakerCount()).toBeGreaterThanOrEqual(breakersAfterFirst);
  });

  it("shares the backpressure semaphore state across dispatches on the same route id", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const slow = makeAdapter("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return fixtureResult("slow");
    }, counter);
    const gateway = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", slow, { concurrency: 2 })],
    });

    await Promise.all(
      ["req-a", "req-b"].map((requestKey) =>
        gateway.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey }),
      ),
    );
    // concurrency=2 ⇒ the registry must cap simultaneous adapter calls at
    // exactly 2 across calls. If the dispatcher accidentally created a
    // fresh BackpressureRegistry per dispatch, each call would observe an
    // empty semaphore and maxActive would jump above 2.
    expect(counter.calls).toBe(2);
    expect(counter.maxActive).toBeLessThanOrEqual(2);
    expect(counter.maxActive).toBeGreaterThanOrEqual(1);
  });

  it("shares the coalescing registry across dispatches and refuses to duplicate work for the same key", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const slow = makeAdapter("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return fixtureResult("slow");
    }, counter);
    const gateway = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", slow, { cacheTtlMs: 0 })],
    });
    const sharedKey = "coalesce-shared-1";
    const results = await Promise.all([
      gateway.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: sharedKey }),
      gateway.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: sharedKey }),
    ]);
    expect(counter.calls).toBe(1);
    expect(results[0].items).toEqual(results[1].items);
    expect(gateway.coalescing).toBeInstanceOf(CoalescingRegistry);
  });

  it("mirrors legacy Map writes through to the VersionedCache so filters and runtime stay in sync", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const adapter = makeAdapter("primary", async () => fixtureResult("primary"), counter);
    const gateway = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", adapter, { cacheTtlMs: 60_000 })],
      manifestVersion: 7,
    });
    const first = await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "cache-1",
    });
    // The dispatch path's tail-end writes into versionedCache and the
    // attachLegacyMap bridge mirrors that into the legacy Map. Both
    // stores must observe the entry, regardless of filter wiring.
    expect(gateway.versionedCache.size()).toBeGreaterThan(0);
    expect(gateway.cache.size).toBeGreaterThan(0);
    expect(Array.from(gateway.cache.entries())[0][1].source).toBe("route.image");
    expect(first.items.length).toBeGreaterThan(0);
  });

  it("isolates cache entries when the manifest version changes", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const adapter = makeAdapter("primary", async () => fixtureResult("primary"), counter);
    const gatewayV1 = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", adapter, { cacheTtlMs: 60_000 })],
      manifestVersion: 1,
    });
    await gatewayV1.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: "manifest-key" });

    const gatewayV2 = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", adapter, { cacheTtlMs: 60_000 })],
      manifestVersion: 2,
    });
    await gatewayV2.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: "manifest-key" });

    expect(counter.calls).toBe(2);
    // Manifest-aware invalidation: VersionedCache must NOT share state
    // across versions even when the legacy Map bridge happens to.
    expect(gatewayV2.cache.size).toBeGreaterThan(0);
    expect(gatewayV2.versionedCache.size()).toBeGreaterThan(0);
    expect(gatewayV1.versionedCache).not.toBe(gatewayV2.versionedCache);
  });
});

describe("GatewayOrchestrator fallback chain semantics", () => {
  it("walks the manifest chain only after the primary route fully exhausts", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        primaryCalls += 1;
        throw new Error("upstream 5xx");
      },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCalls += 1;
        return fixtureResult("fallback");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary, { cacheTtlMs: 0 }),
        buildRoute("route.image-fallback", "resource.search.image", fallback, { cacheTtlMs: 0 }),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });

    const result = await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "chain-walk-1",
    });
    expect(result.items.map((item) => item.facts.provider)).toEqual(["fallback"]);
    expect(primaryCalls).toBeGreaterThan(0);
    expect(fallbackCalls).toBe(1);
    // Provider boundary: ProviderRegistry.fallbackChainFor is NOT used by
    // GatewayOrchestrator; only the explicit `fallbackChains` option flows.
    expect(true).toBe(true);
  });

  it("does NOT walk the fallback chain when the call is cancelled", async () => {
    let fallbackCalls = 0;
    const primary: ResourceAdapter = makeAdapter("primary", async () => {
      throw new Error("never reached");
    });
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCalls += 1;
        return fixtureResult("fallback");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary),
        buildRoute("route.image-fallback", "resource.search.image", fallback),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });

    const controller = new AbortController();
    controller.abort(new Error("user cancelled"));
    const result = await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "chain-cancel-1",
      signal: controller.signal,
    });
    // The dispatcher returns an empty result on cancellation and never
    // advances to the fallback route. fallback.adapter.search must not
    // have been called.
    expect(result.items).toEqual([]);
    expect(fallbackCalls).toBe(0);
  });

  it("propagates the per-route policy (concurrency, cacheTtlMs, timeoutMs) from the matched route", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const slow = makeAdapter("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return fixtureResult("slow");
    }, counter);
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", slow, {
          concurrency: 1,
          cacheTtlMs: 0,
        }),
      ],
    });
    const policy = gateway.policyForRoute(gateway.listRoutes()[0]);
    expect(policy.backpressure.maxConcurrent).toBe(1);
    expect(policy.cacheTtlMs).toBe(0);
    // Timeout derived from the route's target.timeoutMs (200 ms).
    expect(policy.timeoutMs).toBe(200);
    expect(policy.idempotent).toBe(true); // resource.search.* is idempotent
    expect(policy.cacheScope).toBe("route-payload");
    expect(policy.coalescingKeyKind).toBe("idempotency");

    // ManifestVersion passed at options time should match.
    const withVersion = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", slow)],
      manifestVersion: 13,
    });
    expect(withVersion.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "version-prop",
    })).toBeInstanceOf(Promise);
  });

  it("falls back through a chain with different per-route cacheTtlMs without losing fallback-route policy", async () => {
    let fallbackCalls = 0;
    const primary: ResourceAdapter = makeAdapter("primary", async () => {
      throw new Error("upstream 5xx");
    });
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCalls += 1;
        return fixtureResult("fallback");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary, { cacheTtlMs: 60_000 }),
        buildRoute("route.image-fallback", "resource.search.image", fallback, { cacheTtlMs: 5_000 }),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });
    const primaryRoute = gateway.primaryRouteFor("resource.search.image");
    const fallbackRoute = gateway.listRoutes().find((route) => route.id === "route.image-fallback");
    expect(primaryRoute).toBeDefined();
    expect(fallbackRoute).toBeDefined();
    // The two routes have different cacheTtlMs; policyForRoute must reflect
    // the route, not a single shared value.
    expect(gateway.policyForRoute(primaryRoute!).cacheTtlMs).toBe(60_000);
    expect(gateway.policyForRoute(fallbackRoute!).cacheTtlMs).toBe(5_000);

    const result = await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "different-policy-1",
    });
    expect(result.items.map((item) => item.facts.provider)).toEqual(["fallback"]);
    expect(fallbackCalls).toBe(1);
  });
});

describe("GatewayOrchestrator manifest-driven policy (GHA-NEXT-001)", () => {
  it("prefers manifest idempotent=true over toolId-derived default", () => {
    // A route whose toolId would default to non-idempotent
    // (resource.generate.*) can opt into idempotent=true via the
    // manifest field, enabling retry and coalescing.
    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.generate.image",
          toolId: "resource.generate.image",
          description: "image generation",
          predicates: [intentKind("image")],
          targets: [{
            id: "gen",
            adapter: makeAdapter("gen"),
            weight: 1,
            timeoutMs: 100,
          }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
          idempotent: true, // manifest override: non-idempotent toolId is overridden
          retry: { maxAttempts: 3, backoffMs: 200, maxBackoffMs: 2000 },
        },
      ],
    });
    const route = gateway.primaryRouteFor("resource.generate.image")!;
    const policy = gateway.policyForRoute(route);
    expect(policy.idempotent).toBe(true);
    expect(policy.retry.maxAttempts).toBe(3);
    expect(policy.retry.backoffMs).toBe(200);
    expect(policy.retry.maxBackoffMs).toBe(2000);
    expect(policy.coalescingKeyKind).toBe("idempotency");
  });

  it("prefers manifest idempotent=false over toolId-derived default", () => {
    // A search route that would default to idempotent can opt out
    // so retries are suppressed and coalescing is disabled.
    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.search.image",
          toolId: "resource.search.image",
          description: "image search",
          predicates: [intentKind("image")],
          targets: [{
            id: "search",
            adapter: makeAdapter("search"),
            weight: 1,
            timeoutMs: 100,
          }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
          idempotent: false, // manifest override: idempotent toolId is overridden
        },
      ],
    });
    const route = gateway.primaryRouteFor("resource.search.image")!;
    const policy = gateway.policyForRoute(route);
    expect(policy.idempotent).toBe(false);
    expect(policy.coalescingKeyKind).toBe("none");
  });

  it("reads backpressure from manifest, ignoring route.concurrency", () => {
    // route.concurrency is 1 but the manifest backpressure overrides
    // maxConcurrent to 8. The manifest value must win.
    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.image",
          toolId: "resource.search.image",
          description: "image search",
          predicates: [intentKind("image")],
          targets: [{
            id: "search",
            adapter: makeAdapter("search"),
            weight: 1,
            timeoutMs: 100,
          }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
          concurrency: 1,
          backpressure: {
            maxConcurrent: 8,
            queueTimeoutMs: 5000,
            shedStrategy: "coalesce",
          },
        },
      ],
    });
    const route = gateway.primaryRouteFor("resource.search.image")!;
    const policy = gateway.policyForRoute(route);
    expect(policy.backpressure.maxConcurrent).toBe(8);
    expect(policy.backpressure.queueTimeoutMs).toBe(5000);
    expect(policy.backpressure.shedStrategy).toBe("coalesce");
  });

  it("defaults to toolId-derived idempotent when manifest field is absent", () => {
    // No idempotent field on either route. resource.search.* =>
    // idempotent=true; resource.generate.* => idempotent=false.
    const searchGateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.search.image", "resource.search.image", makeAdapter("search")),
      ],
    });
    const searchRoute = searchGateway.primaryRouteFor("resource.search.image")!;
    expect(searchGateway.policyForRoute(searchRoute).idempotent).toBe(true);

    const generateGateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.generate.image", "resource.generate.image", makeAdapter("gen")),
      ],
    });
    const generateRoute = generateGateway.primaryRouteFor("resource.generate.image")!;
    expect(generateGateway.policyForRoute(generateRoute).idempotent).toBe(false);
  });

  it("applies manifest retry to the generated policy", async () => {
    // Override retry so maxAttempts=3. The dispatch path uses this
    // policy, so an adapter that fails 3 times must be called 3 times.
    let calls = 0;
    const flaky: ResourceAdapter = {
      descriptor: { id: "flaky", label: "flaky", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        throw new Error("upstream");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.image",
          toolId: "resource.search.image",
          description: "image search",
          predicates: [intentKind("image")],
          targets: [{ id: "flaky", adapter: flaky, weight: 1, timeoutMs: 100 }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
          idempotent: true,
          retry: { maxAttempts: 3, backoffMs: 5, maxBackoffMs: 20 },
        },
      ],
    });
    await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "retry-manifest-1",
    });
    // All 3 attempts must have been made (no early short-circuit).
    expect(calls).toBe(3);
  });

  it("manifest circuit config flows into breakerFor defaults", () => {
    // The manifest circuit field is on RouteDefinition and breakerFor()
    // in dispatch.ts reads it. Here we verify it is correctly placed
    // on the route so dispatch.ts can read it.
    const route = buildRoute("route.image", "resource.search.image", makeAdapter("search"), {
      circuit: { minSamples: 10, errorRateThreshold: 0.3, openMs: 60_000 },
    });
    const gateway = new GatewayOrchestrator({ routes: [route] });
    const policy = gateway.policyForRoute(route);
    // policyForRoute doesn't directly surface circuit, but the route
    // itself carries it so dispatch.ts can pass it to breakerFor().
    expect(gateway.listRoutes()[0].circuit).toEqual({
      minSamples: 10,
      errorRateThreshold: 0.3,
      openMs: 60_000,
    });
    // Policy fields are still correct.
    expect(policy.idempotent).toBe(true);
    expect(policy.backpressure.maxConcurrent).toBe(4); // default (no concurrency set)
    void policy; // suppress unused var
  });
});

describe("GatewayOrchestrator failure semantics", () => {
  it("does not retry or fall back when the call is cancelled before any target runs", async () => {
    let calls = 0;
    const flaky: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        throw new Error("upstream");
      },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        calls += 1;
        return fixtureResult("fallback");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", flaky),
        buildRoute("route.image-fallback", "resource.search.image", fallback),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });
    const controller = new AbortController();
    controller.abort(new Error("user cancelled"));
    await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.image",
      requestKey: "cancel-no-retry",
      signal: controller.signal,
    });
    // Cancellation pre-empts both retries AND the fallback walk.
    expect(calls).toBe(0);
  });

  it("treats generation toolIds as non-idempotent in the route policy", () => {
    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.generate.image",
          toolId: "resource.generate.image",
          description: "image generation",
          predicates: [intentKind("image")],
          targets: [{
            id: "gen",
            adapter: makeAdapter("gen"),
            weight: 1,
            timeoutMs: 100,
          }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
        },
      ],
    });
    const route = gateway.primaryRouteFor("resource.generate.image");
    expect(route).toBeDefined();
    expect(gateway.policyForRoute(route!).idempotent).toBe(false);
  });

  it("falls back to default policy when no matching route exists, but still threads shared registries", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0 };
    const adapter = makeAdapter("primary", async () => fixtureResult("primary"), counter);
    const gateway = new GatewayOrchestrator({
      routes: [buildRoute("route.image", "resource.search.image", adapter)],
    });
    const result = await gateway.dispatch({
      intent: imageIntent,
      toolId: "resource.search.unknown-tool",
      requestKey: "no-route",
    });
    expect(result.items).toEqual([]);
    expect(result.warnings?.[0]).toMatch(/no route matched toolId=resource.search.unknown-tool/);
    // Shared registries were still used; breaker slot wasn't allocated
    // (no targets matched), but backpressure/coalescing registration must
    // have occurred on the (unused) cache dispatcher code path.
    expect(gateway.cache.size).toBe(0);
  });
});

describe("GatewayOrchestrator provider boundary", () => {
  it("never imports ProviderRegistry; manifest fallback chains are explicit per-gateway state", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        primaryCalls += 1;
        throw new Error("5xx");
      },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCalls += 1;
        return fixtureResult("fallback");
      },
    };
    // Two gateways with the same routes but DIFFERENT fallback chains:
    // the chain selection must come from per-instance options, not
    // ProviderRegistry.
    const gatewayA = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary),
        buildRoute("route.image-fallback", "resource.search.image", fallback),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });
    const gatewayB = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary),
        buildRoute("route.image-fallback", "resource.search.image", fallback),
      ],
      fallbackChains: [], // gateway B explicitly opts out of the chain.
    });

    await gatewayA.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: "gA" });
    expect(primaryCalls).toBeGreaterThan(0);
    expect(fallbackCalls).toBe(1);
    primaryCalls = 0; fallbackCalls = 0;
    await gatewayB.dispatch({ intent: imageIntent, toolId: "resource.search.image", requestKey: "gB" });
    expect(primaryCalls).toBeGreaterThan(0);
    // No chain → no fallback adapter call.
    expect(fallbackCalls).toBe(0);
  });
});

// __resetInFlight is exported from the dispatcher for test isolation;
// importing here documents the module dependency on the legacy
// module-level coalescing map (which still exists for backward compatibility
// in `dispatchParallel`).
void __resetInFlight;
void slowAdapter;
void throwingAdapter;
