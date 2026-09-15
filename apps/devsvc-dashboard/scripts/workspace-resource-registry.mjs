import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  getPersistentCacheDir,
  loadPersistentVerification,
  savePersistentVerification,
  loadAllPersistentVerifications
} from "./verification-persistence.mjs";

// Verification cache: key = resourceId, value = cached verification result.
// Two-tier design:
//   1. Persistent tier — JSON files under .cache/verification/, survives restart.
//   2. In-memory tier  — fast-path Map populated from the persistent tier on
//                        startup and updated as verifications run.
// A record's provenance is recorded in `cacheSource` ("persistent" | "in-memory"
// | "none") so the API can distinguish a fresh restart (in-memory cache empty
// but persistent cache hit) from a warm cache (both tiers hit).
const verificationCache = new Map();
const verificationCacheSource = new Map();

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Module-level persistent cache directory; set on first call to
// loadWorkspaceResourceRegistry so the in-memory and persistent tiers share
// one workspace-aware directory.
let persistentCacheDir = null;

function recordCacheSource(resourceId, source) {
  verificationCacheSource.set(resourceId, source);
}

/**
 * Check if a cached verification result is stale (older than 24 hours).
 * @param {string} resourceId - The resource identifier
 * @returns {boolean} - True if no cache exists or cache is older than 24 hours
 */
export function isStale(resourceId) {
  const cached = verificationCache.get(resourceId);
  if (!cached) return true;

  const cachedAt = new Date(cached.lastVerifiedAt).getTime();
  const now = Date.now();
  return (now - cachedAt) > CACHE_TTL_MS;
}

/**
 * Get cached verification result for a resource.
 * @param {string} resourceId - The resource identifier
 * @returns {object|null} - Cached result or null if not cached
 */
export function getCachedVerification(resourceId) {
  return verificationCache.get(resourceId) || null;
}

/**
 * Return which tier served the cached result for a resource:
 *   - "persistent" — loaded from disk this session (typical after restart),
 *   - "in-memory"  — written during this process,
 *   - "none"       — no cached record.
 * @param {string} resourceId
 * @returns {"persistent"|"in-memory"|"none"}
 */
export function getCacheSource(resourceId) {
  return verificationCacheSource.get(resourceId) || "none";
}

/**
 * Clear verification cache for a specific resource or all resources.
 * Also removes the matching persistent file so the cleared state survives
 * a restart.
 *
 * @param {string|null} resourceId - Optional resource ID to clear, or null to clear all
 */
export function clearVerificationCache(resourceId = null) {
  if (resourceId) {
    verificationCache.delete(resourceId);
    verificationCacheSource.delete(resourceId);
    if (persistentCacheDir) {
      try {
        const filePath = path.join(
          persistentCacheDir,
          `${String(resourceId).replaceAll(/[^A-Za-z0-9_-]/g, "_")}.json`
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // best-effort
      }
    }
  } else {
    verificationCache.clear();
    verificationCacheSource.clear();
    if (persistentCacheDir) {
      try {
        for (const entry of fs.readdirSync(persistentCacheDir)) {
          if (entry.endsWith(".json")) {
            fs.unlinkSync(path.join(persistentCacheDir, entry));
          }
        }
      } catch {
        // best-effort
      }
    }
  }
}

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

/**
 * Execute a shell command and return result.
 * Returns { success: boolean, stdout: string, stderr: string, code: number }
 */
function execCommand(command, cwd) {
  return new Promise((resolve) => {
    const isArray = Array.isArray(command);
    const cmd = isArray ? command[0] : command;
    const args = isArray ? command.slice(1) : [];

    const proc = spawn(cmd, args, {
      cwd,
      timeout: 30000,
      shell: !isArray
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => { stdout += data.toString(); });
    proc.stderr?.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.slice(0, 500),
        stderr: stderr.slice(0, 500),
        code: code ?? -1
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        stdout: stdout.slice(0, 500),
        stderr: err.message.slice(0, 500),
        code: -1
      });
    });
  });
}

function computeLifecycleStatus({ ownerPath, ownerPathExists, lastVerifiedAt, verificationSource }) {
  // Path does not exist → missing
  if (!ownerPath || !ownerPathExists) {
    return "missing";
  }

  // Project exists in graph with path → registered
  if (ownerPath && ownerPathExists) {
    // No verification record yet → path-found
    if (!lastVerifiedAt) {
      return "path-found";
    }

    // Check verification age
    const verifiedAt = new Date(lastVerifiedAt);
    const now = new Date();
    const ageHours = (now - verifiedAt) / (1000 * 60 * 60);

    // Recent verification (within 24 hours)
    if (ageHours <= 24) {
      // If verificationSource indicates failure, mark as failed
      if (verificationSource === "failed") {
        return "failed";
      }
      return "verified";
    }

    // Verification older than 24 hours → stale
    return "stale";
  }

  return "registered";
}

/**
 * Convert graph `verify` field (array of command strings) to verifyCommands format.
 */
function convertGraphVerifyToCommands(verify, id) {
  if (!Array.isArray(verify)) return [];
  return verify.map((cmd, index) => ({
    id: `${id}-verify-${index + 1}`,
    label: `Verify #${index + 1}`,
    command: cmd,
    runner: "local"
  }));
}

/**
 * Execute verify commands and return aggregated verification result.
 */
async function runVerifications(verifyCommands, ownerPath, workspaceRoot) {
  if (!verifyCommands || verifyCommands.length === 0) {
    return {
      lastVerifiedAt: null,
      verificationSource: null,
      verificationSummary: null,
      status: "path-found"
    };
  }

  const results = [];
  const cwd = ownerPath || workspaceRoot;

  for (const cmd of verifyCommands) {
    // Ensure command is a valid string
    let command = cmd.command;
    if (Array.isArray(command)) {
      command = command.join(" ");
    }
    if (typeof command !== "string" || !command.trim()) {
      results.push({
        id: cmd.id,
        label: cmd.label,
        command: String(command || ""),
        success: false,
        stdout: "",
        stderr: "Invalid or missing command",
        code: -1
      });
      continue;
    }

    const result = await execCommand(command, cwd);
    results.push({
      id: cmd.id,
      label: cmd.label,
      command,
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    });
  }

  const allSuccess = results.every(r => r.success);
  const anySuccess = results.some(r => r.success);

  // Generate summary from results
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const summary = allSuccess
    ? `All ${totalCount} verification(s) passed`
    : anySuccess
      ? `${successCount}/${totalCount} verification(s) passed`
      : `All ${totalCount} verification(s) failed`;

  const now = new Date().toISOString();

  // Determine status based on verification results
  let status;
  if (!ownerPath) {
    status = "missing";
  } else if (allSuccess) {
    status = "verified";
  } else if (anySuccess) {
    status = "stale";
  } else {
    status = "failed";
  }

  return {
    lastVerifiedAt: now,
    verificationSource: allSuccess ? "verified" : "failed",
    verificationSummary: summary,
    verificationResults: results,
    status
  };
}

/**
 * Generate evidence link based on resource surface and verification results.
 */
function generateEvidenceLink(resource, verificationResult) {
  const { id, surface, dashboardRoute } = resource;

  // For hosted apps, evidence links to the app entry point
  if (surface === "hosted-app" || surface === "hosted-subroute") {
    // Extract appId from dashboardRoute or use id
    const appIdMatch = dashboardRoute?.match(/^\/apps\/([^/]+)/);
    const appId = appIdMatch ? appIdMatch[1] : id;
    return `/apps/${appId}`;
  }

  // For resource-index, evidence links to the resource detail page
  if (surface === "resource-index") {
    return `/axi-resources/${encodeURIComponent(id)}`;
  }

  // For dashboard-host, link to the dashboard route
  if (surface === "dashboard-host") {
    return dashboardRoute || `/axi-resources/${encodeURIComponent(id)}`;
  }

  // Fallback to resource detail page
  return `/axi-resources/${encodeURIComponent(id)}`;
}

function graphResource({ id, project, workspaceRoot }) {
  const ownerPath = resolveWorkspaceValue(project.path, workspaceRoot);
  const ownerPathExists = Boolean(ownerPath) && fs.existsSync(ownerPath);
  const kind = project.kind || "workspace-resource";

  // Convert graph `verify` field to verifyCommands format
  const verifyCommands = convertGraphVerifyToCommands(project.verify, id);

  // Determine lifecycle status based on existing verification data
  const status = computeLifecycleStatus({
    ownerPath,
    ownerPathExists,
    lastVerifiedAt: project.lastVerifiedAt,
    verificationSource: project.verificationSource
  });

  // Generate base resource with preliminary evidence link
  const evidenceLink = `/axi-resources/${encodeURIComponent(id)}`;

  return {
    id,
    title: project.name || id,
    kind,
    surface: "resource-index",
    status,
    ownerPath,
    ownerPathExists,
    dashboardRoute: defaultDashboardRoute(id),
    capabilities: unique(project.provides || []),
    notes: `Registered workspace project (${kind}).`,
    verifyCommands,
    evidenceLink
  };
}

function mergeResource(base, override, workspaceRoot) {
  const merged = {
    ...base,
    ...override,
    ownerPath: resolveWorkspaceValue(override.ownerPath ?? base.ownerPath, workspaceRoot),
    // capabilities: deduplicated union of base and override lists
    capabilities: unique([...(base.capabilities || []), ...(override.capabilities || [])])
  };

  const ownerPathExists = Boolean(merged.ownerPath) && fs.existsSync(merged.ownerPath);
  const ownerPath = merged.ownerPath;

  // Recompute lifecycle status after merge
  merged.status = computeLifecycleStatus({
    ownerPath,
    ownerPathExists,
    lastVerifiedAt: override.lastVerifiedAt ?? base.lastVerifiedAt,
    verificationSource: override.verificationSource ?? base.verificationSource
  });
  merged.ownerPathExists = ownerPathExists;

  return {
    ...merged,
    // verifyCommands: from graph config only (base), not from static override
    verifyCommands: base.verifyCommands || [],
    // evidenceLink: prefer override, fallback to base
    evidenceLink: override.evidenceLink || base.evidenceLink
  };
}

/**
 * Status field semantics:
 *   "active"   — ownerPath resolves to an existing directory on disk
 *   "missing"  — ownerPath is empty or does not exist (static-only entry)
 *   "inactive" — reserved for future deprecation / manual override signal
 *   "path-found" — path exists but no verification has been run
 *   "verified" — path exists and all verify commands passed
 *   "failed" — path exists but at least one verify command failed
 *   "stale" — verification result is older than 24 hours
 *
 * Presentation override fields (from static config):
 *   visibility  — "always" (default) | "deferred" (lazy-load) | "hidden" (index only)
 *   menuGroup  — dashboard nav grouping label (e.g. "infrastructure", "workspace-governance")
 *   audience   — "user" | "developer" | "admin"
 *   docsRoute  — link to external documentation
 *   owner      — human-readable owner label
 *
 * Verification metadata (populated by running verify commands):
 *   lastVerifiedAt      — ISO-8601 timestamp of last automated verification
 *   verificationSource  — "verified" or "failed" based on command exit code
 *   verificationSummary — one-line summary of verification results
 *   evidenceLink        — URL to evidence (CI run, PR, doc page, etc.)
 */
export async function loadWorkspaceResourceRegistry({
  workspaceRoot,
  graphPath = path.join(workspaceRoot, "workspace.graph.json"),
  staticResourcesPath = path.join(workspaceRoot, "projects", "axi-workbench", "apps", "devsvc-dashboard", "config", "axi-resources.json"),
  cacheOptions = {}
} = {}) {
  if (!workspaceRoot) throw new Error("workspaceRoot is required");

  // Cache options: enabled (default true), forceRefresh (default false)
  const { enabled = true, forceRefresh = false } = cacheOptions;

  // Resolve the persistent cache directory for this workspace once per call.
  // We refresh the module-level pointer so clearVerificationCache() can find
  // it later without re-deriving the path.
  persistentCacheDir = getPersistentCacheDir(workspaceRoot);

  // On startup (or whenever the in-memory cache is empty), hydrate from the
  // persistent tier so a fresh process still sees recent verification
  // evidence. Each loaded record is tagged as "persistent" so the API can
  // distinguish it from records written during this process.
  if (enabled && verificationCache.size === 0) {
    const persistentRecords = loadAllPersistentVerifications(persistentCacheDir);
    for (const [resourceId, record] of Object.entries(persistentRecords)) {
      verificationCache.set(resourceId, record);
      verificationCacheSource.set(resourceId, "persistent");
    }
  }

  const graph = readJson(graphPath, { projects: {} });
  const staticResources = readJson(staticResourcesPath, []);
  const staticById = new Map(staticResources.map((resource) => [resource.id, resource]));
  const resources = [];

  for (const [id, project] of Object.entries(graph.projects || {})) {
    const baseResource = graphResource({ id, project, workspaceRoot });

    // Determine whether to use cache or run fresh verification
    let verificationResult;
    const cachedResult = enabled ? getCachedVerification(id) : null;
    const cachedSource = enabled ? getCacheSource(id) : "none";
    const needsRefresh = forceRefresh || !cachedResult || isStale(id);

    if (needsRefresh) {
      // Run verification commands and merge results
      verificationResult = await runVerifications(
        baseResource.verifyCommands,
        baseResource.ownerPath,
        workspaceRoot
      );

      // Cache the verification result for future requests
      if (enabled && verificationResult.lastVerifiedAt) {
        const cacheEntry = {
          lastVerifiedAt: verificationResult.lastVerifiedAt,
          verificationSource: verificationResult.verificationSource,
          verificationSummary: verificationResult.verificationSummary,
          verificationResults: verificationResult.verificationResults,
          status: verificationResult.status
        };
        verificationCache.set(id, cacheEntry);
        verificationCacheSource.set(id, "in-memory");

        // Persist to disk so a service restart can re-hydrate from this
        // record. Best-effort: a failed write must not break the registry.
        try {
          savePersistentVerification(id, cacheEntry, persistentCacheDir);
        } catch {
          // intentionally ignored — in-memory cache still works for this run
        }
      }
    } else {
      // Use cached result. cacheSource distinguishes persistent (loaded from
      // disk this session) from in-memory (written during this process) so
      // callers can tell which tier served the record.
      verificationResult = {
        lastVerifiedAt: cachedResult.lastVerifiedAt,
        verificationSource: cachedResult.verificationSource,
        verificationSummary: cachedResult.verificationSummary,
        verificationResults: cachedResult.verificationResults,
        status: cachedResult.status
      };
    }

    const merged = mergeResource(
      { ...baseResource, ...verificationResult },
      staticById.get(id) || {},
      workspaceRoot
    );

    // Override status with verification result if verification was run
    if (verificationResult.lastVerifiedAt) {
      merged.status = verificationResult.status;
      merged.lastVerifiedAt = verificationResult.lastVerifiedAt;
      merged.verificationSource = verificationResult.verificationSource;
      merged.verificationSummary = verificationResult.verificationSummary;
    }

    // Add cache metadata for debugging/transparency. `cacheSource` records
    // which tier served the record; `fromCache` is true whenever a cache hit
    // (any tier) was used.
    merged.cacheSource = cachedSource;
    merged.fromCache = !needsRefresh && Boolean(verificationResult.lastVerifiedAt);

    // Finalize evidence link based on final merged state
    merged.evidenceLink = generateEvidenceLink(merged, verificationResult);

    resources.push(merged);
    staticById.delete(id);
  }

  for (const [id, resource] of staticById) {
    const ownerPath = resolveWorkspaceValue(resource.ownerPath || "", workspaceRoot);
    const ownerPathExists = Boolean(ownerPath) && fs.existsSync(ownerPath);

    const mergedStatic = mergeResource({
      id,
      title: resource.title || id,
      kind: resource.kind || "workspace-resource",
      surface: "resource-index",
      status: "missing",
      ownerPath,
      ownerPathExists,
      dashboardRoute: defaultDashboardRoute(id),
      capabilities: [],
      notes: "",
      verifyCommands: []
    }, resource, workspaceRoot);

    // Static-only entries have no verification provenance.
    mergedStatic.cacheSource = "none";
    mergedStatic.fromCache = false;

    resources.push(mergedStatic);
  }

  return resources.sort((left, right) => left.title.localeCompare(right.title, "en"));
}
