/**
 * GHA-NEXT-034 — Admin token gate.
 *
 * `/admin/*` endpoints (`/admin/drain`, `/admin/routes/reload`,
 * future ops endpoints) require a separate admin token configured
 * via `GATEWAY_ADMIN_TOKEN`. The token is intentionally NOT the
 * same as the `/gateway/run` Bearer API Key: an attacker who
 * compromises a regular consumer key must not be able to drain
 * the gateway or hot-reload its routes.
 *
 * Default posture is "admin gate off" (no `GATEWAY_ADMIN_TOKEN` set)
 * so the existing L2 harness (`gateway-ha.mjs`) and the dispatch-e2e
 * tests keep working. Operators opt in by setting the env var;
 * routes added later (`/admin/...`) will land already gated.
 *
 * Comparison is constant-time to avoid leaking the configured token
 * length via response timing.
 */

import type { IncomingMessage } from "node:http";

export type AdminAuthOutcome =
  | { readonly kind: "ok" }
  | { readonly kind: "disabled" }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid" };

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/** Extract the bearer token from an `Authorization` header. */
export const readAdminBearer = (header: string | string[] | undefined): string | undefined => {
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+([A-Za-z0-9._\-+/=]{1,512})$/u.exec(header);
  if (!match) return undefined;
  return match[1];
};

/** Decide whether a request to `/admin/*` may proceed.
 *
 *  - Empty configured token → "disabled" (the gate is off; the
 *    caller decides whether to short-circuit or pass through).
 *  - Configured token + matching `Bearer <token>` → "ok".
 *  - Configured token + missing/malformed header → "missing".
 *  - Configured token + non-matching token → "invalid".
 */
export const decideAdminAuth = (inputs: {
  configuredToken: string;
  authorizationHeader: string | string[] | undefined;
}): AdminAuthOutcome => {
  if (!inputs.configuredToken || inputs.configuredToken.length === 0) {
    return { kind: "disabled" };
  }
  const presented = readAdminBearer(inputs.authorizationHeader);
  if (!presented) return { kind: "missing" };
  if (constantTimeEqual(presented, inputs.configuredToken)) return { kind: "ok" };
  return { kind: "invalid" };
};

/** Convenience wrapper that pulls the header off an IncomingMessage. */
export const decideAdminAuthFromRequest = (inputs: {
  configuredToken: string;
  request: IncomingMessage;
}): AdminAuthOutcome =>
  decideAdminAuth({
    configuredToken: inputs.configuredToken,
    authorizationHeader: inputs.request.headers.authorization,
  });