import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* Spec-conformance tests for services/control-plane/openapi/mobile.v1.yaml.
 *
 * The control-plane package must stay at 0 npm dependencies, so we
 * avoid pulling in a YAML / OpenAPI validator.  Instead we read the
 * raw YAML text and run pattern assertions that match the shape of
 * the spec we maintain alongside this file.  Whenever the spec is
 * reorganised (renames, new routes), update both the YAML and the
 * assertions here in the same commit.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(__dirname, "..", "openapi", "mobile.v1.yaml");
const spec = readFileSync(SPEC_PATH, "utf8");

function expectContains(needle, label) {
  assert.ok(spec.includes(needle), `${label || "snippet"} missing: ${needle}`);
}
function expectMissing(needle, label) {
  assert.ok(!spec.includes(needle), `${label || "snippet"} must not appear: ${needle}`);
}
function expectLinePattern(re, label) {
  assert.match(spec, re, label || `pattern not found: ${re}`);
}

test("OpenAPI: declares openapi 3.0.x", () => {
  expectLinePattern(/^openapi:\s*['"]?3\.0\./m, "openapi version");
});

test("OpenAPI: title is set to the Axi Workstation Control Plane mobile surface", () => {
  expectContains("title: Axi Workstation Control Plane — Mobile v1");
});

test("OpenAPI: every documented /mobile/v1/* path appears in paths", () => {
  const routes = [
    "/mobile/v1/pair/start",
    "/mobile/v1/pair/confirm",
    "/mobile/v1/auth/token",
    "/mobile/v1/auth/nonce",
    "/mobile/v1/pair/revoke",
    "/mobile/v1/workspace",
    "/mobile/v1/projects/{id}",
    "/mobile/v1/jobs",
    "/mobile/v1/jobs/{id}/cancel",
    "/mobile/v1/approvals/{id}/decision",
  ];
  for (const route of routes) {
    expectContains(route, `path ${route}`);
  }
});

test("OpenAPI: every documented route has a post/get operation block", () => {
  const postRoutes = [
    "/mobile/v1/pair/start",
    "/mobile/v1/pair/confirm",
    "/mobile/v1/auth/token",
    "/mobile/v1/auth/nonce",
    "/mobile/v1/pair/revoke",
    "/mobile/v1/jobs",
    "/mobile/v1/jobs/{id}/cancel",
    "/mobile/v1/approvals/{id}/decision",
  ];
  for (const route of postRoutes) {
    expectContains(`${route}:\n    post:`, `POST operation ${route}`);
  }
  expectContains("/mobile/v1/workspace:\n    get:", "GET /workspace");
  expectContains("/mobile/v1/projects/{id}:\n    get:", "GET /projects/{id}");
});

test("OpenAPI: every $ref resolves into components", () => {
  const refs = [...spec.matchAll(/\$ref:\s*['"]?(#\/components\/[^'"]+)['"]?/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, "spec must contain $ref declarations");
  for (const ref of refs) {
    assert.match(ref, /^#\/components\/(schemas|responses)\//, `ref outside components: ${ref}`);
    const [, kind, name] = ref.match(/^#\/components\/(schemas|responses)\/(.+)$/);
    const needle = kind === "schemas" ? `\n    ${name}:\n` : `\n    ${name}:\n      description:`;
    expectContains(needle, `${kind}/${name}`);
  }
});

test("OpenAPI: required schemas exist for the runtime surface", () => {
  const required = [
    "PairStartRequest",
    "PairStartResponse",
    "PairConfirmRequest",
    "PairConfirmResponse",
    "TokenRequest",
    "TokenResponse",
    "NonceResponse",
    "RevokeRequest",
    "RevokeResponse",
    "MobileActionRequest",
    "MobileApprovalDecision",
    "MobileJobAccepted",
    "MobileJobPendingApproval",
    "MobileJobCancelResponse",
    "MobileApprovalDecisionResponse",
    "MobileProjectCard",
    "MobileWorkspaceSnapshot",
    "MobilePreview",
    "MobileAction",
    "ApprovalSummary",
    "JobSummary",
    "MobileActionError",
  ];
  for (const name of required) {
    expectContains(`    ${name}:\n`, `schema ${name}`);
  }
});

test("OpenAPI: MobileActionRequest enforces the six-field contract", () => {
  expectLinePattern(/MobileActionRequest:[^]*?required:[\s\S]*?-\s*actionType/, "MobileActionRequest.actionType required");
  expectLinePattern(/MobileActionRequest:[^]*?required:[\s\S]*?-\s*idempotencyKey/, "MobileActionRequest.idempotencyKey required");
  expectLinePattern(/MobileActionRequest:[^]*?required:[\s\S]*?-\s*projectId/, "MobileActionRequest.projectId required");
  expectLinePattern(/MobileActionRequest:[^]*?additionalProperties:\s*false/, "MobileActionRequest closed schema");
  expectLinePattern(/idempotencyKey:[\s\S]{0,400}minLength:\s*8/, "idempotencyKey minLength 8");
  expectLinePattern(/idempotencyKey:[\s\S]{0,400}pattern:\s*'\^\[A-Za-z0-9_-]\+\$'/m, "idempotencyKey pattern");
});

test("OpenAPI: MobilePreview.mode enum disallows unsafe modes", () => {
  expectLinePattern(/MobilePreview:[\s\S]{0,400}enum:[\s\S]{0,400}-\s*embedded_web/, "MobilePreview embedded_web");
  expectLinePattern(/MobilePreview:[\s\S]{0,400}enum:[\s\S]{0,400}-\s*external_web/, "MobilePreview external_web");
  expectLinePattern(/MobilePreview:[\s\S]{0,400}enum:[\s\S]{0,400}-\s*none/, "MobilePreview none");
  expectMissing("- internal_web", "internal_web must not be exposed");
});

test("OpenAPI: bearerAuth security scheme documents HS256 + 1h TTL", () => {
  expectContains("bearerFormat: HS256", "HS256 bearer format");
  expectContains("TTL 1h", "1h TTL hint");
});

test("OpenAPI: PairStartResponse pattern matches the runtime 6-digit code", () => {
  expectContains("pattern: '^[0-9]{6}$'", "PairStartResponse code pattern");
});

test("OpenAPI: idempotency key shape is consistent between request and decision schemas", () => {
  function readSubSection(label) {
    const lines = spec.split(/\r?\n/);
    const start = lines.findIndex((l) => l.trim() === `${label}:`);
    if (start < 0) return null;
    const startIndent = lines[start].match(/^ */)[0].length;
    const block = [];
    for (let i = start; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trim() && i > start) {
        const indent = line.match(/^ */)[0].length;
        if (indent <= startIndent) break;
      }
      block.push(line);
    }
    return block.join("\n");
  }
  const req = readSubSection("MobileActionRequest");
  // MobileApprovalDecision composes MobileActionRequest via allOf; pull
  // the referenced block too so we can compare shape end-to-end.
  const dec = readSubSection("MobileApprovalDecision");
  assert.ok(req && dec, "could not locate MobileActionRequest or MobileApprovalDecision");
  const composed = dec.includes("$ref: '#/components/schemas/MobileActionRequest'") ? dec + "\n" + req : dec;
  const patFrom = (s) => s.match(/idempotencyKey:[\s\S]*?pattern:\s*'([^']+)'/);
  const lenFrom = (s) => {
    const min = s.match(/idempotencyKey:[\s\S]*?minLength:\s*(\d+)/);
    const max = s.match(/idempotencyKey:[\s\S]*?maxLength:\s*(\d+)/);
    return min && max ? `${min[1]}-${max[1]}` : null;
  };
  const rpat = patFrom(req);
  const dpat = patFrom(composed);
  assert.ok(rpat && dpat, `pattern missing in req=${!!rpat} dec/composed=${!!dpat}`);
  assert.equal(rpat[1], dpat[1], "idempotencyKey pattern mismatch");
  assert.equal(lenFrom(req), lenFrom(composed), "idempotencyKey length mismatch");
});

test("OpenAPI: spec references the canonical schema path in its info.description", () => {
  expectContains("packages/schemas/src/entities/control-plane.ts", "info.description must reference the canonical zod source");
});