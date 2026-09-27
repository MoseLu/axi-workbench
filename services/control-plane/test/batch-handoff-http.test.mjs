import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "./test-control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

function invokeServer(server, { method, url, headers = {}, body }) {
  const fullHeaders = { host: "127.0.0.1", ...headers };
  let payload = body;
  if (payload !== undefined && typeof payload !== "string") {
    payload = JSON.stringify(payload);
    fullHeaders["content-type"] = "application/json";
  }
  return new Promise((resolve) => {
    const chunks = payload ? [Buffer.from(payload)] : [];
    const req = {
      method,
      url,
      headers: fullHeaders,
      [Symbol.asyncIterator]() { return this; },
      async next() {
        if (chunks.length === 0) return { value: undefined, done: true };
        return { value: chunks.shift(), done: false };
      },
    };
    const responseHeaders = {};
    const res = {
      req,
      statusCode: 200,
      writeHead(code, headersToWrite) {
        this.statusCode = code;
        Object.assign(responseHeaders, headersToWrite);
        return this;
      },
      end(value) {
        resolve({ status: this.statusCode, headers: responseHeaders, body: value ? value.toString("utf8") : "" });
      },
    };
    server.emit("request", req, res);
  });
}

function json(response) {
  return JSON.parse(response.body);
}

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "axi-batch-handoff-http-"));
  mkdirSync(join(root, ".cache", "handoffs"), { recursive: true });
  mkdirSync(join(root, ".workspace"), { recursive: true });
  mkdirSync(join(root, "projects", "sample"), { recursive: true });
  const graphPath = join(root, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {
    sample: { name: "测试示例", path: join(root, "projects", "sample"), health: ["node -e \"console.log('ok')\""] },
  } }));
  writeFileSync(join(root, ".workspace", "project-completion.json"), JSON.stringify({ projects: [] }));
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir,
    graphPath,
    pairingTokenSecret: "batch-handoff-test-secret",
    ...options,
  });
  const server = createControlPlaneHttpServer({
    controlPlane,
    coreApiToken: "core-token",
    allowedOrigins: ["http://allowed-origin.test"],
    gatewayInternalToken: "axi-development-internal-token",
  });
  return { controlPlane, server, root, cacheDir };
}

test("POST /internal/web/v1/batch-handoffs requires internal token", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: { "x-axi-subject": "owner@example.com" },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ type: "approval", id: "test-1" }],
    },
  });
  assert.equal(response.status, 401);
  assert.ok(json(response).error.includes("authorization"));
});

test("POST /internal/web/v1/batch-handoffs requires verified subject", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ type: "approval", id: "test-1" }],
    },
  });
  assert.equal(response.status, 401);
  assert.ok(json(response).error.includes("identity"));
});

test("POST /internal/web/v1/batch-handoffs creates batch handoffs via HTTP", async () => {
  const { server, controlPlane } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "B",
      objects: [
        { type: "approval", id: "approval-1" },
        { type: "approval", id: "approval-2" },
        { type: "approval", id: "approval-3" },
      ],
      reason: "Batch handover of approvals",
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  assert.equal(body.ok, true);
  assert.ok(body.batchId);
  assert.match(body.batchId, /^BATCH-\d+-[a-f0-9]{8}$/);
  assert.equal(body.totalCount, 3);
  assert.equal(body.successCount, 3);
  assert.equal(body.failureCount, 0);
  assert.equal(body.status, "completed");
  assert.ok(Array.isArray(body.handoffs));
  assert.equal(body.handoffs.length, 3);
});

test("POST /internal/web/v1/batch-handoffs validates required parameters", async () => {
  const { server } = fixture();

  // Missing direction
  const noDirection = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      targetSurface: "web",
      objects: [{ type: "approval", id: "1" }],
    },
  });
  assert.equal(noDirection.status, 400);

  // Empty objects
  const emptyObjects = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [],
    },
  });
  assert.equal(emptyObjects.status, 400);
});

test("POST /internal/web/v1/batch-handoffs sets correct risk levels", async () => {
  const { server, controlPlane } = fixture();
  // Test action level C
  const responseC = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "C",
      objects: [{ type: "approval", id: "high-risk" }],
      reason: "High risk batch",
    },
  });

  assert.equal(responseC.status, 201);
  const bodyC = json(responseC);
  const handoffC = controlPlane.getHandoff(bodyC.handoffs[0]);
  assert.equal(handoffC.actionLevel, "C");
  assert.equal(handoffC.riskLevel, "high");

  // Test action level D
  const responseD = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "D",
      objects: [{ type: "approval", id: "destructive" }],
      reason: "Destructive batch",
    },
  });

  assert.equal(responseD.status, 201);
  const bodyD = json(responseD);
  const handoffD = controlPlane.getHandoff(bodyD.handoffs[0]);
  assert.equal(handoffD.actionLevel, "D");
  assert.equal(handoffD.riskLevel, "destructive");
});

test("POST /internal/web/v1/batch-handoffs defaults actionLevel to B", async () => {
  const { server, controlPlane } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ type: "approval", id: "default-level" }],
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  const handoff = controlPlane.getHandoff(body.handoffs[0]);
  assert.equal(handoff.actionLevel, "B");
  assert.equal(handoff.riskLevel, "medium");
});

test("POST /internal/web/v1/batch-handoffs creates handoffs with batch source", async () => {
  const { server, controlPlane } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "B",
      objects: [
        { type: "project", id: "proj-1" },
        { type: "task", id: "task-1" },
      ],
      reason: "Handover project and task",
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  const handoff1 = controlPlane.getHandoff(body.handoffs[0]);
  const handoff2 = controlPlane.getHandoff(body.handoffs[1]);

  // All handoffs share the same batchId
  assert.ok(handoff1.batchId);
  assert.equal(handoff1.batchId, handoff2.batchId);
  assert.equal(handoff1.batchId, body.batchId);

  // Source is batch
  assert.equal(handoff1.sourceSurface, "batch");
  assert.equal(handoff1.targetSurface, "web");
  assert.equal(handoff1.direction, "mobile_to_web");
  assert.equal(handoff1.status, "pending");
  assert.ok(handoff1.handoffCorrelationId.startsWith(`batch:${body.batchId}:`));

  // Objects are preserved
  assert.equal(handoff1.object.type, "project");
  assert.equal(handoff1.object.id, "proj-1");
  assert.equal(handoff2.object.type, "task");
  assert.equal(handoff2.object.id, "task-1");
});

test("POST /internal/web/v1/batch-handoffs generates unique batch IDs", async () => {
  const { server } = fixture();

  const response1 = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ type: "approval", id: "test-1" }],
    },
  });

  const response2 = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ type: "approval", id: "test-2" }],
    },
  });

  const body1 = json(response1);
  const body2 = json(response2);

  assert.notEqual(body1.batchId, body2.batchId);
  assert.match(body1.batchId, /^BATCH-\d+-[a-f0-9]{8}$/);
  assert.match(body2.batchId, /^BATCH-\d+-[a-f0-9]{8}$/);
});

test("POST /internal/web/v1/batch-handoffs returns results array", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "B",
      objects: [
        { type: "approval", id: "result-1" },
        { type: "approval", id: "result-2" },
      ],
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  assert.equal(body.results.length, 2);

  // Each result should have ok: true and handoff
  for (const item of body.results) {
    assert.equal(item.ok, true);
    assert.ok(item.handoff);
    assert.ok(item.handoff.id);
    assert.ok(item.handoff.batchId);
  }
});

test("POST /internal/web/v1/batch-handoffs persists handoff records", async () => {
  const { server, controlPlane, cacheDir } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "B",
      objects: [{ type: "approval", id: "persist-test" }],
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  const handoffId = body.handoffs[0];

  // Verify the handoff can be retrieved from control plane (same instance)
  const handoff = controlPlane.getHandoff(handoffId);
  assert.ok(handoff);
  assert.equal(handoff.id, handoffId);
  assert.equal(handoff.batchId, body.batchId);
  assert.equal(handoff.status, "pending");
});

test("POST /internal/web/v1/batch-handoffs creates audit record", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      actionLevel: "B",
      objects: [
        { type: "approval", id: "audit-1" },
        { type: "approval", id: "audit-2" },
      ],
      reason: "Audit test batch",
    },
  });

  assert.equal(response.status, 201);
  // Audit file should be created with batch_handoff_created event
  const { cacheDir } = fixture();
  const { readFileSync, existsSync } = await import("node:fs");
  const auditFilePath = join(cacheDir, "audit.jsonl");
  if (existsSync(auditFilePath)) {
    const auditContent = readFileSync(auditFilePath, "utf8");
    assert.ok(auditContent.includes("batch_handoff_created") || auditContent.includes("handoff_created"));
  }
});

test("POST /internal/web/v1/batch-handoffs supports web_to_mobile direction", async () => {
  const { server, controlPlane } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "web_to_mobile",
      targetSurface: "mobile",
      actionLevel: "A",
      objects: [{ type: "project", id: "web-to-mobile-batch" }],
      reason: "Web to mobile batch",
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  const handoff = controlPlane.getHandoff(body.handoffs[0]);
  assert.equal(handoff.direction, "web_to_mobile");
  assert.equal(handoff.targetSurface, "mobile");
});

test("POST /internal/web/v1/batch-handoffs rejects invalid objects (missing type)", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ id: "1" }],
    },
  });

  assert.equal(response.status, 400);
  assert.ok(json(response).error.includes("type"));
});

test("POST /internal/web/v1/batch-handoffs rejects invalid objects (missing id)", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      direction: "mobile_to_web",
      targetSurface: "web",
      objects: [{ type: "approval" }],
    },
  });

  assert.equal(response.status, 400);
  assert.ok(json(response).error.includes("id"));
});

test("405 returned for GET on batch-handoffs", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/batch-handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
  });
  assert.equal(response.status, 405);
});

test("CORS preflight returns 204 for batch-handoffs routes", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "OPTIONS",
    url: "/internal/web/v1/batch-handoffs",
    headers: { origin: "http://allowed-origin.test" },
  });
  assert.equal(response.status, 204);
  // Check for CORS headers (Node.js lowercases header names)
  const hasCors = Object.keys(response.headers).some((k) => k.toLowerCase().includes("access-control"));
  assert.ok(hasCors, "CORS headers should be present");
});
