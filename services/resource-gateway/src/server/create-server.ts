/**
 * `createGatewayServer` — the pure Node `http` dispatcher. Owns the
 * per-request CORS + browser-shape gates and the route table, then
 * delegates to the focused handler modules.
 *
 * Extracted verbatim from the original monolithic `server.ts`; the
 * inline dispatch bodies were lifted into functions with identical
 * bodies. No behaviour changed.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { HealthRegistry } from "@axi/resource-orchestrator";

import { decideAuthFromRequest, errorCodeForAuth } from "../auth.js";
import type { ServerConfig } from "../config.js";
import { applyCors, decideBrowserShape, decideCors, isSameOriginOrServer, readOrigin } from "../cors.js";
import { Lifecycle } from "../lifecycle.js";
import { handleMemoryRequest, type MemoryHandlerContext } from "../memory/handlers.js";
import { createMetricsState, type MetricsState } from "../metrics.js";
import type { MiniMaxBridge } from "../minimax-bridge.js";
import { CursorRegistry } from "../pagination.js";
import type { GatewayRouter } from "../router.js";
import {
  PATH_ADMIN_DRAIN,
  PATH_ADMIN_ROUTES_RELOAD,
  PATH_DOCS,
  PATH_GATEWAY_RUN,
  PATH_HEALTH_LIVE,
  PATH_HEALTH_READY,
  PATH_METRICS,
  PATH_METRICS_PROMETHEUS,
  PATH_MINIMAX_IMAGE,
  PATH_MINIMAX_SEARCH,
  PATH_OPENAPI_JSON,
  PATH_RESOURCE_SEARCH,
  PATH_ROUTES,
} from "../routes.js";
import { handleSessionRequest, type SessionHandlerContext } from "../session/handlers.js";
import { newRequestRequestId, READY_DRAINING, sendError, type ServerState } from "./context.js";
import { handleGatewayRun } from "./gateway-run.js";
import {
  handleDocsHtml,
  handleHealthLive,
  handleHealthReady,
  handleMetrics,
  handleMetricsPrometheus,
  handleOpenApiJson,
  handleRoutes,
  resolveBaseUrl,
} from "./ops-routes.js";
import { handleAdminDrainRequest, handleAdminRoutesReload, runMiniMaxHandler } from "./provider-routes.js";
import { handleResourceSearch } from "./resource-search.js";

export const createGatewayServer = (initial: {
  config: ServerConfig;
  router: GatewayRouter | null;
  bridge: MiniMaxBridge | null;
  routeCount: number;
  manifestVersion: number;
  ready: boolean;
  lifecycle?: Lifecycle;
  metrics?: MetricsState;
  startedAt?: number;
  factoryNames?: ReadonlyArray<string>;
  allowlistedTargets?: Readonly<Record<string, string>>;
  sharedState?: import("@axi/resource-orchestrator").SharedStateManager | null;
  reloadFactories?: Readonly<Record<string, import("@axi/resource-orchestrator").AdapterFactory>>;
  healthRegistry?: HealthRegistry;
  memoryContext?: MemoryHandlerContext;
  sessionContext?: SessionHandlerContext;
  /** GHA-NEXT-046 — optional cursor registry. Production callers let
   *  this default to a fresh `CursorRegistry`; tests inject their own
   *  to drive TTL / RNG deterministically. */
  cursors?: CursorRegistry;
}) => {
  const state: ServerState = {
    ...initial,
    lifecycle: initial.lifecycle ?? new Lifecycle(),
    metrics: initial.metrics ?? createMetricsState(),
    startedAt: initial.startedAt ?? Date.now(),
    factoryNames: initial.factoryNames,
    allowlistedTargets: initial.allowlistedTargets,
    sharedState: initial.sharedState ?? null,
    reloadFactories: initial.reloadFactories,
    healthRegistry: initial.healthRegistry,
    memoryContext: initial.memoryContext,
    sessionContext: initial.sessionContext,
    cursors: initial.cursors ?? new CursorRegistry(),
  };

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestId = newRequestRequestId(request);
    response.setHeader("x-request-id", requestId);

    const origin = readOrigin(request);
    if (!isSameOriginOrServer(request)) {
      const decision = decideCors({
        allowlist: state.config.corsOrigins,
        requestOrigin: origin,
        requestMethod: request.method || "GET",
      });
      if (!decision.allowed) {
        sendError(response, requestId, "invalid_request", `cross-origin request rejected`);
        return;
      }
      applyCors(decision, response);
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }
    }

    // GHA-NEXT-030 — Browser-request shape gate. Same-origin bypass
    // (no Origin header) skips the gate entirely. Browser calls must
    // carry a Content-Type: application/json (for body-carrying
    // methods) and an x-request-id header.
    const shape = decideBrowserShape({ request, method: request.method || "GET" });
    if (shape.kind !== "ok") {
      const message =
        shape.kind === "missing-content-type" ? "Content-Type: application/json required for browser POST" :
        shape.kind === "bad-content-type" ? "Content-Type must be application/json" :
        shape.kind === "missing-request-id" ? "x-request-id header required for browser requests" :
        "cross-origin request rejected";
      sendError(response, requestId, "invalid_request", message);
      return;
    }

    const url = request.url || "/";
    const path = url.split("?", 1)[0];

    try {
      if (path === PATH_HEALTH_LIVE && request.method === "GET") {
        handleHealthLive(state, response, requestId);
        return;
      }

      if (path === PATH_HEALTH_READY && request.method === "GET") {
        handleHealthReady(state, response, requestId);
        return;
      }

      if (path === PATH_METRICS && request.method === "GET") {
        handleMetrics(state, response, requestId);
        return;
      }

      if (path === PATH_METRICS_PROMETHEUS && request.method === "GET") {
        handleMetricsPrometheus(state, response, requestId);
        return;
      }

      if (path === PATH_OPENAPI_JSON && request.method === "GET") {
        await handleOpenApiJson(response, requestId, resolveBaseUrl(state, request));
        return;
      }

      if (path === PATH_DOCS && request.method === "GET") {
        await handleDocsHtml(response, requestId, resolveBaseUrl(state, request));
        return;
      }

      if (path === PATH_ROUTES && request.method === "GET") {
        handleRoutes(state, response, requestId);
        return;
      }

      // resource-search/v1 — narrow cross-project contract. Same auth
      // posture as /gateway/run, but accepts the trimmed
      // `ResourceSearchRequest` instead of a planner output and
      // projects the dispatch outcome into a fixed
      // `ResourceSearchResponse`. The router's per-instance cache,
      // breaker, and metrics continue to apply — only the wire
      // format is narrower.
      if (path === PATH_RESOURCE_SEARCH && request.method === "POST") {
        await handleResourceSearch(state, request, response, requestId);
        return;
      }

      if (path === PATH_GATEWAY_RUN && request.method === "POST") {
        await handleGatewayRun(state, request, response, requestId);
        return;
      }

      if (path === PATH_MINIMAX_SEARCH && request.method === "POST") {
        if (state.lifecycle.isDraining()) {
          sendError(response, requestId, "not_configured", READY_DRAINING);
          return;
        }
        // GHA-NEXT-029 / GHA-NEXT-034 — MiniMax bridge endpoints
        // share the same Bearer API Key gate as /gateway/run. The
        // bridge is server-side, so without a key check the
        // upstream could be hit anonymously. Empty key set is
        // a noop (loopback) per the Wave 2 / GHA-NEXT-029 design.
        const apiKeyDecision = decideAuthFromRequest({ keys: state.config.apiKeys, request });
        if (apiKeyDecision.kind === "missing" || apiKeyDecision.kind === "invalid") {
          sendError(response, requestId, "unauthorized", "Missing or invalid API key");
          return;
        }
        if (!state.bridge) {
          sendError(response, requestId, "not_configured", "MiniMax bridge is not configured");
          return;
        }
        await runMiniMaxHandler(state, request, response, requestId, (body, signal) => state.bridge!.search(body, signal));
        return;
      }

      if (path === PATH_MINIMAX_IMAGE && request.method === "POST") {
        if (state.lifecycle.isDraining()) {
          sendError(response, requestId, "not_configured", READY_DRAINING);
          return;
        }
        // GHA-NEXT-029 / GHA-NEXT-034 — see PATH_MINIMAX_SEARCH
        // above; the same Bearer API Key gate applies to image.
        const apiKeyDecision = decideAuthFromRequest({ keys: state.config.apiKeys, request });
        if (apiKeyDecision.kind === "missing" || apiKeyDecision.kind === "invalid") {
          sendError(response, requestId, "unauthorized", "Missing or invalid API key");
          return;
        }
        if (!state.bridge) {
          sendError(response, requestId, "not_configured", "MiniMax bridge is not configured");
          return;
        }
        await runMiniMaxHandler(state, request, response, requestId, (body, signal) => state.bridge!.image(body, signal));
        return;
      }

      // GHA-NEXT-034 — /admin/* endpoints (gated by
      // GATEWAY_ADMIN_TOKEN). Default posture is "gate off" so the
      // Wave 1 harness keeps working; setting the env var
      // activates the gate and rejects with 401 + unauthorized.
      if (path === PATH_ADMIN_DRAIN && request.method === "POST") {
        handleAdminDrainRequest(state, request, response, requestId);
        return;
      }

      if (path === PATH_ADMIN_ROUTES_RELOAD && request.method === "POST") {
        await handleAdminRoutesReload(state, request, response, requestId);
        return;
      }

      // MEM-MVP-012 / MEM-MVP-013 — memory API surface. The handler
      // decides whether the (method, path) matches one of the ten
      // routes declared in `memory/handlers.ts`; when no context is
      // wired (test mode) the route simply 404s.
      if (state.sessionContext && (path === "/sessions" || path.startsWith("/sessions/"))) {
        const sessionAuth = decideAuthFromRequest({ keys: state.config.apiKeys, request });
        const sessionAuthCode = errorCodeForAuth(sessionAuth);
        if (sessionAuthCode) {
          sendError(response, requestId, sessionAuthCode, sessionAuth.kind === "missing" ? "Authorization bearer token required" : sessionAuth.kind === "expired" ? "bearer token has expired" : "invalid bearer token");
          return;
        }
        try {
          const handled = await handleSessionRequest(
            state.sessionContext,
            request.method || "GET",
            path,
            request,
            response,
            requestId,
          );
          if (handled) return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendError(response, requestId, "internal", message.slice(0, 400));
          return;
        }
      }

      if (state.memoryContext && (path === "/memory" || path.startsWith("/memory/"))) {
        // Enforce the same auth posture as `/gateway/run`: empty key
        // set is a no-op, otherwise mismatch / missing bearer → 401.
        const memoryAuth = decideAuthFromRequest({ keys: state.config.apiKeys, request });
        const memoryAuthCode = errorCodeForAuth(memoryAuth);
        if (memoryAuthCode) {
          sendError(response, requestId, memoryAuthCode, memoryAuth.kind === "missing" ? "Authorization bearer token required" : memoryAuth.kind === "expired" ? "bearer token has expired" : "invalid bearer token");
          return;
        }
        try {
          const handled = await handleMemoryRequest(
            state.memoryContext,
            request.method || "GET",
            path,
            request,
            response,
            requestId,
          );
          if (handled) return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendError(response, requestId, "internal", message.slice(0, 400));
          return;
        }
      }

      sendError(response, requestId, "invalid_request", `unknown route: ${request.method} ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendError(response, requestId, "internal", message.slice(0, 400));
    }
  };

  const server = createServer((request, response) => { void handle(request, response); });
  return { server, state };
};
