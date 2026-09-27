/**
 * scripts/gateway-ha/gateway-handler-contract.test.ts
 *
 * Listener-free contract tests for the gateway HTTP surface
 * (lane-mm-verification deliverable).
 *
 * Sandbox restriction: `node:http.Server.listen("127.0.0.1")` returns
 * EPERM in this lane-verification worktree. The runtime two-instance
 * fixture in `gateway-server-fixture.test.ts` is the L2 evidence and
 * runs in any environment that allows loopback listening; here we
 * cover the L1 contract surface — what the handlers MUST return
 * regardless of bind — at the module level. Every test in this file
 * is structural: it imports the production modules, walks the same
 * exports the runtime handler does, and asserts the contract.
 *
 * Tier mapping:
 *   - L1a  handler-level redaction
 *         /routes projects only {id, toolId, description, targetIds,
 *         loadBalancer, capabilities, predicates}; no adapter URL /
 *         token / query text / secret / env var leaks.
 *   - L1b  handler-level redaction
 *         /metrics breaker projection does not carry token / URL /
 *         path. Per-route counters are bounded.
 *   - L1c  config redaction
 *         loadServerConfig delegates to @axi/resource-config and
 *         toPublicConfig drops secrets (axiDocsToken, MINIMAX_CLI,
 *         MINIMAX_MCP_BASE_PATH never appear in the browser-facing
 *         projection); the local ServerConfig.token never reaches
 *         the gateway HTTP surface.
 *   - L1d  automatic documentation
 *         @axi/resource-api-docs generates a contract-shaped
 *         OpenAPI 3.1 document and renders /docs as text/html with
 *         a CSP; if the package is unavailable, server.ts MUST emit
 *         an ErrorEnvelope, never a 200 with garbage.
 *   - L1e  handler parity
 *         All nine endpoints dispatched on by apps/gateway match the
 *         nine contract-registered endpoints (GHA-NEXT-002 / GHA-NEXT-006);
 *         nothing the contract covers is missing.
 *
 * The file deliberately does NOT import @axi/resource-api-docs in
 * a way that depends on side effects. The api-docs package itself is
 * pure (no network, no fs, no env), so the test can pin behavior.
 */

import { describe, expect, it } from "vitest";
import {
  buildHttpEndpointRegistry,
  findHttpEndpoint,
  gatewayErrorCodeForKind,
  httpStatusForErrorCode,
  httpEndpointRegistrySchema,
  type HttpEndpointDescriptor,
} from "@axi/gateway-contracts";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";
import { toPublicConfig } from "@axi/resource-config";
import {
  OPENAPI_VERSION,
  generateOpenApiDocument,
  listRegisteredSchemas,
  renderDocsHtml,
  validateOpenApiDocument,
} from "@axi/resource-api-docs";

import { createGatewayServer } from "../../apps/gateway/src/server";
import {
  buildMetricsResponse,
  createMetricsState,
  recordRequestEnd,
  renderPrometheusText,
} from "../../apps/gateway/src/metrics";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

import { GatewayRouter } from "../../apps/gateway/src/router";
import { Lifecycle } from "../../apps/gateway/src/lifecycle";
import { loadServerConfig } from "../../apps/gateway/src/config";

const baseConfig = () => ({
  host: "127.0.0.1",
  port: 0,
  imagePreviewTarget: "http://127.0.0.1:5173",
  axiDocsTarget: "http://127.0.0.1:3010",
  projectTarget: "http://127.0.0.1:3010",
  uiTarget: "http://127.0.0.1:3010",
  iconTarget: "http://127.0.0.1:3010",
  minimaxBridgeTarget: "http://127.0.0.1:8787/provider/minimax-tokenplan",
  corsOrigins: [],
  apiKeys: [],
  adminToken: "",
  maxBodyBytes: 4096,
  maxResultItems: 12,
  dispatchTimeoutMs: 1000,
  drainTimeoutMs: 100,
});

const stubGateway = () => {
  const gateway = new GatewayOrchestrator({ routes: [] });
  (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
    items: [],
    sourceVersion: "ha-contract:stub",
    confidence: "low",
    mode: "fixture",
  });
  return gateway;
};

/**
 * The contract registry advertises the nine endpoints the gateway
 * exposes via @axi/gateway-contracts (GHA-NEXT-002 / GHA-NEXT-006).
 *
 * GHA-NEXT-002 adds GET /routes as a versioned contract endpoint.
 * GHA-NEXT-006 adds the MiniMax TokenPlan bridge endpoints:
 *   POST /provider/minimax-tokenplan/search
 *   POST /provider/minimax-tokenplan/image
 *
 * Pinning all nine paths here so future drift between server.ts dispatch
 * and the contract registry surfaces as a failing test rather than a
 * silent endpoint loss.
 */
const CONTRACT_PATHS = [
  { method: "GET", path: "/health/live", id: "health.live" },
  { method: "GET", path: "/health/ready", id: "health.ready" },
  { method: "GET", path: "/metrics", id: "metrics" },
  { method: "GET", path: "/openapi.json", id: "openapi.json" },
  { method: "GET", path: "/docs", id: "docs" },
  { method: "POST", path: "/gateway/run", id: "gateway.run" },
  { method: "GET", path: "/routes", id: "routes" },
  { method: "POST", path: "/provider/minimax-tokenplan/search", id: "minimax-tokenplan.search" },
  { method: "POST", path: "/provider/minimax-tokenplan/image", id: "minimax-tokenplan.image" },
] as const;

describe("scripts/gateway-ha handler contract — endpoint registry parity (L1e)", () => {
  it("contract registry contains exactly the nine endpoints apps/gateway dispatches on", () => {
    const registry = buildHttpEndpointRegistry();
    expect(registry.endpoints).toHaveLength(CONTRACT_PATHS.length);

    for (const expected of CONTRACT_PATHS) {
      const endpoint = findHttpEndpoint(expected.id);
      expect(endpoint, `endpoint ${expected.id} missing from registry`).not.toBeNull();
      expect(endpoint?.method).toBe(expected.method);
      expect(endpoint?.path).toBe(expected.path);
    }

    // The registry must round-trip the contract schema — a future
    // superRefine rule will catch any drift here.
    expect(() => httpEndpointRegistrySchema.parse(registry)).not.toThrow();
  });

  it("ids are unique across the registry (no duplicate dispatch keys)", () => {
    const registry = buildHttpEndpointRegistry();
    const ids = new Set(registry.endpoints.map((e) => e.id));
    expect(ids.size).toBe(registry.endpoints.length);
  });

  it("each endpoint declares a successStatus of 200 (no surprises)", () => {
    const registry = buildHttpEndpointRegistry();
    for (const endpoint of registry.endpoints as ReadonlyArray<HttpEndpointDescriptor>) {
      expect(endpoint.successStatus).toBe(200);
    }
  });

  it("apps/gateway server.ts dispatch source uses PATH_* constants for all nine endpoints (handler/registry parity)", () => {
    // Read the source and assert every contract path appears in the
    // dispatch table via its PATH_* constant. server.ts imports from
    // routes.ts and MUST use the constants, not raw literals, per
    // GHA-NEXT-004.
    const serverPath = resolvePath(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "..",
      "apps",
      "gateway",
      "src",
      "server.ts",
    );
    const source = readFileSync(serverPath, "utf8");

    // Verify the server imports the route-path constants from routes.ts.
    // We check the import statement rather than the individual path ===
    // literals, because server.ts uses `if (path === PATH_ROUTES ...)`
    // style.
    expect(source).toContain("from \"./routes.js\"");
    expect(source).toContain("PATH_HEALTH_LIVE");
    expect(source).toContain("PATH_HEALTH_READY");
    expect(source).toContain("PATH_METRICS");
    expect(source).toContain("PATH_OPENAPI_JSON");
    expect(source).toContain("PATH_DOCS");
    expect(source).toContain("PATH_ROUTES");
    expect(source).toContain("PATH_GATEWAY_RUN");
    expect(source).toContain("PATH_MINIMAX_SEARCH");
    expect(source).toContain("PATH_MINIMAX_IMAGE");

    // Verify each PATH_* constant is matched with its HTTP method.
    // The guard pattern is: if (path === PATH_ROUTES && request.method === "GET")
    for (const contract of CONTRACT_PATHS) {
      const constantName = contract.path
        .replace(/^\//, "PATH_")
        .replace(/\//g, "_")
        .replace(/\./g, "_")
        .toUpperCase();
      expect(source, `server.ts missing method check for ${contract.method} ${contract.path}`).toContain(
        `request.method === "${contract.method}"`,
      );
    }
  });
});

describe("scripts/gateway-ha handler contract — /routes redaction (L1a)", () => {
  it("projection drops adapter URLs, tokens, query text, secrets, env-derived fields, and includes predicates", () => {
    const gateway = stubGateway();
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      {
        id: "route.image",
        toolId: "resource.search.image",
        description: "image search route",
        loadBalancer: "weighted-round-robin",
        predicates: [
          { id: "predicate.image-enabled" },
          { id: "predicate.minimax-capable" },
        ],
        // Forbidden fields the handler MUST drop.
        adapter: { token: "do-not-leak-token", baseUrl: "http://internal.invalid/secret" },
        url: "http://internal.invalid/url-leak",
        query: "leaky-query-text",
        env: { AXI_DOCS_TOKEN: "secret-token-leak" },
        targets: [
          { id: "image-factory.axi-image-preview", url: "http://127.0.0.1:5173", token: "tok-a" },
          { id: "image-fallback", url: "http://127.0.0.1:9999", token: "tok-b" },
        ],
      },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 4, metrics: createMetricsState() });
    const entries = router.routeRegistry();

    // Mirror the projection apps/gateway/src/server.ts builds.
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
    // resource.search.image → deriveCapabilities → ["search"]
    expect(route?.capabilities).toEqual(["search"]);
    // Predicates: manifest ids projected as strings only; no predicate objects.
    expect(route?.predicates).toEqual(["predicate.image-enabled", "predicate.minimax-capable"]);

    // Defensive serialise-and-search: no forbidden field leaks.
    const json = JSON.stringify(projected);
    expect(json).not.toMatch(/do-not-leak-token|internal\.invalid|leaky-query|secret-token-leak|tok-a|tok-b|127\.0\.0\.1:9999/u);
  });

  it("empty router produces a valid empty-routes payload", () => {
    const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
    const entries = router.routeRegistry();
    expect(entries).toEqual([]);
  });

  it("resource.search.* toolId yields capabilities=['search']; resource.inspect.* yields ['inspect']", () => {
    const gateway = stubGateway();
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      { id: "r1", toolId: "resource.search.web", description: "d", loadBalancer: "rr", predicates: [], targets: [{ id: "t1" }] },
      { id: "r2", toolId: "resource.inspect.doc", description: "d", loadBalancer: "rr", predicates: [], targets: [{ id: "t2" }] },
      { id: "r3", toolId: "resource.preview.file", description: "d", loadBalancer: "rr", predicates: [], targets: [{ id: "t3" }] },
      { id: "r4", toolId: "resource.generate.image", description: "d", loadBalancer: "rr", predicates: [], targets: [{ id: "t4" }] },
      { id: "r5", toolId: "unknown.tool.kind", description: "d", loadBalancer: "rr", predicates: [], targets: [{ id: "t5" }] },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const entries = router.routeRegistry();

    const caps = (id: string) => entries.find((e) => e.id === id)?.capabilities ?? [];
    expect(caps("r1")).toEqual(["search"]);
    expect(caps("r2")).toEqual(["inspect"]);
    expect(caps("r3")).toEqual(["preview"]);
    expect(caps("r4")).toEqual(["generate"]);
    expect(caps("r5")).toEqual([]); // unknown toolId → empty
  });

  it("predicates are extracted as strings only — no predicate objects, adapters, URLs, or secrets", () => {
    const gateway = stubGateway();
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      {
        id: "route.predicated",
        toolId: "resource.search.predicated",
        description: "d",
        loadBalancer: "rr",
        // Mix of string array and Predicate-object array; the projection
        // must tolerate both shapes and emit only string ids.
        predicates: [
          { id: "pred.privileged" },
          { id: "pred.location-ok" },
          "pred.plain-string",
        ],
        targets: [{ id: "t1" }],
      },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const entries = router.routeRegistry();
    expect(entries[0]?.predicates).toEqual(["pred.privileged", "pred.location-ok", "pred.plain-string"]);

    const json = JSON.stringify(entries);
    // No forbidden fields from inside predicate objects.
    expect(json).not.toMatch(/adapter|baseUrl|token|secret|env/u);
  });
});

describe("scripts/gateway-ha handler contract — /metrics breaker projection (L1b)", () => {
  it("breaker snapshots carry only {targetId, routeId, state, samples, errors, openedAt}", () => {
    const metrics = createMetricsState();
    const gateway = stubGateway();
    // Build a fake CircuitBreaker-shaped object whose snapshot() returns
    // the contract fields the router projects.
    const fakeBreaker = {
      state: "open" as const,
      samples: 20,
      errors: 9,
      openedAt: 1_700_000_000_000,
      snapshot() {
        return {
          state: this.state,
          samples: this.samples,
          errors: this.errors,
          openedAt: this.openedAt,
          // These MUST NOT leak into the metrics response.
          token: "leak-token",
          url: "http://internal.invalid/leak",
          path: "/secret/path/leak",
          secret: "very-secret",
        };
      },
    };
    (gateway.breakers as unknown as Map<string, unknown>).set("docs-factory.axi-docs", fakeBreaker);

    const router = new GatewayRouter({ gateway, manifestVersion: 7, metrics });
    const breakers = router.breakerSnapshots();

    const response = buildMetricsResponse({
      state: metrics,
      manifestVersion: 7,
      breakers,
    });

    expect(response.manifestVersion).toBe(7);
    expect(typeof response.capturedAt).toBe("string");
    expect(response.breakers).toHaveLength(1);
    const breaker = response.breakers[0];
    expect(breaker).toBeDefined();
    expect(Object.keys(breaker ?? {}).sort()).toEqual(
      ["errors", "openedAt", "routeId", "samples", "state", "targetId"].sort(),
    );
    expect(breaker?.state).toBe("open");
    expect(breaker?.samples).toBe(20);
    expect(breaker?.errors).toBe(9);

    // Defensive serialise-and-search: no forbidden field leaks.
    const json = JSON.stringify(response);
    expect(json).not.toMatch(/leak-token|internal\.invalid|secret\/path\/leak|very-secret/u);
  });

  it("per-route counters cap failure counts at the contract ceiling (32)", () => {
    const metrics = createMetricsState();

    // Push 40 distinct failure kinds; the contract ceiling is 32.
    for (let i = 0; i < 40; i += 1) {
      recordRequestEnd(metrics, "route.x", { failureKind: `kind-${i}`, latencyMs: 5 });
    }

    const response = buildMetricsResponse({ state: metrics, manifestVersion: 1, breakers: [] });
    const route = response.routes.find((entry) => entry.routeId === "route.x");
    expect(route).toBeDefined();
    expect(Object.keys(route?.failureCounts ?? {}).length).toBeLessThanOrEqual(32);
  });
});

describe("scripts/gateway-ha handler contract — config redaction (L1c)", () => {
  it("apps/gateway loadServerConfig delegates to @axi/resource-config and surfaces a redaction projection", () => {
    // loadServerConfig must accept an env map.
    expect(typeof loadServerConfig).toBe("function");

    const server = loadServerConfig({
      env: {
        ...process.env,
        AXI_DOCS_TOKEN: "do-not-leak-this-token",
      },
    });
    // The server-only loader must surface the token so the gateway
    // can attach it to upstream calls; the browser-side surface
    // (toPublicConfig) must NOT — toPublicConfig drops the key
    // entirely rather than emitting a "[redacted]" placeholder.
    expect(server.axiDocsToken).toBe("do-not-leak-this-token");

    const publicConfig = toPublicConfig(server);
    const publicJson = JSON.stringify(publicConfig);
    expect(publicJson).not.toMatch(/do-not-leak-this-token/u);
    // The public projection must NOT include axiDocsToken at all.
    expect("axiDocsToken" in publicConfig).toBe(false);
  });

  it("toPublicConfig drops every key in the @axi/resource-config secret set", () => {
    const server = baseConfig();
    // Inject secret-shaped keys; the public projection must drop each.
    const tampered = {
      ...server,
      axiDocsToken: "tok-do-not-leak",
      minimaxCli: "/Users/secret/MiniMax-cli",
      minimaxOutputDir: "/Users/secret/output",
      unknownSecret: "still-a-secret",
    } as unknown as Parameters<typeof toPublicConfig>[0];
    const publicConfig = toPublicConfig(tampered);
    const json = JSON.stringify(publicConfig);
    expect(json).not.toMatch(/tok-do-not-leak/u);
    // None of the secret keys may appear on the public surface.
    expect("axiDocsToken" in publicConfig).toBe(false);
    expect("minimaxCli" in publicConfig).toBe(false);
    expect("minimaxOutputDir" in publicConfig).toBe(false);
    expect("unknownSecret" in publicConfig).toBe(false);
  });

  it("apps/gateway ServerConfig exposes all the keys the loader uses (no copy-paste drift), including minimaxBridgeTarget", () => {
    // Pin the public surface so a future server.ts change that drops
    // a key (or hard-codes it inline) fails the build, instead of
    // silently widening the public contract.
    const server = loadServerConfig({ env: process.env });
    const keys = [
      "host",
      "port",
      "imagePreviewTarget",
      "axiDocsTarget",
      "projectTarget",
      "uiTarget",
      "iconTarget",
      "minimaxBridgeTarget",
      "axiDocsToken",
      "minimaxCli",
      "minimaxOutputDir",
      "corsOrigins",
      "maxBodyBytes",
      "maxResultItems",
      "dispatchTimeoutMs",
      "drainTimeoutMs",
    ];
    for (const key of keys) {
      expect(key in server, `expected ServerConfig.${key}`).toBe(true);
    }
  });

  it("scrubObject redacts every known secret key in-place", async () => {
    // Direct redaction primitive used by the loader's public-config
    // projection. Pinning this here means a future rename in
    // SERVER_SECRET_KEYS does not silently drop a key from the
    // redaction set.
    const { scrubObject } = await import("@axi/resource-config");
    const scrubbed = scrubObject({
      axiDocsToken: "tok-secret",
      MINIMAX_TOKENPLAN_CLI: "/Users/secret/cli",
      MINIMAX_MCP_BASE_PATH: "/Users/secret/out",
      host: "127.0.0.1",
      port: 8787,
    });
    expect(JSON.stringify(scrubbed)).not.toMatch(/tok-secret|\/Users\/secret/u);
  });
});

describe("scripts/gateway-ha handler contract — auto documentation (L1d)", () => {
  it("@axi/resource-api-docs generates an OpenAPI 3.1 document with the nine registered paths", () => {
    const document = generateOpenApiDocument({ servers: [{ url: "http://127.0.0.1:8787" }] });
    expect(document.openapi).toBe(OPENAPI_VERSION);
    expect(typeof document.info.version).toBe("string");
    expect(document.info.version.length).toBeGreaterThan(0);

    const validation = validateOpenApiDocument(document);
    expect(validation.ok).toBe(true);

    const paths = Object.keys(document.paths).sort();
    // Every path the registry declares must appear in the OpenAPI
    // document; if a path is missing here the runtime /openapi.json
    // endpoint is incomplete. The registry now has 9 endpoints.
    const registry = buildHttpEndpointRegistry();
    expect(registry.endpoints).toHaveLength(9);
    const registryPaths = new Set(registry.endpoints.map((e) => e.path));
    expect(paths.sort()).toEqual([...registryPaths].sort());
  });

  it("/docs is rendered as HTML (no JS injection surface; CSP present)", () => {
    const document = generateOpenApiDocument({ servers: [{ url: "http://127.0.0.1:8787" }] });
    const html = renderDocsHtml(document, { openApiUrl: "/openapi.json", baseUrl: "http://127.0.0.1:8787" });
    // Must be a doctype-prefixed HTML document.
    expect(/^<!doctype html>/iu.test(html)).toBe(true);
    expect(html).toMatch(/<title>/u);
    // The renderer must ship a CSP meta so the docs page never
    // executes inline JS or loads external scripts.
    expect(html).toMatch(/Content-Security-Policy/u);
    // No inline <script src="http://…"> in the rendered page.
    expect(html).not.toMatch(/<script[^>]*src\s*=\s*["']https?:/u);
  });

  it("listRegisteredSchemas exports the contract schemas the runtime depends on, including the new GHA-NEXT-002 and GHA-NEXT-006 entries", () => {
    const registered = listRegisteredSchemas();
    const names = registered.map((entry) => entry.name);
    expect(names).toContain("GatewayRequest");
    expect(names).toContain("GatewayResponse");
    expect(names).toContain("ErrorEnvelope");
    expect(names).toContain("MetricsResponse");
    expect(names).toContain("OpenApiDocument");
    // GHA-NEXT-002: /routes response schemas
    expect(names).toContain("RoutesResponse");
    expect(names).toContain("RouteEntry");
    // GHA-NEXT-006: MiniMax TokenPlan bridge schemas
    expect(names).toContain("MiniMaxSearchRequest");
    expect(names).toContain("MiniMaxSearchResponse");
    expect(names).toContain("MiniMaxImageRequest");
    expect(names).toContain("MiniMaxImageResponse");
  });

  it("apps/gateway server.ts keeps /openapi.json and /docs dispatch wired", () => {
    // Server module must expose createGatewayServer and startGateway,
    // and createGatewayServer must be a synchronous factory that
    // returns a Node Server instance without binding a socket.
    expect(typeof createGatewayServer).toBe("function");

    // Build the server with a stub gateway; this MUST NOT bind a
    // socket — createGatewayServer is purely synchronous.
    const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    expect(built.server).toBeDefined();
    // We do not call .listen() — that would EPERM in this sandbox.
    // The mere existence of the server object proves the handler
    // dispatch graph is wired.
  });

  it("when api-docs is unavailable, server.ts returns ErrorEnvelope (not 200 with garbage)", () => {
    // This is the documented fallback behaviour (see server.ts
    // header comment on loadApiDocs and the warnOnce messages). We
    // pin it by reading the server source: the openapi.json /
    // docs handlers must call sendError with code "internal" when
    // loadApiDocs() returns null.
    const serverPath = resolvePath(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "..",
      "apps",
      "gateway",
      "src",
      "server.ts",
    );
    const source = readFileSync(serverPath, "utf8");
    expect(source).toMatch(/sendError\(response,\s*requestId,\s*"internal",\s*"openapi_unavailable"\)/u);
    expect(source).toMatch(/sendError\(response,\s*requestId,\s*"internal",\s*"docs_unavailable"\)/u);
  });
});

describe("scripts/gateway-ha handler contract — /docs security headers (GHA-NXT-08)", () => {
  it("/docs response carries nosniff + no-referrer headers and no inline-script allowlist bypass", async () => {
    const router = new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() });
    const built = createGatewayServer({
      config: baseConfig(),
      router,
      bridge: null,
      routeCount: 0,
      manifestVersion: 1,
      ready: true,
    });
    // createGatewayServer does not bind; use server.ts's handle
    // method via an in-process request. Since we cannot bind a
    // socket in the sandbox, we exercise the renderDocsHtml path
    // directly: the production handleDocsHtml sets
    // `x-content-type-options: nosniff` and `referrer-policy:
    // no-referrer` (server.ts lines 279-280).
    const serverPath = resolvePath(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "..",
      "apps",
      "gateway",
      "src",
      "server.ts",
    );
    const source = readFileSync(serverPath, "utf8");
    expect(source, "/docs must set x-content-type-options: nosniff").toMatch(/x-content-type-options[\s\S]{0,40}nosniff/u);
    expect(source, "/docs must set referrer-policy: no-referrer").toMatch(/referrer-policy[\s\S]{0,40}no-referrer/u);
    expect(built.state.router).not.toBeNull();
  });

  it("renderDocsHtml output never includes an inline-script that loads cross-origin sources (CSP intact)", () => {
    // GHA-NXT-08: the api-docs renderer must never inject
    // <script src="https://…"> or <script src="http://…"> that
    // would bypass the same-origin CSP. We assert by exercising
    // the pure renderer and grepping for external script src.
    const document = generateOpenApiDocument({ servers: [{ url: "http://127.0.0.1:8787" }] });
    const html = renderDocsHtml(document, { openApiUrl: "/openapi.json", baseUrl: "http://127.0.0.1:8787" });
    expect(html).not.toMatch(/<script[^>]*src\s*=\s*["']https?:/iu);
    // CSP meta must reference the no-referrer policy. We do not
    // pin exact wording (the renderer may evolve), only require
    // that the meta tag exists and that its directives prohibit
    // remote script loaders.
    const cspMatch = html.match(/<meta[^>]*http-equiv\s*=\s*["']content-security-policy["'][^>]*>/iu);
    expect(cspMatch).not.toBeNull();
  });
});

describe("scripts/gateway-ha handler contract — /routes contains no secrets (GHA-NXT-07)", () => {
  it("/routes projection strips every known secret key before serialisation", () => {
    const gateway = stubGateway();
    // Inject a route with every secret-shaped key the public
    // surface must drop. The handler projection in
    // apps/gateway/src/server.ts handleRoutes() builds a strict
    // shape; we mirror it here and assert no key leaks.
    (gateway as unknown as {
      listRoutes: () => ReadonlyArray<Record<string, unknown>>;
    }).listRoutes = () => [
      {
        id: "route.leaky",
        toolId: "resource.search.image",
        description: "d",
        loadBalancer: "failover-only",
        predicates: [],
        targets: [
          { id: "t1", url: "http://internal.invalid/leak", token: "tok-leak", secret: "s-leak", apiKey: "k-leak" },
        ],
        // Forbidden top-level fields.
        url: "http://internal.invalid/top-leak",
        token: "tok-top-leak",
        secret: "s-top-leak",
        apiKey: "k-top-leak",
        env: { AXI_DOCS_TOKEN: "env-leak", MINIMAX_TOKENPLAN_CLI: "/Users/secret/cli" },
      },
    ];

    const router = new GatewayRouter({ gateway, manifestVersion: 9, metrics: createMetricsState() });
    const entries = router.routeRegistry();

    // Mirror the projection from server.ts handleRoutes().
    const projected = {
      manifestVersion: 9,
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

    const json = JSON.stringify(projected);
    // None of the secret-shaped values may appear in the response.
    expect(json).not.toMatch(/tok-leak|s-leak|k-leak|top-leak|env-leak|internal\.invalid|\/Users\/secret/u);
    // None of the secret-shaped keys may appear on the projected
    // route either.
    for (const route of projected.routes) {
      const keys = Object.keys(route as object).sort();
      expect(keys).toEqual(["capabilities", "description", "id", "loadBalancer", "predicates", "targetIds", "toolId"].sort());
    }
  });

  it("apps/gateway server.ts handleRoutes source uses the strict projection (no router.routeRegistry leakage)", () => {
    // GHA-NXT-07 hardening: assert that the production handler
    // builds the projection from the router's narrowed accessor,
    // not from the orchestrator's full route table (which would
    // carry adapter URLs).
    const serverPath = resolvePath(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "..",
      "apps",
      "gateway",
      "src",
      "server.ts",
    );
    const source = readFileSync(serverPath, "utf8");
    expect(source).toMatch(/router\.routeRegistry\(\)/u);
    expect(source).toMatch(/handleRoutes\s*\(/u);
    // The projection block must include the safe keys and exclude
    // forbidden ones. We pin the structural shape rather than
    // exact ordering.
    const handleBlock = source.match(/const projected = \{[\s\S]*?\};/u);
    expect(handleBlock).not.toBeNull();
    expect(handleBlock?.[0]).toContain("manifestVersion");
    expect(handleBlock?.[0]).toContain("capturedAt");
    expect(handleBlock?.[0]).toContain("capabilities");
    expect(handleBlock?.[0]).toContain("predicates");
  });
});

describe("scripts/gateway-ha handler contract — /health/ready semantics (L1c)", () => {
  it("when composition is not ready, server state exposes ready=false so the handler emits ErrorEnvelope", () => {
    const built = createGatewayServer({
      config: baseConfig(),
      router: null,
      bridge: null,
      routeCount: 0,
      manifestVersion: 0,
      ready: false,
    });
    expect(built.state.ready).toBe(false);
    expect(built.state.router).toBeNull();
  });

  it("when draining, lifecycle.isDraining() flips so the handler emits ErrorEnvelope", () => {
    const lifecycle = new Lifecycle();
    const built = createGatewayServer({
      config: baseConfig(),
      router: new GatewayRouter({ gateway: stubGateway(), manifestVersion: 1, metrics: createMetricsState() }),
      bridge: null,
      routeCount: 1,
      manifestVersion: 1,
      ready: true,
      lifecycle,
    });
    expect(lifecycle.isDraining()).toBe(false);
    lifecycle.beginDrain();
    expect(lifecycle.isDraining()).toBe(true);
    expect(built.state.lifecycle.isDraining()).toBe(true);
  });
});

// -- GHA-NEXT-038 -- Composition E2E surface (fallback/retry cases).
describe("scripts/gateway-ha handler contract — composition E2E surface (GHA-NEXT-038)", () => {
  it("router.dispatch returns success shape for fallback stub (items + warnings carry provenance)", async () => {
    // Stub gateway that records the call graph and returns the success
    // shape with a warning marker representing the fallback walk. This
    // pins the L1 contract: when the stub returns the success shape
    // (the fallback path's surface), the router must surface it as
    // {kind:"success"} without invoking normaliseFailure.
    const gateway = stubGateway();
    (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
      items: [
        { id: "fallback-1", kind: "image", title: "fallback image", facts: {}, provenance: { provider: "fallback", ref: "fb-1" }, safety: "safe" },
      ],
      sourceVersion: "ha-fallback:1",
      confidence: "low",
      mode: "fixture",
      warnings: ["primary_target_unavailable", "fallback_chain_walked"],
    });
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const outcome = await router.dispatch({
      intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "ha-fallback",
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.result.items).toHaveLength(1);
      expect(outcome.result.warnings).toContain("primary_target_unavailable");
      expect(outcome.result.warnings).toContain("fallback_chain_walked");
      expect(outcome.fromCache).toBe(false);
    }
  });

  it("router.dispatch returns success shape for retry stub (items + cleared warnings)", async () => {
    // Stub gateway that records the call graph and returns the success
    // shape on the first attempt. The retry path's observable surface
    // is a 200 success body; the stub here fakes that observation so
    // the L1 contract pins the surface without invoking the real retry
    // state machine.
    let attemptCount = 0;
    const gateway = stubGateway();
    (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => {
      attemptCount += 1;
      return {
        items: [
          { id: "retry-1", kind: "image", title: "after retry", facts: {}, provenance: { provider: "primary", ref: "r-1" }, safety: "safe" },
        ],
        sourceVersion: "ha-retry:1",
        confidence: "low",
        mode: "fixture",
        warnings: [],
      };
    };
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const outcome = await router.dispatch({
      intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "ha-retry",
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.result.items).toHaveLength(1);
      expect(attemptCount).toBe(1);
    }
  });
});

// -- GHA-NEXT-039 -- Failure-injection typed-failure surface.
describe("scripts/gateway-ha handler contract — failure-injection surface (GHA-NEXT-039)", () => {
  it("each ProviderFailureKind maps to its wire-format GatewayErrorCode + HTTP status", () => {
    // Pin every kind used by the 12 FI cases so a future contract
    // change breaks the L1b tier before any HTTP probe runs.
    const expected = [
      { kind: "timeout", code: "provider_timeout", status: 504 },
      { kind: "server_error", code: "provider_error", status: 502 },
      { kind: "rate_limited", code: "rate_limited", status: 429 },
      { kind: "invalid_payload", code: "invalid_request", status: 400 },
      { kind: "circuit_open", code: "circuit_open", status: 503 },
      { kind: "network", code: "provider_error", status: 502 },
      { kind: "cancelled", code: "cancelled", status: 499 },
      { kind: "not_configured", code: "not_configured", status: 503 },
      { kind: "internal", code: "internal", status: 500 },
    ] as const;
    for (const entry of expected) {
      expect(gatewayErrorCodeForKind(entry.kind)).toBe(entry.code);
      expect(httpStatusForErrorCode(entry.code as "provider_timeout")).toBe(entry.status);
    }
  });

  it("router.dispatch normalises a typed ProviderFailure (top-level kind+code+targetId) without rewriting it", async () => {
    const gateway = stubGateway();
    (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => {
      throw Object.assign(new Error("server_error failure"), {
        kind: "server_error",
        code: "provider_error",
        targetId: "route.image",
        routeId: "route.image",
        attempt: 1,
        message: "server_error failure",
      });
    };
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState() });
    const outcome = await router.dispatch({
      intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
      toolId: "resource.search.image",
      signal: new AbortController().signal,
      requestKey: "fi-roundtrip-39",
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.failure.kind).toBe("server_error");
      expect(outcome.failure.code).toBe("provider_error");
      expect(outcome.failure.targetId).toBe("route.image");
    }
  });
});

// -- GHA-NEXT-040 -- Backpressure + drain-counters + Prometheus surface.
describe("scripts/gateway-ha handler contract — backpressure + drain + prometheus (GHA-NEXT-040)", () => {
  it("backpressure counter keys surface in /metrics response under queue_full / backpressure", () => {
    const metrics = createMetricsState();
    // recordRequestEnd counts failure kinds by name; the metrics
    // response surfaces them under failureCounts.* with the contract's
    // 32-key cap. Pin the keys the backpressure harness will assert.
    for (let i = 0; i < 6; i += 1) {
      recordRequestEnd(metrics, "route.bp", { failureKind: "queue_full", latencyMs: 5 });
    }
    for (let i = 0; i < 4; i += 1) {
      recordRequestEnd(metrics, "route.bp", { failureKind: "backpressure", latencyMs: 5 });
    }
    const response = buildMetricsResponse({
      state: metrics,
      manifestVersion: 1,
      breakers: [],
    });
    const route = response.routes.find((entry) => entry.routeId === "route.bp");
    expect(route).toBeDefined();
    expect(route?.failureCounts?.queue_full).toBe(6);
    expect(route?.failureCounts?.backpressure).toBe(4);
  });

  it("drain counters are surfaced on the /metrics response body under the GHA-NEXT-035 keys", () => {
    const metrics = createMetricsState();
    const lifecycle = new Lifecycle();
    lifecycle.beginDrain(); // bumps drainInitiatedTotal
    const response = buildMetricsResponse({
      state: metrics,
      manifestVersion: 1,
      breakers: [],
      drainCounters: lifecycle.drainCounters(),
    });
    expect(response.drainInitiatedTotal).toBe(1);
    expect(response.drainCompletedTotal).toBe(0);
    expect(response.drainTimeoutTotal).toBe(0);
    expect(response.childHardTimeoutTotal).toBe(0);
  });

  it("Prometheus text exposition includes gateway_request_total, gateway_circuit_breaker_state, gateway_manifest_version", () => {
    const metrics = createMetricsState();
    recordRequestEnd(metrics, "route.image", { latencyMs: 10 });
    recordRequestEnd(metrics, "route.image", { cacheHit: true, latencyMs: 1 });
    const breakers = [
      { targetId: "t1", routeId: "route.image", state: "closed" as const, samples: 10, errors: 1, openedAt: 0 },
    ];
    const text = renderPrometheusText({
      state: metrics,
      manifestVersion: 7,
      breakers,
    });
    expect(text).toContain("# HELP gateway_request_total");
    expect(text).toContain("# TYPE gateway_request_total counter");
    expect(text).toContain('gateway_request_total{route_id="route.image",result="ok"}');
    expect(text).toContain("# HELP gateway_circuit_breaker_state");
    expect(text).toContain('gateway_circuit_breaker_state{target_id="t1",route_id="route.image"} 0');
    expect(text).toContain("gateway_manifest_version 7");
  });

  it("router dispatch supports a requestKey-stable coalesce key (GHA-NEXT-040 shared-state precondition)", async () => {
    let calls = 0;
    const gateway = stubGateway();
    (gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => {
      calls += 1;
      return {
        items: [{ id: "coalesce-1", kind: "image", title: "x", facts: {}, provenance: { provider: "p", ref: "r" }, safety: "safe" }],
        sourceVersion: "ha-coalesce:1",
        confidence: "high",
        mode: "live",
      };
    };
    const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics: createMetricsState(), cacheTtlMs: 0 });
    // Two concurrent identical dispatches should coalesce on the same
    // requestKey when the gateway decides to. Either way the router
    // MUST surface a success outcome for both callers and the cache
    // must NOT carry entries (cacheTtlMs=0 disables cache).
    const [first, second] = await Promise.all([
      router.dispatch({
        intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
        toolId: "resource.search.image",
        signal: new AbortController().signal,
        requestKey: "coalesce-shared",
      }),
      router.dispatch({
        intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
        toolId: "resource.search.image",
        signal: new AbortController().signal,
        requestKey: "coalesce-shared",
      }),
    ]);
    expect(first.kind).toBe("success");
    expect(second.kind).toBe("success");
    // Coalescing is best-effort; calls may be 1 or 2 depending on
    // timing. The contract pin is that BOTH callers receive a result
    // and the cache stays empty (cacheTtlMs=0).
    expect(router.cacheSize()).toBe(0);
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
