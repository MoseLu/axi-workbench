/**
 * Commit Ledger Sync Scheduler Tests
 *
 * Covers the wiring contract between `startScheduler()` and `runSyncJob`:
 *   - one startup job is dispatched on construction (when enabled)
 *   - periodic ticks fire on the configured interval
 *   - a slow in-flight job causes the next tick to be skipped (no overlap)
 *   - `stop()` clears the interval and prevents further dispatches
 *   - `disabled=true` short-circuits with a noop handle
 *
 * The test does not depend on the real collector or git; it supplies a fake
 * `runJob` so behavior is deterministic. Tests sleep with real `setTimeout`
 * because `setInterval` is the production surface.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { startScheduler } from "./scheduler.mjs";

function fakeLogger() {
  const lines = { log: [], warn: [], error: [] };
  return {
    log: (...args) => lines.log.push(args),
    warn: (...args) => lines.warn.push(args),
    error: (...args) => lines.error.push(args),
    lines,
  };
}

/**
 * Build a runJob stub that resolves on the next macrotask so the scheduler
 * moves jobs through `queued -> running -> succeeded` deterministically.
 */
function makeRunJob() {
  const calls = [];
  let resolveNext = null;
  const runJob = async (jobId, job) => {
    calls.push({ jobId, options: job.options, source: job.source, trigger: job.trigger });
    job.status = 'running';
    // Yield until the test resolves us, so jobs stay `running` while the
    // test exercises the overlap guard.
    await new Promise((resolve) => { resolveNext = resolve; });
    job.status = 'succeeded';
    job.completedAt = new Date().toISOString();
  };
  return {
    runJob,
    calls,
    finishCurrent: () => {
      if (!resolveNext) throw new Error('no in-flight job to finish');
      const fn = resolveNext;
      resolveNext = null;
      fn();
    },
  };
}

test("scheduler: dispatches one startup sync on start", async () => {
  const jobs = new Map();
  const { runJob, calls } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    disabled: false,
    intervalMs: 60_000, // long enough not to fire during the test
    minIntervalMs: 1_000,
    runStartupSync: true,
    logger,
  });

  // setImmediate in dispatchSyncJob runs on the next macrotask.
  await sleep(20);
  assert.equal(calls.length, 1, 'startup sync should have been dispatched exactly once');
  assert.equal(calls[0].source, 'scheduler');
  assert.equal(calls[0].trigger, 'startup');
  assert.equal(calls[0].options.maxCommits, 50_000, 'startup uses startupMaxCommits default');

  await handle.stop();
});

test("scheduler: runStartupSync=false skips the immediate sweep", async () => {
  const jobs = new Map();
  const { runJob, calls } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 60_000,
    minIntervalMs: 1_000,
    runStartupSync: false,
    logger,
  });

  await sleep(20);
  assert.equal(calls.length, 0, 'no job should be dispatched when runStartupSync is false');

  await handle.stop();
});

test("scheduler: periodic tick fires after the configured interval", async () => {
  const jobs = new Map();
  const calls = [];
  // Use a non-blocking runJob so the in-flight guard never trips and ticks
  // can stack on each other at the configured cadence.
  const runJob = async (jobId, job) => {
    calls.push({ jobId, options: job.options, source: job.source, trigger: job.trigger });
    const entry = jobs.get(jobId);
    if (entry) {
      entry.status = 'succeeded';
      entry.completedAt = new Date().toISOString();
    }
  };
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 100,
    minIntervalMs: 50,
    runStartupSync: false,
    logger,
  });

  await sleep(280);
  const tickCount = calls.filter((c) => c.trigger === 'interval').length;
  assert.ok(tickCount >= 2, `expected >= 2 interval ticks, got ${tickCount}`);

  await handle.stop();
});

test("scheduler: skips a tick when the previous job is still in flight", async () => {
  const jobs = new Map();
  const { runJob, calls, finishCurrent } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 50,
    minIntervalMs: 30,
    runStartupSync: false,
    logger,
  });

  // Let at least one interval tick land and block on resolveNext.
  await sleep(80);
  const beforeFinish = calls.length;
  assert.ok(beforeFinish >= 1, 'expected at least one in-flight tick');

  // Wait for more ticks while the first job is still blocked — none should dispatch.
  await sleep(120);
  assert.equal(
    calls.length,
    beforeFinish,
    'no additional jobs should dispatch while a previous one is in flight'
  );

  // Finish the in-flight job and confirm subsequent ticks dispatch again.
  finishCurrent();
  await sleep(120);
  const afterFinish = calls.length;
  assert.ok(afterFinish > beforeFinish, 'ticks should resume after the in-flight job finishes');

  await handle.stop();
});

test("scheduler: stop() prevents further dispatches", async () => {
  const jobs = new Map();
  const { runJob, calls } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 40,
    minIntervalMs: 20,
    runStartupSync: false,
    logger,
  });

  await sleep(80);
  const beforeStop = calls.length;
  await handle.stop();
  await sleep(150);
  assert.equal(calls.length, beforeStop, 'no more dispatches after stop()');
});

test("scheduler: disabled=true returns a noop handle", async () => {
  const jobs = new Map();
  const { runJob, calls } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    disabled: true,
    intervalMs: 30,
    minIntervalMs: 20,
    runStartupSync: true,
    logger,
  });

  await sleep(80);
  assert.equal(calls.length, 0, 'disabled scheduler must not dispatch anything');

  await handle.stop();
  // runNow should also be a noop
  const out = await handle.runNow();
  assert.equal(out, null);
});

test("scheduler: runNow dispatches an out-of-band job when idle", async () => {
  const jobs = new Map();
  const { runJob, calls } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 10_000,
    minIntervalMs: 100,
    runStartupSync: false,
    logger,
  });

  const jobId = await handle.runNow({ maxCommits: 50 });
  assert.ok(jobId, 'runNow should return a jobId when idle');
  await sleep(20);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].trigger, 'manual');
  assert.equal(calls[0].options.maxCommits, 50);

  await handle.stop();
});

test("scheduler: runNow is a noop when a scheduler job is already in flight", async () => {
  const jobs = new Map();
  const { runJob, calls, finishCurrent } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 10_000,
    minIntervalMs: 100,
    runStartupSync: false,
    logger,
  });

  // Force one in-flight via runNow, then leave it blocked.
  const firstId = await handle.runNow();
  assert.ok(firstId);
  await sleep(20);

  const secondId = await handle.runNow();
  assert.equal(secondId, null, 'runNow must refuse to overlap an existing scheduler job');

  finishCurrent();
  await handle.stop();
});

test("scheduler: status reflects current lifecycle", async () => {
  const jobs = new Map();
  const { runJob } = makeRunJob();
  const logger = fakeLogger();

  const handle = startScheduler({
    runJob,
    jobs,
    intervalMs: 500,
    minIntervalMs: 100,
    runStartupSync: false,
    logger,
  });

  const s = handle.status();
  assert.equal(s.stopped, false);
  assert.equal(s.intervalMs, 500);
  assert.equal(s.startupJobId, null);
  assert.equal(s.lastPeriodicJobId, null);

  await handle.stop();
  const after = handle.status();
  assert.equal(after.stopped, true);
});
