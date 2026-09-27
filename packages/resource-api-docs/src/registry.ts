import { z } from "zod";
import {
  breakerSnapshotSchema,
  componentHealthSchema,
  errorEnvelopeSchema,
  gatewayRequestSchema,
  gatewayResponseSchema,
  livenessResponseSchema,
  metricsResponseSchema,
  minimaxImageRequestSchema,
  minimaxImageResponseSchema,
  minimaxSearchRequestSchema,
  minimaxSearchResponseSchema,
  memoryAckResponseSchema,
  memoryApproveRequestSchema,
  memoryClearRequestSchema,
  memoryContributionRequestSchema,
  memoryEntryResponseSchema,
  memoryExportResponseSchema,
  memoryListResponseSchema,
  memorySearchRequestSchema,
  memorySearchResponseSchema,
  memorySettingsPatchSchema,
  memorySettingsResponseSchema,
  resourceSearchErrorEnvelopeSchema,
  resourceSearchRequestSchema,
  resourceSearchResponseSchema,
  sessionAppendRequestSchema,
  sessionAppendResponseSchema,
  sessionCreateRequestSchema,
  sessionCreateResponseSchema,
  sessionDeleteRequestSchema,
  sessionDeleteResponseSchema,
  sessionDetailResponseSchema,
  sessionExportRequestSchema,
  sessionExportResponseSchema,
  sessionListResponseSchema,
  sessionPatchResponseSchema,
  sessionPatchSchema,
  readinessResponseSchema,
  routeEntrySchema,
  routeMetricsSchema,
  routesResponseSchema,
} from "@axi/gateway-contracts";
import { convertSchema } from "./zod-to-openapi";

/**
 * Schema registry: maps the `schemaRef` strings declared in
 * `packages/contracts/src/http-api.ts` to their Zod schemas and
 * their generated JSON Schemas.
 *
 * Why a hardcoded registry (not dynamic discovery):
 *   - The `schemaRef` literal type is closed (a discriminated union
 *     in http-api.ts). The compile-time union and the runtime map
 *     stay in lock-step, which is the whole point of moving the
 *     API contract to a versioned registry.
 *   - Lazy / recursive references cannot be auto-discovered; we
 *     pick the canonical wire shape by hand instead.
 *
 * Every entry MUST either:
 *   - resolve to a schema we can convert, OR
 *   - resolve to a schema marked `opaque: true` whose JSON Schema is
 *     a deliberate placeholder, OR
 *   - throw at module load if the contract drifts (zod parse fails).
 */

export interface RegisteredSchema {
  /** Stable name as referenced from `HttpResponseDescriptor.schemaRef`. */
  name: string;
  /** The Zod schema backing the wire shape. */
  zodSchema: z.ZodTypeAny;
  /** Pre-rendered JSON Schema fragment (OpenAPI 3.1 compatible). */
  jsonSchema: Record<string, unknown>;
  /** Short human-readable description used by the OpenAPI `description`
   *  field. */
  description: string;
}

const buildEntry = (
  name: string,
  zodSchema: z.ZodTypeAny,
  description: string,
): RegisteredSchema => ({
  name,
  zodSchema,
  jsonSchema: convertSchema(zodSchema, { name }),
  description,
});

const REGISTRY: Readonly<Record<string, RegisteredSchema>> = {
  GatewayRequest: buildEntry(
    "GatewayRequest",
    gatewayRequestSchema,
    "Versioned gateway dispatcher request envelope. Field shapes match packages/contracts/src/gateway.ts.",
  ),
  GatewayResponse: buildEntry(
    "GatewayResponse",
    gatewayResponseSchema,
    "Versioned gateway dispatcher response envelope. Includes contractVersion, requestId, trace, planner, result, warnings.",
  ),
  LivenessResponse: buildEntry(
    "LivenessResponse",
    livenessResponseSchema,
    "Liveness response — contractVersion, status, uptimeMs.",
  ),
  ReadinessResponse: buildEntry(
    "ReadinessResponse",
    readinessResponseSchema,
    "Readiness response — contractVersion, status, manifestVersion, routeCount, components[].",
  ),
  MetricsResponse: buildEntry(
    "MetricsResponse",
    metricsResponseSchema,
    "Metrics snapshot — contractVersion, manifestVersion, capturedAt, routes[], breakers[].",
  ),
  ErrorEnvelope: buildEntry(
    "ErrorEnvelope",
    errorEnvelopeSchema,
    "Error envelope returned on every non-2xx status. contractVersion, requestId, code, message, details?.",
  ),
  // The OpenAPI document itself is modelled inline in the OpenAPI
  // emitter; we only expose its name here so consumers can request it
  // as a schema reference if they need a self-describing payload.
  OpenApiDocument: {
    name: "OpenApiDocument",
    zodSchema: z.unknown(),
    jsonSchema: {
      type: "object",
      description:
        "OpenAPI 3.1 document root. Recursive $ref pointers to #/components/schemas/* describe the rest.",
      required: ["openapi", "info", "paths"],
      properties: {
        openapi: { type: "string", enum: ["3.1.0"] },
        info: { type: "object", description: "API metadata block." },
        servers: { type: "array", description: "Server base URLs." },
        paths: { type: "object", description: "Path → operation map." },
        components: { type: "object", description: "Reusable schemas, parameters, responses." },
      },
    },
    description: "OpenAPI 3.1 root document.",
  },
  // Reusable sub-schemas so component references stay small.
  ComponentHealth: buildEntry(
    "ComponentHealth",
    componentHealthSchema,
    "One entry of the readiness response's components[] array.",
  ),
  BreakerSnapshot: buildEntry(
    "BreakerSnapshot",
    breakerSnapshotSchema,
    "Circuit breaker state for one target/route pair.",
  ),
  RouteMetrics: buildEntry(
    "RouteMetrics",
    routeMetricsSchema,
    "Per-route counter and latency snapshot.",
  ),
  // GHA-NEXT-002: GET /routes response schema.
  RoutesResponse: buildEntry(
    "RoutesResponse",
    routesResponseSchema,
    "Versioned response for GET /routes — manifest snapshot with capabilities and predicates.",
  ),
  RouteEntry: buildEntry(
    "RouteEntry",
    routeEntrySchema,
    "Single route entry in the RoutesResponse — id, toolId, description, targetIds, loadBalancer, capabilities, predicates.",
  ),
  MemorySettingsPatch: buildEntry(
    "MemorySettingsPatch",
    memorySettingsPatchSchema,
    "Partial local memory settings update.",
  ),
  MemorySettingsResponse: buildEntry(
    "MemorySettingsResponse",
    memorySettingsResponseSchema,
    "Persisted local memory settings response.",
  ),
  MemorySearchRequest: buildEntry(
    "MemorySearchRequest",
    memorySearchRequestSchema,
    "Local memory search request with optional scope, project, kind, and limit.",
  ),
  MemorySearchResponse: buildEntry(
    "MemorySearchResponse",
    memorySearchResponseSchema,
    "Planner-safe active memory search projection, capped at five entries.",
  ),
  MemoryListResponse: buildEntry(
    "MemoryListResponse",
    memoryListResponseSchema,
    "Redacted memory management list response.",
  ),
  MemoryEntryResponse: buildEntry(
    "MemoryEntryResponse",
    memoryEntryResponseSchema,
    "One redacted memory entry response.",
  ),
  MemoryAckResponse: buildEntry(
    "MemoryAckResponse",
    memoryAckResponseSchema,
    "Successful local memory mutation acknowledgement.",
  ),
  MemoryExportResponse: buildEntry(
    "MemoryExportResponse",
    memoryExportResponseSchema,
    "Redacted local memory export response.",
  ),
  MemoryApproveRequest: buildEntry(
    "MemoryApproveRequest",
    memoryApproveRequestSchema,
    "Optional confidence override for approving a memory entry.",
  ),
  MemoryClearRequest: buildEntry(
    "MemoryClearRequest",
    memoryClearRequestSchema,
    "Explicit memory clear scope and confirmation request.",
  ),
  MemoryContributionRequest: buildEntry(
    "MemoryContributionRequest",
    memoryContributionRequestSchema,
    "Redacted post-run memory contribution metadata.",
  ),
  // GHA-NEXT-006: MiniMax TokenPlan bridge schemas.
  MiniMaxSearchRequest: buildEntry(
    "MiniMaxSearchRequest",
    minimaxSearchRequestSchema,
    "Request body for POST /provider/minimax-tokenplan/search — { query: string }.",
  ),
  MiniMaxSearchResponse: buildEntry(
    "MiniMaxSearchResponse",
    minimaxSearchResponseSchema,
    "Response for POST /provider/minimax-tokenplan/search — { ok: true, data: unknown }.",
  ),
  MiniMaxImageRequest: buildEntry(
    "MiniMaxImageRequest",
    minimaxImageRequestSchema,
    "Request body for POST /provider/minimax-tokenplan/image — { prompt, aspectRatio?, n? }.",
  ),
  MiniMaxImageResponse: buildEntry(
    "MiniMaxImageResponse",
    minimaxImageResponseSchema,
    "Response for POST /provider/minimax-tokenplan/image — { ok: true, data: { files: [{file, dataUrl}], source_urls? } }.",
  ),
  SessionListResponse: buildEntry(
    "SessionListResponse",
    sessionListResponseSchema,
    "Redacted session summaries for a browser-local dateKey.",
  ),
  SessionCreateRequest: buildEntry(
    "SessionCreateRequest",
    sessionCreateRequestSchema,
    "Create a daily (idempotent) or manual session.",
  ),
  SessionCreateResponse: buildEntry(
    "SessionCreateResponse",
    sessionCreateResponseSchema,
    "Created or resolved session summary plus a created flag.",
  ),
  SessionDetailResponse: buildEntry(
    "SessionDetailResponse",
    sessionDetailResponseSchema,
    "Redacted session record with entries.",
  ),
  SessionAppendRequest: buildEntry(
    "SessionAppendRequest",
    sessionAppendRequestSchema,
    "Append a user or assistant entry with optional revision CAS.",
  ),
  SessionAppendResponse: buildEntry(
    "SessionAppendResponse",
    sessionAppendResponseSchema,
    "Persisted entry plus updated session summary.",
  ),
  SessionPatch: buildEntry(
    "SessionPatch",
    sessionPatchSchema,
    "Rename or archive a session.",
  ),
  SessionPatchResponse: buildEntry(
    "SessionPatchResponse",
    sessionPatchResponseSchema,
    "Updated session summary after rename or archive.",
  ),
  SessionDeleteRequest: buildEntry(
    "SessionDeleteRequest",
    sessionDeleteRequestSchema,
    "Delete confirmation payload; confirm must be true.",
  ),
  SessionDeleteResponse: buildEntry(
    "SessionDeleteResponse",
    sessionDeleteResponseSchema,
    "Acknowledgement that one session was deleted.",
  ),
  SessionExportRequest: buildEntry(
    "SessionExportRequest",
    sessionExportRequestSchema,
    "Export a single redacted session by id.",
  ),
  SessionExportResponse: buildEntry(
    "SessionExportResponse",
    sessionExportResponseSchema,
    "Redacted session JSON plus exportedAt.",
  ),
  // resource-search/v1 — narrow cross-project contract.
  ResourceSearchRequest: buildEntry(
    "ResourceSearchRequest",
    resourceSearchRequestSchema,
    "Narrow resource-search/v1 request body — query, optional resourceKinds, pageSize, cursor, requestId. contractVersion=1.",
  ),
  ResourceSearchResponse: buildEntry(
    "ResourceSearchResponse",
    resourceSearchResponseSchema,
    "Narrow resource-search/v1 response — contractVersion=1, requestId, mode, state, items, warnings, nextCursor.",
  ),
  ResourceSearchErrorEnvelope: buildEntry(
    "ResourceSearchErrorEnvelope",
    resourceSearchErrorEnvelopeSchema,
    "Narrow resource-search/v1 error envelope — contractVersion=1, requestId, code, message, details?. code ∈ { invalid_request, unauthorized, token_expired, unknown_tool, not_configured, provider_timeout, circuit_open, provider_error, rate_limited, cancelled, internal }.",
  ),
};

export const listRegisteredSchemas = (): ReadonlyArray<RegisteredSchema> =>
  Object.values(REGISTRY);

export const findRegisteredSchema = (name: string): RegisteredSchema | null =>
  REGISTRY[name] ?? null;

/** The canonical schema names this registry exposes. Used by tests
 *  to ensure the registry cannot silently expand. */
export const REGISTERED_SCHEMA_NAMES = Object.keys(REGISTRY).sort();
