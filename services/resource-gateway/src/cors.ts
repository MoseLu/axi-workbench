/**
 * GHA-064 — minimal CORS policy.
 *
 * The gateway's default posture is "no CORS": same-origin requests work,
 * cross-origin requests are blocked by the browser. The operator may
 * opt in to one or more explicit origins via GATEWAY_CORS_ORIGINS. When
 * an allowed origin is observed we emit the smallest set of headers
 * the browser needs; we never echo arbitrary user-supplied origins
 * (which is the classic CORS bypass).
 *
 * GHA-NEXT-030 — Browser-request shape gate.
 *
 * When the request declares an Origin header (i.e. it's a browser
 * call) the gateway additionally requires:
 *   - Content-Type: application/json on POST bodies
 *   - x-request-id header (we will echo it; if missing, the server
 *     mints one, but the contract surface benefits from caller-
 *     supplied IDs for end-to-end tracing)
 *
 * A request that fails either check is rejected with `invalid_request`
 * at the HTTP edge, BEFORE we touch the body / dispatch path. A
 * request with no Origin header (curl, server-to-server) is the
 * "same-origin bypass" path and is allowed through; this matches
 * the existing L2 harness behavior so the Wave 1 smoke stays green.
 *
 * The CORS policy itself remains "never echo arbitrary Origin"; the
 * GHA-NEXT-030 gate is *adjacent* to that, never a substitute.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export interface CorsDecision {
  readonly allowed: boolean;
  /** When `allowed` is true, the exact origin that must be echoed back. */
  readonly origin?: string;
}

export interface CorsInputs {
  /** Operator allowlist. Empty array disables CORS entirely. */
  readonly allowlist: ReadonlyArray<string>;
  readonly requestOrigin: string | undefined;
  readonly requestMethod: string;
}

/** Reason the request was rejected at the CORS / shape gate. The HTTP
 *  layer maps this to a stable error envelope. */
export type CorsShapeOutcome =
  | { readonly kind: "ok" }
  | { readonly kind: "cross-origin-rejected" }
  | { readonly kind: "missing-content-type" }
  | { readonly kind: "bad-content-type" }
  | { readonly kind: "missing-request-id" };

export const decideCors = (inputs: CorsInputs): CorsDecision => {
  if (inputs.allowlist.length === 0) return { allowed: false };
  const origin = inputs.requestOrigin;
  if (!origin) return { allowed: false };
  if (!inputs.allowlist.includes(origin)) return { allowed: false };
  return { allowed: true, origin };
};

const corsHeadersFor = (origin: string): Record<string, string> => ({
  "access-control-allow-origin": origin,
  "vary": "Origin",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-request-id",
  "access-control-max-age": "600",
});

/** Apply the CORS decision to a response. Returns true when headers
 *  were written (the caller should then end() the preflight without
 *  invoking the main handler). */
export const applyCors = (decision: CorsDecision, response: ServerResponse): boolean => {
  if (!decision.allowed || !decision.origin) return false;
  for (const [key, value] of Object.entries(corsHeadersFor(decision.origin))) {
    response.setHeader(key, value);
  }
  return true;
};

/** Read the Origin header off an IncomingMessage. Returns undefined
 *  when absent. */
export const readOrigin = (request: IncomingMessage): string | undefined => {
  const header = request.headers["origin"];
  if (typeof header === "string") return header;
  if (Array.isArray(header)) return header[0];
  return undefined;
};

/** Convenience: same-origin bypass — when no Origin header is present
 *  (curl, server-to-server), we do not need to emit CORS headers. */
export const isSameOriginOrServer = (request: IncomingMessage): boolean =>
  readOrigin(request) === undefined;

/* -------------------------------------------------------------------------
 * GHA-NEXT-030 — Browser-request shape gate.
 * -----------------------------------------------------------------------*/

/** Return the first content-type value as a lower-cased trimmed string.
 *  Handles the `string | string[] | undefined` IncomingMessage header
 *  type without leaking the array shape. */
export const readContentType = (request: IncomingMessage): string | undefined => {
  const header = request.headers["content-type"];
  if (typeof header === "string") return header.split(";")[0]!.trim().toLowerCase();
  if (Array.isArray(header)) {
    const first: unknown = header[0];
    return typeof first === "string" ? first.split(";")[0]!.trim().toLowerCase() : undefined;
  }
  return undefined;
};

/** Return the first x-request-id header value (string only — caller-
 *  supplied IDs must be a single string, not an array). */
export const readRequestIdHeader = (request: IncomingMessage): string | undefined => {
  const header = request.headers["x-request-id"];
  if (typeof header === "string") return header;
  return undefined;
};

/** Decide whether the browser-request shape gate passes. Only enforces
 *  the gate on requests that declare an Origin header (i.e. look like
 *  a browser call). Same-origin / server-to-server calls bypass. */
export const decideBrowserShape = (inputs: {
  request: IncomingMessage;
  method: string;
}): CorsShapeOutcome => {
  const origin = readOrigin(inputs.request);
  // Same-origin bypass: no Origin means curl / server-to-server.
  if (!origin) return { kind: "ok" };
  // GETs and OPTIONS preflights are exempt from the body-content-type
  // requirement. The x-request-id gate still applies.
  const method = inputs.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return readRequestIdHeader(inputs.request) ? { kind: "ok" } : { kind: "missing-request-id" };
  }
  // For methods that carry a body (POST / PUT / PATCH / DELETE) the
  // browser must declare a JSON content type.
  const ct = readContentType(inputs.request);
  if (!ct) return { kind: "missing-content-type" };
  if (ct !== "application/json") return { kind: "bad-content-type" };
  // x-request-id is required for end-to-end tracing on POST calls.
  return readRequestIdHeader(inputs.request) ? { kind: "ok" } : { kind: "missing-request-id" };
};