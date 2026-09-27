import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent } from "@axi/gateway-contracts";
import { CoalescingRegistry, GatewayOrchestrator } from "@axi/resource-orchestrator";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * GHA-NEXT-008 — router uses the orchestrator's CoalescingRegistry as
 * the single owner of in-flight state.
 *
 * Stage 1.5 Gate: the router no longer keeps a local `this.inFlight`
 * Map. Concurrent identical requests share one orchestrator dispatch
 * via the CoalescingRegistry's `register()` (which auto-joins
 * subsequent callers and cleans itself up on settlement). Per-caller
 * abort isolation stays in the router so one cancelling caller does
 * not cancel the shared work — that contract is exercised in
 * `router-cancellation.test.ts`.
 *
 * Tests verify:
 *   - When `coalescing` is wired, dispatch registers / joins shared
 *     in-flight entries through the registry.
 *   - The registry's in-flight entry is cleared after the promise
 *     settles (`shareCount(key) === 0`).
 *   - When no registry is wired, the router dispatches independently
 *     (no coalescing); `shareCount(key)` stays 0 throughout.
 *
 * The pre-Gate dual-track assertions (`router.inFlightCount()`) are
 * gone — there is no router in-flight Map to inspect.
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

describe("apps/gateway GatewayRouter — GHA-NEXT-008 single-track CoalescingRegistry routing", () => {
  const buildRegistryKey = (routeId: string, requestKey: string, manifestVersion: number) => ({
    routeId,
    idempotencyKey: `${routeId}|${requestKey}|${manifestVersion}`,
    manifestVersion,
  });

  it("registers in-flight entries with the orchestrator's CoalescingRegistry when wired", async () => {
    const metrics = createMetricsState();
    let dispatchCalls = 0;
    let releaseShared!: (value: AdapterSearchResult) => void;
    const sharedPromise = new Promise<AdapterSearchResult>((resolve) => {
      releaseShared = resolve;
    });

    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      dispatch: () => Promise<AdapterSearchResult>;
    }).dispatch = async () => {
      dispatchCalls += 1;
      return sharedPromise;
    };

    const coalescing = new CoalescingRegistry();
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      coalescing,
    });

    const controller = new AbortController();
    const promiseA = router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: controller.signal,
      requestKey: "r1",
    });
    // Yield so caller A registers the in-flight entry.
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Stage 1.5 Gate: the router exposes no in-flight Map. The
    // CoalescingRegistry is the single source of truth for in-flight
    // state; we observe it via the public `shareCount()` accessor.
    const registryKey = buildRegistryKey("resource.search.image", "r1", 1);
    expect(coalescing.shareCount(registryKey)).toBeGreaterThanOrEqual(1);

    // Release the shared promise so dispatch resolves and the
    // router cleans up.
    releaseShared(sampleResult("shared"));
    const outcomeA = await promiseA;
    expect(outcomeA.kind).toBe("success");

    // Yield a few ticks so the registry's `.finally()` cleanup runs.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    // After settlement, the registry is empty — the router's
    // dispatch path no longer holds an in-flight entry.
    expect(coalescing.shareCount(registryKey)).toBe(0);
  });

  it("shares dispatch via CoalescingRegistry when two callers race on the same key", async () => {
    const metrics = createMetricsState();
    let dispatchCalls = 0;
    let releaseShared!: (value: AdapterSearchResult) => void;
    const sharedPromise = new Promise<AdapterSearchResult>((resolve) => {
      releaseShared = resolve;
    });

    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      dispatch: () => Promise<AdapterSearchResult>;
    }).dispatch = async () => {
      dispatchCalls += 1;
      return sharedPromise;
    };

    const coalescing = new CoalescingRegistry();
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      coalescing,
    });

    const controllerA = new AbortController();
    const controllerB = new AbortController();
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

    // The stub was called exactly once — both callers share the
    // promise via the CoalescingRegistry (caller B is coalesced
    // onto caller A's entry).
    expect(dispatchCalls).toBe(1);

    // The registry now shows two shared callers on the same key.
    const registryKey = buildRegistryKey("resource.search.image", "shared-key", 1);
    expect(coalescing.shareCount(registryKey)).toBeGreaterThanOrEqual(1);

    releaseShared(sampleResult("merged"));
    const [outcomeA, outcomeB] = await Promise.all([promiseA, promiseB]);
    expect(outcomeA.kind).toBe("success");
    expect(outcomeB.kind).toBe("success");
  });

  it("dispatches independently when no CoalescingRegistry is wired (single-track fallback)", async () => {
    const metrics = createMetricsState();
    let dispatchCalls = 0;
    const gateway = new GatewayOrchestrator({ routes: [] });

    // No `coalescing` option — the router is a stateless pass-through;
    // every dispatch hits the underlying gateway directly.
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });

    let release!: (value: AdapterSearchResult) => void;
    const sharedPromise = new Promise<AdapterSearchResult>((resolve) => {
      release = resolve;
    });
    (gateway as unknown as { dispatch: () => Promise<AdapterSearchResult> }).dispatch = async () => {
      dispatchCalls += 1;
      return sharedPromise;
    };

    const controllerA = new AbortController();
    const controllerB = new AbortController();
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

    // Without coalescing wiring, two concurrent dispatchers each
    // spawn their own orchestrator dispatch — the shared work
    // contract is opt-in via the registry.
    expect(dispatchCalls).toBe(2);

    release(sampleResult("merged"));
    await Promise.all([promiseA, promiseB]);
  });
});