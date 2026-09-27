import { describe, expect, it } from "vitest";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";
import { metricsResponseSchema, routeMetricsSchema, breakerSnapshotSchema } from "@axi/gateway-contracts";

import { buildMetricsResponse, createMetricsState, recordRequestEnd, recordRequestStart } from "../src/metrics";
import { GatewayRouter } from "../src/router";

/**
 * Behaviour-first coverage for the /metrics breaker projection
 * (lane-mm-gateway-tests requirement 5).
 *
 * The /metrics endpoint composes its body by reading
 * `router.breakerSnapshots()` and feeding the result into
 * `buildMetricsResponse({ state, manifestVersion, breakers })`.
 * We assert the contract shape:
 *
 *   - The MetricsResponse validates against `metricsResponseSchema`.
 *   - Per-route counters are projected via `routeMetricsSchema`.
 *   - Each breaker snapshot is strictly `BreakerSnapshot` shaped
 *     (targetId, routeId, state, samples, errors, openedAt) and
 *     contains no forbidden fields.
 *   - Manifest version is preserved; `capturedAt` is ISO-8601.
 *   - Empty registries produce a valid empty-arrays payload.
 */

const makeBreaker = (overrides: {
  state?: "closed" | "open" | "half-open";
  samples?: number;
  errors?: number;
  openedAt?: number;
}) => ({
  state: overrides.state ?? "closed",
  samples: overrides.samples ?? 0,
  errors: overrides.errors ?? 0,
  openedAt: overrides.openedAt ?? 0,
  snapshot() {
    return { state: this.state, samples: this.samples, errors: this.errors, openedAt: this.openedAt, probeInFlight: false };
  },
});

describe("apps/gateway /metrics breaker projection", () => {
  it("composes a contract-shaped MetricsResponse from router.breakerSnapshots()", () => {
    const metrics = createMetricsState();
    recordRequestStart(metrics, "resource.search.image");
    recordRequestEnd(metrics, "resource.search.image", { cacheHit: true, latencyMs: 12 });
    recordRequestStart(metrics, "resource.search.ui");
    recordRequestEnd(metrics, "resource.search.ui", { failureKind: "timeout", latencyMs: 40 });

    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway.breakers as unknown as Map<string, unknown>).set("image-factory.axi-image-preview", makeBreaker({ state: "closed", samples: 8 }));
    (gateway.breakers as unknown as Map<string, unknown>).set("docs-factory.axi-docs", makeBreaker({ state: "open", samples: 20, errors: 9, openedAt: 1_700_000_000_000 }));

    const router = new GatewayRouter({ gateway, manifestVersion: 7, metrics });
    const breakers = router.breakerSnapshots();

    const response = buildMetricsResponse({
      state: metrics,
      manifestVersion: 7,
      breakers,
    });

    // The composed payload must validate against the contract.
    const parsed = metricsResponseSchema.parse(response);
    expect(parsed.manifestVersion).toBe(7);
    expect(parsed.contractVersion).toBe(1);
    expect(typeof parsed.capturedAt).toBe("string");
    expect(new Date(parsed.capturedAt).toString()).not.toBe("Invalid Date");
    expect(parsed.routes).toHaveLength(2);
    expect(parsed.breakers).toHaveLength(2);

    // Per-route entries are validated individually as well.
    for (const route of parsed.routes) {
      routeMetricsSchema.parse(route);
    }
    for (const breaker of parsed.breakers) {
      breakerSnapshotSchema.parse(breaker);
    }

    // The image route carries the cache hit we recorded.
    const imageRoute = parsed.routes.find((r) => r.routeId === "resource.search.image");
    expect(imageRoute).toBeDefined();
    expect(imageRoute?.requestCount).toBe(1);
    expect(imageRoute?.cacheHitCount).toBe(1);

    // The ui route carries the timeout failure.
    const uiRoute = parsed.routes.find((r) => r.routeId === "resource.search.ui");
    expect(uiRoute).toBeDefined();
    expect(uiRoute?.failureCounts.timeout).toBe(1);

    // The breaker snapshots match the registry input.
    const openOne = parsed.breakers.find((b) => b.targetId === "docs-factory.axi-docs");
    expect(openOne).toBeDefined();
    expect(openOne?.state).toBe("open");
    expect(openOne?.errors).toBe(9);
    expect(openOne?.openedAt).toBe(1_700_000_000_000);
  });

  it("projected payload contains no adapter/url/secret fields", () => {
    const metrics = createMetricsState();
    recordRequestStart(metrics, "resource.search.image");
    recordRequestEnd(metrics, "resource.search.image", { latencyMs: 5 });

    const gateway = new GatewayOrchestrator({ routes: [] });
    const leaky = makeBreaker({});
    // Attach forbidden fields to the breaker object — the
    // projection must NOT carry them through to the response.
    (leaky as Record<string, unknown>).url = "http://secret.invalid/x";
    (leaky as Record<string, unknown>).token = "bearer-shhh";
    (leaky as Record<string, unknown>).query = "secret=1";
    (gateway.breakers as unknown as Map<string, unknown>).set("image-factory.axi-image-preview", leaky);

    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
    const response = buildMetricsResponse({ state: metrics, manifestVersion: 1, breakers: router.breakerSnapshots() });

    const json = JSON.stringify(response);
    expect(json).not.toMatch(/secret\.invalid|bearer-shhh|secret=1/u);

    const breaker = response.breakers[0];
    expect(breaker).toBeDefined();
    if (breaker) {
      expect(Object.keys(breaker).sort()).toEqual(["errors", "openedAt", "routeId", "samples", "state", "targetId"]);
    }
  });

  it("empty registry produces a valid empty-arrays payload", () => {
    const metrics = createMetricsState();
    const gateway = new GatewayOrchestrator({ routes: [] });
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });

    const response = buildMetricsResponse({ state: metrics, manifestVersion: 1, breakers: router.breakerSnapshots() });
    const parsed = metricsResponseSchema.parse(response);
    expect(parsed.routes).toEqual([]);
    expect(parsed.breakers).toEqual([]);
    expect(parsed.manifestVersion).toBe(1);
  });

  it("multiple recordRequestEnd calls accumulate latency samples correctly", () => {
    const metrics = createMetricsState();
    recordRequestStart(metrics, "resource.search.image");
    recordRequestEnd(metrics, "resource.search.image", { latencyMs: 10 });
    recordRequestEnd(metrics, "resource.search.image", { latencyMs: 20 });
    recordRequestEnd(metrics, "resource.search.image", { latencyMs: 30 });

    const response = buildMetricsResponse({
      state: metrics,
      manifestVersion: 1,
      breakers: [],
    });

    const image = response.routes.find((r) => r.routeId === "resource.search.image");
    expect(image).toBeDefined();
    // p50 over [10, 20, 30] = 20; p95 = 30 (small sample).
    expect(image?.p50Ms).toBe(20);
    expect(image?.p95Ms).toBe(20);
    expect(image?.p99Ms).toBe(20);
  });
  it("percentile computation is stable across latency sample arrays", () => {
    const metrics = createMetricsState();
    recordRequestStart(metrics, "resource.search.image");
    for (let i = 1; i <= 20; i += 1) {
      recordRequestEnd(metrics, "resource.search.image", { latencyMs: i * 5 });
    }

    const response = buildMetricsResponse({
      state: metrics,
      manifestVersion: 1,
      breakers: [],
    });

    const image = response.routes.find((r) => r.routeId === "resource.search.image");
    expect(image).toBeDefined();
    // Sorted latencies: [5,10,...,100]. p50 of 20 samples picks
    // index floor(0.5*19)=9 → 50; p95 picks floor(0.95*19)=18 → 95;
    // p99 picks floor(0.99*19)=18 → 95.
    expect(image?.p50Ms).toBe(50);
    expect(image?.p95Ms).toBe(95);
    expect(image?.p99Ms).toBe(95);
    expect(image?.requestCount).toBe(1);
  });
});
