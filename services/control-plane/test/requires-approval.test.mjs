import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createControlPlane } from "../src/control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

const TEST_SECRET = "mobile-project-approval-test-secret";
const TEST_PUBKEY = "9".repeat(64);

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
  const controlPlane = createControlPlane({ workspaceRoot, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  return { cacheDir, controlPlane, server: createControlPlaneHttpServer({ controlPlane }) };
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

async function pairedOwner(server) {
  const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex: TEST_PUBKEY } });
  const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", { body: { pairingId: start.body.pairingId, code: start.body.code } });
  const signatureHex = createHmac("sha256", TEST_PUBKEY).update(confirm.body.nonce.nonce).digest("hex");
  const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
    body: {
      deviceId: confirm.body.deviceId,
      nonceId: confirm.body.nonce.nonceId,
      nonce: confirm.body.nonce.nonce,
      signatureHex,
    },
  });
  return { deviceId: confirm.body.deviceId, headers: { Authorization: `Bearer ${token.body.accessToken}` } };
}

function readAudit(cacheDir) {
  const path = join(cacheDir, "audit.jsonl");
  return existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

test("mobile HTTP rejects raw text, commands, and forged actions before any job is created", async () => {
  const { server } = createFixture();
  await boot(server);
  try {
    const owner = await pairedOwner(server);
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
    const owner = await pairedOwner(server);
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
    const owner = await pairedOwner(server);
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
