import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { createHmac } from "node:crypto";
import { createControlPlane } from "../src/control-plane.mjs";

/* End-to-end tests for the six-field contract:
 *   { idempotencyKey, deviceId (from token), projectId, actionType,
 *     approvalRef (conditional), auditEvent (response-side) }
 * Plus: idempotency replay returns X-Idempotency-Replay: true and
 * audit.jsonl accumulates mobile_action entries. */

const TEST_SECRET = "stage2-test-secret-32bytes-please";
const TEST_PUBKEY = "1".repeat(64);

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-mobile-six-"));
}

function signNonce(publicKeyHex, nonce) {
  return createHmac("sha256", publicKeyHex).update(nonce).digest("hex");
}

/* Mirror of server.mjs mobile POST routing.  Only the three write
 * endpoints are mirrored; pair / auth / read paths are exercised by
 * mobile-routes.test.mjs. */
function buildServer(controlPlane) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/mobile/v1/")) return json(res, 404, { error: "not found" });
      if (url.pathname === "/mobile/v1/pair/start" || url.pathname === "/mobile/v1/pair/confirm" || url.pathname === "/mobile/v1/auth/token") {
        // Minimal shim for the pair flow so we can issue a token.
        if (url.pathname === "/mobile/v1/pair/start") return json(res, 200, controlPlane.pairing.startPair(await readJson(req)));
        if (url.pathname === "/mobile/v1/pair/confirm") return json(res, 200, controlPlane.pairing.confirmPair(await readJson(req)));
        const body = await readJson(req);
        return json(res, 200, controlPlane.pairing.issueAccessToken({ deviceId: body?.deviceId }));
      }
      const auth = authenticate(req, controlPlane);
      if (!auth.ok) return json(res, 401, { error: auth.error });

      const required = ["idempotencyKey", "projectId", "actionType"];
      if (req.method === "POST" && url.pathname === "/mobile/v1/jobs") {
        const body = await readJson(req);
        const missing = required.filter((k) => !body || body[k] === undefined || body[k] === "");
        if (missing.length) return json(res, 400, { error: `missing required field(s): ${missing.join(", ")}` });
        const cached = controlPlane.idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          res.writeHead(cached.response.status, { "Content-Type": "application/json", "X-Idempotency-Replay": "true" });
          res.end(JSON.stringify(cached.response.body));
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: body.actionType, approvalRef: null, status: "replayed" });
          return;
        }
        const result = controlPlane.createJob({ ...body, deviceId: auth.deviceId, auditDeviceId: auth.deviceId });
        controlPlane.idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status: 202, body: result } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: body.actionType, approvalRef: null, status: "executed" });
        return json(res, 202, result);
      }
      const cancelMatch = url.pathname.match(/^\/mobile\/v1\/jobs\/([^/]+)\/cancel$/);
      if (req.method === "POST" && cancelMatch) {
        const body = await readJson(req);
        const fieldsRequired = ["idempotencyKey", "projectId", "actionType"];
        const missing = fieldsRequired.filter((k) => !body || body[k] === undefined || body[k] === "");
        if (missing.length) return json(res, 400, { error: `missing required field(s): ${missing.join(", ")}` });
        const cached = controlPlane.idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          res.writeHead(cached.response.status, { "Content-Type": "application/json", "X-Idempotency-Replay": "true" });
          res.end(JSON.stringify(cached.response.body));
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, status: "replayed" });
          return;
        }
        const job = controlPlane.cancelJob(decodeURIComponent(cancelMatch[1]));
        const body2 = job || { error: "job not found" };
        const status = job ? 200 : 404;
        controlPlane.idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: body2 } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, status: job ? "executed" : "not_found" });
        return json(res, status, body2);
      }
      const approvalMatch = url.pathname.match(/^\/mobile\/v1\/approvals\/([^/]+)\/decision$/);
      if (req.method === "POST" && approvalMatch) {
        const body = await readJson(req);
        const fieldsRequired = ["idempotencyKey", "projectId", "actionType", "approvalRef"];
        const missing = fieldsRequired.filter((k) => !body || body[k] === undefined || body[k] === "");
        if (missing.length) return json(res, 400, { error: `missing required field(s): ${missing.join(", ")}` });
        const cached = controlPlane.idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          res.writeHead(cached.response.status, { "Content-Type": "application/json", "X-Idempotency-Replay": "true" });
          res.end(JSON.stringify(cached.response.body));
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: body.actionType, approvalRef: body.approvalRef, status: "replayed" });
          return;
        }
        const decision = controlPlane.decideApproval({ id: decodeURIComponent(approvalMatch[1]), ...body, deviceId: auth.deviceId });
        const body2 = decision || { error: "approval not found" };
        const status = decision ? 200 : 404;
        controlPlane.idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: body2 } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: body.actionType, approvalRef: body.approvalRef, status: decision ? "executed" : "not_found" });
        return json(res, status, body2);
      }
      return json(res, 404, { error: "mobile endpoint not found" });
    } catch (error) {
      return json(res, 500, { error: error?.message || String(error) });
    }
  });
}

function authenticate(req, controlPlane) {
  if (!controlPlane.pairing) return { ok: false, error: "no pairing" };
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const verified = controlPlane.pairing.verifyAccessToken(token);
  return verified.ok ? { ok: true, deviceId: verified.deviceId } : { ok: false, error: verified.error };
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function fetchJson(server, method, pathname, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = httpRequest({
      method, hostname: "127.0.0.1", port, path: pathname,
      headers: { "Content-Type": "application/json", ...(headers || {}) },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = null; }
        resolve({ status: res.statusCode, body, raw: text, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function bootServer(controlPlane) {
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return server;
}

async function registerDevice(server) {
  const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex: TEST_PUBKEY } });
  const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", { body: { pairingId: start.body.pairingId, code: start.body.code } });
  const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", { body: { deviceId: confirm.body.deviceId } });
  return { deviceId: confirm.body.deviceId, accessToken: token.body.accessToken };
}

function readAuditLog(cacheDir) {
  const path = join(cacheDir, "audit.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test("mobile v1 /jobs: 400 when idempotencyKey is missing", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const r = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { projectId: "axi-rules", actionType: "create_job" },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /idempotencyKey/);
  } finally { server.close(); }
});

test("mobile v1 /jobs: 400 when actionType is missing", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const r = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { idempotencyKey: "stage2_test_key_aaaa", projectId: "axi-rules" },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /actionType/);
  } finally { server.close(); }
});

test("mobile v1 /jobs: idempotent replay returns X-Idempotency-Replay and the cached body", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const body = { idempotencyKey: "stage2_test_key_bbbb", projectId: "axi-rules", actionType: "create_job", payload: { foo: "bar" } };
    const first = await fetchJson(server, "POST", "/mobile/v1/jobs", { headers, body });
    assert.equal(first.status, 202);
    assert.equal(first.headers["x-idempotency-replay"], undefined);
    const second = await fetchJson(server, "POST", "/mobile/v1/jobs", { headers, body });
    assert.equal(second.status, first.status);
    assert.equal(second.headers["x-idempotency-replay"], "true");
    assert.deepEqual(second.body, first.body);
  } finally { server.close(); }
});

test("audit.jsonl records every executed + replayed mobile_action with the six fields", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = await bootServer(cp);
  try {
    const { deviceId, accessToken } = await registerDevice(server);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const idemKey = "stage2_test_key_cccc";
    const body = { idempotencyKey: idemKey, projectId: "axi-rules", actionType: "create_job" };

    await fetchJson(server, "POST", "/mobile/v1/jobs", { headers, body });
    await fetchJson(server, "POST", "/mobile/v1/jobs", { headers, body }); // replay

    const log = readAuditLog(cacheDir);
    const events = log.filter((e) => e.auditKind === "mobile_action");
    assert.equal(events.length, 2);
    assert.equal(events[0].deviceId, deviceId);
    assert.equal(events[0].idempotencyKey, idemKey);
    assert.equal(events[0].projectId, "axi-rules");
    assert.equal(events[0].actionType, "create_job");
    assert.equal(events[0].approvalRef, null);
    assert.equal(events[0].status, "executed");
    assert.equal(events[1].status, "replayed");
  } finally { server.close(); }
});

test("approvals decision route requires approvalRef", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const r = await fetchJson(server, "POST", "/mobile/v1/approvals/apr_doesnotexist/decision", {
      headers,
      body: { idempotencyKey: "stage2_test_key_dddd", projectId: "axi-rules", actionType: "approve" },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /approvalRef/);
  } finally { server.close(); }
});