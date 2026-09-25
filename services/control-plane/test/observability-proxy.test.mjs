// services/control-plane/test/observability-proxy.test.mjs
//
// Phase 1.6 follow-up: the workbench control-plane proxies
// /api/v1/observability/* to the foundation observability control
// plane so the Workbench admin Observability page renders even when
// the api-gateway chain is misconfigured. These tests cover the
// fallback path with a stub fetch.

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

async function startStubUpstream(handler) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => handler(req, res, body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

function bootstrapControlPlaneEnv({ upstreamPort }) {
  process.env.AXI_OBSERVABILITY_URL = `http://127.0.0.1:${upstreamPort}`;
  process.env.AXI_OBSERVABILITY_GATEWAY_TOKEN = "gateway-secret";
  process.env.AXI_WORKSPACE_EVENT_SOURCES = "";
}

async function listenControlPlane() {
  const mod = await import("../src/server.mjs");
  if (typeof mod.createControlPlaneHttpServer !== "function") {
    throw new Error("createControlPlaneHttpServer not exported");
  }
  process.env.CONTROL_PLANE_BIND = "127.0.0.1";
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "axi-cp-obs-"));
  process.env.AXI_WORKSPACE_ROOT = tmp;
  const { createControlPlane } = await import("../src/control-plane.mjs");
  const controlPlane = createControlPlane();
  const server = mod.createControlPlaneHttpServer({ controlPlane });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const bound = server.address();
  return { server, port: bound.port, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

test("GET /api/v1/observability/overview forwards to the foundation control plane", async () => {
  const upstream = await startStubUpstream((req, res, body) => {
    assert.equal(req.headers["x-axi-internal-token"], "gateway-secret");
    assert.equal(req.headers["x-axi-subject"], "user:mose");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ totalEvents: 5, projects: 2, services: 3, recentEvents: [], warnings: { total: 0, open: 0 }, chain: { valid: true, count: 5, lastHash: "x" } }));
  });
  bootstrapControlPlaneEnv({ upstreamPort: upstream.port });
  const cp = await listenControlPlane();
  try {
    const result = await fetchJson(`http://127.0.0.1:${cp.port}/api/v1/observability/overview`, { headers: { "x-axi-subject": "user:mose" } });
    assert.equal(result.status, 200);
    assert.equal(result.body.totalEvents, 5);
  } finally { await cp.close(); await upstream.close(); }
});

test("GET /api/v1/observability/events forwards query string + project scope", async () => {
  let capturedUrl = "";
  const upstream = await startStubUpstream((req, res) => {
    capturedUrl = req.url;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ events: [{ eventId: "evt_1", eventType: "commit.recorded", occurredAt: new Date().toISOString(), projectId: "axi-workbench", severity: "info", status: "completed", actorRef: "user:mose" }], nextCursor: null, total: 1 }));
  });
  bootstrapControlPlaneEnv({ upstreamPort: upstream.port });
  const cp = await listenControlPlane();
  try {
    const result = await fetchJson(`http://127.0.0.1:${cp.port}/api/v1/observability/events?limit=50&projectId=axi-workbench`, { headers: { "x-axi-subject": "user:mose", "x-axi-projects": "axi-workbench" } });
    assert.equal(result.status, 200);
    assert.equal(result.body.events[0].eventId, "evt_1");
    assert.equal(capturedUrl, "/api/v1/observability/events?limit=50&projectId=axi-workbench");
  } finally { await cp.close(); await upstream.close(); }
});

test("GET /api/v1/observability/events/:id forwards the encoded event id", async () => {
  const upstream = await startStubUpstream((req, res) => {
    if (!req.url.startsWith("/api/v1/observability/events/evt_1")) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ eventId: "evt_1", eventType: "project.warning.raised" }));
  });
  bootstrapControlPlaneEnv({ upstreamPort: upstream.port });
  const cp = await listenControlPlane();
  try {
    const result = await fetchJson(`http://127.0.0.1:${cp.port}/api/v1/observability/events/evt_1`);
    assert.equal(result.status, 200);
    assert.equal(result.body.eventId, "evt_1");
  } finally { await cp.close(); await upstream.close(); }
});

test("POST /api/v1/observability/warnings/:id/acknowledge forwards body and method", async () => {
  const upstream = await startStubUpstream((req, res, body) => {
    assert.equal(req.method, "POST");
    assert.ok(req.url.includes("/api/v1/observability/warnings/evt_warn/acknowledge"));
    res.writeHead(201, { "content-type": "application/json" });
    res.end(JSON.stringify({ eventId: "evt_warn", eventType: "project.warning.acknowledged" }));
  });
  bootstrapControlPlaneEnv({ upstreamPort: upstream.port });
  const cp = await listenControlPlane();
  try {
    const result = await fetchJson(`http://127.0.0.1:${cp.port}/api/v1/observability/warnings/evt_warn/acknowledge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.eventType, "project.warning.acknowledged");
  } finally { await cp.close(); await upstream.close(); }
});

test("returns a degraded body when the upstream is unreachable", async () => {
  process.env.AXI_OBSERVABILITY_URL = "http://127.0.0.1:1";
  process.env.AXI_OBSERVABILITY_GATEWAY_TOKEN = "gateway-secret";
  const cp = await listenControlPlane();
  try {
    const result = await fetchJson(`http://127.0.0.1:${cp.port}/api/v1/observability/overview`);
    assert.equal(result.status, 503);
    assert.equal(result.body.degraded, true);
    assert.match(result.body.error, /observability upstream unreachable/);
  } finally { await cp.close(); }
});

test("returns 503 with a clear message when AXI_OBSERVABILITY_URL is not configured", async () => {
  process.env.AXI_OBSERVABILITY_URL = "";
  process.env.AXI_OBSERVABILITY_GATEWAY_TOKEN = "gateway-secret";
  const cp = await listenControlPlane();
  try {
    const result = await fetchJson(`http://127.0.0.1:${cp.port}/api/v1/observability/overview`);
    assert.equal(result.status, 503);
    assert.equal(result.body.degraded, true);
  } finally { await cp.close(); }
});