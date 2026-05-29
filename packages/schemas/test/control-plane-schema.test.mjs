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

test("agent runtime schema exposes managed command and Axi Agent execution alongside Codex runtimes", () => {
  assert.match(source, /z\.enum\(\["codex_cli", "codex_app", "registered_command", "axi_agent"\]\)/);
});
