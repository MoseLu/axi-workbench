import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createControlPlane } from "./test-control-plane.mjs";
import { DEFAULT_SLA, SCENARIO_SLA, getScenarioSla } from "../src/control-plane.mjs";

// P3-12: Tests for scenario-based SLA configuration

test("DEFAULT_SLA has all required priority levels", () => {
  assert.ok(DEFAULT_SLA, "DEFAULT_SLA should be exported");
  assert.equal(DEFAULT_SLA.standard, 24 * 60 * 60 * 1000, "standard should be 24h");
  assert.equal(DEFAULT_SLA.urgent, 60 * 60 * 1000, "urgent should be 1h");
  assert.equal(DEFAULT_SLA.lowPriority, 72 * 60 * 60 * 1000, "lowPriority should be 72h");
});

test("SCENARIO_SLA has all required scenario types", () => {
  assert.ok(SCENARIO_SLA, "SCENARIO_SLA should be exported");
  assert.ok(SCENARIO_SLA.approval, "approval scenario should exist");
  assert.ok(SCENARIO_SLA.alert, "alert scenario should exist");
  assert.ok(SCENARIO_SLA.task, "task scenario should exist");
  assert.ok(SCENARIO_SLA.project, "project scenario should exist");
});

test("SCENARIO_SLA approval has correct urgent expiry (1h)", () => {
  assert.equal(SCENARIO_SLA.approval.expiryMs, 60 * 60 * 1000, "approval should be 1h");
  assert.equal(SCENARIO_SLA.approval.label, "urgent", "approval label should be urgent");
});

test("SCENARIO_SLA alert has correct urgent expiry (15min)", () => {
  assert.equal(SCENARIO_SLA.alert.expiryMs, 15 * 60 * 1000, "alert should be 15min");
  assert.equal(SCENARIO_SLA.alert.label, "urgent", "alert label should be urgent");
});

test("SCENARIO_SLA task has correct standard expiry (24h)", () => {
  assert.equal(SCENARIO_SLA.task.expiryMs, 24 * 60 * 60 * 1000, "task should be 24h");
  assert.equal(SCENARIO_SLA.task.label, "standard", "task label should be standard");
});

test("SCENARIO_SLA project has correct lowPriority expiry (72h)", () => {
  assert.equal(SCENARIO_SLA.project.expiryMs, 72 * 60 * 60 * 1000, "project should be 72h");
  assert.equal(SCENARIO_SLA.project.label, "lowPriority", "project label should be lowPriority");
});

test("getScenarioSla returns correct SLA for known scenarios", () => {
  const approvalSla = getScenarioSla("approval");
  assert.equal(approvalSla.expiryMs, 60 * 60 * 1000);
  assert.equal(approvalSla.label, "urgent");

  const alertSla = getScenarioSla("alert");
  assert.equal(alertSla.expiryMs, 15 * 60 * 1000);
  assert.equal(alertSla.label, "urgent");

  const taskSla = getScenarioSla("task");
  assert.equal(taskSla.expiryMs, 24 * 60 * 60 * 1000);
  assert.equal(taskSla.label, "standard");

  const projectSla = getScenarioSla("project");
  assert.equal(projectSla.expiryMs, 72 * 60 * 60 * 1000);
  assert.equal(projectSla.label, "lowPriority");
});

test("getScenarioSla falls back to standard SLA for unknown scenarios", () => {
  const unknownSla = getScenarioSla("unknown");
  assert.equal(unknownSla.expiryMs, DEFAULT_SLA.standard);
  assert.equal(unknownSla.label, "standard");

  const emptySla = getScenarioSla("");
  assert.equal(emptySla.expiryMs, DEFAULT_SLA.standard);
  assert.equal(emptySla.label, "standard");

  const nullSla = getScenarioSla(null);
  assert.equal(nullSla.expiryMs, DEFAULT_SLA.standard);
  assert.equal(nullSla.label, "standard");

  const undefinedSla = getScenarioSla(undefined);
  assert.equal(undefinedSla.expiryMs, DEFAULT_SLA.standard);
  assert.equal(undefinedSla.label, "standard");
});

test("handoffExpiry surface property exposes duration and default", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-sla-test-"));
  mkdirSync(join(root, "ielts-vocab"), { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({ projects: {}, profiles: {} }));
  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir: join(root, ".cache") });
  assert.ok(controlPlane.handoffExpiry, "handoffExpiry should be exposed");
  assert.ok(controlPlane.handoffExpiry.durationMs, "durationMs should be set");
  assert.ok(controlPlane.handoffExpiry.defaultDurationMs, "defaultDurationMs should be set");
  assert.equal(controlPlane.handoffExpiry.defaultDurationMs, 24 * 60 * 60 * 1000, "default should be 24h");
});

test("scenario-based SLA correctly maps urgent/standard/lowPriority labels to expiry times", () => {
  // Verify urgent scenarios use shorter expiry
  const urgentSla = getScenarioSla("approval");
  assert.ok(urgentSla.expiryMs <= 60 * 60 * 1000, "urgent should be <= 1h");

  // Verify standard scenarios use medium expiry
  const standardSla = getScenarioSla("task");
  assert.equal(standardSla.expiryMs, 24 * 60 * 60 * 1000, "standard should be 24h");

  // Verify low priority scenarios use longer expiry
  const lowPrioritySla = getScenarioSla("project");
  assert.equal(lowPrioritySla.expiryMs, 72 * 60 * 60 * 1000, "lowPriority should be 72h");

  // Verify urgent < standard < lowPriority
  assert.ok(urgentSla.expiryMs < standardSla.expiryMs, "urgent < standard");
  assert.ok(standardSla.expiryMs < lowPrioritySla.expiryMs, "standard < lowPriority");

  // Verify label assignment
  assert.equal(urgentSla.label, "urgent", "urgent label");
  assert.equal(standardSla.label, "standard", "standard label");
  assert.equal(lowPrioritySla.label, "lowPriority", "lowPriority label");
});

test("control plane uses environment variable override for handoff expiry (AXI_HANDOFF_EXPIRY_MS)", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-sla-env-test-"));
  const cacheDir = join(root, ".cache");
  mkdirSync(join(root, "ielts-vocab"), { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({ projects: {}, profiles: {} }));

  // Test with environment variable override (15 minutes = 900000ms)
  const originalEnv = process.env.AXI_HANDOFF_EXPIRY_MS;
  process.env.AXI_HANDOFF_EXPIRY_MS = "900000";

  const controlPlane = createControlPlane({ workspaceRoot: root, cacheDir });

  // Verify the override is used
  assert.equal(controlPlane.handoffExpiry.durationMs, 15 * 60 * 1000, "durationMs should be overridden to 15min");

  // Restore original env
  if (originalEnv !== undefined) {
    process.env.AXI_HANDOFF_EXPIRY_MS = originalEnv;
  } else {
    delete process.env.AXI_HANDOFF_EXPIRY_MS;
  }
});

test("control plane uses programmatic override for handoff expiry", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-sla-override-test-"));
  const cacheDir = join(root, ".cache");
  mkdirSync(join(root, "ielts-vocab"), { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({ projects: {}, profiles: {} }));

  // Test with programmatic override (30 minutes = 1800000ms)
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir,
    handoffExpiryMs: 30 * 60 * 1000, // 30 minutes
  });

  // Verify the override is used
  assert.equal(controlPlane.handoffExpiry.durationMs, 30 * 60 * 1000, "durationMs should be overridden to 30min");
});
