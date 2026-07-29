import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMobileWorkspaceSnapshot } from "../src/control-plane.mjs";

test("mobile workspace projection includes health, progress, attention and redacted configuration", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-mobile-intelligence-"));
  const projectPath = join(workspaceRoot, "projects", "sample-app");
  mkdirSync(projectPath, { recursive: true });
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "sample-app": {
        name: "Sample App",
        kind: "android-app",
        path: projectPath,
        runtime: "JDK 17",
        packageManager: "Gradle",
        apiKey: "must-not-leak",
        provides: ["mobile-client", "project-intelligence"],
        consumes: ["axi-workbench"],
        contracts: ["README.md"],
      },
    },
    profiles: {
      "sample-debug": {
        projectId: "sample-app",
      },
    },
  }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({
    projects: [{
      id: "sample-app",
      stage: "building",
      confidence: "medium",
      summary: "Project intelligence is under construction.",
      updatedAt: new Date().toISOString(),
      evidence: ["unit:test", "android:assemble"],
      remaining: ["device verification"],
      handoff: { status: "ready" },
    }],
  }));

  const snapshot = buildMobileWorkspaceSnapshot({ workspaceRoot, graphPath });
  assert.equal(snapshot.summary.total, 1);
  assert.equal(snapshot.summary.healthy, 1);
  assert.deepEqual(snapshot.attentionItems, []);

  const project = snapshot.projects[0];
  assert.equal(project.health, "healthy");
  assert.deepEqual(project.capabilities, ["mobile-client", "project-intelligence"]);
  assert.equal(project.progress.stage, "building");
  assert.equal(project.progress.evidenceCount, 2);
  assert.deepEqual(project.progress.remaining, ["device verification"]);
  assert.equal(project.configuration[0].facts.find((fact) => fact.key === "path").value, "projects/sample-app");
  assert.equal(project.configuration[2].facts.find((fact) => fact.key === "profiles").value, "sample-debug");
  assert.doesNotMatch(JSON.stringify(project.configuration), /must-not-leak/);
});

test("stale or unready projects become attention items without inventing progress", () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-mobile-attention-"));
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(join(workspaceRoot, "projects", "stale-app"), { recursive: true });
  mkdirSync(join(workspaceRoot, "projects", "unknown-app"), { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "stale-app": {
        name: "Stale App",
        kind: "web-app",
        path: join(workspaceRoot, "projects", "stale-app"),
        provides: [],
      },
      "unknown-app": {
        name: "Unknown App",
        kind: "service",
        path: join(workspaceRoot, "projects", "unknown-app"),
      },
    },
  }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({
    projects: [{
      id: "stale-app",
      stage: "usable",
      confidence: "medium",
      summary: "Old evidence.",
      updatedAt: "2025-01-01",
      evidence: [],
      remaining: [],
      handoff: { status: "stale" },
    }],
  }));

  const snapshot = buildMobileWorkspaceSnapshot({ workspaceRoot, graphPath });
  const stale = snapshot.projects.find((project) => project.id === "stale-app");
  const unknown = snapshot.projects.find((project) => project.id === "unknown-app");
  assert.equal(stale.health, "stale");
  assert.equal(unknown.health, "unknown");
  assert.equal(unknown.progress.stage, "unknown");
  assert.equal(snapshot.attentionItems[0].type, "verification_stale");
});
