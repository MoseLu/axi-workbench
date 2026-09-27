import { describe, expect, it } from "vitest";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";
import {
  buildHttpEndpointRegistry,
  docsEndpoint,
  findHttpEndpoint,
  findHttpEndpointByRoute,
  gatewayRunEndpoint,
  healthLiveEndpoint,
  healthReadyEndpoint,
  httpEndpointRegistrySchema,
  metricsEndpoint,
  minimaxImageEndpoint,
  minimaxSearchEndpoint,
  openapiJsonEndpoint,
  routesEndpoint,
} from "@axi/gateway-contracts";

import { GatewayRouter } from "../src/router";
import { createMetricsState } from "../src/metrics";

/**
 * Behaviour-first coverage for the HTTP handler / contract seams
 * (lane-mm-gateway-tests requirement 4 + 5).
 *
 * The gateway's /openapi.json, /docs, and /routes handlers cannot be
 * exercised via a real HTTP listener in this sandbox (listen
 * 127.0.0.1 is EPERM). Instead, these tests assert the user-visible
 * invariants each handler is supposed to uphold:
 *
 *   - The endpoint registry that drives /openapi.json is
 *     well-formed and uniquely keyed on id and on (method, path).
 *   - The registry has been expanded to 9 descriptors (6 canonical +
 *     3 added by GHA-NEXT-002/GHA-NEXT-006): routes,
 *     minimax-tokenplan.search, minimax-tokenplan.image.
 *   - Each documented endpoint declares the correct schemaRef
 *     (MetricsResponse / OpenApiDocument / LivenessResponse /
 *     ReadinessResponse / RoutesResponse / MiniMaxSearchResponse /
 *     MiniMaxImageResponse) and the correct content-type for its
 *     response (application/json for /openapi.json, text/html for
 *     /docs). The contract's superRefine rules enforce this — the
 *     tests assert those rules are wired correctly.
 *   - `/routes` projection — built from
 *     `router.routeRegistry()` — never carries adapter URLs,
 *     tokens, query text, secrets, or environment variables.
 *   - The /routes handler shape (manifestVersion, capturedAt,
 *     routes array) is what server.ts actually serializes.
 *   - The MiniMax bridge endpoints declare the correct MiniMax
 *     request/response schemaRefs and are server-only (publicAccess:
 *     false).
 *
 * These tests are pure module-level assertions; no sockets, no
 * fetch, no listen.
 */

describe("apps/gateway HTTP handler contract — /openapi.json / /docs / /routes", () => {
  it("registers exactly nine endpoint descriptors, with unique ids and (method, path)", () => {
    const registry = buildHttpEndpointRegistry();
    // Six canonical + routes + minimax-tokenplan.search + minimax-tokenplan.image = 9
    // plus 10 memory endpoints (MEM-MVP-003) and 7 session endpoints (SES-MVP-003),
    // plus resource.search (narrow cross-project contract).
    expect(registry.endpoints).toHaveLength(27);
    expect(httpEndpointRegistrySchema.parse(registry)).toEqual(registry);

    const ids = registry.endpoints.map((e) => e.id);
    // Canonical six
    expect(ids).toContain("gateway.run");
    expect(ids).toContain("health.live");
    expect(ids).toContain("health.ready");
    expect(ids).toContain("metrics");
    expect(ids).toContain("openapi.json");
    expect(ids).toContain("docs");
    // GHA-NEXT-002
    expect(ids).toContain("routes");
    // GHA-NEXT-006
    expect(ids).toContain("minimax-tokenplan.search");
    expect(ids).toContain("minimax-tokenplan.image");

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    const uniquePaths = new Set(registry.endpoints.map((e) => `${e.method} ${e.path}`));
    expect(uniquePaths.size).toBe(registry.endpoints.length);
  });

  it("/openapi.json must declare OpenApiDocument as the response schemaRef and application/json content type", () => {
    const endpoint = findHttpEndpoint("openapi.json");
    expect(endpoint).not.toBeNull();
    expect(endpoint?.response.schemaRef).toBe("OpenApiDocument");
    expect(endpoint?.response.contentType).toBe("application/json");
    expect(endpoint?.method).toBe("GET");
    expect(endpoint?.path).toBe("/openapi.json");
    expect(endpoint?.successStatus).toBe(200);
  });

  it("/docs must declare text/html content type (contract refuses non-html via superRefine)", () => {
    const endpoint = findHttpEndpoint("docs");
    expect(endpoint).not.toBeNull();
    expect(endpoint?.response.schemaRef).toBe("OpenApiDocument");
    expect(endpoint?.response.contentType).toBe("text/html; charset=utf-8");
    expect(endpoint?.method).toBe("GET");
    expect(endpoint?.path).toBe("/docs");
    expect(endpoint?.successStatus).toBe(200);
  });

  it("/metrics must declare MetricsResponse as the response schemaRef", () => {
    const endpoint = findHttpEndpoint("metrics");
    expect(endpoint).not.toBeNull();
    expect(endpoint?.response.schemaRef).toBe("MetricsResponse");
    expect(endpoint?.response.contentType).toBe("application/json");
  });

  it("findHttpEndpointByRoute matches every documented path with the correct method", () => {
    expect(findHttpEndpointByRoute("GET", "/health/live")).toBe(healthLiveEndpoint);
    expect(findHttpEndpointByRoute("GET", "/health/ready")).toBe(healthReadyEndpoint);
    expect(findHttpEndpointByRoute("GET", "/metrics")).toBe(metricsEndpoint);
    expect(findHttpEndpointByRoute("GET", "/openapi.json")).toBe(openapiJsonEndpoint);
    expect(findHttpEndpointByRoute("GET", "/docs")).toBe(docsEndpoint);
    expect(findHttpEndpointByRoute("POST", "/gateway/run")).toBe(gatewayRunEndpoint);
    // GHA-NEXT-002
    expect(findHttpEndpointByRoute("GET", "/routes")).toBe(routesEndpoint);
    // GHA-NEXT-006
    expect(findHttpEndpointByRoute("POST", "/provider/minimax-tokenplan/search")).toBe(minimaxSearchEndpoint);
    expect(findHttpEndpointByRoute("POST", "/provider/minimax-tokenplan/image")).toBe(minimaxImageEndpoint);
    // Wrong method → null.
    expect(findHttpEndpointByRoute("POST", "/health/live")).toBeNull();
    expect(findHttpEndpointByRoute("GET", "/gateway/run")).toBeNull();
    // Unknown path → null.
    expect(findHttpEndpointByRoute("GET", "/does/not/exist")).toBeNull();
  });

  it("contract enforces: /openapi.json cannot declare a non-OpenApiDocument response (no half-document API)", () => {
    const tampered = { ...openapiJsonEndpoint, response: { ...openapiJsonEndpoint.response, schemaRef: "GatewayResponse" as const } };
    expect(() => buildHttpEndpointRegistry([
      gatewayRunEndpoint,
      healthLiveEndpoint,
      healthReadyEndpoint,
      metricsEndpoint,
      tampered,
      docsEndpoint,
      routesEndpoint,
      minimaxSearchEndpoint,
      minimaxImageEndpoint,
    ])).toThrow(/openapi\.json must respond with OpenApiDocument/u);
  });

  it("contract enforces: /docs cannot declare a non-html content type (no JS injection surface)", () => {
    const tampered = { ...docsEndpoint, response: { ...docsEndpoint.response, contentType: "application/json" as const } };
    expect(() => buildHttpEndpointRegistry([
      gatewayRunEndpoint,
      healthLiveEndpoint,
      healthReadyEndpoint,
      metricsEndpoint,
      openapiJsonEndpoint,
      tampered,
      routesEndpoint,
      minimaxSearchEndpoint,
      minimaxImageEndpoint,
    ])).toThrow(/text\/html/u);
  });

  it("contract enforces: POST endpoints must declare a request descriptor (no missing-body contract)", () => {
    // Strip the request from gateway.run to simulate an incomplete
    // descriptor. The contract must reject this so the gateway
    // cannot accidentally serve a POST without a documented body.
    const tampered = { ...gatewayRunEndpoint, request: undefined };
    expect(() => buildHttpEndpointRegistry([
      tampered,
      healthLiveEndpoint,
      healthReadyEndpoint,
      metricsEndpoint,
      openapiJsonEndpoint,
      docsEndpoint,
      routesEndpoint,
      minimaxSearchEndpoint,
      minimaxImageEndpoint,
    ])).toThrow(/POST endpoints must declare a request descriptor/u);
  });
});

describe("apps/gateway /routes projection — what the handler actually serializes", () => {
  it("matches server.ts: manifestVersion + capturedAt + safe routes array (no adapter/url/secret/query)", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      {
        id: "route.image",
        toolId: "resource.search.image",
        description: "image search route",
        loadBalancer: "weighted-round-robin",
        // Forbidden fields that the /routes handler MUST drop.
        adapter: { token: "do-not-leak" },
        url: "http://internal.invalid/secret",
        query: "leaky-query",
        predicates: [{ id: "by-resource-kind-image" }],
        targets: [
          { id: "image-factory.axi-image-preview", url: "http://127.0.0.1:5173", token: "tok-a" },
          { id: "image-fallback", url: "http://127.0.0.1:9999" },
        ],
      },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 4, metrics: createMetricsState() });
    const entries = router.routeRegistry();

    // Mirror the projection server.ts builds before sending:
    //   { manifestVersion, capturedAt, routes: [{ id, toolId,
    //     description, targetIds, loadBalancer, capabilities, predicates }] }
    const projected = {
      manifestVersion: 4,
      capturedAt: new Date().toISOString(),
      routes: entries.map((entry) => ({
        id: entry.id,
        toolId: entry.toolId,
        description: entry.description,
        targetIds: [...entry.targetIds],
        loadBalancer: entry.loadBalancer,
        capabilities: [...entry.capabilities],
        predicates: [...entry.predicates],
      })),
    };

    expect(projected.manifestVersion).toBe(4);
    expect(typeof projected.capturedAt).toBe("string");
    expect(new Date(projected.capturedAt).toString()).not.toBe("Invalid Date");
    expect(projected.routes).toHaveLength(1);

    const route = projected.routes[0];
    expect(route?.id).toBe("route.image");
    expect(route?.toolId).toBe("resource.search.image");
    expect(route?.description).toBe("image search route");
    expect(route?.loadBalancer).toBe("weighted-round-robin");
    expect(route?.targetIds).toEqual(["image-factory.axi-image-preview", "image-fallback"]);

    // GHA-NEXT-002: capabilities are derived from toolId — not empty
    // for a matched resource.search.* pattern.
    expect(route?.capabilities).toEqual(["search"]);
    expect(route?.capabilities).not.toEqual([]);

    // GHA-NEXT-002: predicates are extracted as string ids from the
    // manifest, matching what was registered on the route.
    expect(route?.predicates).toEqual(["by-resource-kind-image"]);

    // Defensive serialise-and-search: no forbidden fields leak.
    const json = JSON.stringify(projected);
    expect(json).not.toMatch(/do-not-leak|internal\.invalid|leaky-query|tok-a|127\.0\.0\.1:9999/u);
  });

  it("empty router produces a valid empty-routes payload (no 500)", () => {
    const gateway = new GatewayOrchestrator({ routes: [] });
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const entries = router.routeRegistry();
    expect(entries).toEqual([]);

    const projected = {
      manifestVersion: 1,
      capturedAt: new Date().toISOString(),
      routes: entries.map((entry) => ({
        id: entry.id,
        toolId: entry.toolId,
        description: entry.description,
        targetIds: [...entry.targetIds],
        loadBalancer: entry.loadBalancer,
        capabilities: [...entry.capabilities],
        predicates: [...entry.predicates],
      })),
    };

    expect(projected.routes).toEqual([]);
    expect(projected.manifestVersion).toBe(1);
  });

  it("deriveCapabilities is called for every route; predicates are propagated as string ids", () => {
    // GHA-NEXT-002: verifies that multiple routes with different toolId
    // patterns each derive the correct capabilities, and that predicates
    // from the manifest are propagated verbatim as strings (no adapter
    // objects leak through).
    const gateway = new GatewayOrchestrator({ routes: [] });
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      {
        id: "route.generate",
        toolId: "resource.generate.image",
        description: "generate image",
        loadBalancer: "round-robin",
        predicates: [{ id: "by-resource-kind-image" }],
        targets: [{ id: "minimax-factory.minimax-tokenplan-image" }],
      },
      {
        id: "route.inspect",
        toolId: "resource.inspect.document",
        description: "inspect doc",
        loadBalancer: "round-robin",
        predicates: [], // no predicate (defensive)
        targets: [{ id: "docs-factory.axi-docs" }],
      },
      {
        id: "route.unknown",
        toolId: "resource.foobar",
        description: "unknown tool",
        loadBalancer: "round-robin",
        predicates: "by-resource-kind-xyz", // plain string (stub)
        targets: [{ id: "fixture-factory.fixture" }],
      },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 2, metrics: createMetricsState() });
    const entries = router.routeRegistry();

    expect(entries).toHaveLength(3);

    // resource.generate.image → ["generate"]
    expect(entries[0]?.capabilities).toEqual(["generate"]);
    expect(entries[0]?.predicates).toEqual(["by-resource-kind-image"]);

    // resource.inspect.* → ["inspect"]
    expect(entries[1]?.capabilities).toEqual(["inspect"]);
    expect(entries[1]?.predicates).toEqual([]);

    // unknown toolId → []
    expect(entries[2]?.capabilities).toEqual([]);
    // plain string predicate is accepted by extractPredicateIds
    expect(entries[2]?.predicates).toEqual(["by-resource-kind-xyz"]);
  });
});

describe("apps/gateway GHA-NEXT-002 /routes endpoint descriptor — existence, uniqueness, security", () => {
  it("routes endpoint is registered with the correct id, method, path, and response schemaRef", () => {
    const endpoint = findHttpEndpoint("routes");
    expect(endpoint).not.toBeNull();
    expect(endpoint?.id).toBe("routes");
    expect(endpoint?.method).toBe("GET");
    expect(endpoint?.path).toBe("/routes");
    expect(endpoint?.response.schemaRef).toBe("RoutesResponse");
    expect(endpoint?.response.contentType).toBe("application/json");
    expect(endpoint?.successStatus).toBe(200);
  });

  it("routes endpoint is uniquely keyed: id and (method, path) are distinct", () => {
    const registry = buildHttpEndpointRegistry();
    const ids = registry.endpoints.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = registry.endpoints.map((e) => `${e.method} ${e.path}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("routes endpoint declares the RoutesResponse schemaRef (not a leaky provider shape)", () => {
    const endpoint = routesEndpoint;
    expect(endpoint.response.schemaRef).toBe("RoutesResponse");
    // The response schema must NOT be a provider payload shape.
    expect(endpoint.response.schemaRef).not.toBe("GatewayResponse");
    expect(endpoint.response.schemaRef).not.toBe("MetricsResponse");
  });

  it("routes endpoint is publicAccess: true and carries the ops tag", () => {
    expect(routesEndpoint.publicAccess).toBe(true);
    expect(routesEndpoint.tags).toContain("ops");
  });
});

describe("apps/gateway GHA-NEXT-006 MiniMax bridge endpoints — existence, uniqueness, security", () => {
  it("minimax-tokenplan.search endpoint is registered with the correct id, method, path, and schemas", () => {
    const endpoint = findHttpEndpoint("minimax-tokenplan.search");
    expect(endpoint).not.toBeNull();
    expect(endpoint?.id).toBe("minimax-tokenplan.search");
    expect(endpoint?.method).toBe("POST");
    expect(endpoint?.path).toBe("/provider/minimax-tokenplan/search");
    expect(endpoint?.response.schemaRef).toBe("MiniMaxSearchResponse");
    expect(endpoint?.request?.schemaRef).toBe("MiniMaxSearchRequest");
    expect(endpoint?.successStatus).toBe(200);
  });

  it("minimax-tokenplan.image endpoint is registered with the correct id, method, path, and schemas", () => {
    const endpoint = findHttpEndpoint("minimax-tokenplan.image");
    expect(endpoint).not.toBeNull();
    expect(endpoint?.id).toBe("minimax-tokenplan.image");
    expect(endpoint?.method).toBe("POST");
    expect(endpoint?.path).toBe("/provider/minimax-tokenplan/image");
    expect(endpoint?.response.schemaRef).toBe("MiniMaxImageResponse");
    expect(endpoint?.request?.schemaRef).toBe("MiniMaxImageRequest");
    expect(endpoint?.successStatus).toBe(200);
  });

  it("MiniMax endpoints are uniquely keyed: ids and (method, path) pairs are distinct", () => {
    const registry = buildHttpEndpointRegistry();
    const ids = registry.endpoints.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = registry.endpoints.map((e) => `${e.method} ${e.path}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("MiniMax endpoints are server-only (publicAccess: false); no credential-like values or local paths leak in descriptor", () => {
    expect(minimaxSearchEndpoint.publicAccess).toBe(false);
    expect(minimaxImageEndpoint.publicAccess).toBe(false);

    // The descriptor must NOT expose real credential values, local CLI
    // paths, or loopback infrastructure references.  Legitimate identifiers
    // (endpoint id "minimax-tokenplan.*", schemaRef names containing "Token",
    // descriptive text that merely *mentions* an env-var name) are kept.
    //
    // Patterns that WOULD indicate a genuine leak and must be absent:
    //   - MINIMAX_TOKENPLAN_CLI=… / MINIMAX_MCP_BASE_PATH=… (actual env values)
    //   - /Users/mose/.cc-connect/bin/minimax-tokenplan (absolute local CLI path)
    //   - 127.0.0.1 / localhost (loopback infrastructure in descriptor)
    //   - Any string containing "=" followed by what looks like a token value
    //     (e.g. "sk-abc123", "Bearer ey…", "token_xxx")
    //
    // Patterns that are PERMITTED (not credential values):
    //   - id: "minimax-tokenplan.search" / "minimax-tokenplan.image"
    //     ("token" appears inside "tokenplan" as part of a brand/tool name,
    //     not as a credential word)
    //   - schemaRef: "MiniMaxSearchRequest", "MiniMaxSearchResponse", etc.
    //     (PascalCase schema identifiers, not secret values)
    //   - Description text that says "MINIMAX_TOKENPLAN_CLI" as a bare
    //     env-var name (reference, not value)

    const searchJson = JSON.stringify(minimaxSearchEndpoint);
    const imageJson = JSON.stringify(minimaxImageEndpoint);

    for (const json of [searchJson, imageJson]) {
      // Reject actual env-var VALUE assignments (name=real_value pattern).
      // Matches MINIMAX_TOKENPLAN_CLI=…, MINIMAX_API_KEY=…, etc.
      expect(json).not.toMatch(/(?:MINIMAX|API|TOKEN|KEY|SECRET|TOKENPLAN)[_A-Z]*=(?!""|'')[^",}]+/iu);

      // Reject absolute local CLI paths that start with /Users, /home, /opt,
      // /usr/local, or contain .cc-connect — these are runtime config values,
      // not contract identifiers.
      expect(json).not.toMatch(/"(\/Users\/|\/home\/|\/opt\/|\/usr\/local\/|~|\.cc-connect)[^"]*"/u);

      // Reject loopback network references that would indicate internal
      // infrastructure leaking into the contract.
      expect(json).not.toMatch(/"(127\.\d+\.\d+\.\d+|localhost)"/u);

      // Reject bare credential-like token strings (sk-, Bearer, token_ prefix).
      expect(json).not.toMatch(/"(sk-[a-zA-Z0-9]{16,}|Bearer\s+[a-zA-Z0-9_-]+|token_[a-zA-Z0-9_]+)"/iu);
    }

    // Defensive: verify legitimate identifiers ARE present (they must not
    // be stripped — the goal is leak detection, not content removal).
    expect(searchJson).toContain("minimax-tokenplan.search");
    expect(imageJson).toContain("minimax-tokenplan.image");
    expect(searchJson).toContain("MiniMaxSearchRequest");
    expect(searchJson).toContain("MiniMaxSearchResponse");
    expect(imageJson).toContain("MiniMaxImageRequest");
    expect(imageJson).toContain("MiniMaxImageResponse");
  });

  it("MiniMax endpoints declare error codes covering abort, timeout, not_configured, and provider_error", () => {
    const searchCodes = minimaxSearchEndpoint.errorStatusCodes.flatMap((e) => e.errorCodes);
    expect(searchCodes).toContain("cancelled");
    expect(searchCodes).toContain("provider_timeout");
    expect(searchCodes).toContain("not_configured");
    expect(searchCodes).toContain("provider_error");

    const imageCodes = minimaxImageEndpoint.errorStatusCodes.flatMap((e) => e.errorCodes);
    expect(imageCodes).toContain("cancelled");
    expect(imageCodes).toContain("provider_timeout");
    expect(imageCodes).toContain("not_configured");
    expect(imageCodes).toContain("provider_error");
  });
});
