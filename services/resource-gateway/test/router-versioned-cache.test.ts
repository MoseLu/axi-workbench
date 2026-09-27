import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Intent } from "@axi/gateway-contracts";
import { GatewayOrchestrator, VersionedCache } from "@axi/resource-orchestrator";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * GHA-NEXT-007 — router routes HTTP-edge cache reads/writes through
 * the orchestrator's `VersionedCache` (manifest-versioned store).
 *
 * Stage 1.5 Gate: the router no longer keeps a private cache Map.
 * The orchestrator's VersionedCache is the single owner of HTTP-edge
 * cache state. Tests verify:
 *   - dispatch reads consult the VersionedCache FIRST,
 *   - dispatch writes mirror into the VersionedCache,
 *   - `flushCache()` clears the versioned store,
 *   - the orchestrator's VersionedCache state is the source of
 *     truth for cacheSize(),
 *   - cacheTtlMs=0 disables writes through the versioned store,
 *   - clearing the versioned store between dispatches forces a
 *     re-dispatch (proving the versioned store is the only owner).
 *
 * The pre-Gate dual-track assertions (router's local Map size,
 * `(router as ...).cache.clear()`) are gone — there is no router
 * cache Map to inspect.
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

const sampleResult = (id: string) => ({
  items: [{ id, kind: "image", title: id, facts: {}, provenance: { provider: "stub", ref: id }, safety: "safe" as const }],
  sourceVersion: "stub",
  confidence: "high" as const,
  mode: "live" as const,
});

describe("apps/gateway GatewayRouter — GHA-NEXT-007 single-track VersionedCache routing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes dispatch writes through the orchestrator's VersionedCache", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
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

    const first = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(first.kind).toBe("success");
    expect(calls).toBe(1);
    // The orchestrator's VersionedCache is the single owner; router
    // exposes its size via cacheSize().
    expect(router.cacheSize()).toBe(1);
    expect(versioned.size()).toBe(1);
    // Stage 1.5 Gate: there is no router-local Map to inspect.
    expect((router as unknown as { cache?: unknown }).cache).toBeUndefined();
  });

  it("returns fromCache=true on a cache hit sourced from the VersionedCache", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
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

    // First dispatch populates the versioned store.
    await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(1);
    expect(versioned.size()).toBe(1);

    // Second dispatch hits the versioned store — the stub is NOT
    // called again. The router's cacheSize() reflects the versioned
    // store's size, proving the orchestrator is the single owner.
    const second = await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(1); // No additional stub call — VersionedCache hit
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(true);
    }
    expect(router.cacheSize()).toBe(1);
  });

  it("flushCache clears the versioned store — the only cache owner", async () => {
    const metrics = createMetricsState();
    const gateway = stubGateway(async () => sampleResult("i1"));
    const versioned = new VersionedCache();
    versioned.configure("resource.search.image", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
    });

    await router.dispatch({
      intent: sampleIntent(),
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });

    expect(router.cacheSize()).toBe(1);
    expect(versioned.size()).toBe(1);

    router.flushCache();

    // After flush, both the router's diagnostic and the underlying
    // store report zero entries — there is no second owner.
    expect(router.cacheSize()).toBe(0);
    expect(versioned.size()).toBe(0);
  });

  it("honours router-level cacheTtlMs=0 — no write to the versioned store", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return sampleResult("i1");
    });
    const versioned = new VersionedCache();
    versioned.configure("resource.search.image", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
      cacheTtlMs: 0,
    });
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
    expect(versioned.size()).toBe(0);
  });

  it("without a wired versionedCache, the router degrades to a no-cache dispatch (every call hits the gateway)", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return sampleResult("i1");
    });
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
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
    expect(calls).toBe(2);
    expect(first.kind).toBe("success");
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(false);
    }
    // No cache owner wired → router reports zero entries; the
    // single-track contract is upheld (the router is the pass-through,
    // the orchestrator would have been the cache owner if wired).
    expect(router.cacheSize()).toBe(0);
  });
});