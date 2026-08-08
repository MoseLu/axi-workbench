import fs from "node:fs";
import path from "node:path";

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveWorkspaceValue(value, workspaceRoot) {
  return String(value || "").replaceAll("${workspaceRoot}", workspaceRoot);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function defaultDashboardRoute(id) {
  return `/axi-resources/${encodeURIComponent(id)}`;
}

function graphResource({ id, project, workspaceRoot }) {
  const ownerPath = resolveWorkspaceValue(project.path, workspaceRoot);
  const kind = project.kind || "workspace-resource";

  return {
    id,
    title: project.name || id,
    kind,
    surface: "resource-index",
    status: ownerPath && fs.existsSync(ownerPath) ? "active" : "missing",
    ownerPath,
    dashboardRoute: defaultDashboardRoute(id),
    capabilities: unique(project.provides || []),
    notes: `Registered workspace project (${kind}).`
  };
}

function mergeResource(base, override, workspaceRoot) {
  const merged = {
    ...base,
    ...override,
    ownerPath: resolveWorkspaceValue(override.ownerPath ?? base.ownerPath, workspaceRoot),
    capabilities: unique([...(base.capabilities || []), ...(override.capabilities || [])])
  };

  return {
    ...merged,
    ownerPathExists: Boolean(merged.ownerPath) && fs.existsSync(merged.ownerPath)
  };
}

/**
 * Creates the dashboard resource index from the authoritative workspace graph.
 * Static dashboard entries are presentation overrides only: they can supply a
 * hosted route, icon-oriented title, or capability labels, but cannot hide a
 * graph-registered project from the resource index.
 */
export function loadWorkspaceResourceRegistry({
  workspaceRoot,
  graphPath = path.join(workspaceRoot, "workspace.graph.json"),
  staticResourcesPath = path.join(workspaceRoot, "projects", "axi-workbench", "apps", "devsvc-dashboard", "config", "axi-resources.json")
} = {}) {
  if (!workspaceRoot) throw new Error("workspaceRoot is required");

  const graph = readJson(graphPath, { projects: {} });
  const staticResources = readJson(staticResourcesPath, []);
  const staticById = new Map(staticResources.map((resource) => [resource.id, resource]));
  const resources = [];

  for (const [id, project] of Object.entries(graph.projects || {})) {
    resources.push(mergeResource(graphResource({ id, project, workspaceRoot }), staticById.get(id) || {}, workspaceRoot));
    staticById.delete(id);
  }

  for (const [id, resource] of staticById) {
    resources.push(mergeResource({
      id,
      title: resource.title || id,
      kind: resource.kind || "workspace-resource",
      surface: "resource-index",
      status: "missing",
      ownerPath: "",
      dashboardRoute: defaultDashboardRoute(id),
      capabilities: [],
      notes: ""
    }, resource, workspaceRoot));
  }

  return resources.sort((left, right) => left.title.localeCompare(right.title, "en"));
}
