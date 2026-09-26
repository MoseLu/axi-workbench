/**
 * Commit Ledger Filesystem Watcher
 *
 * Watches each commit-ledger repo's `.git/` directory via Node's built-in
 * `fs.watch` and dispatches debounced incremental sync jobs through the
 * API routes layer. The watcher only fires on HEAD / refs / packed-refs /
 * COMMIT_EDITMSG changes — pack files, hooks, and loose objects are
 * ignored because they cannot introduce new commits without also touching
 * one of those files.
 *
 * Trigger pipeline:
 *   fs.watch (filtered) -> per-repo debounce timer (default 1500ms)
 *                       -> create job in syncJobs map
 *                       -> runSyncJob (reuses api-routes worker)
 *
 * The watcher never makes HTTP loopback calls; it talks to the in-process
 * `runSyncJob` directly so the HTTP event loop stays free.
 */

import { watch } from 'node:fs';
import { loadRepos } from './repos-loader.mjs';
import { createHash } from 'node:crypto';

const DEBOUNCE_MS = Number.parseInt(process.env.AXI_COMMIT_LEDGER_DEBOUNCE_MS || '1500', 10);

/**
 * Subset of `.git/` filenames that, when changed, indicate a new commit
 * landed (HEAD pointer moved or a branch/tag ref was created/updated).
 */
const REF_FILES = new Set([
  'HEAD',
  'packed-refs',
  'ORIG_HEAD',
  'FETCH_HEAD',
  'COMMIT_EDITMSG',
  'MERGE_HEAD',
]);

function isInterestingChange(filename) {
  if (!filename) return false;
  const basename = filename.split('/').pop() || '';
  if (REF_FILES.has(basename)) return true;
  // branch / remote / tag refs live under refs/...
  if (filename.startsWith('refs/heads/') || filename.startsWith('refs/remotes/') || filename.startsWith('refs/tags/')) return true;
  return false;
}

function generateJobId() {
  return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16);
}

/**
 * Start the fs_watcher and return a handle that lets callers stop it.
 *
 * @param {object} options
 * @param {(jobId: string, job: object) => Promise<void>} options.runJob
 *   In-process runSyncJob callback. Receives a fully-shaped job descriptor and
 *   is expected to update it (status/result/error) like the HTTP sync handler.
 * @param {object} options.jobs Shared map of jobs keyed by jobId so callers
 *   can read state via /commit-ledger/sync-status/:jobId.
 * @param {boolean} [options.enabled=true] Allow callers to bypass the
 *   watcher when it is not desired (used by tests + when env explicitly
 *   disables it).
 */
export function startFsWatcher({ runJob, jobs, enabled = true, logger = console } = {}) {
  if (!enabled) {
    logger.log('[fs-watcher] disabled by configuration');
    return { stop: async () => {} };
  }

  if (typeof runJob !== 'function' || !(jobs instanceof Map)) {
    throw new TypeError('startFsWatcher requires runJob (fn) and jobs (Map)');
  }

  const repos = loadRepos();
  logger.log(`[fs-watcher] loaded ${repos.length} repos from workspace.graph.json`);

  const watchers = [];
  const pendingTimers = new Map(); // projectId -> NodeJS.Timeout

  function scheduleTrigger(repo, reason) {
    const existing = pendingTimers.get(repo.projectId);
    if (existing) clearTimeout(existing);

    pendingTimers.set(repo.projectId, setTimeout(() => {
      pendingTimers.delete(repo.projectId);

      const jobId = generateJobId();
      const job = {
        jobId,
        status: 'running',
        startedAt: new Date().toISOString(),
        completedAt: null,
        source: 'fs-watcher',
        trigger: reason,
        options: { maxCommits: 100, incremental: true, repo: repo.projectId },
        progress: null,
        result: null,
        error: null,
      };
      jobs.set(jobId, job);

      runJob(jobId, job).catch((err) => {
        job.status = 'failed';
        job.error = { message: err?.message || String(err) };
        job.completedAt = new Date().toISOString();
      });
    }, DEBOUNCE_MS));
  }

  let activeCount = 0;
  for (const repo of repos) {
    const gitDir = `${repo.path}/.git`;
    let watcher;
    try {
      watcher = watch(gitDir, { recursive: false, persistent: true }, (event, filename) => {
        if (!isInterestingChange(filename || '')) return;
        logger.log?.(`[fs-watcher] ${repo.projectId} ${event} ${filename}`);
        scheduleTrigger(repo, `${event}:${filename}`);
      });
      activeCount++;
      watcher.on('error', (err) => {
        logger.error?.(`[fs-watcher] ${repo.projectId} watcher error: ${err?.message || err}`);
      });
      watchers.push({ repo, watcher });
    } catch (err) {
      // Likely ENOENT (the .git path disappeared) or EPERM. Skip this repo
      // and log — we don't want to crash the server because one repo is
      // temporarily unavailable.
      logger.warn?.(`[fs-watcher] ${repo.projectId} could not be watched: ${err?.message || err}`);
    }
  }

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    for (const t of pendingTimers.values()) clearTimeout(t);
    pendingTimers.clear();
    for (const entry of watchers) {
      try { entry.watcher.close(); } catch { /* noop */ }
    }
    logger.log('[fs-watcher] stopped');
  }

  logger.log(`[fs-watcher] watching ${activeCount} repos with ${DEBOUNCE_MS}ms debounce`);
  return { stop, watchers };
}