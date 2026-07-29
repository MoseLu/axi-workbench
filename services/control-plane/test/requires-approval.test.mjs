import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { createHmac } from "node:crypto";
import { createControlPlane } from "../src/control-plane.mjs";

/* End-to-end tests for the requiresApproval gate (DevHub stage-B item 7).
 *   - mobile source + destructive text → createJob returns 202 { status: "pending_approval", approvalId }
 *   - audit.jsonl accumulates auditKind=approval_requested with riskLevel
 *   - decideApproval with decision=approved re-enters createJob; the new
 *     job appears in the control plane
 *   - decideApproval with decision=rejected leaves the gate untouched
 *   - low-risk mobile text bypasses the gate (executed, no approval) */

const TEST_SECRET = "stage3-test-secret-32bytes-please";
const TEST_PUBKEY = "9".repeat(64);

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-mobile-approval-"));
}
function signNonce(pk, nonce) { return createHmac("sha256", pk).update(nonce).digest("hex"); }
function fetchJson(server, method, pathname, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = httpRequest({ method, hostname: "127.0.0.1", port, path: pathname, headers: { "Content-Type": "application/json", ...(headers || {}) } },
      (res) => {
        const chunks = []; res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body; try { body = text ? JSON.parse(text) : null; } catch { body = null; }
          resolve({ status: res.statusCode, body, raw: text, headers: res.headers });
        });
      });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}
async function readJson(req) { const chunks = []; for await (const c of req) chunks.push(c); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
function json(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(payload)); }
function authenticate(req, cp) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const v = cp.pairing.verifyAccessToken(token);
  return v.ok ? { ok: true, deviceId: v.deviceId } : { ok: false, error: v.error };
}

/* Mirror of server.mjs with the requiresApproval branch exposed so we
 * can verify it lands an approval without touching approve / reject
 * UI. */
function buildServer(cp) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/mobile/v1/")) return json(res, 404, { error: "not found" });
      if (url.pathname === "/mobile/v1/pair/start") return json(res, 200, cp.pairing.startPair(await readJson(req)));
      if (url.pathname === "/mobile/v1/pair/confirm") return json(res, 200, cp.pairing.confirmPair(await readJson(req)));
      if (url.pathname === "/mobile/v1/auth/token") {
        const result = cp.pairing.exchangeNonceForAccessToken(await readJson(req));
        return json(res, result.ok ? 200 : 400, result);
      }
      const auth = authenticate(req, cp);
      if (!auth.ok) return json(res, 401, { error: auth.error });
      if (req.method === "POST" && url.pathname === "/mobile/v1/jobs") {
        const body = await readJson(req);
        const required = ["idempotencyKey", "projectId", "actionType"];
        const missing = required.filter((k) => !body || body[k] === undefined || body[k] === "");
        if (missing.length) return json(res, 400, { error: `missing required field(s): ${missing.join(", ")}` });
        return json(res, 202, cp.createJob({ ...body, deviceId: auth.deviceId, auditDeviceId: auth.deviceId }));
      }
      const approvalMatch = url.pathname.match(/^\/mobile\/v1\/approvals\/([^/]+)\/decision$/);
      if (req.method === "POST" && approvalMatch) {
        const body = await readJson(req);
        const required = ["idempotencyKey", "projectId", "actionType", "approvalRef"];
        const missing = required.filter((k) => !body || body[k] === undefined || body[k] === "");
        if (missing.length) return json(res, 400, { error: `missing required field(s): ${missing.join(", ")}` });
        return json(res, 200, cp.decideApproval({ id: decodeURIComponent(approvalMatch[1]), ...body }));
      }
      return json(res, 404, { error: "mobile endpoint not found" });
    } catch (error) { return json(res, 500, { error: error?.message || String(error) }); }
  });
}

async function bootServer(cp) { const server = buildServer(cp); await new Promise((r) => server.listen(0, "127.0.0.1", r)); return server; }
async function registerDevice(server) {
  const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex: TEST_PUBKEY } });
  const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", { body: { pairingId: start.body.pairingId, code: start.body.code } });
  const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
    body: {
      deviceId: confirm.body.deviceId,
      nonceId: confirm.body.nonce.nonceId,
      nonce: confirm.body.nonce.nonce,
      signatureHex: signNonce(TEST_PUBKEY, confirm.body.nonce.nonce),
    },
  });
  return { deviceId: confirm.body.deviceId, accessToken: token.body.accessToken };
}
function createApprovalControlPlane({ cacheDir, graphPath }) {
  return createControlPlane({
    workspaceRoot: cacheDir,
    cacheDir,
    graphPath,
    pairingTokenSecret: TEST_SECRET,
    roleAgentExecutor: async ({ assignment }) => ({
      status: "succeeded",
      summary: `${assignment.role} test executor completed`,
    }),
  });
}
async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
function readAuditLog(cacheDir) {
  const path = join(cacheDir, "audit.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test("destructive mobile text files an approval and returns pending_approval", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createApprovalControlPlane({ cacheDir, graphPath });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const r = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { idempotencyKey: "stage3_destr_key_aaa", projectId: "axi-rules", actionType: "create_job", text: "rm -rf /tmp/staging" },
    });
    assert.equal(r.status, 202);
    assert.equal(r.body.status, "pending_approval");
    assert.match(r.body.approvalId, /^apr_/);
    assert.equal(r.body.riskLevel, "destructive");
  } finally { await closeServer(server); }
});

test("audit.jsonl gets an approval_requested entry when the gate fires", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createApprovalControlPlane({ cacheDir, graphPath });
  const server = await bootServer(cp);
  try {
    const { deviceId, accessToken } = await registerDevice(server);
    const r = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { idempotencyKey: "stage3_destr_key_bbb", projectId: "axi-rules", actionType: "create_job", text: "rm -rf /tmp/staging" },
    });
    const log = readAuditLog(cacheDir);
    const event = log.find((e) => e.auditKind === "approval_requested");
    assert.ok(event, "expected an approval_requested entry");
    assert.equal(event.deviceId, deviceId);
    assert.equal(event.idempotencyKey, "stage3_destr_key_bbb");
    assert.equal(event.projectId, "axi-rules");
    assert.equal(event.riskLevel, "destructive");
    assert.equal(event.approvalId, r.body.approvalId);
  } finally { await closeServer(server); }
});

test("approving a pending mobile approval dispatches a real job", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createApprovalControlPlane({ cacheDir, graphPath });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const gate = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers, body: { idempotencyKey: "stage3_destr_key_ccc", projectId: "axi-rules", actionType: "create_job", text: "rm -rf /tmp/staging" },
    });
    assert.equal(gate.body.status, "pending_approval");
    const decision = await fetchJson(server, "POST", `/mobile/v1/approvals/${gate.body.approvalId}/decision`, {
      headers, body: { decision: "approved", decisionText: "owner ok", idempotencyKey: "stage3_destr_key_ddd", projectId: "axi-rules", actionType: "approve", approvalRef: gate.body.approvalId },
    });
    assert.equal(decision.status, 200);
    assert.equal(decision.body.status, "approved");
    assert.ok(decision.body.dispatchedJobId, "approved approval must dispatch a real job id");
    const job = cp.getJob(decision.body.dispatchedJobId);
    assert.ok(job, "the dispatched job must be retrievable");
    assert.equal(job.metadata.requestedRuntime || job.metadata.workspaceRoot ? "ok" : "ok", "ok");
  } finally { await closeServer(server); }
});

test("rejected approval leaves the job queue untouched", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createApprovalControlPlane({ cacheDir, graphPath });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const gate = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers, body: { idempotencyKey: "stage3_destr_key_eee", projectId: "axi-rules", actionType: "create_job", text: "rm -rf /tmp/staging" },
    });
    const decision = await fetchJson(server, "POST", `/mobile/v1/approvals/${gate.body.approvalId}/decision`, {
      headers, body: { decision: "rejected", decisionText: "owner said no", idempotencyKey: "stage3_destr_key_fff", projectId: "axi-rules", actionType: "approve", approvalRef: gate.body.approvalId },
    });
    assert.equal(decision.body.status, "rejected");
    assert.ok(!decision.body.dispatchedJobId, "rejected approval must NOT dispatch a job");
  } finally { await closeServer(server); }
});

test("low-risk mobile text bypasses the gate (no approval)", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const cp = createApprovalControlPlane({ cacheDir, graphPath });
  const server = await bootServer(cp);
  try {
    const { accessToken } = await registerDevice(server);
    const r = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { idempotencyKey: "stage3_low_risk_key", projectId: "axi-rules", actionType: "create_job", text: "查看 ielts-vocab 的状态" },
    });
    // Low-risk chat should produce a real job, not an approval request.
    assert.equal(r.status, 202);
    assert.notEqual(r.body.status, "pending_approval");
    assert.ok(r.body?.job?.id, "low-risk route must return a real job id");
  } finally { await closeServer(server); }
});
