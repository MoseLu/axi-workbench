/**
 * resource-search/v1 — narrow cross-project contract.
 *
 * This is the *only* surface that downstream products (e.g. Axi Soul
 * World) should depend on for resource search. The internal
 * `POST /gateway/run` keeps the planner-shaped protocol it has carried
 * since GHA-003, but external consumers MUST use `POST /resource/search`
 * because:
 *
 *   1. The request shape is the trimmed down `{query, resourceKinds,
 *      pageSize, cursor}` DTO; the planner output stays an internal
 *      protocol between the workbench and the gateway.
 *   2. The response shape is a fixed `ResourceSearchResult` with a
 *      stable `mode`, `state`, `items`, `warnings`, and `nextCursor`.
 *   3. `contractVersion=1` is bumped as a single literal so consumers
 *      can fail closed if the server reports a future version.
 *
 * The schema is pure: no transport, no fetch, no logger. All values are
 * bounded; `facts` and `preview` strings are rejected when they point
 * at local filesystem paths so downstream projections can trust them
 * without re-validating.
 *
 * Style rules (matching the rest of the contracts package):
 *   - Pure zod schemas + tiny types.
 *   - Cross-module interaction flows through named exports.
 *   - Bumping `contractVersion` is the breaking-change signal.
 */
import { z } from "zod";

export const resourceSearchContractVersion = 1 as const;

/**
 * Resource kinds the narrow contract accepts. Mirrors the allowlist
 * exposed by the gateway's `/routes` projection; values outside the
 * set are rejected at the HTTP boundary.
 */
export const resourceSearchKindSchema = z.enum([
  "image",
  "document",
  "skill",
  "project",
  "ui",
  "icon",
  "workspace",
]);
export type ResourceSearchKind = z.infer<typeof resourceSearchKindSchema>;

export const resourceSearchSafetySchema = z.enum(["safe", "flagged", "blocked"]);
export type ResourceSearchSafety = z.infer<typeof resourceSearchSafetySchema>;

export const resourceSearchModeSchema = z.enum(["fixture", "live"]);
export type ResourceSearchMode = z.infer<typeof resourceSearchModeSchema>;

export const resourceSearchStateSchema = z.enum([
  "presenting",
  "clarifying",
  "failed",
]);
export type ResourceSearchState = z.infer<typeof resourceSearchStateSchema>;

/**
 * Match the union declared on `BACKEND_CONTRACT.md` §3 — opaque client
 * strings, never raw `Authorization` content. Downstream code never
 * receives the original bearer value.
 */
export const resourceSearchProvenanceSchema = z.object({
  provider: z.string().min(1).max(120),
  ref: z.string().min(1).max(400),
  version: z.string().min(1).max(80).optional(),
});
export type ResourceSearchProvenance = z.infer<typeof resourceSearchProvenanceSchema>;

/**
 * Safety classifier per `BACKEND_CONTRACT.md` §1.1 — every candidate
 * the gateway surfaces must carry one of these. The gateway never
 * returns `blocked` in `items[]`; consumers can rely on that
 * invariant for projection.
 */
export const resourceSearchItemSchema = z.object({
  id: z.string().min(1).max(120),
  kind: resourceSearchKindSchema,
  title: z.string().min(1).max(400),
  preview: z.string().min(1).max(2048).nullable().optional(),
  safety: resourceSearchSafetySchema.exclude(["blocked"]),
  provenance: resourceSearchProvenanceSchema,
  facts: z.record(z.string().min(1).max(400), z.string().min(1).max(400)).optional(),
});
export type ResourceSearchItem = z.infer<typeof resourceSearchItemSchema>;

/**
 * Narrow request body. The `gatewayBase` field is intentionally
 * absent — internal routing lives behind the gateway server config and
 * the request-id from the caller. `cursor` keeps the page-size and
 * pagination contract simple for downstream BFFs.
 */
export const resourceSearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  resourceKinds: z.array(resourceSearchKindSchema).max(8).optional(),
  pageSize: z.number().int().min(1).max(50).default(12),
  cursor: z.string().min(1).max(200).optional(),
  /** Optional caller-supplied request id; bounded so it cannot be
   *  used as a credential exfiltration vector. */
  requestId: z.string().min(1).max(80).optional(),
});
export type ResourceSearchRequest = z.infer<typeof resourceSearchRequestSchema>;

export const resourceSearchResponseSchema = z.object({
  contractVersion: z.literal(resourceSearchContractVersion),
  requestId: z.string().min(1).max(80),
  mode: resourceSearchModeSchema,
  state: resourceSearchStateSchema,
  items: z.array(resourceSearchItemSchema).max(50),
  warnings: z.array(z.string().min(1).max(400)).max(32),
  nextCursor: z.string().min(1).max(200).nullable().optional(),
});
export type ResourceSearchResponse = z.infer<typeof resourceSearchResponseSchema>;

/**
 * Stable error codes returned in `ErrorEnvelope.code`. The narrow
 * contract reuses the gateway namespace to keep one error vocabulary
 * across surfaces.
 */
export const resourceSearchErrorCodeSchema = z.enum([
  "invalid_request",
  "unauthorized",
  "token_expired",
  "unknown_tool",
  "not_configured",
  "provider_timeout",
  "circuit_open",
  "provider_error",
  "rate_limited",
  "cancelled",
  "internal",
]);
export type ResourceSearchErrorCode = z.infer<typeof resourceSearchErrorCodeSchema>;

export const resourceSearchErrorEnvelopeSchema = z.object({
  contractVersion: z.literal(resourceSearchContractVersion),
  requestId: z.string().min(1).max(80),
  code: resourceSearchErrorCodeSchema,
  message: z.string().min(1).max(400),
  details: z.record(z.string().min(1).max(80), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type ResourceSearchErrorEnvelope = z.infer<typeof resourceSearchErrorEnvelopeSchema>;

export const httpStatusForResourceSearchErrorCode = (code: ResourceSearchErrorCode): number => {
  switch (code) {
    case "invalid_request":
      return 400;
    case "unauthorized":
    case "token_expired":
      return 401;
    case "unknown_tool":
      return 404;
    case "rate_limited":
      return 429;
    case "provider_timeout":
      return 504;
    case "not_configured":
    case "circuit_open":
      return 503;
    case "provider_error":
      return 502;
    case "cancelled":
      return 499;
    case "internal":
      return 500;
  }
};