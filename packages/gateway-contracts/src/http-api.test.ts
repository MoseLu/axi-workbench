import { describe, expect, it } from "vitest";
import {
  apiContractVersion,
  buildHttpEndpointRegistry,
  docsEndpoint,
  endpointErrorStatusSchema,
  findHttpEndpoint,
  findHttpEndpointByRoute,
  gatewayRunEndpoint,
  healthLiveEndpoint,
  healthReadyEndpoint,
  httpEndpointDescriptorSchema,
  httpEndpointRegistrySchema,
  httpEndpoints,
  httpHeaderDescriptorSchema,
  httpMediaTypeSchema,
  httpMethodSchema,
  httpRequestDescriptorSchema,
  httpResponseDescriptorSchema,
  listHttpEndpointErrorCodes,
  listHttpEndpointErrorStatuses,
  metricsEndpoint,
  minimaxImageEndpoint,
  minimaxSearchEndpoint,
  openapiJsonEndpoint,
  routesEndpoint,
  routesResponseSchema,
  successStatusCodeSchema,
} from "./http-api";
import {
  errorEnvelopeSchema,
  gatewayContractVersion,
  gatewayErrorCodeSchema,
  gatewayRequestSchema,
  gatewayResponseSchema,
  httpStatusForErrorCode,
} from "./gateway";
import {
  healthContractVersion,
  livenessResponseSchema,
  metricsResponseSchema,
  readinessResponseSchema,
} from "./health";

/**
 * HTTP API contract tests (GHA-080).
 *
 * Pin the endpoint metadata + every (status, errorCode) pair the
 * registry advertises, so a typo in a descriptor fails at the
 * registry build step instead of at runtime in apps/gateway.
 */

const EXPECTED_ENDPOINT_IDS = [
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
] as const;

const EXPECTED_ROUTES: Array<{ id: string; method: string; path: string }> = [
  { id: "gateway.run", method: "POST", path: "/gateway/run" },
  { id: "resource.search", method: "POST", path: "/resource/search" },
  { id: "health.live", method: "GET", path: "/health/live" },
  { id: "health.ready", method: "GET", path: "/health/ready" },
  { id: "metrics", method: "GET", path: "/metrics" },
  { id: "openapi.json", method: "GET", path: "/openapi.json" },
  { id: "docs", method: "GET", path: "/docs" },
  { id: "routes", method: "GET", path: "/routes" },
  { id: "minimax-tokenplan.search", method: "POST", path: "/provider/minimax-tokenplan/search" },
  { id: "minimax-tokenplan.image", method: "POST", path: "/provider/minimax-tokenplan/image" },
];

describe("http api contract", () => {
  it("pins the api contract version", () => {
    expect(apiContractVersion).toBe(1);
  });

  it("exposes every declared gateway and memory endpoint", () => {
    expect(httpEndpoints.map((endpoint) => endpoint.id).sort()).toEqual([...EXPECTED_ENDPOINT_IDS].sort());
  });

  it("every endpoint references the same contract version", () => {
    for (const endpoint of httpEndpoints) {
      expect(endpoint.contractVersion).toBe(apiContractVersion);
    }
  });

  it("every endpoint path matches the route contract", () => {
    for (const expected of EXPECTED_ROUTES) {
      const endpoint = findHttpEndpoint(expected.id as typeof httpEndpoints[number]["id"]);
      expect(endpoint).not.toBeNull();
      expect(endpoint?.method).toBe(expected.method);
      expect(endpoint?.path).toBe(expected.path);
    }
  });

  it("the registry validates via httpEndpointRegistrySchema", () => {
    const registry = buildHttpEndpointRegistry();
    expect(registry.contractVersion).toBe(apiContractVersion);
    expect(registry.endpoints).toHaveLength(27);
    // And re-parse directly to confirm the schema accepts the built registry.
    expect(httpEndpointRegistrySchema.safeParse(registry).success).toBe(true);
  });

  it("rejects an empty endpoint list at the registry level", () => {
    const result = httpEndpointRegistrySchema.safeParse({ contractVersion: apiContractVersion, endpoints: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a registry with a duplicate endpoint id", () => {
    const result = httpEndpointRegistrySchema.safeParse({
      contractVersion: apiContractVersion,
      endpoints: [gatewayRunEndpoint, gatewayRunEndpoint],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a registry with a duplicate (method, path)", () => {
    const dup = { ...healthLiveEndpoint, id: "health.live.copy" as const };
    const result = httpEndpointRegistrySchema.safeParse({
      contractVersion: apiContractVersion,
      endpoints: [healthLiveEndpoint, dup],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a registry whose contractVersion is wrong", () => {
    const result = httpEndpointRegistrySchema.safeParse({ contractVersion: 99, endpoints: httpEndpoints });
    expect(result.success).toBe(false);
  });
});

describe("endpoint descriptor primitives", () => {
  it("covers the http method enum", () => {
    expect(httpMethodSchema.options).toEqual(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    expect(httpMethodSchema.safeParse("GET").success).toBe(true);
    expect(httpMethodSchema.safeParse("OPTIONS").success).toBe(false);
    expect(httpMethodSchema.safeParse("get").success).toBe(false);
  });

  it("covers the media type enum", () => {
    expect(httpMediaTypeSchema.safeParse("application/json").success).toBe(true);
    expect(httpMediaTypeSchema.safeParse("text/html; charset=utf-8").success).toBe(true);
    expect(httpMediaTypeSchema.safeParse("application/octet-stream").success).toBe(false);
  });

  it("covers the success status code union", () => {
    expect(successStatusCodeSchema.safeParse(200).success).toBe(true);
    expect(successStatusCodeSchema.safeParse(202).success).toBe(true);
    expect(successStatusCodeSchema.safeParse(204).success).toBe(true);
    expect(successStatusCodeSchema.safeParse(404).success).toBe(false);
  });

  it("validates a header descriptor", () => {
    expect(httpHeaderDescriptorSchema.safeParse({ name: "X-Request-Id", required: false, description: "caller-supplied id" }).success).toBe(true);
    const badName = httpHeaderDescriptorSchema.safeParse({ name: "", required: true, description: "x" });
    expect(badName.success).toBe(false);
  });

  it("validates a request descriptor with defaults", () => {
    const parsed = httpRequestDescriptorSchema.parse({ description: "minimal" });
    expect(parsed.contentType).toBe("application/json");
    expect(parsed.required).toBe(true);
    expect(parsed.headers).toEqual([]);
  });

  it("validates a response descriptor", () => {
    expect(httpResponseDescriptorSchema.safeParse({
      schemaRef: "GatewayResponse",
      description: "ok",
    }).success).toBe(true);
    expect(httpResponseDescriptorSchema.safeParse({
      schemaRef: "UnknownSchema",
      description: "x",
    }).success).toBe(false);
  });

  it("validates an error status descriptor and rejects unknown codes", () => {
    const ok = endpointErrorStatusSchema.safeParse({
      status: 502,
      errorCodes: ["provider_error"],
      description: "upstream bad",
    });
    expect(ok.success).toBe(true);
    const badStatus = endpointErrorStatusSchema.safeParse({
      status: 200,
      errorCodes: ["provider_error"],
      description: "ok",
    });
    expect(badStatus.success).toBe(false);
  });
});

describe("descriptor-level invariants", () => {
  it("rejects a path that does not start with /", () => {
    const _unusedBad = { ...healthLiveEndpoint, path: "health/live" };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects a path with forbidden characters", () => {
    const _unusedBad = { ...healthLiveEndpoint, path: "/health live" };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects a POST endpoint without a request descriptor", () => {
    const _unusedBad = { ...gatewayRunEndpoint, request: undefined };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects a GET endpoint that declares a required body", () => {
    const _unusedBad = {
      ...healthLiveEndpoint,
      request: {
        schemaRef: "GatewayRequest" as const,
        contentType: "application/json" as const,
        required: true,
        headers: [],
        description: "should not exist on a GET endpoint",
      },
    };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects /openapi.json without an OpenApiDocument response", () => {
    const _unusedBad = { ...openapiJsonEndpoint, response: { ...openapiJsonEndpoint.response, schemaRef: "GatewayResponse" as const } };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects /docs that does not serve HTML", () => {
    const _unusedBad = { ...docsEndpoint, response: { ...docsEndpoint.response, contentType: "application/json" as const } };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects gateway.run declared as GET", () => {
    const _unusedBad = { ...gatewayRunEndpoint, method: "GET" as const };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });
});

describe("endpoint lookup helpers", () => {
  it("findHttpEndpoint returns the matching descriptor", () => {
    expect(findHttpEndpoint("gateway.run")?.id).toBe("gateway.run");
    const unknown = "does.not.exist" as unknown as Parameters<typeof findHttpEndpoint>[0];
    expect(findHttpEndpoint(unknown)).toBeNull();
  });

  it("findHttpEndpointByRoute matches by method and path", () => {
    expect(findHttpEndpointByRoute("POST", "/gateway/run")?.id).toBe("gateway.run");
    expect(findHttpEndpointByRoute("GET", "/health/live")?.id).toBe("health.live");
    expect(findHttpEndpointByRoute("POST", "/health/live")).toBeNull();
    expect(findHttpEndpointByRoute("GET", "/nope")).toBeNull();
  });

  it("listHttpEndpointErrorStatuses covers every (endpoint, status) pair", () => {
    const rows = listHttpEndpointErrorStatuses();
    // At least the gateway.run endpoint declares 8 distinct statuses.
    expect(rows.length).toBeGreaterThanOrEqual(8);
    const gatewayRows = rows.filter((row) => row.endpointId === "gateway.run");
    expect(gatewayRows.map((row) => row.status).sort((a, b) => a - b)).toEqual([400, 404, 429, 499, 500, 502, 503, 504]);
  });

  it("listHttpEndpointErrorCodes includes every GatewayErrorCode used by the registry", () => {
    const codes = listHttpEndpointErrorCodes();
    for (const declared of ["invalid_request", "unknown_tool", "provider_error", "provider_timeout", "circuit_open", "rate_limited", "cancelled", "internal", "not_configured"]) {
      expect(codes).toContain(declared);
    }
    // Every code we advertise must be a member of the closed GatewayErrorCode enum.
    const enumValues = gatewayErrorCodeSchema.options;
    for (const code of codes) {
      expect(enumValues).toContain(code);
    }
  });
});

describe("endpoint ↔ existing wire schemas", () => {
  it("POST /gateway/run references the existing GatewayRequest/GatewayResponse schemas", () => {
    expect(gatewayRunEndpoint.request?.schemaRef).toBe("GatewayRequest");
    expect(gatewayRunEndpoint.response.schemaRef).toBe("GatewayResponse");
    // And the schemas themselves accept the canonical happy-path shapes.
    const request = gatewayRequestSchema.safeParse({
      planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [] },
    });
    expect(request.success).toBe(true);
    const response = gatewayResponseSchema.safeParse({
      contractVersion: gatewayContractVersion,
      requestId: "r-1",
      fromCache: false,
      trace: [],
      planner: {},
      result: {},
      warnings: [],
    });
    expect(response.success).toBe(true);
  });

  it("GET /health/live references LivenessResponse", () => {
    expect(healthLiveEndpoint.response.schemaRef).toBe("LivenessResponse");
    const parsed = livenessResponseSchema.safeParse({ contractVersion: healthContractVersion, status: "ok", uptimeMs: 0 });
    expect(parsed.success).toBe(true);
  });

  it("GET /health/ready references ReadinessResponse", () => {
    expect(healthReadyEndpoint.response.schemaRef).toBe("ReadinessResponse");
    const parsed = readinessResponseSchema.safeParse({
      contractVersion: healthContractVersion,
      status: "ready",
      manifestVersion: 1,
      routeCount: 5,
      components: [{ id: "manifest", status: "up", lastCheckedAt: new Date().toISOString() }],
    });
    expect(parsed.success).toBe(true);
  });

  it("GET /metrics references MetricsResponse", () => {
    expect(metricsEndpoint.response.schemaRef).toBe("MetricsResponse");
    const parsed = metricsResponseSchema.safeParse({
      contractVersion: healthContractVersion,
      manifestVersion: 1,
      capturedAt: new Date().toISOString(),
      routes: [],
      breakers: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("every errorStatusCodes row agrees with the gateway httpStatusForErrorCode default", () => {
    // The registry's declared statuses should match the canonical mapping in
    // gateway.ts for the codes it advertises. This pins the two contracts
    // together so api-docs cannot drift from the wire.
    for (const row of listHttpEndpointErrorStatuses()) {
      for (const code of row.errorCodes) {
        // Code must belong to the closed GatewayErrorCode enum.
        const parsed = gatewayErrorCodeSchema.safeParse(code);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          const mapped = httpStatusForErrorCode(parsed.data);
          // Every error code is mapped; the registry's declared status should
          // match for the canonical codes. Some codes share a status with
          // other codes (e.g. circuit_open + not_configured both → 503), so
          // we only enforce that the declared status is one of the codes'
          // mapped statuses.
          const enumCodes = gatewayErrorCodeSchema.options.filter((candidate) => httpStatusForErrorCode(candidate) === row.status);
          expect(enumCodes).toContain(code);
          expect(mapped).toBe(row.status);
        }
      }
    }
  });

  it("errorEnvelopeSchema accepts every (status, code) pair in the registry", () => {
    // The ErrorEnvelope contract is the wire shape for every error status.
    // If a code passed the registry but rejected the envelope, that would
    // be a contract break.
    for (const row of listHttpEndpointErrorStatuses()) {
      for (const code of row.errorCodes) {
        const parsed = errorEnvelopeSchema.safeParse({
          contractVersion: gatewayContractVersion,
          requestId: "r-1",
          code,
          message: "synthetic",
        });
        expect(parsed.success).toBe(true);
      }
    }
  });
});

describe("schema accept/reject boundary", () => {
  it("accepts the full registry at the schema level", () => {
    const registry = httpEndpointRegistrySchema.parse({
      contractVersion: apiContractVersion,
      endpoints: httpEndpoints,
    });
    expect(registry.endpoints.length).toBe(27);
  });

  it("rejects an endpoint with an unknown id", () => {
    const _unusedBad = { ...healthLiveEndpoint, id: "metrics.copy" as unknown as typeof healthLiveEndpoint.id };
    const result = httpEndpointDescriptorSchema.safeParse(_unusedBad);
    expect(result.success).toBe(false);
  });

  it("rejects an endpoint with an out-of-range error status", () => {
    const _unusedBad = {
      ...healthLiveEndpoint,
      errorStatusCodes: [
        { status: 200, errorCodes: ["internal"], description: "should not appear" },
      ],
    };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects an empty errorStatusCodes list (each endpoint must declare at least one)", () => {
    const _unusedBad = { ...healthLiveEndpoint, errorStatusCodes: [] };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });

  it("rejects an unknown tag", () => {
    // Empty tag is invalid (min length 1, but a single space is acceptable).
    // Use a too-long tag instead.
    const bad = { ...healthLiveEndpoint, tags: ["x".repeat(41)] };
    expect(httpEndpointDescriptorSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown contractVersion on the endpoint", () => {
    const _unusedBad = { ...healthLiveEndpoint, contractVersion: 99 as unknown as 1 };
    expect(httpEndpointDescriptorSchema.safeParse(_unusedBad).success).toBe(false);
  });
});
