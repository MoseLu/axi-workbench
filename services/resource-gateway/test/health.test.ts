import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { GatewayOrchestrator, NoopHealthRegistry, ActiveHealthRegistry } from "@axi/resource-orchestrator";

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

const stubGateway = () => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
    items: [],
    sourceVersion: "test:stub",
    confidence: "low",
    mode: "fixture",
  });
  return gateway;
};

describe("apps/gateway /health/live", () => {
  let port = 0;
  let stop: (() => Promise<void>) | null = null;

  beforeEach(async () => {
    const built = createGatewayServer({
      config: baseConfig(),
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

  it("always returns 200 even when composition is not ready", async () => {
    const result = await fetchOnce(port, "/health/live");
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "ok" });
    expect(result.json).toMatchObject({ contractVersion: 1 });
    expect(typeof (result.json as { uptimeMs: number }).uptimeMs).toBe("number");
  });

  it("echoes x-request-id", async () => {
    const result = await fetchOnce(port, "/health/live", { headers: { "x-request-id": "test-req-1" } });
    expect(result.headers["x-request-id"]).toBe("test-req-1");
  });

  it("rejects non-GET methods", async () => {
    const result = await fetchOnce(port, "/health/live", { method: "POST" });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });
});

describe("apps/gateway /health/ready", () => {
  it("returns 503 with not_configured when composition is missing", async () => {
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

    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("returns 200 with routeCount + manifestVersion when ready", async () => {
    const gateway = stubGateway();
    const router = new GatewayRouter({ gateway, manifestVersion: 7, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 9,
      manifestVersion: 7,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "ready", routeCount: 9, manifestVersion: 7 });
    const components = (result.json as { components: Array<{ id: string; status: string }> }).components;
    expect(components.map((c) => c.id)).toEqual(["manifest", "registry", "bridge"]);
  });

  it("returns 503 when the lifecycle is draining", async () => {
    const gateway = stubGateway();
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const lifecycle = new Lifecycle();
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
    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });
});
describe("apps/gateway /health/ready per-provider components (GHA-NEXT-042)", () => {
  const localStoppers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (localStoppers.length) {
      const stop = localStoppers.pop();
      if (stop) await stop();
    }
  });

  it("emits one component per factory (image / docs / project / ui / icon / minimax / fixture) when factoryNames + allowlistedTargets are provided", async () => {
    const gateway = stubGateway();
    const router = new GatewayRouter({ gateway, manifestVersion: 5, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 12,
      manifestVersion: 5,
      ready: true,
      factoryNames: [
        "image-factory",
        "docs-factory",
        "project-factory",
        "ui-factory",
        "icon-factory",
        "minimax-factory",
        "fixture-factory",
      ],
      allowlistedTargets: {
        "image-factory": "http://127.0.0.1:5173",
        "docs-factory": "http://127.0.0.1:3010",
        "project-factory": "http://127.0.0.1:3010",
        "ui-factory": "http://127.0.0.1:3010",
        "icon-factory": "http://127.0.0.1:3010",
        "minimax-factory": "http://127.0.0.1:8787/provider/minimax-tokenplan",
        "fixture-factory": "(in-process)",
      },
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    localStoppers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(200);
    const components = (result.json as { components: Array<{ id: string; status: string; detail?: string; lastCheckedAt: string }> }).components;
    const ids = components.map((c) => c.id);
    // The six canonical provider ids + fixture, followed by the three legacy entries.
    expect(ids).toEqual([
      "image",
      "docs",
      "project",
      "ui",
      "icon",
      "minimax",
      "fixture",
      "manifest",
      "registry",
      "bridge",
    ]);
    // Per-provider components default to "starting" because no
    // HealthRegistry is wired into the test-mode server. GHA-NEXT-016
    // surfaces the live registry's status when one is wired (see the
    // HealthRegistry-wiring describe block below).
    const image = components.find((c) => c.id === "image");
    expect(image).toMatchObject({
      id: "image",
      status: "starting",
      detail: "http://127.0.0.1:5173",
    });
    expect(typeof image?.lastCheckedAt).toBe("string");
    const minimax = components.find((c) => c.id === "minimax");
    expect(minimax?.detail).toBe("http://127.0.0.1:8787/provider/minimax-tokenplan");
  });

  it("omits per-provider entries when factoryNames is not provided (test mode)", async () => {
    const gateway = stubGateway();
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 3,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    localStoppers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(200);
    const components = (result.json as { components: Array<{ id: string }> }).components;
    expect(components.map((c) => c.id)).toEqual(["manifest", "registry", "bridge"]);
  });
});

/**
 * GHA-NEXT-016 — active HealthRegistry drives the per-provider
 * component status. When the registry is wired into the server, the
 * per-provider entries reflect the registry's projection (healthy /
 * ejected / recovering / unhealthy / unknown → up / down / degraded /
 * starting) instead of the legacy "starting" placeholder.
 */
describe("apps/gateway /health/ready with HealthRegistry wiring (GHA-NEXT-016)", () => {
  const localStoppers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (localStoppers.length) {
      const stop = localStoppers.pop();
      if (stop) await stop();
    }
  });

  it("surfaces NoopHealthRegistry status (unknown → starting) when no active probe is wired", async () => {
    const gateway = stubGateway();
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const noopRegistry = new NoopHealthRegistry();
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 5,
      manifestVersion: 1,
      ready: true,
      factoryNames: ["image-factory", "docs-factory"],
      allowlistedTargets: {
        "image-factory": "http://127.0.0.1:5173",
        "docs-factory": "http://127.0.0.1:3010",
      },
      healthRegistry: noopRegistry,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    localStoppers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(200);
    const components = (result.json as { components: Array<{ id: string; status: string }> }).components;
    const image = components.find((c) => c.id === "image");
    const docs = components.find((c) => c.id === "docs");
    // NoopHealthRegistry always reports "unknown" → mapped to "starting".
    expect(image?.status).toBe("starting");
    expect(docs?.status).toBe("starting");
  });

  it("surfaces ActiveHealthRegistry status (healthy → up, ejected → down) over /health/ready", async () => {
    const gateway = stubGateway();
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const registry = new ActiveHealthRegistry({ noAutoStart: true });
    // Hand-build three factories in three different states by driving
    // the registry directly. The active probe loop is OFF — we are
    // asserting the projection, not the loop.
    registry.registerCheck("image-factory", { id: "image", run: async () => "healthy" });
    registry.registerCheck("docs-factory", { id: "docs", run: async () => "healthy" });
    registry.registerCheck("minimax-factory", { id: "minimax", run: async () => "healthy" });
    // Drive image-factory to healthy: 1 passive success flips unknown → healthy.
    registry.recordSuccess("image-factory");
    // Drive docs-factory through unhealthy to ejected.
    registry.recordFailure("docs-factory");
    registry.recordFailure("docs-factory");
    registry.recordFailure("docs-factory");
    // minimax-factory stays "unknown".

    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 5,
      manifestVersion: 1,
      ready: true,
      factoryNames: ["image-factory", "docs-factory", "minimax-factory"],
      allowlistedTargets: {
        "image-factory": "http://127.0.0.1:5173",
        "docs-factory": "http://127.0.0.1:3010",
        "minimax-factory": "http://127.0.0.1:8787/provider/minimax-tokenplan",
      },
      healthRegistry: registry,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    localStoppers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/ready");
    expect(result.status).toBe(200);
    const components = (result.json as { components: Array<{ id: string; status: string }> }).components;
    const image = components.find((c) => c.id === "image");
    const docs = components.find((c) => c.id === "docs");
    const minimax = components.find((c) => c.id === "minimax");
    // healthy → up
    expect(image?.status).toBe("up");
    // ejected → down
    expect(docs?.status).toBe("down");
    // unknown → starting
    expect(minimax?.status).toBe("starting");
    // The seven factoryIds round-trip the components ids from the
    // readiness response (mirror docs.logs/submit evidence).
    expect(components.map((c) => c.id)).toContain("image");
    expect(components.map((c) => c.id)).toContain("docs");
    expect(components.map((c) => c.id)).toContain("minimax");
    registry.stop();
  });
});
