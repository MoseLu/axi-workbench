import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createControlPlane } from "./test-control-plane.mjs";
import { HandoffStatus, HandoffTransitions, isValidHandoffTransition, getAllowedHandoffTransitions } from "../src/control-plane.mjs";

function fixture(options = {}) {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-web-to-mobile-handoff-"));
  const cacheDir = join(workspaceRoot, ".cache");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(join(workspaceRoot, "projects", "sample"), { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {
    sample: { name: "测试示例", path: join(workspaceRoot, "projects", "sample"), health: ["node -e \"console.log('ok')\""] },
  } }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({ projects: [] }));
  return {
    cacheDir,
    controlPlane: createControlPlane({ workspaceRoot, cacheDir, graphPath, pairingTokenSecret: "web-to-mobile-test-secret", ...options }),
  };
}

test("HandoffStatus exports all required status constants", () => {
  assert.equal(HandoffStatus.CREATED, "created");
  assert.equal(HandoffStatus.DELIVERED, "delivered");
  assert.equal(HandoffStatus.ACCEPTED, "accepted");
  assert.equal(HandoffStatus.COMPLETED, "completed");
  assert.equal(HandoffStatus.FAILED, "failed");
  assert.equal(HandoffStatus.REJECTED, "rejected");
  assert.equal(HandoffStatus.EXPIRED, "expired");
  assert.equal(HandoffStatus.PENDING, "pending");
  assert.equal(HandoffStatus.OPENED, "opened");
});

test("HandoffTransitions defines rules for both directions", () => {
  assert.ok(HandoffTransitions["web->mobile"]);
  assert.ok(HandoffTransitions["mobile->web"]);
  assert.ok(HandoffTransitions["web->mobile"].created instanceof Set);
  assert.ok(HandoffTransitions["mobile->web"].pending instanceof Set);
});

test("isValidHandoffTransition validates web->mobile transitions correctly", () => {
  // Valid transitions
  assert.equal(isValidHandoffTransition("web->mobile", "created", "delivered"), true);
  assert.equal(isValidHandoffTransition("web->mobile", "delivered", "accepted"), true);
  assert.equal(isValidHandoffTransition("web->mobile", "delivered", "rejected"), true);
  assert.equal(isValidHandoffTransition("web->mobile", "accepted", "completed"), true);
  assert.equal(isValidHandoffTransition("web->mobile", "accepted", "failed"), true);

  // Invalid transitions
  assert.equal(isValidHandoffTransition("web->mobile", "created", "completed"), false);
  assert.equal(isValidHandoffTransition("web->mobile", "pending", "completed"), false);
  assert.equal(isValidHandoffTransition("web->mobile", "completed", "delivered"), false);
});

test("isValidHandoffTransition validates mobile->web transitions correctly", () => {
  // Valid transitions
  assert.equal(isValidHandoffTransition("mobile->web", "pending", "opened"), true);
  assert.equal(isValidHandoffTransition("mobile->web", "opened", "completed"), true);
  assert.equal(isValidHandoffTransition("mobile->web", "opened", "rejected"), true);

  // Invalid transitions
  assert.equal(isValidHandoffTransition("mobile->web", "pending", "completed"), false);
  assert.equal(isValidHandoffTransition("mobile->web", "completed", "pending"), false);
});

test("getAllowedHandoffTransitions returns valid next states", () => {
  const webToMobile = getAllowedHandoffTransitions("web->mobile", "created");
  assert.ok(webToMobile.includes("delivered"));
  assert.ok(webToMobile.includes("expired"));
  assert.ok(!webToMobile.includes("completed"));

  const delivered = getAllowedHandoffTransitions("web->mobile", "delivered");
  assert.ok(delivered.includes("accepted"));
  assert.ok(delivered.includes("rejected"));
});

test("createWebToMobileHandoff creates a handoff with direction web->mobile", () => {
  const { controlPlane, cacheDir } = fixture();
  const result = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    sourceOwnerRef: "owner@example.com",
    targetOwnerRef: "mobile-owner",
    projectId: "sample",
    actionId: "verify",
    actionType: "project_verification",
    impact: "验证测试项目",
    riskLevel: "low",
  });

  assert.equal(result.ok, true);
  assert.ok(result.handoff);
  assert.equal(result.handoff.direction, "web->mobile");
  assert.equal(result.handoff.sourceSurface, "web");
  assert.equal(result.handoff.targetSurface, "mobile");
  assert.equal(result.handoff.status, "created");
  assert.ok(result.handoff.availableTransitions.includes("delivered"));
  assert.ok(result.handoff.expiresAt);
  assert.equal(result.handoff.object.projectId, "sample");
});

test("deliverWebToMobileHandoff transitions from created to delivered", () => {
  const { controlPlane } = fixture();
  const created = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
  });

  const delivered = controlPlane.deliverWebToMobileHandoff(created.handoff.id, "web:user@example.com");
  assert.equal(delivered.status, "delivered");
  assert.ok(delivered.deliveredAt);
  assert.equal(delivered.deliveredBy, "web:user@example.com");
});

test("acceptWebToMobileHandoff transitions from delivered to accepted", () => {
  const { controlPlane } = fixture();
  const created = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
    targetOwnerRef: "mobile-owner",
  });

  controlPlane.deliverWebToMobileHandoff(created.handoff.id, "web:user@example.com");
  const accepted = controlPlane.acceptWebToMobileHandoff(created.handoff.id, "mobile-owner");
  assert.equal(accepted.status, "accepted");
  assert.ok(accepted.acceptedAt);
});

test("rejectWebToMobileHandoff transitions from delivered to rejected", () => {
  const { controlPlane } = fixture();
  const created = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
    targetOwnerRef: "mobile-owner",
  });

  controlPlane.deliverWebToMobileHandoff(created.handoff.id, "web:user@example.com");
  const rejected = controlPlane.rejectWebToMobileHandoff(created.handoff.id, "mobile-owner", "不在当前责任范围");
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "不在当前责任范围");
});

test("completeWebToMobileHandoff transitions from accepted to completed", () => {
  const { controlPlane } = fixture();
  const created = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
    targetOwnerRef: "mobile-owner",
  });

  controlPlane.deliverWebToMobileHandoff(created.handoff.id, "web:user@example.com");
  controlPlane.acceptWebToMobileHandoff(created.handoff.id, "mobile-owner");
  const completed = controlPlane.completeWebToMobileHandoff(created.handoff.id, "mobile-owner", "任务已执行");
  assert.equal(completed.status, "completed");
  assert.equal(completed.finalAction.outcome, "任务已执行");
});

test("failWebToMobileHandoff transitions from accepted to failed", () => {
  const { controlPlane } = fixture();
  const created = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
    targetOwnerRef: "mobile-owner",
  });

  controlPlane.deliverWebToMobileHandoff(created.handoff.id, "web:user@example.com");
  controlPlane.acceptWebToMobileHandoff(created.handoff.id, "mobile-owner");
  const failed = controlPlane.failWebToMobileHandoff(created.handoff.id, "mobile-owner", "执行失败");
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "执行失败");
});

test("web→mobile handoff lifecycle audit events include direction", () => {
  const { controlPlane, cacheDir } = fixture();
  const created = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
    targetOwnerRef: "mobile-owner",
  });

  controlPlane.deliverWebToMobileHandoff(created.handoff.id, "web:user@example.com");
  controlPlane.acceptWebToMobileHandoff(created.handoff.id, "mobile-owner");
  controlPlane.completeWebToMobileHandoff(created.handoff.id, "mobile-owner", "完成");

  const auditContent = readFileSync(join(cacheDir, "audit.jsonl"), "utf8");
  const auditLines = auditContent.split("\n").filter(Boolean).map((line) => JSON.parse(line));

  const createdEvent = auditLines.find((e) => e.auditKind === "handoff_created");
  const deliveredEvent = auditLines.find((e) => e.auditKind === "handoff_delivered");
  const acceptedEvent = auditLines.find((e) => e.auditKind === "handoff_accepted");
  const completedEvent = auditLines.find((e) => e.auditKind === "handoff_completed");

  assert.equal(createdEvent.direction, "web->mobile");
  assert.equal(deliveredEvent.direction, "web->mobile");
  assert.equal(acceptedEvent.direction, "web->mobile");
  assert.equal(completedEvent.direction, "web->mobile");
});

test("listHandoffs filters by direction", () => {
  const { controlPlane } = fixture();

  // Create web->mobile handoff
  const w2m = controlPlane.createWebToMobileHandoff({
    sourceActorRef: "web:user@example.com",
    projectId: "sample",
  });

  // List all handoffs
  const all = controlPlane.listHandoffs();
  assert.ok(all.ok);
  assert.ok(all.handoffs.length >= 1);

  // Filter by direction web->mobile
  const filtered = controlPlane.listHandoffs({ direction: "web->mobile" });
  assert.ok(filtered.ok);
  assert.equal(filtered.handoffs.length, 1);
  assert.equal(filtered.handoffs[0].direction, "web->mobile");
});
