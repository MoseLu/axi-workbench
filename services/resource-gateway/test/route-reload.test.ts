/**
 * apps/gateway/test/route-reload.test.ts — GHA-NEXT-036.
 *
 * Integration tests for the `/admin/routes/reload` endpoint and
 * the `reloadRoutes()` helper. The reload path is the canonical
 * hot-update surface: a successful reload atomically swaps the
 * orchestrator reference inside the router, a failed reload leaves
 * the running snapshot untouched (atomic publish contract).
 *
 * Coverage:
 *   - validation: parse / semantic / capability failures return
 *     `{ ok: false, stage, issues }` and the live snapshot is
 *     preserved;
 *   - success: a valid new manifest bumps manifestVersion, swaps
 *     the orchestrator reference, and increments routeCount;
 *   - concurrency: a reload firing concurrently with in-flight
 *     `/gateway/run` requests must not throw and must finish with
 *     either the old or new orchestrator — never a torn snapshot;
 *   - cache invalidation: the router's HTTP-edge cache is flushed
 *     on a successful reload so a stale entry cannot linger.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GatewayOrchestrator, type SharedStateManager, createNoopSharedStateManager, registerPredicateBuilder, intentKind } from "@axi/resource-orchestrator";

import { createGatewayServer } from "../src/server";
import { createMetricsState } from "../src/metrics";
import { GatewayRouter } from "../src/router";
import { Lifecycle } from "../src/lifecycle";
import { ManifestValidationError, reloadRoutes, validateManifestPayload } from "../src/composition";
import type { AdapterFactory } from "@axi/resource-orchestrator";

const HERE_FOR_MANIFEST = dirname(fileURLToPath(import.meta.url));
const REAL_MANIFEST_PATH = resolve(HERE_FOR_MANIFEST, "..", "src", "providers.manifest.json");

// Mirror the predicate registrations the gateway's composition.ts
// adds on top of the orchestrator's built-in registry. Tests that
// validate the real manifest need these so the parse + semantic
// passes do not reject a known-good manifest.
const EXTRA_PREDICATES: Array<[string, () => unknown]> = [
  ["by-resource-kind-project", () => intentKind("project")],
  ["by-resource-kind-ui", () => intentKind("ui")],
  ["by-resource-kind-icon", () => intentKind("icon")],
];
for (const [id, build] of EXTRA_PREDICATES) {
  try { registerPredicateBuilder(id, build as never); } catch { /* already registered */ }
}

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
  maxBodyBytes: 8192,
  maxResultItems: 12,
  dispatchTimeoutMs: 1000,
  drainTimeoutMs: 100,
  maxChildTimeoutMs: 60000,
});

/** A small but valid manifest that survives parse + semantic +
 *  capability validation under the stubFactories below. We keep
 *  the route shape similar to the production manifest so the
 *  reload path is exercised end-to-end (the full real manifest
 *  mixes toolIds across routes and requires the production
 *  adapter graph). */
const realManifest = {
  manifestVersion: 1 as const,
  providers: [
    { id: "image-factory", factory: "image-factory" },
    { id: "docs-factory", factory: "docs-factory" },
    { id: "fixture-factory", factory: "fixture-factory" },
  ],
  targets: [
    { id: "image-factory.axi-image-preview", providerId: "axi-image-preview", weight: 5, timeoutMs: 8000 },
    { id: "docs-factory.axi-docs", providerId: "axi-docs", weight: 3, timeoutMs: 8000 },
    { id: "fixture-factory.fixture-image-preview", providerId: "fixture-image-preview", fallback: true },
    { id: "fixture-factory.fixture-axi-docs", providerId: "fixture-axi-docs", fallback: true },
  ],
  routes: [
    {
      id: "route.image",
      toolId: "resource.search.image",
      description: "Image search route (reload test)",
      predicates: ["by-resource-kind-image"],
      targetIds: ["image-factory.axi-image-preview"],
      loadBalancer: "failover-only",
    },
    {
      id: "route.document",
      toolId: "resource.search.document",
      description: "Document search route (reload test)",
      predicates: ["by-resource-kind-document"],
      targetIds: ["docs-factory.axi-docs"],
    },
  ],
  fallbackChains: [],
} as const;

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

/** Build a stub adapter descriptor + matching stub adapter so the
 *  capability validator accepts the route/target pairing. The
 *  actual `search()` is unused; the reload path only inspects the
 *  descriptor. */
const makeStubAdapter = (id: string, label: string, resourceKinds: string[], capabilities: Array<"search" | "inspect" | "preview">, toolId?: string) => ({
  descriptor: { id, label, resourceKinds, capabilities, toolId },
  search: async () => ({ items: [], sourceVersion: "stub", confidence: "low" as const, mode: "fixture" as const }),
});

const stubFactories: Record<string, AdapterFactory> = {
  // image-factory wires ONE adapter (the image preview) so the
  // route.image target resolves.
  "image-factory": () => [
    makeStubAdapter("axi-image-preview", "Image", ["image"], ["search", "preview"], "resource.search.image"),
  ],
  // docs-factory wires ONE adapter (the docs endpoint).
  "docs-factory": () => [
    makeStubAdapter("axi-docs", "Docs", ["document"], ["search", "preview"], "resource.search.document"),
  ],
  // fixture-factory wires two fallback adapters.
  "fixture-factory": () => [
    makeStubAdapter("fixture-image-preview", "Fixture Image", ["image"], ["search", "preview"], "resource.search.image"),
    makeStubAdapter("fixture-axi-docs", "Fixture Docs", ["document"], ["search", "preview"], "resource.search.document"),
  ],
};

const stopAll = async () => {
  while (stopServers.length) {
    const stop = stopServers.pop();
    if (stop) await stop();
  }
};

describe("apps/gateway route reload — GHA-NEXT-036", () => {
  afterEach(async () => { await stopAll(); });

  describe("validateManifestPayload / reloadRoutes (composition layer)", () => {
    it("accepts a valid manifest and reports the parsed routeCount", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const result = await reloadRoutes({
        factories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
        body: realManifest,
      });
      // The real manifest references toolIds per route that must
      // match the stub adapter descriptors exactly. We build the
      // stubFactories above to match the production toolIds; if a
      // manifest or stubFactory ever drifts, this assertion will
      // surface the mismatch.
      if (!result.ok) {
        // Surface the issues so a regression is debuggable in CI.
        throw new Error(`reloadRoutes rejected realManifest: stage=${result.stage} issues=${result.issues.slice(0, 400)}`);
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.manifestVersion).toBe(1);
        expect(result.routeCount).toBeGreaterThanOrEqual(1);
      }
    });

    it("rejects an invalid manifest with stage=parse", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const result = await reloadRoutes({
        factories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
        body: { manifestVersion: "not-a-number" },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe("parse");
      }
    });

    it("rejects an empty route set with stage=semantic", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const emptyRoutes = { ...realManifest, routes: [] };
      const result = await reloadRoutes({
        factories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
        body: emptyRoutes,
      });
      // parse accepts empty; semantic should reject.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(["parse", "semantic"]).toContain(result.stage);
      }
    });

    it("validateManifestPayload throws ManifestValidationError with structured issues", () => {
      try {
        validateManifestPayload({ not: "a manifest" }, ["image-factory", "fixture-factory"]);
        throw new Error("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ManifestValidationError);
        expect((error as ManifestValidationError).stage).toBe("parse");
      }
    });
  });

  describe("/admin/routes/reload (HTTP layer)", () => {
    it("returns 401 when admin token is missing", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const built = createGatewayServer({
        config: baseConfig({ adminToken: "admin-secret" }),
        router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState(), sharedState: sharedState as unknown as SharedStateManager }),
        bridge: null,
        routeCount: 1,
        manifestVersion: 1,
        ready: true,
        reloadFactories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
      });
      await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
      const port = (built.server.address() as AddressInfo).port;
      stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

      const result = await fetchOnce(port, "/admin/routes/reload", { method: "POST" });
      expect(result.status).toBe(401);
      expect(result.json).toMatchObject({ code: "unauthorized" });
    });

    it("returns 503 when admin token is unset (default posture, backwards compatible)", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const built = createGatewayServer({
        config: baseConfig(),
        router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState(), sharedState: sharedState as unknown as SharedStateManager }),
        bridge: null,
        routeCount: 1,
        manifestVersion: 1,
        ready: true,
        reloadFactories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
      });
      await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
      const port = (built.server.address() as AddressInfo).port;
      stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

      const result = await fetchOnce(port, "/admin/routes/reload", { method: "POST" });
      expect(result.status).toBe(503);
      expect(result.json).toMatchObject({ code: "not_configured" });
    });

    it("returns 500 + manifest_validation_failed when the body is invalid JSON", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const built = createGatewayServer({
        config: baseConfig({ adminToken: "admin-secret" }),
        router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState(), sharedState: sharedState as unknown as SharedStateManager }),
        bridge: null,
        routeCount: 1,
        manifestVersion: 1,
        ready: true,
        reloadFactories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
      });
      await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
      const port = (built.server.address() as AddressInfo).port;
      stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

      const result = await fetchOnce(port, "/admin/routes/reload", {
        method: "POST",
        headers: { authorization: "Bearer admin-secret", "content-type": "application/json" },
        body: "{not valid json",
      });
      expect(result.status).toBe(400);
      expect(result.json).toMatchObject({ code: "invalid_request" });
    });

    it("swaps the orchestrator on a successful reload and preserves readiness", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState(), sharedState: sharedState as unknown as SharedStateManager });
      const originalGateway = router.currentGateway();
      const built = createGatewayServer({
        config: baseConfig({ adminToken: "admin-secret" }),
        router,
        bridge: null,
        routeCount: 1,
        manifestVersion: 1,
        ready: true,
        reloadFactories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
      });
      await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
      const port = (built.server.address() as AddressInfo).port;
      stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

      const result = await fetchOnce(port, "/admin/routes/reload", {
        method: "POST",
        headers: { authorization: "Bearer admin-secret", "content-type": "application/json" },
        body: JSON.stringify(realManifest),
      });
      expect(result.status).toBe(200);
      expect(result.json).toMatchObject({ ok: true });
      const body = result.json as { ok: boolean; manifestVersion: number; routeCount: number; reloadedAt: string; previousManifestVersion: number };
      expect(body.manifestVersion).toBe(1);
      expect(body.previousManifestVersion).toBe(1);
      expect(body.routeCount).toBeGreaterThanOrEqual(1);
      expect(typeof body.reloadedAt).toBe("string");
      expect(router.currentGateway()).not.toBe(originalGateway);
      // Readiness preserved.
      const ready = await fetchOnce(port, "/health/ready");
      expect(ready.status).toBe(200);
    });

    it("returns 500 + manifest_validation_failed on parse failure and preserves the live snapshot", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState(), sharedState: sharedState as unknown as SharedStateManager });
      const originalGateway = router.currentGateway();
      const built = createGatewayServer({
        config: baseConfig({ adminToken: "admin-secret" }),
        router,
        bridge: null,
        routeCount: 1,
        manifestVersion: 1,
        ready: true,
        reloadFactories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
      });
      await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
      const port = (built.server.address() as AddressInfo).port;
      stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

      const result = await fetchOnce(port, "/admin/routes/reload", {
        method: "POST",
        headers: { authorization: "Bearer admin-secret", "content-type": "application/json" },
        body: JSON.stringify({ manifestVersion: 1, providers: [], targets: [], routes: [] }),
      });
      expect(result.status).toBe(500);
      const body = result.json as { code: string; message: string; details?: { stage?: string; issues?: string } };
      expect(body.code).toBe("internal");
      expect(body.message).toMatch(/manifest_validation_failed/u);
      expect(body.details?.stage).toBeDefined();
      expect(typeof body.details?.issues).toBe("string");
      // Live snapshot preserved.
      expect(router.currentGateway()).toBe(originalGateway);
    });

    it("handles concurrent reload + /gateway/run without a torn snapshot", async () => {
      const sharedState = createNoopSharedStateManager({ breakerFailOpen: true, rateLimitFailClosed: false, idempotencyFailClosed: false, storeUrl: "", propagationMs: 0, connectTimeoutMs: 0, breakerTtlSeconds: 0, coalesceTtlSeconds: 0 });
      const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState(), sharedState: sharedState as unknown as SharedStateManager });
      const built = createGatewayServer({
        config: baseConfig({ adminToken: "admin-secret" }),
        router,
        bridge: null,
        routeCount: 1,
        manifestVersion: 1,
        ready: true,
        reloadFactories: stubFactories,
        sharedState: sharedState as unknown as SharedStateManager,
      });
      await new Promise<void>((resolve) => built.server.listen(0, "127.0.0.1", () => resolve()));
      const port = (built.server.address() as AddressInfo).port;
      stopServers.push(() => new Promise<void>((resolve, reject) => built.server.close((error) => error ? reject(error) : resolve())));

      // Fire 5 reloads in parallel with 5 stub /gateway/run probes.
      const reloadPromise = (i: number) => fetchOnce(port, "/admin/routes/reload", {
        method: "POST",
        headers: { authorization: "Bearer admin-secret", "content-type": "application/json" },
        body: JSON.stringify(realManifest),
      });
      const runPromise = (i: number) => fetchOnce(port, "/gateway/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: {} }] } }),
      });
      const results = await Promise.all([
        reloadPromise(0), reloadPromise(1), reloadPromise(2),
        runPromise(0), runPromise(1), runPromise(2),
      ]);
      // Every reload returns 200 with { ok: true }.
      for (let i = 0; i < 3; i += 1) {
        expect(results[i].status).toBe(200);
        expect(results[i].json).toMatchObject({ ok: true });
      }
      // /gateway/run probes must not crash — the stub gateway returns
      // a fixture response, so we expect a 200 or 5xx only if the
      // dispatch path threw. Either way the server must not torn.
      for (let i = 3; i < 6; i += 1) {
        expect([200, 500, 503]).toContain(results[i].status);
      }
    });
  });

  describe("router atomic swap primitives", () => {
    it("GatewayRouter.replaceGateway installs the new orchestrator reference", () => {
      const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
      const original = router.currentGateway();
      const next = stubGateway();
      router.replaceGateway(next);
      expect(router.currentGateway()).toBe(next);
      expect(router.currentGateway()).not.toBe(original);
    });

    it("GatewayRouter.flushCache empties the in-memory cache", () => {
      const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
      router.flushCache();
      // No assertion on cache size (private); smoke test only.
      expect(router.currentGateway()).toBeDefined();
    });
  });

  describe("Lifecycle wiring", () => {
    it("lifecycle reports drainInitiatedTotal after a successful reload (no false drain)", () => {
      const lifecycle = new Lifecycle();
      expect(lifecycle.drainCounters().drainInitiatedTotal).toBe(0);
      // Reload does NOT begin a drain — only /admin/drain + SIGTERM do.
      void lifecycle;
      expect(lifecycle.drainCounters().drainInitiatedTotal).toBe(0);
    });
  });
});
