import { describe, expect, it } from "vitest";
import {
  breakerSnapshotSchema,
  componentHealthSchema,
  componentStatusSchema,
  healthContractVersion,
  isReadinessAcceptable,
  livenessResponseSchema,
  metricsResponseSchema,
  readinessResponseSchema,
  routeMetricsSchema,
} from "./health";

/**
 * Health / readiness / metrics contract tests.
 *
 * Pin the liveness vs readiness split and the rule that a
 * non-essential component in `degraded` state still allows readiness
 * to pass when the caller opts in.
 */

describe("health/readiness/metrics contract", () => {
  it("pins the health contract version", () => {
    expect(healthContractVersion).toBe(1);
  });

  it("covers the closed component status enum", () => {
    expect(componentStatusSchema.options).toEqual(["up", "down", "degraded", "starting"]);
    for (const value of ["up", "down", "degraded", "starting"] as const) {
      expect(componentStatusSchema.safeParse(value).success).toBe(true);
    }
    expect(componentStatusSchema.safeParse("active").success).toBe(false);
  });

  it("accepts a liveness response", () => {
    const result = livenessResponseSchema.safeParse({
      contractVersion: 1,
      status: "ok",
      uptimeMs: 1234,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a liveness response with the wrong contract version", () => {
    const result = livenessResponseSchema.safeParse({ contractVersion: 99, status: "ok", uptimeMs: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts a readiness response with all-up components", () => {
    const result = readinessResponseSchema.safeParse({
      contractVersion: 1,
      status: "ready",
      manifestVersion: 1,
      routeCount: 10,
      components: [
        { id: "manifest", status: "up", lastCheckedAt: new Date().toISOString() },
        { id: "registry", status: "up", lastCheckedAt: new Date().toISOString() },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("fails readiness when status is not_ready regardless of components", () => {
    const response = {
      contractVersion: 1 as const,
      status: "not_ready" as const,
      manifestVersion: 0,
      routeCount: 0,
      components: [{ id: "manifest", status: "starting" as const, lastCheckedAt: new Date().toISOString() }],
    };
    expect(isReadinessAcceptable(response)).toBe(false);
  });

  it("fails readiness when a component is down", () => {
    const response = {
      contractVersion: 1 as const,
      status: "ready" as const,
      manifestVersion: 1,
      routeCount: 1,
      components: [
        { id: "manifest", status: "up" as const, lastCheckedAt: new Date().toISOString() },
        { id: "provider:image", status: "down" as const, lastCheckedAt: new Date().toISOString() },
      ],
    };
    expect(isReadinessAcceptable(response)).toBe(false);
  });

  it("passes readiness when components are degraded only with explicit opt-in", () => {
    const response = {
      contractVersion: 1 as const,
      status: "ready" as const,
      manifestVersion: 1,
      routeCount: 1,
      components: [
        { id: "manifest", status: "up" as const, lastCheckedAt: new Date().toISOString() },
        { id: "provider:image", status: "degraded" as const, lastCheckedAt: new Date().toISOString() },
      ],
    };
    expect(isReadinessAcceptable(response)).toBe(false);
    expect(isReadinessAcceptable(response, { allowDegraded: true })).toBe(true);
  });

  it("parses a component health entry", () => {
    const result = componentHealthSchema.safeParse({
      id: "manifest",
      status: "up",
      detail: "ok",
      lastCheckedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("parses a breaker snapshot", () => {
    const result = breakerSnapshotSchema.safeParse({
      targetId: "image-factory.axi-image-preview",
      routeId: "route.image",
      state: "half-open",
      samples: 5,
      errors: 2,
      openedAt: 0,
    });
    expect(result.success).toBe(true);
  });

  it("parses a route metrics summary", () => {
    const result = routeMetricsSchema.safeParse({
      routeId: "route.image",
      requestCount: 12,
      cacheHitCount: 4,
      coalescedCount: 1,
      failureCounts: { timeout: 1, network: 2 },
      p50Ms: 250,
      p95Ms: 1500,
      p99Ms: 4000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a route metrics summary with too many failure buckets", () => {
    const failureCounts: Record<string, number> = {};
    for (let index = 0; index < 33; index += 1) failureCounts[`kind-${index}`] = 0;
    const result = routeMetricsSchema.safeParse({
      routeId: "route.image",
      requestCount: 1,
      cacheHitCount: 0,
      coalescedCount: 0,
      failureCounts,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
    });
    expect(result.success).toBe(false);
  });

  it("parses a metrics response", () => {
    const result = metricsResponseSchema.safeParse({
      contractVersion: 1,
      manifestVersion: 1,
      capturedAt: new Date().toISOString(),
      routes: [{
        routeId: "route.image",
        requestCount: 1,
        cacheHitCount: 0,
        coalescedCount: 0,
        failureCounts: {},
        p50Ms: 10,
        p95Ms: 50,
        p99Ms: 100,
      }],
      breakers: [{
        targetId: "image-factory.axi-image-preview",
        routeId: "route.image",
        state: "closed",
        samples: 1,
        errors: 0,
        openedAt: 0,
      }],
    });
    expect(result.success).toBe(true);
  });
});