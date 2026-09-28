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
// Canonical machine-readable workspace registry (ADR-005/008). This is the
// preferred primary data source for the build script; the project-handoff
// snapshot is a downstream consumer of this graph and remains as a
// fallback / preservedAddenda carrier.
export const WORKSPACE_GRAPH_PATH = '/Volumes/code/workspace/workspace.graph.json';

const WORKSPACE_ROOT_PREFIX = '/Volumes/code/workspace/';
// ADR-008 retired the legacy `infra/` partition in favour of
// `foundation/workspace-governance` (governance runtime) and
// `foundation/axi-registry` (local package registry). Both are infra /
// platform surfaces with their own face-level docs and must NOT be
// rendered as dossiers under `docs/content/{en,zh}/projects/`.
export const EXCLUDED_DOSSIER_PATHS = new Set([
  '/Volumes/code/workspace/foundation/workspace-governance',
  '/Volumes/code/workspace/foundation/axi-registry',
]);

/**
 * Inferred partition from the project's absolute path. Mirrors the
 * partition slot in `workspace.graph.json` / `WORKSPACE_INDEX.md` and
 * follows ADR-008 (Personal OS Repository Topology).
 *
 * Post-ADR-008 the legacy `projects / infra / shared` partitions are
 * retired; the canonical partition set is:
 *   foundation / workbench / agent-cluster / candidates /
 *   distributions / archive / products / tools / references
 *
 * The old names are intentionally NOT remapped — they exist only in
 * archived git history and should never appear in a fresh dossier.
 */
export function inferPartition(absolutePath) {
  if (typeof absolutePath !== 'string' || !absolutePath.startsWith(WORKSPACE_ROOT_PREFIX)) {
    return 'unknown';
  }
  const segment = absolutePath
    .slice(WORKSPACE_ROOT_PREFIX.length)
    .split('/')[0];
  if (segment === 'foundation') return 'foundation';
  if (segment === 'workbench') return 'workbench';
  if (segment === 'agent-cluster') return 'agent-cluster';
  if (segment === 'candidates') return 'candidates';
  if (segment === 'distributions') return 'distributions';
  if (segment === 'archive') return 'archive';
  if (segment === 'products') return 'products';
  if (segment === 'tools') return 'tools';
  if (segment === 'references') return 'references';
  // Top-level files (e.g. dev-services.config.json) fall under foundation.
  if (segment.endsWith('.json') || segment.endsWith('.config.json')) return 'foundation';
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

/**
 * Map a workspace-graph project to the dossier section. Equivalent to
 * `inferSection` but consumes the graph's `kind / lifecycle / partition`
 * shape directly. The mapping reproduces the visual groups that the legacy
 * `WORKSPACE_INDEX.md` table produced (`core` / `shared` / `reference`).
 */
export function inferSectionFromGraph({ kind, lifecycle, partition }) {
  const lc = typeof lifecycle === 'string' ? lifecycle : '';
  const kd = typeof kind === 'string' ? kind : '';
  // Lifecycle / kind override first — they encode the contract author intent.
  if (lc === 'legacy-reference' || kd.includes('reference') || kd === 'legacy-reference') {
    return 'reference';
  }
  if (lc === 'external-infra') return 'shared';
  if (kd === 'workspace-anchor') return 'shared';
  if (kd === 'product' || kd === 'standalone-product' || kd === 'standalone-candidate') {
    return 'core';
  }
  // Partition-based defaults (ADR-008 topology).
  if (partition === 'foundation') return 'shared';
  if (partition === 'workbench') return 'core';
  if (partition === 'agent-cluster') return 'core';
  if (partition === 'candidates') return 'core';
  if (partition === 'products') return 'core';
  if (partition === 'distributions') return 'reference';
  if (partition === 'archive') return 'reference';
  if (partition === 'tools') return 'reference';
  if (partition === 'references') return 'reference';
  if (partition === 'docs') return 'shared';
  return 'core';
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
 * Validate the workspace graph shape and produce the project list used by
 * the build script. Skips entries that are not real workspace projects
 * (workspace-root anchor, external paths outside `/Volumes/code/workspace/`,
 * and the EXCLUDED_DOSSIER_PATHS set). Throws with a clear message on any
 * malformed top-level field.
 *
 * `now` is injected to keep the function pure and testable.
 */
export function extractProjectsFromGraph(graph, now = new Date()) {
  if (!graph || typeof graph !== 'object') {
    throw new Error('workspace graph is not an object');
  }
  if (typeof graph.schemaVersion !== 'string') {
    throw new Error(`workspace graph missing schemaVersion (string): ${typeof graph.schemaVersion}`);
  }
  if (!graph.projects || typeof graph.projects !== 'object' || Array.isArray(graph.projects)) {
    throw new Error('workspace graph missing projects{} (object keyed by id)');
  }
  const records = [];
  for (const [id, raw] of Object.entries(graph.projects)) {
    if (!raw || typeof raw !== 'object') continue;
    // Skip the workspace-root anchor itself — it represents the workspace,
    // not a project under it.
    if (raw.path === '/Volumes/code/workspace') continue;
    // Skip entries that live outside the workspace root (e.g. external CLIs
    // installed under /Users/mose/.cc-connect). They are not workspace
    // projects and have no dossier tree to render.
    if (typeof raw.path !== 'string' || !raw.path.startsWith(WORKSPACE_ROOT_PREFIX)) continue;
    // Skip EXCLUDED_DOSSIER_PATHS — infrastructure / registry surfaces with
    // their own face-level docs.
    if (EXCLUDED_DOSSIER_PATHS.has(raw.path)) continue;

    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id;
    const path = raw.path;
    const partition = inferPartition(path);
    const section = inferSectionFromGraph({
      kind: typeof raw.kind === 'string' ? raw.kind : '',
      lifecycle: typeof raw.lifecycle === 'string' ? raw.lifecycle : '',
      partition,
    });
    // Derive purpose / status from the graph's `completion` payload when
    // present. Fall back to a sensible default so the templates always
    // render something useful.
    const completion = raw.completion && typeof raw.completion === 'object' ? raw.completion : null;
    const purpose = completion && typeof completion.summary === 'string'
      ? completion.summary
      : (typeof raw.scope === 'string' ? raw.scope : '');
    const status = completion && typeof completion.stage === 'string'
      ? completion.stage
      : 'active';
    const notes = typeof raw.scope === 'string' ? raw.scope : '';
    const verification = Array.isArray(raw.verify) ? raw.verify.join('; ') : '';

    records.push({
      id,
      name,
      partition,
      path,
      purpose,
      stack: '',
      status,
      notes,
      section,
      kind: typeof raw.kind === 'string' ? raw.kind : '',
      lifecycle: typeof raw.lifecycle === 'string' ? raw.lifecycle : '',
      verification,
      handoffGeneratedAt: null,
      handoffManifestPath: null,
    });
  }
  return records;
}

/**
 * Read the primary project index. Source precedence (post-ADR-008):
 *   1. `/Volumes/code/workspace/workspace.graph.json` (canonical machine
 *      registry; preferred). Empty graph → falls through to handoff.
 *   2. `/Volumes/code/workspace/.workspace/project-handoff.json` (handoff
 *      snapshot; downstream consumer of the graph). Stale snapshots are
 *      still returned with `stale: true` so the caller can warn.
 *   3. Both unavailable → returns an empty `projects` array and a populated
 *      `error`. The caller (build script) decides whether to fall back to
 *      WORKSPACE_INDEX.md or exit.
 *
 * Pure side-effect: file reads. The caller is responsible for orchestration.
 */
export async function readProjectIndex({
  graphPath = WORKSPACE_GRAPH_PATH,
  handoffPath = HANDOFF_PATH,
  maxAgeDays = HANDOFF_MAX_AGE_DAYS,
  now = new Date(),
} = {}) {
  // 1. workspace.graph.json (preferred primary)
  try {
    const raw = await readFile(graphPath, 'utf8');
    const graph = JSON.parse(raw);
    const projects = extractProjectsFromGraph(graph, now);
    if (projects.length > 0) {
      return {
        projects,
        source: 'graph',
        sourcePath: graphPath,
        snapshot: graph,
        ageMs: null,
        ageDays: null,
        stale: false,
        error: null,
      };
    }
    // Empty graph — fall through to handoff. Caller may still want to log.
  } catch {
    // Missing / unparseable graph → fall through to handoff.
  }

  // 2. project-handoff.json (fallback)
  const handoff = await readHandoffSnapshot({ handoffPath, maxAgeDays, now });
  if (handoff.snapshot) {
    try {
      const projects = extractProjectsFromHandoff(handoff.snapshot, now);
      return {
        projects,
        source: 'handoff',
        sourcePath: handoffPath,
        snapshot: handoff.snapshot,
        ageMs: handoff.ageMs,
        ageDays: handoff.ageDays,
        stale: handoff.stale,
        error: null,
      };
    } catch (snapshotError) {
      return {
        projects: [],
        source: null,
        sourcePath: null,
        snapshot: null,
        ageMs: handoff.ageMs,
        ageDays: handoff.ageDays,
        stale: handoff.stale,
        error: snapshotError instanceof Error ? snapshotError : new Error(String(snapshotError)),
      };
    }
  }

  // 3. Both unavailable
  return {
    projects: [],
    source: null,
    sourcePath: null,
    snapshot: null,
    ageMs: null,
    ageDays: null,
    stale: false,
    error: handoff.error,
  };
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
