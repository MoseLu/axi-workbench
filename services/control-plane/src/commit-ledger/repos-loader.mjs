/**
 * Commit Ledger Repositories Loader
 *
 * Derives the commit-ledger repo roster from the workspace governance graph
 * (`workspace.graph.json`). The graph is the single source of truth for the
 * project -> path mapping. Each project that has a concrete `path` and a
 * real `.git/` directory becomes a sync target. This replaces the historical
 * hardcoded `CANONICAL_REPOS` map and keeps commit-ledger in sync with
 * workspace registrations.
 *
 * Why the registry and not a hardcoded map: the collector used to keep its
 * own list of partition directories (`projects/`, `products/`, `shared/`,
 * `infra/`, `tools/`) and concatenated `AXI_WORKSPACE_ROOT` onto each of
 * them. The 2026-10-17 partition split dissolved `projects/`, `shared/` and
 * `infra/` as partitions, so every one of those entries pointed at a path
 * that no longer exists, and two copies of the list disagreed with each
 * other. Reading `projects[*].path` from the registry removes both the
 * staleness and the duplication.
 *
 * The loader is intentionally tolerant: missing graph files, missing paths,
 * or unreadable entries are skipped rather than aborting the whole loader.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_WORKSPACE_ROOT = process.env.AXI_WORKSPACE_ROOT || '/Volumes/code/workspace';
const DEFAULT_GRAPH_PATH =
  process.env.AXI_WORKSPACE_GRAPH || path.join(DEFAULT_WORKSPACE_ROOT, 'workspace.graph.json');

/**
 * Map a governance-graph project onto its ledger partition.
 *
 * `section` is the registry's own partition field and wins when present.
 * The `kind` heuristic is only a fallback for the handful of entries that
 * carry no section (the workspace anchor, the external capability dirs and
 * the governance repo itself).
 *
 * @param {object} project - one `projects[*]` entry of the governance graph
 * @param {string} [project.section] - registry partition (`projects`, `products`, ...)
 * @param {string} [project.kind] - registry kind, used as a fallback
 * @returns {string} partition label
 */
function derivePartition(project) {
  const section = typeof project?.section === 'string' ? project.section.trim().toLowerCase() : '';
  if (section) return section;

  const explicit = (project?.kind || '').toLowerCase();
  if (explicit.includes('governance') || explicit.includes('registry')) return 'infra';
  if (explicit.includes('skill') || explicit.includes('rule') || explicit.includes('ui')) return 'shared';
  if (explicit.includes('tool') || explicit.includes('cli') || explicit.includes('gateway') || explicit.includes('companion')) return 'tools';
  if (explicit.includes('product')) return 'products';
  if (explicit.includes('reference')) return 'references';
  if (explicit.includes('candidate')) return 'candidates';
  return 'projects';
}

/**
 * Resolve one registry path against the workspace root.
 *
 * The registry stores workspace-relative paths for most projects
 * (`foundation/axi-rules`) and absolute paths for a few (`/Users/mose/...`).
 * Relative entries are resolved against the workspace root, matching
 * `resolveEntryPath` in the governance `workspace-lib.mjs` and the
 * GOV-AUDIT-005 path-compat handling in `workspace-audit.mjs`.
 *
 * @param {string} rawPath - `projects[*].path` from the registry
 * @param {string} workspaceRoot - absolute workspace root
 * @returns {string|null} absolute path, or null when the entry is unusable
 */
function resolveProjectPath(rawPath, workspaceRoot) {
  if (typeof rawPath !== 'string' || rawPath.trim() === '') return null;

  let value = rawPath.trim();
  if (value.includes('${workspaceRoot}')) {
    value = value.split('${workspaceRoot}').join(workspaceRoot);
  }
  if (path.isAbsolute(value)) return path.normalize(value);
  return path.resolve(workspaceRoot, value);
}

/**
 * Determine the workspace root a relative registry path is resolved against.
 *
 * `AXI_WORKSPACE_ROOT` wins so the collector stays portable to another
 * checkout; otherwise the graph's own `workspaceRoot` is authoritative, with
 * the graph's parent directory as a last resort.
 */
function resolveWorkspaceRoot(graph, graphPath) {
  if (process.env.AXI_WORKSPACE_ROOT) return path.resolve(process.env.AXI_WORKSPACE_ROOT);
  if (typeof graph?.workspaceRoot === 'string' && graph.workspaceRoot.trim() !== '') {
    return path.resolve(graph.workspaceRoot.trim());
  }
  return path.resolve(path.dirname(graphPath), '..');
}

/**
 * Load every commit-ledger repo from the workspace graph. Returns the array of
 * `{ projectId, partition, path }` plus a diagnostics summary so callers can
 * surface skipped entries in logs without taking the server down.
 *
 * @param {string} graphPath - Override the default graph location for tests.
 * @returns {{ repos: Array<{projectId: string, partition: string, path: string}>, diagnostics: object }}
 */
export function loadReposFromGraph(graphPath = DEFAULT_GRAPH_PATH) {
  const diagnostics = {
    graphPath,
    graphExists: false,
    workspaceRoot: null,
    totalProjects: 0,
    skippedMissingPath: 0,
    skippedMissingGit: 0,
    skippedWorkspaceAnchor: 0,
    loaded: 0,
  };

  if (!existsSync(graphPath)) {
    return { repos: [], diagnostics };
  }
  diagnostics.graphExists = true;

  let graph;
  try {
    graph = JSON.parse(readFileSync(graphPath, 'utf8'));
  } catch (err) {
    return { repos: [], diagnostics: { ...diagnostics, parseError: err?.message || String(err) } };
  }

  const workspaceRoot = resolveWorkspaceRoot(graph, graphPath);
  diagnostics.workspaceRoot = workspaceRoot;

  const projects = graph?.projects && typeof graph.projects === 'object' ? graph.projects : {};
  diagnostics.totalProjects = Object.keys(projects).length;

  const repos = [];
  for (const [projectId, project] of Object.entries(projects)) {
    // Workspace anchors and contract placeholders are not git repos with code.
    if (project?.kind === 'workspace-anchor' || project?.kind === 'contract-placeholder') {
      diagnostics.skippedWorkspaceAnchor++;
      continue;
    }

    const resolved = resolveProjectPath(project?.path, workspaceRoot);
    if (!resolved) {
      diagnostics.skippedMissingPath++;
      continue;
    }
    if (!existsSync(path.join(resolved, '.git'))) {
      diagnostics.skippedMissingGit++;
      continue;
    }

    repos.push({
      projectId,
      partition: derivePartition(project),
      path: resolved,
    });
    diagnostics.loaded++;
  }

  repos.sort((a, b) => a.projectId.localeCompare(b.projectId));
  return { repos, diagnostics };
}

/**
 * Convenience accessor: returns just the project list without diagnostics.
 */
export function loadRepos() {
  return loadReposFromGraph().repos;
}
