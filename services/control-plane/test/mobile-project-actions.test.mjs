import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "../src/control-plane.mjs";

function createFixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-mobile-project-action-"));
  const cacheDir = join(workspaceRoot, ".control-cache");
  const projectPath = join(workspaceRoot, "projects", "sample-app");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  const sourceMarker = join(projectPath, "source-marker.txt");
  writeFileSync(sourceMarker, "project source must remain unchanged\n");
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "sample-app": {
        name: "示例应用",
        kind: "android-app",
        path: projectPath,
        health: ["node -e \"process.stdout.write('health ok')\""],
      },
      "safe-but-passive": {
        name: "只读信息项目",
        kind: "service",
        path: projectPath,
      },
    },
  }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({
    projects: [{
      id: "sample-app",
      stage: "building",
      confidence: "low",
      summary: "The evidence is incomplete.",
      updatedAt: new Date().toISOString(),
      evidence: ["unit:test"],
      remaining: ["device validation"],
      handoff: { status: "ready" },
    }, {
      id: "safe-but-passive",
      stage: "usable",
      confidence: "medium",
      summary: "Ready.",
      updatedAt: new Date().toISOString(),
      evidence: [],
      remaining: [],
      handoff: { status: "ready" },
    }],
  }));
  return {
    workspaceRoot,
    cacheDir,
    graphPath,
    projectPath,
    sourceMarker,
    controlPlane: createControlPlane({ workspaceRoot, cacheDir, graphPath, pairingTokenSecret: "test-mobile-project-action-secret" }),
  };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

test("mobile projection exposes only registered safe verification and approval-gated diagnosis", () => {
  const { controlPlane } = createFixture();
  const snapshot = controlPlane.mobileSnapshot();
  const project = snapshot.projects.find((item) => item.id === "sample-app");
  const passive = snapshot.projects.find((item) => item.id === "safe-but-passive");

  assert.equal(project.health, "attention");
  assert.equal(project.reasonCode, "evidence_low_confidence");
  assert.deepEqual(project.actions.map((action) => action.actionId), ["verify", "diagnose"]);
  assert.deepEqual(project.actions.map((action) => action.executionMode), ["immediate", "requires_approval"]);
  assert.equal(project.actions[0].actionType, "project_verification");
  assert.equal(project.actions[1].actionType, "project_diagnosis");
  assert.deepEqual(passive.actions, [], "a project without an explicitly safe action must not show a fake action button");
  assert.match(snapshot.attentionItems.find((item) => item.projectId === "sample-app").summary, /证据置信度不足/);
});

test("mobile project action resolver rejects forged cross-project actions, mismatched types, and raw execution input", () => {
  const { controlPlane } = createFixture();

  const unknownProject = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_unknown_project_001",
    projectId: "other-project",
    actionId: "verify",
    actionType: "project_verification",
  });
  assert.deepEqual(unknownProject, { ok: false, httpStatus: 404, error: "project not found" });

  const mismatchedType = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_wrong_type_0001",
    projectId: "sample-app",
    actionId: "verify",
    actionType: "project_diagnosis",
  });
  assert.equal(mismatchedType.ok, false);
  assert.equal(mismatchedType.httpStatus, 422);

  const rawText = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_raw_text_reject",
    projectId: "sample-app",
    actionId: "verify",
    actionType: "project_verification",
    text: "rm -rf /tmp/not-accepted",
  });
  assert.equal(rawText.ok, false);
  assert.equal(rawText.httpStatus, 400);
  assert.match(rawText.error, /raw execution fields/);
});

test("registered mobile verification runs through an audited AgentTask", async () => {
  const { controlPlane } = createFixture();
  const accepted = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_verify_action_001",
    projectId: "sample-app",
    actionId: "verify",
    actionType: "project_verification",
    deviceId: "paired-owner",
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.job.metadata.executionMode, "registered_command");
  await settle();

  const completed = controlPlane.getJob(accepted.job.id);
  const task = controlPlane.getAgentTask(completed.metadata.agentTaskId);
  assert.equal(completed.status, "completed");
  assert.equal(task.runtime, "registered_command");
  assert.equal(task.status, "succeeded");
  assert.match(task.stdout, /health ok/);
});

test("approved mobile diagnosis creates a project-scoped read-only AgentTask and never writes project files", async () => {
  const { controlPlane, sourceMarker } = createFixture();
  const sourceBefore = readFileSync(sourceMarker, "utf8");
  const pending = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_diagnosis_action1",
    projectId: "sample-app",
    actionId: "diagnose",
    actionType: "project_diagnosis",
    deviceId: "paired-owner",
  });
  assert.equal(pending.status, "pending_approval");
  assert.ok(pending.approvalId);

  const approved = controlPlane.decideApproval({ id: pending.approvalId, decision: "approved", decisionText: "owner approved" });
  assert.equal(approved.status, "approved");
  assert.ok(approved.dispatchedJobId);
  await settle();

  const job = controlPlane.getJob(approved.dispatchedJobId);
  const task = controlPlane.getAgentTask(job.metadata.agentTaskId);
  assert.equal(job.status, "completed");
  assert.equal(job.metadata.executionMode, "project_diagnosis");
  assert.equal(task.runtime, "project_diagnosis");
  assert.equal(task.targetId, "sample-app");
  assert.equal(task.readOnly, true);
  assert.equal(task.projectFileWrite, false);
  assert.deepEqual(task.writeScope, []);
  assert.match(task.stdout, /evidence_low_confidence/);
  const completed = controlPlane.mobileSnapshot().recentTasks.find((item) => item.id === task.id);
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.reasonCode, "diagnosis_completed");
  assert.equal(completed.actionType, "project_diagnosis");
  assert.equal(readFileSync(sourceMarker, "utf8"), sourceBefore);
});

test("completed mobile diagnosis remains visible after a control-plane restart", async () => {
  const { controlPlane, workspaceRoot, cacheDir, graphPath } = createFixture();
  const pending = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_diagnosis_restart1",
    projectId: "sample-app",
    actionId: "diagnose",
    actionType: "project_diagnosis",
    deviceId: "paired-owner",
  });
  const approved = controlPlane.decideApproval({ id: pending.approvalId, decision: "approved" });
  await settle();

  const restarted = createControlPlane({
    workspaceRoot,
    cacheDir,
    graphPath,
    pairingTokenSecret: "test-mobile-project-action-secret",
  });
  const result = restarted.mobileSnapshot().recentTasks.find((item) => item.projectId === "sample-app");
  assert.equal(result.status, "succeeded");
  assert.equal(result.reasonCode, "diagnosis_completed");
});

test("rejected mobile diagnosis has no dispatched job", () => {
  const { controlPlane } = createFixture();
  const pending = controlPlane.createMobileProjectAction({
    idempotencyKey: "mobile_diagnosis_reject1",
    projectId: "sample-app",
    actionId: "diagnose",
    actionType: "project_diagnosis",
    deviceId: "paired-owner",
  });
  const rejected = controlPlane.decideApproval({ id: pending.approvalId, decision: "rejected", decisionText: "not now" });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.dispatchedJobId, undefined);
});
