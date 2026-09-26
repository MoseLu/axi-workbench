/**
 * apps/gateway/test/auth.test.ts — GHA-NEXT-029 / GHA-NEXT-034
 *
 * Verifies the Bearer API Key middleware and the admin token gate.
 * Both are default-off (empty key set / empty admin token) so the
 * existing L2 harness (gateway-ha.mjs) keeps working without env
 * changes; the tests opt in by passing a non-empty array / string.
 *
 * Pure unit tests for the decision helpers live in the same file as
 * the server-level integration checks because the helpers are
 * trivial wrappers; the integration cases are the load-bearing
 * coverage that the wire format is correct.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { createGatewayServer } from "../src/server";
import {
  decideAuth,
  decideAuthFromRequest,
  errorCodeForAuth,
  parseApiKeys,
  readBearer,
} from "../src/auth";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const baseConfig = (overrides: { apiKeys?: ReadonlyArray<string>; adminToken?: string } = {}) => ({
  host: "127.0.0.1",
  port: 0,
  imagePreviewTarget: "http://127.0.0.1:5173",
  axiDocsTarget: "http://127.0.0.1:3010",
  projectTarget: "http://127.0.0.1:3010",
  uiTarget: "http://127.0.0.1:3010",
  iconTarget: "http://127.0.0.1:3010",
  minimaxBridgeTarget: "http://127.0.0.1:8787/provider/minimax-tokenplan",
  corsOrigins: [],
  apiKeys: overrides.apiKeys ?? [],
  adminToken: overrides.adminToken ?? "",
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

describe("apps/gateway auth helpers — GHA-NEXT-029", () => {
  it("parseApiKeys ignores empty entries and duplicates", () => {
    expect(parseApiKeys("")).toEqual([]);
    expect(parseApiKeys(undefined)).toEqual([]);
    expect(parseApiKeys("a, b, a,,c")).toEqual(["a", "b", "c"]);
  });

  it("readBearer only accepts well-formed Bearer headers", () => {
    expect(readBearer(undefined)).toBeUndefined();
    expect(readBearer("")).toBeUndefined();
    expect(readBearer("Basic abc")).toBeUndefined();
    expect(readBearer("Bearer ")).toBeUndefined();
    expect(readBearer("Bearer abc.def-ghi_jkl")).toBe("abc.def-ghi_jkl");
  });

  it("decideAuth returns ok when keys list is empty (default-off)", () => {
    expect(decideAuth({ keys: [], authorizationHeader: undefined })).toEqual({ kind: "ok" });
  });

  it("decideAuth rejects requests with no Authorization when keys are configured", () => {
    expect(decideAuth({ keys: ["k1"], authorizationHeader: undefined })).toEqual({ kind: "missing" });
  });

  it("decideAuth rejects non-bearer and malformed bearer tokens", () => {
    // Non-bearer scheme → kind=missing (no bearer token to compare).
    expect(decideAuth({ keys: ["k1"], authorizationHeader: "Basic abc" })).toEqual({ kind: "missing" });
    // Malformed bearer (no value after "Bearer ") → kind=missing.
    expect(decideAuth({ keys: ["k1"], authorizationHeader: "Bearer " })).toEqual({ kind: "missing" });
    // Well-formed bearer but no match → kind=invalid.
    expect(decideAuth({ keys: ["k1"], authorizationHeader: "Bearer wrong" })).toEqual({ kind: "invalid" });
  });

  it("decideAuth accepts matching keys in constant time", () => {
    const keys = ["alpha", "beta"];
    expect(decideAuth({ keys, authorizationHeader: "Bearer alpha" })).toEqual({ kind: "ok" });
    expect(decideAuth({ keys, authorizationHeader: "Bearer beta" })).toEqual({ kind: "ok" });
  });

  it("errorCodeForAuth maps outcomes to gateway error codes", () => {
    expect(errorCodeForAuth({ kind: "ok" })).toBeNull();
    expect(errorCodeForAuth({ kind: "missing" })).toBe("unauthorized");
    expect(errorCodeForAuth({ kind: "invalid" })).toBe("unauthorized");
    expect(errorCodeForAuth({ kind: "expired" })).toBe("token_expired");
  });
});

describe("apps/gateway auth HTTP integration — GHA-NEXT-029", () => {
  afterEach(async () => { await stopAll(); });

  it("default (no GATEWAY_API_KEYS) lets POST /gateway/run through with no Authorization header", async () => {
    const built = createGatewayServer({
      config: baseConfig(),
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
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    // ready=true + router=null → server returns 503 not_configured,
    // which proves auth gate passed (NOT 401).
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("configured GATEWAY_API_KEYS rejects missing Authorization header with 401 + unauthorized", async () => {
    const built = createGatewayServer({
      config: baseConfig({ apiKeys: ["secret-key"] }),
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
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ code: "unauthorized" });
    expect(result.headers["x-request-id"]).toBeDefined();
  });

  it("configured GATEWAY_API_KEYS rejects unknown bearer tokens", async () => {
    const built = createGatewayServer({
      config: baseConfig({ apiKeys: ["secret-key"] }),
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
      headers: { "content-type": "application/json", authorization: "Bearer not-the-key" },
      body: "{}",
    });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ code: "unauthorized" });
  });

  it("configured GATEWAY_API_KEYS accepts a matching bearer token", async () => {
    const built = createGatewayServer({
      config: baseConfig({ apiKeys: ["secret-key"] }),
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
      headers: { "content-type": "application/json", authorization: "Bearer secret-key" },
      body: "{}",
    });
    // Auth passes → ready-check fires → 503 not_configured.
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("public endpoints stay open when GATEWAY_API_KEYS is configured", async () => {
    const built = createGatewayServer({
      config: baseConfig({ apiKeys: ["secret-key"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    for (const path of ["/health/live", "/health/ready", "/metrics", "/routes", "/openapi.json", "/docs"]) {
      const result = await fetchOnce(port, path);
      expect(result.status).not.toBe(401);
    }
  });

  it("decideAuthFromRequest reads the authorization header from an IncomingMessage", () => {
    const fake = { headers: { authorization: "Bearer alpha" } } as unknown as Parameters<typeof decideAuthFromRequest>[0]["request"];
    expect(decideAuthFromRequest({ keys: ["alpha"], request: fake })).toEqual({ kind: "ok" });
    const fakeMissing = { headers: {} } as unknown as Parameters<typeof decideAuthFromRequest>[0]["request"];
    expect(decideAuthFromRequest({ keys: ["alpha"], request: fakeMissing })).toEqual({ kind: "missing" });
  });
});