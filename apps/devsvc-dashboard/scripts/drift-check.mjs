/**
 * Graph/Config Drift Checker
 * Detects missing static overrides, duplicates, or route conflicts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const workspaceRoot = process.argv[2] || path.resolve(__dirname, "..", "..", "..", "..");
const workbenchRoot = path.resolve(workspaceRoot, "projects", "axi-workbench");
const graphPath = path.join(workspaceRoot, "workspace.graph.json");
const staticResourcesPath = path.join(workbenchRoot, "apps", "devsvc-dashboard", "config", "axi-resources.json");

const graph = readJson(graphPath);
const staticResources = readJson(staticResourcesPath) || [];

if (!graph) {
  console.error("ERROR: workspace.graph.json not found");
  process.exit(1);
}

const graphProjectIds = new Set(Object.keys(graph.projects || {}));
const staticResourceIds = new Set(staticResources.map(r => r.id));

const errors = [];
const warnings = [];

// Check for missing static resources (public projects without visibility config)
for (const [id, project] of Object.entries(graph.projects || {})) {
  const visibility = staticResources.find(r => r.id === id)?.visibility;

  // Skip private/hidden projects
  if (visibility === "hidden" || visibility === "admin") continue;

  // Check for missing menuGroup
  const menuGroup = staticResources.find(r => r.id === id)?.menuGroup;
  if (!menuGroup && project.kind !== "workspace-anchor") {
    warnings.push(`WARN: ${id} has no menuGroup configuration`);
  }
}

// Check for orphaned static resources (in static config but not in graph)
for (const resource of staticResources) {
  if (!graphProjectIds.has(resource.id)) {
    warnings.push(`WARN: ${resource.id} in static config but not in workspace.graph.json`);
  }
}

// Check for route conflicts (only for unique routes)
const routes = new Map();
for (const resource of staticResources) {
  const route = resource.dashboardRoute;
  // Only check routes that are NOT /axi-resources, /apps/*, or /axi-resources/*
  if (route && route !== "/axi-resources" && !route.startsWith("/apps/") && !route.startsWith("/axi-resources/")) {
    if (routes.has(route)) {
      errors.push(`ERROR: Route conflict: ${route} used by both ${routes.get(route)} and ${resource.id}`);
    }
    routes.set(route, resource.id);
  }
}

// Report results
console.log("=== Graph/Config Drift Check ===");
console.log(`Workspace Root: ${workspaceRoot}`);
console.log(`Graph projects: ${graphProjectIds.size}`);
console.log(`Static resources: ${staticResourceIds.size}`);

if (warnings.length > 0) {
  console.log("\nWarnings:");
  warnings.forEach(w => console.log("  " + w));
}

if (errors.length > 0) {
  console.log("\nErrors:");
  errors.forEach(e => console.log("  " + e));
}

if (warnings.length === 0 && errors.length === 0) {
  console.log("\n✅ No drift detected");
}

process.exit(errors.length > 0 ? 1 : 0);
