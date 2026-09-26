/**
 * apps/gateway/test/cors-validation.test.ts — GHA-NEXT-030
 *
 * Verifies the browser-request shape gate. The gate runs after the
 * CORS allowlist check (so curl / server-to-server calls with no
 * Origin bypass it entirely) and only enforces:
 *
 *   - Content-Type: application/json on body-carrying browser methods
 *   - x-request-id header on every browser request
 *
 * Backwards compatibility: server-to-server calls (no Origin header)
 * always pass. The existing L2 harness (gateway-ha.mjs) and the
 * dispatch-e2e tests use no Origin, so they keep working.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { createGatewayServer } from "../src/server";
import {
  decideBrowserShape,
  readContentType,
  readRequestIdHeader,
} from "../src/cors";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const baseConfig = (overrides: { corsOrigins?: ReadonlyArray<string> } = {}) => ({
  host: "127.0.0.1",
  port: 0,
  imagePreviewTarget: "http://127.0.0.1:5173",
  axiDocsTarget: "http://127.0.0.1:3010",
  projectTarget: "http://127.0.0.1:3010",
  uiTarget: "http://127.0.0.1:3010",
  iconTarget: "http://127.0.0.1:3010",
  minimaxBridgeTarget: "http://127.0.0.1:8787/provider/minimax-tokenplan",
  corsOrigins: overrides.corsOrigins ?? [],
  apiKeys: [],
  adminToken: "",
  maxBodyBytes: 4096,
  maxResultItems: 12,
  dispatchTimeoutMs: 1000,
  drainTimeoutMs: 100,
  maxChildTimeoutMs: 60000,
});

const stopAll = async () => {
  while (stopServers.length) {
    const stop = stopServers.pop();
    if (stop) await stop();
  }
};

describe("apps/gateway cors validation helpers — GHA-NEXT-030", () => {
  it("readContentType returns lower-cased media type without parameters", () => {
    const fake = { headers: { "content-type": "application/json; charset=utf-8" } } as unknown as Parameters<typeof readContentType>[0];
    expect(readContentType(fake)).toBe("application/json");
  });

  it("readContentType handles array header values (takes first)", () => {
    const fake = { headers: { "content-type": ["Application/JSON", "text/plain"] } } as unknown as Parameters<typeof readContentType>[0];
    expect(readContentType(fake)).toBe("application/json");
  });

  it("readRequestIdHeader tolerates missing header", () => {
    expect(readRequestIdHeader({ headers: {} } as unknown as Parameters<typeof readRequestIdHeader>[0])).toBeUndefined();
  });

  it("decideBrowserShape lets same-origin calls bypass (no Origin)", () => {
    const fake = { headers: {} } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fake, method: "POST" })).toEqual({ kind: "ok" });
  });

  it("decideBrowserShape requires application/json on browser POST", () => {
    const fakeNoCt = {
      headers: { origin: "https://workbench.local" },
    } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fakeNoCt, method: "POST" })).toEqual({ kind: "missing-content-type" });

    const fakeBadCt = {
      headers: { origin: "https://workbench.local", "content-type": "text/plain" },
    } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fakeBadCt, method: "POST" })).toEqual({ kind: "bad-content-type" });
  });

  it("decideBrowserShape requires x-request-id on browser GET / POST", () => {
    const fake = {
      headers: { origin: "https://workbench.local", "content-type": "application/json" },
    } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fake, method: "POST" })).toEqual({ kind: "missing-request-id" });

    const fakeGet = {
      headers: { origin: "https://workbench.local" },
    } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fakeGet, method: "GET" })).toEqual({ kind: "missing-request-id" });
  });

  it("decideBrowserShape accepts a well-formed browser POST", () => {
    const fake = {
      headers: {
        origin: "https://workbench.local",
        "content-type": "application/json",
        "x-request-id": "req-1",
      },
    } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fake, method: "POST" })).toEqual({ kind: "ok" });
  });

  it("decideBrowserShape accepts browser GET without content-type but with x-request-id", () => {
    const fake = {
      headers: { origin: "https://workbench.local", "x-request-id": "req-1" },
    } as unknown as Parameters<typeof decideBrowserShape>[0]["request"];
    expect(decideBrowserShape({ request: fake, method: "GET" })).toEqual({ kind: "ok" });
  });
});

describe("apps/gateway cors validation HTTP — GHA-NEXT-030", () => {
  afterEach(async () => { await stopAll(); });

  it("same-origin bypass: server-to-server POST without Origin works", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    // No Origin, no Content-Type, no x-request-id — bypass.
    const result = await fetchOnce(port, "/health/live");
    expect(result.status).toBe(200);
  });

  it("browser POST missing x-request-id returns 400 invalid_request", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: {
        origin: "https://workbench.local",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
    expect(String((result.json as { message?: string })?.message || "")).toMatch(/x-request-id/u);
  });

  it("browser POST missing Content-Type returns 400 invalid_request", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: {
        origin: "https://workbench.local",
        "x-request-id": "req-1",
      },
      body: "{}",
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });

  it("browser POST with bad Content-Type returns 400 invalid_request", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: {
        origin: "https://workbench.local",
        "content-type": "text/plain",
        "x-request-id": "req-1",
      },
      body: "{}",
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });

  it("browser POST with correct headers passes the gate (503 not_configured because no router)", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/gateway/run", {
      method: "POST",
      headers: {
        origin: "https://workbench.local",
        "content-type": "application/json",
        "x-request-id": "req-1",
      },
      body: "{}",
    });
    // Shape gate passed → ready-check fires → 503 not_configured.
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("never echoes an arbitrary Origin (security regression check)", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/live", {
      headers: { origin: "https://attacker.example", "x-request-id": "req-1" },
    });
    expect(result.status).toBe(400);
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
    expect(result.headers["access-control-allow-origin"]).not.toBe("https://attacker.example");
  });
});