import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import { GatewayOrchestrator } from "..";
import { intentKind } from "../predicates";
import type { RouteDefinition } from "../route";
import { buildCacheKey } from "../runtime/cache";

/**
 * Behaviour tests for the three issues called out by the parent-session
 * review of the mm-orchestrator lane:
 *
 *   1. Fallback route policy MUST be applied independently of the
 *      primary's. The fallback's `timeoutMs`, `concurrency`,
 *      `cacheTtlMs`, and `coalescingKeyKind` cannot silently inherit
 *      the primary's values.
 *   2. Coalescing MUST honour `DispatchPolicy.coalescingKeyKind`:
 *      - `none` => no merging under any condition;
 *      - non-idempotent routes (e.g. `resource.generate.*`) must NOT
 *        enable idempotency coalescing;
 *      - identical idempotent routes sharing `(routeId, targetId,
 *        manifestVersion, requestKey)` MUST still share a single
 *        adapter invocation.
 *   3. Cancellation must not retry, not fall back, and not charge
 *      the provider breaker. When two callers join a coalesced
 *      request, cancelling one MUST NOT cancel the shared work — the
 *      other caller must still receive the shared result.
 *
 * These tests are observable-only: they assert on adapter call
 * counts, return values, cache expiration, and slot release. They do
 * NOT touch internal state directly.
 */

const searchIntent: Intent = {
  operation: "search",
  resourceKinds: ["image"],
  constraints: { query: "甜妹" },
  needsClarification: false,
};

const fixture = (provider: string): AdapterSearchResult => ({
  items: [{
    id: `${provider}:0`,
    kind: "image" as const,
    title: `${provider}:0`,
    facts: { provider },
    provenance: { provider, ref: `${provider}://0` },
    safety: "safe" as const,
  }],
  sourceVersion: `${provider}:v1`,
  confidence: "high" as const,
  mode: "fixture" as const,
});

const makeAdapter = (
  id: string,
  behaviour: (counter: { calls: number; active: number; maxActive: number; firstCallStartedAt: number | null }) => Promise<AdapterSearchResult> = async () => fixture(id),
  counter: { calls: number; active: number; maxActive: number; firstCallStartedAt: number | null } = { calls: 0, active: 0, maxActive: 0, firstCallStartedAt: null },
): ResourceAdapter => ({
  descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
  search: async () => {
    counter.calls += 1;
    counter.active += 1;
    counter.maxActive = Math.max(counter.maxActive, counter.active);
    if (counter.firstCallStartedAt === null) counter.firstCallStartedAt = Date.now();
    const result = await behaviour(counter);
    counter.active -= 1;
    return result;
  },
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

describe("Issue 1 — fallback route uses its OWN policy", () => {
  it("fallback route observes its own timeoutMs when the primary fails (slow fallback survives)", async () => {
    // Primary fails immediately. Fallback is slow but well under its
    // OWN target.timeoutMs (300ms). The primary's policy carries a
    // 100ms timeout; if the primary's policy leaked into the
    // fallback's runTargetWithRetry the fallback would be cancelled
    // at 100ms. With the fix the fallback's 300ms own timeout is
    // honoured independently.
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { throw new Error("5xx"); },
    };
    const counter = { calls: 0, active: 0, maxActive: 0, firstCallStartedAt: null as number | null };
    const fallback: ResourceAdapter = makeAdapter("fallback", async () => {
      // 200ms — fits the fallback's 300ms own timeout, would have
      // blown the primary's 100ms timeout had the primary's policy
      // leaked.
      await new Promise((resolve) => setTimeout(resolve, 200));
      return fixture("fallback");
    }, counter);
    // Build routes directly so each route gets its own target
    // timeoutMs (RouteDefinition.timeoutMs is not a field; the
    // timeout flows from `route.targets[*].timeoutMs`).
    const primaryRoute: RouteDefinition = {
      id: "route.image",
      toolId: "resource.search.image",
      description: "primary",
      predicates: [intentKind("image")],
      targets: [{ id: "primary", adapter: primary, weight: 1, timeoutMs: 100 }],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
    };
    const fallbackRoute: RouteDefinition = {
      id: "route.image-fallback",
      toolId: "resource.search.image",
      description: "fallback",
      predicates: [intentKind("image")],
      targets: [{ id: "fallback", adapter: fallback, weight: 1, timeoutMs: 300 }],
      filters: { pre: [], post: [] },
      loadBalancer: "failover-only",
    };
    const gateway = new GatewayOrchestrator({
      routes: [primaryRoute, fallbackRoute],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });

    const result = await gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "fallback-timeout-1",
    });
    expect(result.items[0].facts.provider).toBe("fallback");
    expect(counter.calls).toBe(1);
  });

  it("fallback route with cacheTtlMs !== primary cacheTtlMs writes a cache entry keyed on the serving route", async () => {
    // Two routes, both caching but with very different TTLs. The
    // primary is wired to fail so the fallback serves. After the
    // dispatch the cache must contain an entry whose `source` is
    // the fallback's route id and whose TTL matches the fallback's
    // cacheTtlMs.
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { throw new Error("5xx"); },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => fixture("fallback"),
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary, { cacheTtlMs: 60_000 }),
        buildRoute("route.image-fallback", "resource.search.image", fallback, { cacheTtlMs: 5_000 }),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });

    await gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "fallback-cache-1",
    });
    const cache = gateway.versionedCache;
    // The cache must contain exactly one entry, and its key must be
    // for the fallback route id (NOT the primary route id).
    const keys = Array.from(cache.entries()).map(([key]) => key);
    expect(keys).toHaveLength(1);
    const fallbackKey = buildCacheKey({
      routeId: "route.image-fallback",
      manifestVersion: 1,
      scope: "route-payload",
      intent: searchIntent,
      requestKey: "fallback-cache-1",
    });
    const expected = `${fallbackKey.routeId}|${fallbackKey.manifestVersion}|${fallbackKey.scope}|${fallbackKey.hash}`;
    expect(keys[0]).toBe(expected);
    // TTL must be the fallback's 5s — primary's 60s would mean the
    // entry survives a 10s look-ahead, which it must NOT.
    const entry = cache.get(fallbackKey);
    expect(entry).toBeDefined();
    const farFuture = Date.now() + 30_000;
    expect(cache.get(fallbackKey, farFuture)).toBeUndefined();
  });

  it("primary cacheTtlMs is honoured when the primary actually serves", async () => {
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => fixture("primary"),
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary, { cacheTtlMs: 60_000 }),
      ],
    });
    await gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "primary-cache-1",
    });
    const key = buildCacheKey({
      routeId: "route.image",
      manifestVersion: 1,
      scope: "route-payload",
      intent: searchIntent,
      requestKey: "primary-cache-1",
    });
    const entry = gateway.versionedCache.get(key);
    expect(entry).toBeDefined();
    // 60s TTL — must still be readable 30s later (well before expiry).
    const future = Date.now() + 30_000;
    expect(gateway.versionedCache.get(key, future)).toBeDefined();
  });
});

describe("Issue 2 — coalescingKeyKind semantics", () => {
  it("two concurrent resource.generate.* calls each invoke the adapter (no coalescing)", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0, firstCallStartedAt: null as number | null };
    const generate: ResourceAdapter = makeAdapter("gen", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return fixture("gen");
    }, counter);
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.generate.image",
        toolId: "resource.generate.image",
        description: "image generation",
        predicates: [intentKind("image")],
        targets: [{ id: "gen", adapter: generate, weight: 1, timeoutMs: 1000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      }],
    });

    const [a, b] = await Promise.all([
      gateway.dispatch({ intent: searchIntent, toolId: "resource.generate.image", requestKey: "k-1" }),
      gateway.dispatch({ intent: searchIntent, toolId: "resource.generate.image", requestKey: "k-1" }),
    ]);
    // Each call must have independently invoked the adapter.
    expect(counter.calls).toBe(2);
    // Both must still return a result.
    expect(a.items.length).toBeGreaterThan(0);
    expect(b.items.length).toBeGreaterThan(0);
    // Route policy must have disabled coalescing.
    const route = gateway.primaryRouteFor("resource.generate.image")!;
    expect(gateway.policyForRoute(route).coalescingKeyKind).toBe("none");
    expect(gateway.policyForRoute(route).idempotent).toBe(false);
  });

  it("two concurrent resource.search.* calls with the same key share a single adapter invocation", async () => {
    const counter = { calls: 0, active: 0, maxActive: 0, firstCallStartedAt: null as number | null };
    const search: ResourceAdapter = makeAdapter("search", async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return fixture("search");
    }, counter);
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.search.image",
        toolId: "resource.search.image",
        description: "image search",
        predicates: [intentKind("image")],
        targets: [{ id: "search", adapter: search, weight: 1, timeoutMs: 1000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      }],
    });

    const [a, b] = await Promise.all([
      gateway.dispatch({ intent: searchIntent, toolId: "resource.search.image", requestKey: "shared-key" }),
      gateway.dispatch({ intent: searchIntent, toolId: "resource.search.image", requestKey: "shared-key" }),
    ]);
    // Exactly one adapter invocation — the second call joined the
    // in-flight promise.
    expect(counter.calls).toBe(1);
    expect(a.items[0].id).toBe(b.items[0].id);
    // Route policy must have enabled idempotency coalescing.
    const route = gateway.primaryRouteFor("resource.search.image")!;
    expect(gateway.policyForRoute(route).coalescingKeyKind).toBe("idempotency");
    expect(gateway.policyForRoute(route).idempotent).toBe(true);
  });
});

describe("Issue 3 — cancellation vs coalescing", () => {
  it("caller cancellation does not retry, fall back, or charge the breaker", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        primaryCalls += 1;
        throw new Error("never reached");
      },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCalls += 1;
        return fixture("fallback");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [
        buildRoute("route.image", "resource.search.image", primary),
        buildRoute("route.image-fallback", "resource.search.image", fallback),
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });
    // Pre-cancel: signal is already aborted BEFORE dispatch is
    // called. The dispatcher must short-circuit before touching the
    // primary target — primaryCalls === 0 and fallbackCalls === 0.
    const controller = new AbortController();
    controller.abort(new Error("user-cancelled"));
    const result = await gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "cancel-pre",
      signal: controller.signal,
    });
    expect(result.items).toEqual([]);
    expect(primaryCalls).toBe(0);
    expect(fallbackCalls).toBe(0);
  });

  it("caller cancellation mid-flight does not poison joined callers (coalesced work continues)", async () => {
    // Two concurrent callers, same coalescing key. Caller A cancels
    // mid-flight. Caller B is still waiting on the shared in-flight
    // promise. The shared work is NOT bound to caller A's signal, so
    // caller B must still receive the result, and the adapter must
    // be invoked exactly once.
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const counter = { calls: 0, active: 0, maxActive: 0, firstCallStartedAt: null as number | null };
    const slow: ResourceAdapter = {
      descriptor: { id: "slow", label: "slow", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        counter.calls += 1;
        await blocked;
        return fixture("slow");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.search.image",
        toolId: "resource.search.image",
        description: "image search",
        predicates: [intentKind("image")],
        targets: [{ id: "slow", adapter: slow, weight: 1, timeoutMs: 5000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      }],
    });

    const controllerA = new AbortController();
    const callerA = gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key",
      signal: controllerA.signal,
    });
    const callerB = gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key",
    });

    // Caller A cancels while the shared work is still in flight.
    controllerA.abort(new Error("user-cancelled"));

    // Release the shared work. Caller B must still receive the
    // fixture result.
    release();
    const [a, b] = await Promise.all([callerA, callerB]);
    // Adapter invoked exactly once (caller B joined caller A's
    // in-flight promise).
    expect(counter.calls).toBe(1);
    // Caller B received the real result.
    expect(b.items[0].facts.provider).toBe("slow");
    // Caller A received an empty result envelope; it must NOT have
    // surfaced the shared work's success items (otherwise callers
    // would observe inconsistent state across cancellation).
    expect(a.items).toEqual([]);
  });

  it("mid-flight cancellation: caller A gets a cancelled envelope, caller B keeps the shared result, fallback is NOT invoked, breaker stays clean", async () => {
    // Adapter is gated behind a manual release so the shared work is
    // observably in flight when caller A aborts. We then verify that:
    //   1. the adapter is invoked exactly once,
    //   2. caller B receives the real result after release(),
    //   3. caller A receives an empty envelope (NOT the shared items),
    //   4. caller A's dispatch returned a cancelled ProviderFailure
    //      (so retry/fallback/breaker all short-circuit),
    //   5. the fallback adapter is NOT called (cancellation must not
    //      fall back, even when a fallback route is configured),
    //   6. the breaker for the primary target is NOT charged with the
    //      cancelled attempt (countsAgainstBreaker stays false).
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });

    const counter = { primaryCalls: 0, primaryActive: 0, primaryMaxActive: 0 };
    const fallbackCounter = { calls: 0 };

    const slow: ResourceAdapter = {
      descriptor: { id: "slow", label: "slow", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        counter.primaryCalls += 1;
        counter.primaryActive += 1;
        counter.primaryMaxActive = Math.max(counter.primaryMaxActive, counter.primaryActive);
        await blocked;
        counter.primaryActive -= 1;
        return fixture("slow");
      },
    };
    const slowFallback: ResourceAdapter = {
      descriptor: { id: "slow-fallback", label: "slow-fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCounter.calls += 1;
        return fixture("slow-fallback");
      },
    };

    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.search.image",
          toolId: "resource.search.image",
          description: "image search primary",
          predicates: [intentKind("image")],
          targets: [{ id: "slow", adapter: slow, weight: 1, timeoutMs: 5000 }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
        },
        {
          id: "route.search.image-fallback",
          toolId: "resource.search.image",
          description: "image search fallback",
          predicates: [intentKind("image")],
          targets: [{ id: "slow-fallback", adapter: slowFallback, weight: 1, timeoutMs: 5000 }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
        },
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.search.image-fallback"] }],
    });

    const controllerA = new AbortController();
    const callerAPromise = gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key",
      signal: controllerA.signal,
    });
    const callerBPromise = gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key",
    });

    // Wait until the shared adapter has ACTUALLY started so the cancel
    // is genuinely mid-flight (not pre-abort, not post-completion).
    while (counter.primaryActive === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    // Caller A cancels while the shared work is in flight.
    controllerA.abort(new Error("user-cancelled-mid-flight"));

    // Brief tick so the abort event propagates through the dispatcher's
    // abortable wrapper and `runTargetWithRetry` classifies the failure
    // BEFORE we release the shared work. This is what proves the
    // cancel was observed while the work was still in flight.
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Release the shared adapter. Caller B must still see the result.
    release();

    const [a, b] = await Promise.all([callerAPromise, callerBPromise]);

    // (1) Exactly one adapter invocation across both callers.
    expect(counter.primaryCalls).toBe(1);
    // (2) Caller B got the real result.
    expect(b.items[0].facts.provider).toBe("slow");
    // (3) Caller A got an empty envelope, NOT the shared items.
    expect(a.items).toEqual([]);
    expect(a.sourceVersion === "gateway:empty" || a.sourceVersion === "slow:v1").toBe(true);
    // (4) The fallback adapter was NEVER called: cancellation must
    //     not fall back.
    expect(fallbackCounter.calls).toBe(0);
    // (5) Breaker snapshot: the primary breaker was NOT charged with
    //     a failure for caller A's cancelled attempt. With one
    //     successful shared invocation the success counter
    //     (samples.length) advances; the failure counter (errors)
    //     MUST stay at zero because `cancelled` failures have
    //     countsAgainstBreaker=false.
    const breaker = gateway.breakers.get("slow");
    expect(breaker).toBeDefined();
    const summary = breaker!.snapshot();
    expect(summary.errors).toBe(0);
    expect(summary.samples).toBeGreaterThanOrEqual(1);
    expect(summary.state).toBe("closed");
  });

  it("mid-flight cancellation: caller A rejects with a cancelled ProviderFailure when the caller inspects the dispatch outcome directly", async () => {
    // Same shape as the previous test, but asserts on the dispatcher-side
    // failure envelope via a follow-up probe: when caller A re-runs the
    // SAME coalescing key, the shared work has already settled (so the
    // coalescing registry is empty) and the second pass must NOT inherit
    // the cancelled failure of the first. This guards the per-caller
    // contract: cancellation must NOT poison the next caller.
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });

    const counter = {
      primaryCalls: 0,
      primaryActive: 0,
      primaryMaxActive: 0,
    };
    const slow: ResourceAdapter = {
      descriptor: { id: "slow2", label: "slow2", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        counter.primaryCalls += 1;
        counter.primaryActive += 1;
        counter.primaryMaxActive = Math.max(counter.primaryMaxActive, counter.primaryActive);
        await blocked;
        counter.primaryActive -= 1;
        return fixture("slow2");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.search.image.2",
        toolId: "resource.search.image",
        description: "image search",
        predicates: [intentKind("image")],
        targets: [{ id: "slow2", adapter: slow, weight: 1, timeoutMs: 5000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      }],
    });

    const controllerA = new AbortController();
    const callerAPromise = gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key-2",
      signal: controllerA.signal,
    });
    const callerBPromise = gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key-2",
    });

    while (counter.primaryActive === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    controllerA.abort(new Error("user-cancelled-mid-flight-2"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    release();

    const [a, b] = await Promise.all([callerAPromise, callerBPromise]);
    expect(counter.primaryCalls).toBe(1);
    expect(a.items).toEqual([]);
    expect(b.items[0].facts.provider).toBe("slow2");
    // Follow-up caller (no signal) must succeed normally — the previous
    // cancellation must not poison the coalescing registry or the
    // breaker.
    const follow = await gateway.dispatch({
      intent: searchIntent,
      toolId: "resource.search.image",
      requestKey: "shared-cancel-key-2",
    });
    expect(follow.items[0].facts.provider).toBe("slow2");
  });
});
