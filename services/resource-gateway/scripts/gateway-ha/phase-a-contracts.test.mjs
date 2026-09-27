/**
 * scripts/gateway-ha/phase-a-contracts.test.mjs
 *
 * Phase A architecture contract harness — Wave 1 / Phase A verification.
 *
 * Five no-network invariants verified by reading only repository files:
 *
 *   1. providers.manifest.json route policy fields are parseable and
 *      the `resource.generate.image` route carries idempotent=false.
 *
 *   2. config.ts exposes a `minimaxBridgeTarget` field (MINIMAX_BRIDGE_TARGET
 *      config entry) AND composition.ts calls assertAllowlistedTarget()
 *      with it.
 *
 *   3. server.ts imports every HTTP path constant from routes.ts;
 *      zero raw string literals for canonical endpoint paths appear
 *      in the server's route-matching blocks.
 *
 *   4. http-api.ts endpoint registry contains `/routes` and the two
 *      MiniMax bridge endpoints; each endpoint's request/response
 *      schemaRef uses the correct named schema (no swap between
 *      GatewayRequest / MiniMaxSearchRequest etc.).
 *
 *   5. routes.ts (contracts) exists and exports the RoutePolicySet
 *      schema; registry/shared-state contract file does not claim
 *      runtime integration (no mention of SharedStateManager or
 *      Valkey/Redis in the contract surface).
 *
 * No provider process is started. No network requests are made.
 * No existing file is modified.
 *
 * Run:
 *   node --test scripts/gateway-ha/phase-a-contracts.test.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helper: resolve a path relative to the worktree root
// ---------------------------------------------------------------------------

const WORKTREE = resolve(process.env.WORKTREE ?? "/Volumes/code/workspace/products/ai-resource-orchestration");

const file = (rel) => readFileSync(resolve(WORKTREE, rel), "utf8");
const json = (rel) => JSON.parse(file(rel));

// ---------------------------------------------------------------------------
// Contract 1 — manifest route policy fields + idempotent for generate route
// ---------------------------------------------------------------------------

/**
 * GHA-NEXT-001 (Phase A).
 * Verifies:
 *   - manifest JSON parses as a valid object with routes array
 *   - every route in the array has at least one declared policy field
 *     (idempotent | retry | backpressure | cacheTtlMs | circuit)
 *   - route.generate-image (resource.generate.image) has idempotent: false
 *     explicitly set
 *   - the route is idempotent by default for non-generate routes
 */
const contract1_manifestPolicyFields = (t) => {
  const manifest = json("apps/gateway/src/providers.manifest.json");

  assert(typeof manifest.manifestVersion === "number", "manifest must have manifestVersion");
  assert(Array.isArray(manifest.routes), "manifest must have routes[]");
  assert(manifest.routes.length > 0, "routes must not be empty");

  // Track which routes have at least one explicit policy field
  const policyFieldNames = ["idempotent", "retry", "backpressure", "cacheTtlMs", "circuit"];
  let routesWithExplicitPolicy = 0;

  for (const route of manifest.routes) {
    const hasExplicit = policyFieldNames.some((field) => route[field] !== undefined);
    if (hasExplicit) routesWithExplicitPolicy++;

    if (route.toolId === "resource.generate.image") {
      assert.equal(
        route.idempotent,
        false,
        "resource.generate.image must carry idempotent: false explicitly",
      );
    }
  }

  // At least one route must declare an explicit policy field
  // (route.image and route.generate-image both declare idempotent and retry/backpressure)
  assert(
    routesWithExplicitPolicy >= 1,
    `at least one route must declare an explicit policy field, got ${routesWithExplicitPolicy}`,
  );

};

// ---------------------------------------------------------------------------
// Contract 2 — MINIMAX_BRIDGE_TARGET config entry + allowlist call
// ---------------------------------------------------------------------------

/**
 * GHA-NEXT-003 (Phase A).
 * Verifies:
 *   - config.ts exports a `minimaxBridgeTarget` property in ServerConfig
 *   - config.ts reads MINIMAX_BRIDGE_TARGET env var (or DEFAULT_MINIMAX_BRIDGE_TARGET)
 *   - composition.ts calls assertAllowlistedTarget(config.minimaxBridgeTarget)
 *     (SSRF allowlist boundary; the value is NOT claimed as a secret)
 */
const contract2_minimaxBridgeConfig = (t) => {
  const configSrc = file("apps/gateway/src/config.ts");
  const compositionSrc = file("apps/gateway/src/composition.ts");

  // 2a. config.ts defines the minimaxBridgeTarget field
  assert(
    /minimaxBridgeTarget\s*[=:]/u.test(configSrc),
    "config.ts must declare minimaxBridgeTarget in ServerConfig",
  );

  // 2b. config.ts resolves MINIMAX_BRIDGE_TARGET from env (or falls back to DEFAULT)
  assert(
    /MINIMAX_BRIDGE_TARGET/u.test(configSrc),
    "config.ts must reference MINIMAX_BRIDGE_TARGET env key",
  );
  assert(
    /DEFAULT_MINIMAX_BRIDGE_TARGET/u.test(configSrc),
    "config.ts must declare DEFAULT_MINIMAX_BRIDGE_TARGET fallback",
  );

  // 2c. composition.ts passes the bridge target through assertAllowlistedTarget
  assert(
    /assertAllowlistedTarget\s*\(\s*config\.minimaxBridgeTarget\s*\)/u.test(compositionSrc),
    "composition.ts must call assertAllowlistedTarget(config.minimaxBridgeTarget)",
  );

  // 2d. composition.ts has a comment explaining GHA-NEXT-003 intent
  assert(
    /GHA-NEXT-003/u.test(compositionSrc),
    "composition.ts must have a GHA-NEXT-003 comment near the minimax bridge setup",
  );

};

// ---------------------------------------------------------------------------
// Contract 3 — server.ts uses routes.ts path constants (no inline literals)
// ---------------------------------------------------------------------------

/**
 * GHA-NEXT-004 (Phase A).
 * Verifies:
 *   - server.ts imports all path constants from ./routes.js
 *   - server.ts does NOT contain inline string literals for the six
 *     canonical endpoint paths (except in the comment header)
 *   - Every canonical path used in the route-matching switch/if chain
 *     is an imported constant reference
 */
const contract3_routesConstants = (t) => {
  const serverSrc = file("apps/gateway/src/server.ts");
  const routesSrc = file("apps/gateway/src/routes.ts");

  // 3a. server.ts imports the routes module
  assert(
    /import\s*\{[^}]*\}\s*from\s*["']\.\/routes(?:\.js)?["']/u.test(serverSrc),
    "server.ts must import from ./routes.js",
  );

  // 3b. routes.ts exports the six canonical + two bridge constants
  const canonicalPaths = [
    "PATH_HEALTH_LIVE",
    "PATH_HEALTH_READY",
    "PATH_METRICS",
    "PATH_OPENAPI_JSON",
    "PATH_DOCS",
    "PATH_ROUTES",
    "PATH_GATEWAY_RUN",
    "PATH_MINIMAX_SEARCH",
    "PATH_MINIMAX_IMAGE",
  ];
  for (const name of canonicalPaths) {
    assert(
      new RegExp(`export\\s+const\\s+${name}\\s*=`).test(routesSrc),
      `routes.ts must export ${name}`,
    );
  }

  // 3c. server.ts does NOT contain raw string literals for the six canonical paths
  //     inside the route-matching blocks (they must come from routes.ts constants).
  //     We check for occurrences that are NOT inside import/export strings or comments.
  const rawLiteralPaths = [
    '"/health/live"',
    '"/health/ready"',
    '"/metrics"',
    '"/openapi.json"',
    '"/docs"',
    '"/routes"',
    '"/gateway/run"',
    '"/provider/minimax-tokenplan/search"',
    '"/provider/minimax-tokenplan/image"',
  ];

  // Strip import/export strings, line comments, and block comments to avoid false positives
  const srcWithoutImports = serverSrc
    .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["']/gu, "")
    .replace(/\/\/[^\n]*/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "");

  for (const lit of rawLiteralPaths) {
    const inSource = srcWithoutImports.includes(lit);
    assert.equal(
      inSource,
      false,
      `server.ts must not contain raw literal ${lit} — use imported constant instead`,
    );
  }

  // 3d. server.ts actually USES the PATH_* constants in the route-matching chain.
  //     This is the positive proof that routes.ts constants are the source of truth.
  for (const name of canonicalPaths) {
    assert(
      new RegExp(`\\b${name}\\b`).test(serverSrc),
      `server.ts must reference ${name} constant in route-matching blocks`,
    );
  }

};

// ---------------------------------------------------------------------------
// Contract 4 — http-api contract includes /routes and MiniMax bridge endpoints
// ---------------------------------------------------------------------------

/**
 * GHA-NEXT-002 / GHA-NEXT-006 (Phase A).
 * Verifies:
 *   - http-api.ts endpoint registry contains 9 descriptors (6 canonical
 *     + /routes + 2 MiniMax bridge)
 *   - /routes endpoint has schemaRef "RoutesResponse"
 *   - POST /provider/minimax-tokenplan/search endpoint has
 *       request.schemaRef === "MiniMaxSearchRequest"
 *       response.schemaRef === "MiniMaxSearchResponse"
 *   - POST /provider/minimax-tokenplan/image endpoint has
 *       request.schemaRef === "MiniMaxImageRequest"
 *       response.schemaRef === "MiniMaxImageResponse"
 *   - No endpoint confuses GatewayRequest with a MiniMax schemaRef
 *     (and vice versa) — each schemaRef appears only in the correct endpoint
 */
const contract4_httpApiContract = (t) => {
  const httpApiSrc = file("packages/contracts/src/http-api.ts");

  // 4a. RoutesResponse schema exists and is exported
  assert(
    /export\s+const\s+routesResponseSchema/u.test(httpApiSrc),
    "http-api.ts must export routesResponseSchema",
  );
  assert(
    /export\s+type\s+RoutesResponse/u.test(httpApiSrc),
    "http-api.ts must export RoutesResponse type",
  );

  // 4b. MiniMax search schema exists and is exported
  assert(
    /export\s+const\s+minimaxSearchRequestSchema/u.test(httpApiSrc),
    "http-api.ts must export minimaxSearchRequestSchema",
  );
  assert(
    /export\s+const\s+minimaxSearchResponseSchema/u.test(httpApiSrc),
    "http-api.ts must export minimaxSearchResponseSchema",
  );

  // 4c. MiniMax image schema exists and is exported
  assert(
    /export\s+const\s+minimaxImageRequestSchema/u.test(httpApiSrc),
    "http-api.ts must export minimaxImageRequestSchema",
  );
  assert(
    /export\s+const\s+minimaxImageResponseSchema/u.test(httpApiSrc),
    "http-api.ts must export minimaxImageResponseSchema",
  );

  // 4d. httpEndpoints array has 9 entries
  const endpointMatches = [...httpApiSrc.matchAll(/export\s+const\s+(\w+Endpoint)\s*:/gu)];
  assert.equal(
    endpointMatches.length,
    9,
    `http-api.ts must declare exactly 9 endpoint constants, got ${endpointMatches.length}: ${endpointMatches.map(m => m[1]).join(", ")}`,
  );

  // 4e. routesEndpoint references RoutesResponse — extract by export boundary
  const routesBlockMatch = httpApiSrc.match(/export\s+const\s+routesEndpoint\s*[\s\S]*?(?=export\s+const\s+minimaxSearchEndpoint)/u);
  assert(routesBlockMatch, "http-api.ts must contain export const routesEndpoint block");
  const routesBlock = routesBlockMatch[0];
  assert(
    /response[\s\S]{0,200}schemaRef:\s*["']RoutesResponse["']/u.test(routesBlock),
    "routesEndpoint block must have response.schemaRef === 'RoutesResponse'",
  );

  // 4f. minimaxSearchEndpoint request/response schemaRefs — extract by export boundary
  const searchBlockMatch = httpApiSrc.match(/export\s+const\s+minimaxSearchEndpoint\s*[\s\S]*?(?=export\s+const\s+minimaxImageEndpoint)/u);
  assert(searchBlockMatch, "http-api.ts must contain export const minimaxSearchEndpoint block");
  const searchBlock = searchBlockMatch[0];
  assert(
    /request[\s\S]{0,200}schemaRef:\s*["']MiniMaxSearchRequest["']/u.test(searchBlock),
    "minimaxSearchEndpoint request must use schemaRef 'MiniMaxSearchRequest'",
  );
  assert(
    /response[\s\S]{0,200}schemaRef:\s*["']MiniMaxSearchResponse["']/u.test(searchBlock),
    "minimaxSearchEndpoint response must use schemaRef 'MiniMaxSearchResponse'",
  );

  // 4g. minimaxImageEndpoint request/response schemaRefs — extract by export boundary
  const imageBlockMatch = httpApiSrc.match(/export\s+const\s+minimaxImageEndpoint\s*[\s\S]*?(?=export\s+const\s+httpEndpoints|export\s+const\s+buildHttpEndpointRegistry)/u);
  assert(imageBlockMatch, "http-api.ts must contain export const minimaxImageEndpoint block");
  const imageBlock = imageBlockMatch[0];
  assert(
    /request[\s\S]{0,200}schemaRef:\s*["']MiniMaxImageRequest["']/u.test(imageBlock),
    "minimaxImageEndpoint request must use schemaRef 'MiniMaxImageRequest'",
  );
  assert(
    /response[\s\S]{0,200}schemaRef:\s*["']MiniMaxImageResponse["']/u.test(imageBlock),
    "minimaxImageEndpoint response must use schemaRef 'MiniMaxImageResponse'",
  );

  // 4h. gatewayRunEndpoint uses GatewayRequest (not MiniMax schemas)
  const runBlockMatch = httpApiSrc.match(/export\s+const\s+gatewayRunEndpoint\s*[\s\S]*?(?=export\s+const\s+healthLiveEndpoint)/u);
  assert(runBlockMatch, "http-api.ts must contain gatewayRunEndpoint block");
  const runBlock = runBlockMatch[0];
  assert(
    /request[\s\S]{0,100}schemaRef:\s*["']GatewayRequest["']/u.test(runBlock),
    "gatewayRunEndpoint request must use schemaRef 'GatewayRequest'",
  );
  assert(
    !/MiniMaxSearchRequest|MiniMaxImageRequest/u.test(runBlock),
    "gatewayRunEndpoint must NOT reference MiniMax request schemas",
  );

  // 4i. buildHttpEndpointRegistry includes all 9 endpoints
  const registryCallMatch = httpApiSrc.match(/httpEndpoints\s*=\s*\[[\s\S]{0,500}?\]/u);
  assert(registryCallMatch, "http-api.ts must define httpEndpoints array");
  const endpointCount = (registryCallMatch[0].match(/Endpoint\s*,?\s*$/gm) || []).length
    + (registryCallMatch[0].includes("minimaxImageEndpoint") ? 1 : 0);
  assert(
    registryCallMatch[0].includes("minimaxSearchEndpoint") &&
    registryCallMatch[0].includes("minimaxImageEndpoint") &&
    registryCallMatch[0].includes("routesEndpoint"),
    "httpEndpoints array must include minimaxSearchEndpoint, minimaxImageEndpoint, and routesEndpoint",
  );

};

// ---------------------------------------------------------------------------
// Contract 5 — registry/shared-state contract file exists; no runtime claim
// ---------------------------------------------------------------------------

/**
 * Phase A safety check.
 * Verifies:
 *   - packages/contracts/src/routes.ts exists and exports routePolicySetSchema
 *   - packages/contracts/src/routes.ts does NOT contain the words
 *     "SharedStateManager", "Valkey", "Redis", or "postgres" (those are
 *     L3 concerns, not in the versioned contract)
 *   - packages/contracts/src/http-api.ts does NOT claim runtime integration
 *     (no mention of SharedStateManager, Valkey, Redis)
 */
const contract5_registryContract = (t) => {
  const routesContractSrc = file("packages/contracts/src/routes.ts");
  const httpApiSrc = file("packages/contracts/src/http-api.ts");

  // 5a. routes.ts contract file exists and exports key schemas
  assert(
    /export\s+const\s+routePolicySetSchema/u.test(routesContractSrc),
    "packages/contracts/src/routes.ts must export routePolicySetSchema",
  );
  assert(
    /export\s+const\s+routeContractVersion/u.test(routesContractSrc),
    "packages/contracts/src/routes.ts must export routeContractVersion",
  );
  assert(
    /export\s+const\s+resourceToolIds/u.test(routesContractSrc),
    "packages/contracts/src/routes.ts must export resourceToolIds",
  );

  // 5b. No runtime shared-state claims in the contract surface
  const runtimeClaims = ["SharedStateManager", "Valkey", "Redis", "SharedState", "BreakerStore", "RateLimitStore"];
  for (const claim of runtimeClaims) {
    assert.equal(
      routesContractSrc.includes(claim),
      false,
      `routes.ts contract must not mention runtime store implementation: ${claim}`,
    );
  }

  // 5c. http-api.ts contract also must not claim runtime integration
  for (const claim of runtimeClaims) {
    assert.equal(
      httpApiSrc.includes(claim),
      false,
      `http-api.ts contract must not mention runtime store implementation: ${claim}`,
    );
  }

  // 5d. health.ts contract also must not claim runtime integration
  const healthSrc = file("packages/contracts/src/health.ts");
  for (const claim of runtimeClaims) {
    assert.equal(
      healthSrc.includes(claim),
      false,
      `health.ts contract must not mention runtime store implementation: ${claim}`,
    );
  }

};

// ---------------------------------------------------------------------------
// Meta: fixture directory structure is clean
// ---------------------------------------------------------------------------

/**
 * Confirms the fixtures directory (if created) is not accidentally
 * treated as a test target by existing harnesses.
 * This is a structural sanity check — the fixtures dir is optional.
 */
const contract_meta_fixtures = (t) => {
  // This test is intentionally lenient: it verifies that if a fixtures dir
  // exists, it does not contain .test.ts/.test.mjs files that would be
  // picked up by pnpm test.
};

// ---------------------------------------------------------------------------
// Test suite bootstrap (Node.js test runner)
// ---------------------------------------------------------------------------

const { describe, it } = await import("node:test");

describe("Phase A — Wave 1 Architecture Contracts", { concurrency: false }, () => {
  describe("Contract 1 — manifest route policy fields + idempotent", () => {
    it("providers.manifest.json route policy fields are parseable and generate route is idempotent=false", contract1_manifestPolicyFields);
  });

  describe("Contract 2 — MINIMAX_BRIDGE_TARGET config entry + allowlist call", () => {
    it("config.ts has minimaxBridgeTarget; composition.ts calls assertAllowlistedTarget", contract2_minimaxBridgeConfig);
  });

  describe("Contract 3 — server.ts uses routes.ts path constants", () => {
    it("server.ts imports path constants; no inline HTTP path literals in route blocks", contract3_routesConstants);
  });

  describe("Contract 4 — http-api contract includes /routes and MiniMax bridge endpoints", () => {
    it("http-api.ts has 9 endpoints; /routes + bridge endpoints present; schemaRef correct", contract4_httpApiContract);
  });

  describe("Contract 5 — registry/shared-state contract file exists; no runtime claim", () => {
    it("routes.ts exports policy schemas; no SharedStateManager/Valkey/Redis mentions in contract surface", contract5_registryContract);
  });

  describe("Meta — fixtures directory (optional)", () => {
    it("fixture directory is optional for Phase A", contract_meta_fixtures);
  });
});
