import { z } from "zod";

import { apiContractVersion } from "./types";

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
