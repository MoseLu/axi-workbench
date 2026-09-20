import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { createGatewayServer } from "../src/server";
import { createMetricsState } from "../src/metrics";
import { GatewayRouter } from "../src/router";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const createReadyServer = (overrides: { maxBodyBytes?: number; gateway?: GatewayOrchestrator } = {}) => {
  const baseGateway = overrides.gateway ?? new GatewayOrchestrator({ routes: [] });
  // Monkey-patch dispatch so the test does not depend on real routes.
  (baseGateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
    items: [],
    sourceVersion: "test:stub",
    confidence: "low",
    mode: "fixture",
  });
  const metrics = createMetricsState();
  const router = new GatewayRouter({ gateway: baseGateway, manifestVersion: 1, metrics });
  return createGatewayServer({
    config: {
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
      maxBodyBytes: overrides.maxBodyBytes ?? 4096,
      maxResultItems: 12,
      dispatchTimeoutMs: 1000,
      drainTimeoutMs: 100,
  maxChildTimeoutMs: 60000,
    },
    router,
    bridge: null,
    routeCount: 3,
    manifestVersion: 1,
    ready: true,
  });
};

describe("apps/gateway HTTP server", () => {
  let port = 0;
  let stop: (() => Promise<void>) | null = null;

  beforeEach(async () => {
    // Composition-root failure is the default; we explicitly opt out by
    // passing ready=true with a no-op gateway.
    const built = createGatewayServer({
      config: {
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
      },
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 0,
      ready: false,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    port = (built.server.address() as AddressInfo).port;
    stop = () => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve()));
    stopServers.push(stop);
  });

  afterEach(async () => {
    if (stop) await stop();
    stop = null;
  });

  it("answers /health/live with 200", async () => {
    const result = await fetchOnce(port, "/health/live");
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "ok" });
    expect(result.headers["x-request-id"]).toBeTruthy();
  });

  it("answers /health/ready with not_configured when composition root is missing", async () => {
    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("answers /gateway/run with not_configured when composition root is missing", async () => {
    const result = await fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planner: {} }),
    });
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("rejects malformed JSON with invalid_request", async () => {
    const readyState = createReadyServer();
    await new Promise<void>((resolve) => readyState.server.listen(0, "127.0.0.1", () => resolve()));
    const readyPort = (readyState.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => readyState.server.close((error) => error ? reject(error) : resolve())));

    const ready = await fetchOnce(readyPort, "/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.json).toMatchObject({ status: "ready", routeCount: 3, manifestVersion: 1 });

    const bad = await fetchOnce(readyPort, "/gateway/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(bad.status).toBe(400);
    expect(bad.json).toMatchObject({ code: "invalid_request" });
  });

  it("returns invalid_request when body exceeds maxBodyBytes", async () => {
    const readyState = createReadyServer({ maxBodyBytes: 8 });
    await new Promise<void>((resolve) => readyState.server.listen(0, "127.0.0.1", () => resolve()));
    const port2 = (readyState.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => readyState.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port2, "/gateway/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planner: { calls: [] } }).padEnd(64, " "),
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });
});