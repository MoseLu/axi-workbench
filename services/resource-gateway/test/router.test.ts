import { describe, expect, it } from "vitest";
import type { Intent } from "@axi/gateway-contracts";
import { CoalescingRegistry, GatewayOrchestrator, VersionedCache } from "@axi/resource-orchestrator";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * Stage 1.5 Gate — GHA-NEXT-007 / GHA-NEXT-008 single-track cache +
 * coalescing. The router no longer keeps a private cache Map or an
 * in-flight Map. HTTP-edge cache hits and in-flight coalescing both
 * flow through the orchestrator's `VersionedCache` and
 * `CoalescingRegistry`. Tests construct those stores directly so the
 * router's single-track semantics are observable end to end.
 */

const stubGateway = (behaviour: (input: { intent: Intent; toolId: string; signal?: AbortSignal }) => Promise<unknown>) => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: (input: { intent: Intent; toolId: string; signal?: AbortSignal }) => Promise<unknown> }).dispatch = behaviour;
  return gateway;
};

const sampleIntent = (resourceKinds: string[] = ["image"]): Intent => ({
  operation: "search",
  resourceKinds,
  constraints: { query: "hi" },
  needsClarification: false,
});

const configureRouter = (options: { gateway: GatewayOrchestrator; metrics: ReturnType<typeof createMetricsState>; versionedCache?: VersionedCache; coalescing?: CoalescingRegistry; cacheTtlMs?: number }) => {
  const versioned = options.versionedCache ?? new VersionedCache();
  versioned.configure("resource.search.image", 256);
  versioned.configure("resource.search.project", 256);
  const coalescing = options.coalescing ?? new CoalescingRegistry();
  return new GatewayRouter({
    gateway: options.gateway,
    manifestVersion: 1,
    metrics: options.metrics,
    versionedCache: versioned,
    coalescing,
    cacheTtlMs: options.cacheTtlMs,
  });
};

describe("apps/gateway GatewayRouter", () => {
  it("returns success and bumps metrics for a happy path", async () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => ({
      items: [{ id: "i1", kind: "image", title: "t", facts: {}, provenance: { provider: "x", ref: "y" }, safety: "safe" }],
      sourceVersion: "stub",
      confidence: "high",
      mode: "live",
    }));
    const router = configureRouter({ gateway, metrics });
    const outcome = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.fromCache).toBe(false);
      expect(outcome.result.items.length).toBe(1);
    }
    // Stage 1.5 Gate: cache lives in the orchestrator's VersionedCache.
    expect(router.cacheSize()).toBe(1);
  });

  it("returns a cached result on the second call with fromCache=true", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return {
        items: [{ id: "i1", kind: "image", title: "t", facts: {}, provenance: { provider: "x", ref: "y" }, safety: "safe" }],
        sourceVersion: "stub",
        confidence: "high",
        mode: "live",
      };
    });
    const router = configureRouter({ gateway, metrics });
    const first = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    const second = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(1);
    expect(first.kind).toBe("success");
    expect(second.kind).toBe("success");
    if (first.kind === "success" && second.kind === "success") {
      expect(second.fromCache).toBe(true);
    }
  });

  it("normalises thrown errors into typed failures", async () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => {
      throw new Error("kaboom");
    });
    const router = configureRouter({ gateway, metrics });
    const outcome = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.failure.kind).toBe("internal");
      expect(outcome.failure.routeId).toBe("resource.search.image");
    }
  });

  it("classifies abort-style messages as cancelled", async () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => {
      throw new Error("request was aborted");
    });
    const router = configureRouter({ gateway, metrics });
    const outcome = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.failure.kind).toBe("cancelled");
    }
  });

  it("classifies timeout-style messages as timeout", async () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => {
      throw new Error("provider timeout after 8000ms");
    });
    const router = configureRouter({ gateway, metrics });
    const outcome = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.failure.kind).toBe("timeout");
    }
  });

  it("disables caching when cacheTtlMs=0", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return {
        items: [{ id: "i1", kind: "image", title: "t", facts: {}, provenance: { provider: "x", ref: "y" }, safety: "safe" }],
        sourceVersion: "stub",
        confidence: "high",
        mode: "live",
      };
    });
    const router = configureRouter({ gateway, metrics, cacheTtlMs: 0 });
    await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(2);
    expect(router.cacheSize()).toBe(0);
  });

  it("isolates cache by routeId", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async ({ toolId }) => {
      calls += 1;
      return {
        items: [{ id: `${toolId}-i`, kind: "image", title: toolId, facts: {}, provenance: { provider: "x", ref: "y" }, safety: "safe" }],
        sourceVersion: "stub",
        confidence: "high",
        mode: "live",
      };
    });
    const router = configureRouter({ gateway, metrics });
    const image = await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    const project = await router.dispatch({
      intent: sampleIntent(["project"]),
      toolId: "resource.search.project",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(image.kind).toBe("success");
    expect(project.kind).toBe("success");
    expect(calls).toBe(2);
    expect(router.cacheSize()).toBe(2);
  });
});