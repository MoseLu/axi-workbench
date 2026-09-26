/**
 * GHA-NEXT-029 — Bearer API Key authentication middleware.
 *
 * Default posture is "auth off" so the gateway is backwards-compatible
 * with the existing L2 harness (`gateway-ha.mjs`) and the browser
 * workbench that uses `VITE_AXI_DOCS_TOKEN` for *upstream* auth, not
 * for the gateway itself. When the operator opts in by setting
 * `GATEWAY_API_KEYS` (comma-separated list of accepted keys) every
 * `POST /gateway/run` MUST carry a matching `Authorization: Bearer <key>`
 * header. Missing or unknown keys return 401 with the stable
 * `code=unauthorized` envelope; this is wired into the same path the
 * rest of the server uses, so `x-request-id` propagation still works.
 *
 * Key parsing is intentionally minimal:
 *   - `Authorization` is the only header inspected.
 *   - Tokens are compared in constant time to avoid leaking the
 *     length of the configured key set.
 *   - The middleware never logs the presented key, the configured
 *     key set, or any header value.
 *
 * Admin auth (GHA-NEXT-034) lives in `admin-auth.ts` and uses a
 * separate `GATEWAY_ADMIN_TOKEN`; the two surfaces never share state.
 */

import type { IncomingMessage } from "node:http";
import type { GatewayErrorCode } from "@axi/gateway-contracts";

/** Why a request was rejected (or "ok"). The HTTP layer maps these to
 *  status codes; the message stays operator-friendly. */
export type AuthOutcome =
  | { readonly kind: "ok" }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid" }
  | { readonly kind: "expired" };

/** Static key list. Kept narrow on purpose: callers should not pass
 *  anything larger than ~32 keys through the env. */
export type ApiKeySet = ReadonlyArray<string>;

const trimKey = (raw: string): string => raw.trim();

/** Parse `GATEWAY_API_KEYS` env into a normalized set. Empty / undefined
 *  → empty set → auth disabled. */
export const parseApiKeys = (raw: string | undefined): ApiKeySet => {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(",")) {
    const trimmed = trimKey(piece);
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

/** Extract the bearer token from an `Authorization` header. Returns
 *  `undefined` for malformed / missing inputs. The header value is
 *  never logged. */
export const readBearer = (header: string | string[] | undefined): string | undefined => {
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+([A-Za-z0-9._\-+/=]{1,512})$/u.exec(header);
  if (!match) return undefined;
  return match[1];
};

/** Constant-time string comparison. Returns false immediately when the
 *  two strings have different lengths. */
const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/** Pick the canonical error code for an AuthOutcome. Kept here so the
 *  server.ts call site stays one line. */
export const errorCodeForAuth = (outcome: AuthOutcome): GatewayErrorCode | null => {
  switch (outcome.kind) {
    case "ok":
      return null;
    case "missing":
    case "invalid":
      return "unauthorized";
    case "expired":
      return "token_expired";
  }
};

/** Decide whether a request to `/gateway/run` may proceed.
 *
 *  - Empty key set → always "ok" (auth disabled).
 *  - Present `Authorization: Bearer` matching one configured key → "ok".
 *  - Anything else → "missing" / "invalid" with a stable code.
 *
 *  The function is pure: no I/O, no logging, no global side effects.
 */
export const decideAuth = (inputs: {
  keys: ApiKeySet;
  authorizationHeader: string | string[] | undefined;
}): AuthOutcome => {
  if (inputs.keys.length === 0) return { kind: "ok" };
  const presented = readBearer(inputs.authorizationHeader);
  if (!presented) return { kind: "missing" };
  for (const candidate of inputs.keys) {
    if (constantTimeEqual(presented, candidate)) return { kind: "ok" };
  }
  return { kind: "invalid" };
};

/** Convenience wrapper that pulls the header off an IncomingMessage. */
export const decideAuthFromRequest = (inputs: {
  keys: ApiKeySet;
  request: IncomingMessage;
}): AuthOutcome =>
  decideAuth({
    keys: inputs.keys,
    authorizationHeader: inputs.request.headers.authorization,
  });