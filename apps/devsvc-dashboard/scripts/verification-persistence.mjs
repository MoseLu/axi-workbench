import fs from "node:fs";
import path from "node:path";

// Cache TTL: 24 hours in milliseconds. Must match workspace-resource-registry.mjs.
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the persistent verification cache directory for a given workspace root.
 * The path is intentionally inside the dashboard app's working tree so that:
 *   - the directory is committed-aware (.cache/) and excluded from VCS by
 *     convention (caller responsibility, mirrors typical .cache/ handling);
 *   - service restarts within the same workspace re-read the same files;
 *   - the directory is owned by Workbench and never shared across projects.
 *
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string} Absolute path to the verification cache directory.
 */
export function getPersistentCacheDir(workspaceRoot) {
  if (!workspaceRoot) throw new Error("workspaceRoot is required");
  return path.join(
    workspaceRoot,
    "projects",
    "axi-workbench",
    "apps",
    "devsvc-dashboard",
    ".cache",
    "verification"
  );
}

/**
 * Encode a resource id into a safe filename. The registry only stores
 * ASCII ids today, but be defensive about path separators and traversal.
 */
function safeFileName(resourceId) {
  const raw = String(resourceId || "");
  // Replace any non-[A-Za-z0-9_-] character with an underscore.
  // This prevents path traversal even if a hostile id were ever introduced.
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, "_");
  if (!safe || safe === "." || safe === "..") {
    throw new Error(`Invalid resource id for persistence: ${resourceId}`);
  }
  return `${safe}.json`;
}

function isExpired(record, now = Date.now()) {
  if (!record || !record.lastVerifiedAt) return true;
  const cachedAt = new Date(record.lastVerifiedAt).getTime();
  if (Number.isNaN(cachedAt)) return true;
  return (now - cachedAt) > VERIFICATION_TTL_MS;
}

/**
 * Load a single persistent verification record for a resource.
 * Returns null when:
 *   - the file does not exist,
 *   - the file cannot be parsed,
 *   - the file is older than VERIFICATION_TTL_MS (stale).
 *
 * @param {string} resourceId
 * @param {string} cacheDir Absolute path to the cache directory.
 * @returns {object|null}
 */
export function loadPersistentVerification(resourceId, cacheDir) {
  if (!resourceId || !cacheDir) return null;
  const filePath = path.join(cacheDir, safeFileName(resourceId));
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (isExpired(parsed)) return null;
    return parsed;
  } catch {
    // Corrupt or unreadable files are treated as missing so the caller can
    // re-run verification instead of crashing the registry.
    return null;
  }
}

/**
 * Persist a verification result to disk. The record must include
 * `lastVerifiedAt` (ISO-8601 string). Returns the absolute file path that
 * was written.
 *
 * @param {string} resourceId
 * @param {object} result Verification result record (see workspace-resource-registry).
 * @param {string} cacheDir
 * @returns {string} Absolute path of the written file.
 */
export function savePersistentVerification(resourceId, result, cacheDir) {
  if (!resourceId) throw new Error("resourceId is required");
  if (!cacheDir) throw new Error("cacheDir is required");
  if (!result || typeof result !== "object") {
    throw new Error("result must be an object");
  }
  if (!result.lastVerifiedAt) {
    throw new Error("result.lastVerifiedAt is required for persistence");
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, safeFileName(resourceId));
  // Atomic-ish write: write to a temp sibling and rename, so a crash mid-write
  // never leaves a half-written JSON file that would later be treated as
  // evidence.
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
  return filePath;
}

/**
 * Delete a single persistent record. Missing files are not an error.
 * @param {string} resourceId
 * @param {string} cacheDir
 */
export function deletePersistentVerification(resourceId, cacheDir) {
  if (!resourceId || !cacheDir) return;
  const filePath = path.join(cacheDir, safeFileName(resourceId));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Load every persistent verification record that is still fresh. Records
 * older than the TTL are skipped; corrupt files are skipped. The result is
 * a plain object keyed by resource id.
 *
 * @param {string} cacheDir
 * @returns {Record<string, object>}
 */
export function loadAllPersistentVerifications(cacheDir) {
  const out = {};
  if (!cacheDir || !fs.existsSync(cacheDir)) return out;

  let entries;
  try {
    entries = fs.readdirSync(cacheDir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const resourceId = entry.slice(0, -".json".length);
    const record = loadPersistentVerification(resourceId, cacheDir);
    if (record) out[resourceId] = record;
  }
  return out;
}

/**
 * Clear every persistent verification record. Used by tests.
 * @param {string} cacheDir
 */
export function clearAllPersistentVerifications(cacheDir) {
  if (!cacheDir || !fs.existsSync(cacheDir)) return;
  for (const entry of fs.readdirSync(cacheDir)) {
    if (entry.endsWith(".json")) {
      fs.unlinkSync(path.join(cacheDir, entry));
    }
  }
}

/**
 * Convenience helper: tell callers whether a record is fresh.
 * @param {object|null|undefined} record
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
export function isPersistentRecordFresh(record, now = Date.now()) {
  return !isExpired(record, now);
}
