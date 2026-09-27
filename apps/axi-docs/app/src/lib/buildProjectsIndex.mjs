/**
 * buildProjectsIndex.mjs
 *
 * Pure helpers extracted from `app/scripts/build-projects-index.mjs` so the
 * handoff-snapshot parsing logic is unit-testable from vitest.
 *
 * The build script consumes these helpers, then orchestrates file I/O around
 * the parsed project list. Keep this file free of side effects; only the
 * `readHandoffSnapshot` helper touches the file system and is exported
 * separately for the build script to call.
 */

import { readFile, stat } from 'node:fs/promises';

export const HANDOFF_PATH = '/Volumes/code/workspace/.workspace/project-handoff.json';
export const HANDOFF_MAX_AGE_DAYS = 14;
export const WORKSPACE_FALLBACK_PATH = '/Volumes/code/workspace/WORKSPACE_INDEX.md';

const WORKSPACE_ROOT_PREFIX = '/Volumes/code/workspace/';
const EXCLUDED_DOSSIER_PATHS = new Set([
  '/Volumes/code/workspace/infra/axi-workspace-governance',
  '/Volumes/code/workspace/infra/axi-registry',
]);

/**
 * Inferred partition from the project's absolute path. Mirrors the
 * partition slot in the existing `WORKSPACE_INDEX.md` table.
 */
export function inferPartition(absolutePath) {
  if (typeof absolutePath !== 'string' || !absolutePath.startsWith(WORKSPACE_ROOT_PREFIX)) {
    return 'unknown';
  }
  const segment = absolutePath
    .slice(WORKSPACE_ROOT_PREFIX.length)
    .split('/')[0];
  if (segment === 'projects') return 'projects';
  if (segment === 'tools') return 'tools';
  if (segment === 'infra') return 'infra';
  if (segment === 'shared') return 'shared';
  if (segment === 'products') return 'products';
  if (segment === 'references') return 'references';
  // Top-level files (e.g. dev-services.config.json) fall under infra.
  if (segment.endsWith('.json') || segment.endsWith('.config.json')) return 'infra';
  return segment || 'unknown';
}

/**
 * Map a handoff project to the dossier "section" used by the build script's
 * INDEX.md table (`core` / `shared` / `reference`). The mapping reproduces
 * the visual groups the legacy `WORKSPACE_INDEX.md` table produced.
 */
export function inferSection({ kind, lifecycle, partition }) {
  const lc = typeof lifecycle === 'string' ? lifecycle : '';
  if (lc.includes('canonical')) return 'core';
  if (lc.includes('shared')) return 'shared';
  if (lc.includes('tool') || kind === 'product') return 'reference';
  if (lc.includes('infra')) return 'shared';
  // Fall back to partition-based inference for unknown lifecycles.
  if (partition === 'projects') return 'core';
  if (partition === 'tools' || partition === 'products') return 'reference';
  return 'shared';
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`handoff project missing ${label}: ${JSON.stringify(value)}`);
  }
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`handoff project missing ${label}[]: ${JSON.stringify(value)}`);
  }
}

/**
 * Validate the handoff snapshot shape and produce the project list used by
 * the build script. Throws with a clear message on any malformed field.
 *
 * `now` is injected to keep the function pure and testable.
 */
export function extractProjectsFromHandoff(snapshot, now = new Date()) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('handoff snapshot is not an object');
  }
  if (typeof snapshot.schemaVersion !== 'string') {
    throw new Error(`handoff snapshot missing schemaVersion (string): ${typeof snapshot.schemaVersion}`);
  }
  if (!Array.isArray(snapshot.projects)) {
    throw new Error('handoff snapshot missing projects[] (array)');
  }
  const generatedAt = typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : null;
  return snapshot.projects
    .filter((raw) => !EXCLUDED_DOSSIER_PATHS.has(raw?.path))
    .map((raw) => {
      requireString(raw.id, 'id');
      requireString(raw.path, 'path');
      requireString(raw.name, 'name');
      requireString(raw.summary, 'summary');
      requireStringArray(raw.commands?.verify, 'commands.verify');
      if (typeof raw.readiness !== 'string') {
        throw new Error(`handoff project ${raw.id} missing readiness (string)`);
      }
      if (typeof raw.kind !== 'string') {
        throw new Error(`handoff project ${raw.id} missing kind (string)`);
      }
      if (typeof raw.lifecycle !== 'string') {
        throw new Error(`handoff project ${raw.id} missing lifecycle (string)`);
      }
      const partition = inferPartition(raw.path);
      const section = inferSection({ kind: raw.kind, lifecycle: raw.lifecycle, partition });
      return {
        id: raw.id,
        name: raw.name,
        partition,
        path: raw.path,
        purpose: raw.summary,
        stack: '',
        status: raw.readiness,
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        section,
        kind: raw.kind,
        lifecycle: raw.lifecycle,
        verification: raw.commands.verify.join('; '),
        handoffGeneratedAt: generatedAt,
        handoffManifestPath: typeof raw.manifestPath === 'string' ? raw.manifestPath : null,
      };
    });
}

/**
 * Read the handoff snapshot and report age. Returns the parsed snapshot and
 * age in milliseconds; the caller decides whether to use a stale snapshot.
 *
 * Pure side-effect: the file read itself. The caller (build script) is
 * responsible for the orchestration; the helper is exposed here so the build
 * script can reuse the same error/age semantics.
 */
export async function readHandoffSnapshot({
  handoffPath = HANDOFF_PATH,
  maxAgeDays = HANDOFF_MAX_AGE_DAYS,
  now = new Date(),
} = {}) {
  try {
    const [raw, stats] = await Promise.all([
      readFile(handoffPath, 'utf8'),
      stat(handoffPath),
    ]);
    const snapshot = JSON.parse(raw);
    const ageMs = Math.max(0, now.getTime() - stats.mtime.getTime());
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return {
      snapshot,
      ageMs,
      ageDays,
      stale: ageDays > maxAgeDays,
      error: null,
    };
  } catch (error) {
    return {
      snapshot: null,
      ageMs: null,
      ageDays: null,
      stale: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
