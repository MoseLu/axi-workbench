import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent } from "@axi/gateway-contracts";
import { CoalescingRegistry, GatewayOrchestrator, VersionedCache } from "@axi/resource-orchestrator";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * GHA-NEXT-007 / GHA-NEXT-008 — Stage 1.5 Gate evidence suite.
 *
 * Lane-instruction hard constraint #3 requires at least three router
 * single-track tests:
 *
 *   1. router no longer has a `this.cache` field (runtime reflection).
 *   2. router no longer has a `this.inFlight` field (runtime reflection).
 *   3. router cache hits are sourced from the orchestrator
 *      VersionedCache (verified by mocking the gateway to assert the
 *      second dispatch returned `fromCache: true` WITHOUT invoking
 *      the underlying gateway dispatch).
 *
 * Bonus:
 *   4. coalesced dispatch is sourced from the CoalescingRegistry
 *      (the underlying gateway dispatch is invoked exactly once for
 *      two concurrent callers sharing the same coalesce key).
 *
 * Together these tests prove that the router is the stateless
 * HTTP-edge wrapper described in `apps/gateway/src/router.ts` —
 * the orchestrator's `VersionedCache` + `CoalescingRegistry` are the
 * single owners of cache and in-flight state.
 */

const sampleIntent = (resourceKinds: string[] = ["image"]): Intent => ({
  operation: "search",
  resourceKinds,
  constraints: { query: "hi" },
  needsClarification: false,
});

const sampleResult = (id: string): AdapterSearchResult => ({
  items: [
    { id, kind: "image", title: id, facts: {}, provenance: { provider: "stub", ref: id }, safety: "safe" },
  ],
  sourceVersion: "stub",
  confidence: "high",
  mode: "live",
});

const stubGateway = (behaviour: (input: { intent: Intent; toolId: string; signal?: AbortSignal; requestKey: string }) => Promise<AdapterSearchResult>) => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as {
    dispatch: (input: { intent: Intent; toolId: string; signal?: AbortSignal; requestKey: string }) => Promise<AdapterSearchResult>;
  }).dispatch = behaviour;
  return gateway;
};

describe("apps/gateway GatewayRouter — Stage 1.5 Gate single-track evidence", () => {
  it("router no longer exposes a `this.cache` Map field (Stage 1.5 Gate)", () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => sampleResult("i1"));
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
    // Reflective check: the private Map field must NOT exist. We
    // access via `unknown` so the compiler does not block the check;
    // a `Map` field would materialise as `Map<string, unknown>`.
    const fieldNames = Object.getOwnPropertyNames(router);
    expect(fieldNames).not.toContain("cache");
    const slot = (router as unknown as { cache?: unknown }).cache;
    expect(slot).toBeUndefined();
  });

  it("router no longer exposes a `this.inFlight` Map field (Stage 1.5 Gate)", () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => sampleResult("i1"));
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
    // Reflective check: the private Map field must NOT exist.
    const fieldNames = Object.getOwnPropertyNames(router);
    expect(fieldNames).not.toContain("inFlight");
    const slot = (router as unknown as { inFlight?: unknown }).inFlight;
    expect(slot).toBeUndefined();
  });

  it("router cache hits are returned by the orchestrator VersionedCache (gateway is NOT invoked on the second dispatch)", async () => {
    const metrics = createMetricsState();
    let dispatchCalls = 0;
    const gateway = stubGateway(async () => {
      dispatchCalls += 1;
      return sampleResult("v1");
    });
    const versioned = new VersionedCache();
    versioned.configure("resource.search.image", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
    });

    // First dispatch — must invoke the gateway and populate the
    // orchestrator's VersionedCache (single-track cache owner).
    const first = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(first.kind).toBe("success");
    expect(dispatchCalls).toBe(1);
    if (first.kind === "success") {
      expect(first.fromCache).toBe(false);
    }
    expect(versioned.size()).toBe(1);

    // Second dispatch with the SAME coalesce key — the router
    // consults the orchestrator's VersionedCache FIRST and returns
    // a cached result WITHOUT invoking the underlying gateway
    // dispatch. This is the single-track contract: orchestrator
    // VersionedCache is the source of truth for HTTP-edge cache
    // hits, the router is just the read-through caller.
    const second = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(dispatchCalls).toBe(1); // no new gateway call
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(true);
    }
  });

  it("router coalesces concurrent dispatches via the orchestrator CoalescingRegistry (gateway is invoked exactly once)", async () => {
    const metrics = createMetricsState();
    let dispatchCalls = 0;
    let releaseShared!: (value: AdapterSearchResult) => void;
    const sharedPromise = new Promise<AdapterSearchResult>((resolve) => {
      releaseShared = resolve;
    });
    const gateway = stubGateway(async () => {
      dispatchCalls += 1;
      return sharedPromise;
    });
    const coalescing = new CoalescingRegistry();
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      coalescing,
    });

    const controllerA = new AbortController();
    const controllerB = new AbortController();

    // Two concurrent callers on the SAME coalesce key. The router
    // must register through the orchestrator's CoalescingRegistry
    // so the second caller joins the first dispatch.
    const promiseA = router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: controllerA.signal,
      requestKey: "shared-key",
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const promiseB = router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: controllerB.signal,
      requestKey: "shared-key",
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Stage 1.5 Gate — single-track coalescing: the underlying
    // gateway dispatch is invoked exactly once even though two
    // callers raced on the same coalesce key.
    expect(dispatchCalls).toBe(1);

    releaseShared(sampleResult("merged"));
    const [outcomeA, outcomeB] = await Promise.all([promiseA, promiseB]);
    expect(outcomeA.kind).toBe("success");
    expect(outcomeB.kind).toBe("success");

    // After settlement the CoalescingRegistry cleans itself up;
    // shareCount returns 0 because the registry's `.finally()`
    // removed the entry. There is no router-owned Map to inspect.
    const registryKey = {
      routeId: "resource.search.image",
      idempotencyKey: "resource.search.image|shared-key|1",
      manifestVersion: 1,
    };
    expect(coalescing.shareCount(registryKey)).toBe(0);
  });
});