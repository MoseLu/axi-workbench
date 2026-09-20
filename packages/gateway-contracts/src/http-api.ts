import { z } from "zod";

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
 */

/**
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
 */

/* ------------------------------------------------------------------ *
 * MiniMax TokenPlan bridge schemas (used by GHA-NEXT-006).           *
 * ------------------------------------------------------------------ */

/** Request body for POST /provider/minimax-tokenplan/search. */
export const minimaxSearchRequestSchema = z.object({
  query: z.string().min(1).max(600).describe("Web-search query string."),
}).strict();
export type MiniMaxSearchRequest = z.infer<typeof minimaxSearchRequestSchema>;

/** Successful response body for POST /provider/minimax-tokenplan/search. */
export const minimaxSearchResponseSchema = z.object({
  ok: z.literal(true),
  data: z.unknown().describe("Parsed JSON returned by the MiniMax TokenPlan CLI search command."),
}).strict();
export type MiniMaxSearchResponse = z.infer<typeof minimaxSearchResponseSchema>;

/** Request body for POST /provider/minimax-tokenplan/image. */
export const minimaxImageRequestSchema = z.object({
  prompt: z.string().min(1).max(600).describe("Image-generation prompt string."),
  aspectRatio: z.enum(["1:1", "16:9", "3:4", "4:3", "9:16"]).optional().describe("Image aspect ratio; defaults to 1:1."),
  n: z.number().int().min(1).max(4).optional().describe("Number of images to generate; defaults to 1."),
}).strict();
export type MiniMaxImageRequest = z.infer<typeof minimaxImageRequestSchema>;

/** Successful response body for POST /provider/minimax-tokenplan/image. */
export const minimaxImageResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    files: z.array(z.object({
      file: z.string().describe("Absolute path to the generated image file."),
      dataUrl: z.string().regex(/^data:image\/(png|jpeg);base64,/u).describe("Base64 data URL for inline embedding."),
    })).describe("Generated image files with inline data URLs."),
    source_urls: z.array(z.string()).optional().describe("Optional source attribution URLs."),
  }).strict(),
}).strict();
export type MiniMaxImageResponse = z.infer<typeof minimaxImageResponseSchema>;

/* ------------------------------------------------------------------ *
 * GET /routes response schema (used by GHA-NEXT-002).                *
 * ------------------------------------------------------------------ */

/** Stable shape of a single route entry returned by GET /routes. */
export const routeEntrySchema = z.object({
  /** Stable route identifier (e.g. "route.image"). */
  id: z.string().min(1).max(120),
  /** Tool this route dispatches (e.g. "resource.search.image"). */
  toolId: z.string().min(1).max(120),
  /** Human-readable description from the manifest. */
  description: z.string().max(400),
  /** Target adapter identifiers in load-balance order. */
  targetIds: z.array(z.string().min(1).max(200)).min(1).max(32),
  /** Load-balancer strategy for this route. */
  loadBalancer: z.string().max(40),
  /** Capabilities this route supports (search / inspect / preview / generate). */
  capabilities: z.array(z.enum(["search", "inspect", "preview", "generate"])).min(1).max(8),
  /** Predicate identifiers that must all match for this route to be selected. */
  predicates: z.array(z.string().min(1).max(80)).max(16),
}).strict();
export type RouteEntry = z.infer<typeof routeEntrySchema>;

/** Stable response for GET /routes. */
export const routesResponseSchema = z.object({
  /** Manifest version the route snapshot was built from. */
  manifestVersion: z.number().int().min(0).max(1000),
  /** ISO-8601 wall-clock timestamp of snapshot capture. */
  capturedAt: z.string().datetime(),
  /** All registered routes in arbitrary order. */
  routes: z.array(routeEntrySchema).max(1024),
}).strict();
export type RoutesResponse = z.infer<typeof routesResponseSchema>;

export const apiContractVersion = 1 as const;

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

export const httpMediaTypeSchema = z.enum([
  "application/json",
  "application/problem+json",
  "text/html; charset=utf-8",
  "text/plain; charset=utf-8",
]);
export type HttpMediaType = z.infer<typeof httpMediaTypeSchema>;

export const httpHeaderDescriptorSchema = z.object({
  name: z.string().min(1).max(120),
  required: z.boolean(),
  description: z.string().min(1).max(400),
});
export type HttpHeaderDescriptor = z.infer<typeof httpHeaderDescriptorSchema>;

export const successStatusCodeSchema = z.union([
  z.literal(200),
  z.literal(201),
  z.literal(202),
  z.literal(204),
]);
export type SuccessStatusCode = z.infer<typeof successStatusCodeSchema>;

export const endpointErrorStatusSchema = z.object({
  status: z.number().int().min(400).max(599),
  errorCodes: z.array(z.string().min(1).max(40)).min(1).max(16),
  description: z.string().min(1).max(400),
});
export type EndpointErrorStatus = z.infer<typeof endpointErrorStatusSchema>;

export const httpRequestDescriptorSchema = z.object({
  schemaRef: z.enum([
    "GatewayRequest",
    "ResourceSearchRequest",
    "MiniMaxSearchRequest",
    "MiniMaxImageRequest",
    "MemorySettingsPatch",
    "MemorySearchRequest",
    "MemoryApproveRequest",
    "MemoryClearRequest",
    "MemoryContributionRequest",
    "SessionCreateRequest",
    "SessionAppendRequest",
    "SessionPatch",
    "SessionDeleteRequest",
    "SessionExportRequest",
  ]).optional(),
  contentType: httpMediaTypeSchema.default("application/json"),
  required: z.boolean().default(true),
  headers: z.array(httpHeaderDescriptorSchema).max(16).default([]),
  description: z.string().min(1).max(800),
});
export type HttpRequestDescriptor = z.infer<typeof httpRequestDescriptorSchema>;

export const httpResponseDescriptorSchema = z.object({
  schemaRef: z.enum([
    "GatewayResponse",
    "ResourceSearchResponse",
    "LivenessResponse",
    "ReadinessResponse",
    "MetricsResponse",
    "OpenApiDocument",
    "RoutesResponse",
    "MiniMaxSearchResponse",
    "MiniMaxImageResponse",
    "MemorySettingsResponse",
    "MemorySearchResponse",
    "MemoryListResponse",
    "MemoryEntryResponse",
    "MemoryAckResponse",
    "MemoryExportResponse",
    "SessionListResponse",
    "SessionCreateResponse",
    "SessionDetailResponse",
    "SessionAppendResponse",
    "SessionPatchResponse",
    "SessionDeleteResponse",
    "SessionExportResponse",
  ]),
  contentType: httpMediaTypeSchema.default("application/json"),
  description: z.string().min(1).max(800),
});
export type HttpResponseDescriptor = z.infer<typeof httpResponseDescriptorSchema>;

export const httpPathParameterSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9._-]+$/u),
  required: z.literal(true),
  description: z.string().min(1).max(400),
}).strict();
export type HttpPathParameter = z.infer<typeof httpPathParameterSchema>;

export const httpQueryParameterSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9._-]+$/u),
  required: z.boolean(),
  description: z.string().min(1).max(400),
}).strict();
export type HttpQueryParameter = z.infer<typeof httpQueryParameterSchema>;

export const httpEndpointDescriptorSchema = z.object({
  id: z.enum([
    "gateway.run",
    "resource.search",
    "health.live",
    "health.ready",
    "metrics",
    "openapi.json",
    "docs",
    "routes",
    "minimax-tokenplan.search",
    "minimax-tokenplan.image",
    "memory.settings.get",
    "memory.settings.patch",
    "memory.search",
    "memory.entries.list",
    "memory.entry.approve",
    "memory.entry.reject",
    "memory.entry.delete",
    "memory.export",
    "memory.clear",
    "memory.contribute",
    "session.list",
    "session.create",
    "session.get",
    "session.append",
    "session.patch",
    "session.delete",
    "session.export",
  ]),
  method: httpMethodSchema,
  path: z.string().regex(/^\/[A-Za-z0-9._/{}-]+$/u, "path must start with / and contain only [A-Za-z0-9._/{}-]"),
  contractVersion: z.literal(apiContractVersion),
  summary: z.string().min(1).max(160),
  description: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).min(1).max(8),
  publicAccess: z.boolean(),
  successStatus: successStatusCodeSchema,
  request: httpRequestDescriptorSchema.optional(),
  pathParameters: z.array(httpPathParameterSchema).max(8).optional(),
  queryParameters: z.array(httpQueryParameterSchema).max(16).optional(),
  response: httpResponseDescriptorSchema,
  errorStatusCodes: z.array(endpointErrorStatusSchema).min(1).max(16),
}).strict().superRefine((value, ctx) => {
  if (value.method === "GET") {
    if (value.id === "gateway.run") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POST-only endpoint must not be declared as GET",
        path: ["method"],
      });
    }
    if (value.request?.required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GET endpoints must not declare a required request body",
        path: ["request", "required"],
      });
    }
  }
  if (value.method === "POST" && !value.request) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "POST endpoints must declare a request descriptor",
      path: ["request"],
    });
  }
  const placeholders = [...value.path.matchAll(/\{([A-Za-z0-9._-]+)\}/gu)].map((match) => match[1]);
  const declaredParameters = new Set((value.pathParameters ?? []).map((parameter) => parameter.name));
  for (const name of placeholders) {
    if (!declaredParameters.has(name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `path parameter {${name}} must be declared`,
        path: ["pathParameters"],
      });
    }
  }
  for (const name of declaredParameters) {
    if (!placeholders.includes(name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `path parameter ${name} is not present in path`,
        path: ["pathParameters"],
      });
    }
  }
  if (value.id === "openapi.json" && value.response.schemaRef !== "OpenApiDocument") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "/openapi.json must respond with OpenApiDocument",
      path: ["response", "schemaRef"],
    });
  }
  if (value.id === "docs" && value.response.contentType !== "text/html; charset=utf-8") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "/docs must respond with text/html; charset=utf-8",
      path: ["response", "contentType"],
    });
  }
});
export type HttpEndpointDescriptor = z.infer<typeof httpEndpointDescriptorSchema>;

export const httpEndpointRegistrySchema = z.object({
  contractVersion: z.literal(apiContractVersion),
  endpoints: z.array(httpEndpointDescriptorSchema).min(1).max(64),
}).strict().superRefine((value, ctx) => {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const [index, endpoint] of value.endpoints.entries()) {
    if (seenIds.has(endpoint.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate endpoint id: ${endpoint.id}`,
        path: ["endpoints", index, "id"],
      });
    }
    seenIds.add(endpoint.id);
    const pathKey = `${endpoint.method} ${endpoint.path}`;
    if (seenPaths.has(pathKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate endpoint path: ${pathKey}`,
        path: ["endpoints", index, "path"],
      });
    }
    seenPaths.add(pathKey);
  }
});
export type HttpEndpointRegistry = z.infer<typeof httpEndpointRegistrySchema>;

/* ------------------------------------------------------------------ *
 * Endpoint descriptors — one constant per endpoint.                  *
 * ------------------------------------------------------------------ */

export const gatewayRunEndpoint: HttpEndpointDescriptor = {
  id: "gateway.run",
  method: "POST",
  path: "/gateway/run",
  contractVersion: apiContractVersion,
  summary: "Run a planner output through the gateway dispatcher.",
  description:
    "Accepts a versioned planner output, validates it against the planner contract, " +
    "applies route policy (timeout, retry, backpressure, breaker, cache, coalescing), " +
    "and returns either a GatewayResponse or an ErrorEnvelope. The browser is the " +
    "intended caller; arbitrary planner shapes are rejected with `invalid_request`.",
  tags: ["gateway", "dispatch"],
  publicAccess: true,
  successStatus: 200,
  request: {
    schemaRef: "GatewayRequest",
    contentType: "application/json",
    required: true,
    headers: [
      { name: "X-Request-Id", required: false, description: "Caller-supplied request id; otherwise the gateway mints one." },
    ],
    description: "GatewayRequest — `{ planner, requestId?, fromCacheOnly? }`.",
  },
  response: {
    schemaRef: "GatewayResponse",
    contentType: "application/json",
    description: "GatewayResponse — includes contractVersion, requestId, trace, planner, result, warnings.",
  },
  errorStatusCodes: [
    { status: 400, errorCodes: ["invalid_request"], description: "Request body was not valid JSON, did not match GatewayRequest, or exceeded the size limit." },
    { status: 404, errorCodes: ["unknown_tool"], description: "Referenced toolId is not registered in the manifest." },
    { status: 429, errorCodes: ["rate_limited"], description: "Backpressure queue rejected the request (queue_full / queue_timeout / shed_strategy)." },
    { status: 499, errorCodes: ["cancelled"], description: "Caller aborted before the dispatcher finished." },
    { status: 500, errorCodes: ["internal"], description: "Unexpected server error in the dispatch path." },
    { status: 502, errorCodes: ["provider_error"], description: "Upstream provider returned 4xx / 5xx / network error after retries." },
    { status: 503, errorCodes: ["not_configured", "circuit_open"], description: "Required provider is missing config OR its breaker is open." },
    { status: 504, errorCodes: ["provider_timeout"], description: "Provider exceeded the route timeout policy." },
  ],
};

export const healthLiveEndpoint: HttpEndpointDescriptor = {
  id: "health.live",
  method: "GET",
  path: "/health/live",
  contractVersion: apiContractVersion,
  summary: "Process liveness probe.",
  description:
    "Returns LivenessResponse as long as the Node process is responsive. Does NOT " +
    "check providers, manifest or breaker state. Suitable for Kubernetes livenessProbe.",
  tags: ["health", "ops"],
  publicAccess: true,
  successStatus: 200,
  response: {
    schemaRef: "LivenessResponse",
    contentType: "application/json",
    description: "LivenessResponse — `{ contractVersion, status: 'ok', uptimeMs }`.",
  },
  errorStatusCodes: [
    { status: 500, errorCodes: ["internal"], description: "Process is in a fatal state; expect the orchestrator to restart." },
  ],
};

export const healthReadyEndpoint: HttpEndpointDescriptor = {
  id: "health.ready",
  method: "GET",
  path: "/health/ready",
  contractVersion: apiContractVersion,
  summary: "Readiness probe — composition root finished and providers registered.",
  description:
    "Returns ReadinessResponse with status='ready' when the manifest is loaded, the " +
    "registry is populated, and every required provider is reachable. Returns 503 " +
    "with status='not_ready' otherwise. Suitable for Kubernetes readinessProbe.",
  tags: ["health", "ops"],
  publicAccess: true,
  successStatus: 200,
  response: {
    schemaRef: "ReadinessResponse",
    contentType: "application/json",
    description: "ReadinessResponse — `{ contractVersion, status, manifestVersion, routeCount, components[] }`.",
  },
  errorStatusCodes: [
    { status: 500, errorCodes: ["internal"], description: "Readiness evaluation threw; treat as not-ready." },
    { status: 503, errorCodes: ["not_configured", "circuit_open"], description: "Composition root not finished or a required component is down." },
  ],
};

export const metricsEndpoint: HttpEndpointDescriptor = {
  id: "metrics",
  method: "GET",
  path: "/metrics",
  contractVersion: apiContractVersion,
  summary: "Metrics snapshot — per-route counters and per-target breaker state.",
  description:
    "Returns MetricsResponse with one entry per active route (requestCount, cacheHitCount, " +
    "coalescedCount, failureCounts, p50/p95/p99) plus one entry per breaker (state, samples, " +
    "errors, openedAt). No secrets, no query text, no provider payloads.",
  tags: ["health", "ops"],
  publicAccess: true,
  successStatus: 200,
  response: {
    schemaRef: "MetricsResponse",
    contentType: "application/json",
    description: "MetricsResponse — `{ contractVersion, manifestVersion, capturedAt, routes[], breakers[] }`.",
  },
  errorStatusCodes: [
    { status: 500, errorCodes: ["internal"], description: "Metrics collector threw; do not alert on missing samples, treat the probe as failed." },
  ],
};

export const openapiJsonEndpoint: HttpEndpointDescriptor = {
  id: "openapi.json",
  method: "GET",
  path: "/openapi.json",
  contractVersion: apiContractVersion,
  summary: "OpenAPI 3.1 document — generated from the endpoint registry.",
  description:
    "Returns the OpenAPI document that describes every endpoint in the registry, " +
    "including `$ref`s to the schemas declared in packages/contracts. Stable URL " +
    "so monitoring, client SDKs, and postman collections can pin against it.",
  tags: ["docs"],
  publicAccess: true,
  successStatus: 200,
  response: {
    schemaRef: "OpenApiDocument",
    contentType: "application/json",
    description: "OpenApiDocument — OpenAPI 3.1 root object (`openapi`, `info`, `paths`, `components`).",
  },
  errorStatusCodes: [
    { status: 500, errorCodes: ["internal"], description: "OpenAPI generator threw; do not serve a partial document." },
  ],
};

export const docsEndpoint: HttpEndpointDescriptor = {
  id: "docs",
  method: "GET",
  path: "/docs",
  contractVersion: apiContractVersion,
  summary: "Human-readable API documentation page.",
  description:
    "Returns an HTML page that renders the OpenAPI document served at /openapi.json. " +
    "No JS dependency on the gateway runtime; the page only fetches /openapi.json.",
  tags: ["docs"],
  publicAccess: true,
  successStatus: 200,
  response: {
    schemaRef: "OpenApiDocument",
    contentType: "text/html; charset=utf-8",
    description: "Static HTML bootstrap that loads /openapi.json and renders it via the chosen UI library.",
  },
  errorStatusCodes: [
    { status: 500, errorCodes: ["internal"], description: "HTML asset missing or template rendering failed." },
  ],
};

/** GHA-NEXT-002 — GET /routes (versioned contract). */
export const routesEndpoint: HttpEndpointDescriptor = {
  id: "routes",
  method: "GET",
  path: "/routes",
  contractVersion: apiContractVersion,
  summary: "Safe route registry projection — manifest snapshot with capabilities and predicates.",
  description:
    "Returns a RoutesResponse containing every registered route with its id, toolId, " +
    "description, targetIds, loadBalancer, capabilities (search / inspect / preview / generate, " +
    "derived from the toolId), and predicate identifiers from the manifest. " +
    "No adapter URLs, secrets, query text, or provider payloads are included.",
  tags: ["gateway", "ops"],
  publicAccess: true,
  successStatus: 200,
  response: {
    schemaRef: "RoutesResponse",
    contentType: "application/json",
    description: "RoutesResponse — { manifestVersion, capturedAt, routes[] }.",
  },
  errorStatusCodes: [
    { status: 500, errorCodes: ["internal"], description: "Route registry evaluation threw; treat as not-ready." },
    { status: 503, errorCodes: ["not_configured"], description: "Composition root not finished or server is draining." },
  ],
};

/* MEM-MVP-003 — local-first memory HTTP surface. The gateway keeps these
 * endpoints behind the same auth/CORS boundary as /gateway/run. */
const memoryRequestHeaders = [
  { name: "X-Request-Id", required: false, description: "Caller-supplied id; otherwise the gateway mints one." },
];
const memoryErrorStatuses = [
  { status: 400, errorCodes: ["invalid_request"], description: "The memory request body, project scope, or confirmation value is invalid." },
  { status: 401, errorCodes: ["unauthorized", "token_expired"], description: "The gateway rejected the caller credential." },
  { status: 500, errorCodes: ["internal"], description: "The local memory store or handler failed without exposing its path." },
];

export const memorySettingsGetEndpoint: HttpEndpointDescriptor = {
  id: "memory.settings.get",
  method: "GET",
  path: "/memory/settings",
  contractVersion: apiContractVersion,
  summary: "Read local memory settings.",
  description: "Returns the persisted user-controlled switches for reading, generating, external-context protection, and default scope.",
  tags: ["memory", "settings"],
  publicAccess: true,
  successStatus: 200,
  response: { schemaRef: "MemorySettingsResponse", contentType: "application/json", description: "MemorySettingsResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memorySettingsPatchEndpoint: HttpEndpointDescriptor = {
  id: "memory.settings.patch",
  method: "PATCH",
  path: "/memory/settings",
  contractVersion: apiContractVersion,
  summary: "Update local memory settings.",
  description: "Atomically persists a partial MemorySettings patch. The server resolves project identifiers from its registered project set.",
  tags: ["memory", "settings"],
  publicAccess: true,
  successStatus: 200,
  request: { schemaRef: "MemorySettingsPatch", contentType: "application/json", required: true, headers: memoryRequestHeaders, description: "MemorySettingsPatch." },
  response: { schemaRef: "MemorySettingsResponse", contentType: "application/json", description: "Updated MemorySettingsResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memorySearchEndpoint: HttpEndpointDescriptor = {
  id: "memory.search",
  method: "POST",
  path: "/memory/search",
  contractVersion: apiContractVersion,
  summary: "Search active local memories.",
  description: "Ranks at most five active, non-expired memory projections. When useMemory is off it returns an empty list without blocking the resource request.",
  tags: ["memory", "search"],
  publicAccess: true,
  successStatus: 200,
  request: { schemaRef: "MemorySearchRequest", contentType: "application/json", required: true, headers: memoryRequestHeaders, description: "MemorySearchRequest." },
  response: { schemaRef: "MemorySearchResponse", contentType: "application/json", description: "MemorySearchResponse with planner-safe projections." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryEntriesListEndpoint: HttpEndpointDescriptor = {
  id: "memory.entries.list",
  method: "GET",
  path: "/memory/entries",
  contractVersion: apiContractVersion,
  summary: "List redacted local memory entries.",
  description: "Returns the user-visible memory management projection. Store paths, evidence hashes, provider payloads, and blocked entries are never returned.",
  tags: ["memory", "management"],
  publicAccess: true,
  successStatus: 200,
  response: { schemaRef: "MemoryListResponse", contentType: "application/json", description: "MemoryListResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryEntryApproveEndpoint: HttpEndpointDescriptor = {
  id: "memory.entry.approve",
  method: "POST",
  path: "/memory/entries/{id}/approve",
  contractVersion: apiContractVersion,
  summary: "Approve a pending memory entry.",
  description: "Promotes one pending entry to active without allowing the caller to replace its summary or facts.",
  tags: ["memory", "management"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque memory entry id." }],
  request: { schemaRef: "MemoryApproveRequest", contentType: "application/json", required: true, headers: memoryRequestHeaders, description: "Optional confidence override." },
  response: { schemaRef: "MemoryEntryResponse", contentType: "application/json", description: "The approved MemoryEntryResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryEntryRejectEndpoint: HttpEndpointDescriptor = {
  id: "memory.entry.reject",
  method: "POST",
  path: "/memory/entries/{id}/reject",
  contractVersion: apiContractVersion,
  summary: "Reject a pending memory entry.",
  description: "Deletes one pending memory entry. The request body is ignored and exists only to keep the HTTP operation shape explicit.",
  tags: ["memory", "management"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque memory entry id." }],
  request: { contentType: "application/json", required: false, headers: memoryRequestHeaders, description: "Optional empty JSON object; ignored." },
  response: { schemaRef: "MemoryAckResponse", contentType: "application/json", description: "MemoryAckResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryEntryDeleteEndpoint: HttpEndpointDescriptor = {
  id: "memory.entry.delete",
  method: "DELETE",
  path: "/memory/entries/{id}",
  contractVersion: apiContractVersion,
  summary: "Delete a local memory entry.",
  description: "Idempotently removes one entry by its opaque id.",
  tags: ["memory", "management"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque memory entry id." }],
  response: { schemaRef: "MemoryAckResponse", contentType: "application/json", description: "MemoryAckResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryExportEndpoint: HttpEndpointDescriptor = {
  id: "memory.export",
  method: "POST",
  path: "/memory/export",
  contractVersion: apiContractVersion,
  summary: "Export redacted local memories.",
  description: "Returns a schema-validated JSON export containing only the public memory projection. The storage path is never included.",
  tags: ["memory", "management"],
  publicAccess: true,
  successStatus: 200,
  request: { contentType: "application/json", required: false, headers: memoryRequestHeaders, description: "Optional empty JSON object." },
  response: { schemaRef: "MemoryExportResponse", contentType: "application/json", description: "MemoryExportResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryClearEndpoint: HttpEndpointDescriptor = {
  id: "memory.clear",
  method: "POST",
  path: "/memory/clear",
  contractVersion: apiContractVersion,
  summary: "Clear memories in an explicit scope.",
  description: "Requires confirm=true and an explicit global or registered project scope; broad implicit deletion is not supported.",
  tags: ["memory", "management"],
  publicAccess: true,
  successStatus: 200,
  request: { schemaRef: "MemoryClearRequest", contentType: "application/json", required: true, headers: memoryRequestHeaders, description: "MemoryClearRequest." },
  response: { schemaRef: "MemoryAckResponse", contentType: "application/json", description: "MemoryAckResponse." },
  errorStatusCodes: memoryErrorStatuses,
};

export const memoryContributionEndpoint: HttpEndpointDescriptor = {
  id: "memory.contribute",
  method: "POST",
  path: "/memory/contribute",
  contractVersion: apiContractVersion,
  summary: "Schedule a policy-checked memory contribution.",
  description: "Accepts a redacted post-run summary and schedules server-side extraction after the idle window. Failed, cancelled, and protected external-context runs are skipped.",
  tags: ["memory", "generation"],
  publicAccess: true,
  successStatus: 200,
  request: { schemaRef: "MemoryContributionRequest", contentType: "application/json", required: true, headers: memoryRequestHeaders, description: "MemoryContributionRequest." },
  response: { schemaRef: "MemoryAckResponse", contentType: "application/json", description: "MemoryAckResponse; scheduling status is carried in response headers." },
  errorStatusCodes: memoryErrorStatuses,
};

/** GHA-NEXT-006 — POST /provider/minimax-tokenplan/search (MiniMax TokenPlan web-search bridge). */
export const minimaxSearchEndpoint: HttpEndpointDescriptor = {
  id: "minimax-tokenplan.search",
  method: "POST",
  path: "/provider/minimax-tokenplan/search",
  contractVersion: apiContractVersion,
  summary: "MiniMax TokenPlan web search via local CLI bridge.",
  description:
    "Validates the request body against MiniMaxSearchRequest, forwards to the " +
    "MiniMax TokenPlan CLI binary (search subcommand), and returns the parsed JSON output. " +
    "This endpoint is server-only (publicAccess: false); the gateway server reads " +
    "MINIMAX_TOKENPLAN_CLI and MINIMAX_MCP_BASE_PATH from the environment.",
  tags: ["gateway", "provider", "minimax"],
  publicAccess: false,
  successStatus: 200,
  request: {
    schemaRef: "MiniMaxSearchRequest",
    contentType: "application/json",
    required: true,
    headers: [
      { name: "X-Request-Id", required: false, description: "Caller-supplied request id; otherwise the gateway mints one." },
    ],
    description: "MiniMaxSearchRequest — { query: string }.",
  },
  response: {
    schemaRef: "MiniMaxSearchResponse",
    contentType: "application/json",
    description: "MiniMaxSearchResponse — { ok: true, data: unknown }.",
  },
  errorStatusCodes: [
    { status: 400, errorCodes: ["invalid_request"], description: "Request body was not valid JSON, exceeded the size limit, or query was empty." },
    { status: 499, errorCodes: ["cancelled"], description: "Caller aborted before the bridge finished." },
    { status: 500, errorCodes: ["internal"], description: "Unexpected server error in the bridge path." },
    { status: 502, errorCodes: ["provider_error"], description: "MiniMax CLI returned non-JSON output or exited with a non-zero status." },
    { status: 503, errorCodes: ["not_configured"], description: "MiniMax bridge is not configured or server is draining." },
    { status: 504, errorCodes: ["provider_timeout"], description: "MiniMax CLI search exceeded the configured timeout." },
  ],
};

/** GHA-NEXT-006 — POST /provider/minimax-tokenplan/image (MiniMax TokenPlan image-generation bridge). */
export const minimaxImageEndpoint: HttpEndpointDescriptor = {
  id: "minimax-tokenplan.image",
  method: "POST",
  path: "/provider/minimax-tokenplan/image",
  contractVersion: apiContractVersion,
  summary: "MiniMax TokenPlan image generation via local CLI bridge.",
  description:
    "Validates the request body against MiniMaxImageRequest, forwards to the " +
    "MiniMax TokenPlan CLI binary (image subcommand), reads the generated files " +
    "from the allow-listed output directory, and returns them as base64 data URLs. " +
    "This endpoint is server-only (publicAccess: false); the gateway server reads " +
    "MINIMAX_TOKENPLAN_CLI, MINIMAX_MCP_BASE_PATH, and MINIMAX_OUTPUT_DIR from the environment.",
  tags: ["gateway", "provider", "minimax"],
  publicAccess: false,
  successStatus: 200,
  request: {
    schemaRef: "MiniMaxImageRequest",
    contentType: "application/json",
    required: true,
    headers: [
      { name: "X-Request-Id", required: false, description: "Caller-supplied request id; otherwise the gateway mints one." },
    ],
    description: "MiniMaxImageRequest — { prompt: string, aspectRatio?: string, n?: number }.",
  },
  response: {
    schemaRef: "MiniMaxImageResponse",
    contentType: "application/json",
    description: "MiniMaxImageResponse — { ok: true, data: { files: [{file, dataUrl}], source_urls? } }.",
  },
  errorStatusCodes: [
    { status: 400, errorCodes: ["invalid_request"], description: "Request body was not valid JSON, exceeded the size limit, prompt was empty, or aspectRatio/n was invalid." },
    { status: 499, errorCodes: ["cancelled"], description: "Caller aborted before the bridge finished." },
    { status: 500, errorCodes: ["internal"], description: "Unexpected server error in the bridge path." },
    { status: 502, errorCodes: ["provider_error"], description: "MiniMax CLI returned non-JSON output, exited with a non-zero status, or generated a file outside the allow-list." },
    { status: 503, errorCodes: ["not_configured"], description: "MiniMax bridge is not configured or server is draining." },
    { status: 504, errorCodes: ["provider_timeout"], description: "MiniMax CLI image generation exceeded the configured timeout." },
  ],
};

/* SES-MVP-003 — session HTTP surface. The gateway keeps these endpoints
 * behind the same auth/CORS/request-id/body-limit envelope as the memory
 * surface. Daily idempotency is enforced server-side; browser code never
 * decides whether a daily session already exists. */
const sessionRequestHeaders = [
  { name: "X-Request-Id", required: false, description: "Caller-supplied id; otherwise the gateway mints one." },
];
const sessionErrorStatuses = [
  { status: 400, errorCodes: ["invalid_request"], description: "The session request body, dateKey, projectId, sessionId, revision or role/outcome was invalid." },
  { status: 401, errorCodes: ["unauthorized", "token_expired"], description: "The gateway rejected the caller credential." },
  { status: 404, errorCodes: ["session_not_found"], description: "The session id does not exist or was already deleted." },
  { status: 409, errorCodes: ["session_conflict"], description: "An append or mutation lost a revision race; the client must re-read the session and retry." },
  { status: 413, errorCodes: ["session_limit"], description: "A session, entry or text exceeded the local MVP cap." },
  { status: 503, errorCodes: ["session_store_unavailable"], description: "The local session store failed without leaking its path." },
];

export const sessionListEndpoint: HttpEndpointDescriptor = {
  id: "session.list",
  method: "GET",
  path: "/sessions",
  contractVersion: apiContractVersion,
  summary: "List sessions for a browser-local date key.",
  description: "Returns deterministic summaries for the dateKey. Sessions are grouped by dateKey desc, updatedAt desc, sessionId asc. The response is a redacted projection that never includes raw provider payloads.",
  tags: ["session", "list"],
  publicAccess: true,
  successStatus: 200,
  queryParameters: [
    { name: "dateKey", required: true, description: "Browser-local YYYY-MM-DD date key." },
    { name: "timezoneOffsetMinutes", required: false, description: "Diagnostic-only browser UTC offset, range -840..840." },
  ],
  response: { schemaRef: "SessionListResponse", contentType: "application/json", description: "SessionListResponse with deterministic summary ordering." },
  errorStatusCodes: sessionErrorStatuses,
};

export const sessionCreateEndpoint: HttpEndpointDescriptor = {
  id: "session.create",
  method: "POST",
  path: "/sessions",
  contractVersion: apiContractVersion,
  summary: "Create or resolve a daily session (idempotent) or a manual session.",
  description: "Server-side guarantees that for one projectId+dateKey+kind=daily there is exactly one session; concurrent first-send requests get the same id. Manual sessions may be created multiple times per day.",
  tags: ["session", "create"],
  publicAccess: true,
  successStatus: 200,
  request: { schemaRef: "SessionCreateRequest", contentType: "application/json", required: true, headers: sessionRequestHeaders, description: "SessionCreateRequest." },
  response: { schemaRef: "SessionCreateResponse", contentType: "application/json", description: "SessionCreateResponse with `created: true|false`." },
  errorStatusCodes: sessionErrorStatuses,
};

export const sessionGetEndpoint: HttpEndpointDescriptor = {
  id: "session.get",
  method: "GET",
  path: "/sessions/{id}",
  contractVersion: apiContractVersion,
  summary: "Read a session detail (redacted projection).",
  description: "Returns the full record after server-side redaction. Store paths, raw provider payloads, tokens, cookies, data URLs and absolute paths are never returned.",
  tags: ["session", "detail"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque session id (ses_ prefix)." }],
  response: { schemaRef: "SessionDetailResponse", contentType: "application/json", description: "SessionDetailResponse with redacted record." },
  errorStatusCodes: sessionErrorStatuses,
};

export const sessionAppendEndpoint: HttpEndpointDescriptor = {
  id: "session.append",
  method: "POST",
  path: "/sessions/{id}/entries",
  contractVersion: apiContractVersion,
  summary: "Append a user/assistant entry with optional revision CAS.",
  description: "Used both for hydration and for live persistence. expectedRevision is honored when supplied; conflict returns 409 session_conflict. Result snapshots are only allowed on assistant entries.",
  tags: ["session", "append"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque session id (ses_ prefix)." }],
  request: { schemaRef: "SessionAppendRequest", contentType: "application/json", required: true, headers: sessionRequestHeaders, description: "SessionAppendRequest." },
  response: { schemaRef: "SessionAppendResponse", contentType: "application/json", description: "SessionAppendResponse with the persisted entry and updated summary." },
  errorStatusCodes: sessionErrorStatuses,
};

export const sessionPatchEndpoint: HttpEndpointDescriptor = {
  id: "session.patch",
  method: "PATCH",
  path: "/sessions/{id}",
  contractVersion: apiContractVersion,
  summary: "Rename or archive a session.",
  description: "Used for user-driven metadata edits. expectedRevision is honored when supplied.",
  tags: ["session", "patch"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque session id (ses_ prefix)." }],
  request: { schemaRef: "SessionPatch", contentType: "application/json", required: true, headers: sessionRequestHeaders, description: "SessionPatch." },
  response: { schemaRef: "SessionPatchResponse", contentType: "application/json", description: "SessionPatchResponse." },
  errorStatusCodes: sessionErrorStatuses,
};

export const sessionDeleteEndpoint: HttpEndpointDescriptor = {
  id: "session.delete",
  method: "DELETE",
  path: "/sessions/{id}",
  contractVersion: apiContractVersion,
  summary: "Delete a session (must include confirm=true).",
  description: "No bulk delete shortcut is provided. expectedRevision is honored when supplied.",
  tags: ["session", "delete"],
  publicAccess: true,
  successStatus: 200,
  pathParameters: [{ name: "id", required: true, description: "Opaque session id (ses_ prefix)." }],
  request: { schemaRef: "SessionDeleteRequest", contentType: "application/json", required: true, headers: sessionRequestHeaders, description: "SessionDeleteRequest { confirm: true, expectedRevision? }." },
  response: { schemaRef: "SessionDeleteResponse", contentType: "application/json", description: "SessionDeleteResponse." },
  errorStatusCodes: sessionErrorStatuses,
};

export const sessionExportEndpoint: HttpEndpointDescriptor = {
  id: "session.export",
  method: "POST",
  path: "/sessions/export",
  contractVersion: apiContractVersion,
  summary: "Export a single redacted session JSON.",
  description: "Returns a redacted record projection suitable for download. Store paths, secrets, raw provider payloads and absolute paths are never exported.",
  tags: ["session", "export"],
  publicAccess: true,
  successStatus: 200,
  request: { schemaRef: "SessionExportRequest", contentType: "application/json", required: true, headers: sessionRequestHeaders, description: "SessionExportRequest." },
  response: { schemaRef: "SessionExportResponse", contentType: "application/json", description: "SessionExportResponse." },
  errorStatusCodes: sessionErrorStatuses,
};

/**
 * resource-search/v1 — narrow cross-project contract. Replaces
 * `/gateway/run` as the stable interop surface for downstream products
 * (Soul BFF, Workbench BFF, Agent Platform). The internal planner
 * surface stays at `/gateway/run`; this one is for everything that
 * only wants the projected DTO. See ADR-005/006 + the resource-search
 * ADR for the full rationale.
 */
export const resourceSearchEndpoint: HttpEndpointDescriptor = {
  id: "resource.search",
  method: "POST",
  path: "/resource/search",
  contractVersion: apiContractVersion,
  summary: "Cross-project resource search (narrow v1 contract).",
  description:
    "Accepts a narrowed ResourceSearchRequest body and returns a fixed " +
    "ResourceSearchResponse envelope. Items never carry safety=blocked; " +
    "the narrow error envelope uses the cross-project error codes. Same " +
    "auth posture as /gateway/run (service token via decideAuthFromRequest).",
  tags: ["gateway", "resource-search", "interop"],
  publicAccess: true,
  successStatus: 200,
  request: {
    schemaRef: "ResourceSearchRequest",
    contentType: "application/json",
    required: true,
    headers: [
      { name: "Authorization", required: false, description: "Service token when GATEWAY_API_KEYS is configured." },
      { name: "X-Request-Id", required: false, description: "Caller-supplied request id; otherwise the gateway mints one." },
    ],
    description: "ResourceSearchRequest — `{ contractVersion: 1, requestId?, query, resourceKinds?, pageSize?, cursor? }`.",
  },
  response: {
    schemaRef: "ResourceSearchResponse",
    contentType: "application/json",
    description: "ResourceSearchResponse — `{ contractVersion: 1, requestId, mode, state, items, warnings, nextCursor? }`.",
  },
  errorStatusCodes: [
    { status: 400, errorCodes: ["invalid_request"], description: "Body did not match ResourceSearchRequest, exceeded size limit, or contained unknown kinds." },
    { status: 401, errorCodes: ["unauthorized", "token_expired"], description: "Missing or invalid Authorization header when the gateway auth gate is configured." },
    { status: 404, errorCodes: ["unknown_tool"], description: "No registered route matches the requested resourceKind." },
    { status: 429, errorCodes: ["rate_limited"], description: "Backpressure queue rejected the request." },
    { status: 499, errorCodes: ["cancelled"], description: "Caller aborted before the dispatcher finished." },
    { status: 502, errorCodes: ["provider_error"], description: "Upstream provider returned 4xx / 5xx / network error after retries." },
    { status: 503, errorCodes: ["not_configured", "circuit_open"], description: "Composition root is missing, required provider has no config, or its breaker is open." },
    { status: 504, errorCodes: ["provider_timeout"], description: "Provider exceeded the route timeout policy." },
  ],
};

export const httpEndpoints = [
  gatewayRunEndpoint,
  resourceSearchEndpoint,
  healthLiveEndpoint,
  healthReadyEndpoint,
  metricsEndpoint,
  openapiJsonEndpoint,
  docsEndpoint,
  routesEndpoint,
  memorySettingsGetEndpoint,
  memorySettingsPatchEndpoint,
  memorySearchEndpoint,
  memoryEntriesListEndpoint,
  memoryEntryApproveEndpoint,
  memoryEntryRejectEndpoint,
  memoryEntryDeleteEndpoint,
  memoryExportEndpoint,
  memoryClearEndpoint,
  memoryContributionEndpoint,
  minimaxSearchEndpoint,
  minimaxImageEndpoint,
  sessionListEndpoint,
  sessionCreateEndpoint,
  sessionGetEndpoint,
  sessionAppendEndpoint,
  sessionPatchEndpoint,
  sessionDeleteEndpoint,
  sessionExportEndpoint,
] as const satisfies ReadonlyArray<HttpEndpointDescriptor>;

export const buildHttpEndpointRegistry = (
  endpoints: ReadonlyArray<HttpEndpointDescriptor> = httpEndpoints,
): HttpEndpointRegistry => httpEndpointRegistrySchema.parse({
  contractVersion: apiContractVersion,
  endpoints,
});

export const findHttpEndpoint = (
  id: HttpEndpointDescriptor["id"],
): HttpEndpointDescriptor | null => httpEndpoints.find((endpoint) => endpoint.id === id) ?? null;

export const findHttpEndpointByRoute = (
  method: HttpMethod,
  path: string,
): HttpEndpointDescriptor | null => httpEndpoints.find(
  (endpoint) => endpoint.method === method && endpoint.path === path,
) ?? null;

export const listHttpEndpointErrorStatuses = (): ReadonlyArray<{
  endpointId: HttpEndpointDescriptor["id"];
  status: number;
  errorCodes: ReadonlyArray<string>;
  description: string;
}> => {
  const rows: Array<{
    endpointId: HttpEndpointDescriptor["id"];
    status: number;
    errorCodes: ReadonlyArray<string>;
    description: string;
  }> = [];
  for (const endpoint of httpEndpoints) {
    for (const entry of endpoint.errorStatusCodes) {
      rows.push({
        endpointId: endpoint.id,
        status: entry.status,
        errorCodes: entry.errorCodes,
        description: entry.description,
      });
    }
  }
  return rows;
};

export const listHttpEndpointErrorCodes = (): ReadonlyArray<string> => {
  const codes = new Set<string>();
  for (const endpoint of httpEndpoints) {
    for (const entry of endpoint.errorStatusCodes) {
      for (const code of entry.errorCodes) {
        codes.add(code);
      }
    }
  }
  return [...codes].sort();
};
