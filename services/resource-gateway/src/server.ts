import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";

import {
  errorEnvelopeSchema,
  gatewayContractVersion,
  gatewayRequestSchema,
  livenessResponseSchema,
  readinessResponseSchema,
  resourceSearchContractVersion,
  resourceSearchErrorCodeSchema,
  resourceSearchErrorEnvelopeSchema,
  resourceSearchItemSchema,
  resourceSearchRequestSchema,
  resourceSearchResponseSchema,
  type ResourceSearchErrorCode,
  type ResourceSearchRequest,
  type ResourceSearchResponse,
  routesResponseSchema,
  type ErrorEnvelope,
  type GatewayErrorCode,
  type GatewayRequest,
  type GatewayResponse,
  healthContractVersion,
  httpStatusForErrorCode,
  httpStatusForResourceSearchErrorCode,
  metricsResponseSchema,
  type ReadinessResponse,
} from "@axi/gateway-contracts";
import type { GatewayOrchestrator, HealthRegistry } from "@axi/resource-orchestrator";
import { HEALTH_STATUS_TO_COMPONENT, type HealthStatus } from "@axi/resource-orchestrator";
import { z } from "zod";

import { loadServerConfigAsync, type ServerConfig } from "./config.js";
import { buildServerRegistry, ManifestValidationError, reloadRoutes as validateReloadRoutes, validateManifestPayload } from "./composition.js";
import { applyCors, decideBrowserShape, decideCors, isSameOriginOrServer, readOrigin } from "./cors.js";
import { decideAuthFromRequest, errorCodeForAuth } from "./auth.js";
import { decideAdminAuthFromRequest } from "./admin-auth.js";
import { Lifecycle } from "./lifecycle.js";
import { MiniMaxBridge } from "./minimax-bridge.js";
import { runImageSearchCascade } from "./image-search-cascade.js";
import { buildMetricsResponse, createMetricsState, renderPrometheusText, type MetricsState } from "./metrics.js";
import { errorCodeFor, GatewayRouter } from "./router.js";
import { CursorRegistry } from "./pagination.js";
import {
  handleMemoryRequest,
  type MemoryHandlerContext,
} from "./memory/handlers.js";
import { resolveMemoryStoragePath } from "./memory/storage-path.js";
import {
  handleSessionRequest,
  type SessionHandlerContext,
} from "./session/handlers.js";
import { resolveSessionStoragePath } from "./session/storage-path.js";
import { buildMemorySettingsStore } from "./memory/settings-store.js";
import { buildIdleQueue } from "./memory/idle-queue.js";
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
} from "./routes.js";

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
 */

const READY_NOT_READY = "composition-root-not-ready" as const;
const READY_DRAINING = "server-is-draining" as const;

export interface ServerState {
  config: ServerConfig;
  router: GatewayRouter | null;
  bridge: MiniMaxBridge | null;
  routeCount: number;
  manifestVersion: number;
  ready: boolean;
  lifecycle: Lifecycle;
  metrics: MetricsState;
  /** Server start timestamp (ms since epoch). */
  startedAt: number;
  /**
   * GHA-NEXT-042 — ordered list of factory ids registered with the
   * composition root. Used by `/health/ready` to emit a per-provider
   * component entry. When undefined the gateway is in test mode and
   * the per-provider section is omitted.
   */
  factoryNames?: ReadonlyArray<string>;
  /**
   * GHA-NEXT-042 — allowlisted upstream targets keyed by factory id
   * (no secrets, URLs only). Surfaced as `detail` on each per-provider
   * component so operators can grep readiness output.
   */
  allowlistedTargets?: Readonly<Record<string, string>>;
  /** GHA-NEXT-036 — factory map captured from the composition root
   *  so `POST /admin/routes/reload` can rebuild the registry on the
   *  same factory set (preserves adapter memoization). Optional —
   *  reload rejects with 503 when the gateway is in test mode and
   *  no factory map was supplied. */
  reloadFactories?: Readonly<Record<string, import("@axi/resource-orchestrator").AdapterFactory>>;
  /** GHA-NEXT-036 — wall-clock ISO timestamp of the last successful
   *  `POST /admin/routes/reload`. Undefined when no reload has run
   *  yet. Surfaced in the reload response and on `/health/ready`
   *  diagnostic projections. */
  lastReloadAt?: string;
  /** GHA-NEXT-036 — SharedStateManager from the composition root,
   *  used by reload to thread the same store into the rebuilt
   *  orchestrator. Null when the gateway is in test mode. */
  sharedState: import("@axi/resource-orchestrator").SharedStateManager | null;
  /**
   * GHA-NEXT-016 — Active HealthRegistry with probe + ejection +
   * recovery. The composition root wires an `ActiveHealthRegistry`
   * over the allowlisted factory endpoints; `/health/ready` reads
   * `forFactory()` to surface `healthy | ejected | recovering | ...
   * per provider. Optional for backward compatibility (test mode
   * without composition).
   */
  healthRegistry?: HealthRegistry;
  /** MEM-MVP-012 / MEM-MVP-013 — memory HTTP handler context.
   *  When wired, every `/memory/*` route becomes available. Tests
   *  can omit this to keep memory endpoints disabled. */
  memoryContext?: MemoryHandlerContext;
  /** SES-MVP-009 — session HTTP handler context. Tests can omit this
   *  to keep `/sessions*` disabled. */
  sessionContext?: SessionHandlerContext;
  /**
   * GHA-NEXT-046 — opaque cursor registry for resource-search/v1
   * pagination. Tokens minted by `encode()` are stored here and
   * resolved on the next request via `decode()`. Tests may inject
   * their own registry to drive TTL / RNG behaviour deterministically.
   */
  cursors: CursorRegistry;
}

const sendJson = (response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(JSON.stringify(payload));
};

const sendHtml = (response: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) => {
  response.statusCode = status;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(body);
};

const sendError = (
  response: ServerResponse,
  requestId: string,
  code: GatewayErrorCode,
  message: string,
  details?: ErrorEnvelope["details"],
  extraHeaders: Record<string, string> = {},
) => {
  const envelope: ErrorEnvelope = errorEnvelopeSchema.parse({
    contractVersion: gatewayContractVersion,
    requestId,
    code,
    message,
    details,
  });
  sendJson(response, httpStatusForErrorCode(code), envelope, { "x-request-id": requestId, ...extraHeaders });
};

/**
 * Map any string from the wide gateway error namespace onto the narrow
 * `ResourceSearchErrorCode`. Session-only codes collapse to
 * `provider_error` because the narrow endpoint does not own a session
 * concept. `internal` is folded into `provider_error` because the
 * narrow contract only exposes `provider_error` for upstream-side
 * failures — `internal` is the catch-all bucket the wide contract
 * uses and would leak implementation detail if surfaced verbatim.
 */
const mapToNarrowErrorCode = (code: string | null | undefined): ResourceSearchErrorCode => {
  if (typeof code !== "string") return "provider_error";
  if (code === "internal") return "provider_error";
  const parsed = resourceSearchErrorCodeSchema.safeParse(code);
  if (parsed.success) return parsed.data;
  return "provider_error";
};

/**
 * Resource-search/v1 error sender. Mirrors `sendError` but stays on the
 * narrow contract's error namespace and HTTP status mapping so cross-
 * project callers can rely on a single vocabulary.
 */
const sendResourceSearchError = (
  response: ServerResponse,
  requestId: string,
  code: ResourceSearchErrorCode,
  message: string,
  details?: Record<string, string | number | boolean>,
  extraHeaders: Record<string, string> = {},
) => {
  const parsed = resourceSearchErrorCodeSchema.parse(code);
  const envelope = resourceSearchErrorEnvelopeSchema.parse({
    contractVersion: resourceSearchContractVersion,
    requestId,
    code: parsed,
    message,
    details,
  });
  sendJson(response, httpStatusForResourceSearchErrorCode(parsed), envelope, { "x-request-id": requestId, ...extraHeaders });
};

const readBody = (request: IncomingMessage, maxBytes: number): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  request.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > maxBytes) {
      truncated = true;
      // Drain the rest so the socket isn't left half-read.
      request.resume();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    if (truncated) {
      reject(new Error("request_body_too_large"));
      return;
    }
    resolve(Buffer.concat(chunks).toString("utf8"));
  });
  request.on("error", reject);
});

const newRequestId = (provided: string | undefined): string => {
  if (typeof provided === "string" && /^[a-zA-Z0-9_-]{1,80}$/u.test(provided)) return provided;
  return `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const newRequestRequestId = (request: IncomingMessage): string => {
  const headerValue = request.headers["x-request-id"];
  return newRequestId(typeof headerValue === "string" ? headerValue : undefined);
};

/** Minimal planner output validator (GHA-003 boundary). */
const plannerOutputSchema = z.object({
  intent: z.object({
    operation: z.enum(["search", "inspect", "preview"]),
    resourceKinds: z.array(z.string().min(1).max(80)).max(8).default([]),
    constraints: z.record(z.unknown()),
    needsClarification: z.boolean(),
    clarificationReason: z.string().max(400).optional(),
  }),
  calls: z.array(z.object({ toolId: z.string().min(1).max(120), input: z.record(z.unknown()) })).max(3),
  pipeline: z.array(z.object({ toolId: z.string().min(1).max(120), input: z.record(z.unknown()) })).max(6).optional(),
  explanation: z.string().max(800).optional(),
  clarification: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.string().min(1),
  })).max(6).optional(),
});

/** The shape we accept for a single step inside `calls`/`pipeline`. */
const stepToolIdSchema = z.string().min(1).max(120);
const stepInputSchema = z.record(z.unknown());

/**
 * Resolve the docs/api-docs module dynamically. The package is
 * imported through `await import()` because `apps/gateway/package.json`
 * does not yet declare it as a dependency — parent integration is
 * expected to add it (see Blockers in the lane report). When the
 * package is missing or fails to resolve, the docs endpoints return
 * the typed 500 envelope with a stable error code rather than serving
 * a half-baked document.
 */
type ApiDocsModule = {
  generateOpenApiDocument: (options?: { servers?: ReadonlyArray<{ url: string }> }) => unknown;
  validateOpenApiDocument: (document: unknown) => { ok: true } | { ok: false; issues: ReadonlyArray<{ path: string; message: string }> };
  renderDocsHtml: (document: unknown, options?: { openApiUrl?: string; baseUrl?: string }) => string;
};

let cachedApiDocs: ApiDocsModule | null = null;
let apiDocsLoadAttempted = false;
let apiDocsLoadWarned = false;

const warnOnceApiDocs = (message: string): void => {
  if (apiDocsLoadWarned) return;
  apiDocsLoadWarned = true;
  console.warn(`[gateway/docs] ${message}`);
};

const loadApiDocs = async (): Promise<ApiDocsModule | null> => {
  if (cachedApiDocs) return cachedApiDocs;
  if (!apiDocsLoadAttempted) {
    apiDocsLoadAttempted = true;
    try {
      const mod = (await import("@axi/resource-api-docs")) as Partial<ApiDocsModule>;
      if (mod && typeof mod.generateOpenApiDocument === "function" && typeof mod.validateOpenApiDocument === "function" && typeof mod.renderDocsHtml === "function") {
        cachedApiDocs = mod as ApiDocsModule;
      } else {
        warnOnceApiDocs("@axi/resource-api-docs resolved but missing required exports; /openapi.json and /docs will return 500 until the package is wired correctly.");
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ERR_MODULE_NOT_FOUND" || code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
        warnOnceApiDocs("@axi/resource-api-docs not wired into apps/gateway/package.json; /openapi.json and /docs will return 500 until the parent wires the dep.");
      } else {
        warnOnceApiDocs(`@axi/resource-api-docs failed to load (${code ?? "unknown"}): ${(error as Error).message}; /openapi.json and /docs will return 500.`);
      }
    }
  }
  return cachedApiDocs;
};

const handleOpenApiJson = async (response: ServerResponse, requestId: string, baseUrl: string): Promise<void> => {
  const apiDocs = await loadApiDocs();
  if (!apiDocs) {
    sendError(response, requestId, "internal", "openapi_unavailable");
    return;
  }
  let document: unknown;
  try {
    document = apiDocs.generateOpenApiDocument({
      servers: [{ url: baseUrl }],
    });
  } catch (error) {
    sendError(response, requestId, "internal", `openapi_generation_failed: ${(error as Error).message}`);
    return;
  }
  const validation = apiDocs.validateOpenApiDocument(document);
  if (!validation.ok) {
    const issue = validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
    sendError(response, requestId, "internal", `openapi_validation_failed: ${issue}`);
    return;
  }
  sendJson(response, 200, document, {
    "x-request-id": requestId,
    "x-openapi-contract-version": "1",
  });
};

const handleDocsHtml = async (response: ServerResponse, requestId: string, baseUrl: string): Promise<void> => {
  const apiDocs = await loadApiDocs();
  if (!apiDocs) {
    sendError(response, requestId, "internal", "docs_unavailable");
    return;
  }
  let document: unknown;
  try {
    document = apiDocs.generateOpenApiDocument({
      servers: [{ url: baseUrl }],
    });
  } catch (error) {
    sendError(response, requestId, "internal", `openapi_generation_failed: ${(error as Error).message}`);
    return;
  }
  let html: string;
  try {
    html = apiDocs.renderDocsHtml(document, {
      openApiUrl: PATH_OPENAPI_JSON,
      baseUrl,
    });
  } catch (error) {
    sendError(response, requestId, "internal", `docs_render_failed: ${(error as Error).message}`);
    return;
  }
  sendHtml(response, 200, html, {
    "x-request-id": requestId,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
};

const handleRoutes = (state: ServerState, response: ServerResponse, requestId: string): void => {
  if (state.lifecycle.isDraining()) {
    sendError(response, requestId, "not_configured", READY_DRAINING);
    return;
  }
  if (!state.ready || !state.router) {
    sendError(response, requestId, "not_configured", READY_NOT_READY);
    return;
  }
  const entries = state.router.routeRegistry();
  // Project to a strict, redacted shape. No adapter references,
  // URLs, secrets, query text, or provider payloads.
  // GHA-NEXT-002 fix: capabilities are derived from toolId patterns
  // (never empty for a matched pattern) and manifest predicate ids
  // are included as string ids only. The final payload is validated
  // against `routesResponseSchema` so the contract's `capabilities`
  // min(1) invariant is enforced at the HTTP boundary — a defensive
  // guarantee against future toolId pattern drift silently producing
  // empty arrays.
  const projected = {
    manifestVersion: state.manifestVersion,
    capturedAt: new Date().toISOString(),
    routes: entries.map((entry) => ({
      id: entry.id,
      toolId: entry.toolId,
      description: entry.description,
      targetIds: [...entry.targetIds],
      loadBalancer: entry.loadBalancer,
      capabilities: [...entry.capabilities],
      predicates: [...entry.predicates],
    })),
  };
  const body = routesResponseSchema.parse(projected);
  sendJson(response, 200, body, { "x-request-id": requestId });
};

/**
 * GHA-NEXT-042 + GHA-NEXT-016 — Project per-provider readiness
 * components from the composition root's `factoryNames` +
 * `allowlistedTargets`. The list mirrors `composition.ts` factories
 * in insertion order: image, docs, project, ui, icon, minimax (plus
 * fixture for tests). For each factory we emit:
 *
 *   - `id`           — the factory id (e.g. `image-factory`)
 *   - `status`       — read from the active `HealthRegistry` and
 *                      mapped through `HEALTH_STATUS_TO_COMPONENT`
 *                      so the contract enum (`up | down | degraded |
 *                      starting`) is honoured.
 *   - `detail`       — the allowlisted upstream URL keyed by factory
 *   - `lastCheckedAt`— ISO timestamp captured at projection time,
 *                      sourced from the registry snapshot when
 *                      available (probe time) or "now" as fallback
 *
 * When `state.healthRegistry` is missing the function degrades to the
 * legacy `"starting"` placeholder so test-mode servers (which never
 * wire the composition root) keep emitting the legacy triple.
 */
const PER_PROVIDER_BASE_IDS = ["image", "docs", "project", "ui", "icon", "minimax"] as const;

const buildPerProviderReadinessComponents = (state: ServerState): ReadinessResponse["components"] => {
  if (!state.factoryNames || state.factoryNames.length === 0) {
    return [];
  }
  const allowed = state.allowlistedTargets ?? {};
  const fallbackNow = new Date().toISOString();
  return state.factoryNames.map((factoryId) => {
    const targetUrl = allowed[factoryId];
    // Derive a stable base id from the factory id (`image-factory`
    // → `image`, `docs-factory` → `docs`). Fallback to the raw id
    // for non-canonical names (e.g. fixture-factory → fixture).
    const baseId = PER_PROVIDER_BASE_IDS.find((prefix) => factoryId.startsWith(prefix)) ?? factoryId.replace(/-factory$/u, "");
    // GHA-NEXT-016 — read the active registry snapshot for this
    // factory. The registry keeps its own probe timestamps; we use
    // them when present so `lastCheckedAt` reflects the actual
    // probe time, not the request time.
    const internalStatus: HealthStatus = state.healthRegistry
      ? state.healthRegistry.forFactory(factoryId)
      : "unknown";
    const componentStatus = HEALTH_STATUS_TO_COMPONENT[internalStatus];
    const snapshotEntry = state.healthRegistry?.snapshot().factories.find((entry) => entry.factoryId === factoryId);
    const lastCheckedAt = snapshotEntry?.lastCheck !== undefined
      ? new Date(snapshotEntry.lastCheck).toISOString()
      : fallbackNow;
    return {
      id: baseId,
      status: componentStatus,
      detail: targetUrl,
      lastCheckedAt,
    };
  });
};

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
        const body = livenessResponseSchema.parse({
          contractVersion: healthContractVersion,
          status: "ok",
          uptimeMs: Math.max(0, Date.now() - state.startedAt),
        });
        sendJson(response, 200, body, { "x-request-id": requestId });
        return;
      }

      if (path === PATH_HEALTH_READY && request.method === "GET") {
        if (state.lifecycle.isDraining()) {
          sendError(response, requestId, "not_configured", READY_DRAINING);
          return;
        }
        if (!state.ready || !state.router) {
          sendError(response, requestId, "not_configured", READY_NOT_READY);
          return;
        }
        // GHA-NEXT-042 — expand /health/ready `components` to include
        // a per-provider entry for each of the six adapter factories
        // (image / docs / project / ui / icon / minimax), matching
        // `composition.ts` factories. Active health probes land in
        // GHA-NEXT-016; today we expose the noop status ("unknown")
        // and surface the allowlisted target URL as `detail` so
        // operators can grep the readiness body without consulting a
        // separate source of truth. Each component carries the
        // `lastCheckedAt` ISO timestamp required by the readiness
        // contract. The three legacy entries (manifest / registry /
        // bridge) are preserved at the tail so existing consumers and
        // the Wave-1 health test keep working unchanged.
        // GHA-NEXT-042 — derive the top-level `status` from the
        // per-provider components so a fully-ejected provider
        // chain flips the readiness to `not_ready` and the LB
        // (nginx / K8s Service) can drop the pod from rotation.
        // Legacy manifest / registry / bridge entries are
        // always-`up` and never flip the overall status; only the
        // real provider components do. The schema accepts
        // `ready` | `not_ready`.
        const perProviderComponents = buildPerProviderReadinessComponents(state);
        const anyProviderDown = perProviderComponents.some(
          (c) => c.status === "down",
        );
        const topStatus: "ready" | "not_ready" = anyProviderDown ? "not_ready" : "ready";
        const readyBody: ReadinessResponse = readinessResponseSchema.parse({
          contractVersion: healthContractVersion,
          status: topStatus,
          manifestVersion: state.manifestVersion,
          routeCount: state.routeCount,
          components: [
            ...perProviderComponents,
            { id: "manifest", status: "up", detail: `v${state.manifestVersion}`, lastCheckedAt: new Date().toISOString() },
            { id: "registry", status: "up", detail: `${state.routeCount} routes`, lastCheckedAt: new Date().toISOString() },
            { id: "bridge", status: state.bridge ? "up" : "down", detail: state.bridge ? "minimax-cli" : "no minimax CLI configured", lastCheckedAt: new Date().toISOString() },
          ],
        });
        sendJson(response, 200, readyBody, { "x-request-id": requestId });
        return;
      }

      if (path === PATH_METRICS && request.method === "GET") {
        if (state.lifecycle.isDraining() || !state.ready || !state.router) {
          sendError(response, requestId, "not_configured", READY_NOT_READY);
          return;
        }
        // Read breaker snapshots from the orchestrator via the
        // router's narrow accessor. The router projects each
        // `CircuitBreaker.snapshot()` into the contract-shaped
        // snapshot — no breaker instance, URL, or secret leaks.
        const breakers = state.router.breakerSnapshots();
        // GHA-NEXT-028: when a SharedStateManager is wired into the
        // router, surface cross-instance breaker snapshots in the
        // same response. The local breakers always win on
        // targetId collisions; the merged view is what /metrics
        // exposes. No new endpoint fields are introduced — the
        // existing `breakers[]` array simply grows.
        const sharedBreakers = state.router.sharedBreakerSnapshots();
        // GHA-NEXT-035: include drain counters so operators can
        // observe drain pressure and child hard-timeouts without
        // scraping logs. Defaulted to all-zero by `buildMetricsResponse`.
        const body = buildMetricsResponse({
          state: state.metrics,
          manifestVersion: state.manifestVersion,
          breakers,
          sharedBreakers,
          drainCounters: state.lifecycle.drainCounters(),
        });
        // Validate against the schema one more time so a future bug
        // doesn't return malformed metrics silently.
        metricsResponseSchema.parse(body);
        sendJson(response, 200, body, { "x-request-id": requestId });
        return;
      }

      // GHA-NEXT-037.3 — Prometheus text-format export endpoint.
      // Same data sources as /metrics (router breakers + lifecycle
      // counters via the in-memory state), formatted as Prometheus
      // 0.0.4 text exposition so an external scrape job can ingest
      // gateway counters without the prom-client library. We expose
      // the endpoint even when composition is not yet ready (the
      // breaker / request counters still reflect pre-composition
      // state, and operators expect scrape to always succeed).
      if (path === PATH_METRICS_PROMETHEUS && request.method === "GET") {
        const breakers = state.router?.breakerSnapshots() ?? [];
        const sharedBreakers = state.router?.sharedBreakerSnapshots();
        const body = renderPrometheusText({
          state: state.metrics,
          manifestVersion: state.manifestVersion,
          breakers,
          sharedBreakers,
        });
        response.statusCode = 200;
        response.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.setHeader("x-request-id", requestId);
        response.end(body);
        return;
      }

      if (path === PATH_OPENAPI_JSON && request.method === "GET") {
        const baseUrl = `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host || `${state.config.host}:${state.config.port}`}`;
        await handleOpenApiJson(response, requestId, baseUrl);
        return;
      }

      if (path === PATH_DOCS && request.method === "GET") {
        const baseUrl = `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host || `${state.config.host}:${state.config.port}`}`;
        await handleDocsHtml(response, requestId, baseUrl);
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
        const authDecision = decideAuthFromRequest({
          keys: state.config.apiKeys,
          request,
        });
        const authCode = errorCodeForAuth(authDecision);
        if (authCode) {
          const message = authDecision.kind === "missing"
            ? "Authorization bearer token required"
            : authDecision.kind === "expired"
              ? "bearer token has expired"
              : "invalid bearer token";
          sendResourceSearchError(response, requestId, mapToNarrowErrorCode(authCode), message);
          return;
        }
        if (state.lifecycle.isDraining()) {
          sendResourceSearchError(response, requestId, "not_configured", READY_DRAINING, undefined, { "retry-after": "0" });
          return;
        }
        if (!state.ready || !state.router) {
          sendResourceSearchError(response, requestId, "not_configured", READY_NOT_READY);
          return;
        }

        let raw: string;
        try {
          raw = await readBody(request, state.config.maxBodyBytes);
        } catch (error) {
          if (error instanceof Error && error.message === "request_body_too_large") {
            sendResourceSearchError(response, requestId, "invalid_request", "request body exceeds max body size", { maxBodyBytes: state.config.maxBodyBytes });
            return;
          }
          throw error;
        }
        let parsedJson: unknown;
        try {
          parsedJson = raw.length ? JSON.parse(raw) : {};
        } catch {
          sendResourceSearchError(response, requestId, "invalid_request", "request body is not valid JSON");
          return;
        }
        let narrowRequest: ResourceSearchRequest;
        try {
          narrowRequest = resourceSearchRequestSchema.parse(parsedJson);
        } catch {
          sendResourceSearchError(response, requestId, "invalid_request", "request payload does not match resource-search/v1 schema");
          return;
        }

        // GHA-NEXT-046 — opaque pagination cursor. The client supplied
        // `narrowRequest.cursor` (when present) is a server-issued
        // token. We look it up, swap in the upstream `requestId` plus
        // the next page number, and propagate the pageSize it was
        // minted with so subsequent pages stay stable even when the
        // client would have asked for a different size in a fresh
        // request. Malformed / expired / unknown cursors map to
        // `invalid_request`; we never leak the registry's internal
        // layout through the error path.
        let paginationRequestId = requestId;
        let paginationPage = 1;
        let paginationPageSize: number = narrowRequest.pageSize;
        if (narrowRequest.cursor !== undefined && narrowRequest.cursor !== "") {
          const lookup = state.cursors.decode(narrowRequest.cursor);
          if (!lookup.ok) {
            sendResourceSearchError(
              response,
              requestId,
              "invalid_request",
              `pagination cursor is ${lookup.reason}`,
              { cursor: lookup.reason },
            );
            return;
          }
          paginationRequestId = lookup.state.requestId;
          paginationPage = lookup.state.page;
          paginationPageSize = lookup.state.pageSize;
        }

        const kinds = narrowRequest.resourceKinds && narrowRequest.resourceKinds.length > 0
          ? narrowRequest.resourceKinds
          : ["image"] as const;
        const primaryKind = kinds[0];
        const toolId = `resource.search.${primaryKind}`;
        // Route-tool allowlist: when the gateway's registry exposes the
        // requested toolId we forward the dispatch; when it does not
        // (e.g. test stubs / pre-composition bootstrap), the orchestrator
        // is responsible for surfacing an `unknown_tool` outcome via the
        // typed failure path. We never block on a missing route here —
        // that path goes through the same ProviderFailure → ErrorEnvelope
        // mapping as the internal /gateway/run dispatch.
        const routeTools = state.router
          ? new Set(state.router.routeRegistry().map((route) => route.toolId))
          : new Set<string>();
        if (routeTools.size > 0 && !routeTools.has(toolId)) {
          sendResourceSearchError(response, requestId, "unknown_tool", `tool not registered: ${toolId}`, { toolId });
          return;
        }

        const abort = new AbortController();
        const endRequest = state.lifecycle.beginRequest(requestId, abort);
        request.once("close", () => { if (!response.writableEnded) abort.abort(); });
        try {
          const outcome = await state.router.dispatch({
            intent: {
              operation: "search",
              resourceKinds: [...kinds],
              constraints: {
                query: narrowRequest.query,
                pageSize: paginationPageSize,
                page: paginationPage,
                ...(narrowRequest.cursor ? { cursor: narrowRequest.cursor } : {}),
              },
              needsClarification: false,
            },
            toolId,
            signal: abort.signal,
            // requestKey seeds cache + coalescing. Binding it to the
            // upstream requestId lets a paginated session reuse
            // results when the client re-issues the same page after
            // a retry; binding to the wire requestId would coalesce
            // unrelated paginated sessions sharing one client id.
            requestKey: paginationRequestId,
          });
          if (outcome.kind === "failure") {
            const failure = outcome.failure;
            const extra: Record<string, string> = failure.retryAfterMs
              ? { "retry-after": String(Math.ceil(failure.retryAfterMs / 1000)) }
              : {};
            const mapped = mapToNarrowErrorCode(errorCodeFor(failure));
            sendResourceSearchError(
              response,
              requestId,
              mapped,
              failure.message.slice(0, 400),
              { kind: failure.kind, routeId: failure.routeId },
              extra,
            );
            return;
          }

          const projection = (Array.isArray(outcome.result.items) ? outcome.result.items : [])
            .map((item) => {
              const parsed = resourceSearchItemSchema.safeParse({
                id: item.id,
                kind: item.kind,
                title: item.title,
                preview: typeof item.preview === "string" ? item.preview : null,
                safety: item.safety,
                provenance: {
                  provider: item.provenance?.provider ?? "unknown",
                  ref: item.provenance?.ref ?? "",
                  ...(item.provenance?.version ? { version: item.provenance.version } : {}),
                },
                ...(item.facts && typeof item.facts === "object" ? { facts: item.facts as Record<string, string> } : {}),
              });
              if (!parsed.success) return null;
              return parsed.data;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .slice(0, paginationPageSize);

          // GHA-NEXT-046 / H-2 fix — opaque pagination cursor. The
          // projection only earns a nextCursor when the page is full;
          // partial pages have no continuation. The token is minted
          // by `state.cursors.encode(...)` so the response never
          // leaks the upstream requestId or the projection length.
          const nextPage = paginationPage + 1;
          const nextCursor =
            projection.length === paginationPageSize
              ? state.cursors.encode({
                  requestId: paginationRequestId,
                  page: nextPage,
                  pageSize: paginationPageSize,
                })
              : null;

          const responseBody: ResourceSearchResponse = resourceSearchResponseSchema.parse({
            contractVersion: resourceSearchContractVersion,
            requestId,
            mode: outcome.result.mode,
            state: projection.length > 0 ? "presenting" : "clarifying",
            items: projection,
            warnings: (outcome.result.warnings ?? []).slice(0, 32),
            nextCursor,
          });
          sendJson(response, 200, responseBody, { "x-request-id": requestId });
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/aborted/iu.test(message)) {
            sendResourceSearchError(response, requestId, "cancelled", "request aborted by client");
            return;
          }
          sendResourceSearchError(response, requestId, "provider_error", message.slice(0, 400));
          return;
        } finally {
          endRequest();
        }
      }

      if (path === PATH_GATEWAY_RUN && request.method === "POST") {
        // GHA-NEXT-029 — Bearer API Key gate. Empty key set is a
        // no-op (default, backwards-compatible). Mismatch / missing
        // header → 401 + code=unauthorized. The gate runs BEFORE
        // the ready-check so callers always get a stable auth
        // signal even while the gateway is still composing.
        const authDecision = decideAuthFromRequest({
          keys: state.config.apiKeys,
          request,
        });
        const authCode = errorCodeForAuth(authDecision);
        if (authCode) {
          const message = authDecision.kind === "missing"
            ? "Authorization bearer token required"
            : authDecision.kind === "expired"
              ? "bearer token has expired"
              : "invalid bearer token";
          sendError(response, requestId, authCode, message);
          return;
        }

        if (state.lifecycle.isDraining()) {
          sendError(response, requestId, "not_configured", READY_DRAINING, undefined, { "retry-after": "0" });
          return;
        }
        if (!state.ready || !state.router) {
          sendError(response, requestId, "not_configured", READY_NOT_READY);
          return;
        }

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

        let gatewayRequest: GatewayRequest;
        try {
          gatewayRequest = gatewayRequestSchema.parse(parsedJson);
        } catch {
          sendError(response, requestId, "invalid_request", "request payload does not match gateway schema");
          return;
        }

        const planner = plannerOutputSchema.safeParse(gatewayRequest.planner);
        if (!planner.success) {
          sendError(response, requestId, "invalid_request", "planner output failed validation");
          return;
        }

        const firstCall = planner.data.calls[0] ?? planner.data.pipeline?.[0];
        if (!firstCall) {
          sendError(response, requestId, "invalid_request", "planner produced no tool calls");
          return;
        }
        const toolIdCheck = stepToolIdSchema.safeParse(firstCall.toolId);
        const inputCheck = stepInputSchema.safeParse(firstCall.input);
        if (!toolIdCheck.success || !inputCheck.success) {
          sendError(response, requestId, "invalid_request", "tool call shape is invalid");
          return;
        }

        const intent = planner.data.intent;
        const abort = new AbortController();
        const endRequest = state.lifecycle.beginRequest(requestId, abort);
        request.once("close", () => { if (!response.writableEnded) abort.abort(); });

        try {
          const isImageSearch = firstCall.toolId === "resource.search.image" && intent.resourceKinds.includes("image");
          const routeTools = new Set(state.router.routeRegistry().map((route) => route.toolId));
          const canCascadeImageSearch = isImageSearch
            && routeTools.has("resource.search.web")
            && routeTools.has("resource.generate.image");
          const imageIntent = canCascadeImageSearch
            ? {
              ...intent,
              constraints: {
                ...intent.constraints,
                ...(typeof intent.constraints.query === "string"
                  ? {}
                  : typeof firstCall.input.query === "string" ? { query: firstCall.input.query } : {}),
              },
            }
            : intent;
          const outcome = canCascadeImageSearch
            ? await runImageSearchCascade({
              intent: imageIntent,
              requestKey: requestId,
              signal: abort.signal,
              dispatch: (input) => state.router!.dispatch(input),
            })
            : await state.router.dispatch({
              intent,
              toolId: firstCall.toolId,
              signal: abort.signal,
              requestKey: requestId,
            });
          if (outcome.kind === "success") {
            const items = Array.isArray(outcome.result.items) ? outcome.result.items.slice(0, state.config.maxResultItems) : [];
            const gatewayTrace = "trace" in outcome && Array.isArray(outcome.trace)
              ? outcome.trace as ReadonlyArray<{ state: string; label: string; detail?: string }>
              : [];
            const responseBody: GatewayResponse = {
              contractVersion: gatewayContractVersion,
              requestId,
              fromCache: outcome.fromCache,
              trace: gatewayTrace.map((event) => [event.state, event.label, event.detail].filter(Boolean).join("|").slice(0, 400)),
              planner: planner.data,
              result: { ...outcome.result, items },
              warnings: (outcome.result.warnings || []).slice(0, 32),
            };
            sendJson(response, 200, responseBody, { "x-request-id": requestId });
            return;
          }
          const failure = outcome.failure;
          const retryAfterMs = failure.retryAfterMs;
          const extra: Record<string, string> = retryAfterMs ? { "retry-after": String(Math.ceil(retryAfterMs / 1000)) } : {};
          sendError(response, requestId, errorCodeFor(failure) as GatewayErrorCode, failure.message, { kind: failure.kind, routeId: failure.routeId }, extra);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/aborted/iu.test(message)) {
            sendError(response, requestId, "cancelled", "request aborted by client");
            return;
          }
          sendError(response, requestId, "provider_error", message.slice(0, 400));
          return;
        } finally {
          endRequest();
        }
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
        return runMiniMaxHandler(state, request, response, requestId, (body, signal) => state.bridge!.search(body, signal));
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
        return runMiniMaxHandler(state, request, response, requestId, (body, signal) => state.bridge!.image(body, signal));
      }

      // GHA-NEXT-034 — /admin/* endpoints (gated by
      // GATEWAY_ADMIN_TOKEN). Default posture is "gate off" so the
      // Wave 1 harness keeps working; setting the env var
      // activates the gate and rejects with 401 + unauthorized.
      if (path === PATH_ADMIN_DRAIN && request.method === "POST") {
        const adminDecision = decideAdminAuthFromRequest({
          configuredToken: state.config.adminToken,
          request,
        });
        if (adminDecision.kind === "missing" || adminDecision.kind === "invalid") {
          sendError(response, requestId, "unauthorized", "admin token required");
          return;
        }
        if (adminDecision.kind === "disabled") {
          // Gate off: refuse the request with a clear message so
          // operators know they need to set GATEWAY_ADMIN_TOKEN.
          sendError(response, requestId, "not_configured", "admin gate is disabled (GATEWAY_ADMIN_TOKEN unset)");
          return;
        }
        state.lifecycle.beginDrain();
        sendJson(response, 200, { ok: true, requestId, draining: true }, { "x-request-id": requestId });
        return;
      }

      if (path === PATH_ADMIN_ROUTES_RELOAD && request.method === "POST") {
        const adminDecision = decideAdminAuthFromRequest({
          configuredToken: state.config.adminToken,
          request,
        });
        if (adminDecision.kind === "missing" || adminDecision.kind === "invalid") {
          sendError(response, requestId, "unauthorized", "admin token required");
          return;
        }
        if (adminDecision.kind === "disabled") {
          sendError(response, requestId, "not_configured", "admin gate is disabled (GATEWAY_ADMIN_TOKEN unset)");
          return;
        }
        // GHA-NEXT-036 — atomic reload. Read the body, validate the
        // new manifest, swap the orchestrator reference, refresh
        // state.manifestVersion + state.routeCount + state.ready,
        // and reply. Validation failures return 500 with
        // code=manifest_validation_failed; the running gateway is
        // untouched in that case (atomic publish contract).
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

/** Shared handler used by both /provider/minimax-tokenplan/* routes. */
const runMiniMaxHandler = async (
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
    const status = result.status && result.status >= 400 && result.status < 600 ? result.status : 502;
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

/**
 * GHA-NEXT-036 — atomic reload orchestrator. Validates the new
 * manifest via composition's `reloadRoutes()`, builds a fresh
 * `GatewayOrchestrator` on the same factory map + SharedStateManager,
 * and swaps the router reference in one synchronous step. On any
 * validation failure the router reference is untouched (atomic
 * publish contract).
 */
const reloadRoutesAndSwap = async (params: {
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

// Re-export the helper for tests that want to mint a request id manually.
export { newRequestId };

// Direct entrypoint when run via `pnpm start`.
if (import.meta.url === `file://${process.argv[1]}`) {
  void startGateway().catch((error) => {
    console.error("[gateway] failed to start", error);
    process.exit(1);
  });
}

// Keep unused Readable import (used implicitly via stream typings).
void Readable;
