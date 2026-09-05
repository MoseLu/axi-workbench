import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadWorkspaceResourceRegistry } from "./workspace-resource-registry.mjs";

test("workspace graph projects are retained while static entries provide dashboard overrides", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axi-resource-registry-"));
  const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
  const rulesPath = path.join(workspaceRoot, "projects", "axi-rules");
  fs.mkdirSync(docsPath, { recursive: true });
  fs.mkdirSync(rulesPath, { recursive: true });

  const graphPath = path.join(workspaceRoot, "workspace.graph.json");
  const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
  fs.writeFileSync(graphPath, JSON.stringify({
    projects: {
      "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"] },
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

  const resources = loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath });
  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  assert.equal(resources.length, 4);
  assert.equal(byId.get("axi-docs")?.surface, "hosted-app");
  assert.equal(byId.get("axi-docs")?.dashboardRoute, "/apps/axi-docs/");
  assert.deepEqual(byId.get("axi-docs")?.capabilities, ["docs-hub", "search"]);
  assert.equal(byId.get("axi-rules")?.status, "active");
  assert.equal(byId.get("axi-rules")?.dashboardRoute, "/axi-resources/axi-rules");
  assert.equal(byId.get("story-graph")?.status, "missing");
  assert.equal(byId.get("static-tool")?.ownerPath, path.join(workspaceRoot, "tools", "static-tool"));
});
