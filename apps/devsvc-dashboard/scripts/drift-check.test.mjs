import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "drift-check.mjs");

/**
 * Helper that runs drift-check.mjs as a child process and returns
 * { status, stdout, stderr }. We spawn a fresh Node process because
 * the script reads from a constant module-level location and exits
 * the process on completion.
 */
function runDriftCheck(args = [], env = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

const REAL_WORKSPACE = "/Volumes/code/workspace";

test("default entry point (no args) succeeds and reports 0 warnings", () => {
  // Make sure no WORKSPACE_ROOT is leaking in from the test harness.
  const result = runDriftCheck([], { WORKSPACE_ROOT: "" });
  assert.equal(result.status, 0, `drift-check exit was ${result.status}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /Workspace Root: /u);
  assert.match(result.stdout, /0 warnings, 0 errors/u);
  assert.match(result.stdout, /✅ No drift detected/u);
});

test("default entry point auto-locates the workspace root", () => {
  const result = runDriftCheck([], { WORKSPACE_ROOT: "" });
  assert.equal(result.status, 0, result.stderr);
  // When invoked from the devsvc-dashboard package, the resolved root
  // should be the real workspace root regardless of CWD.
  assert.ok(
    result.stdout.includes(`Workspace Root: ${REAL_WORKSPACE}`),
    `expected stdout to mention ${REAL_WORKSPACE}\nstdout:\n${result.stdout}`
  );
});

test("explicit workspace root argument still works", () => {
  const result = runDriftCheck([REAL_WORKSPACE], { WORKSPACE_ROOT: "" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Workspace Root: ${REAL_WORKSPACE}`));
  assert.match(result.stdout, /0 warnings, 0 errors/u);
});

test("WORKSPACE_ROOT environment variable is honored", () => {
  const result = runDriftCheck([], { WORKSPACE_ROOT: REAL_WORKSPACE });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Workspace Root: ${REAL_WORKSPACE}`));
});

test("missing workspace.graph.json produces a clear error and non-zero exit", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-drift-empty-"));
  const result = runDriftCheck([tmpRoot]);
  assert.notEqual(result.status, 0, "expected non-zero exit when graph is missing");
  assert.match(result.stderr, /workspace\.graph\.json not found/u);
  // The error message must explain how to fix the situation so the next
  // developer is not left guessing.
  assert.match(result.stderr, /Hint:/u);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("workspace root that contains a graph but no workbench project still runs", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-drift-partial-"));
  // The graph includes the project, and we mirror it in the workbench
  // static resources with a menuGroup so the missing-menuGroup warning
  // is not raised. The point of this test is to confirm the script does
  // not crash when the rest of the workspace is absent.
  fs.writeFileSync(
    path.join(tmpRoot, "workspace.graph.json"),
    JSON.stringify({ projects: { "sample-project": { name: "Sample", kind: "axi-rules" } } })
  );
  const workbenchRoot = path.join(tmpRoot, "projects", "axi-workbench");
  const staticDir = path.join(workbenchRoot, "apps", "devsvc-dashboard", "config");
  fs.mkdirSync(staticDir, { recursive: true });
  fs.writeFileSync(
    path.join(staticDir, "axi-resources.json"),
    JSON.stringify([
      { id: "sample-project", dashboardRoute: "/sample", menuGroup: "components" }
    ])
  );

  const result = runDriftCheck([tmpRoot]);
  assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
  assert.match(result.stdout, /Graph projects: 1/u);
  assert.match(result.stdout, /Static resources: 1/u);
  assert.match(result.stdout, /0 warnings, 0 errors/u);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("missing menuGroup surfaces as a warning but still exits 0", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-drift-warn-"));
  fs.writeFileSync(
    path.join(tmpRoot, "workspace.graph.json"),
    JSON.stringify({
      projects: {
        "sample-project": { name: "Sample", kind: "axi-rules" }
      }
    })
  );
  // Add the workbench-shaped static resources path so the script can read
  // the static override file as well.
  const workbenchRoot = path.join(tmpRoot, "projects", "axi-workbench");
  const staticDir = path.join(workbenchRoot, "apps", "devsvc-dashboard", "config");
  fs.mkdirSync(staticDir, { recursive: true });
  fs.writeFileSync(
    path.join(staticDir, "axi-resources.json"),
    JSON.stringify([
      { id: "sample-project", dashboardRoute: "/sample" }
    ])
  );
  const result = runDriftCheck([tmpRoot]);
  assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
  assert.match(result.stdout, /WARN: sample-project has no menuGroup/u);
  assert.match(result.stdout, /1 warnings, 0 errors/u);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
