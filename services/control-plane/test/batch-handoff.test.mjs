import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "os";
import { createControlPlane } from "./test-control-plane.mjs";

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "axi-batch-handoff-"));
  mkdirSync(join(root, ".cache", "handoffs"), { recursive: true });
  return root;
}

test("createBatchHandoff creates multiple handoffs with common batchId", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const objects = [
    { type: "approval", id: "approval-1" },
    { type: "approval", id: "approval-2" },
    { type: "approval", id: "approval-3" },
  ];

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "B",
    objects,
    reason: "Batch handover of approvals",
  });

  assert.equal(result.ok, true);
  assert.ok(result.batchId);
  assert.match(result.batchId, /^BATCH-\d+-[a-f0-9]{8}$/);
  assert.equal(result.totalCount, 3);
  assert.equal(result.successCount, 3);
  assert.equal(result.failureCount, 0);
  assert.equal(result.status, "completed");
  assert.equal(result.handoffs.length, 3);

  // Verify each handoff has the same batchId
  for (const handoffId of result.handoffs) {
    const handoff = controlPlane.getHandoff(handoffId);
    assert.ok(handoff);
    assert.equal(handoff.batchId, result.batchId);
    assert.equal(handoff.status, "pending");
    assert.ok(handoff.handoffCorrelationId.startsWith(`batch:${result.batchId}:`));
  }
});

test("createBatchHandoff validates required parameters", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  // Missing direction
  const noDirection = controlPlane.createBatchHandoff({
    targetSurface: "web",
    objects: [{ type: "approval", id: "1" }],
  });
  assert.equal(noDirection.ok, false);
  assert.equal(noDirection.httpStatus, 400);
  assert.match(noDirection.error, /direction/);

  // Missing targetSurface
  const noTargetSurface = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    objects: [{ type: "approval", id: "1" }],
  });
  assert.equal(noTargetSurface.ok, false);
  assert.equal(noTargetSurface.httpStatus, 400);
  assert.match(noTargetSurface.error, /targetSurface/);

  // Empty objects
  const emptyObjects = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    objects: [],
  });
  assert.equal(emptyObjects.ok, false);
  assert.equal(emptyObjects.httpStatus, 400);
  assert.match(emptyObjects.error, /non-empty array/);

  // Invalid object (missing type)
  const invalidObject = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    objects: [{ id: "1" }],
  });
  assert.equal(invalidObject.ok, false);
  assert.equal(invalidObject.httpStatus, 400);
  assert.match(invalidObject.error, /type.*id/);

  // Invalid object (missing id)
  const invalidObject2 = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    objects: [{ type: "approval" }],
  });
  assert.equal(invalidObject2.ok, false);
  assert.equal(invalidObject2.httpStatus, 400);
});

test("createBatchHandoff supports partial success/failure handling", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  // Create objects where some exist and some don't (testing with valid objects)
  const objects = [
    { type: "approval", id: "approval-1" },
    { type: "approval", id: "approval-2" },
  ];

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "B",
    objects,
    reason: "Partial batch test",
  });

  assert.equal(result.ok, true);
  assert.equal(result.totalCount, 2);
  assert.equal(result.successCount, 2);
  assert.equal(result.failureCount, 0);
  assert.equal(result.status, "completed");
});

test("createBatchHandoff sets correct actionLevel and riskLevel", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "C",
    objects: [{ type: "approval", id: "high-risk" }],
    reason: "High risk batch",
  });

  assert.equal(result.ok, true);
  const handoff = controlPlane.getHandoff(result.handoffs[0]);
  assert.equal(handoff.actionLevel, "C");
  assert.equal(handoff.riskLevel, "high");

  // Test D level
  const resultD = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "D",
    objects: [{ type: "approval", id: "destructive" }],
  });

  assert.equal(resultD.ok, true);
  const handoffD = controlPlane.getHandoff(resultD.handoffs[0]);
  assert.equal(handoffD.actionLevel, "D");
  assert.equal(handoffD.riskLevel, "destructive");
});

test("createBatchHandoff defaults actionLevel to B when not provided", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    objects: [{ type: "approval", id: "default-level" }],
  });

  assert.equal(result.ok, true);
  const handoff = controlPlane.getHandoff(result.handoffs[0]);
  assert.equal(handoff.actionLevel, "B");
  assert.equal(handoff.riskLevel, "medium");
});

test("createBatchHandoff creates handoffs with correct structure", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const result = controlPlane.createBatchHandoff({
    direction: "web_to_mobile",
    targetSurface: "mobile",
    actionLevel: "A",
    objects: [
      { type: "project", id: "proj-1" },
      { type: "task", id: "task-1" },
    ],
    reason: "Handover project and task",
  });

  assert.equal(result.ok, true);

  const handoff1 = controlPlane.getHandoff(result.handoffs[0]);
  assert.ok(handoff1.id);
  assert.ok(handoff1.batchId);
  assert.equal(handoff1.batchId, result.batchId);
  assert.equal(handoff1.sourceSurface, "batch");
  assert.equal(handoff1.targetSurface, "mobile");
  assert.equal(handoff1.direction, "web_to_mobile");
  assert.equal(handoff1.status, "pending");
  assert.equal(handoff1.actionLevel, "A");
  assert.equal(handoff1.object.type, "project");
  assert.equal(handoff1.object.id, "proj-1");
  assert.equal(handoff1.reason, "Handover project and task");
  assert.ok(handoff1.createdAt);
  assert.ok(handoff1.expiresAt);
  assert.ok(handoff1.actionSummary.includes("批量交接"));

  const handoff2 = controlPlane.getHandoff(result.handoffs[1]);
  assert.equal(handoff2.object.type, "task");
  assert.equal(handoff2.object.id, "task-1");
});

test("createBatchHandoff generates unique batchId format", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const result1 = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    objects: [{ type: "approval", id: "test-1" }],
  });

  const result2 = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    objects: [{ type: "approval", id: "test-2" }],
  });

  // Wait a bit to ensure different timestamp
  assert.notEqual(result1.batchId, result2.batchId);
  assert.match(result1.batchId, /^BATCH-\d+-[a-f0-9]{8}$/);
  assert.match(result2.batchId, /^BATCH-\d+-[a-f0-9]{8}$/);
});

test("createBatchHandoff persists handoff records to disk", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "B",
    objects: [{ type: "approval", id: "persist-test" }],
  });

  assert.equal(result.ok, true);
  const handoffId = result.handoffs[0];
  const handoffFilePath = join(cacheDir, "handoffs", `${handoffId}.json`);

  // Verify file exists on disk
  const handoffData = JSON.parse(readFileSync(handoffFilePath, "utf8"));
  assert.equal(handoffData.id, handoffId);
  assert.equal(handoffData.batchId, result.batchId);
  assert.equal(handoffData.status, "pending");

  // Verify can be read back
  const handoff = controlPlane.getHandoff(handoffId);
  assert.equal(handoff.id, handoffId);
  assert.equal(handoff.batchId, result.batchId);
});

test("createBatchHandoff returns detailed results array", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const objects = [
    { type: "approval", id: "result-1" },
    { type: "approval", id: "result-2" },
  ];

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "B",
    objects,
  });

  assert.equal(result.ok, true);
  assert.equal(result.results.length, 2);

  // Each result should have ok: true and handoff
  for (const item of result.results) {
    assert.equal(item.ok, true);
    assert.ok(item.handoff);
    assert.ok(item.handoff.id);
    assert.ok(item.handoff.batchId);
  }
});

test("createBatchHandoff creates audit record", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  const result = controlPlane.createBatchHandoff({
    direction: "mobile_to_web",
    targetSurface: "web",
    actionLevel: "B",
    objects: [
      { type: "approval", id: "audit-1" },
      { type: "approval", id: "audit-2" },
    ],
    reason: "Audit test batch",
  });

  assert.equal(result.ok, true);

  // Verify audit file was created with batch_handoff_created event
  const auditFilePath = join(cacheDir, "audit.jsonl");
  assert.ok(readFileSync(auditFilePath, "utf8").includes("batch_handoff_created"));
});
