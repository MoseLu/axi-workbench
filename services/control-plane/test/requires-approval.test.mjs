import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createControlPlane } from "./test-control-plane.mjs";
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
  mkdirSync(join(workspaceRoot, "rbac"), { recursive: true });
  writeFileSync(join(workspaceRoot, "workspace.json"), JSON.stringify({ settings: { rbac: { version: "test-mobile-rbac-v1", grants: "rbac/grants.json" } } }));
  writeFileSync(join(workspaceRoot, "rbac", "grants.json"), JSON.stringify({ grants: [] }));
  const controlPlane = createControlPlane({ workspaceRoot, cacheDir, graphPath, registryPath: join(workspaceRoot, "workspace.json"), pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
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
  const grants = ["execute", "write", "approve"].map((action, index) => ({
    id: `grant:mobile-owner:${index}`,
    subjectRef: `user:${confirm.body.deviceId}`,
    roleRef: "role:mobile-owner",
    scopeType: "workspace",
    scopeRef: "workspace",
    resourceRef: "*",
    action,
    effect: "allow",
    inheritance: "default",
  }));
  writeFileSync(join(controlPlane.workspaceRoot, "rbac", "grants.json"), JSON.stringify({ version: "test-mobile-rbac-v1", grants }));
  return { deviceId: confirm.body.deviceId, headers: { Authorization: `Bearer ${elevated.body.accessToken}` } };
}

async function pairedWebOwner(server, controlPlane, ownerSubject = "owner@example.test") {
  const { publicKeyHex, privateKey } = freshKey();
  const internalHeaders = { "X-Axi-Internal-Token": "axi-development-internal-token", "X-Axi-Subject": ownerSubject };
  const started = await fetchJson(server, "POST", "/internal/web/v1/mobile/pair/qr", { headers: internalHeaders, body: {} });
  const scanned = await fetchJson(server, "POST", "/internal/mobile/v1/pair/qr/scan", {
    headers: { "X-Axi-Internal-Token": "axi-development-internal-token" },
    body: { webPairingId: started.body.webPairingId, scanToken: started.body.scanToken, publicKeyHex, publicKeyAlgorithm: "Ed25519", deviceName: "bound-test-device" },
  });
  assert.equal(scanned.status, 200, `Web QR scan failed: ${JSON.stringify(scanned.body)}`);
  const approved = await fetchJson(server, "POST", `/internal/web/v1/mobile/pair/qr/${started.body.webPairingId}/approve`, { headers: internalHeaders, body: {} });
  assert.equal(approved.status, 200, `Web QR approval failed: ${JSON.stringify(approved.body)}`);
  const status = await fetchJson(server, "POST", "/mobile/v1/pair/status", { body: { pairingId: scanned.body.pairingId, code: scanned.body.code } });
  assert.equal(status.body.status, "approved");

  const nonceResp = await fetchJson(server, "POST", "/mobile/v1/auth/nonce", { body: { deviceId: status.body.deviceId } });
  const ownerProof = controlPlane.pairing.getOwnerApprovalToken("owner-elevation", nonceResp.body.nonce);
  const elevated = await fetchJson(server, "POST", "/mobile/v1/auth/owner-token", {
    headers: { "X-Axi-Owner-Token": OWNER_APPROVAL_SECRET },
    body: { deviceId: status.body.deviceId, nonceId: nonceResp.body.nonceId, nonce: nonceResp.body.nonce, signatureHex: signNonce(privateKey, nonceResp.body.nonce), ownerProof },
  });
  assert.equal(elevated.status, 200, `bound owner-token upgrade failed: ${JSON.stringify(elevated.body)}`);
  const grants = ["execute", "write", "approve"].map((action, index) => ({
    id: `grant:bound-mobile-owner:${index}`,
    subjectRef: `user:${status.body.deviceId}`,
    roleRef: "role:mobile-owner",
    scopeType: "workspace",
    scopeRef: "workspace",
    resourceRef: "*",
    action,
    effect: "allow",
    inheritance: "default",
  }));
  writeFileSync(join(controlPlane.workspaceRoot, "rbac", "grants.json"), JSON.stringify({ version: "test-mobile-rbac-v1", grants }));
  return { deviceId: status.body.deviceId, headers: { Authorization: `Bearer ${elevated.body.accessToken}` }, internalHeaders };
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

test("mobile require_approval policy cannot be bypassed by an immediate registered action", async () => {
  const { controlPlane, server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedOwner(server, controlPlane);
    const deviceId = owner.deviceId;
    writeFileSync(join(controlPlane.workspaceRoot, "rbac", "grants.json"), JSON.stringify({
      version: "test-mobile-rbac-v1",
      grants: [
        {
          id: "grant:mobile-require-approval",
          subjectRef: `user:${deviceId}`,
          roleRef: "role:mobile-owner",
          scopeType: "workspace",
          scopeRef: "workspace",
          resourceRef: "*",
          action: "execute",
          effect: "require_approval",
          inheritance: "default",
        },
        {
          id: "grant:mobile-approve",
          subjectRef: `user:${deviceId}`,
          roleRef: "role:mobile-owner",
          scopeType: "workspace",
          scopeRef: "workspace",
          resourceRef: "*",
          action: "approve",
          effect: "allow",
          inheritance: "default",
        },
      ],
    }));
    const response = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_policy_approval", projectId: "sample-app", actionId: "verify", actionType: "project_verification" },
    });
    assert.equal(response.status, 202);
    assert.equal(response.body.status, "pending_approval");
    assert.equal(controlPlane.snapshot().agentTasks.length, 0);
    const decision = controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events.find((event) => event.result === "require_approval");
    assert.equal(decision.action, "execute");
    assert.equal(decision.objectRef, "sample-app");
  } finally {
    await close(server);
  }
});

test("core /jobs turns require_approval into a desktop pending request", async () => {
  const { controlPlane, server } = createFixture();
  await boot(server);
  try {
    writeFileSync(join(controlPlane.workspaceRoot, "rbac", "grants.json"), JSON.stringify({
      version: "test-core-rbac-v1",
      grants: [
        {
          id: "grant:core-require-approval",
          subjectRef: "user:core",
          roleRef: "role:core-owner",
          scopeType: "workspace",
          scopeRef: "workspace",
          resourceRef: "sample-app",
          action: "execute",
          effect: "require_approval",
          inheritance: "default",
        },
      ],
    }));
    const response = await fetchJson(server, "POST", "/jobs", {
      headers: { authorization: "Bearer test-core-api-token", "x-axi-subject": "user:core" },
      body: {
        projectId: "sample-app",
        envelope: {
          id: "core-http-approval-001",
          channel: "core",
          conversationId: "core-approval",
          senderId: "user:core",
          text: "执行 sample-app",
          receivedAt: "2026-09-13T00:00:00.000Z",
        },
      },
    });
    assert.equal(response.status, 202);
    assert.equal(response.body.status, "pending_approval");
    assert.equal(controlPlane.snapshot().agentTasks.length, 0);
    const approval = controlPlane.snapshot().approvals.find((item) => item.id === response.body.approvalId);
    assert.equal(approval.source, "desktop");
    assert.match(approval.policyDecisionRef, /^policy-decision:/);
    assert.equal(approval.actionSummary.length > 0, true);
    assert.ok(new Date(approval.expiresAt).getTime() > Date.now());
  } finally {
    await close(server);
  }
});

test("mobile HTTP diagnosis follows pending approval, approval dispatch, and rejection without raw task replay", async () => {
  const { cacheDir, controlPlane, server } = createFixture();
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
    const persistedApproval = controlPlane.snapshot().approvals.find((item) => item.id === initial.body.approvalId);
    assert.match(persistedApproval.policyDecisionRef, /^policy-decision:/);

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
    assert.match(approved.body.decisionPolicyDecisionRef, /^policy-decision:/);
    assert.notEqual(approved.body.decisionPolicyDecisionRef, persistedApproval.policyDecisionRef);
    assert.equal(diagnosis.metadata.policyDecisionRef, approved.body.decisionPolicyDecisionRef);
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

    const decisions = readAudit(cacheDir).filter((entry) => entry.auditKind === "policy_decision");
    assert.deepEqual(decisions.map((entry) => entry.result), ["approved", "rejected"]);
    assert.ok(decisions.every((entry) => entry.policyDecisionRef && entry.objectRef === "sample-app" && entry.actorRef === owner.deviceId));
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
    const mobileHistory = await fetchJson(server, "GET", "/internal/mobile/v1/handoffs?status=pending", { headers: { ...owner.headers, "X-Axi-Internal-Token": "axi-development-internal-token" } });
    assert.equal(mobileHistory.status, 200);
    assert.ok(mobileHistory.body.handoffs.some((item) => item.id === handedOff.body.handoff.id));
    const invalidMobileHistory = await fetchJson(server, "GET", "/internal/mobile/v1/handoffs?status=invalid", { headers: { ...owner.headers, "X-Axi-Internal-Token": "axi-development-internal-token" } });
    assert.equal(invalidMobileHistory.status, 400);
    const pendingHistory = await fetchJson(server, "GET", "/internal/web/v1/handoffs?status=pending", { headers: internalHeaders });
    assert.equal(pendingHistory.status, 200);
    assert.ok(pendingHistory.body.handoffs.some((item) => item.id === handedOff.body.handoff.id));
    const invalidHistory = await fetchJson(server, "GET", "/internal/web/v1/handoffs?status=invalid", { headers: internalHeaders });
    assert.equal(invalidHistory.status, 400);
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
    assert.ok(audit.some((event) => event.auditKind === "handoff_opened" && event.actorRef === "owner@example.test" && event.sourceActorRef === handedOff.body.handoff.sourceActorRef && event.handoffCorrelationId === preview.body.handoffCorrelationId));
    assert.ok(audit.some((event) => event.auditKind === "handoff_completed" && event.handoffCorrelationId === preview.body.handoffCorrelationId));

    const rejectInitial = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_scan_handoff_reject", projectId: "sample-app", actionId: "diagnose", actionType: "project_diagnosis" },
    });
    assert.equal(rejectInitial.status, 202);
    const rejectApproval = controlPlane.snapshot().approvals.find((item) => item.id === rejectInitial.body.approvalId);
    rejectApproval.actionLevel = "C";
    writeFileSync(join(cacheDir, "approvals", `${rejectInitial.body.approvalId}.json`), JSON.stringify(rejectApproval));
    const rejectScan = controlPlane.createApprovalScan({ approvalId: rejectInitial.body.approvalId });
    const rejectPreview = await fetchJson(server, "POST", "/mobile/v1/approval-scans/resolve", { headers: owner.headers, body: { scanToken: rejectScan.scanId } });
    const rejectHandoff = await fetchJson(server, "POST", `/mobile/v1/approval-scans/${rejectScan.scanId}/decision`, {
      headers: owner.headers,
      body: { decision: "handoff", idempotencyKey: "mobile_http_scan_handoff_reject_decision", handoffCorrelationId: rejectPreview.body.handoffCorrelationId },
    });
    assert.equal(rejectHandoff.status, 202);
    const missingReason = await fetchJson(server, "POST", `/internal/web/v1/handoffs/${rejectHandoff.body.handoff.id}`, {
      headers: internalHeaders,
      body: { action: "reject", reason: " " },
    });
    assert.equal(missingReason.status, 400);
    const rejected = await fetchJson(server, "POST", `/internal/web/v1/handoffs/${rejectHandoff.body.handoff.id}`, {
      headers: internalHeaders,
      body: { action: "reject", reason: "Web 端当前不负责该对象" },
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, "rejected");
    assert.equal(rejected.body.rejectedBy, "owner@example.test");
    assert.equal(rejected.body.rejectionReason, "Web 端当前不负责该对象");
    const rejectionReplay = await fetchJson(server, "POST", `/internal/web/v1/handoffs/${rejectHandoff.body.handoff.id}`, {
      headers: internalHeaders,
      body: { action: "reject", reason: "不能覆盖已完成终态" },
    });
    assert.equal(rejectionReplay.status, 200);
    assert.equal(rejectionReplay.body.rejectionReason, "Web 端当前不负责该对象");
    const rejectedAudit = readAudit(cacheDir);
    assert.ok(rejectedAudit.some((event) => event.auditKind === "handoff_rejected" && event.status === "rejected" && event.reason === "Web 端当前不负责该对象"));
  } finally {
    await close(server);
  }
});

test("Web-owned pairing binds handoff ownership and returns 403 for another Web subject", async () => {
  const { cacheDir, controlPlane, server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedWebOwner(server, controlPlane);
    const initial = await fetchJson(server, "POST", "/mobile/v1/jobs", {
      headers: owner.headers,
      body: { idempotencyKey: "mobile_http_bound_handoff_001", projectId: "sample-app", actionId: "diagnose", actionType: "project_diagnosis" },
    });
    assert.equal(initial.status, 202);
    const approval = controlPlane.snapshot().approvals.find((item) => item.id === initial.body.approvalId);
    approval.actionLevel = "C";
    writeFileSync(join(cacheDir, "approvals", `${initial.body.approvalId}.json`), JSON.stringify(approval));
    const scan = controlPlane.createApprovalScan({ approvalId: initial.body.approvalId });
    const preview = await fetchJson(server, "POST", "/mobile/v1/approval-scans/resolve", { headers: owner.headers, body: { scanToken: scan.scanId } });
    const handedOff = await fetchJson(server, "POST", `/mobile/v1/approval-scans/${scan.scanId}/decision`, {
      headers: owner.headers,
      body: { decision: "handoff", idempotencyKey: "mobile_http_bound_handoff_decision", handoffCorrelationId: preview.body.handoffCorrelationId },
    });
    assert.equal(handedOff.status, 202);
    assert.equal(handedOff.body.handoff.sourceOwnerRef, "owner@example.test");

    const wrongSubjectHeaders = { "X-Axi-Internal-Token": "axi-development-internal-token", "X-Axi-Subject": "other@example.test" };
    const deniedHistory = await fetchJson(server, "GET", "/internal/web/v1/handoffs?status=pending", { headers: wrongSubjectHeaders });
    assert.equal(deniedHistory.status, 200);
    assert.equal(deniedHistory.body.handoffs.some((item) => item.id === handedOff.body.handoff.id), false);
    const deniedOpen = await fetchJson(server, "GET", `/internal/web/v1/handoffs/${handedOff.body.handoff.id}`, { headers: wrongSubjectHeaders });
    assert.equal(deniedOpen.status, 403);
    assert.equal(deniedOpen.body.error, "handoff owner authorization required");
    assert.ok(readAudit(cacheDir).some((event) => event.auditKind === "handoff_access_denied" && event.actorRef === "other@example.test" && event.sourceOwnerRef === "owner@example.test"));
  } finally {
    await close(server);
  }
});
