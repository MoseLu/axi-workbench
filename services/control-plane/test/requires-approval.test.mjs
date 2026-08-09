import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createControlPlane } from "../src/control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

const TEST_SECRET = "mobile-project-approval-test-secret";
const OWNER_APPROVAL_SECRET = "mobile-project-approval-owner-secret";

function freshKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  return { publicKeyHex, privateKey: createPrivateKey(privateKeyPem) };
}

function signNonce(privateKey, nonce) {
  return cryptoSign(null, Buffer.from(nonce, "utf8"), privateKey).toString("hex");
}

function createFixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-mobile-approval-http-"));
  const cacheDir = join(workspaceRoot, ".control-cache");
  const projectPath = join(workspaceRoot, "projects", "sample-app");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "sample-app": {
        name: "示例应用",
        kind: "android-app",
        path: projectPath,
        health: ["node -e \"process.stdout.write('health ok')\""],
      },
    },
  }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({
    projects: [{
      id: "sample-app",
      stage: "building",
      confidence: "low",
      summary: "Evidence needs review.",
      updatedAt: new Date().toISOString(),
      evidence: [],
      remaining: [],
      handoff: { status: "ready" },
    }],
  }));
  const controlPlane = createControlPlane({ workspaceRoot, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  return { cacheDir, controlPlane, server: createControlPlaneHttpServer({ controlPlane, coreApiToken: "test-core-api-token", ownerApprovalSecret: OWNER_APPROVAL_SECRET }) };
}

function fetchJson(server, method, pathname, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = httpRequest({
      method,
      hostname: "127.0.0.1",
      port,
      path: pathname,
      headers: { "Content-Type": "application/json", ...(headers || {}) },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : null });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function boot(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function pairedOwner(server, controlPlane) {
  const { publicKeyHex, privateKey } = freshKey();
  const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
  const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
  const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
    body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
  });
  // Owner-elevate via the new /auth/owner-token route (X-Axi-Owner-Token header).
  const nonceResp = await fetchJson(server, "POST", "/mobile/v1/auth/nonce", { body: { deviceId: confirm.body.deviceId } });
  const ownerProof = controlPlane.pairing.getOwnerApprovalToken("owner-elevation", nonceResp.body.nonce);
  const elevated = await fetchJson(server, "POST", "/mobile/v1/auth/owner-token", {
    headers: { "X-Axi-Owner-Token": OWNER_APPROVAL_SECRET },
    body: {
      deviceId: confirm.body.deviceId,
      nonceId: nonceResp.body.nonceId,
      nonce: nonceResp.body.nonce,
      signatureHex: signNonce(privateKey, nonceResp.body.nonce),
      ownerProof,
    },
  });
  assert.equal(elevated.status, 200, `owner-token upgrade failed: ${JSON.stringify(elevated.body)}`);
  return { deviceId: confirm.body.deviceId, headers: { Authorization: `Bearer ${elevated.body.accessToken}` } };
}

function readAudit(cacheDir) {
  const path = join(cacheDir, "audit.jsonl");
  return existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

test("mobile HTTP rejects raw text, commands, and forged actions before any job is created", async () => {
  const { controlPlane, server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedOwner(server, controlPlane);
    const raw = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_raw_input01", projectId: "sample-app", actionId: "verify", actionType: "project_verification", text: "rm -rf /tmp/nope" },
    });
    assert.equal(raw.status, 400);
    assert.match(raw.body.error, /raw execution fields/);

    const forged = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_forged_act", projectId: "sample-app", actionId: "verify", actionType: "project_diagnosis" },
    });
    assert.equal(forged.status, 422);
    assert.match(forged.body.error, /actionType/);
  } finally {
    await close(server);
  }
});

test("mobile HTTP verification is idempotent and audited from the registered action projection", async () => {
  const { cacheDir, controlPlane, server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedOwner(server, controlPlane);
    const body = { idempotencyKey: "mobile_http_verify_001", projectId: "sample-app", actionId: "verify", actionType: "project_verification" };
    const first = await fetchJson(server, "POST", "/mobile/v1/jobs", { headers: owner.headers, body });
    assert.equal(first.status, 202);
    assert.equal(first.body.accepted, true);
    const replay = await fetchJson(server, "POST", "/mobile/v1/jobs", { headers: owner.headers, body });
    assert.equal(replay.status, 202);
    assert.equal(replay.headers["x-idempotency-replay"], "true");
    assert.deepEqual(replay.body, first.body);
    await settle();
    assert.equal(controlPlane.getJob(first.body.job.id).status, "completed");

    const mobileEvents = readAudit(cacheDir).filter((entry) => entry.auditKind === "mobile_action");
    assert.deepEqual(mobileEvents.map((entry) => entry.status), ["executed", "replayed"]);
    assert.ok(mobileEvents.every((entry) => entry.actionId === "verify"));
  } finally {
    await close(server);
  }
});

test("mobile HTTP diagnosis follows pending approval, approval dispatch, and rejection without raw task replay", async () => {
  const { controlPlane, server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedOwner(server, controlPlane);
    const initial = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_diag_00001", projectId: "sample-app", actionId: "diagnose", actionType: "project_diagnosis" },
    });
    assert.equal(initial.status, 202);
    assert.equal(initial.body.status, "pending_approval");
    const workspace = await fetchJson(server, "GET", "/mobile/v1/workspace", { headers: owner.headers });
    const approval = workspace.body.approvals.find((item) => item.id === initial.body.approvalId);
    assert.equal(approval.actionId, "diagnose");
    assert.equal(approval.actionType, "project_diagnosis");

    const approved = await fetchJson(server, "POST", `/mobile/v1/approvals/${initial.body.approvalId}/decision`, {
      headers: owner.headers,
      body: {
        idempotencyKey: "mobile_http_approve001",
        projectId: "sample-app",
        actionId: "diagnose",
        actionType: "project_diagnosis",
        approvalRef: initial.body.approvalId,
        decision: "approved",
      },
    });
    assert.equal(approved.status, 200);
    assert.ok(approved.body.dispatchedJobId);
    await settle();
    const diagnosis = controlPlane.getJob(approved.body.dispatchedJobId);
    assert.equal(diagnosis.metadata.executionMode, "project_diagnosis");
    assert.equal(controlPlane.getAgentTask(diagnosis.metadata.agentTaskId).projectFileWrite, false);

    const rejectedInitial = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_diag_00002", projectId: "sample-app", actionId: "diagnose", actionType: "project_diagnosis" },
    });
    const rejected = await fetchJson(server, "POST", `/mobile/v1/approvals/${rejectedInitial.body.approvalId}/decision`, {
      headers: owner.headers,
      body: {
        idempotencyKey: "mobile_http_reject_001",
        projectId: "sample-app",
        actionId: "diagnose",
        actionType: "project_diagnosis",
        approvalRef: rejectedInitial.body.approvalId,
        decision: "rejected",
      },
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.dispatchedJobId, undefined);
  } finally {
    await close(server);
  }
});

test("mobile approval scan resolves server-side, rejects forged fields, and hands C-level work to Web", async () => {
  const { cacheDir, controlPlane, server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedOwner(server, controlPlane);
    const initial = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_scan_00001", projectId: "sample-app", actionId: "diagnose", actionType: "project_diagnosis" },
    });
    // The mobile caller cannot choose an action level. Persist the higher level
    // on the approval record as the server-side policy source of truth.
    const approval = controlPlane.snapshot().approvals.find((item) => item.id === initial.body.approvalId);
    approval.actionLevel = "C";
    writeFileSync(join(cacheDir, "approvals", `${initial.body.approvalId}.json`), JSON.stringify(approval));
    const created = controlPlane.createApprovalScan({ approvalId: initial.body.approvalId });
    assert.equal(created.ok, true);

    const malformedResolve = await fetchJson(server, "POST", "/mobile/v1/approval-scans/resolve", {
      headers: owner.headers,
      body: { scanToken: created.scanId, projectId: "forged" },
    });
    assert.equal(malformedResolve.status, 400);

    const preview = await fetchJson(server, "POST", "/mobile/v1/approval-scans/resolve", {
      headers: owner.headers,
      body: { scanToken: created.scanId },
    });
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.body.availableDecisions, ["handoff", "rejected"]);

    const forgedDecision = await fetchJson(server, "POST", `/mobile/v1/approval-scans/${created.scanId}/decision`, {
      headers: owner.headers,
      body: {
        decision: "handoff",
        idempotencyKey: "mobile_http_scan_forged",
        handoffCorrelationId: preview.body.handoffCorrelationId,
        projectId: "forged",
      },
    });
    assert.equal(forgedDecision.status, 400);

    const mismatchedCorrelation = await fetchJson(server, "POST", `/mobile/v1/approval-scans/${created.scanId}/decision`, {
      headers: owner.headers,
      body: { decision: "handoff", idempotencyKey: "mobile_http_scan_wrong1", handoffCorrelationId: "handoff:scan_wrong" },
    });
    assert.equal(mismatchedCorrelation.status, 422);

    const request = { decision: "handoff", idempotencyKey: "mobile_http_scan_handoff", handoffCorrelationId: preview.body.handoffCorrelationId };
    const handedOff = await fetchJson(server, "POST", `/mobile/v1/approval-scans/${created.scanId}/decision`, { headers: owner.headers, body: request });
    assert.equal(handedOff.status, 202);
    assert.equal(handedOff.body.handoff.handoffCorrelationId, preview.body.handoffCorrelationId);
    const replay = await fetchJson(server, "POST", `/mobile/v1/approval-scans/${created.scanId}/decision`, { headers: owner.headers, body: request });
    assert.equal(replay.status, 202);
    assert.equal(replay.headers["x-idempotency-replay"], "true");

    const internalHeaders = {
      "X-Axi-Internal-Token": "axi-development-internal-token",
      "X-Axi-Subject": "owner@example.test",
    };
    const opened = await fetchJson(server, "GET", `/internal/web/v1/handoffs/${handedOff.body.handoff.id}`, { headers: internalHeaders });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.status, "opened");
    const completed = await fetchJson(server, "POST", `/internal/web/v1/handoffs/${handedOff.body.handoff.id}`, {
      headers: internalHeaders,
      body: { outcome: "completed_in_web_control_center" },
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.status, "completed");
    assert.equal(completed.body.handoffCorrelationId, preview.body.handoffCorrelationId);

    const audit = readAudit(cacheDir);
    assert.ok(audit.some((event) => event.auditKind === "handoff_created" && event.handoffCorrelationId === preview.body.handoffCorrelationId));
    assert.ok(audit.some((event) => event.auditKind === "handoff_completed" && event.handoffCorrelationId === preview.body.handoffCorrelationId));
  } finally {
    await close(server);
  }
});
