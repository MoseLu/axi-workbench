import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadWorkspaceResourceRegistry, isStale, getCachedVerification, clearVerificationCache } from "./workspace-resource-registry.mjs";

test("isStale returns true when no cache exists", () => {
  clearVerificationCache();
  assert.equal(isStale("non-existent-resource"), true);
});

test("isStale returns false for fresh cache", async () => {
  clearVerificationCache();
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-stale-test-"));
  const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
  fs.mkdirSync(docsPath, { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({
    projects: {
      "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"], verify: ["echo ok"] }
    }
  }));
  fs.writeFileSync(staticResourcesPath, JSON.stringify([]));

  await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
  assert.equal(isStale("axi-docs"), false);
  clearVerificationCache();
});

test("cache stores and retrieves verification results", async () => {
  clearVerificationCache();
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-cache-test-"));
  const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
  fs.mkdirSync(docsPath, { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({
    projects: {
      "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"], verify: ["echo ok"] }
    }
  }));
  fs.writeFileSync(staticResourcesPath, JSON.stringify([]));

  await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
  const cached = getCachedVerification("axi-docs");
  assert.notEqual(cached, null);
  assert.equal(cached.status, "verified");
  assert.equal(cached.verificationSource, "verified");
  clearVerificationCache();
});

test("forceRefresh bypasses cache and re-runs verification", async () => {
  clearVerificationCache();
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-force-test-"));
  const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
  fs.mkdirSync(docsPath, { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({
    projects: {
      "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"], verify: ["echo ok"] }
    }
  }));
  fs.writeFileSync(staticResourcesPath, JSON.stringify([]));

  // First load - populates cache
  const firstLoad = await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
  assert.equal(firstLoad[0].fromCache, false);

  // Second load without force - should use cache
  const secondLoad = await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
  assert.equal(secondLoad[0].fromCache, true);

  // Third load with forceRefresh - should re-verify
  const thirdLoad = await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true, forceRefresh: true } });
  assert.equal(thirdLoad[0].fromCache, false);
  clearVerificationCache();
});

test("workspace graph projects are retained while static entries provide dashboard overrides", async () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-resource-registry-"));
  const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
  const rulesPath = path.join(workspaceRoot, "projects", "axi-rules");
  fs.mkdirSync(docsPath, { recursive: true });
  fs.mkdirSync(rulesPath, { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({
    projects: {
      "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"], verify: ["echo ok"] },
      "axi-rules": { name: "Axi Rules", path: rulesPath, kind: "shared-rule-index", provides: ["workspace-rule-index"] },
      "story-graph": { name: "Story Graph", path: path.join(workspaceRoot, "products", "story-graph"), kind: "product", provides: ["story"] }
    }
  }));
  fs.writeFileSync(staticResourcesPath, JSON.stringify([
    {
      id: "axi-docs",
      surface: "hosted-app",
      dashboardRoute: "/apps/axi-docs/",
      capabilities: ["search"]
    },
    {
      id: "static-tool",
      title: "Static Tool",
      kind: "tool",
      ownerPath: "${workspaceRoot}/tools/static-tool",
      capabilities: ["tool"]
    }
  ]));

  const resources = await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath });
  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  assert.equal(resources.length, 4);
  assert.equal(byId.get("axi-docs")?.surface, "hosted-app");
  assert.equal(byId.get("axi-docs")?.dashboardRoute, "/apps/axi-docs/");
  assert.deepEqual(byId.get("axi-docs")?.capabilities, ["docs-hub", "search"]);
  // axiom-docs has verify commands and path exists - should be verified after running echo ok
  assert.equal(byId.get("axi-docs")?.status, "verified");
  assert.equal(byId.get("axi-rules")?.dashboardRoute, "/axi-resources/axi-rules");
  assert.equal(byId.get("story-graph")?.status, "missing");
  assert.equal(byId.get("static-tool")?.ownerPath, path.join(workspaceRoot, "tools", "static-tool"));
});

// ---------------------------------------------------------------------------
// Relative graph paths (GOV-AUDIT-005 path-compat)
//
// workspace.graph.json stores most `projects[*].path` values as
// workspace-root-relative strings ("foundation/axi-kernel"). Those MUST be
// resolved against `workspaceRoot`, not against the process cwd — otherwise
// every relative-path project silently degrades to `missing` whenever the
// dashboard is started from a directory other than the workspace root.
// ---------------------------------------------------------------------------

test("relative graph project path resolves against workspaceRoot, not cwd", async () => {
  clearVerificationCache();
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-rel-graph-"));
  fs.mkdirSync(path.join(workspaceRoot, "foundation", "axi-kernel"), { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({
    projects: {
      // RELATIVE on purpose — the canonical workspace.graph.json form.
      "axi-kernel": { name: "Axi Kernel", path: "foundation/axi-kernel", kind: "axi-app", provides: ["kernel"] },
      "axi-apps": { name: "Axi Apps", path: "foundation/axi-apps", kind: "axi-app", provides: ["apps"] }
    }
  }));
  fs.writeFileSync(staticResourcesPath, JSON.stringify([]));

  // Run from an unrelated cwd so a cwd-relative lookup cannot succeed by luck.
  const originalCwd = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const resources = await loadWorkspaceResourceRegistry({
      workspaceRoot,
      graphPath,
      staticResourcesPath,
      cacheOptions: { enabled: false, forceRefresh: true }
    });
    const byId = new Map(resources.map((resource) => [resource.id, resource]));

    // Absolute resolution against workspaceRoot.
    assert.equal(
      byId.get("axi-kernel")?.ownerPath,
      path.join(workspaceRoot, "foundation", "axi-kernel")
    );
    assert.equal(byId.get("axi-kernel")?.ownerPathExists, true);
    assert.notEqual(byId.get("axi-kernel")?.status, "missing");

    // A genuinely absent relative path must still report `missing`.
    assert.equal(byId.get("axi-apps")?.ownerPathExists, false);
    assert.equal(byId.get("axi-apps")?.status, "missing");
  } finally {
    process.chdir(originalCwd);
    clearVerificationCache();
  }
});

test("relative static ownerPath and ${workspaceRoot} token forms both resolve", async () => {
  clearVerificationCache();
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-rel-static-"));
  fs.mkdirSync(path.join(workspaceRoot, "tools", "rel-tool"), { recursive: true });
  fs.mkdirSync(path.join(workspaceRoot, "tools", "token-tool"), { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  fs.writeFileSync(staticResourcesPath, JSON.stringify([
    { id: "rel-tool", title: "Rel Tool", kind: "tool", ownerPath: "tools/rel-tool" },
    { id: "token-tool", title: "Token Tool", kind: "tool", ownerPath: "${workspaceRoot}/tools/token-tool" },
    { id: "abs-tool", title: "Abs Tool", kind: "tool", ownerPath: path.join(workspaceRoot, "tools", "abs-tool") }
  ]));

  const originalCwd = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const resources = await loadWorkspaceResourceRegistry({
      workspaceRoot,
      graphPath,
      staticResourcesPath,
      cacheOptions: { enabled: false, forceRefresh: true }
    });
    const byId = new Map(resources.map((resource) => [resource.id, resource]));

    assert.equal(byId.get("rel-tool")?.ownerPath, path.join(workspaceRoot, "tools", "rel-tool"));
    assert.equal(byId.get("rel-tool")?.ownerPathExists, true);
    assert.equal(byId.get("token-tool")?.ownerPath, path.join(workspaceRoot, "tools", "token-tool"));
    assert.equal(byId.get("token-tool")?.ownerPathExists, true);
    assert.equal(byId.get("abs-tool")?.ownerPath, path.join(workspaceRoot, "tools", "abs-tool"));
    assert.equal(byId.get("abs-tool")?.ownerPathExists, false);
  } finally {
    process.chdir(originalCwd);
    clearVerificationCache();
  }
});
