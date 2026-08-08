import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { createControlPlane } from "../src/control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

function fixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-mobile-contract-http-"));
  const projectPath = join(workspaceRoot, "projects", "sample-app");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {
    "sample-app": {
      name: "示例应用",
      kind: "android-app",
      path: projectPath,
      health: ["node -e \"process.stdout.write('ok')\""],
    },
  } }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({ projects: [{
    id: "sample-app",
    stage: "building",
    confidence: "low",
    updatedAt: new Date().toISOString(),
    handoff: { status: "ready" },
  }] }));
  const controlPlane = createControlPlane({ workspaceRoot, graphPath, cacheDir: join(workspaceRoot, ".cache") });
  return createControlPlaneHttpServer({ controlPlane, mobileOwnerToken: "test-owner", pairingRequired: false });
}

function request(server, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      method: "POST",
      hostname: "127.0.0.1",
      port: server.address().port,
      path: pathname,
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-owner" },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

async function withServer(run) {
  const server = fixture();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(server);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("mobile action contract requires an actionId resolved from the project projection", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/mobile/v1/jobs", {
      idempotencyKey: "mobile_contract_no_action",
      projectId: "sample-app",
      actionType: "project_verification",
    });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /actionId/);
  });
});

test("mobile action contract rejects arbitrary payload instead of treating it as task input", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/mobile/v1/jobs", {
      idempotencyKey: "mobile_contract_payload00",
      projectId: "sample-app",
      actionId: "verify",
      actionType: "project_verification",
      payload: { command: "echo unsafe" },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /unsupported mobile project action field/);
  });
});

test("mobile approval decisions remain bound to approvalRef, project, actionId, and actionType", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/mobile/v1/approvals/apr_unknown/decision", {
      idempotencyKey: "mobile_contract_approval",
      projectId: "sample-app",
      actionId: "diagnose",
      actionType: "project_diagnosis",
      decision: "approved",
    });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /approvalRef/);
  });
});
