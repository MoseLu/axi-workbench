import { z } from "zod";

/**
 * Gateway runtime contract (GHA-003).
 *
 * This module is the versioned wire format between the workbench (browser)
 * and the apps/gateway Node server. It is intentionally small: it pins
 * request shape, response shape, and the stable error-code namespace used
 * by the gateway HTTP layer.
 *
 * Style rules (matching the rest of the contracts package):
 * - Pure schemas and tiny types; no transport, no fetch, no logger.
 * - All cross-module interaction flows through these named exports.
 * - Every breaking change bumps the `gatewayContractVersion` constant.
 */

export const gatewayContractVersion = 1 as const;

/** Stable error codes returned in `ErrorEnvelope.code`. Adding new codes is
 *  a non-breaking change; renaming or removing one is breaking and requires
 *  a contract bump. */
export const gatewayErrorCodeSchema = z.enum([
  /** Request body was not valid JSON, did not match the request schema, or
   *  exceeded the size limit. */
  "invalid_request",
  /** Requested toolId is not registered in the gateway manifest. */
  "unknown_tool",
  /** A required server-side configuration (e.g. provider secret) is missing. */
  "not_configured",
  /** Provider adapter exceeded its target timeout. */
  "provider_timeout",
  /** Provider circuit is open; retry later. */
  "circuit_open",
  /** Provider returned 4xx / 5xx / network error. */
  "provider_error",
  /** Rate limit / backpressure rejection at the gateway layer. */
  "rate_limited",
  /** Caller aborted the request (AbortSignal). */
  "cancelled",
  /** Catch-all for unexpected server errors. */
  "internal",
  /** Caller did not supply a valid credential (missing / unknown Bearer
   *  key, missing admin token). Non-breaking addition. */
  "unauthorized",
  /** Caller supplied a credential that has expired (rotation window). */
  "token_expired",
  /** SES-MVP-003 — Session id is unknown, deleted or never existed. */
  "session_not_found",
  /** SES-MVP-003 — Revision CAS lost; client must re-read and retry. */
  "session_conflict",
  /** SES-MVP-003 — Session, entry or text exceeded the local MVP cap. */
  "session_limit",
  /** SES-MVP-003 — Session store failed without leaking its path. */
  "session_store_unavailable",
]);
export type GatewayErrorCode = z.infer<typeof gatewayErrorCodeSchema>;

/** Stable request shape. Only the fields the gateway needs to dispatch are
 *  exposed; the planner contract stays in `plannerResultSchema`. */
export const gatewayRequestSchema = z.object({
  /** Opaque planner output. Validated against plannerResultSchema on the
   *  server before dispatch. */
  planner: z.unknown(),
  /** Optional client-supplied request id; the gateway will keep it if it
   *  matches `^[a-zA-Z0-9_-]{1,80}$`, otherwise mint a new one. */
  requestId: z.string().min(1).max(80).optional(),
  /** Whether the client accepts only cached results (optional fast path). */
  fromCacheOnly: z.boolean().optional(),
});
export type GatewayRequest = z.infer<typeof gatewayRequestSchema>;

/** Stable response shape. */
export const gatewayResponseSchema = z.object({
  contractVersion: z.literal(gatewayContractVersion),
  requestId: z.string().min(1).max(80),
  /** Whether the gateway returned a cached result without invoking a provider. */
  fromCache: z.boolean(),
  /** Server-side trace lines, in dispatch order. */
  trace: z.array(z.string().min(1).max(400)).max(64),
  /** Planner output that was actually dispatched (may differ from request
   *  after server-side validation/coercion). */
  planner: z.unknown(),
  /** AdapterSearchResult-shaped payload (kept as `unknown` here so this
   *  module stays free of the orchestrator's runtime types). */
  result: z.unknown(),
  warnings: z.array(z.string().min(1).max(400)).max(32),
});
export type GatewayResponse = z.infer<typeof gatewayResponseSchema>;

/** Stable error envelope. Returned with a non-2xx HTTP status. */
export const errorEnvelopeSchema = z.object({
  contractVersion: z.literal(gatewayContractVersion),
  requestId: z.string().min(1).max(80),
  code: gatewayErrorCodeSchema,
  message: z.string().min(1).max(400),
  /** Optional provider / route metadata to aid debugging; never contains
   *  secrets, paths, or user query text. */
  details: z.record(z.string().min(1).max(80), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/** Stable mapping from `GatewayErrorCode` to the recommended HTTP status.
 *  The gateway server may override the status in specific situations (e.g.
 *  downgrade provider 5xx to 502), but this is the default. */
export const httpStatusForErrorCode = (code: GatewayErrorCode): number => {
  switch (code) {
    case "invalid_request":
      return 400;
    case "unknown_tool":
      return 404;
    case "not_configured":
      return 503;
    case "provider_timeout":
      return 504;
    case "circuit_open":
      return 503;
    case "provider_error":
      return 502;
    case "rate_limited":
      return 429;
    case "cancelled":
      return 499;
    case "internal":
      return 500;
    case "unauthorized":
      return 401;
    case "token_expired":
      return 401;
    case "session_not_found":
      return 404;
    case "session_conflict":
      return 409;
    case "session_limit":
      return 413;
    case "session_store_unavailable":
      return 503;
  }
};

/** Decide whether a given error code should be safe to surface to the
 *  caller without leaking internals. Provider error details are scrubbed;
 *  the message is allowed to be the gateway's own copy. */
export const isPublicErrorCode = (_code: GatewayErrorCode): boolean => true;