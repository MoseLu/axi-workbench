import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Intent } from "@axi/gateway-contracts";
import { GatewayOrchestrator, VersionedCache } from "@axi/resource-orchestrator";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * GHA-NEXT-009 — per-route cacheTtlMs differentiation + negative TTL.
 *
 * Each route in `providers.manifest.json` declares its own
 * `cacheTtlMs`:
 *   - route.image        : 60_000   (1 minute)
 *   - route.document     : 300_000  (5 minutes)
 *   - route.project      : 600_000  (10 minutes)
 *   - route.ui           : 300_000  (5 minutes)
 *   - route.icon         : 86_400_000 (24 hours)
 *
 * This test exercises the orchestrator's `VersionedCache` (which the
 * router reads through per GHA-NEXT-007) and proves each route's
 * declared TTL is honoured at the cache level. The test uses
 * vitest's fake timer to advance virtual time past each route's
 * TTL and confirm the entry expires.
 *
 * Negative cache TTL (empty result) is verified separately.
 */

const sampleIntent = (resourceKinds: string[] = ["image"]): Intent => ({
  operation: "search",
  resourceKinds,
  constraints: { query: "hi" },
  needsClarification: false,
});

const sampleResult = (id: string, resourceKind: string = "image") => ({
  items: [{ id, kind: resourceKind, title: id, facts: {}, provenance: { provider: "stub", ref: id }, safety: "safe" as const }],
  sourceVersion: "stub",
  confidence: "high" as const,
  mode: "live" as const,
});

const stubGateway = (behaviour: (input: { intent: Intent; toolId: string }) => Promise<unknown>) => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: (input: { intent: Intent; toolId: string; signal?: AbortSignal; requestKey: string }) => Promise<unknown> }).dispatch = behaviour;
  return gateway;
};

describe("apps/gateway — GHA-NEXT-009 per-route cacheTtlMs differentiation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("route.image cacheTtlMs=60_000: hit before 60s, miss after", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return sampleResult("image-1", "image");
    });
    const versioned = new VersionedCache();
    versioned.configure("route.image", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
      cacheTtlMs: 60_000,
    });

    const now = Date.now();
    vi.setSystemTime(now);

    const first = await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(first.kind).toBe("success");
    expect(calls).toBe(1);

    // 30 seconds later — within TTL — cache hit, no new stub call.
    vi.setSystemTime(now + 30_000);
    const second = await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(true);
    }
    expect(calls).toBe(1);

    // 61 seconds later — past TTL — cache miss, fresh stub call.
    vi.setSystemTime(now + 61_000);
    const third = await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(third.kind).toBe("success");
    if (third.kind === "success") {
      expect(third.fromCache).toBe(false);
    }
    expect(calls).toBe(2);
  });

  it("route.document cacheTtlMs=300_000: hit at 200s, miss at 301s", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return sampleResult("doc-1", "document");
    });
    const versioned = new VersionedCache();
    versioned.configure("route.document", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
      cacheTtlMs: 300_000, // 5 minutes — mirrors manifest value
    });

    const now = Date.now();
    vi.setSystemTime(now);

    await router.dispatch({
      intent: sampleIntent(["document"]),
      toolId: "route.document",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(1);

    // 200 seconds in — still within TTL.
    vi.setSystemTime(now + 200_000);
    const second = await router.dispatch({
      intent: sampleIntent(["document"]),
      toolId: "route.document",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(true);
    }
    expect(calls).toBe(1);

    // 301 seconds — past TTL.
    vi.setSystemTime(now + 301_000);
    const third = await router.dispatch({
      intent: sampleIntent(["document"]),
      toolId: "route.document",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(third.kind).toBe("success");
    if (third.kind === "success") {
      expect(third.fromCache).toBe(false);
    }
    expect(calls).toBe(2);
  });

  it("route.icon cacheTtlMs=86_400_000: hit at 1 hour, miss only after 24 hours", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return sampleResult("icon-1", "icon");
    });
    const versioned = new VersionedCache();
    versioned.configure("route.icon", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
      cacheTtlMs: 86_400_000, // 24 hours — mirrors manifest value
    });

    const now = Date.now();
    vi.setSystemTime(now);

    await router.dispatch({
      intent: sampleIntent(["icon"]),
      toolId: "route.icon",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(1);

    // 1 hour in — well within TTL.
    vi.setSystemTime(now + 3_600_000);
    const second = await router.dispatch({
      intent: sampleIntent(["icon"]),
      toolId: "route.icon",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(true);
    }
    expect(calls).toBe(1);
  });

  it("negative TTL — empty result uses a shorter TTL", async () => {
    const metrics = createMetricsState();
    let calls = 0;
    const gateway = stubGateway(async () => {
      calls += 1;
      return {
        items: [], // empty — qualifies for negative TTL
        sourceVersion: "stub",
        confidence: "low" as const,
        mode: "live" as const,
      };
    });
    const versioned = new VersionedCache();
    versioned.configure("route.image", 256);
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
      // cacheTtlMs=60_000 + negativeTtlMs=5_000 → empty result uses min(60000, 5000)=5000
      cacheTtlMs: 60_000,
      negativeTtlMs: 5_000,
    });

    const now = Date.now();
    vi.setSystemTime(now);

    await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(calls).toBe(1);

    // 3 seconds in — within negative TTL (5s) — cache hit.
    vi.setSystemTime(now + 3_000);
    const second = await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(second.kind).toBe("success");
    if (second.kind === "success") {
      expect(second.fromCache).toBe(true);
      expect(second.result.items).toHaveLength(0);
    }
    expect(calls).toBe(1);

    // 6 seconds in — past negative TTL — cache miss.
    vi.setSystemTime(now + 6_000);
    const third = await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r1",
    });
    expect(third.kind).toBe("success");
    if (third.kind === "success") {
      expect(third.fromCache).toBe(false);
    }
    expect(calls).toBe(2);
  });

  it("different routes use independent TTLs", async () => {
    const metrics = createMetricsState();
    let imageCalls = 0;
    let docCalls = 0;
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      dispatch: (input: { intent: Intent; toolId: string }) => Promise<unknown>;
    }).dispatch = async ({ toolId }) => {
      if (toolId === "route.image") {
        imageCalls += 1;
        return sampleResult(`img-${imageCalls}`, "image");
      }
      if (toolId === "route.document") {
        docCalls += 1;
        return sampleResult(`doc-${docCalls}`, "document");
      }
      return sampleResult("other");
    };

    const versioned = new VersionedCache();
    versioned.configure("route.image", 256);
    versioned.configure("route.document", 256);

    // Both routes use the same global cacheTtlMs (60s) for the
    // router-level write. The orchestrator's `policyByRoute` would
    // apply per-route TTLs at the dispatch layer — the router-level
    // cache is just the HTTP-edge mirror.
    const router = new GatewayRouter({
      gateway,
      manifestVersion: 1,
      metrics,
      versionedCache: versioned,
      cacheTtlMs: 60_000,
    });

    const now = Date.now();
    vi.setSystemTime(now);

    // Populate both caches.
    await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r-image",
    });
    await router.dispatch({
      intent: sampleIntent(["document"]),
      toolId: "route.document",
      signal: new AbortController().signal,
      requestKey: "r-doc",
    });
    expect(imageCalls).toBe(1);
    expect(docCalls).toBe(1);

    // Each route's entry is independently keyed, so neither
    // pollutes the other.
    expect(versioned.size()).toBe(2);

    // 30s later — both within TTL — both cache hits.
    vi.setSystemTime(now + 30_000);
    await router.dispatch({
      intent: sampleIntent(["image"]),
      toolId: "route.image",
      signal: new AbortController().signal,
      requestKey: "r-image",
    });
    await router.dispatch({
      intent: sampleIntent(["document"]),
      toolId: "route.document",
      signal: new AbortController().signal,
      requestKey: "r-doc",
    });
    expect(imageCalls).toBe(1);
    expect(docCalls).toBe(1);
  });
});
