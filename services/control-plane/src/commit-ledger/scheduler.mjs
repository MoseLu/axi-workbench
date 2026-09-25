/**
 * Commit Ledger Sync Scheduler
 *
 * Bridges `collectAll()` (the collector) and `runSyncJob()` (the persistence
 * worker) on a fixed cadence so the persistent JSONL ledger stays in sync with
 * the live workspace without anyone having to hit `POST /commit-ledger/sync`
 * manually. The scheduler owns three responsibilities:
 *
 *   1. **Startup sync** — kick one job as soon as the server boots so the
 *      ledger reflects the current workspace state on first read. Idempotent
 *      via `recordId = sha256(projectId:sha)` so re-running on an existing
 *      ledger is a no-op for already-stored commits.
 *   2. **Periodic sync** — `setInterval` at a configurable interval (default
 *      15 min) to capture commits landed since the last sweep. Skips a tick
 *      whenever the previous job is still in flight so a slow `git log`
 *      never spawns a parallel collector.
 *   3. **Lifecycle** — exposes `stop()` so SIGTERM/SIGINT can cancel the
 *      interval and drain any pending tick before the process exits.
 *
 * The scheduler never touches git directly; it only shapes jobs and dispatches
 * them to `runJob` (which is `runSyncJob` in production). Same trigger
 * pipeline as `fs-watcher.mjs` so observability events and the
 * `/commit-ledger/sync-status/:jobId` API work uniformly.
 *
 * Env overrides (read by the caller, not by this module, so tests can inject):
 *   - AXI_COMMIT_LEDGER_SYNC_DISABLED=1          -> never start
 *   - AXI_COMMIT_LEDGER_SYNC_INTERVAL_MS=<ms>    -> override tick interval
 *   - AXI_COMMIT_LEDGER_STARTUP_MAX_COMMITS=<n>  -> cap for the startup sweep
 *   - AXI_COMMIT_LEDGER_SYNC_MAX_COMMITS=<n>     -> cap for periodic sweeps
 */

import { createHash } from 'node:crypto';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;          // 15 min
const DEFAULT_STARTUP_MAX_COMMITS = 50_000;          // effectively unlimited for first fill
const DEFAULT_PERIODIC_MAX_COMMITS = 500;            // matches POST /commit-ledger/sync default
const DEFAULT_JOB_HISTORY_LIMIT = 32;                // keep last N jobs in the shared registry
const DEFAULT_MIN_INTERVAL_MS = 1_000;               // safety floor; sub-second is treated as test-only

function generateJobId() {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Trim the shared job registry so it does not grow without bound under a long
 * uptime with a tight interval. We keep the most recent entries only.
 */
function trimJobHistory(jobs, limit) {
  if (jobs.size <= limit) return;
  const ordered = Array.from(jobs.keys());
  const dropCount = ordered.length - limit;
  for (let i = 0; i < dropCount; i++) jobs.delete(ordered[i]);
}

/**
 * Dispatch one sync job. The job lifecycle mirrors what `handleSync` in
 * api-routes.mjs does for the HTTP path, minus the HTTP envelope.
 */
function dispatchSyncJob({ runJob, jobs, source, maxCommits, repo = null, trigger = 'periodic' }) {
  const jobId = generateJobId();
  const job = {
    jobId,
    status: 'queued',
    startedAt: new Date().toISOString(),
    completedAt: null,
    source,
    trigger,
    options: { maxCommits, repo },
    progress: null,
    result: null,
    error: null,
  };
  jobs.set(jobId, job);
  trimJobHistory(jobs, DEFAULT_JOB_HISTORY_LIMIT);

  // setImmediate so the dispatcher's caller (timer callback, startup hook)
  // does not block on the actual git fanout.
  setImmediate(() => {
    runJob(jobId, job).catch((err) => {
      const entry = jobs.get(jobId);
      if (entry) {
        entry.status = 'failed';
        entry.error = { message: err?.message || String(err) };
        entry.completedAt = new Date().toISOString();
      }
    });
  });

  return jobId;
}

/**
 * Returns true when at least one scheduler-owned job is still queued or
 * running. Used to skip a periodic tick when the previous sweep has not yet
 * finished (slow git fanout on large workspaces would otherwise stack
 * collectors on top of each other).
 */
function hasInFlightJob(jobs, schedulerSource) {
  for (const job of jobs.values()) {
    if (job.source !== schedulerSource) continue;
    if (job.status === 'queued' || job.status === 'running') return true;
  }
  return false;
}

/**
 * Start the scheduler. Returns `{ stop, runNow, status }` so callers can
 * trigger an out-of-band sync or read the current state without reaching into
 * module-internal maps.
 *
 * @param {object} options
 * @param {(jobId: string, job: object) => Promise<void>} options.runJob
 *   In-process runSyncJob callback (same signature fs-watcher uses).
 * @param {Map<string, object>} options.jobs Shared job registry.
 * @param {boolean} [options.disabled=false] When true, returns a noop handle.
 * @param {number} [options.intervalMs] Tick interval; falls back to default.
 * @param {number} [options.startupMaxCommits] Cap for the immediate sweep.
 * @param {number} [options.periodicMaxCommits] Cap for interval sweeps.
 * @param {boolean} [options.runStartupSync=true] Skip the immediate sweep
 *   when the caller wants the server to come up read-only (rare; tests use).
 * @param {object} [options.logger=console] Logger with log/warn/error.
 */
export function startScheduler({
  runJob,
  jobs,
  disabled = false,
  intervalMs = DEFAULT_INTERVAL_MS,
  startupMaxCommits = DEFAULT_STARTUP_MAX_COMMITS,
  periodicMaxCommits = DEFAULT_PERIODIC_MAX_COMMITS,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  runStartupSync = true,
  logger = console,
} = {}) {
  if (typeof runJob !== 'function' || !(jobs instanceof Map)) {
    throw new TypeError('startScheduler requires runJob (fn) and jobs (Map)');
  }

  const schedulerSource = 'scheduler';
  let intervalHandle = null;
  let stopped = false;
  let startupJobId = null;
  let lastPeriodicJobId = null;
  let lastPeriodicAt = null;

  const safeInterval = Math.max(
    Number(minIntervalMs) || DEFAULT_MIN_INTERVAL_MS,
    Number(intervalMs) || DEFAULT_INTERVAL_MS
  );

  if (disabled) {
    logger.log?.('[commit-ledger-scheduler] disabled by configuration');
    return {
      stop: async () => {},
      runNow: async () => null,
      status: () => ({ disabled: true }),
    };
  }

  function runPeriodicTick() {
    if (stopped) return;
    if (hasInFlightJob(jobs, schedulerSource)) {
      logger.log?.('[commit-ledger-scheduler] skipping tick: previous job still in flight');
      return;
    }
    const jobId = dispatchSyncJob({
      runJob,
      jobs,
      source: schedulerSource,
      maxCommits: periodicMaxCommits,
      trigger: 'interval',
    });
    lastPeriodicJobId = jobId;
    lastPeriodicAt = new Date().toISOString();
    logger.log?.(`[commit-ledger-scheduler] periodic sync queued: ${jobId} (intervalMs=${safeInterval})`);
  }

  if (runStartupSync) {
    startupJobId = dispatchSyncJob({
      runJob,
      jobs,
      source: schedulerSource,
      maxCommits: startupMaxCommits,
      trigger: 'startup',
    });
    logger.log?.(`[commit-ledger-scheduler] startup sync queued: ${startupJobId}`);
  }

  intervalHandle = setInterval(runPeriodicTick, safeInterval);
  // Keep the timer from holding the event loop open on its own; SIGTERM is
  // what actually decides shutdown, this just stops the interval from
  // outlasting the rest of the process.
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
  logger.log?.(`[commit-ledger-scheduler] armed: intervalMs=${safeInterval}, periodicMaxCommits=${periodicMaxCommits}`);

  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      logger.log?.('[commit-ledger-scheduler] stopped');
    },
    runNow: async ({ maxCommits = periodicMaxCommits } = {}) => {
      if (stopped) return null;
      if (hasInFlightJob(jobs, schedulerSource)) return null;
      return dispatchSyncJob({
        runJob,
        jobs,
        source: schedulerSource,
        maxCommits,
        trigger: 'manual',
      });
    },
    status: () => ({
      stopped,
      intervalMs: safeInterval,
      startupMaxCommits,
      periodicMaxCommits,
      startupJobId,
      lastPeriodicJobId,
      lastPeriodicAt,
    }),
  };
}
