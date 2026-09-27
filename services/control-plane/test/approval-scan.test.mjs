import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "./test-control-plane.mjs";

function fixture(options = {}) {
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
  return { cacheDir, controlPlane: createControlPlane({ workspaceRoot, cacheDir, graphPath, pairingTokenSecret: "approval-scan-test-secret", ownerApprovalSecret: "approval-scan-owner-secret", ...options }) };
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

function createCLevelHandoff(controlPlane, cacheDir, key, input = {}) {
  const approvalId = pendingApproval(controlPlane, key);
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  return controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: `${key}_submit`,
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
    ...input,
  });
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

test("handoff history filters by status and source actor without changing ownership", () => {
  const { controlPlane, cacheDir } = fixture();
  const handedOff = createCLevelHandoff(controlPlane, cacheDir, "approval_scan_handoff_history_001");
  const pending = controlPlane.listHandoffs({ status: "pending", actor: "dev_test-owner" });
  assert.equal(pending.ok, true);
  assert.equal(pending.handoffs.length, 1);
  assert.equal(pending.handoffs[0].id, handedOff.handoff.id);
  assert.equal(controlPlane.listHandoffs({ status: "completed" }).handoffs.length, 0);
  assert.equal(controlPlane.listHandoffs({ status: "invalid" }).httpStatus, 400);
});

test("bound handoffs require the matching Web owner for history and lifecycle actions", () => {
  const { controlPlane, cacheDir } = fixture();
  const handedOff = createCLevelHandoff(controlPlane, cacheDir, "approval_scan_handoff_owner_binding_001", { sourceOwnerRef: "owner-a" });

  const hidden = controlPlane.listHandoffs({ owner: "owner-b" });
  assert.equal(hidden.ok, true);
  assert.equal(hidden.handoffs.length, 0);
  assert.equal(controlPlane.listHandoffs({ owner: "owner-a" }).handoffs[0].id, handedOff.handoff.id);

  const deniedOpen = controlPlane.openHandoff(handedOff.handoff.id, "owner-b");
  assert.deepEqual(deniedOpen, { ok: false, httpStatus: 403, error: "handoff owner authorization required" });
  const deniedComplete = controlPlane.completeHandoff(handedOff.handoff.id, "owner-b", "should not execute");
  assert.equal(deniedComplete.httpStatus, 403);
  const deniedReject = controlPlane.rejectHandoff(handedOff.handoff.id, "owner-b", "should not execute");
  assert.equal(deniedReject.httpStatus, 403);
  assert.equal(controlPlane.getHandoff(handedOff.handoff.id).status, "pending");

  const opened = controlPlane.openHandoff(handedOff.handoff.id, "owner-a");
  assert.equal(opened.status, "opened");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const denied = audit.find((event) => event.auditKind === "handoff_access_denied");
  assert.equal(denied.actorRef, "owner-b");
  assert.equal(denied.sourceOwnerRef, "owner-a");
  assert.equal(denied.handoffId, handedOff.handoff.id);
});

test("handoff lifecycle revalidates the linked approval before changing state", () => {
  const { controlPlane, cacheDir } = fixture();
  const handedOff = createCLevelHandoff(controlPlane, cacheDir, "approval_scan_handoff_approval_revalidation_001", { sourceOwnerRef: "owner-a" });
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === handedOff.handoff.approvalId);
  approval.status = "rejected";
  writeFileSync(join(cacheDir, "approvals", `${approval.id}.json`), JSON.stringify(approval));

  const deniedOpen = controlPlane.openHandoff(handedOff.handoff.id, "owner-a");
  assert.deepEqual(deniedOpen, { ok: false, httpStatus: 409, error: "handoff approval is no longer pending" });
  const deniedComplete = controlPlane.completeHandoff(handedOff.handoff.id, "owner-a", "must not complete");
  assert.equal(deniedComplete.httpStatus, 409);
  const deniedReject = controlPlane.rejectHandoff(handedOff.handoff.id, "owner-a", "must not reject");
  assert.equal(deniedReject.httpStatus, 409);
  assert.equal(controlPlane.getHandoff(handedOff.handoff.id).status, "pending");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.ok(audit.some((event) => event.auditKind === "handoff_access_denied" && event.reason === "approval status is rejected" && event.handoffId === handedOff.handoff.id));
});

test("handoff lifecycle expires an overdue linked approval before denying continuation", () => {
  const { controlPlane, cacheDir } = fixture();
  const handedOff = createCLevelHandoff(controlPlane, cacheDir, "approval_scan_handoff_approval_expiry_revalidation_001", { sourceOwnerRef: "owner-a" });
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === handedOff.handoff.approvalId);
  approval.expiresAt = new Date(Date.now() - 1000).toISOString();
  writeFileSync(join(cacheDir, "approvals", `${approval.id}.json`), JSON.stringify(approval));

  const denied = controlPlane.openHandoff(handedOff.handoff.id, "owner-a");
  assert.deepEqual(denied, { ok: false, httpStatus: 409, error: "handoff approval is no longer pending" });
  assert.equal(controlPlane.getHandoff(handedOff.handoff.id).status, "expired");
  const persistedHandoff = JSON.parse(readFileSync(join(cacheDir, "handoffs", `${handedOff.handoff.id}.json`), "utf8"));
  assert.equal(persistedHandoff.status, "expired");
  assert.ok(persistedHandoff.expiredAt);
  assert.equal(controlPlane.snapshot().approvals.find((item) => item.id === approval.id).status, "expired");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.ok(audit.some((event) => event.auditKind === "approval_expired" && event.approvalId === approval.id));
  assert.ok(audit.some((event) => event.auditKind === "handoff_expired" && event.handoffId === handedOff.handoff.id && event.approvalRef === approval.id));
  assert.ok(audit.some((event) => event.auditKind === "handoff_access_denied" && event.reason === "approval expired" && event.handoffId === handedOff.handoff.id));
});

test("handoff expiry duration is configurable while invalid values keep the 24h default", () => {
  const configured = fixture({ handoffExpiryMs: 2 * 60 * 60 * 1000 });
  const configuredHandoff = createCLevelHandoff(configured.controlPlane, configured.cacheDir, "approval_scan_handoff_configured_expiry_001").handoff;
  const configuredDuration = Date.parse(configuredHandoff.expiresAt) - Date.parse(configuredHandoff.createdAt);
  assert.equal(configured.controlPlane.handoffExpiry.durationMs, 2 * 60 * 60 * 1000);
  assert.ok(configuredDuration > (2 * 60 * 60 * 1000) - 1000 && configuredDuration <= 2 * 60 * 60 * 1000);

  const fallback = fixture({ handoffExpiryMs: 0 });
  const fallbackHandoff = createCLevelHandoff(fallback.controlPlane, fallback.cacheDir, "approval_scan_handoff_default_expiry_001").handoff;
  const fallbackDuration = Date.parse(fallbackHandoff.expiresAt) - Date.parse(fallbackHandoff.createdAt);
  assert.equal(fallback.controlPlane.handoffExpiry.durationMs, 24 * 60 * 60 * 1000);
  assert.ok(fallbackDuration > (24 * 60 * 60 * 1000) - 1000 && fallbackDuration <= 24 * 60 * 60 * 1000);

  const previous = process.env.AXI_HANDOFF_EXPIRY_MS;
  process.env.AXI_HANDOFF_EXPIRY_MS = "3600000";
  try {
    const fromEnvironment = fixture();
    assert.equal(fromEnvironment.controlPlane.handoffExpiry.durationMs, 60 * 60 * 1000);
  } finally {
    if (previous === undefined) delete process.env.AXI_HANDOFF_EXPIRY_MS;
    else process.env.AXI_HANDOFF_EXPIRY_MS = previous;
  }
});

test("Web handoff rejection is terminal, reasoned, and audit-linked", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_handoff_reject_001");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  const handedOff = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: "approval_scan_handoff_reject_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });

  const rejected = controlPlane.rejectHandoff(handedOff.handoff.id, "owner@example.test", "当前责任范围不匹配");
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectedBy, "owner@example.test");
  assert.equal(rejected.rejectionReason, "当前责任范围不匹配");
  const replay = controlPlane.rejectHandoff(handedOff.handoff.id, "other@example.test", "should not overwrite terminal state");
  assert.equal(replay.rejectedBy, "owner@example.test");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const rejection = audit.find((event) => event.auditKind === "handoff_rejected");
  assert.equal(rejection.actorRef, "owner@example.test");
  assert.equal(rejection.reason, "当前责任范围不匹配");
  assert.equal(rejection.handoffCorrelationId, preview.handoffCorrelationId);
});

test("handoff expiry is persisted, audited, and cannot be completed afterward", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_handoff_expiry_001");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  const handedOff = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: "approval_scan_handoff_expiry_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });
  handedOff.handoff.expiresAt = new Date(Date.now() - 1_000).toISOString();

  const sweep = controlPlane.expireHandoffs();
  assert.deepEqual(sweep, { ok: true, expired: 1 });
  const expired = controlPlane.getHandoff(handedOff.handoff.id);
  assert.equal(expired.status, "expired");
  assert.ok(expired.expiredAt);
  assert.equal(controlPlane.completeHandoff(expired.id, "owner@example.test", "must not complete" ).status, "expired");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const expiry = audit.find((event) => event.auditKind === "handoff_expired");
  assert.equal(expiry.actorRef, "system:handoff-expiry");
  assert.equal(expiry.sourceActorRef, handedOff.handoff.sourceActorRef);
  assert.equal(expiry.handoffCorrelationId, preview.handoffCorrelationId);
  assert.equal(expiry.status, "expired");
});

test("handoff expiry scheduler sweeps expired records without keeping the process alive", async () => {
  const { controlPlane } = fixture({ enableHandoffExpiryScheduler: true, handoffExpirySchedulerIntervalMs: 10 });
  try {
    const approvalId = pendingApproval(controlPlane, "approval_scan_handoff_scheduler_001");
    const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
    approval.actionLevel = "C";
    const created = controlPlane.createApprovalScan({ approvalId });
    const preview = controlPlane.resolveApprovalScan(created.scanId);
    const handedOff = controlPlane.decideApprovalScan({
      scanId: created.scanId,
      decision: "handoff",
      idempotencyKey: "approval_scan_handoff_scheduler_submit_001",
      handoffCorrelationId: preview.handoffCorrelationId,
      deviceId: "dev_test-owner",
    });
    handedOff.handoff.expiresAt = new Date(Date.now() - 1_000).toISOString();

    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(controlPlane.getHandoff(handedOff.handoff.id).status, "expired");
  } finally {
    controlPlane.stopHandoffExpiryScheduler();
  }
});

test("handoff expiry enqueues an external notification after durable audit", () => {
  const notifications = [];
  const { controlPlane, cacheDir } = fixture({ onHandoffExpired: (event) => notifications.push(event) });
  const handedOff = createCLevelHandoff(controlPlane, cacheDir, "approval_scan_handoff_notify_001");
  handedOff.handoff.expiresAt = new Date(Date.now() - 1_000).toISOString();

  assert.deepEqual(controlPlane.runHandoffExpirySweep(), { ok: true, expired: 1 });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "handoff.expired");
  assert.equal(notifications[0].handoff.id, handedOff.handoff.id);
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8");
  assert.match(audit, /handoff_expiry_notification_queued/);
});

test("handoff expiry remains terminal when the notification enqueue callback fails", () => {
  const { controlPlane, cacheDir } = fixture({ onHandoffExpired: () => { throw new Error("relay unavailable"); } });
  const handedOff = createCLevelHandoff(controlPlane, cacheDir, "approval_scan_handoff_notify_fail_001");
  handedOff.handoff.expiresAt = new Date(Date.now() - 1_000).toISOString();

  assert.doesNotThrow(() => controlPlane.runHandoffExpirySweep());
  assert.equal(controlPlane.getHandoff(handedOff.handoff.id).status, "expired");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8");
  assert.match(audit, /handoff_expiry_notification_failed/);
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

test("handoff audit events include sourceSurface and targetSurface fields", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_surface_fields_001");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  const result = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: "approval_scan_surface_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });
  assert.equal(result.status, "handed_off");
  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));

  // handoff_created event should include sourceSurface and targetSurface
  const createdEvent = audit.find((event) => event.auditKind === "handoff_created");
  assert.ok(createdEvent, "handoff_created event should exist");
  assert.equal(createdEvent.sourceSurface, "mobile");
  assert.equal(createdEvent.targetSurface, "web");

  // open handoff
  controlPlane.openHandoff(result.handoff.id, "owner@example.test");
  const openedAudit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const openedEvent = openedAudit.find((event) => event.auditKind === "handoff_opened");
  assert.ok(openedEvent, "handoff_opened event should exist");
  assert.equal(openedEvent.sourceSurface, "mobile");
  assert.equal(openedEvent.targetSurface, "web");

  // complete handoff
  controlPlane.completeHandoff(result.handoff.id, "owner@example.test", "executed");
  const completedAudit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const completedEvent = completedAudit.find((event) => event.auditKind === "handoff_completed");
  assert.ok(completedEvent, "handoff_completed event should exist");
  assert.equal(completedEvent.sourceSurface, "mobile");
  assert.equal(completedEvent.targetSurface, "web");
});

test("handoff rejected audit event includes sourceSurface and targetSurface", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_reject_surface_001");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  const result = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: "approval_scan_reject_surface_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });
  controlPlane.openHandoff(result.handoff.id, "owner@example.test");
  controlPlane.rejectHandoff(result.handoff.id, "owner@example.test", "not the right time");

  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const rejectedEvent = audit.find((event) => event.auditKind === "handoff_rejected");
  assert.ok(rejectedEvent, "handoff_rejected event should exist");
  assert.equal(rejectedEvent.sourceSurface, "mobile");
  assert.equal(rejectedEvent.targetSurface, "web");
  assert.equal(rejectedEvent.reason, "not the right time");
});

test("handoff expired audit event includes sourceSurface and targetSurface", () => {
  const { controlPlane, cacheDir } = fixture();
  const approvalId = pendingApproval(controlPlane, "approval_scan_expired_surface_001");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === approvalId);
  approval.actionLevel = "C";
  writeFileSync(join(cacheDir, "approvals", `${approvalId}.json`), JSON.stringify(approval));
  const created = controlPlane.createApprovalScan({ approvalId });
  const preview = controlPlane.resolveApprovalScan(created.scanId);
  const result = controlPlane.decideApprovalScan({
    scanId: created.scanId,
    decision: "handoff",
    idempotencyKey: "approval_scan_expired_surface_submit_001",
    handoffCorrelationId: preview.handoffCorrelationId,
    deviceId: "dev_test-owner",
  });

  // Modify the in-memory handoff object to expire it immediately
  result.handoff.expiresAt = new Date(Date.now() - 1000).toISOString();

  const sweep = controlPlane.expireHandoffs();
  assert.deepEqual(sweep, { ok: true, expired: 1 });

  const audit = readFileSync(join(cacheDir, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const expiredEvent = audit.find((event) => event.auditKind === "handoff_expired");
  assert.ok(expiredEvent, "handoff_expired event should exist");
  assert.equal(expiredEvent.sourceSurface, "mobile");
  assert.equal(expiredEvent.targetSurface, "web");
});
