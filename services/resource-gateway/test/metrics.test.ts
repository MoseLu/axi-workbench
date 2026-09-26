import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";

import { createGatewayServer } from "../src/server";
import { createMetricsState, recordRequestEnd, recordRequestStart } from "../src/metrics";
import { GatewayRouter } from "../src/router";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const baseConfig = () => ({
  host: "127.0.0.1",
  port: 0,
  imagePreviewTarget: "http://127.0.0.1:5173",
  axiDocsTarget: "http://127.0.0.1:3010",
  projectTarget: "http://127.0.0.1:3010",
  uiTarget: "http://127.0.0.1:3010",
  iconTarget: "http://127.0.0.1:3010",
  minimaxBridgeTarget: "http://127.0.0.1:8787/provider/minimax-tokenplan",
  corsOrigins: [],
  apiKeys: [],
  adminToken: "",
  maxBodyBytes: 4096,
  maxResultItems: 12,
  dispatchTimeoutMs: 1000,
  drainTimeoutMs: 100,
  maxChildTimeoutMs: 60000,
});

describe("apps/gateway /metrics", () => {
  afterEach(async () => {
    while (stopServers.length) {
      const stop = stopServers.pop();
      if (stop) await stop();
    }
  });

  it("returns the metricsResponseSchema shape with per-route counters", async () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
      items: [], sourceVersion: "test", confidence: "low", mode: "fixture",
    });
    const metrics = createMetricsState();
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 5,
      manifestVersion: 1,
      ready: true,
      metrics,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    // Pre-populate counters so we can observe them.
    recordRequestStart(metrics, "resource.search.image");
    recordRequestEnd(metrics, "resource.search.image", { cacheHit: true, latencyMs: 12 });
    recordRequestStart(metrics, "resource.search.ui");
    recordRequestEnd(metrics, "resource.search.ui", { failureKind: "timeout", latencyMs: 40 });

    const result = await fetchOnce(port, "/metrics");
    expect(result.status).toBe(200);
    const body = result.json as { routes: Array<{ routeId: string; requestCount: number; cacheHitCount: number; failureCounts: Record<string, number> }>; breakers: unknown[]; manifestVersion: number; contractVersion: number; capturedAt: string };
    expect(body.manifestVersion).toBe(1);
    expect(body.contractVersion).toBe(1);
    expect(typeof body.capturedAt).toBe("string");
    expect(Array.isArray(body.routes)).toBe(true);
    expect(Array.isArray(body.breakers)).toBe(true);
    const image = body.routes.find((r) => r.routeId === "resource.search.image");
    expect(image).toMatchObject({ routeId: "resource.search.image", requestCount: 1, cacheHitCount: 1 });
    const ui = body.routes.find((r) => r.routeId === "resource.search.ui");
    expect(ui).toMatchObject({ routeId: "resource.search.ui", requestCount: 1 });
    expect(ui?.failureCounts).toMatchObject({ timeout: 1 });
  });

  it("does not leak any secret/path fields", async () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 5,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/metrics");
    // The token we never set would be a great canary; assert the response
    // body is JSON and does not contain token-like substrings.
    expect(result.status).toBe(200);
    expect(result.text).not.toMatch(/AXI_DOCS_TOKEN|Bearer|password|secret/iu);
  });

  it("returns 503 when composition is not ready", async () => {
    const built = createGatewayServer({
      config: baseConfig(),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 0,
      ready: false,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/metrics");
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });
});
describe("apps/gateway /metrics/prometheus", () => {
  afterEach(async () => {
    while (stopServers.length) {
      const stop = stopServers.pop();
      if (stop) await stop();
    }
  });

  it("exposes gateway_request_total + gateway_circuit_breaker_state + gateway_backpressure in Prometheus text format", async () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
      items: [], sourceVersion: "test", confidence: "low", mode: "fixture",
    });
    const metrics = createMetricsState();
    const router = new GatewayRouter({ gateway, manifestVersion: 4, metrics });
    recordRequestStart(metrics, "resource.search.image");
    recordRequestEnd(metrics, "resource.search.image", { cacheHit: true, latencyMs: 12 });
    recordRequestStart(metrics, "resource.search.image");
    recordRequestEnd(metrics, "resource.search.image", { failureKind: "queue_full", latencyMs: 40 });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 5,
      manifestVersion: 4,
      ready: true,
      metrics,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/metrics/prometheus");
    expect(result.status).toBe(200);
    // Content-Type must follow the Prometheus text exposition spec
    expect(result.headers["content-type"]).toMatch(/text\/plain.*version=0\.0\.4/);
    expect(result.text).toContain("# HELP gateway_request_total");
    expect(result.text).toContain("# TYPE gateway_request_total counter");
    expect(result.text).toContain("# HELP gateway_circuit_breaker_state");
    expect(result.text).toContain("# TYPE gateway_circuit_breaker_state gauge");
    expect(result.text).toContain("# HELP gateway_backpressure");
    expect(result.text).toContain("# TYPE gateway_backpressure counter");
    // Per-route counters surface
    expect(result.text).toMatch(/gateway_request_total\{route_id="resource\.search\.image",result="cache_hit"\} 1/);
    expect(result.text).toMatch(/gateway_request_total\{route_id="resource\.search\.image",result="failure",failure_kind="queue_full"\} 1/);
    // Backpressure event surfaces
    expect(result.text).toMatch(/gateway_backpressure\{route_id="resource\.search\.image",kind="queue_full"\} 1/);
    // Manifest version gauge
    expect(result.text).toMatch(/^gateway_manifest_version 4$/m);
    // No secret leak
    expect(result.text).not.toMatch(/AXI_DOCS_TOKEN|Bearer|password|secret/iu);
  });

  it("returns 200 even when composition is not ready (so scrape always succeeds)", async () => {
    const built = createGatewayServer({
      config: baseConfig(),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 0,
      ready: false,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/metrics/prometheus");
    expect(result.status).toBe(200);
    expect(result.text).toContain("# TYPE gateway_request_total counter");
    expect(result.text).toMatch(/^gateway_manifest_version 0$/m);
  });
});
