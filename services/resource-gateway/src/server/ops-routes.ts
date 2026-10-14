/**
 * Operational + documentation endpoints: `/health/live`, `/health/ready`,
 * `/metrics`, `/metrics/prometheus`, `/routes`, `/openapi.json`, `/docs`.
 *
 * Extracted verbatim from the original monolithic `server.ts`; the
 * inline dispatch bodies were lifted into functions with identical
 * bodies. No behaviour changed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  healthContractVersion,
  livenessResponseSchema,
  metricsResponseSchema,
  readinessResponseSchema,
  routesResponseSchema,
  type ReadinessResponse,
} from "@axi/gateway-contracts";
import { HEALTH_STATUS_TO_COMPONENT, type HealthStatus } from "@axi/resource-orchestrator";

import { buildMetricsResponse, renderPrometheusText } from "../metrics.js";
import { PATH_OPENAPI_JSON } from "../routes.js";
import { READY_DRAINING, READY_NOT_READY, sendError, sendHtml, sendJson, type ServerState } from "./context.js";

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

export const handleOpenApiJson = async (response: ServerResponse, requestId: string, baseUrl: string): Promise<void> => {
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

export const handleDocsHtml = async (response: ServerResponse, requestId: string, baseUrl: string): Promise<void> => {
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

export const handleRoutes = (state: ServerState, response: ServerResponse, requestId: string): void => {
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

export const buildPerProviderReadinessComponents = (state: ServerState): ReadinessResponse["components"] => {
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

export const handleHealthLive = (state: ServerState, response: ServerResponse, requestId: string): void => {
  const body = livenessResponseSchema.parse({
    contractVersion: healthContractVersion,
    status: "ok",
    uptimeMs: Math.max(0, Date.now() - state.startedAt),
  });
  sendJson(response, 200, body, { "x-request-id": requestId });
};

export const handleHealthReady = (state: ServerState, response: ServerResponse, requestId: string): void => {
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
};

export const handleMetrics = (state: ServerState, response: ServerResponse, requestId: string): void => {
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
};

// GHA-NEXT-037.3 — Prometheus text-format export endpoint.
// Same data sources as /metrics (router breakers + lifecycle
// counters via the in-memory state), formatted as Prometheus
// 0.0.4 text exposition so an external scrape job can ingest
// gateway counters without the prom-client library. We expose
// the endpoint even when composition is not yet ready (the
// breaker / request counters still reflect pre-composition
// state, and operators expect scrape to always succeed).
export const handleMetricsPrometheus = (state: ServerState, response: ServerResponse, requestId: string): void => {
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
};

/** Derive the public base URL for `/openapi.json` and `/docs`. */
export const resolveBaseUrl = (state: ServerState, request: IncomingMessage): string =>
  `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host || `${state.config.host}:${state.config.port}`}`;
