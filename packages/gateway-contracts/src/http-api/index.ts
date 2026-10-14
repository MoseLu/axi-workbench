/**
 * GHA-080 — versioned HTTP API contract and endpoint metadata.
 *
 * Purpose
 * -------
 * The standalone gateway at apps/gateway exposes the dispatcher, operations,
 * provider bridge, and local-memory HTTP endpoints:
 *
 *   POST /gateway/run     → dispatcher
 *   GET  /health/live     → liveness probe
 *   GET  /health/ready    → readiness probe
 *   GET  /metrics         → metrics snapshot
 *   GET  /openapi.json    → machine-readable OpenAPI document
 *   GET  /docs            → human-readable Swagger / Redoc HTML
 *
 * This module owns the *endpoint metadata* — the stable, framework-free
 * description of each endpoint that:
 *
 *   - pins the request / response / error schemas (referencing the
 *     schemas already declared in gateway.ts and health.ts so we never
 *     drift from the wire types),
 *   - declares the canonical HTTP method + path + status codes,
 *   - declares which GatewayErrorCode values are valid for that
 *     endpoint (so api-docs can render the error matrix correctly),
 *   - declares the contract version the endpoint speaks,
 *
 * The metadata is consumed by packages/api-docs (which generates
 * OpenAPI 3.1 documents) and by apps/gateway (which composes its HTTP
 * router from a single registry instead of hand-written switch
 * statements). apps/gateway must NEVER hardcode endpoint shapes that
 * differ from this file.
 *
 * Style rules (matching the rest of the contracts package)
 * -------------------------------------------------------
 * - Pure schemas and tiny types; no transport, no fetch, no logger, no
 *   Node / Vite / HTTP-framework imports.
 * - Schemas reuse the existing gateway / health / failures types via
 *   z.lazy references so this module stays a thin declaration layer.
 * - Every breaking change bumps `apiContractVersion` AND the affected
 *   endpoint's `contractVersion` simultaneously.
 *
 * Backwards compatibility
 * -----------------------
 * - Adding a new endpoint is additive (no version bump required as
 *   long as it does not change existing field semantics).
 * - Renaming a path, changing a method, removing a status code, or
 *   removing an endpoint all require a contract bump.
 *
 * GHA-NEXT-002 / GHA-NEXT-006 — new endpoint descriptors and schemas.
 *
 * GHA-NEXT-002 adds the GET /routes endpoint descriptor so the route
 * registry projection becomes a first-class versioned contract.  The
 * response includes capabilities (derived from toolId) and predicates
 * (from the manifest) in addition to the existing safe fields.
 *
 * GHA-NEXT-006 registers the MiniMax TokenPlan bridge endpoints:
 *   POST /provider/minimax-tokenplan/search
 *   POST /provider/minimax-tokenplan/image
 * Both are server-only (publicAccess: false) and are described
 * using the MiniMax bridge request/response wire shapes so the
 * OpenAPI document is complete without leaking CLI internals.
 *
 * Both additions are additive (no existing field semantics change) and
 * keep apiContractVersion at 1.
 *
 * Module layout (split for readability; contracts unchanged):
 *   ./types    — public TS types + apiContractVersion constant
 *   ./schemas  — zod schemas and their inferred TS types
 *   ./routes   — endpoint descriptor constants + httpEndpoints array
 *   ./handlers — registry builder + lookup / listing helpers
 */

export * from "./types";
export * from "./schemas";
export * from "./routes";
export * from "./handlers";
