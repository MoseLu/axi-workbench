import { describe, expect, it } from "vitest";
import {
  apiContractVersion,
  buildHttpEndpointRegistry,
  errorEnvelopeSchema,
  gatewayErrorCodeSchema,
  httpEndpoints,
  livenessResponseSchema,
} from "@axi/gateway-contracts";
import {
  OPENAPI_VERSION,
  convertSchema,
  findRegisteredSchema,
  generateOpenApiDocument,
  listRegisteredSchemas,
  renderDocsHtml,
  validateOpenApiDocument,
  REGISTERED_SCHEMA_NAMES,
} from "../src";

/**
 * Behavior tests for @axi/resource-api-docs.
 *
 * Coverage:
 *   - endpoint surface (path, method, contract version, tags)
 *   - error matrix coverage
 *   - JSON serializability (no functions, dates, Buffers, etc.)
 *   - docs HTML safety (no secrets, no provider payloads, no
 *     remote scripts, deterministic title)
 *   - determinism (re-generating produces deep-equal output)
 */

const FORBIDDEN_TOKENS = [
  "process.env",
  "VITE_",
  "AXI_",
  "/Users/mose",
  "Bearer ",
  "file://",
  "http://",
  "https://",
];

/** Structural places where a forbidden token would be dangerous.
 *  Scoped lookups ignore description prose (which may legitimately
 *  use words like "secrets" when explaining what we strip). */
const STRUCTURAL_KEYS = [
  /"servers"/,
  /"info"/,
  /"paths"/,
  /"components"/,
  /"openapi"/,
  /"operationId"/,
  /"\$ref"/,
  /"enum"/,
];

describe("api-docs / openapi document shape", () => {
  it("pins the openapi version to 3.1.0", () => {
    expect(OPENAPI_VERSION).toBe("3.1.0");
  });

  it("renders every endpoint in the registry exactly once", () => {
    const doc = generateOpenApiDocument();
    const declaredPaths = httpEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`).sort();
    const renderedPaths: string[] = [];
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const method of Object.keys(item)) {
        renderedPaths.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(renderedPaths.sort()).toEqual(declaredPaths);
  });

  it("covers every required endpoint id, method, and path", () => {
    const doc = generateOpenApiDocument();
    const declared = new Map(httpEndpoints.map((endpoint) => [endpoint.id, endpoint] as const));
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const [methodKey, op] of Object.entries(item)) {
        if (!op) continue;
        const endpoint = declared.get(op.operationId as typeof httpEndpoints[number]["id"]);
        expect(endpoint, `unknown operationId "${op.operationId}"`).toBeDefined();
        if (!endpoint) continue;
        expect(endpoint.path).toBe(path);
        expect(methodKey).toBe(endpoint.method.toLowerCase());
        expect(endpoint.contractVersion).toBe(apiContractVersion);
        expect(op["x-api-contract-version"]).toBe(endpoint.contractVersion);
      }
    }
  });

  it("renders ErrorEnvelope on every non-2xx status", () => {
    const doc = generateOpenApiDocument();
    for (const endpoint of httpEndpoints) {
      const item = doc.paths[endpoint.path];
      const methodKey = endpoint.method.toLowerCase();
      const operation = item?.[methodKey];
      expect(operation, `no operation for ${endpoint.id}`).toBeDefined();
      if (!operation) continue;
      for (const error of endpoint.errorStatusCodes) {
        const key = String(error.status);
        const response = operation.responses[key];
        expect(response, `no response for ${endpoint.id} status ${key}`).toBeDefined();
        if (!response) continue;
        const mediaTypes = Object.keys(response.content);
        const envelopeAppears = mediaTypes.some(
          (mediaType) => {
            const schema = response.content[mediaType].schema as Record<string, unknown>;
            return schema.$ref === "#/components/schemas/ErrorEnvelope";
          },
        );
        expect(envelopeAppears, `${endpoint.id} status ${key} should reference ErrorEnvelope`).toBe(true);
      }
    }
  });

  it("renders the success schema with the right content type", () => {
    const doc = generateOpenApiDocument();
    const gatewayRun = doc.paths["/gateway/run"]?.post;
    expect(gatewayRun?.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/GatewayResponse",
    });
    const docs = doc.paths["/docs"]?.get;
    expect(docs?.responses["200"].content["text/html; charset=utf-8"]).toBeDefined();
    const openapi = doc.paths["/openapi.json"]?.get;
    expect(openapi?.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/OpenApiDocument",
    });
  });

  it("serializes cleanly with JSON.stringify", () => {
    const doc = generateOpenApiDocument();
    const roundTrip = JSON.parse(JSON.stringify(doc));
    expect(roundTrip).toEqual(doc);
  });

  it("contains no forbidden tokens in structural fields", () => {
    const doc = generateOpenApiDocument();
    const serialised = JSON.stringify(doc);
    for (const token of FORBIDDEN_TOKENS) {
      for (const pattern of STRUCTURAL_KEYS) {
        const matches = serialised.match(pattern);
        if (!matches || matches.length === 0) continue;
        const idx = serialised.indexOf(matches[0]);
        // Pull a 256-char window around the first structural-key
        // occurrence and confirm the forbidden token is absent.
        const window = serialised.slice(idx, idx + 256);
        expect(window, `structural key ${matches[0]} must not embed ${token}`).not.toContain(token);
      }
    }
  });

  it("contains no absolute URLs anywhere in the doc", () => {
    const serialised = JSON.stringify(generateOpenApiDocument());
    expect(serialised).not.toContain("http://");
    expect(serialised).not.toContain("https://");
  });

  it("is deterministic across repeated generations", () => {
    const a = generateOpenApiDocument();
    const b = generateOpenApiDocument();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("is deterministic with custom registry input", () => {
    const a = generateOpenApiDocument({ registry: buildHttpEndpointRegistry() });
    const b = generateOpenApiDocument({ registry: buildHttpEndpointRegistry() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("applies caller-provided info overrides", () => {
    const doc = generateOpenApiDocument({
      title: "Custom Title",
      description: "Custom description",
      servers: [{ url: "https://example.test" }],
    });
    expect(doc.info.title).toBe("Custom Title");
    expect(doc.info.description).toBe("Custom description");
    expect(doc.servers).toEqual([{ url: "https://example.test" }]);
  });

  it("uses a default / server when no override is provided", () => {
    const doc = generateOpenApiDocument();
    expect(doc.servers).toEqual([{ url: "/" }]);
  });
});

describe("api-docs / openapi validation", () => {
  it("passes on the default document", () => {
    const result = validateOpenApiDocument(generateOpenApiDocument());
    expect(result.ok).toBe(true);
  });

  it("flags a wrong openapi version", () => {
    const result = validateOpenApiDocument({
      ...generateOpenApiDocument(),
      openapi: "3.0.0" as typeof OPENAPI_VERSION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === "/openapi")).toBe(true);
    }
  });

  it("flags a missing info.title", () => {
    const doc = generateOpenApiDocument();
    const broken = { ...doc, info: { ...doc.info, title: "" } };
    const result = validateOpenApiDocument(broken);
    expect(result.ok).toBe(false);
  });

  it("flags a missing servers array", () => {
    const doc = generateOpenApiDocument();
    const broken = { ...doc, servers: [] };
    const result = validateOpenApiDocument(broken);
    expect(result.ok).toBe(false);
  });
});

describe("api-docs / schema registry", () => {
  it("exposes exactly the closed schema set", () => {
    const expected = [
      "BreakerSnapshot",
      "ComponentHealth",
      "ErrorEnvelope",
      "GatewayRequest",
      "GatewayResponse",
      "LivenessResponse",
      "MetricsResponse",
      "MiniMaxImageRequest",
      "MiniMaxImageResponse",
      "MiniMaxSearchRequest",
      "MiniMaxSearchResponse",
      "MemoryAckResponse",
      "MemoryApproveRequest",
      "MemoryClearRequest",
      "MemoryContributionRequest",
      "MemoryEntryResponse",
      "MemoryExportResponse",
      "MemoryListResponse",
      "MemorySearchRequest",
      "MemorySearchResponse",
      "MemorySettingsPatch",
      "MemorySettingsResponse",
      "OpenApiDocument",
      "ReadinessResponse",
      "ResourceSearchErrorEnvelope",
      "ResourceSearchRequest",
      "ResourceSearchResponse",
      "RouteEntry",
      "RouteMetrics",
      "RoutesResponse",
      "SessionAppendRequest",
      "SessionAppendResponse",
      "SessionCreateRequest",
      "SessionCreateResponse",
      "SessionDeleteRequest",
      "SessionDeleteResponse",
      "SessionDetailResponse",
      "SessionExportRequest",
      "SessionExportResponse",
      "SessionListResponse",
      "SessionPatch",
      "SessionPatchResponse",
    ].sort();
    expect(REGISTERED_SCHEMA_NAMES).toEqual(expected);
  });

  it("every registered schema has a JSON Schema fragment", () => {
    for (const entry of listRegisteredSchemas()) {
      expect(entry.jsonSchema).toBeDefined();
      expect(typeof entry.jsonSchema).toBe("object");
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("findRegisteredSchema returns the matching entry and null otherwise", () => {
    expect(findRegisteredSchema("GatewayRequest")?.name).toBe("GatewayRequest");
    expect(findRegisteredSchema("does.not.exist")).toBeNull();
  });
});

describe("api-docs / Zod converter", () => {
  it("converts a simple object schema with required fields", () => {
    const fragment = convertSchema(errorEnvelopeSchema);
    expect(fragment.type).toBe("object");
    expect(fragment.required).toEqual(expect.arrayContaining(["contractVersion", "requestId", "code", "message"]));
  });

  it("converts enums to JSON Schema enum arrays", () => {
    const fragment = convertSchema(gatewayErrorCodeSchema);
    expect(fragment.type).toBe("string");
    expect(Array.isArray(fragment.enum)).toBe(true);
    expect((fragment.enum as string[]).length).toBeGreaterThan(0);
  });

  it("emits a JSON Schema fragment for the liveness response", () => {
    const fragment = convertSchema(livenessResponseSchema);
    expect(fragment.type).toBe("object");
    expect(fragment.properties).toBeDefined();
  });

  it("throws on unsupported Zod kinds instead of silently widening", () => {
    expect(() => convertSchema({ _def: { typeName: "ZodMap" } } as never)).toThrow(/unsupported Zod kind/);
  });
});

describe("api-docs / docs html renderer", () => {
  const doc = generateOpenApiDocument();

  it("renders valid HTML5", () => {
    const html = renderDocsHtml(doc);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html.includes("</html>")).toBe(true);
  });

  it("sets a strict content-security-policy meta", () => {
    const html = renderDocsHtml(doc);
    expect(html).toMatch(/http-equiv="Content-Security-Policy"/);
    // The single quotes in the CSP directive are HTML-escaped to
    // &#39; so the rendered attribute stays well-formed. The CSP
    // semantics remain identical to default-src 'none'.
    expect(html).toContain("default-src &#39;none&#39;");
    expect(html).toContain("script-src &#39;unsafe-inline&#39;");
    expect(html).toContain("connect-src &#39;self&#39;");
  });

  it("does not embed secrets, env, paths, or remote URLs in the rendered HTML", () => {
    const html = renderDocsHtml(doc);
    for (const token of ["process.env", "VITE_", "AXI_", "/Users/mose", "Bearer ", "file://", "http://", "https://"]) {
      expect(html, `docs html must not contain "${token}"`).not.toContain(token);
    }
  });

  it("refuses to load absolute openapi.json urls", () => {
    expect(() => renderDocsHtml(doc, { openApiUrl: "https://attacker.test/openapi.json" })).toThrow(/same-origin/);
  });

  it("embeds the bootstrap payload as a JSON script tag (no innerHTML injection)", () => {
    const html = renderDocsHtml(doc);
    expect(html).toMatch(/<script id="openapi-bootstrap" type="application\/json">/);
    const match = html.match(/<script id="openapi-bootstrap" type="application\/json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    if (match) {
      const parsed = JSON.parse(match[1]);
      expect(parsed.openapi).toBe(OPENAPI_VERSION);
      expect(parsed.info.title).toBe(doc.info.title);
    }
  });

  it("includes a loading shell variant that does not embed the document", () => {
    const html = renderDocsHtml(doc, { showLoadingShell: true });
    expect(html).toContain("Loading API reference");
    expect(html).not.toContain("openapi-bootstrap");
  });

  it("is deterministic for the same input", () => {
    const a = renderDocsHtml(doc);
    const b = renderDocsHtml(doc);
    expect(a).toBe(b);
  });

  it("uses the first server URL as the baseUrl when none is supplied", () => {
    const html = renderDocsHtml(doc);
    expect(html).toContain('"baseUrl":"/"');
  });
});

describe("api-docs / shape stability", () => {
  it("every document key is JSON-serialisable and finite", () => {
    const doc = generateOpenApiDocument();
    const serialised = JSON.stringify(doc);
    expect(serialised).not.toContain("[object Object]");
    expect(serialised).not.toContain("undefined");
  });

  it("document size stays under the documented size envelope", () => {
    const doc = generateOpenApiDocument();
    const size = JSON.stringify(doc).length;
    // 100 KB is generous; the actual document is well under 20 KB.
    expect(size).toBeLessThan(100_000);
  });

  it("the registry size and the schema size stay in sync", () => {
    const doc = generateOpenApiDocument();
    expect(Object.keys(doc.components.schemas).sort()).toEqual(REGISTERED_SCHEMA_NAMES);
  });
});
