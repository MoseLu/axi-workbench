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
  const root = mkdtempSync(join(tmpdir(), "axi-web-to-mobile-http-"));
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
    pairingTokenSecret: "web-to-mobile-test-secret",
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

test("POST /internal/web/v1/handoffs requires internal token", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: { "x-axi-subject": "owner@example.com" },
    body: { projectId: "sample" },
  });
  assert.equal(response.status, 401);
  assert.ok(json(response).error.includes("authorization"));
});

test("POST /internal/web/v1/handoffs requires verified subject", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: { projectId: "sample" },
  });
  assert.equal(response.status, 401);
  assert.ok(json(response).error.includes("identity"));
});

test("POST /internal/web/v1/handoffs creates web-to-mobile handoff via HTTP", async () => {
  const { server, controlPlane } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {
      projectId: "sample",
      actionId: "verify",
      actionType: "project_verification",
      impact: "验证测试项目",
      riskLevel: "low",
    },
  });

  assert.equal(response.status, 201);
  const body = json(response);
  assert.equal(body.ok, true);
  assert.ok(body.handoff);
  assert.equal(body.handoff.direction, "web->mobile");
  assert.equal(body.handoff.sourceSurface, "web");
  assert.equal(body.handoff.targetSurface, "mobile");
  assert.equal(body.handoff.status, "created");
  assert.ok(body.handoff.id);
  assert.ok(body.handoff.expiresAt);
  assert.ok(body.handoff.availableTransitions.includes("delivered"));
});

test("POST /internal/web/v1/handoffs with minimal body", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {},
  });

  assert.equal(response.status, 201);
  const body = json(response);
  assert.equal(body.ok, true);
  assert.equal(body.handoff.riskLevel, "medium");
});

test("GET /internal/web/v1/handoffs lists handoffs", async () => {
  const { server, controlPlane } = fixture();
  // Create a handoff first
  await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample" },
  });

  const listResponse = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
  });

  assert.equal(listResponse.status, 200);
  const body = json(listResponse);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.handoffs));
  assert.ok(body.handoffs.length >= 1);
});

test("GET /internal/web/v1/handoffs filters by status", async () => {
  const { server } = fixture();
  // Create a handoff
  await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample" },
  });

  const listResponse = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/handoffs?status=created",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
  });

  assert.equal(listResponse.status, 200);
  const body = json(listResponse);
  assert.ok(body.handoffs.every((h) => h.status === "created"));
});

test("GET /internal/web/v1/handoffs/:id retrieves handoff", async () => {
  const { server } = fixture();
  // Create a handoff
  const createResponse = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample" },
  });
  const handoffId = json(createResponse).handoff.id;

  const getResponse = await invokeServer(server, {
    method: "GET",
    url: `/internal/web/v1/handoffs/${encodeURIComponent(handoffId)}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
  });

  assert.equal(getResponse.status, 200);
  const body = json(getResponse);
  assert.equal(body.id, handoffId);
  assert.equal(body.direction, "web->mobile");
});

test("POST /internal/web/v1/handoffs/:id rejects handoff with reason", async () => {
  const { server, controlPlane } = fixture();
  // Create handoff
  const createResponse = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample", targetOwnerRef: "mobile-owner" },
  });
  const handoffId = json(createResponse).handoff.id;

  // Deliver the handoff (reject is valid from "delivered" state for web->mobile)
  controlPlane.deliverWebToMobileHandoff(handoffId, "owner@example.com");

  // Reject the handoff via HTTP - subject must match sourceOwnerRef
  const rejectResponse = await invokeServer(server, {
    method: "POST",
    url: `/internal/web/v1/handoffs/${encodeURIComponent(handoffId)}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { action: "reject", reason: "不在当前责任范围" },
  });

  assert.equal(rejectResponse.status, 200);
  const body = json(rejectResponse);
  assert.equal(body.status, "rejected");
  assert.equal(body.rejectionReason, "不在当前责任范围");
});

test("POST /internal/web/v1/handoffs/:id rejects without reason fails", async () => {
  const { server, controlPlane } = fixture();
  // Create handoff
  const createResponse = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample", targetOwnerRef: "mobile-owner" },
  });
  const handoffId = json(createResponse).handoff.id;

  // Deliver using the same controlPlane instance
  controlPlane.deliverWebToMobileHandoff(handoffId, "owner@example.com");
  controlPlane.acceptWebToMobileHandoff(handoffId, "mobile-owner");

  // Try to reject without reason
  const rejectResponse = await invokeServer(server, {
    method: "POST",
    url: `/internal/web/v1/handoffs/${encodeURIComponent(handoffId)}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "mobile-owner",
    },
    body: { action: "reject" },
  });

  assert.equal(rejectResponse.status, 400);
  assert.ok(json(rejectResponse).error.includes("reason"));
});

test("POST /internal/web/v1/handoffs/:id completes handoff with outcome", async () => {
  const { server, controlPlane } = fixture();
  // Create and deliver handoff
  const createResponse = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample", targetOwnerRef: "mobile-owner" },
  });
  const handoffId = json(createResponse).handoff.id;

  // Deliver and accept via internal API
  controlPlane.deliverWebToMobileHandoff(handoffId, "owner@example.com");
  controlPlane.acceptWebToMobileHandoff(handoffId, "mobile-owner");

  // Complete the handoff - subject must match sourceOwnerRef (owner@example.com)
  const completeResponse = await invokeServer(server, {
    method: "POST",
    url: `/internal/web/v1/handoffs/${encodeURIComponent(handoffId)}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { outcome: "任务已执行" },
  });

  assert.equal(completeResponse.status, 200);
  const body = json(completeResponse);
  assert.equal(body.status, "completed");
  assert.equal(body.finalAction.outcome, "任务已执行");
});

test("POST /internal/web/v1/handoffs/:id completes without outcome fails", async () => {
  const { server, controlPlane } = fixture();
  // Create and deliver handoff
  const createResponse = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: { projectId: "sample", targetOwnerRef: "mobile-owner" },
  });
  const handoffId = json(createResponse).handoff.id;

  // Deliver and accept via internal API
  controlPlane.deliverWebToMobileHandoff(handoffId, "owner@example.com");
  controlPlane.acceptWebToMobileHandoff(handoffId, "mobile-owner");

  // Try to complete without outcome - subject must match sourceOwnerRef
  const completeResponse = await invokeServer(server, {
    method: "POST",
    url: `/internal/web/v1/handoffs/${encodeURIComponent(handoffId)}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {},
  });

  assert.equal(completeResponse.status, 400);
  assert.ok(json(completeResponse).error.includes("outcome"));
});

test("GET /internal/web/v1/handoffs/:id returns 404 for unknown handoff", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/handoffs/unknown-handoff-id",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
  });
  assert.equal(response.status, 404);
});

test("CORS preflight returns 204 for handoff routes", async () => {
  const { server } = fixture();
  const response = await invokeServer(server, {
    method: "OPTIONS",
    url: "/internal/web/v1/handoffs",
    headers: { origin: "http://allowed-origin.test" },
  });
  assert.equal(response.status, 204);
  // Check for CORS headers (Node.js lowercases header names)
  const hasCors = Object.keys(response.headers).some((k) => k.toLowerCase().includes("access-control"));
  assert.ok(hasCors, "CORS headers should be present");
});

test("405 returned for unsupported methods", async () => {
  const { server } = fixture();
  // PUT is not supported on handoffs collection
  const response = await invokeServer(server, {
    method: "PUT",
    url: "/internal/web/v1/handoffs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner@example.com",
    },
    body: {},
  });
  assert.equal(response.status, 405);
});
