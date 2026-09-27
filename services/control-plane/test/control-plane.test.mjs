import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createControlPlane } from "./test-control-plane.mjs";
import { buildSnapshot } from "../src/control-plane.mjs";

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "axi-workstation-control-plane-"));
  mkdirSync(join(root, "ielts-vocab"), { recursive: true });
  mkdirSync(join(root, "cockpit-tools"), { recursive: true });
  mkdirSync(join(root, "projects", "axi-notify", "android-app"), { recursive: true });
  mkdirSync(join(root, "infra", "fleet-console"), { recursive: true });
  for (const path of [
    join(root, "projects", "enterprise-workspace", "projects", "axi-workstation"),
    join(root, "projects", "enterprise-workspace", "projects", "axi-agent-platform"),
    join(root, "projects", "cockpit-tools"),
    join(root, "projects", "axi-coder"),
    join(root, "projects", "devsvc-dashboard"),
    join(root, "projects", "enterprise-workspace", "projects", "app-search-system"),
  ]) {
    mkdirSync(path, { recursive: true });
  }
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({
    projects: {
      "axi-workstation": {
        path: join(root, "projects", "enterprise-workspace", "projects", "axi-workstation"),
        kind: "control-plane",
        provides: ["workstation-control-plane"],
        contracts: [],
      },
      "axi-agent": {
        path: join(root, "projects", "enterprise-workspace", "projects", "axi-agent-platform"),
        kind: "agent-owner",
        provides: ["agent-task-runtime"],
        contracts: [],
      },
      "axi-accounts": {
        path: join(root, "projects", "cockpit-tools"),
        kind: "asset-owner",
        provides: ["account-assets"],
        contracts: [],
      },
      "axi-model-gateway": {
        path: join(root, "projects", "axi-coder"),
        kind: "model-gateway",
        provides: ["model-routing"],
        contracts: [],
      },
      "axi-ops": {
        path: join(root, "projects", "devsvc-dashboard"),
        kind: "ops-console",
        provides: ["operations-console"],
        health: ["node -e \"console.log('ops readonly')\""],
        contracts: [],
      },
      "axi-docs": {
        path: join(root, "projects", "enterprise-workspace", "projects", "app-search-system"),
        kind: "knowledge-service",
        provides: ["project-documents"],
        health: ["node -e \"console.log('docs readonly')\""],
        contracts: [],
      },
      "ai-capability": {
        path: join(root, "ai-capability"),
        kind: "local-capability-layer",
        provides: ["llm"],
        health: ["node -e \"console.log('ai ok')\""],
        contracts: [],
      },
      "minimax-tokenplan": {
        path: join(root, "minimax-tokenplan"),
        kind: "cloud-capability-cli",
        provides: ["web-search"],
        contracts: [],
      },
      "ielts-vocab": {
        path: join(root, "ielts-vocab"),
        kind: "product",
        provides: ["ielts-learning-app"],
        consumes: ["ai-capability", "minimax-tokenplan"],
        health: ["node -e \"console.log('health ok')\""],
        verify: ["node -e \"console.log('verify ok')\""],
        remediation: ["node -e \"console.log('remediated')\""],
        contracts: [],
      },
      "cockpit-tools": {
        path: join(root, "cockpit-tools"),
        kind: "desktop-product",
        consumes: ["ielts-vocab"],
        health: ["node -e \"console.log('cockpit ok')\""],
        contracts: [],
      },
      "axi-notify": {
        path: join(root, "projects", "axi-notify"),
        kind: "axi-notify-mobile-monorepo",
        provides: ["mobile-workbench", "relay-server"],
        contracts: [],
      },
    },
    profiles: {},
    automations: [{
      id: "automation:ielts-health",
      targetRef: "ielts-vocab",
      ownerRef: "ielts-vocab",
      commandId: "ielts-vocab:run_health:0",
      source: "workspace.graph",
      enabled: true,
    }],
  }));
  return root;
}

async function waitFor(predicate, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
}

test("builds a six-layer snapshot and Axi resource view from workspace graph plus optional resources", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const snapshot = controlPlane.snapshot();
  assert.ok(snapshot.axiResources);
  assert.ok(snapshot.resources.some((resource) => resource.id === "ielts-vocab" && resource.layer === "software"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "ai-capability" && resource.layer === "base_service"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "minimax-tokenplan" && resource.layer === "external_capability"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-workstation" && resource.layer === "software"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-agent" && resource.layer === "software"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-accounts" && resource.layer === "base_service"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-model-gateway" && resource.layer === "base_service"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-ops" && resource.layer === "software"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-docs" && resource.layer === "base_service"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-ops" && resource.commands.some((command) => command.intent === "run_health")));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-docs" && resource.commands.some((command) => command.intent === "run_health")));
  const remediationCommand = snapshot.resources.find((resource) => resource.id === "ielts-vocab").commands.find((command) => command.intent === "run_remediation");
  assert.equal(remediationCommand.autoExecutable, false);
  assert.equal(remediationCommand.executorRef, "control-plane.registered-command");
  assert.deepEqual(snapshot.governance.automations.map((automation) => ({ id: automation.id, status: automation.status, commandId: automation.commandId })), [{ id: "automation:ielts-health", status: "enabled", commandId: "ielts-vocab:run_health:0" }]);
  assert.equal(snapshot.governance.automations[0].trigger, "manual");
  const healthCommand = snapshot.resources.find((resource) => resource.id === "ielts-vocab").commands[0];
  assert.deepEqual(
    { ownerRef: healthCommand.ownerRef, source: healthCommand.source, executorRef: healthCommand.executorRef },
    { ownerRef: "ielts-vocab", source: "workspace.graph", executorRef: "control-plane.registered-command" },
  );
  assert.ok(snapshot.resources.some((resource) => resource.id === "fleet-console" && resource.layer === "physical_service" && resource.status === "available"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "cc-connect" && resource.layer === "communication"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "feishu" && resource.kind === "intelligence-station"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-mobile" && resource.kind === "mobile-workbench" && resource.status === "available"));
  assert.ok(snapshot.resources.some((resource) => resource.id === "axi-notify" && resource.layer === "base_service" && resource.status === "available"));
  assert.ok(snapshot.axiResources.project.some((item) => item.resourceId === "axi-workstation"));
  assert.ok(snapshot.axiResources.service.some((item) => item.resourceId === "axi-accounts"));
  assert.ok(snapshot.axiResources.server.some((item) => item.resourceId === "fleet-console"));
  assert.ok(snapshot.axiResources.provider.some((item) => item.resourceId === "axi-model-gateway"));
  assert.ok(snapshot.axiResources.credential_ref.some((item) => item.resourceId === "axi-accounts"));
  assert.ok(snapshot.axiResources.doc_source.some((item) => item.resourceId === "axi-docs"));
  const run = await controlPlane.query({ text: "列出资源", senderId: "u", conversationId: "c", dryRun: true });
  assert.match(run.summary, /Axi 资源视图/);
});

test("builds a safe mobile projection and only exposes explicitly declared HTTPS previews", () => {
  const root = makeWorkspace();
  const graphPath = join(root, "workspace.graph.json");
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  graph.projects["ielts-vocab"].mobile = {
    summary: "移动学习产品",
    preview: { mode: "embedded_web", url: "https://preview.example.test", allowEmbedded: true },
  };
  graph.projects["cockpit-tools"].mobile = { preview: { mode: "embedded_web", url: "http://unsafe.example.test", allowEmbedded: true } };
  writeFileSync(graphPath, JSON.stringify(graph));
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const mobile = controlPlane.mobileSnapshot();
  const previewProject = mobile.projects.find((project) => project.id === "ielts-vocab");
  const blockedProject = mobile.projects.find((project) => project.id === "cockpit-tools");
  assert.equal(previewProject.preview.mode, "embedded_web");
  assert.equal(previewProject.preview.url, "https://preview.example.test");
  assert.equal(blockedProject.preview.mode, "none");
  assert.equal(blockedProject.preview.url, null);
});

test("resolves optional mobile resources from registry declarations and never guesses legacy paths", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-optional-resource-contract-"));
  const graphPath = join(root, "workspace.graph.json");
  const registryRoot = join(root, "infra", "axi-workspace-governance");
  const registryPath = join(registryRoot, "workspace.json");
  const registeredPath = join(root, "projects", "axi-notify");
  mkdirSync(join(root, "projects", "mosscoder", "android-app"), { recursive: true });
  mkdirSync(join(registeredPath, "android-app"), { recursive: true });
  mkdirSync(registryRoot, { recursive: true });
  writeFileSync(graphPath, JSON.stringify({ projects: {}, profiles: {} }));
  writeFileSync(registryPath, JSON.stringify({ projects: [{ id: "axi-notify", path: "../../projects/axi-notify", status: "active" }] }));

  const registeredSnapshot = buildSnapshot({ workspaceRoot: root, graphPath, registryPath });
  const registeredNotify = registeredSnapshot.resources.find((resource) => resource.id === "axi-notify");
  assert.equal(registeredNotify.path, registeredPath);
  assert.equal(registeredNotify.status, "available");

  writeFileSync(registryPath, JSON.stringify({ projects: [] }));
  const unresolvedSnapshot = buildSnapshot({ workspaceRoot: root, graphPath, registryPath });
  const unresolvedNotify = unresolvedSnapshot.resources.find((resource) => resource.id === "axi-notify");
  const unresolvedMobile = unresolvedSnapshot.resources.find((resource) => resource.id === "axi-mobile");
  assert.equal(unresolvedNotify.path, undefined);
  assert.equal(unresolvedNotify.status, "unknown");
  assert.equal(unresolvedMobile.path, undefined);
  assert.equal(unresolvedMobile.status, "unknown");
});

test("blocks destructive natural language requests", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const run = await controlPlane.query({ text: "帮我 git reset --hard ielts-vocab", senderId: "u", conversationId: "c" });
  assert.equal(run.intent, "blocked_action");
  assert.equal(run.accepted, false);
  assert.match(run.summary, /拒绝/);
});

test("enforced control-plane surface refuses direct execution without a policy decision", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache"), enforceExecutionPolicy: true });

  const query = await controlPlane.query({ text: "跑一下 ielts-vocab 健康检查", senderId: "user:direct", conversationId: "direct" });
  assert.equal(query.accepted, false);
  assert.equal(query.actions[0].status, "blocked");
  assert.match(query.blockedReason, /Workspace policy deny/);
  assert.equal(controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events.length, 1);

  const commandId = controlPlane.snapshot().resources.find((resource) => resource.id === "ielts-vocab").commands[0].id;
  const forged = controlPlane.runCommand(commandId, { policyDecisionRef: "policy-decision:forged" });
  assert.equal(forged.accepted, false);
  assert.match(forged.error, /not found/);
  const deniedDecision = controlPlane.evaluateConfiguredGovernancePolicy({ subjectRef: "user:direct", resourceRef: commandId, action: "execute" }).decision;
  const denied = controlPlane.runCommand(commandId, { policyDecisionRef: deniedDecision.id, subjectRef: "user:direct" });
  assert.equal(denied.accepted, false);
  assert.match(denied.error, /cannot authorize/);
  const mismatchedId = "policy-decision:mismatched-resource";
  writeFileSync(join(root, ".cache", "policy-decisions", "policy-decision_mismatched-resource.json"), JSON.stringify({ id: mismatchedId, decision: "allow", resourceRef: "another-resource", action: "execute", expiresAt: "2099-01-01T00:00:00.000Z" }));
  const mismatched = controlPlane.runCommand(commandId, { policyDecisionRef: mismatchedId, subjectRef: "user:direct" });
  assert.equal(mismatched.accepted, false);
  assert.match(mismatched.error, /resource does not match/);
  const subjectMismatchId = "policy-decision:subject-mismatch";
  writeFileSync(join(root, ".cache", "policy-decisions", "policy-decision_subject-mismatch.json"), JSON.stringify({ id: subjectMismatchId, subjectRef: "user:other", decision: "allow", resourceRef: commandId, action: "execute", expiresAt: "2099-01-01T00:00:00.000Z" }));
  const subjectMismatch = controlPlane.runCommand(commandId, { policyDecisionRef: subjectMismatchId, subjectRef: "user:direct" });
  assert.equal(subjectMismatch.accepted, false);
  assert.match(subjectMismatch.error, /subject does not match/);
  const expiredId = "policy-decision:expired";
  mkdirSync(join(root, ".cache", "policy-decisions"), { recursive: true });
  writeFileSync(join(root, ".cache", "policy-decisions", "policy-decision_expired.json"), JSON.stringify({ id: expiredId, subjectRef: "user:direct", decision: "allow", resourceRef: commandId, action: "execute", expiresAt: "2026-01-01T00:00:00.000Z" }));
  const expired = controlPlane.runCommand(commandId, { policyDecisionRef: expiredId, subjectRef: "user:direct" });
  assert.equal(expired.accepted, false);
  assert.match(expired.error, /expired/);

  const envelope = {
    envelope: {
      id: "direct-job-without-policy",
      channel: "mosscoder",
      conversationId: "direct",
      senderId: "user:direct",
      text: "执行一个受控任务",
      receivedAt: "2026-09-13T00:00:00.000Z",
    },
  };
  const job = controlPlane.createJob(envelope);
  assert.equal(job.accepted, false);
  assert.equal(job.httpStatus, 403);
  assert.match(job.error, /policy decision required/);

  const command = controlPlane.runCommand("missing-command");
  assert.equal(command.accepted, false);
  assert.equal(command.httpStatus, 403);
  const cancelledJob = controlPlane.cancelJob("missing-job");
  assert.equal(cancelledJob.accepted, false);
  const cancelledTask = controlPlane.cancelAgentTask("missing-task");
  assert.equal(cancelledTask.accepted, false);
  const approval = controlPlane.decideApproval({ id: "missing-approval", decision: "approved" });
  assert.equal(approval.accepted, false);
  const mobileAction = controlPlane.createMobileProjectAction({
    idempotencyKey: "direct-mobile-without-policy",
    projectId: "ielts-vocab",
    actionId: "verify",
    actionType: "project_verification",
  });
  assert.equal(mobileAction.accepted, false);
  const scan = controlPlane.decideApprovalScan({ scanId: "scan_missing", decision: "approved", policyDecisionRef: "" });
  assert.equal(scan.ok, false);
  assert.equal(scan.httpStatus, 403);
});

test("failed AgentTasks create explainable Risk and Incident projections", async () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  mkdirSync(join(root, "infra", "axi-workspace-governance"), { recursive: true });
  writeFileSync(join(root, "infra", "axi-workspace-governance", "workspace.json"), JSON.stringify({
    projects: [{ id: "ielts-vocab", owner: "owner:registry" }],
  }));
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir,
    agentTaskExecutor: () => ({ status: "failed", summary: "agent runtime unavailable", stderr: "offline" }),
  });
  const run = await controlPlane.query({
    text: "让 Codex 帮我检查 ielts-vocab",
    senderId: "user:risk-test",
    conversationId: "risk-test",
  });

  assert.equal(run.actions[0].status, "failed");
  assert.match(run.metadata.riskRef, /^risk:/);
  assert.match(run.metadata.incidentRef, /^incident:/);
  const governance = controlPlane.snapshot().governance;
  assert.equal(governance.risks.length, 1);
  assert.equal(governance.risks[0].id, run.metadata.riskRef);
  assert.equal(governance.risks[0].targetRef, "ielts-vocab");
  assert.equal(governance.risks[0].ownerRef, "owner:registry");
  assert.equal(governance.risks[0].ownerSource, "workspace.registry");
  assert.equal(governance.risks[0].policyDecisionRef, undefined);
  assert.equal(governance.risks[0].impactSnapshotRef, null);
  assert.equal(governance.risks[0].evidenceRefs.length, 1);
  assert.ok(governance.evidence.some((item) => item.id === governance.risks[0].evidenceRefs[0] && item.evidenceType === "behavioral" && item.status === "failed"));
  assert.equal(governance.evidence.find((item) => item.id === governance.risks[0].evidenceRefs[0]).observationKey, "execution:ielts-vocab");
  assert.equal(governance.incidents.length, 1);
  assert.equal(governance.incidents[0].riskRef, governance.risks[0].id);
  assert.deepEqual(governance.incidents[0].evidenceRefs, governance.risks[0].evidenceRefs);

  const acknowledged = controlPlane.transitionGovernanceRisk({
    id: run.metadata.riskRef,
    status: "acknowledged",
    actorRef: "user:risk-owner",
    policyDecisionRef: "policy-decision:risk-manage",
    correlationId: "corr-risk-ack",
  });
  assert.equal(acknowledged.ok, true);
  assert.equal(acknowledged.risk.status, "acknowledged");
  const missingReason = controlPlane.transitionGovernanceRisk({ id: run.metadata.riskRef, status: "resolved" });
  assert.equal(missingReason.ok, false);
  assert.equal(missingReason.httpStatus, 422);
  const resolved = controlPlane.transitionGovernanceRisk({
    id: run.metadata.riskRef,
    status: "resolved",
    reason: "Agent runtime restored",
    actorRef: "user:risk-owner",
    policyDecisionRef: "policy-decision:risk-manage",
    correlationId: "corr-risk-resolve",
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.risk.status, "resolved");
  assert.equal(resolved.incident.status, "resolved");
  assert.equal(controlPlane.snapshot().governance.risks[0].status, "resolved");
  assert.equal(controlPlane.snapshot().governance.incidents[0].status, "resolved");

  const restarted = createControlPlane({ workspaceRoot: root, cacheDir });
  assert.equal(restarted.snapshot().governance.risks[0].incidentRef, run.metadata.incidentRef);
  assert.deepEqual(restarted.snapshot().governance.risks[0].evidenceRefs, governance.risks[0].evidenceRefs);
  assert.ok(restarted.snapshot().governance.evidence.some((item) => item.id === governance.risks[0].evidenceRefs[0]));
});

test("executes a registered health command from natural language", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const run = await controlPlane.query({ text: "跑一下 ielts-vocab 健康检查", senderId: "u", conversationId: "c" });
  assert.equal(run.intent, "run_health");
  assert.equal(run.actions[0].status, "succeeded");
  assert.equal(run.actions[0].evidenceRefs.length, 1);
  assert.ok(controlPlane.snapshot().governance.evidence.some((item) => item.id === run.actions[0].evidenceRefs[0] && item.status === "succeeded" && item.freshness === "fresh"));
  assert.match(run.actions[0].stdout, /health ok/);
});

test("policy-gated registered automation reuses command and evidence contracts", async () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });
  const run = controlPlane.runAutomation("automation:ielts-health", { policyDecisionRef: "policy-decision:automation-test" });
  assert.equal(run.intent, "run_health");
  assert.equal(run.accepted, true);
  assert.equal(run.metadata.automationId, "automation:ielts-health");
  assert.equal(run.actions[0].status, "succeeded");
  assert.equal(run.actions[0].evidenceRefs.length, 1);
  assert.ok(controlPlane.getWorkspaceEvents({ eventType: "automation.executed" }).events.some((event) => event.objectRef === "automation:ielts-health" && event.evidenceRefs.includes(run.actions[0].evidenceRefs[0])));
});

test("interval automation scheduler evaluates policy before a registered run", async () => {
  const root = makeWorkspace();
  const graphPath = join(root, "workspace.graph.json");
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  graph.automations[0].trigger = "interval";
  graph.automations[0].intervalSeconds = 1;
  writeFileSync(graphPath, JSON.stringify(graph));
  mkdirSync(join(root, "infra", "axi-workspace-governance", "rbac"), { recursive: true });
  writeFileSync(join(root, "infra", "axi-workspace-governance", "workspace.json"), JSON.stringify({ settings: { rbac: { grants: "rbac/grants.json" } } }));
  writeFileSync(join(root, "infra", "axi-workspace-governance", "rbac", "grants.json"), JSON.stringify({ grants: [{
    id: "grant:automation-tick",
    subjectRef: "automation:automation:ielts-health",
    roleRef: "role:automation",
    action: "execute",
    scopeType: "workspace",
    scopeRef: "workspace",
    resourceRef: "automation:automation:ielts-health",
    effect: "allow",
    inheritance: "forbidden",
  }] }));
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache"), enableAutomationScheduler: true, automationSchedulerIntervalMs: 10 });
  const executed = await waitFor(() => controlPlane.getWorkspaceEvents({ eventType: "automation.executed" }).events[0], 500);
  controlPlane.stopAutomationScheduler();
  assert.ok(executed);
  assert.equal(executed.objectRef, "automation:ielts-health");
  assert.match(executed.policyDecisionRef, /^policy-decision:/);
  const decisions = controlPlane.snapshot().governance.policyDecisions;
  assert.ok(decisions.some((decision) => decision.id === executed.policyDecisionRef && decision.subjectRef === "automation:automation:ielts-health"));
  assert.ok(controlPlane.snapshot().governance.automations[0].lastRunAt);
});

test("registered remediation commands require approval before execution", async () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });
  const remediationCommand = controlPlane.snapshot().resources.find((resource) => resource.id === "ielts-vocab").commands.find((command) => command.intent === "run_remediation");
  const directApi = controlPlane.runCommand(remediationCommand.id, { policyDecisionRef: "policy-decision:direct-remediation" });
  assert.equal(directApi.actions[0].status, "blocked");

  const direct = await controlPlane.query({
    text: "修复 ielts-vocab",
    senderId: "user:remediation",
    conversationId: "remediation-direct",
  });
  assert.equal(direct.intent, "run_remediation");
  assert.equal(direct.actions[0].status, "blocked");
  assert.match(direct.summary, /已拒绝/);

  const pending = controlPlane.createJob({
    __approvedByApproval: "forged-approval",
    envelope: {
      id: "remediation-job-1",
      channel: "mosscoder",
      conversationId: "remediation",
      senderId: "user:remediation",
      text: "修复 ielts-vocab",
      receivedAt: "2026-09-13T00:00:00.000Z",
    },
  });
  assert.equal(pending.status, "pending_approval");
  assert.equal(pending.riskLevel, "high");
  assert.ok(new Date(pending.expiresAt).getTime() > Date.now());

  const approved = controlPlane.decideApproval({ id: pending.approvalId, decision: "approved", decisionText: "owner approved remediation" });
  assert.equal(approved.status, "approved");
  const completed = await waitFor(() => {
    const job = controlPlane.getJob(approved.dispatchedJobId);
    return job?.status === "completed" ? job : null;
  });
  assert.equal(completed.metadata.approvalId, pending.approvalId);
  const task = controlPlane.getAgentTask(completed.metadata.agentTaskId);
  assert.equal(task.runtime, "registered_command");
  assert.equal(task.status, "succeeded");
  assert.equal(task.evidenceRefs.length, 1);
  assert.ok(controlPlane.snapshot().governance.evidence.some((item) => item.id === task.evidenceRefs[0] && item.status === "succeeded"));
  assert.deepEqual(completed.auditReport.evidenceRefs, task.evidenceRefs);
  assert.match(task.stdout, /remediated/);
});

test("expired approval requests are persisted as expired and never dispatch a job", async () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });
  const pending = controlPlane.createJob({
    envelope: {
      id: "remediation-expiry-1",
      channel: "mosscoder",
      conversationId: "remediation-expiry",
      senderId: "user:remediation",
      text: "修复 ielts-vocab",
      receivedAt: "2026-09-13T00:00:00.000Z",
    },
  });
  const approvalPath = join(cacheDir, "approvals", `${pending.approvalId}.json`);
  const approval = JSON.parse(readFileSync(approvalPath, "utf8"));
  approval.expiresAt = "2026-01-01T00:00:00.000Z";
  writeFileSync(approvalPath, JSON.stringify(approval));
  const restarted = createControlPlane({ workspaceRoot: root, cacheDir });
  const expired = restarted.decideApproval({ id: pending.approvalId, decision: "approved", decisionText: "late approval" });
  assert.equal(expired.status, "expired");
  assert.equal(expired.dispatchedJobId, undefined);
  assert.ok(restarted.getWorkspaceEvents({ eventType: "approval_expired" }).events.some((event) => event.objectRef === pending.approvalId));
});

test("a persisted require_approval policy creates a desktop pending approval", () => {
  const root = makeWorkspace();
  const cacheDir = join(root, ".cache");
  mkdirSync(join(cacheDir, "policy-decisions"), { recursive: true });
  const decisionId = "policy-decision:desktop-approval";
  writeFileSync(join(cacheDir, "policy-decisions", "policy-decision_desktop-approval.json"), JSON.stringify({
    id: decisionId,
    subjectRef: "user:core",
    decision: "require_approval",
    resourceRef: "ielts-vocab",
    action: "execute",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }));
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir, enforceExecutionPolicy: true });
  const pending = controlPlane.createJob({
    projectId: "ielts-vocab",
    envelope: {
      id: "desktop-approval-job-1",
      channel: "mosscoder",
      conversationId: "desktop-approval",
      senderId: "user:core",
      text: "启动 ielts-vocab",
      receivedAt: "2026-09-13T00:00:00.000Z",
    },
  }, { policyDecisionRef: decisionId, forceApproval: true, subjectRef: "user:core" });
  assert.equal(pending.status, "pending_approval");
  const approval = controlPlane.snapshot().approvals.find((item) => item.id === pending.approvalId);
  assert.equal(approval.source, "desktop");
  assert.equal(approval.policyDecisionRef, decisionId);
  assert.ok(new Date(approval.expiresAt).getTime() > Date.now());
});

test("registered commands reject shell composition and only expose them as non-executable", async () => {
  const root = makeWorkspace();
  const graphPath = join(root, "workspace.graph.json");
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  graph.projects["ielts-vocab"].health = ["node -e \"process.stdout.write('first')\" && node -e \"process.stdout.write('second')\""];
  writeFileSync(graphPath, JSON.stringify(graph));
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const command = controlPlane.snapshot().resources.find((resource) => resource.id === "ielts-vocab").commands[0];
  assert.equal(command.autoExecutable, false);
  const run = await controlPlane.query({ text: "跑一下 ielts-vocab 健康检查", senderId: "u", conversationId: "c" });
  assert.equal(run.actions[0].status, "blocked");
  assert.match(run.actions[0].summary, /单一注册程序/);
});

test("creates managed Codex CLI agent tasks from natural language", async () => {
  const root = makeWorkspace();
  const executed = [];
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    agentTaskExecutor: ({ task }) => {
      executed.push(task);
      return { status: "succeeded", summary: "fake codex ok", stdout: "done" };
    },
  });
  const result = await controlPlane.handleCommunicationMessage({
    envelope: {
      id: "agent-task-1",
      channel: "wechat",
      conversationId: "wx-user",
      senderId: "wx-user",
      text: "让 Codex 帮我检查 ielts-vocab",
      receivedAt: "2026-05-20T00:00:00.000Z",
      raw: { routeKey: "wechat:wx-user:wx-user" },
    },
  });

  assert.equal(result.run.intent, "start_agent_task");
  assert.equal(executed.length, 1);
  assert.equal(executed[0].runtime, "codex_cli");
  assert.equal(executed[0].targetId, "ielts-vocab");
  assert.equal(executed[0].cwd, join(root, "ielts-vocab"));
  assert.match(result.response.text, /fake codex ok/);
  const task = controlPlane.getAgentTask(result.run.metadata.agentTaskId);
  assert.equal(task.status, "succeeded");
});

test("exposes agent task artifacts through the Axi resource snapshot", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    agentTaskExecutor: ({ task }) => ({ status: "succeeded", summary: `artifact=${task.id}`, stdout: "done" }),
  });

  const result = await controlPlane.handleCommunicationMessage({
    envelope: {
      id: "agent-task-artifact",
      channel: "wechat",
      conversationId: "wx-user",
      senderId: "wx-user",
      text: "让 Codex 帮我检查 ielts-vocab",
      receivedAt: "2026-05-20T00:00:00.000Z",
      raw: { routeKey: "wechat:wx-user:wx-user" },
    },
  });

  const taskId = result.run.metadata.agentTaskId;
  const snapshot = controlPlane.snapshot();
  assert.ok(snapshot.axiResources.agent_artifact.some((item) => item.source === "control-plane.agent-task"));
  assert.ok(snapshot.axiResources.agent_artifact.some((item) => item.ownerId === "wx-user" || item.resourceId === "ielts-vocab"));
  assert.ok(snapshot.axiResources.agent_artifact.some((item) => item.id === `agent_artifact:${taskId}`));
});

test("falls back from Codex App runtime to Codex CLI when app runtime is disabled", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    agentTaskExecutor: ({ task }) => ({ status: "succeeded", summary: `runtime=${task.runtime}` }),
  });
  const result = await controlPlane.handleCommunicationMessage({
    envelope: {
      id: "agent-task-2",
      channel: "mosscoder",
      conversationId: "desk",
      senderId: "local-user",
      text: "开始处理 cockpit-tools",
      receivedAt: "2026-05-20T00:00:00.000Z",
      raw: { routeKey: "mosscoder:desk:local-user", runtimePreference: "codex_app" },
    },
  });

  const task = controlPlane.getAgentTask(result.run.metadata.agentTaskId);
  assert.equal(task.requestedRuntime, "codex_app");
  assert.equal(task.runtime, "codex_cli");
  assert.match(task.summary, /runtime=codex_cli/);
});

test("explains dependency relationships in one answer", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const run = await controlPlane.query({ text: "解释 cockpit-tools 依赖谁", senderId: "u", conversationId: "c", dryRun: true });
  assert.equal(run.intent, "explain_dependency");
  assert.match(run.summary, /ielts-vocab/);
});

test("deduplicates repeated Feishu envelopes by message id", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const payload = {
    envelope: {
      id: "m1",
      channel: "feishu",
      conversationId: "chat",
      senderId: "user",
      text: "查看所有项目状态",
      receivedAt: "2026-05-20T00:00:00.000Z",
    },
  };
  const first = await controlPlane.query(payload);
  const second = await controlPlane.query(payload);
  assert.equal(first.id, second.id);
});

test("handles normalized communication messages through the control plane", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const payload = {
    envelope: {
      id: "comm-m1",
      channel: "feishu",
      conversationId: "feishu:chat:user",
      senderId: "ou-user",
      text: "查看所有项目状态",
      receivedAt: "2026-05-20T00:00:00.000Z",
    },
  };

  const first = await controlPlane.handleCommunicationMessage(payload);
  const second = await controlPlane.handleCommunicationMessage(payload);

  assert.equal(first.ignored, false);
  assert.equal(first.run.envelope.channel, "feishu");
  assert.equal(first.run.envelope.conversationId, "feishu:chat:user");
  assert.equal(first.run.intent, "status_query");
  assert.match(first.run.summary, /当前纳管/);
  assert.equal(first.response.format, "feishu_markdown");
  assert.match(first.response.text, /Axi Workstation 控制面/);
  assert.equal(first.response.auditId, first.run.id);
  assert.equal(first.run.id, second.run.id);
});

test("rejects non-standard communication payloads before control-plane execution", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const result = await controlPlane.handleCommunicationMessage({
    provider: "cc-connect",
    session_key: "feishu:chat:user",
    id: "cc-m2",
    text: "查看所有项目状态",
    dryRun: true,
  });

  assert.equal(result.ignored, true);
  assert.match(result.summary, /标准 IMEnvelope/);
  assert.deepEqual(result.missing, ["channel", "conversationId", "senderId"]);
  assert.ok(!("run" in result));
});

test("answers natural Chinese project-list questions from memory only", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    memoryProjectReader: () => [
      { project: "ielts-vocab", featureCount: 42, lastActivity: "2026-05-20T06:43:36.107853+08:00" },
      { project: "mosscoder", featureCount: 5, lastActivity: "2026-05-14T22:51:56.092836+08:00" },
    ],
  });

  const result = await controlPlane.handleCommunicationMessage({
    envelope: {
      id: "cc-memory-1",
      channel: "feishu",
      conversationId: "feishu:chat:user",
      senderId: "ou-user",
      text: "当前项目有哪些？",
      receivedAt: "2026-05-20T00:00:00.000Z",
    },
  }, { intelligenceOnly: true });

  assert.equal(result.run.metadata.mode, "memory_only");
  assert.equal(result.run.actions[0].status, "succeeded");
  assert.doesNotMatch(result.run.summary, /Current Projects|workspace index/i);
  assert.match(result.run.summary, /当前项目/);
  assert.match(result.run.summary, /1\. `ielts-vocab`/);
  assert.match(result.run.summary, /记忆条目：42/);
  assert.match(result.run.summary, /只读取记忆面/);
  assert.equal(result.response.format, "feishu_markdown");
  assert.match(result.response.text, /`ielts-vocab`/);
  assert.match(result.response.text, /`mosscoder`/);
  assert.doesNotMatch(result.response.text, /Axi Workstation 控制面/);
});

test("ignores non-inbound communication messages", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const result = await controlPlane.handleCommunicationMessage({ direction: "outbound", text: "agent reply" });
  assert.equal(result.ignored, true);
  assert.match(result.summary, /忽略/);
});

test("intelligence-only communication messages ignore unrelated natural language", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  const result = await controlPlane.handleCommunicationMessage({
    envelope: {
      id: "cc-ignore-1",
      channel: "feishu",
      conversationId: "feishu:chat:user",
      senderId: "ou-user",
      text: "帮我看看今天进度",
      receivedAt: "2026-05-20T00:00:00.000Z",
    },
  }, { intelligenceOnly: true });
  assert.equal(result.ignored, true);
  assert.match(result.summary, /非情报站项目查询/);
});

test("creates asynchronous control jobs with workflow events and artifacts", async () => {
  const root = makeWorkspace();
  const roleRuns = [];
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    memoryDatabaseUrl: null,
    heartbeatMs: 20,
    roleAgentExecutor: async ({ assignment, run, cacheDir }) => {
      roleRuns.push({ role: assignment.role, title: assignment.title, runId: run.id });
      return { status: "succeeded", summary: `${assignment.role} ok`, stdoutPath: join(cacheDir, "fake-stdout.jsonl"), stderrPath: join(cacheDir, "fake-stderr.log") };
    },
  });

  const accepted = controlPlane.createJob({
    envelope: {
      id: "job-1",
      channel: "mosscoder",
      conversationId: "desk",
      senderId: "tester",
      text: "从0到1实现俄罗斯方块网页游戏",
      receivedAt: "2026-05-20T00:00:00.000Z",
      raw: { routeKey: "mosscoder:desk:tester", runtimePreference: "codex_app" },
    },
  }, { policyDecisionRef: "policy-decision:test-job" });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.response.format, "card");
  assert.match(accepted.response.text, /任务编号/);
  assert.equal(accepted.job.assessment.kind, "code");
  assert.equal(accepted.job.status, "queued");
  assert.equal(accepted.job.metadata.policyDecisionRef, "policy-decision:test-job");

  const completed = await waitFor(() => {
    const job = controlPlane.getJob(accepted.job.id);
    return job?.status === "completed" ? job : null;
  });

  assert.equal(completed.status, "completed");
  assert.ok(roleRuns.some((run) => run.role === "master"));
  assert.ok(roleRuns.some((run) => run.role === "worker"));
  assert.ok(roleRuns.some((run) => run.role === "auditor"));
  assert.ok(roleRuns.filter((run) => run.role === "librarian").length >= 2);
  assert.equal(controlPlane.getJobEvents(accepted.job.id).events.at(-1).type, "completed");
  assert.ok(controlPlane.getJobEvents(accepted.job.id).events.some((event) => event.type === "checkpoint" && event.data.framework === "langgraph"));
  assert.ok(controlPlane.getJobArtifacts(accepted.job.id).artifacts.some((artifact) => artifact.path.endsWith("job.json")));
  assert.ok(controlPlane.getJobArtifacts(accepted.job.id).artifacts.some((artifact) => artifact.path.endsWith("langgraph-state.json")));
});

test("control jobs deduplicate repeated envelope ids", async () => {
  const root = makeWorkspace();
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    memoryDatabaseUrl: null,
    roleAgentExecutor: async ({ assignment }) => ({ status: "succeeded", summary: `${assignment.role} ok` }),
  });
  const payload = {
    envelope: {
      id: "job-dedupe",
      channel: "mosscoder",
      conversationId: "desk",
      senderId: "tester",
      text: "让 Codex 创建一个项目文档系统",
      receivedAt: "2026-05-20T00:00:00.000Z",
    },
  };
  const first = controlPlane.createJob(payload);
  const second = controlPlane.createJob(payload);
  assert.equal(first.job.id, second.job.id);
});

test("worker assignments get one self-correction attempt before failing the job", async () => {
  const root = makeWorkspace();
  let workerAttempts = 0;
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    memoryDatabaseUrl: null,
    roleAgentExecutor: async ({ assignment }) => {
      if (assignment.role === "worker") {
        workerAttempts += 1;
        return workerAttempts === 1
          ? { status: "failed", summary: "worker self audit gap" }
          : { status: "succeeded", summary: "worker fixed after self audit" };
      }
      return { status: "succeeded", summary: `${assignment.role} ok` };
    },
  });

  const accepted = controlPlane.createJob({
    envelope: {
      id: "job-worker-retry",
      channel: "mosscoder",
      conversationId: "desk",
      senderId: "tester",
      text: "开发一个小网页并验证",
      receivedAt: "2026-05-20T00:00:00.000Z",
    },
  });

  const completed = await waitFor(() => {
    const job = controlPlane.getJob(accepted.job.id);
    return job?.status === "completed" ? job : null;
  });

  assert.equal(completed.status, "completed");
  assert.equal(workerAttempts, 2);
  assert.ok(controlPlane.getJobEvents(accepted.job.id).events.some((event) => /自修正/.test(event.message)));
});

test("delegates explicit Axi Agent quality-gate tasks and records audit artifacts", async () => {
  const root = makeWorkspace();
  const delegated = [];
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    memoryDatabaseUrl: null,
    axiAgentTaskExecutor: async (request) => {
      delegated.push(request);
      return {
        agentTaskId: request.agentTaskId,
        runtime: "axi_agent_mcp",
        status: "succeeded",
        passed: true,
        source: "axi-agent-mcp",
        tool: "swarm_validate_with_gates",
        summary: "Axi Agent quality gate passed.",
        text: "质量门控验证结果",
      };
    },
  });

  const accepted = controlPlane.createJob({
    envelope: {
      id: "job-axi-agent-quality",
      channel: "mosscoder",
      conversationId: "desk",
      senderId: "tester",
      text: "让 axi-agent 审计 function add(a, b) { return a + b; }",
      receivedAt: "2026-05-25T00:00:00.000Z",
    },
  });

  const completed = await waitFor(() => {
    const job = controlPlane.getJob(accepted.job.id);
    return job?.status === "completed" ? job : null;
  });
  const task = controlPlane.getAgentTask(completed.metadata.agentTaskId);

  assert.equal(accepted.job.metadata.executionMode, "axi_agent");
  assert.equal(delegated.length, 1);
  assert.equal(delegated[0].operation, "quality_gate");
  assert.equal(task.runtime, "axi_agent");
  assert.equal(task.targetId, "axi-agent");
  assert.equal(completed.auditReport.verdict, "pass");
  assert.ok(controlPlane.getJobEvents(accepted.job.id).events.some((event) => event.type === "audit" && event.data.verdict === "pass"));
  assert.ok(controlPlane.getJobArtifacts(accepted.job.id).artifacts.some((artifact) => artifact.path.endsWith("axi-agent-task.json")));
});

test("delegates explicit Axi Agent read-only tool-result tasks and records artifacts", async () => {
  const root = makeWorkspace();
  const delegated = [];
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".cache"),
    memoryDatabaseUrl: null,
    axiAgentTaskExecutor: async (request) => {
      delegated.push(request);
      return {
        agentTaskId: request.agentTaskId,
        runtime: "axi_agent_mcp",
        status: "succeeded",
        passed: true,
        source: "axi-agent-mcp",
        tool: "swarm_git_status",
        summary: "Axi Agent read-only MCP tool completed.",
        text: "Git 状态\n工作区干净",
      };
    },
  });

  const accepted = controlPlane.createJob({
    envelope: {
      id: "job-axi-agent-tool-result",
      channel: "mosscoder",
      conversationId: "desk",
      senderId: "tester",
      text: "让 axi-agent 只读查看 git status 并返回 artifact",
      receivedAt: "2026-05-25T00:00:00.000Z",
    },
  });

  const completed = await waitFor(() => {
    const job = controlPlane.getJob(accepted.job.id);
    return job?.status === "completed" ? job : null;
  });
  const task = controlPlane.getAgentTask(completed.metadata.agentTaskId);

  assert.equal(accepted.job.metadata.executionMode, "axi_agent");
  assert.equal(accepted.job.metadata.operation, "tool_result_artifact");
  assert.equal(delegated.length, 1);
  assert.equal(delegated[0].operation, "tool_result_artifact");
  assert.equal(delegated[0].toolName, "swarm_git_status");
  assert.equal(task.runtime, "axi_agent");
  assert.equal(task.targetId, "axi-agent");
  assert.match(task.stdout, /Git 状态/);
  assert.equal(completed.auditReport.verdict, "pass");
  assert.ok(controlPlane.getJobArtifacts(accepted.job.id).artifacts.some((artifact) => artifact.path.endsWith("axi-agent-task.json")));
});
