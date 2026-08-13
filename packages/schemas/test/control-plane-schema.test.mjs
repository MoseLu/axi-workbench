import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/entities/control-plane.ts"), "utf8");

test("control-plane schema exposes Chat-Codex-inspired communication entities", () => {
  for (const token of [
    '"wechat"',
    "RouteBindingSchema",
    "PairingChallengeSchema",
    "ApprovalRequestSchema",
    "ApprovalScanPreviewSchema",
    "MobileApprovalDecisionSchema",
    "HandoffContextSchema",
    "AttachmentRefSchema",
    "AgentTaskSchema",
    "AgentRuntimeSchema",
    "AxiResourceSnapshotSchema",
    '"credential_ref"',
    '"agent_artifact"',
    "ControlJobSchema",
    "TaskAssessmentSchema",
    "WorkflowPlanSchema",
    "AgentAssignmentSchema",
    "AgentRunSchema",
    "TaskEventSchema",
    "AuditReportSchema",
    "LibrarianArchiveSchema",
    '"checkpoint"',
    '"langgraph"',
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("mobile approval contracts derive business object fields from an opaque scan", () => {
  assert.match(source, /MobileApprovalDecisionSchema[\s\S]*\.strict\(\)/);
  assert.match(source, /decision: z\.enum\(\["approved", "rejected", "handoff"\]\)/);
  assert.doesNotMatch(source.match(/export const MobileApprovalDecisionSchema[\s\S]*?\n\}\)\.strict\(\)/)?.[0] ?? "", /projectId|actionId|approvalId/);
  assert.match(source, /handoffCorrelationId/);
});

test("QR device pairing keeps the one-time scan bearer separate from Web owner confirmation", () => {
  for (const token of [
    "WebPairingQrTransactionSchema",
    "WebPairingQrPayloadSchema",
    "WebPairingQrStatusSchema",
    "QrPairScanRequestSchema",
    "QrPairScanResponseSchema",
    'z.literal("axi-mobile-pair-v1")',
    'z.enum(["waiting_scan", "scanned", "approved", "expired"])',
    "scanToken",
    "webPairingId",
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const response = source.match(/export const QrPairScanResponseSchema[\s\S]*?\n\}\)\.strict\(\)/)?.[0] ?? "";
  assert.ok(response, "QR scan response must be a closed schema");
  assert.doesNotMatch(response, /scanToken/, "the phone scan response must not echo the QR bearer");
});

test("QR computer login requires an already paired mobile device and keeps the browser poll credential out of the camera payload", () => {
  for (const token of [
    "WebLoginQrTransactionSchema",
    "WebLoginQrPayloadSchema",
    "WebLoginQrScanRequestSchema",
    "WebLoginQrScanResponseSchema",
    'z.literal("axi-web-login-v1")',
    'z.literal("approved")',
    "webLoginId",
    "pollToken",
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const payload = source.match(/export const WebLoginQrPayloadSchema[\s\S]*?\n\}\)\.strict\(\)/)?.[0] ?? "";
  const request = source.match(/export const WebLoginQrScanRequestSchema[\s\S]*?\n\}\)\.strict\(\)/)?.[0] ?? "";
  assert.ok(payload && request, "Web login QR schemas must be closed");
  assert.doesNotMatch(payload, /pollToken|ownerSubject|accessToken/);
  assert.doesNotMatch(request, /deviceId|ownerSubject|accessToken/);
});

test("agent runtime schema exposes managed command and Axi Agent execution alongside Codex runtimes", () => {
  assert.match(source, /z\.enum\(\["codex_cli", "codex_app", "registered_command", "axi_agent"\]\)/);
});
