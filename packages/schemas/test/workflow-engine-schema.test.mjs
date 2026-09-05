import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/entities/workflow-engine.ts"), "utf8");

test("workflow-engine contract keeps bounded effect approvals and execution evidence visible", () => {
  for (const token of [
    "WorkflowEngineApprovalSchema",
    "WorkflowEngineExecutionSchema",
    "WorkflowEngineWorkflowSchema",
    '"bounded_agent"',
    '"approved_effect"',
    "effectAction",
    "actionDigest",
    "grantPermissions",
    "pendingApproval",
    "routingDecisions",
    "lifecycleEvents",
  ]) {
    assert.match(source, new RegExp(token));
  }
});
