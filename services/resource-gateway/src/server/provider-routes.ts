/**
 * Provider + admin routes:
 *   - `POST /provider/minimax-tokenplan/search`
 *   - `POST /provider/minimax-tokenplan/image`
 *   - `POST /admin/drain`            (GHA-NEXT-034)
 *   - `POST /admin/routes/reload`    (GHA-NEXT-036)
 *
 * Extracted verbatim from the original monolithic `server.ts`; the
 * inline dispatch bodies were lifted into functions with identical
 * bodies. The only non-move edit is the removal of a dead local
 * (`status`) in the MiniMax handler that was computed but never read
 * (pre-existing `TS6133`).
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { decideAdminAuthFromRequest } from "../admin-auth.js";
import { reloadRoutes as validateReloadRoutes } from "../composition.js";
import type { GatewayRouter } from "../router.js";
import { readBody, READY_DRAINING, READY_NOT_READY, sendError, sendJson, type ServerState } from "./context.js";

/** Shared handler used by both /provider/minimax-tokenplan/* routes. */
export const runMiniMaxHandler = async (
  state: ServerState,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  invoke: (body: unknown, signal: AbortSignal) => Promise<{ ok: boolean; status?: number; error?: string; data?: unknown }>,
): Promise<void> => {
  let raw: string;
  try {
    raw = await readBody(request, state.config.maxBodyBytes);
  } catch (error) {
    if (error instanceof Error && error.message === "request_body_too_large") {
      sendError(response, requestId, "invalid_request", "request body exceeds max body size", { maxBodyBytes: state.config.maxBodyBytes });
      return;
    }
    throw error;
  }

  let parsedJson: unknown;
  try {
    parsedJson = raw.length ? JSON.parse(raw) : {};
  } catch {
    sendError(response, requestId, "invalid_request", "request body is not valid JSON");
    return;
  }

  const abort = new AbortController();
  const endRequest = state.lifecycle.beginRequest(`${requestId}:minimax`, abort);
  request.once("close", () => { if (!response.writableEnded) abort.abort(); });

  try {
    const result = await invoke(parsedJson, abort.signal);
    if (result.ok && result.data !== undefined) {
      sendJson(response, 200, { ok: true, data: result.data }, { "x-request-id": requestId });
      return;
    }
    const errorMessage = result.error || "MiniMax bridge failed";
    if (/timeout/iu.test(errorMessage)) {
      sendError(response, requestId, "provider_timeout", errorMessage);
      return;
    }
    if (/abort/iu.test(errorMessage)) {
      sendError(response, requestId, "cancelled", errorMessage);
      return;
    }
    sendError(response, requestId, "provider_error", errorMessage);
  } finally {
    endRequest();
  }
};

/**
 * GHA-NEXT-034 — admin gate evaluation shared by the admin routes.
 * Returns true when the request may proceed; otherwise it has already
 * sent the typed error envelope. Default posture is "gate off" so the
 * Wave 1 harness keeps working; setting `GATEWAY_ADMIN_TOKEN`
 * activates the gate and rejects with 401 + unauthorized.
 */
const passAdminGate = (state: ServerState, request: IncomingMessage, response: ServerResponse, requestId: string): boolean => {
  const adminDecision = decideAdminAuthFromRequest({
    configuredToken: state.config.adminToken,
    request,
  });
  if (adminDecision.kind === "missing" || adminDecision.kind === "invalid") {
    sendError(response, requestId, "unauthorized", "admin token required");
    return false;
  }
  if (adminDecision.kind === "disabled") {
    // Gate off: refuse the request with a clear message so
    // operators know they need to set GATEWAY_ADMIN_TOKEN.
    sendError(response, requestId, "not_configured", "admin gate is disabled (GATEWAY_ADMIN_TOKEN unset)");
    return false;
  }
  return true;
};

/**
 * GHA-NEXT-034 — `POST /admin/drain`: flips the lifecycle into drain
 * mode so `/health/ready` reports `not_ready` and in-flight requests
 * are given `drainTimeoutMs` to finish.
 */
export const handleAdminDrainRequest = (state: ServerState, request: IncomingMessage, response: ServerResponse, requestId: string): void => {
  if (!passAdminGate(state, request, response, requestId)) return;
  state.lifecycle.beginDrain();
  sendJson(response, 200, { ok: true, requestId, draining: true }, { "x-request-id": requestId });
};

/**
 * GHA-NEXT-036 — atomic reload orchestrator. Validates the new
 * manifest via composition's `reloadRoutes()`, builds a fresh
 * `GatewayOrchestrator` on the same factory map + SharedStateManager,
 * and swaps the router reference in one synchronous step. On any
 * validation failure the router reference is untouched (atomic
 * publish contract).
 */
export const reloadRoutesAndSwap = async (params: {
  router: GatewayRouter;
  body: unknown;
  factories: Readonly<Record<string, import("@axi/resource-orchestrator").AdapterFactory>>;
  sharedState: import("@axi/resource-orchestrator").SharedStateManager;
  versionedCache: import("@axi/resource-orchestrator").VersionedCache;
  coalescing: import("@axi/resource-orchestrator").CoalescingRegistry;
  backpressure: import("@axi/resource-orchestrator").BackpressureRegistry;
  healthRegistry: import("@axi/resource-orchestrator").HealthRegistry | undefined;
}): Promise<
  | { readonly ok: true; readonly manifestVersion: number; readonly routeCount: number }
  | { readonly ok: false; readonly stage: "parse" | "semantic" | "capability"; readonly issues: string }
> => {
  const validated = await validateReloadRoutes({
    factories: params.factories,
    sharedState: params.sharedState,
    body: params.body,
  });
  if (!validated.ok) return validated;
  const orchestratorModule = await import("@axi/resource-orchestrator");
  const { GatewayOrchestrator, ProviderRegistry, parseManifest } = orchestratorModule;
  const newRegistry = new ProviderRegistry({ freezeOnBuild: false });
  for (const [id, factory] of Object.entries(params.factories)) {
    newRegistry.registerFactory(id, factory);
  }
  const parsed = parseManifest(params.body);
  newRegistry.buildFromManifest(parsed);
  const newOrchestrator = new GatewayOrchestrator({
    routes: newRegistry.listRoutes(),
    fallbackChains: parsed.fallbackChains ?? [],
    manifestVersion: parsed.manifestVersion,
    sharedState: params.sharedState,
    // GHA-NEXT-040 — preserve the in-process registries across
    // reload so manifest bumps do not lose cache, coalescing,
    // backpressure, and passive health state. The shared-state
    // stores (Valkey / Postgres) are likewise preserved.
    versionedCache: params.versionedCache,
    coalescing: params.coalescing,
    backpressure: params.backpressure,
    healthRegistry: params.healthRegistry,
  });
  params.router.replaceGateway(newOrchestrator);
  params.router.flushCache();
  return { ok: true, manifestVersion: parsed.manifestVersion, routeCount: newRegistry.listRoutes().length };
};

/**
 * GHA-NEXT-036 — `POST /admin/routes/reload`. Reads the body, validates
 * the new manifest, swaps the orchestrator reference, refreshes
 * `state.manifestVersion` + `state.routeCount` + `state.ready`, and
 * replies. Validation failures return 500 with
 * code=manifest_validation_failed; the running gateway is untouched in
 * that case (atomic publish contract).
 */
export const handleAdminRoutesReload = async (
  state: ServerState,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<void> => {
  if (!passAdminGate(state, request, response, requestId)) return;
  if (state.lifecycle.isDraining()) {
    sendError(response, requestId, "not_configured", READY_DRAINING);
    return;
  }
  if (!state.router) {
    sendError(response, requestId, "not_configured", READY_NOT_READY);
    return;
  }
  if (!state.reloadFactories || !state.sharedState) {
    sendError(response, requestId, "not_configured", "reload factories not wired (test mode)");
    return;
  }
  let raw: string;
  try {
    raw = await readBody(request, state.config.maxBodyBytes);
  } catch (error) {
    if (error instanceof Error && error.message === "request_body_too_large") {
      sendError(response, requestId, "invalid_request", "manifest body exceeds max body size", { maxBodyBytes: state.config.maxBodyBytes });
      return;
    }
    throw error;
  }
  let parsedJson: unknown;
  try {
    parsedJson = raw.length ? JSON.parse(raw) : {};
  } catch {
    sendError(response, requestId, "invalid_request", "manifest body is not valid JSON");
    return;
  }
  // Capture the OLD manifestVersion so we can detect whether
  // a successful reload actually moved the snapshot (otherwise
  // the response is meaningless for callers that compare).
  const previousManifestVersion = state.manifestVersion;
  const reloadResult = await reloadRoutesAndSwap({
    router: state.router,
    body: parsedJson,
    factories: state.reloadFactories,
    sharedState: state.sharedState,
    // GHA-NEXT-040 — preserve the in-process registries across
    // reload so manifest bumps do not lose cache, coalescing,
    // backpressure, and passive health state. These are read
    // from the router's underlying orchestrator.
    versionedCache: state.router.versionedCache!,
    coalescing: state.router.coalescing!,
    backpressure: state.router.backpressure!,
    healthRegistry: state.healthRegistry,
  });
  if (!reloadResult.ok) {
    // 500 + manifest_validation_failed — the running snapshot is preserved.
    // The full issues string lives in `details` so it does not
    // get truncated by the ErrorEnvelope.message 400-char cap.
    sendError(
      response,
      requestId,
      "internal",
      `manifest_validation_failed (${reloadResult.stage}): see details`,
      { stage: reloadResult.stage, issues: reloadResult.issues.slice(0, 8000) },
      { "x-request-id": requestId },
    );
    return;
  }
  // Atomic publish: replace state fields together with the swap.
  state.manifestVersion = reloadResult.manifestVersion;
  state.routeCount = reloadResult.routeCount;
  state.ready = true;
  state.lastReloadAt = new Date().toISOString();
  sendJson(response, 200, {
    ok: true,
    requestId,
    manifestVersion: reloadResult.manifestVersion,
    routeCount: reloadResult.routeCount,
    reloadedAt: state.lastReloadAt,
    previousManifestVersion,
  }, { "x-request-id": requestId });
};
