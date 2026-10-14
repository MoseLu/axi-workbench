/**
 * Shared gateway HTTP context: the mutable `ServerState` handed to every
 * route handler, plus the low-level request/response primitives
 * (`sendJson` / `sendError` / `readBody` / request-id minting).
 *
 * Extracted verbatim from the original monolithic `server.ts`; no
 * behaviour changed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  errorEnvelopeSchema,
  gatewayContractVersion,
  httpStatusForErrorCode,
  httpStatusForResourceSearchErrorCode,
  resourceSearchContractVersion,
  resourceSearchErrorCodeSchema,
  resourceSearchErrorEnvelopeSchema,
  type ErrorEnvelope,
  type GatewayErrorCode,
  type ResourceSearchErrorCode,
} from "@axi/gateway-contracts";
import type { HealthRegistry } from "@axi/resource-orchestrator";

import type { ServerConfig } from "../config.js";
import type { Lifecycle } from "../lifecycle.js";
import type { MemoryHandlerContext } from "../memory/handlers.js";
import type { MetricsState } from "../metrics.js";
import type { MiniMaxBridge } from "../minimax-bridge.js";
import type { CursorRegistry } from "../pagination.js";
import type { GatewayRouter } from "../router.js";
import type { SessionHandlerContext } from "../session/handlers.js";

export const READY_NOT_READY = "composition-root-not-ready" as const;
export const READY_DRAINING = "server-is-draining" as const;

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

export const sendJson = (response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(JSON.stringify(payload));
};

export const sendHtml = (response: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) => {
  response.statusCode = status;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(body);
};

export const sendError = (
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
export const mapToNarrowErrorCode = (code: string | null | undefined): ResourceSearchErrorCode => {
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
export const sendResourceSearchError = (
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

export const readBody = (request: IncomingMessage, maxBytes: number): Promise<string> => new Promise((resolve, reject) => {
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

export const newRequestId = (provided: string | undefined): string => {
  if (typeof provided === "string" && /^[a-zA-Z0-9_-]{1,80}$/u.test(provided)) return provided;
  return `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const newRequestRequestId = (request: IncomingMessage): string => {
  const headerValue = request.headers["x-request-id"];
  return newRequestId(typeof headerValue === "string" ? headerValue : undefined);
};
