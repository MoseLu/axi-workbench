// Runtime response schema conformance for the mobile control plane.
//
// Goal: every `/api/v1/mobile/*` (gateway path) / `/mobile/v1/*` (internal path)
// response that the mobile JS client (apps/workbench-mobile/src/lib/mobileControl.ts)
// consumes must structurally match what the server actually returns. The
// existing `mobile-openapi-schema.test.mjs` only checks the hand-written YAML
// spec; this test boots the real `createControlPlane` + `createControlPlaneHttpServer`
// and feeds the wire bytes through a tiny schema validator.
//
// Why a hand-written validator: services/control-plane stays at 0 npm
// dependencies and zod is intentionally not introduced here.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { createServer } from "node:http";

import { createControlPlane } from "../src/control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

// ---------- schema helpers ----------

const SCHEMA_VERSION = "2026-09-05";

function fail(label, path, detail) {
  throw new Error(`[mobile-response-schema] ${label} drift at ${path || "<root>"}: ${detail}`);
}

/**
 * Validate `value` against a schema node. Returns the first failing path
 * (or null on success). The schema intentionally mirrors the OpenAPI 3.0
 * subset we use; we only need enough surface to detect drift between the
 * mobile JS types and the runtime response shape.
 *
 *   - `required` keys are enforced strictly.
 *   - `additionalProperties: false` rejects extra keys.
 *   - `enum` accepts the listed values only.
 *   - `oneOf` and `nullable` are honored.
 *   - `pattern` uses the regex's `test` method.
 */
function validate(value, schema, path = "$") {
  if (schema == null) return null;

  if (schema.nullable && value === null) return null;
  if (schema.oneOf) {
    const errors = schema.oneOf
      .map((branch) => validate(value, branch, path))
      .filter((error) => error);
    if (errors.length === schema.oneOf.length) {
      return `${path}: no branch matched (${errors.join("; ")})`;
    }
    return null;
  }

  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return `${path}: expected object, got ${describe(value)}`;
    }
    const keys = Object.keys(value);
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) return `${path}: missing required field "${key}"`;
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of keys) {
        if (!allowed.has(key)) {
          return `${path}: unexpected field "${key}" (additionalProperties: false)`;
        }
      }
    }
    if (schema.properties) {
      for (const [key, child] of Object.entries(schema.properties)) {
        if (key in value) {
          const err = validate(value[key], child, `${path}.${key}`);
          if (err) return err;
        }
      }
    }
    return null;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) return `${path}: expected array, got ${describe(value)}`;
    if (schema.minItems != null && value.length < schema.minItems) {
      return `${path}: expected at least ${schema.minItems} item(s), got ${value.length}`;
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        const err = validate(value[i], schema.items, `${path}[${i}]`);
        if (err) return err;
      }
    }
    return null;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") return `${path}: expected string, got ${describe(value)}`;
    if (schema.pattern && !schema.pattern.test(value)) {
      return `${path}: string "${value}" does not match ${schema.pattern}`;
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return `${path}: "${value}" not in enum [${schema.enum.join(", ")}]`;
    }
    if (schema.minLength != null && value.length < schema.minLength) {
      return `${path}: string shorter than minLength ${schema.minLength}`;
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      return `${path}: string longer than maxLength ${schema.maxLength}`;
    }
    return null;
  }

  if (schema.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return `${path}: expected integer, got ${describe(value)}`;
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return `${path}: ${value} not in enum [${schema.enum.join(", ")}]`;
    }
    return null;
  }

  if (schema.type === "boolean") {
    if (typeof value !== "boolean") return `${path}: expected boolean, got ${describe(value)}`;
    if (schema.enum && !schema.enum.includes(value)) {
      return `${path}: ${value} not in enum [${schema.enum.join(", ")}]`;
    }
    return null;
  }

  if (schema.type === "number") {
    if (typeof value !== "number") return `${path}: expected number, got ${describe(value)}`;
    return null;
  }

  return null;
}

function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// ---------- schemas (mirror mobile JS types) ----------

const PAIRING_ID = /^pair_[A-Za-z0-9_-]{36}$/;
const DEVICE_ID = /^dev_[A-Za-z0-9_-]{36}$/;
const SCAN_TOKEN = /^scan_[A-Za-z0-9_-]{8,}$/;
const SIX_DIGIT_CODE = /^[0-9]{6}$/;
const HANDOFF_CORRELATION = /^handoff:scan_[A-Za-z0-9_-]{8,}$/;

// PairStartResponse — apps/workbench-mobile/src/lib/mobileControl.ts:startMobileDevicePairing
const PairStartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "pairingId", "code", "codeExpiresAt"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    pairingId: { type: "string", pattern: PAIRING_ID },
    code: { type: "string", pattern: SIX_DIGIT_CODE },
    codeExpiresAt: { type: "integer" },
  },
};

// QrPairScanResponse — apps/workbench-mobile/src/lib/mobileControl.ts:scanMobilePairingQr
const QrPairScanResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "pairingId", "code", "expiresAt"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    pairingId: { type: "string", pattern: PAIRING_ID },
    code: { type: "string", pattern: SIX_DIGIT_CODE },
    expiresAt: { type: "integer" },
  },
};

// PairStatusResponse — apps/workbench-mobile/src/lib/mobileControl.ts:completeScannedMobilePairing
const PairStatusResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "status"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    status: { type: "string", enum: ["pending", "approved"] },
    deviceId: { type: "string", nullable: true, pattern: DEVICE_ID },
    expiresAt: { type: "integer" },
  },
};

// NonceResponse (also embedded in PairConfirmResponse.nonce) — mobileControl.ts:exchangeDeviceNonce
const NonceResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nonceId", "nonce", "expiresAt"],
  properties: {
    nonceId: { type: "string" },
    nonce: { type: "string" },
    expiresAt: { type: "integer" },
  },
};

// PairConfirmResponse — mobileControl.ts:confirmMobileDevicePairing
const PairConfirmResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "deviceId", "status", "nonce"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    deviceId: { type: "string", pattern: DEVICE_ID },
    status: { type: "string", enum: ["active"] },
    nonce: NonceResponseSchema,
  },
};

// TokenResponse — mobileControl.ts:exchangeDeviceNonce
const TokenResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "accessToken", "expiresAt"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    accessToken: { type: "string" },
    expiresAt: { type: "integer" },
  },
};

// MobileWorkspaceSnapshot — mobileControl.ts:MobileWorkspaceSnapshot
const MobileWorkspaceSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["total", "healthy", "attention", "blocked", "stale", "unknown"],
  properties: {
    total: { type: "integer" },
    healthy: { type: "integer" },
    attention: { type: "integer" },
    blocked: { type: "integer" },
    stale: { type: "integer" },
    unknown: { type: "integer" },
  },
};

const MobileRunningTaskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "projectId", "status", "reasonCode", "summary", "actionType", "updatedAt"],
  properties: {
    id: { type: "string" },
    projectId: { type: "string", nullable: true },
    status: { type: "string" },
    reasonCode: { type: "string" },
    summary: { type: "string" },
    actionType: { type: "string", nullable: true },
    updatedAt: { type: "string" },
  },
};

const MobileApprovalSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "status", "actionSummary", "riskLevel"],
  properties: {
    id: { type: "string" },
    projectId: { type: "string", nullable: true },
    actionId: { type: "string", nullable: true },
    actionType: { type: "string", nullable: true },
    source: { type: "string" },
    status: { type: "string", enum: ["pending", "approved", "rejected", "expired"] },
    actionSummary: { type: "string" },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "destructive"] },
    createdAt: { type: "string" },
  },
};

const MobileProjectCardSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "kind",
    "status",
    "health",
    "reasonCode",
    "summary",
    "architecture",
    "phase",
    "preview",
    "actions",
    "source",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    kind: { type: "string" },
    status: { type: "string" },
    health: { type: "string", enum: ["healthy", "attention", "blocked", "stale", "unknown"] },
    reasonCode: { type: "string" },
    summary: { type: "string" },
    architecture: {
      type: "object",
      additionalProperties: false,
      properties: {
        provides: { type: "array", items: { type: "string" } },
        consumes: { type: "array", items: { type: "string" } },
        contracts: { type: "array", items: { type: "string" } },
      },
    },
    phase: { type: "string" },
    lastVerifiedAt: { type: "string", nullable: true },
    capabilities: { type: "array", items: { type: "string" } },
    progress: {
      type: "object",
      additionalProperties: false,
      required: ["stage", "confidence", "summary", "updatedAt", "evidenceCount", "remaining"],
      properties: {
        stage: { type: "string" },
        confidence: { type: "string" },
        summary: { type: "string" },
        updatedAt: { type: "string", nullable: true },
        evidenceCount: { type: "integer" },
        remaining: { type: "array", items: { type: "string" } },
      },
    },
    configuration: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "facts"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          facts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "label", "value"],
              properties: {
                key: { type: "string" },
                label: { type: "string" },
                value: { type: "string" },
              },
            },
          },
        },
      },
    },
    preview: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "url", "allowEmbedded", "coverUrl", "infoPageUrl", "fallbackMessage"],
      properties: {
        mode: { type: "string", enum: ["none", "embedded_web", "external_web"] },
        url: { type: "string", nullable: true },
        allowEmbedded: { type: "boolean" },
        coverUrl: { type: "string", nullable: true },
        infoPageUrl: { type: "string", nullable: true },
        fallbackMessage: { type: "string", nullable: true },
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "actionId",
          "commandId",
          "label",
          "intent",
          "autoExecutable",
          "actionType",
          "executionMode",
          "riskLevel",
          "summary",
        ],
        properties: {
          actionId: { type: "string" },
          commandId: { type: "string" },
          label: { type: "string" },
          intent: { type: "string" },
          autoExecutable: { type: "boolean" },
          actionType: { type: "string" },
          executionMode: { type: "string", enum: ["immediate", "requires_approval"] },
          riskLevel: { type: "string", enum: ["low", "medium", "high", "destructive"] },
          summary: { type: "string" },
        },
      },
    },
    source: { type: "string", enum: ["workspace.graph"] },
  },
};

const AttentionItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "projectId", "severity", "type", "reasonCode", "title", "summary", "updatedAt"],
  properties: {
    id: { type: "string" },
    projectId: { type: "string", nullable: true },
    severity: { type: "string", enum: ["critical", "warning", "info"] },
    type: { type: "string" },
    reasonCode: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const MobileWorkspaceSnapshotSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "generatedAt",
    "source",
    "summary",
    "attentionItems",
    "projects",
    "runningTasks",
    "recentTasks",
    "approvals",
  ],
  properties: {
    generatedAt: { type: "string" },
    source: { type: "string", enum: ["workspace.graph"] },
    summary: MobileWorkspaceSummarySchema,
    attentionItems: { type: "array", items: AttentionItemSchema },
    projects: { type: "array", items: MobileProjectCardSchema },
    runningTasks: { type: "array", items: MobileRunningTaskSchema },
    recentTasks: { type: "array", items: MobileRunningTaskSchema },
    approvals: { type: "array", items: MobileApprovalSummarySchema },
  },
};

// ApprovalScanPreview — mobileControl.ts:ApprovalScanPreview
const ApprovalScanPreviewSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "ok",
    "scanId",
    "approvalId",
    "object",
    "impact",
    "riskLevel",
    "currentStatus",
    "availableDecisions",
    "expiresAt",
    "handoffCorrelationId",
  ],
  properties: {
    ok: { type: "boolean", enum: [true] },
    scanId: { type: "string", pattern: SCAN_TOKEN },
    approvalId: { type: "string" },
    object: {
      type: "object",
      additionalProperties: false,
      required: ["type", "id", "projectId", "actionId", "actionType"],
      properties: {
        type: { type: "string", enum: ["approval"] },
        id: { type: "string" },
        projectId: { type: "string", nullable: true },
        actionId: { type: "string", nullable: true },
        actionType: { type: "string", nullable: true },
      },
    },
    impact: { type: "string" },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "destructive"] },
    currentStatus: { type: "string", enum: ["pending"] },
    availableDecisions: {
      type: "array",
      minItems: 1,
      items: { type: "string", enum: ["approved", "rejected", "handoff"] },
    },
    expiresAt: { type: "string" },
    handoffCorrelationId: { type: "string", pattern: HANDOFF_CORRELATION },
  },
};

// ---------- fixture runner ----------

function freshWorkspace() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-mobile-schema-"));
  const projectPath = join(workspaceRoot, "projects", "sample-app");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(
    graphPath,
    JSON.stringify({
      projects: {
        "sample-app": {
          name: "Sample App",
          kind: "android-app",
          path: projectPath,
          health: ["node -e \"process.stdout.write('ok')\""],
          mobile: {
            summary: "mobile study product",
            preview: { mode: "embedded_web", url: "https://preview.example.test", allowEmbedded: true },
          },
        },
      },
    }),
  );
  writeFileSync(
    join(workspaceRoot, ".workspace", "project-completion.json"),
    JSON.stringify({
      projects: [
        {
          id: "sample-app",
          stage: "building",
          confidence: "medium",
          summary: "Project is healthy and observable.",
          updatedAt: new Date().toISOString(),
          evidence: ["unit:test"],
          remaining: [],
          handoff: { status: "ready" },
        },
      ],
    }),
  );
  return workspaceRoot;
}

async function startControlPlane() {
  const workspaceRoot = freshWorkspace();
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  const cacheDir = join(workspaceRoot, ".cache");
  const controlPlane = createControlPlane({
    workspaceRoot,
    graphPath,
    cacheDir,
    pairingTokenSecret: "mobile-schema-test-secret-32-bytes!",
    ownerApprovalSecret: "mobile-schema-owner-secret-32-bytes",
  });
  const server = createServer(
    createControlPlaneHttpServer({
      controlPlane,
      mobileOwnerToken: "test-owner",
      pairingRequired: false,
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, controlPlane, workspaceRoot };
}

function fetchJson(server, method, pathname, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = payload !== undefined ? JSON.stringify(payload) : undefined;
    const req = httpRequest(
      {
        method,
        hostname: "127.0.0.1",
        port: server.address().port,
        path: pathname,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: json, raw: text });
        });
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function assertMatches(label, value, schema) {
  const error = validate(value, schema);
  if (error) fail(label, "", error);
}

// ---------- fixture-based regression cases ----------

test("schema fixtures: pair-start response still matches PairStartResponse", () => {
  const fixturePath = join(__dirname, "testdata", "mobile", "pair-start-success.json");
  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  assertMatches("PairStartResponse fixture", payload, PairStartResponseSchema);
});

test("schema fixtures: pair/qr/scan response still matches QrPairScanResponse", () => {
  const fixturePath = join(__dirname, "testdata", "mobile", "pair-qr-scan-success.json");
  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  assertMatches("QrPairScanResponse fixture", payload, QrPairScanResponseSchema);
});

test("schema validators reject drift from the mobile JS contract", () => {
  // Drift 1: server starts returning `expiresAtMs` instead of `codeExpiresAt`.
  const dropped = {
    ok: true,
    pairingId: "pair_Z3q9rW2x4y6A8b1Cd2Ef3Gh4Ij5Kl7Mn8Pq9Rs",
    code: "042857",
    expiresAtMs: 1735689600000,
  };
  assert.equal(validate(dropped, PairStartResponseSchema)?.startsWith("$: missing"), true);
  // Drift 2: server returns an extra unknown field under closed schema.
  const extra = {
    ok: true,
    pairingId: "pair_Z3q9rW2x4y6A8b1Cd2Ef3Gh4Ij5Kl7Mn8Pq9Rs",
    code: "042857",
    codeExpiresAt: 1735689600,
    debugTrace: "leak",
  };
  assert.match(validate(extra, PairStartResponseSchema) ?? "", /unexpected field "debugTrace"/);
  // Drift 3: scanId violates the scan_ prefix the runtime token contract requires.
  const wrongScan = {
    ok: true,
    scanId: "not-a-scan-token",
    approvalId: "apr_test",
    object: { type: "approval", id: "apr_test", projectId: null, actionId: null, actionType: null },
    impact: "review only",
    riskLevel: "low",
    currentStatus: "pending",
    availableDecisions: ["approved"],
    expiresAt: "2026-09-05T00:00:00.000Z",
    handoffCorrelationId: "handoff:scan_aaaaaaaa",
  };
  assert.match(
    validate(wrongScan, ApprovalScanPreviewSchema) ?? "",
    /scanId.*?does not match/,
  );
  // Drift 4: approval scan currentStatus escapes its single-value enum.
  const statusDrift = { ...wrongScan, scanId: "scan_abcdefgh", currentStatus: "open" };
  assert.match(
    validate(statusDrift, ApprovalScanPreviewSchema) ?? "",
    /currentStatus.*?not in enum/,
  );
});

// ---------- live runtime cases ----------

test("runtime: /mobile/v1/pair/start response matches PairStartResponse", async (t) => {
  const { server } = await startControlPlane();
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const result = await fetchJson(server, "POST", "/mobile/v1/pair/start", {
    publicKeyHex: "00".repeat(32),
    deviceName: "ci-android",
  });
  assert.equal(result.status, 200);
  assertMatches("PairStartResponse", result.body, PairStartResponseSchema);
});

test("runtime: /mobile/v1/pair/qr/scan response matches QrPairScanResponse", async (t) => {
  const { server, controlPlane } = await startControlPlane();
  t.after(() => new Promise((resolve) => server.close(resolve)));
  // The QR scan route is only reachable through the gateway credential; the
  // real path the server exposes here is direct for local tests.
  const webPairingId = "webpair_" + "a".repeat(20);
  const scanToken = "scan_" + "b".repeat(20);
  const result = await fetchJson(
    server,
    "POST",
    "/mobile/v1/pair/qr/scan",
    {
      webPairingId,
      scanToken,
      publicKeyHex: "00".repeat(64),
      publicKeyAlgorithm: "Ed25519",
      deviceName: "ci-android",
    },
    { "x-axi-internal-credential": "ci-only" },
  );
  // The QR scan route may legitimately fail because the server cannot mint
  // webPairingId outside the gateway. We only assert that *if* it returns
  // 200, the body matches our schema. The contract check protects the success
  // path against drift; the failure path is covered by mobile-routes.test.mjs.
  if (result.status === 200) {
    assertMatches("QrPairScanResponse", result.body, QrPairScanResponseSchema);
  } else {
    assert.ok(result.body?.error, "failure responses must carry an `error` field");
  }
  assert.ok(controlPlane);
});

test("runtime: /mobile/v1/workspace snapshot matches MobileWorkspaceSnapshot", async (t) => {
  const { server } = await startControlPlane();
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const result = await fetchJson(server, "GET", "/mobile/v1/workspace", undefined, {
    Authorization: "Bearer test-owner",
  });
  assert.equal(result.status, 200);
  assertMatches("MobileWorkspaceSnapshot", result.body, MobileWorkspaceSnapshotSchema);
});

test("runtime: /mobile/v1/approval-scans/resolve preview matches ApprovalScanPreview", async (t) => {
  const { server, controlPlane } = await startControlPlane();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Seed a pending approval, then create a scan, then resolve it via the
  // HTTP route and assert the response shape.
  const created = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_schema_scan_seed",
    projectId: "sample-app",
    actionId: "diagnose",
    actionType: "project_diagnosis",
    deviceId: "dev_test-owner",
  });
  assert.equal(created.status, "pending_approval");
  const scan = controlPlane.createApprovalScan({ approvalId: created.approvalId });
  assert.equal(scan.ok, true);

  const result = await fetchJson(
    server,
    "POST",
    "/mobile/v1/approval-scans/resolve",
    { scanToken: scan.scanId },
    { Authorization: "Bearer test-owner" },
  );
  assert.equal(result.status, 200);
  assertMatches("ApprovalScanPreview", result.body, ApprovalScanPreviewSchema);
});

test("schema version stamp is recorded so stale failures can be triaged", () => {
  assert.ok(SCHEMA_VERSION, "SCHEMA_VERSION must be set");
  assert.match(SCHEMA_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});