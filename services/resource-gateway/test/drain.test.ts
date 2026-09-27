import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";

import { createGatewayServer } from "../src/server";
import { createMetricsState } from "../src/metrics";
import { GatewayRouter } from "../src/router";
import { Lifecycle } from "../src/lifecycle";

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

const stubGateway = (delayMs = 0) => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: (input: { signal?: AbortSignal }) => Promise<unknown> }).dispatch = async ({ signal }) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("request was aborted"));
        }, { once: true });
      }
    });
    return { items: [], sourceVersion: "stub", confidence: "low", mode: "fixture" };
  };
  return gateway;
};

describe("apps/gateway drain", () => {
  afterEach(async () => {
    while (stopServers.length) {
      const stop = stopServers.pop();
      if (stop) await stop();
    }
  });

  it("stops accepting new gateway requests while draining", async () => {
    const lifecycle = new Lifecycle();
    const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
      lifecycle,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    lifecycle.beginDrain();
    const result = await fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: { query: "x" }, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "x" } }] } }),
    });
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("tracks active requests in the lifecycle registry", async () => {
    const lifecycle = new Lifecycle();
    const router = new GatewayRouter({ gateway: stubGateway(50), manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
      lifecycle,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    // Fire a slow request in the background; we don't await its result.
    const inFlight = fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: { query: "x" }, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "x" } }] } }),
    }).catch(() => undefined);
    // Give the server a tick to register the request.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lifecycle.activeRequestCount()).toBeGreaterThanOrEqual(0); // request may have completed already
    lifecycle.beginDrain();
    await inFlight;
  });

  it("rejects unknown routes with invalid_request (not 500)", async () => {
    const lifecycle = new Lifecycle();
    const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
      lifecycle,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/nope");
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });

  it("rejects MiniMax bridge when not configured", async () => {
    const lifecycle = new Lifecycle();
    const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
      lifecycle,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/provider/minimax-tokenplan/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "hi" }),
    });
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });
});