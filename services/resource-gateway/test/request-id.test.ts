import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { createGatewayServer } from "../src/server";
import { newRequestId } from "../src/server";
import { decideCors, readOrigin } from "../src/cors";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const baseConfig = (overrides: Partial<ReturnType<typeof defaultConfig>> = {}) => {
  const base = defaultConfig();
  const next = { ...base, ...overrides };
  return { ...next, corsOrigins: (next.corsOrigins ?? base.corsOrigins) as ReadonlyArray<string> };
};

const defaultConfig = (): {
  host: string;
  port: number;
  imagePreviewTarget: string;
  axiDocsTarget: string;
  projectTarget: string;
  uiTarget: string;
  iconTarget: string;
  minimaxBridgeTarget: string;
  corsOrigins: ReadonlyArray<string>;
  apiKeys: ReadonlyArray<string>;
  adminToken: string;
  maxBodyBytes: number;
  maxResultItems: number;
  dispatchTimeoutMs: number;
  drainTimeoutMs: number;
  maxChildTimeoutMs: number;
} => ({
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

describe("apps/gateway request id propagation", () => {
  afterEach(async () => {
    while (stopServers.length) {
      const stop = stopServers.pop();
      if (stop) await stop();
    }
  });

  it("mints a request id when none is supplied", async () => {
    expect(newRequestId(undefined)).toMatch(/^gw-[a-z0-9]+-[a-z0-9]+$/u);
  });

  it("rejects malformed request ids", () => {
    expect(newRequestId("not ok / spaces")).toMatch(/^gw-/u);
    expect(newRequestId("a".repeat(120))).toMatch(/^gw-/u);
  });

  it("accepts a well-formed request id", () => {
    expect(newRequestId("abc-123")).toBe("abc-123");
  });

  it("echoes a client-supplied request id on /health/live", async () => {
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

    const result = await fetchOnce(port, "/health/live", { headers: { "x-request-id": "client-1" } });
    expect(result.headers["x-request-id"]).toBe("client-1");
  });

  it("echoes the request id on error envelopes", async () => {
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

    const result = await fetchOnce(port, "/health/ready", { headers: { "x-request-id": "client-2" } });
    expect(result.headers["x-request-id"]).toBe("client-2");
    expect(result.json).toMatchObject({ requestId: "client-2", code: "not_configured" });
  });
});

describe("apps/gateway CORS policy", () => {
  afterEach(async () => {
    while (stopServers.length) {
      const stop = stopServers.pop();
      if (stop) await stop();
    }
  });

  it("blocks cross-origin requests when allowlist is empty", () => {
    const decision = decideCors({ allowlist: [], requestOrigin: "https://attacker.example", requestMethod: "POST" });
    expect(decision.allowed).toBe(false);
  });

  it("blocks cross-origin requests that are not in the allowlist", () => {
    const decision = decideCors({ allowlist: ["https://workbench.local"], requestOrigin: "https://attacker.example", requestMethod: "POST" });
    expect(decision.allowed).toBe(false);
  });

  it("allows an exact match", () => {
    const decision = decideCors({ allowlist: ["https://workbench.local"], requestOrigin: "https://workbench.local", requestMethod: "POST" });
    expect(decision.allowed).toBe(true);
    expect(decision.origin).toBe("https://workbench.local");
  });

  it("does not emit CORS headers when no Origin header is present", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 0,
      ready: false,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/live");
    expect(result.status).toBe(200);
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects disallowed cross-origin requests at the HTTP edge", async () => {
    const built = createGatewayServer({
      config: baseConfig({ corsOrigins: ["https://workbench.local"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 0,
      ready: false,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/health/live", {
      headers: { origin: "https://attacker.example" },
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });

  it("readOrigin tolerates arrays", () => {
    const fake = { headers: { origin: ["https://a", "https://b"] } } as unknown as Parameters<typeof readOrigin>[0];
    expect(readOrigin(fake)).toBe("https://a");
  });
});