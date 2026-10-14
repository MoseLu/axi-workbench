/**
 * apps/gateway HTTP entrypoint (GHA-010 / GHA-011 / GHA-014 / GHA-015 /
 * GHA-050 / GHA-051 / GHA-061 / GHA-064 / GHA-NEXT-037 / lane-mm-gateway-core).
 *
 * Pure Node `http` server, no framework dependency. Routes:
 *   GET  /health/live             → 200 if process is up
 *   GET  /health/ready            → 200 if composition root finished
 *   GET  /metrics                 → in-process metrics snapshot with
 *                                  real breaker snapshots from the
 *                                  orchestrator's `breakers` map.
 *   GET  /metrics/prometheus      → Prometheus text-format export
 *                                  (gateway_request_total,
 *                                   gateway_circuit_breaker_state,
 *                                   gateway_backpressure).
 *                                  GHA-NEXT-037.3.
 *   GET  /openapi.json            → contract-driven OpenAPI 3.1 document
 *   GET  /docs                    → human-readable same-origin HTML
 *   GET  /routes                  → safe route registry projection
 *                                  (ops endpoint, not in the
 *                                  versioned contract registry yet)
 *   POST /gateway/run             → dispatch a planner output
 *   POST /provider/minimax-tokenplan/search
 *   POST /provider/minimax-tokenplan/image
 *
 * Body size is bounded by `ServerConfig.maxBodyBytes`. Every response
 * carries `x-request-id`; errors use the stable `ErrorEnvelope` shape.
 *
 * Secrets handled here: `AXI_DOCS_TOKEN`, `MINIMAX_TOKENPLAN_CLI`,
 * `MINIMAX_MCP_BASE_PATH` are read in `config.ts` and never appear in
 * logs, error envelopes, or HTTP responses. The `/openapi.json` and
 * `/docs` endpoints are contract-driven and have no access to those
 * values.
 *
 * Module layout (split from the original monolithic `server.ts`):
 *   ./context.js          — ServerState + send/read/request-id primitives
 *   ./ops-routes.js       — health / metrics / routes / openapi / docs
 *   ./resource-search.js  — POST /resource-search (resource-search/v1)
 *   ./gateway-run.js      — POST /gateway/run (planner dispatch)
 *   ./provider-routes.js  — MiniMax bridge + admin drain/reload
 *   ./create-server.js    — request dispatcher (CORS gates + route table)
 *   ./index.js            — this file: `startGateway` + public re-exports
 */

import { createServer } from "node:http";

import type { GatewayOrchestrator } from "@axi/resource-orchestrator";

import { buildServerRegistry } from "../composition.js";
import { loadServerConfigAsync } from "../config.js";
import { Lifecycle } from "../lifecycle.js";
import { buildIdleQueue } from "../memory/idle-queue.js";
import type { MemoryHandlerContext } from "../memory/handlers.js";
import { buildMemorySettingsStore } from "../memory/settings-store.js";
import { resolveMemoryStoragePath } from "../memory/storage-path.js";
import { createMetricsState } from "../metrics.js";
import { MiniMaxBridge } from "../minimax-bridge.js";
import { GatewayRouter } from "../router.js";
import type { SessionHandlerContext } from "../session/handlers.js";
import { resolveSessionStoragePath } from "../session/storage-path.js";
import { createGatewayServer } from "./create-server.js";
import type { ServerState } from "./context.js";

export { createGatewayServer } from "./create-server.js";
export { newRequestId } from "./context.js";
export type { ServerState } from "./context.js";

/**
 * Start the gateway with full composition. Returns once the server is bound.
 *
 * Composition order:
 *   1. Load `ServerConfig` (delegates to `@axi/resource-config` when
 *      that package is wired into `apps/gateway/package.json`; falls
 *      back to the local parser otherwise).
 *   2. Build the orchestrator's `ProviderRegistry` via
 *      `buildServerRegistry(config)` — this is the SSRF allowlist
 *      boundary, every upstream URL must pass it.
 *   3. Construct `GatewayOrchestrator` with the registry's routes,
 *      fallback chains, and manifest version. The orchestrator owns
 *      the shared breakers, backpressure, coalescing, versioned
 *      cache, and fallback policy — the router only mirrors a
 *      narrowed subset for the HTTP edge.
 *   4. Wire `GatewayRouter`, lifecycle, metrics, and MiniMax bridge.
 *   5. Bind the Node `http` server. Signal handlers (SIGTERM/SIGINT)
 *      trigger the lifecycle drain.
 *
 * No secrets, env values, or upstream URLs are ever logged; the
 * startup log line uses `imageTarget` / `docsTarget` (URL, not token)
 * and a single boolean for the bridge presence.
 */
export const startGateway = async (overrides: { env?: NodeJS.ProcessEnv } = {}): Promise<{
  server: ReturnType<typeof createServer>;
  state: ServerState;
  stop: () => Promise<void>;
}> => {
  const config = overrides.env
    ? await loadServerConfigAsync({ env: overrides.env })
    : await loadServerConfigAsync();

  let gateway: GatewayOrchestrator | null = null;
  let routeCount = 0;
  let manifestVersion = 0;
  let ready = false;
  let bridge: MiniMaxBridge | null = null;
  // GHA-NEXT-042 — per-provider readiness projection. Captured from
  // the composition result so /health/ready can list the six adapter
  // factories (image / docs / project / ui / icon / minimax) with
  // their allowlisted target URL. Active probe status is the
  // responsibility of GHA-NEXT-016; today we just surface the ids.
  let factoryNames: ReadonlyArray<string> | undefined;
  let allowlistedTargets: Readonly<Record<string, string>> | undefined;
  // GHA-NEXT-025: hold the assembled SharedStateManager so the router
  // can read cross-instance breaker state. The variable is in the
  // outer scope so the /metrics wiring (GHA-NEXT-028) can access it
  // even when the composition root throws (in which case the router
  // is constructed null and metrics is never called).
  let sharedState: import("@axi/resource-orchestrator").SharedStateManager | null = null;
  let reloadFactories: Readonly<Record<string, import("@axi/resource-orchestrator").AdapterFactory>> | undefined;
  // GHA-NEXT-016 — the ActiveHealthRegistry constructed by the
  // composition root. Captured so /health/ready can project real
  // per-factory status (healthy / ejected / recovering) and so the
  // shutdown hook can call .stop() to clear the probe interval.
  let healthRegistry: import("@axi/resource-orchestrator").HealthRegistry | undefined;
  try {
    const composition = await buildServerRegistry(config);
    sharedState = composition.sharedState;
    reloadFactories = composition.factories;
    healthRegistry = composition.healthRegistry;
    gateway = new (await import("@axi/resource-orchestrator")).GatewayOrchestrator({
      routes: composition.registry.listRoutes(),
      fallbackChains: composition.fallbackChains,
      manifestVersion: composition.manifestVersion,
      sharedState: composition.sharedState,
    });
    routeCount = composition.routeCount;
    manifestVersion = composition.manifestVersion;
    factoryNames = composition.factoryNames;
    allowlistedTargets = composition.allowlistedTargets;
    ready = true;
    if (config.minimaxCli && config.minimaxOutputDir) {
      bridge = new MiniMaxBridge({
        cliPath: config.minimaxCli,
        outputDir: config.minimaxOutputDir,
        // GHA-NEXT-035 — absolute cap on any single child-process run.
        childTimeoutMs: config.maxChildTimeoutMs,
      });
    }
    console.log(
      `[gateway] ready manifestVersion=${manifestVersion} routeCount=${routeCount} ` +
      `imageTarget=${config.imagePreviewTarget} docsTarget=${config.axiDocsTarget} bridge=${bridge ? "minimax" : "off"}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[gateway] composition root failed: ${message}`);
  }

  const lifecycle = new Lifecycle({ childHardTimeoutMs: config.maxChildTimeoutMs });
  const metrics = createMetricsState();
  // GHA-NEXT-007 / GHA-NEXT-008 — Stage 1.5 Gate: cache + coalescing
  // single-track. Wire the orchestrator's VersionedCache and
  // CoalescingRegistry into the router as the SOLE owners of HTTP-edge
  // cache state and in-flight state. The router no longer keeps a
  // private `this.cache` Map or a `this.inFlight` Map; when either
  // orchestrator accessor is absent (legacy stubs / pre-composition),
  // the router degrades to a stateless pass-through (no cache, no
  // coalescing). Per-caller abort isolation stays in the router so
  // one cancelling caller does not cancel the shared work.
  const router = gateway ? new GatewayRouter({
    gateway,
    manifestVersion,
    metrics,
    sharedState: sharedState ?? undefined,
    versionedCache: gateway.versionedCache,
    coalescing: gateway.coalescing,
    // GHA-NEXT-040 — forward the per-instance backpressure so the
    // reload path can hand the same semaphore to a fresh router.
    backpressure: gateway.backpressure,
  }) : null;

  const built = createGatewayServer({ config, router, bridge, routeCount, manifestVersion, ready, lifecycle, metrics, factoryNames, allowlistedTargets, sharedState, reloadFactories, healthRegistry });

  // MEM-MVP-012 / MEM-MVP-013 — wire the local-first memory API.
  // We build the settings + entries stores against the server-resolved
  // path; the browser only ever sees the HTTP surface.
  const memoryStorePath = resolveMemoryStoragePath({ env: overrides.env });
  const memoryEntriesStore = new (await import("@axi/resource-memory")).JsonMemoryStore({ filePath: memoryStorePath });
  const memorySettingsStore = buildMemorySettingsStore({ filePath: memoryStorePath.replace(/memory-store\.json$/u, "memory-settings.json") });
  const memoryIdleQueue = buildIdleQueue();
  const loadMemorySettings = async () => {
    const settings = await memorySettingsStore.load();
    // The local gateway is the authority for the opaque project id. This
    // keeps project-scoped memory usable without exposing a filesystem path
    // or requiring the browser to invent a project registry.
    if (settings.defaultScope === "project" && !settings.defaultProjectId) {
      return { ...settings, defaultProjectId: "ai-resource-orchestration" };
    }
    return settings;
  };
  const saveMemorySettings = async (patch: Parameters<typeof memorySettingsStore.save>[0]) => {
    if (patch.defaultScope === "project" && !patch.defaultProjectId) {
      return memorySettingsStore.save({ ...patch, defaultProjectId: "ai-resource-orchestration" });
    }
    return memorySettingsStore.save(patch);
  };
  const memoryContext: MemoryHandlerContext = {
    store: memoryEntriesStore,
    maxBodyBytes: config.maxBodyBytes,
    loadSettings: loadMemorySettings,
    saveSettings: saveMemorySettings,
    registerProjectId: () => undefined,
    knownProjectIds: () => ["ai-resource-orchestration"],
    scheduleContribution: (sessionId, task) => {
      memoryIdleQueue.schedule(sessionId, task);
    },
  };
  built.state.memoryContext = memoryContext;
  const sessionStorePath = resolveSessionStoragePath({ env: overrides.env });
  const sessionStore = new (await import("@axi/resource-session")).JsonSessionStore({ filePath: sessionStorePath });
  const sessionContext: SessionHandlerContext = {
    store: sessionStore,
    maxBodyBytes: config.maxBodyBytes,
    knownProjectIds: () => ["ai-resource-orchestration"],
  };
  built.state.sessionContext = sessionContext;
  await new Promise<void>((resolve, reject) => {
    built.server.once("error", reject);
    built.server.listen(config.port, config.host, () => resolve());
  });
  console.log(`[gateway] listening http://${config.host}:${config.port}/`);

  // Install signal handlers — but only when running as the main entry
  // point, so tests that build the server don't see noise.
  const installSignals = () => {
    const onSignal = (signal: NodeJS.Signals) => {
      console.log(`[gateway] received ${signal}, draining`);
      void stop(signal);
    };
    process.once("SIGTERM", onSignal);
    process.once("SIGINT", onSignal);
  };
  installSignals();

  const stop = async (signal?: NodeJS.Signals): Promise<void> => {
    lifecycle.beginDrain();
    try {
      await lifecycle.waitForDrain(config.drainTimeoutMs);
    } catch {
      // waitForDrain never rejects; ignore.
    }
    // GHA-NEXT-016 — stop the active probe loop so the process can
    // exit cleanly during shutdown. The NoopHealthRegistry.stop()
    // is a no-op; ActiveHealthRegistry.stop() clears the timer.
    if (healthRegistry && typeof healthRegistry.stop === "function") {
      try {
        healthRegistry.stop();
      } catch {
        // best-effort; shutdown continues regardless.
      }
    }
    // GHA-NEXT-027 — release the Valkey / Postgres client backing
    // the shared-state manager. Without this, the Node.js event
    // loop stays alive on the open sockets and the process does
    // not exit cleanly. The NoopSharedStateManager.dispose() is a
    // no-op; the real manager closes the underlying pool.
    if (sharedState && typeof sharedState.dispose === "function") {
      try {
        await sharedState.dispose();
      } catch {
        // best-effort; shutdown continues regardless.
      }
    }
    memoryIdleQueue.dispose();
    await new Promise<void>((resolve, reject) => built.server.close((error) => {
      if (error) reject(error); else resolve();
    }));
    if (signal) console.log(`[gateway] drained on ${signal}`);
  };

  return { server: built.server, state: built.state, stop };
};

// Direct entrypoint when run via `pnpm start`.
if (import.meta.url === `file://${process.argv[1]}`) {
  void startGateway().catch((error) => {
    console.error("[gateway] failed to start", error);
    process.exit(1);
  });
}
