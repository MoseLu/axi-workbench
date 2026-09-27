/**
 * Tests for the narrow resource-search/v1 endpoint (POST /resource/search).
 *
 * These cover the cross-project contract surface: a separate Bearer gate,
 * the trimmed request shape, the fixed response projection, the
 * `blocked` filter, and the narrow error namespace. The internal planner
 * surface (`/gateway/run`) keeps its own test suite — this file does
 * not duplicate it.
 */
import { afterAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { createGatewayServer } from "../src/server";
import { createMetricsState } from "../src/metrics";
import { GatewayRouter } from "../src/router";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";
import {
  resourceSearchContractVersion,
  type AdapterSearchResult,
} from "@axi/gateway-contracts";

const stopServers: Array<() => Promise<void>> = [];

const fetchOnce = async (port: number, path: string, init?: RequestInit) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text, json };
};

const baseConfig = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const listen = async (built: ReturnType<typeof createGatewayServer>) => {
  await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
  const port = (built.server.address() as AddressInfo).port;
  const close = () => new Promise<void>((resolve, reject) =>
    built.server.close((error) => (error ? reject(error) : resolve())));
  stopServers.push(close);
  return { port, close };
};

const fixtureResult: AdapterSearchResult = {
  items: [
    {
      id: "fixture-image-sunlit",
      kind: "image",
      title: "暖光头像构图示例",
      preview: undefined,
      facts: { tags: "头像" },
      provenance: { provider: "fixture:image-preview", ref: "fixture://image/sunlit", version: "fixture-v1" },
      safety: "safe",
    },
    {
      id: "fixture-blocked-secret",
      kind: "document",
      title: "blocked secret note",
      preview: undefined,
      facts: {},
      provenance: { provider: "fixture:blocked", ref: "fixture://document/blocked", version: "fixture-v1" },
      safety: "blocked",
    },
  ],
  sourceVersion: "fixture-v1",
  confidence: "high",
  mode: "fixture",
};

const buildServer = (opts: {
  apiKeys?: ReadonlyArray<string>;
  ready?: boolean;
  routes?: ReadonlyArray<{ toolId: string }>;
  dispatch?: (input: unknown) => Promise<AdapterSearchResult>;
  readyState?: { ready: boolean };
}) => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: (input: unknown) => Promise<AdapterSearchResult> }).dispatch =
    opts.dispatch ?? (async () => fixtureResult);
  const metrics = createMetricsState();
  const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
  // Replace routeRegistry on the router instance via Object.defineProperty
  // so the HTTP server reads our stub routes when computing available
  // toolIds. Class methods live on the prototype; we set a configurable
  // own property so it takes precedence over the inherited one.
  Object.defineProperty(router, "routeRegistry", {
    value: () => [...(opts.routes ?? [{ toolId: "resource.search.image" }])],
    configurable: true,
    writable: true,
    enumerable: false,
  });
  return createGatewayServer({
    config: baseConfig({ apiKeys: opts.apiKeys ?? [] }) as never,
    router: opts.ready === false ? null : router,
    bridge: null,
    routeCount: opts.routes?.length ?? 1,
    manifestVersion: 1,
    ready: opts.ready ?? true,
  });
};

describe("apps/gateway POST /resource/search", () => {
  it("returns the narrow envelope with contractVersion=1", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req-1" },
      body: JSON.stringify({ query: "暖光头像" }),
    });
    if (result.status !== 200) {
      // eslint-disable-next-line no-console
      console.log("DEBUG envelope test:", { status: result.status, body: result.text });
    }
    expect(result.status).toBe(200);
    expect(result.headers["x-request-id"]).toBe("req-1");
    const json = result.json as { contractVersion: number; mode: string; state: string; items: Array<{ id: string; safety: string }>; requestId: string };
    expect(json.contractVersion).toBe(resourceSearchContractVersion);
    expect(json.mode).toBe("fixture");
    expect(json.state).toBe("presenting");
    expect(json.requestId).toBe("req-1");
    expect(json.items.map((item) => item.id)).toEqual(["fixture-image-sunlit"]);
    expect(json.items.every((item) => item.safety !== "blocked")).toBe(true);
  });

  it("projects blocked items internally but never ships them", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "anything" }),
    });
    expect(result.status).toBe(200);
    const json = result.json as { items: Array<{ id: string }> };
    expect(json.items.some((item) => item.id === "fixture-blocked-secret")).toBe(false);
  });

  it("rejects invalid JSON body with invalid_request envelope contractVersion=1", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(result.status).toBe(400);
    const json = result.json as { contractVersion: number; code: string };
    expect(json.contractVersion).toBe(resourceSearchContractVersion);
    expect(json.code).toBe("invalid_request");
  });

  it("rejects oversized payload with invalid_request", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "x".repeat(4096) }),
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });

  it("rejects unknown resource kinds with invalid_request", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "x", resourceKinds: ["secrets"] }),
    });
    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({ code: "invalid_request" });
  });

  it("requires Bearer when GATEWAY_API_KEYS is configured", async () => {
    const built = buildServer({ apiKeys: ["secret-key"] });
    const { port } = await listen(built);

    const noAuth = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "猫" }),
    });
    expect(noAuth.status).toBe(401);
    expect(noAuth.json).toMatchObject({ code: "unauthorized", contractVersion: 1 });

    const wrongAuth = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrong" },
      body: JSON.stringify({ query: "猫" }),
    });
    expect(wrongAuth.status).toBe(401);
    expect(wrongAuth.json).toMatchObject({ code: "unauthorized" });

    const okAuth = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret-key" },
      body: JSON.stringify({ query: "猫" }),
    });
    expect(okAuth.status).toBe(200);
    expect(okAuth.json).toMatchObject({ contractVersion: 1 });
  });

  it("returns 503 not_configured when composition root is not ready", async () => {
    const built = buildServer({ apiKeys: ["secret-key"], ready: false });
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret-key" },
      body: JSON.stringify({ query: "x" }),
    });
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
  });

  it("accepts the supplied x-request-id and echoes it back", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "client-uuid-42" },
      body: JSON.stringify({ query: "小猫" }),
    });
    expect(result.status).toBe(200);
    expect(result.headers["x-request-id"]).toBe("client-uuid-42");
    expect(result.json).toMatchObject({ requestId: "client-uuid-42" });
  });

  it("returns 404 unknown_tool when no route matches the requested kind", async () => {
    // Registry exposes an unrelated route so the routeTools set is
    // non-empty but does NOT contain the requested toolId.
    const built = buildServer({ routes: [{ toolId: "resource.search.skill" }] });
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "x", resourceKinds: ["document"] }),
    });
    expect(result.status).toBe(404);
    expect(result.json).toMatchObject({ code: "unknown_tool" });
  });

  it("maps unknown provider failures to provider_error envelope", async () => {
    const built = buildServer({
      dispatch: async () => { throw new Error("provider boom"); },
    });
    const { port } = await listen(built);
    const result = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "x", resourceKinds: ["image"] }),
    });
    expect(result.status).toBeGreaterThanOrEqual(500);
    expect(result.json).toMatchObject({ code: "provider_error", contractVersion: 1 });
  });

  // H-2 — opaque pagination cursor. The first page's nextCursor must
  // not leak the upstream requestId, must round-trip via the gateway's
  // decode() path, and must be rejected as `invalid_request` when the
  // client supplies a value that was never minted by this server.
  it("mints an opaque nextCursor that round-trips and rejects forgery", async () => {
    const built = buildServer({});
    const { port } = await listen(built);
    const requestId = "req-roundtrip-" + Date.now();
    const first = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({ query: "暖光头像", pageSize: 1 }),
    });
    expect(first.status).toBe(200);
    const firstJson = first.json as {
      requestId: string;
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    // Page is full (one item + pageSize=1) → a cursor must be minted.
    expect(firstJson.items).toHaveLength(1);
    expect(firstJson.nextCursor).toMatch(/^[A-Za-z0-9_-]{8,200}$/);
    // Cursor must not leak the upstream requestId.
    expect(firstJson.nextCursor).not.toContain(requestId);
    expect(firstJson.nextCursor).not.toBe(requestId);
    // Round-trip: passing the cursor back must be accepted (200), not
    // bounced as `invalid_request`.
    const second = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "暖光头像", pageSize: 1, cursor: firstJson.nextCursor }),
    });
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ contractVersion: 1 });
    // Forgery: a value the server never minted must be rejected as
    // `invalid_request`, not silently accepted.
    const forged = await fetchOnce(port, "/resource/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "暖光头像", pageSize: 1, cursor: "forged_never_minted_token_xx" }),
    });
    expect(forged.status).toBe(400);
    expect(forged.json).toMatchObject({ code: "invalid_request", contractVersion: 1 });
  });
});

afterAll(async () => {
  for (const stop of stopServers) {
    try { await stop(); } catch { /* ignore */ }
  }
  stopServers.length = 0;
});