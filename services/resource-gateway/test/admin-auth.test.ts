/**
 * apps/gateway/test/admin-auth.test.ts — GHA-NEXT-034
 *
 * Verifies the admin token gate for /admin/* endpoints. The token
 * is intentionally separate from the /gateway/run Bearer API Key:
 * an attacker who compromises a consumer key must not be able to
 * drain the gateway or hot-reload its routes.
 *
 * Default posture is "gate off" (no GATEWAY_ADMIN_TOKEN configured)
 * — the endpoints reject every request with 503 not_configured so
 * an operator who has not yet provisioned the token gets a clear
 * error rather than a silent pass.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { createGatewayServer } from "../src/server";
import {
  decideAdminAuth,
  decideAdminAuthFromRequest,
  readAdminBearer,
} from "../src/admin-auth";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const baseConfig = (overrides: { adminToken?: string; apiKeys?: ReadonlyArray<string> } = {}) => ({
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

describe("apps/gateway admin auth helpers — GHA-NEXT-034", () => {
  it("readAdminBearer only accepts well-formed Bearer headers", () => {
    expect(readAdminBearer(undefined)).toBeUndefined();
    expect(readAdminBearer("Basic abc")).toBeUndefined();
    expect(readAdminBearer("Bearer abc.def-ghi")).toBe("abc.def-ghi");
  });

  it("decideAdminAuth returns disabled when no token is configured", () => {
    expect(decideAdminAuth({ configuredToken: "", authorizationHeader: undefined })).toEqual({ kind: "disabled" });
  });

  it("decideAdminAuth rejects missing header when token is configured", () => {
    expect(decideAdminAuth({ configuredToken: "secret", authorizationHeader: undefined })).toEqual({ kind: "missing" });
  });

  it("decideAdminAuth rejects non-bearer scheme", () => {
    expect(decideAdminAuth({ configuredToken: "secret", authorizationHeader: "Basic abc" })).toEqual({ kind: "missing" });
  });

  it("decideAdminAuth rejects mismatched bearer token", () => {
    expect(decideAdminAuth({ configuredToken: "secret", authorizationHeader: "Bearer wrong" })).toEqual({ kind: "invalid" });
  });

  it("decideAdminAuth accepts matching bearer token", () => {
    expect(decideAdminAuth({ configuredToken: "secret", authorizationHeader: "Bearer secret" })).toEqual({ kind: "ok" });
  });

  it("decideAdminAuthFromRequest reads the header off an IncomingMessage", () => {
    const fakeOk = { headers: { authorization: "Bearer secret" } } as unknown as Parameters<typeof decideAdminAuthFromRequest>[0]["request"];
    expect(decideAdminAuthFromRequest({ configuredToken: "secret", request: fakeOk })).toEqual({ kind: "ok" });
    const fakeMissing = { headers: {} } as unknown as Parameters<typeof decideAdminAuthFromRequest>[0]["request"];
    expect(decideAdminAuthFromRequest({ configuredToken: "secret", request: fakeMissing })).toEqual({ kind: "missing" });
  });
});

describe("apps/gateway admin auth HTTP — GHA-NEXT-034", () => {
  afterEach(async () => { await stopAll(); });

  it("/admin/drain returns 503 when GATEWAY_ADMIN_TOKEN is unset (gate disabled)", async () => {
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

    const result = await fetchOnce(port, "/admin/drain", { method: "POST" });
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("/admin/drain returns 401 when GATEWAY_ADMIN_TOKEN is set but no Authorization header", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/admin/drain", { method: "POST" });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ code: "unauthorized" });
    expect(result.headers["x-request-id"]).toBeDefined();
  });

  it("/admin/drain returns 401 when bearer token is wrong", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/admin/drain", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ code: "unauthorized" });
  });

  it("/admin/drain accepts a matching admin token", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/admin/drain", {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" },
    });
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ ok: true, draining: true });
  });

  it("/admin/routes/reload is gated by the same admin token (regression check)", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const noToken = await fetchOnce(port, "/admin/routes/reload", { method: "POST" });
    expect(noToken.status).toBe(401);

    const ok = await fetchOnce(port, "/admin/routes/reload", {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" },
    });
    // GHA-NEXT-036: test mode (no router wired, no reloadFactories)
    // returns 503 not_configured so the existing admin-auth surface
    // check still passes. The full reload contract — including
    // success/manifest_validation_failed responses — is covered by
    // apps/gateway/test/route-reload.test.ts.
    expect(ok.status).toBe(503);
    expect(ok.json).toMatchObject({ code: "not_configured" });
  });

  it("admin gate does NOT accept the /gateway/run Bearer API Key", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret", apiKeys: ["consumer-key"] }),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    // Consumer key, not admin token → 401 unauthorized.
    const result = await fetchOnce(port, "/admin/drain", {
      method: "POST",
      headers: { authorization: "Bearer consumer-key" },
    });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ code: "unauthorized" });
  });
});