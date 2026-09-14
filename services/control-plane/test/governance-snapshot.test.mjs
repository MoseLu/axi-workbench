import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { buildGovernanceSnapshot, buildSnapshot, readWorkspaceEvents, recordMobileAudit } from "../src/control-plane.mjs";

function makeGovernanceFixture({ conflict = false, graphIdentity = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "axi-governance-snapshot-"));
  const graphProjectPath = join(root, "projects", "alpha-graph");
  const registryProjectPath = join(root, "projects", "alpha");
  const providerPath = join(root, "projects", "provider");
  const governanceRoot = join(root, "infra", "axi-workspace-governance");
  const graphPath = join(root, "workspace.graph.json");
  const registryPath = join(governanceRoot, "workspace.json");
  mkdirSync(graphProjectPath, { recursive: true });
  mkdirSync(registryProjectPath, { recursive: true });
  mkdirSync(providerPath, { recursive: true });
  mkdirSync(governanceRoot, { recursive: true });
  mkdirSync(join(governanceRoot, "admissions"), { recursive: true });
  writeFileSync(join(registryProjectPath, "README.md"), "fixture README\n");
  writeFileSync(join(governanceRoot, "admissions", "policy.json"), "{}\n");

  writeFileSync(graphPath, JSON.stringify({
    rules: [
      "Use registered providers for cross-project contracts.",
      {
        id: "rule:workspace:derived",
        statement: "Derived rule with a bounded lifetime.",
        owner: "axi-rules",
        inheritance: "required",
        expiresAt: "2026-01-01T00:00:00.000Z",
        inheritedFrom: ["rule:workspace:graph:1"],
        overrides: ["rule:workspace:graph:2"],
      },
      {
        id: "rule:workspace:derived",
        statement: "Conflicting duplicate declaration.",
        owner: "axi-rules",
      },
    ],
    projects: {
      alpha: {
        name: "Alpha Graph",
        path: conflict ? graphProjectPath : registryProjectPath,
        kind: "product",
        ...(graphIdentity ? {
          owner: "owner-from-graph",
          objectType: "service",
          lifecycle: "graph-lifecycle",
          sourceOfTruth: "workspace.graph.override",
        } : {}),
        provides: ["alpha-capability"],
        consumes: ["shared-capability"],
        contracts: ["contracts/alpha.json"],
        relationships: [{
          targetRef: "provider",
          relationshipType: "DEPENDS_ON",
          requiredness: "required",
          dependencyPhase: "runtime",
          environment: "development",
          versionConstraint: ">=1.0.0",
          validFrom: "2026-01-01T00:00:00.000Z",
          provenance: "fixture.relationship",
        }, {
          targetRef: "missing-provider",
          relationshipType: "DEPENDS_ON",
        }],
        docs_entrypoints: ["README.md", "docs/MISSING.md"],
        completion: {
          stage: "building",
          confidence: "high",
          updatedAt: "2026-01-01T00:00:00.000Z",
          evidence: ["projects/alpha/VERIFICATION.md"],
        },
      },
      "graph-only-capability": {
        name: "Graph Only Capability",
        kind: "local-capability-layer",
        provides: ["local-llm"],
        consumes: ["provider"],
      },
      provider: {
        name: "Capability Provider",
        path: providerPath,
        kind: "service",
        provides: ["shared-capability"],
        consumes: ["alpha"],
      },
    },
  }));
  writeFileSync(registryPath, JSON.stringify({
    projects: [{
      id: "alpha",
      name: "Alpha Registry",
      path: "../../projects/alpha",
      category: "project",
      owner: "owner-1",
      status: "active",
      lifecycle: "active-canonical",
    }],
    infra: {
      "infra-only": {
        id: "infra-only",
        name: "Infra Only",
        path: "C:\\Users\\12081\\.openclaw",
        category: "infra",
        owner: "infra-owner",
        status: "active",
        lifecycle: "active-infra",
      },
    },
    settings: {
      policy: "admissions/policy.json",
    },
  }));
  return { root, graphPath, registryPath, registryProjectPath };
}

test("builds a source-aware governance snapshot with stable identity and stale evidence", () => {
  const fixture = makeGovernanceFixture();
  const snapshot = buildGovernanceSnapshot({
    ...fixture,
    generatedAt: "2026-09-13T00:00:00.000Z",
  });
  const alpha = snapshot.units.find((unit) => unit.id === "alpha");
  const completion = snapshot.evidence.find((item) => item.id === "evidence:alpha:completion");
  const documents = snapshot.documents.filter((item) => item.subjectRef === "alpha");
  assert.equal(snapshot.rules.length, 4);
  assert.equal(snapshot.rules.find((rule) => rule.id === "rule:workspace:graph:1").ownerRef, "unknown");
  assert.deepEqual(snapshot.coverage, {
    unitCount: 4,
    ownerResolvedCount: 2,
    ownerUnknownCount: 2,
    ownerExternalCount: 0,
    identityAlignedCount: 1,
    identityPartialCount: 3,
    identityConflictCount: 0,
  });
  assert.deepEqual(snapshot.executionCoverage, {
    declaredProjectCount: 3,
    healthDeclaredCount: 0,
    verifyDeclaredCount: 0,
    remediationDeclaredCount: 0,
  });
  assert.deepEqual(snapshot.relationshipMetadataCoverage, {
    dependencyEdgeCount: 3,
    scopeDeclaredCount: 1,
    requirednessDeclaredCount: 1,
    dependencyPhaseDeclaredCount: 1,
    environmentDeclaredCount: 1,
    versionConstraintDeclaredCount: 1,
    validityWindowDeclaredCount: 1,
  });
  assert.equal(snapshot.relationshipMetadataGaps.length, 2);
  assert.deepEqual(snapshot.relationshipMetadataGaps.find((gap) => gap.sourceRef === "graph-only-capability" && gap.targetRef === "provider").missing, ["requiredness", "dependencyPhase", "environment", "versionConstraint", "validityWindow"]);
  assert.ok(snapshot.warnings.includes("relationship_metadata_incomplete:3"));
  assert.deepEqual(snapshot.eventCoverage, {
    declaredSourceCount: 0,
    loadedSourceCount: 0,
    eventCount: 0,
    surfaceCount: 0,
    projectCount: 0,
    serviceCount: 0,
  });
  const derivedRules = snapshot.rules.filter((rule) => rule.id === "rule:workspace:derived");
  assert.equal(derivedRules[0].freshness, "stale");
  assert.deepEqual(derivedRules[0].inheritedFrom, ["rule:workspace:graph:1"]);
  assert.deepEqual(derivedRules[0].overrides, ["rule:workspace:graph:2"]);
  assert.equal(derivedRules[0].inheritance, "required");
  assert.ok(snapshot.relationships.some((relationship) => relationship.sourceRef === "rule:workspace:derived" && relationship.targetRef === "rule:workspace:graph:1" && relationship.relationshipType === "INHERITS_FROM"));
  assert.ok(snapshot.relationships.some((relationship) => relationship.sourceRef === "rule:workspace:derived" && relationship.targetRef === "rule:workspace:graph:2" && relationship.relationshipType === "OVERRIDES"));
  assert.ok(snapshot.conflicts.some((conflict) => conflict.subjectRef === "rule:workspace:derived" && conflict.field === "rule.statement"));
  assert.ok(snapshot.warnings.includes("rule_stale:rule:workspace:derived"));
  assert.equal(snapshot.evidence.find((item) => item.id === "evidence:workspace:rule:registry-policy").status, "present");
  assert.deepEqual(snapshot.authorization, {
    status: "unconfigured",
    source: null,
    ownerRef: "unknown",
    policyVersion: "workspace-rbac-v1",
    grantCount: 0,
    warnings: ["workspace_rbac_grants_unconfigured"],
  });

  assert.equal(alpha.name, "Alpha Registry");
  assert.equal(alpha.ownerRef, "owner-1");
  assert.equal(alpha.ownerEvidenceRef, "evidence:alpha:registry");
  assert.equal(alpha.ownerStatus, "resolved");
  assert.equal(alpha.objectType, "project");
  assert.equal(alpha.identityStatus, "aligned");
  assert.equal(alpha.sourceOfTruth, fixture.registryPath);
  assert.equal(alpha.path, fixture.registryProjectPath);
  assert.equal(alpha.freshness, "stale");
  assert.deepEqual(documents.map((item) => ({ entrypoint: item.entrypoint, status: item.status })), [
    { entrypoint: "README.md", status: "present" },
    { entrypoint: "docs/MISSING.md", status: "missing" },
  ]);
  assert.equal(documents.find((item) => item.entrypoint === "docs/MISSING.md").ownerRef, "owner-1");
  assert.equal(documents.find((item) => item.entrypoint === "docs/MISSING.md").requirement, "required");
  assert.equal(documents.find((item) => item.entrypoint === "docs/MISSING.md").requirementSource, "workspace.graph.docs_entrypoints");
  assert.deepEqual(alpha.documentRefs, ["document:alpha:1", "document:alpha:2"]);
  assert.ok(alpha.evidenceRefs.includes("evidence:alpha:document:1"));
  assert.ok(alpha.evidenceRefs.includes("evidence:alpha:document:2"));
  assert.deepEqual(alpha.health, {
    status: "warning",
    reason: "documentation_missing",
    evidenceRefs: ["evidence:alpha:document:2"],
    affectedObjectRefs: ["alpha"],
    ownerRef: "owner-1",
    recommendedAction: "restore_required_document",
  });
  assert.deepEqual(alpha.relationships.map((item) => item.relationshipType).sort(), [
    "PROVIDES_CAPABILITY",
    "CONSUMES_CAPABILITY",
    "IMPLEMENTS_CONTRACT",
    "DEPENDS_ON",
  ].sort());
  assert.equal(alpha.relationships[0].scope, "workspace");
  assert.equal(alpha.relationships.find((item) => item.relationshipType === "DEPENDS_ON")?.targetRef, "provider");
  const explicitRelationship = alpha.relationships.find((item) => item.provenance === "fixture.relationship");
  assert.deepEqual(explicitRelationship, {
    sourceRef: "alpha",
    targetRef: "provider",
    relationshipType: "DEPENDS_ON",
    scope: "workspace",
    requiredness: "required",
    dependencyPhase: "runtime",
    environment: "development",
    versionConstraint: ">=1.0.0",
    validFrom: "2026-01-01T00:00:00.000Z",
    provenance: "fixture.relationship",
    confidence: "medium",
  });
  assert.deepEqual(snapshot.relationships.filter((item) => item.sourceRef === "alpha").map((item) => item.relationshipType), alpha.relationships.map((item) => item.relationshipType));
  const alphaImpact = snapshot.impact.find((item) => item.subjectRef === "alpha");
  assert.deepEqual(alphaImpact.directUpstreamRefs, ["provider"]);
  assert.deepEqual(alphaImpact.transitiveUpstreamRefs, ["provider"]);
  assert.ok(!alphaImpact.transitiveUpstreamRefs.includes("alpha"));
  const providerImpact = snapshot.impact.find((item) => item.subjectRef === "provider");
  assert.deepEqual(providerImpact.directDownstreamRefs, ["alpha", "graph-only-capability"]);
  assert.deepEqual(providerImpact.transitiveDownstreamRefs, ["alpha", "graph-only-capability"]);
  assert.ok(!providerImpact.transitiveDownstreamRefs.includes("provider"));
  const graphOnlyImpact = snapshot.impact.find((item) => item.subjectRef === "graph-only-capability");
  assert.deepEqual(graphOnlyImpact.directUpstreamRefs, ["provider"]);
  assert.equal(completion.freshness, "stale");
  assert.equal(completion.observationKey, "evidence:alpha:completion");
  assert.equal(completion.subjectRef, "alpha");
  assert.equal(completion.artifactRef, "projects/alpha/VERIFICATION.md");
  assert.ok(snapshot.evidence.every((item) => item.observedAt && item.observer && item.subjectRef));
  assert.ok(snapshot.warnings.includes("evidence_stale:alpha:completion"));
  assert.ok(snapshot.warnings.includes("document_missing:alpha:docs/MISSING.md"));
  assert.ok(snapshot.warnings.includes("relationship_target_unknown:alpha:missing-provider"));
  assert.ok(!alpha.relationships.some((item) => item.targetRef === "missing-provider"));
  assert.deepEqual(snapshot.violations.find((item) => item.violationType === "document_missing"), {
    id: "violation:document:alpha:2:missing",
    subjectRef: "alpha",
    violationType: "document_missing",
    severity: "warning",
    status: "open",
    ownerRef: "owner-1",
    reason: "document missing: docs/MISSING.md",
    evidenceRefs: ["evidence:alpha:document:2"],
    eventRefs: [],
    source: "workspace.graph.docs_entrypoints",
    detectedAt: new Date("2026-09-13T00:00:00.000Z"),
  });
  const conflictViolation = snapshot.violations.find((item) => item.violationType === "declaration_conflict");
  assert.ok(conflictViolation);
  assert.ok(conflictViolation.evidenceRefs.length > 0);
  assert.deepEqual(conflictViolation.eventRefs, []);
  assert.ok(snapshot.evidence.some((item) => conflictViolation.evidenceRefs.includes(item.id)));

  const graphOnly = snapshot.units.find((unit) => unit.id === "graph-only-capability");
  assert.equal(graphOnly.identityStatus, "partial");
  assert.equal(graphOnly.ownerRef, "unknown");
  assert.equal(graphOnly.health.status, "unknown");
  assert.equal(graphOnly.health.reason, "owner_unresolved");
  assert.ok(snapshot.warnings.includes("owner_unresolved:graph-only-capability"));

  const infraOnly = snapshot.units.find((unit) => unit.id === "infra-only");
  assert.equal(infraOnly.objectType, "infrastructure");
  assert.equal(infraOnly.identityStatus, "partial");
  assert.equal(infraOnly.ownerRef, "infra-owner");
  assert.equal(infraOnly.path, "C:\\Users\\12081\\.openclaw");
  assert.equal(snapshot.evidence.find((item) => item.id === "evidence:infra-only:structure").status, "unknown");
});

test("projects registered health, verify, and remediation declaration coverage", () => {
  const fixture = makeGovernanceFixture();
  const graph = JSON.parse(readFileSync(fixture.graphPath, "utf8"));
  graph.projects.alpha.health = ["test -f package.json"];
  graph.projects.provider.verify = ["test -f package.json"];
  graph.projects["graph-only-capability"].remediation = ["node -e console.log('remediation')"];
  writeFileSync(fixture.graphPath, JSON.stringify(graph));

  const snapshot = buildGovernanceSnapshot({ ...fixture, generatedAt: "2026-09-14T00:00:00.000Z" });
  assert.deepEqual(snapshot.executionCoverage, {
    declaredProjectCount: 3,
    healthDeclaredCount: 1,
    verifyDeclaredCount: 1,
    remediationDeclaredCount: 1,
  });
});

test("recomputes persisted evidence freshness against the snapshot observation time", () => {
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: "/workspace",
    graphPath: "/workspace/workspace.graph.json",
    registry: null,
    resources: [],
    generatedAt: "2026-09-13T00:30:00.000Z",
    evidenceRecords: [{
      id: "evidence:execution:stale",
      observationKey: "execution:alpha:health",
      source: "control-plane.execution",
      evidenceType: "behavioral",
      observedAt: "2026-09-13T00:00:00.000Z",
      observer: "axi-workstation-control-plane",
      confidence: "high",
      expiresAt: "2026-09-13T00:15:00.000Z",
      freshness: "fresh",
      status: "succeeded",
      subjectRef: "alpha",
      artifactRef: null,
    }],
  });
  assert.equal(snapshot.evidence[0].freshness, "stale");
});

test("rolls a failed dependency into a healthy consumer with explainable impact", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-dependency-health-"));
  const providerPath = join(root, "provider");
  const consumerPath = join(root, "consumer");
  mkdirSync(providerPath, { recursive: true });
  mkdirSync(consumerPath, { recursive: true });
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registry: null,
    graph: {
      projects: {
        provider: { path: providerPath, owner: "owner-provider", relationships: [] },
        consumer: { path: consumerPath, owner: "owner-consumer", relationships: [{ targetRef: "provider", relationshipType: "DEPENDS_ON" }] },
      },
    },
    generatedAt: "2026-09-14T00:00:00.000Z",
    evidenceRecords: [{
      id: "evidence:provider:failed",
      source: "runtime.provider",
      evidenceType: "process",
      observedAt: "2026-09-14T00:00:00.000Z",
      observer: "fixture",
      confidence: "high",
      expiresAt: "2026-09-15T00:00:00.000Z",
      freshness: "fresh",
      status: "failed",
      subjectRef: "provider",
      artifactRef: "provider-health",
    }, {
      id: "evidence:consumer:healthy",
      source: "runtime.consumer",
      evidenceType: "process",
      observedAt: "2026-09-14T00:00:00.000Z",
      observer: "fixture",
      confidence: "high",
      expiresAt: "2026-09-15T00:00:00.000Z",
      freshness: "fresh",
      status: "succeeded",
      subjectRef: "consumer",
      artifactRef: "consumer-health",
    }],
  });
  const consumer = snapshot.units.find((unit) => unit.id === "consumer");
  assert.equal(consumer.health.status, "critical");
  assert.equal(consumer.health.reason, "dependency_failed");
  assert.deepEqual(consumer.health.affectedObjectRefs, ["consumer", "provider"]);
});

test("normalizes incomplete persisted evidence to the complete evidence contract", () => {
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: "/workspace",
    graphPath: "/workspace/workspace.graph.json",
    registry: null,
    resources: [],
    generatedAt: "2026-09-14T00:30:00.000Z",
    evidenceRecords: [{ id: "evidence:legacy:incomplete" }],
  });
  assert.deepEqual(snapshot.evidence[0], {
    id: "evidence:legacy:incomplete",
    observationKey: "evidence:legacy:incomplete",
    source: "control-plane.persisted",
    evidenceType: "unknown",
    observedAt: "2026-09-14T00:30:00.000Z",
    observer: "axi-workstation-control-plane",
    confidence: "low",
    expiresAt: null,
    freshness: "unknown",
    status: "unknown",
    subjectRef: "unknown",
    artifactRef: null,
  });
});

test("projects waived risks into an owner-attributed waiver read model", () => {
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: "/workspace",
    graphPath: "/workspace/workspace.graph.json",
    registry: null,
    generatedAt: "2026-09-14T00:30:00.000Z",
    risks: [{
      id: "risk:document-alpha",
      targetRef: "alpha",
      status: "waived",
      ownerRef: "owner-1",
      reason: "Temporary exception approved",
      statusReason: "Waiver approved until replacement is available",
      evidenceRefs: ["evidence:approval:1"],
      detectedAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-14T00:00:00.000Z",
      source: "control-plane.test",
    }, {
      id: "risk:expired-document",
      targetRef: "beta",
      status: "waived",
      ownerRef: "owner-2",
      reason: "Expired exception",
      dueAt: "2026-09-13T00:00:00.000Z",
      detectedAt: "2026-09-12T00:00:00.000Z",
    source: "control-plane.test",
  }],
  });
  assert.deepEqual(snapshot.waivers, [{
    id: "waiver:risk:document-alpha",
    subjectRef: "alpha",
    sourceRiskRef: "risk:document-alpha",
    ownerRef: "owner-1",
    reason: "Waiver approved until replacement is available",
    status: "active",
    evidenceRefs: ["evidence:approval:1"],
    eventRefs: [],
    issuedAt: "2026-09-14T00:00:00.000Z",
    source: "control-plane.test",
  }, {
    id: "waiver:risk:expired-document",
    subjectRef: "beta",
    sourceRiskRef: "risk:expired-document",
    ownerRef: "owner-2",
    reason: "Expired exception",
    status: "expired",
    evidenceRefs: [],
    eventRefs: [],
    issuedAt: "2026-09-12T00:00:00.000Z",
    expiresAt: "2026-09-13T00:00:00.000Z",
    source: "control-plane.test",
  }]);
});

test("associates an active waiver with the affected violation", () => {
  const fixture = makeGovernanceFixture();
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-waiver-events-"));
  writeFileSync(join(cacheDir, "audit.jsonl"), JSON.stringify({
    eventId: "event:waiver:alpha",
    auditKind: "risk.transitioned",
    objectRef: "alpha",
    actorRef: "owner-1",
    status: "waived",
    occurredAt: "2026-09-13T00:00:00.000Z",
  }));
  const snapshot = buildGovernanceSnapshot({
    ...fixture,
    cacheDir,
    generatedAt: "2026-09-13T00:00:00.000Z",
    risks: [{
      id: "risk:alpha-doc",
      targetRef: "alpha",
      status: "waived",
      ownerRef: "owner-1",
      reason: "Temporary exception",
      detectedAt: "2026-09-12T00:00:00.000Z",
      source: "control-plane.test",
    }],
  });
  const violation = snapshot.violations.find((item) => item.violationType === "document_missing");
  assert.equal(violation.status, "waived");
  assert.equal(violation.waiverRef, "waiver:risk:alpha-doc");
  assert.deepEqual(violation.eventRefs, ["event:waiver:alpha"]);
  assert.deepEqual(snapshot.waivers[0].eventRefs, ["event:waiver:alpha"]);
});

test("honors explicit document requirement levels and does not flag optional gaps", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-document-requirements-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "FORBIDDEN.md"), "forbidden fixture\n");
  writeFileSync(join(root, "docs", "STALE.md"), "stale fixture\n");
  utimesSync(join(root, "docs", "STALE.md"), new Date("2026-09-01T00:00:00.000Z"), new Date("2026-09-01T00:00:00.000Z"));
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registry: null,
    graph: {
      projects: {
        alpha: {
          path: root,
          owner: "owner-1",
          document_requirements: [{
            entrypoint: "docs/OPTIONAL.md",
            requirement: "optional",
            requirementSource: "policy:docs-v1",
          }, {
            entrypoint: "docs/FORBIDDEN.md",
            requirement: "forbidden",
            requirementSource: "policy:docs-v1",
          }, {
            entrypoint: "docs/STALE.md",
            requirement: "required",
            freshness_interval: "1m",
            requirementSource: "policy:docs-v1",
          }],
        },
      },
    },
    generatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.deepEqual(snapshot.documents[0], {
    id: "document:alpha:1",
    subjectRef: "alpha",
    ownerRef: "owner-1",
    entrypoint: "docs/OPTIONAL.md",
    path: join(root, "docs/OPTIONAL.md"),
    required: false,
    requirement: "optional",
    requirementSource: "policy:docs-v1",
    status: "missing",
    source: "policy:docs-v1",
    evidenceRef: "evidence:alpha:document:1",
  });
  assert.equal(snapshot.violations.some((item) => item.reason.includes("OPTIONAL.md")), false);
  assert.equal(snapshot.documents[2].status, "stale");
  assert.equal(snapshot.documents[2].freshnessIntervalSeconds, 60);
  assert.equal(snapshot.violations.find((item) => item.violationType === "document_stale")?.subjectRef, "alpha");
  assert.deepEqual(snapshot.violations.find((item) => item.violationType === "document_forbidden_present"), {
    id: "violation:document:alpha:2:present",
    subjectRef: "alpha",
    violationType: "document_forbidden_present",
    severity: "warning",
    status: "open",
    ownerRef: "owner-1",
    reason: "forbidden document present: docs/FORBIDDEN.md",
    evidenceRefs: ["evidence:alpha:document:2"],
    eventRefs: [],
    source: "policy:docs-v1",
    detectedAt: new Date("2026-09-14T00:00:00.000Z"),
  });
});

test("does not apply an expired waiver to a current violation", () => {
  const fixture = makeGovernanceFixture();
  const snapshot = buildGovernanceSnapshot({
    ...fixture,
    generatedAt: "2026-09-14T00:00:00.000Z",
    risks: [{
      id: "risk:expired-alpha-doc",
      targetRef: "alpha",
      status: "waived",
      ownerRef: "owner-1",
      reason: "Expired exception",
      dueAt: "2026-09-13T00:00:00.000Z",
      detectedAt: "2026-09-12T00:00:00.000Z",
      source: "control-plane.test",
    }],
  });
  const violation = snapshot.violations.find((item) => item.violationType === "document_missing");
  assert.equal(violation.status, "open");
  assert.equal(violation.waiverRef, undefined);
});

test("rejects unsupported document freshness duration formats instead of guessing", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-document-duration-"));
  writeFileSync(join(root, "README.md"), "fixture\n");
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registry: null,
    graph: { projects: { alpha: { path: root, owner: "owner-1", document_requirements: [{ entrypoint: "README.md", requirement: "required", freshnessIntervalSeconds: "tomorrow" }] } } },
    generatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.equal(snapshot.documents[0].freshnessIntervalSeconds, undefined);
  assert.equal(snapshot.documents[0].status, "present");
});

test("uses Registry document requirements when Graph has no explicit requirement declaration", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-registry-document-requirements-"));
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registryPath: join(root, "workspace.json"),
    graph: { projects: { alpha: { path: root, owner: "graph-owner" } } },
    registry: {
      projects: [{
        id: "alpha",
        path: root,
        owner: "registry-owner",
        document_requirements: [{ entrypoint: "docs/REGISTRY.md", requirement: "required" }],
      }],
    },
    generatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.equal(snapshot.documents[0].requirementSource, "workspace.registry.document_requirements");
  assert.equal(snapshot.documents[0].source, "workspace.registry.document_requirements");
  assert.equal(snapshot.documents[0].ownerRef, "registry-owner");
});

test("retains Graph and Registry document requirement conflicts while resolving Graph precedence", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-document-requirement-conflict-"));
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registryPath: join(root, "workspace.json"),
    graph: {
      projects: {
        alpha: {
          path: root,
          owner: "graph-owner",
          document_requirements: [{ entrypoint: "docs/SHARED.md", requirement: "optional" }],
        },
      },
    },
    registry: {
      projects: [{
        id: "alpha",
        path: root,
        owner: "registry-owner",
        document_requirements: [{ entrypoint: "docs/SHARED.md", requirement: "required" }],
      }],
    },
    generatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.equal(snapshot.documents[0].requirement, "optional");
  assert.ok(snapshot.warnings.includes("document_requirement_conflict:alpha"));
  assert.deepEqual(snapshot.conflicts.find((conflict) => conflict.field === "document_requirements"), {
    subjectRef: "alpha",
    field: "document_requirements",
    values: [
      { source: "workspace.graph.document_requirements", value: [{ entrypoint: "docs/SHARED.md", requirement: "optional" }] },
      { source: "workspace.registry.document_requirements", value: [{ entrypoint: "docs/SHARED.md", requirement: "required" }] },
    ],
  });
});

test("preserves registry/graph path conflicts instead of silently overwriting them", () => {
  const fixture = makeGovernanceFixture({ conflict: true });
  const snapshot = buildGovernanceSnapshot({
    ...fixture,
    generatedAt: "2026-09-13T00:00:00.000Z",
  });
  const alpha = snapshot.units.find((unit) => unit.id === "alpha");

  assert.equal(alpha.identityStatus, "conflict");
  assert.equal(alpha.health.status, "warning");
  assert.equal(alpha.health.reason, "identity_conflict");
  assert.deepEqual(alpha.health.evidenceRefs, ["evidence:alpha:graph", "evidence:alpha:registry"]);
  assert.equal(alpha.path, fixture.registryProjectPath);
  assert.deepEqual(snapshot.conflicts.filter(({ subjectRef }) => subjectRef === "alpha"), [{
    subjectRef: "alpha",
    field: "path",
    values: [
      { source: "workspace.graph", value: join(fixture.root, "projects", "alpha-graph") },
      { source: "workspace.registry", value: fixture.registryProjectPath },
    ],
  }]);
  assert.ok(snapshot.warnings.includes("identity_conflict:alpha:path"));
});

test("resolves identity fields from the registry while retaining graph conflicts", () => {
  const fixture = makeGovernanceFixture({ graphIdentity: true });
  const snapshot = buildGovernanceSnapshot({
    ...fixture,
    generatedAt: "2026-09-13T00:00:00.000Z",
  });
  const alpha = snapshot.units.find((unit) => unit.id === "alpha");

  assert.equal(alpha.ownerRef, "owner-1");
  assert.equal(alpha.objectType, "project");
  assert.equal(alpha.lifecycle, "active-canonical");
  assert.equal(alpha.sourceOfTruth, fixture.registryPath);
  assert.equal(alpha.identityStatus, "conflict");
  assert.deepEqual(snapshot.conflicts.filter(({ subjectRef }) => subjectRef === "alpha").map(({ field }) => field).sort(), ["objectType", "ownerRef"]);
  assert.ok(snapshot.warnings.includes("identity_conflict:alpha:objectType"));
  assert.ok(snapshot.warnings.includes("identity_conflict:alpha:ownerRef"));
});

test("does not report unconfigured external paths as missing resources", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-optional-resource-"));
  const graphPath = join(root, "workspace.graph.json");
  mkdirSync(dirname(graphPath), { recursive: true });
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "unresolved-capability": { kind: "local-capability-layer" },
    },
  }));
  const snapshot = buildSnapshot({ workspaceRoot: root, graphPath });

  const ccConnect = snapshot.resources.find((resource) => resource.id === "cc-connect");
  const feishu = snapshot.resources.find((resource) => resource.id === "feishu");
  const unresolved = snapshot.resources.find((resource) => resource.id === "unresolved-capability");
  assert.equal(ccConnect.status, "unknown");
  assert.equal(ccConnect.path, undefined);
  assert.equal(feishu.status, "unknown");
  assert.equal(feishu.path, undefined);
  assert.equal(unresolved.status, "unknown");
  assert.ok(snapshot.governance);
  assert.ok(snapshot.governance.warnings.includes("workspace_registry_unavailable"));
});

test("projects configured RBAC source readiness without exposing grant records", () => {
  const fixture = makeGovernanceFixture();
  const grantsPath = join(dirname(fixture.registryPath), "rbac", "grants.json");
  mkdirSync(dirname(grantsPath), { recursive: true });
  writeFileSync(grantsPath, JSON.stringify({
    ownerRef: "axi-workspace-governance",
    version: "workspace-rbac-test-v1",
    grants: [{ id: "grant:one", subjectRef: "user:alice", roleRef: "role:reader", scopeType: "workspace", scopeRef: "workspace", resourceRef: "*", action: "read", effect: "allow", inheritance: "default" }],
  }));
  const registry = JSON.parse(readFileSync(fixture.registryPath, "utf8"));
  registry.settings.rbac = { grants: "rbac/grants.json", ownerRef: "axi-workspace-governance" };
  writeFileSync(fixture.registryPath, JSON.stringify(registry));
  const snapshot = buildGovernanceSnapshot({ ...fixture, registry: undefined, generatedAt: "2026-09-13T00:00:00.000Z" });
  assert.equal(snapshot.authorization.status, "configured");
  assert.equal(snapshot.authorization.source, grantsPath);
  assert.equal(snapshot.authorization.ownerRef, "axi-workspace-governance");
  assert.equal(snapshot.authorization.policyVersion, "workspace-rbac-test-v1");
  assert.equal(snapshot.authorization.grantCount, 1);
  assert.deepEqual(Object.keys(snapshot.authorization).sort(), ["grantCount", "ownerRef", "policyVersion", "source", "status", "warnings"]);
});

test("normalizes the append-only audit ledger into filterable immutable workspace events", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-workspace-events-"));
  writeFileSync(join(cacheDir, "audit.jsonl"), [
    JSON.stringify({
      id: "event-later",
      auditKind: "job_event",
      type: "completed",
      jobId: "job-2",
      actorRef: "agent:worker",
      createdAt: "2026-09-13T02:00:00.000Z",
      correlationId: "corr-2",
      status: "completed",
      policyDecisionRef: "decision:2",
      evidenceRefs: ["evidence:job-2"],
      retentionClass: "legal_hold",
    }),
    JSON.stringify({
      auditKind: "mobile_action",
      projectId: "alpha",
      deviceId: "device-1",
      occurredAt: 1789261200,
      status: "executed",
      handoffCorrelationId: "handoff:alpha",
    }),
    "not-json",
  ].join("\n"));

  const page = readWorkspaceEvents({ cacheDir, limit: 1 });
  assert.equal(page.events.length, 1);
  assert.equal(page.events[0].eventId, "audit:2");
  assert.equal(page.events[0].objectRef, "alpha");
  assert.equal(page.events[0].actorRef, "device-1");
  assert.equal(page.events[0].correlationId, "handoff:alpha");
  assert.equal(page.events[0].immutable, true);
  assert.ok(page.nextCursor);

  const filtered = readWorkspaceEvents({ cacheDir, eventType: "job.completed" });
  assert.equal(filtered.events.length, 1);
  assert.equal(filtered.events[0].policyDecisionRef, "decision:2");
  assert.equal(filtered.events[0].retentionClass, "legal_hold");
  assert.deepEqual(readWorkspaceEvents({ cacheDir, afterEventId: "audit:2" }).events.map((event) => event.eventId), ["event-later"]);
});

test("loads declared Graph event sources when no explicit event source override is supplied", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-declared-event-source-"));
  const eventPath = join(root, "provider-events.jsonl");
  writeFileSync(eventPath, JSON.stringify({ eventId: "event:declared", eventType: "service.health", objectRef: "alpha", actorRef: "service:alpha", occurredAt: "2026-09-14T00:00:00.000Z", result: "healthy" }));
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registry: null,
    graph: { eventSources: [{ path: eventPath, source: "fixture.provider-events" }], projects: { alpha: { owner: "owner-1" } } },
    generatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.deepEqual(snapshot.events.map((event) => event.eventId), ["event:declared"]);
  assert.equal(snapshot.events[0].source, "fixture.provider-events");
});

test("associates policy decisions with matching workspace events", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-policy-events-"));
  const eventPath = join(root, "policy-events.jsonl");
  writeFileSync(eventPath, JSON.stringify({ eventId: "event:policy:1", eventType: "policy.decided", policyDecisionRef: "policy-decision:1", objectRef: "alpha", actorRef: "owner-1", occurredAt: "2026-09-14T00:00:00.000Z", result: "allow" }));
  const snapshot = buildGovernanceSnapshot({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    registry: null,
    graph: { eventSources: [{ path: eventPath, source: "fixture.policy-events" }], projects: {} },
    policyDecisions: [{ id: "policy-decision:1", subjectRef: "owner-1", scopeRef: "workspace", resourceRef: "alpha", action: "read", decision: "allow", reason: "matched grant", matchedGrantRefs: [], policyVersion: "test-v1", correlationId: "corr-1", createdAt: "2026-09-14T00:00:00.000Z", expiresAt: null, evidenceRefs: [], denyPrecedence: true }],
    generatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.deepEqual(snapshot.policyDecisions[0].eventRefs, ["event:policy:1"]);
});

test("normalizes handoff lifecycle events under their handoff id", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-handoff-events-"));
  writeFileSync(join(cacheDir, "audit.jsonl"), [
    JSON.stringify({ auditKind: "handoff_created", handoffId: "handoff_1", approvalRef: "approval_1", occurredAt: 1789250000, status: "handed_off" }),
    JSON.stringify({ auditKind: "handoff_opened", handoffId: "handoff_1", approvalRef: "approval_1", occurredAt: 1789250001, actorRef: "web-owner", status: "opened" }),
  ].join("\n"));

  const events = readWorkspaceEvents({ cacheDir, objectRef: "handoff_1" }).events;
  assert.deepEqual(events.map((event) => event.eventType), ["handoff_created", "handoff_opened"]);
  assert.equal(events[0].objectRef, "handoff_1");
  assert.equal(events[1].actorRef, "web-owner");
});

test("writes a verifiable audit hash segment and marks tampering invalid", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-workspace-event-integrity-"));
  recordMobileAudit({ cacheDir, event: { projectId: "alpha", deviceId: "device-1", status: "previewed" } });
  recordMobileAudit({ cacheDir, event: { projectId: "alpha", deviceId: "device-1", status: "executed" } });

  const verified = readWorkspaceEvents({ cacheDir }).events;
  assert.equal(verified.length, 2);
  assert.deepEqual(verified.map((event) => event.integrity.status), ["verified", "verified"]);
  const first = verified.find((event) => event.result === "previewed");
  const second = verified.find((event) => event.result === "executed");
  assert.equal(second.integrity.previousHash, first.integrity.hash);

  const path = join(cacheDir, "audit.jsonl");
  const records = readFileSync(path, "utf8").trim().split(/\r?\n/u).map((line) => JSON.parse(line));
  records[1].status = "tampered";
  writeFileSync(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
  assert.equal(readWorkspaceEvents({ cacheDir }).events.find((event) => event.result === "tampered").integrity.status, "invalid");
});

test("merges explicitly configured service and deployment ledgers without guessing provider paths", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-workspace-event-sources-"));
  const serviceLedger = join(root, "devsvc-events.jsonl");
  const deploymentLedger = join(root, "deployment-events.jsonl");
  writeFileSync(serviceLedger, `${JSON.stringify({
    eventId: "service-event-1",
    eventType: "service.health.changed",
    actorRef: "service:devsvc-dashboard",
    objectRef: "axi-workbench-api-gateway",
    action: "health_observed",
    occurredAt: "2026-09-13T03:00:00.000Z",
    correlationId: "health-correlation-1",
    result: "healthy",
  })}\n`);
  writeFileSync(deploymentLedger, `${JSON.stringify({
    eventId: "deployment-event-1",
    eventType: "deployment.completed",
    actorRef: "agent:release",
    objectRef: "axi-workbench",
    action: "deploy",
    occurredAt: "2026-09-13T04:00:00.000Z",
    correlationId: "deploy-correlation-1",
    result: "succeeded",
  })}\n`);

  const events = readWorkspaceEvents({
    sources: [
      { path: serviceLedger, source: "devsvc.service-events" },
      { path: deploymentLedger, source: "release.deployment-events" },
    ],
  }).events;
  assert.deepEqual(events.map((event) => event.eventType), ["service.health.changed", "deployment.completed"]);
  assert.deepEqual(events.map((event) => event.source), ["devsvc.service-events", "release.deployment-events"]);
  assert.ok(events.every((event) => event.integrity.status === "unverified"));
});

test("reads only explicitly declared runtime-ledger directories and preserves file provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-runtime-ledger-"));
  writeFileSync(join(root, "2026-09-13.jsonl"), `${JSON.stringify({
    eventId: "runtime-event-1",
    eventType: "service.health.changed",
    actor: "mose",
    objectRef: "axi-workbench-api-gateway",
    action: "health_check",
    occurredAt: "2026-09-13T03:00:00.000Z",
    result: "healthy",
  })}\n`);
  writeFileSync(join(root, "README.txt"), "not an event ledger\n");

  const events = readWorkspaceEvents({ sources: [{ path: root, source: "axi-runtime-ledger" }] }).events;
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, "runtime-event-1");
  assert.equal(events[0].source, "axi-runtime-ledger/2026-09-13.jsonl");
});

test("expands only user-home and environment-variable references in declared event sources", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-runtime-ledger-paths-"));
  writeFileSync(join(root, "events.jsonl"), `${JSON.stringify({ eventId: "path-event-1", eventType: "verify.completed", actorRef: "agent:test", objectRef: "alpha", action: "verify", result: "succeeded" })}\n`);
  const prior = process.env.AXI_TEST_EVENT_ROOT;
  process.env.AXI_TEST_EVENT_ROOT = root;
  try {
    const events = readWorkspaceEvents({ sources: [{ path: "$AXI_TEST_EVENT_ROOT", source: "axi-runtime-ledger" }] }).events;
    assert.equal(events.length, 1);
    assert.equal(events[0].source, "axi-runtime-ledger/events.jsonl");
  } finally {
    if (prior === undefined) delete process.env.AXI_TEST_EVENT_ROOT;
    else process.env.AXI_TEST_EVENT_ROOT = prior;
  }
});

test("preserves runtime identity refs and filters normalized events by surface and project", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-runtime-event-refs-"));
  writeFileSync(join(root, "events.jsonl"), `${JSON.stringify({
    eventId: "runtime-ref-1",
    eventType: "service.health.changed",
    surface: "devsvc",
    projectId: "axi-workbench",
    serviceId: "axi-workbench-api-gateway",
    runId: "run-1",
    actor: "mose",
    objectRef: "axi-workbench-api-gateway",
    action: "health_check",
    result: "healthy",
  })}\n`);
  const options = { sources: [{ path: root, source: "axi-runtime-ledger" }] };
  const event = readWorkspaceEvents(options).events[0];
  assert.deepEqual({ surface: event.surfaceRef, project: event.projectRef, service: event.serviceRef, run: event.runRef }, {
    surface: "devsvc", project: "axi-workbench", service: "axi-workbench-api-gateway", run: "run-1",
  });
  assert.equal(readWorkspaceEvents({ ...options, surfaceRef: "devsvc", projectRef: "axi-workbench" }).events.length, 1);
  assert.equal(readWorkspaceEvents({ ...options, projectRef: "other-project" }).events.length, 0);
});

test("keeps API event pagination bounded while governance snapshots read the full declared source", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-runtime-ledger-pages-"));
  writeFileSync(join(root, "2026-09-13.jsonl"), Array.from({ length: 3 }, (_, index) => JSON.stringify({
    eventId: `runtime-page-${index + 1}`,
    eventType: "verify.completed",
    actorRef: "agent:test",
    objectRef: "alpha",
    action: "verify",
    occurredAt: `2026-09-13T03:0${index}:00.000Z`,
    result: "succeeded",
  })).join("\n") + "\n");

  assert.equal(readWorkspaceEvents({ sources: [{ path: root, source: "axi-runtime-ledger" }], limit: 2 }).events.length, 2);
  assert.equal(readWorkspaceEvents({ sources: [{ path: root, source: "axi-runtime-ledger" }], limit: null }).events.length, 3);
});

test("TASK3: integrates Platform audit source alongside DevSvc runtime-ledger without losing 254 events", () => {
  // TASK3验收：接入至少一个有明确owner和格式合同的Platform事件源
  // 原始runtime-ledger保持不变，新增control-plane audit作为Platform源

  // 1. 创建DevSvc runtime-ledger fixture (模拟原有254条)
  const runtimeRoot = mkdtempSync(join(tmpdir(), "axi-task3-runtime-"));
  writeFileSync(join(runtimeRoot, "2026-09-13.jsonl"), Array.from({ length: 5 }, (_, index) => JSON.stringify({
    eventId: `devsvc-event-${index + 1}`,
    eventType: "service.health.changed",
    surface: "devsvc",
    projectId: "axi-workbench",
    serviceId: "core",
    actor: "mose",
    objectRef: "axi-workbench",
    action: "status",
    result: "ok",
    occurredAt: `2026-09-13T03:0${index}:00.000Z`,
  })).join("\n") + "\n");

  // 2. 创建Platform audit fixture (模拟control-plane audit)
  const platformRoot = mkdtempSync(join(tmpdir(), "axi-task3-platform-"));
  writeFileSync(join(platformRoot, "audit.jsonl"), [
    JSON.stringify({ auditKind: "approval_requested", eventId: "approval-event-1", actorRef: "device-1", objectRef: "ai-capability", occurredAt: 1789280000, status: "pending" }),
    JSON.stringify({ auditKind: "job_event", eventId: "job-event-1", type: "job.completed", actorRef: "agent:test", objectRef: "job-1", occurredAt: 1789280100, status: "completed" }),
  ].join("\n") + "\n");

  // 3. 读取两个源
  const sources = [
    { path: runtimeRoot, source: "axi-runtime-ledger" },
    { path: platformRoot, source: "axi-control-plane-audit" },
  ];

  const events = readWorkspaceEvents({ sources, limit: null }).events;

  // 4. 验证：总事件数 = runtime(5) + platform(2)
  assert.equal(events.length, 7, "Total events should be 7");

  // 5. 验证：DevSvc surface 事件
  const devsvcEvents = events.filter(e => e.surfaceRef === "devsvc");
  assert.equal(devsvcEvents.length, 5, "DevSvc events should be 5");

  // 6. 验证：Platform source 事件（source包含audit.jsonl）
  const platformEvents = events.filter(e => e.source === "axi-control-plane-audit/audit.jsonl");
  assert.equal(platformEvents.length, 2, "Platform audit events should be 2");

  // 7. 验证：project/service/run引用保留
  const devsvcWithRefs = devsvcEvents[0];
  assert.equal(devsvcWithRefs.projectRef, "axi-workbench", "projectRef should be preserved");
  assert.equal(devsvcWithRefs.serviceRef, "core", "serviceRef should be preserved");

  // 8. 验证：Platform事件有actor/object引用
  assert.ok(platformEvents[0]?.actorRef, "Platform event should have actorRef");
  assert.ok(platformEvents[0]?.objectRef, "Platform event should have objectRef");

  // 9. 验证：fail-closed（无效source返回0条）
  const invalidEvents = readWorkspaceEvents({ sources: [{ path: "/nonexistent/audit.jsonl", source: "invalid" }], limit: null }).events;
  assert.equal(invalidEvents.length, 0, "Invalid source should return 0 events");

  // 10. 验证：过滤和分页不回退
  const filteredEvents = readWorkspaceEvents({ sources, surfaceRef: "devsvc", limit: 2 });
  assert.equal(filteredEvents.events.length, 2, "Surface filter should work");
  assert.ok(filteredEvents.nextCursor, "Pagination cursor should be present");

  const allEvents = readWorkspaceEvents({ sources, surfaceRef: "devsvc", limit: null });
  assert.equal(allEvents.events.length, 5, "limit=null should return all filtered events");
});
