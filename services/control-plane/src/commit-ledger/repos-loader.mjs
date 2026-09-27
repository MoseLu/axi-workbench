/**
 * Commit Ledger Repositories Loader
 *
 * Derives the commit-ledger repo roster from the workspace governance graph
 * (`/Volumes/code/workspace/workspace.graph.json`). Each project that has a
 * concrete `path` and a real `.git/` directory becomes a sync target. This
 * replaces the historical hardcoded `CANONICAL_REPOS` map and keeps commit-ledger
 * in sync with workspace registrations.
 *
 * The loader is intentionally tolerant: missing graph files, missing paths,
 * or unreadable entries are skipped rather than aborting the whole loader.
 */

import { readFileSync, existsSync } from 'node:fs';

const DEFAULT_GRAPH_PATH = '/Volumes/code/workspace/workspace.graph.json';

/**
 * Map governance-graph `kind` values onto the five commit-ledger partitions.
 * Anything that does not match one of the known buckets is bucketed as
 * `products` (the default).
 */
function derivePartition(project) {
  const explicit = (project.kind || '').toLowerCase();
  if (explicit.includes('workbench')) return 'workbench';
  if (explicit.includes('product')) return 'products';
  if (explicit.includes('shared') || explicit.includes('ui')) return 'shared';
  if (explicit.includes('infra') || explicit.includes('governance') || explicit.includes('registry')) return 'infra';
  if (explicit.includes('tool') || explicit.includes('cli') || explicit.includes('gateway') || explicit.includes('companion')) return 'tools';
  if (explicit.includes('project')) return 'projects';
  return 'products';
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

  const projects = graph?.projects && typeof graph.projects === 'object' ? graph.projects : {};
  diagnostics.totalProjects = Object.keys(projects).length;

  const repos = [];
  for (const [projectId, project] of Object.entries(projects)) {
    // Workspace anchors and contract placeholders are not git repos with code.
    if (project?.kind === 'workspace-anchor' || project?.kind === 'contract-placeholder') {
      diagnostics.skippedWorkspaceAnchor++;
      continue;
    }

    const path = typeof project?.path === 'string' ? project.path : null;
    if (!path) {
      diagnostics.skippedMissingPath++;
      continue;
    }
    if (!existsSync(`${path}/.git`)) {
      diagnostics.skippedMissingGit++;
      continue;
    }

    repos.push({
      projectId,
      partition: derivePartition(project),
      path,
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