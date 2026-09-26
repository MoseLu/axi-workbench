/**
 * Graph/Config Drift Checker
 * Detects missing static overrides, duplicates, or route conflicts
 *
 * Usage:
 *   node scripts/drift-check.mjs                       # auto-detect workspace root
 *   node scripts/drift-check.mjs /Volumes/code/workspace  # explicit workspace root
 *   WORKSPACE_ROOT=/Volumes/code/workspace node scripts/drift-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Resolve the Axi workspace root from explicit arg, env, or by walking up
 * the filesystem looking for `workspace.graph.json`. This makes the script
 * usable both from the devsvc-dashboard package and from CI scripts that
 * do not pass an explicit argument.
 */
function resolveWorkspaceRoot() {
  const explicit = process.argv[2] || process.env.WORKSPACE_ROOT;
  if (explicit) {
    return path.resolve(explicit);
  }

  // Walk up from the script location until we find workspace.graph.json
  let cursor = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(cursor, "workspace.graph.json"))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  // Fallback: 5 levels up from this script (apps/devsvc-dashboard/scripts -> workspace root)
  return path.resolve(__dirname, "..", "..", "..", "..", "..");
}

const workspaceRoot = resolveWorkspaceRoot();
// ADR-008 path migration: the Axi Workbench monorepo lives under
// `workbench/axi-workbench`, not the legacy `projects/axi-workbench`. Older
// git checkouts may still have the legacy layout; try both so the drift
// check keeps working during the cut-over window.
const legacyWorkbenchRoot = path.resolve(workspaceRoot, "projects", "axi-workbench");
const workbenchRoot = path.resolve(workspaceRoot, "workbench", "axi-workbench");
const resolvedWorkbenchRoot = fs.existsSync(path.join(workbenchRoot, "apps", "devsvc-dashboard", "config", "axi-resources.json"))
  ? workbenchRoot
  : fs.existsSync(path.join(legacyWorkbenchRoot, "apps", "devsvc-dashboard", "config", "axi-resources.json"))
    ? legacyWorkbenchRoot
    : workbenchRoot;
const graphPath = path.join(workspaceRoot, "workspace.graph.json");
const staticResourcesPath = path.join(resolvedWorkbenchRoot, "apps", "devsvc-dashboard", "config", "axi-resources.json");

const graph = readJson(graphPath);
const staticResources = readJson(staticResourcesPath) || [];

if (!graph) {
  console.error(`ERROR: workspace.graph.json not found at ${graphPath}`);
  console.error("Hint: pass the workspace root explicitly, e.g.");
  console.error("    node scripts/drift-check.mjs /Volumes/code/workspace");
  console.error("or set the WORKSPACE_ROOT environment variable.");
  process.exit(1);
}

const graphProjectIds = new Set(Object.keys(graph.projects || {}));
const staticResourceIds = new Set(staticResources.map(r => r.id));

const errors = [];
const warnings = [];

// Projects that intentionally have no user-facing menu entry. These are
// platform-level / non-runtime services whose visibility is documented in
// AGENTS.md (axi-kernel is the data plane, axi-runtime is the control plane
// runtime, observability is the metrics stack, etc.). The dashboard has
// nothing to render for them, so the missing-menuGroup warning is suppressed.
const NO_DASHBOARD_MENU_PROJECT_IDS = new Set([
  "pelagic",
  "voice-assistant-on-device-speech-recognition",
  "axi-workbench-cli",
  "axi-kernel",
  "axi-inbox",
  "axi-sync",
  "axi-runtime",
  "axi-apps",
  "observability"
]);

// Check for missing static resources (public projects without visibility config)
for (const [id, project] of Object.entries(graph.projects || {})) {
  const visibility = staticResources.find(r => r.id === id)?.visibility;

  // Skip private/hidden projects
  if (visibility === "hidden" || visibility === "admin") continue;

  // Skip platform / non-runtime services that intentionally have no UI entry.
  if (NO_DASHBOARD_MENU_PROJECT_IDS.has(id)) continue;

  // Check for missing menuGroup
  const menuGroup = staticResources.find(r => r.id === id)?.menuGroup;
  if (!menuGroup && project.kind !== "workspace-anchor") {
    warnings.push(`WARN: ${id} has no menuGroup configuration`);
  }
}

// Check for orphaned static resources (in static config but not in graph)
const ORPHAN_STATIC_RESOURCE_WHITELIST = new Set([
  "axi-docs", // absorbed into axi-workbench per ADR-008
  "axi-tauri-starter", // template scaffold, not a registered project
  "axi-pet", // legacy alias, superseded by axi-pet-desktop
  "axi-artboard", // lives inside axi-workbench as apps/axi-artboard, no separate graph entry
  "ai-resource-orchestration", // misnamed historical entry, replaced by axi-resource-orchestration
  "cliproxyapi", // legacy project, not currently registered
  "axi-proxy-companion" // legacy project, not currently registered
]);
for (const resource of staticResources) {
  if (!graphProjectIds.has(resource.id) && !ORPHAN_STATIC_RESOURCE_WHITELIST.has(resource.id)) {
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
  console.log("\n0 warnings, 0 errors");
  console.log("✅ No drift detected");
} else {
  console.log(`\n${warnings.length} warnings, ${errors.length} errors`);
}

process.exit(errors.length > 0 ? 1 : 0);
