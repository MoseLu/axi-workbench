import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "../src/control-plane.mjs";

function fixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-approval-scan-"));
  const cacheDir = join(workspaceRoot, ".cache");
  const projectPath = join(workspaceRoot, "projects", "sample");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {
    sample: { name: "受控示例", path: projectPath, health: ["node -e \"process.stdout.write('ok')\""] },
  } }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({ projects: [{
    id: "sample", stage: "building", confidence: "low", summary: "need evidence", updatedAt: new Date().toISOString(), evidence: [], remaining: [], handoff: { status: "ready" },
  }] }));
  return { cacheDir, controlPlane: createControlPlane({ workspaceRoot, cacheDir, graphPath, pairingTokenSecret: "approval-scan-test-secret" }) };
}

function pendingApproval(controlPlane, key) {
  const pending = controlPlane.createMobileProjectAction({
    idempotencyKey: key,
    projectId: "sample",
    actionId: "diagnose",
    actionType: "project_diagnosis",
    deviceId: "dev_test-owner",
  });
  assert.equal(pending.status, "pending_approval");
  return pending.approvalId;
}

test("approval scan resolves an opaque URI and derives the approval decision server-side", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_decision_001");
  const created = controlPlane.createApprovalScan({ approvalId });
  assert.equal(created.ok, true);
  assert.match(created.uri, /^axi:\/\/approval\/scan_/);
  assert.doesNotMatch(created.uri, /project|action|ticket/i);

  const preview = controlPlane.resolveApprovalScan(created.scanId);
  assert.equal(preview.ok, true);
  assert.equal(preview.object.projectId, "sample");
  assert.deepEqual(preview.availableDecisions, ["approved", "rejected"]);

  const decided = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "approved",
    idempotencyKey: "approval_scan_decision_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });
  assert.equal(decided.ok, true);
  assert.equal(decided.status, "approved");
  assert.ok(decided.approval.dispatchedJobId);
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8");
  assert.match(audit, /approval_scan_decided/);
  assert.match(audit, new RegExp(preview.handoffCorrelationId));
});

test("C/D scan decisions create a correlated Web handoff instead of executing on Mobile", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_handoff_001");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  assert.deepEqual(preview.availableDecisions, ["handoff", "rejected"]);

  const result = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: "approval_scan_handoff_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });
  assert.equal(result.status, "handed_off");
  assert.equal(result.handoff.handoffCorrelationId, preview.handoffCorrelationId);
  assert.equal(controlPlane.getHandoff(result.handoff.id).targetSurface, "web");
  assert.match(readFileSync(join(cacheDir, "audit.jsonl"), "utf8"), /handoff_created/);
});

test("approval scans derive their level from the persisted approval, not scanner input", () => {
  const { controlPlane } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_level_001");
  const created = controlPlane.createApprovalScan({ approvalId, actionLevel: "C" });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  assert.deepEqual(preview.availableDecisions, ["approved", "rejected"]);
});

test("approval scan refuses a correlation identifier from another scan", () => {
  const { controlPlane } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_correlation_001");
  const created = controlPlane.createApprovalScan({ approvalId });
  const result = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "approved",
    idempotencyKey: "approval_scan_correlation_submit_001",
    handoffCorrelationId: "handoff:scan_other",
    deviceId: "dev_test-owner",
  });
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 422);
  assert.match(result.error, /correlation/);
});
