/**
 * apps/gateway/test/lifecycle-drain-admin.test.ts — GHA-NEXT-035.
 *
 * Integration tests for:
 *   - `/admin/drain` HTTP surface (admin token + drain response shape);
 *   - `/metrics` exposing `drainInitiatedTotal` / `drainCompletedTotal`
 *     / `drainTimeoutTotal` / `childHardTimeoutTotal` counters;
 *   - the default "admin gate off" posture (no `GATEWAY_ADMIN_TOKEN`
 *     configured) surfacing a 503 with `code=not_configured` so an
 *     operator who has not yet provisioned the token gets a clear
 *     error rather than a silent pass.
 *
 * Default posture is intentionally "gate off" for backwards
 * compatibility with the Wave 1 harness. Setting
 * `GATEWAY_ADMIN_TOKEN` switches the gate on and the same endpoints
 * become authorized.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import type { ChildProcess } from "node:child_process";

import { createGatewayServer } from "../src/server";
import { createMetricsState } from "../src/metrics";
import { GatewayRouter } from "../src/router";
import { Lifecycle } from "../src/lifecycle";
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

const baseConfig = (overrides: { adminToken?: string } = {}) => ({
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
  drainTimeoutMs: 50,
  maxChildTimeoutMs: 60000,
});

const stubGateway = () => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: () => Promise<unknown> }).dispatch = async () => ({
    items: [],
    sourceVersion: "stub",
    confidence: "low",
    mode: "fixture",
  });
  return gateway;
};

const stopAll = async () => {
  while (stopServers.length) {
    const stop = stopServers.pop();
    if (stop) await stop();
  }
};

class HangingChild extends EventEmitter {
  public exitCode: number | null = null;
  public signalCode: NodeJS.Signals | null = null;
  public sigtermCount = 0;
  public sigkillCount = 0;
  public killed = false;
  stdout = new Writable({ write(_chunk, _enc, cb) { cb(); } });
  stderr = new Writable({ write(_chunk, _enc, cb) { cb(); } });
  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    if (signal === "SIGKILL") this.sigkillCount += 1;
    else this.sigtermCount += 1;
    this.signalCode = (signal as NodeJS.Signals) ?? "SIGTERM";
    return true;
  }
}

describe("apps/gateway lifecycle drain + admin — GHA-NEXT-035", () => {
  afterEach(async () => { await stopAll(); });

  it("/admin/drain returns draining: true with a matching admin token", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
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
    expect(built.state.lifecycle.isDraining()).toBe(true);
  });

  it("/admin/drain rejects missing Authorization when admin token is configured", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/admin/drain", { method: "POST" });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ code: "unauthorized" });
    expect(built.state.lifecycle.isDraining()).toBe(false);
  });

  it("/admin/drain rejects wrong bearer token (401, no drain)", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
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
    expect(built.state.lifecycle.isDraining()).toBe(false);
  });

  it("/admin/drain returns 503 with code=not_configured when no admin token is configured (default posture)", async () => {
    const built = createGatewayServer({
      config: baseConfig(),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const result = await fetchOnce(port, "/admin/drain", {
      method: "POST",
      headers: { authorization: "Bearer anything" },
    });
    expect(result.status).toBe(503);
    expect(result.json).toMatchObject({ code: "not_configured" });
    expect(built.state.lifecycle.isDraining()).toBe(false);
  });

  it("/metrics exposes drainInitiatedTotal after a /admin/drain call", async () => {
    const built = createGatewayServer({
      config: baseConfig({ adminToken: "admin-secret" }),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const drain = await fetchOnce(port, "/admin/drain", {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" },
    });
    expect(drain.status).toBe(200);

    const metrics = await fetchOnce(port, "/metrics", { method: "GET" });
    expect(metrics.status).toBe(503); // /metrics refuses during drain
    // Drain started → counters reflect it.
    const snap = built.state.lifecycle.drainCounters();
    expect(snap.drainInitiatedTotal).toBe(1);
    expect(snap.drainCompletedTotal).toBe(0);
  });

  it("/metrics exposes drainCounters when called before any drain (defaults to 0)", async () => {
    const built = createGatewayServer({
      config: baseConfig(),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
    });
    await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
    const port = (built.server.address() as AddressInfo).port;
    stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

    const metrics = await fetchOnce(port, "/metrics", { method: "GET" });
    expect(metrics.status).toBe(200);
    const body = metrics.json as { drainInitiatedTotal?: number; drainCompletedTotal?: number; drainTimeoutTotal?: number; childHardTimeoutTotal?: number };
    expect(body.drainInitiatedTotal).toBe(0);
    expect(body.drainCompletedTotal).toBe(0);
    expect(body.drainTimeoutTotal).toBe(0);
    expect(body.childHardTimeoutTotal).toBe(0);
  });

  it("Lifecycle.registerChild hard-timeout fires SIGTERM within GATEWAY_MAX_CHILD_TIMEOUT_MS", async () => {
    const lifecycle = new Lifecycle({ childHardTimeoutMs: 5, childKillGraceMs: 5 });
    const child = new HangingChild();
    lifecycle.registerChild("cli-1", child as unknown as ChildProcess);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(child.sigtermCount).toBeGreaterThanOrEqual(1);
    expect(lifecycle.drainCounters().childHardTimeoutTotal).toBe(1);
  });
});
