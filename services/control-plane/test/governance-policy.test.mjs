import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane, evaluateGovernancePolicy } from "./test-control-plane.mjs";

const baseGrant = {
  subjectRef: "user:alice",
  roleRef: "role:operator",
  action: "execute",
  source: "test.workspace-rbac",
  evidenceRefs: ["evidence:grant-1"],
};

test("policy evaluation inherits workspace grants but deny always wins", () => {
  const decision = evaluateGovernancePolicy({
    subjectRef: "user:alice",
    scopeRef: "unit:alpha",
    resourceRef: "alpha",
    action: "execute",
    now: "2026-09-13T05:00:00.000Z",
    grants: [
      { ...baseGrant, id: "grant:workspace-allow", scopeType: "workspace", scopeRef: "workspace", resourceRef: "*", effect: "allow", inheritance: "default", priority: 1 },
      { ...baseGrant, id: "grant:unit-approval", scopeType: "unit", scopeRef: "unit:alpha", resourceRef: "alpha", effect: "require_approval", inheritance: "required", priority: 5 },
      { ...baseGrant, id: "grant:object-deny", scopeType: "object", scopeRef: "alpha", resourceRef: "alpha", effect: "deny", inheritance: "forbidden", priority: 0 },
    ],
  });

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "deny_precedence");
  assert.deepEqual(decision.matchedGrantRefs, ["grant:unit-approval", "grant:workspace-allow", "grant:object-deny"]);
  assert.deepEqual(decision.evidenceRefs, ["evidence:grant-1"]);
  assert.equal(decision.denyPrecedence, true);
});

test("policy evaluation returns approval or allow and ignores expired grants", () => {
  const approval = evaluateGovernancePolicy({
    subjectRef: "user:alice",
    scopeRef: "unit:alpha",
    resourceRef: "alpha",
    action: "deploy",
    now: "2026-09-13T05:00:00.000Z",
    grants: [{ ...baseGrant, id: "grant:approval", scopeType: "unit", scopeRef: "unit:alpha", resourceRef: "alpha", action: "deploy", effect: "require_approval", inheritance: "required" }],
  });
  assert.equal(approval.decision, "require_approval");
  assert.equal(approval.reason, "approval_required");

  const expired = evaluateGovernancePolicy({
    subjectRef: "user:alice",
    scopeRef: "workspace",
    resourceRef: "alpha",
    action: "read",
    now: "2026-09-13T05:00:00.000Z",
    grants: [{ ...baseGrant, id: "grant:expired", action: "read", scopeType: "workspace", scopeRef: "workspace", resourceRef: "*", effect: "allow", inheritance: "default", validTo: "2026-09-13T04:59:59.000Z" }],
  });
  assert.equal(expired.decision, "deny");
  assert.equal(expired.reason, "no_matching_grant");
  assert.deepEqual(expired.matchedGrantRefs, []);
});

test("configured policy decisions load grants only through the registry-declared path", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-governance-policy-config-"));
  const governanceRoot = join(root, "infra", "axi-workspace-governance");
  mkdirSync(join(governanceRoot, "rbac"), { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({ projects: {} }));
  writeFileSync(join(governanceRoot, "workspace.json"), JSON.stringify({
    settings: { rbac: { version: "test-rbac-v1", grants: "rbac/grants.json" } },
  }));
  writeFileSync(join(governanceRoot, "rbac", "grants.json"), JSON.stringify({ grants: [{
    ...baseGrant,
    id: "grant:configured-read",
    action: "read",
    scopeType: "workspace",
    scopeRef: "workspace",
    resourceRef: "alpha",
    effect: "allow",
    inheritance: "default",
  }] }));

  const controlPlane = createControlPlane({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    cacheDir: join(root, ".cache"),
    pairingEnabled: false,
  });
  const response = controlPlane.evaluateConfiguredGovernancePolicy({
    subjectRef: "user:alice",
    resourceRef: "alpha",
    action: "read",
  });
  assert.equal(response.decision.decision, "allow");
  assert.equal(response.decision.policyVersion, "test-rbac-v1");
  assert.match(response.decision.correlationId, /^policy-decision:/);
  assert.equal(response.grantsSource, join(governanceRoot, "rbac", "grants.json"));
  assert.deepEqual(response.warnings, []);
  assert.equal(response.decision.evidenceRefs.length, 2);
  assert.ok(controlPlane.snapshot().governance.evidence.some((item) => item.id === response.decision.evidenceRefs.at(-1) && item.source === "control-plane.policy" && item.status === "allow"));
  assert.deepEqual(controlPlane.getGovernancePolicyDecision(response.decision.id), response.decision);
  assert.deepEqual(controlPlane.snapshot().governance.policyDecisions, [response.decision]);

  const restarted = createControlPlane({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    cacheDir: join(root, ".cache"),
    pairingEnabled: false,
  });
  assert.deepEqual(restarted.getGovernancePolicyDecision(response.decision.id), response.decision);
  assert.deepEqual(restarted.snapshot().governance.policyDecisions, [response.decision]);
});

test("configured grants fail closed on invalid enums and retain source provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-governance-policy-validation-"));
  const governanceRoot = join(root, "infra", "axi-workspace-governance");
  mkdirSync(join(governanceRoot, "rbac"), { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({ projects: {} }));
  writeFileSync(join(governanceRoot, "workspace.json"), JSON.stringify({ settings: { rbac: { grants: "rbac/grants.json" } } }));
  writeFileSync(join(governanceRoot, "rbac", "grants.json"), JSON.stringify({ grants: [
    { id: "grant:valid", subjectRef: "user:alice", roleRef: "role:reader", scopeType: "workspace", scopeRef: "workspace", resourceRef: "alpha", action: "read", effect: "allow", inheritance: "default" },
    { id: "grant:valid", subjectRef: "user:alice", roleRef: "role:reader", scopeType: "workspace", scopeRef: "workspace", resourceRef: "alpha", action: "read", effect: "deny", inheritance: "default" },
    { id: "grant:invalid", subjectRef: "user:alice", roleRef: "role:reader", scopeType: "workspace", scopeRef: "workspace", resourceRef: "alpha", action: "read", effect: "maybe", inheritance: "default" },
    { id: "grant:reversed-window", subjectRef: "user:alice", roleRef: "role:reader", scopeType: "workspace", scopeRef: "workspace", resourceRef: "alpha", action: "read", effect: "allow", inheritance: "default", validFrom: "2026-09-14T01:00:00.000Z", validTo: "2026-09-14T00:00:00.000Z" },
  ] }));

  const controlPlane = createControlPlane({ workspaceRoot: root, graphPath: join(root, "workspace.graph.json"), cacheDir: join(root, ".cache"), pairingEnabled: false });
  const response = controlPlane.evaluateConfiguredGovernancePolicy({ subjectRef: "user:alice", resourceRef: "alpha", action: "read" });
  assert.equal(response.decision.decision, "allow");
  assert.deepEqual(response.warnings, ["workspace_rbac_grants_invalid_entries", "workspace_rbac_grants_duplicate_ids"]);
  assert.equal(response.decision.matchedGrantRefs.length, 1);
  assert.equal(response.decision.evidenceRefs.length, 1);
});
