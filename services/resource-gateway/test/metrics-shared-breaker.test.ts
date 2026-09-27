/**
 * /metrics shared breaker snapshot tests (GHA-NEXT-028).
 *
 * Verifies that the `RouterOptions.sharedState` field is honoured by
 * the router's `sharedBreakerSnapshots()` method and that the merged
 * view is what the metrics builder accepts as `sharedBreakers`.
 *
 * The router's `breakerSnapshots()` continues to return local-only
 * snapshots; the new method returns the merged view (local +
 * cross-instance). Server.ts wires the /metrics handler to call
 * `sharedBreakerSnapshots()` so cross-instance state is reflected in
 * the response within the configured `propagationMs` budget (default
 * 100 ms).
 */

import { describe, expect, it } from "vitest";
import { GatewayRouter } from "../src/router.js";
import { createMetricsState } from "../src/metrics.js";
import { buildMetricsResponse } from "../src/metrics.js";
import type { SharedStateManager } from "@axi/resource-orchestrator";
import type { GatewayOrchestrator } from "@axi/resource-orchestrator";

const buildStubOrchestrator = (): GatewayOrchestrator => {
  const orchestrator = {} as GatewayOrchestrator;
  (orchestrator as unknown as { breakers: Map<string, unknown> }).breakers = new Map<string, unknown>();
  return orchestrator;
};

describe("Router shared breaker snapshots (GHA-NEXT-028)", () => {
  it("returns local-only snapshots when no SharedStateManager is wired", () => {
    const router = new GatewayRouter({
      gateway: buildStubOrchestrator(),
      manifestVersion: 1,
      metrics: createMetricsState(),
    });
    expect(router.sharedBreakerSnapshots()).toEqual([]);
  });

  it("falls back to local when sharedState.breaker.isAvailable() === false", () => {
    const sharedState = {
      breaker: { isAvailable: () => false, snapshotAll: () => new Map() },
      rateLimit: { isAvailable: () => false },
      idempotency: { isAvailable: () => false },
      cache: { isAvailable: () => false },
      snapshot: { isAvailable: () => false },
      coalesce: { isAvailable: () => false },
      isEnabled: false,
      dispose: () => {},
    } as unknown as SharedStateManager;
    const router = new GatewayRouter({
      gateway: buildStubOrchestrator(),
      manifestVersion: 1,
      metrics: createMetricsState(),
      sharedState,
    });
    expect(router.sharedBreakerSnapshots()).toEqual([]);
  });

  it("merges local + remote snapshots, with local winning on targetId collisions", () => {
    const sharedState = {
      breaker: {
        isAvailable: () => true,
        snapshotAll: () => new Map<string, { state: "closed" | "open" | "half-open"; samples: number; errors: number; openedAt: number; probeInFlight: boolean }>([
          ["remote-only", { state: "open", samples: 10, errors: 9, openedAt: 123, probeInFlight: false }],
          ["shared", { state: "half-open", samples: 5, errors: 4, openedAt: 456, probeInFlight: true }],
        ]),
      },
      rateLimit: { isAvailable: () => false },
      idempotency: { isAvailable: () => false },
      cache: { isAvailable: () => false },
      snapshot: { isAvailable: () => false },
      coalesce: { isAvailable: () => false },
      isEnabled: true,
      dispose: () => {},
    } as unknown as SharedStateManager;
    const router = new GatewayRouter({
      gateway: buildStubOrchestrator(),
      manifestVersion: 1,
      metrics: createMetricsState(),
      sharedState,
    });
    const merged = router.sharedBreakerSnapshots();
    // No local breakers (stub), so the merged view equals the remote map.
    expect(merged.length).toBe(2);
    expect(merged.find((entry) => entry.targetId === "remote-only")?.state).toBe("open");
    expect(merged.find((entry) => entry.targetId === "shared")?.state).toBe("half-open");
  });

  it("buildMetricsResponse accepts the shared breaker view", () => {
    const local = [{ targetId: "local-1", routeId: "r1", state: "closed" as const, samples: 1, errors: 0, openedAt: 0 }];
    const shared = [{ targetId: "remote-1", routeId: "r1", state: "open" as const, samples: 5, errors: 4, openedAt: 100 }];
    const body = buildMetricsResponse({
      state: createMetricsState(),
      manifestVersion: 1,
      breakers: local,
      sharedBreakers: shared,
    });
    expect(body.breakers.length).toBe(2);
    expect(body.breakers.find((b) => b.targetId === "local-1")).toBeDefined();
    expect(body.breakers.find((b) => b.targetId === "remote-1")).toBeDefined();
  });

  it("buildMetricsResponse without sharedBreakers still works (backward-compatible)", () => {
    const local = [{ targetId: "local-1", routeId: "r1", state: "closed" as const, samples: 1, errors: 0, openedAt: 0 }];
    const body = buildMetricsResponse({
      state: createMetricsState(),
      manifestVersion: 1,
      breakers: local,
    });
    expect(body.breakers.length).toBe(1);
  });
});