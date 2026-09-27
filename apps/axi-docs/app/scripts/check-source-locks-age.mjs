#!/usr/bin/env node
// Age monitor for docs/sources.lock.json.
//
// Detects how far each locked commit has drifted from the current HEAD
// of its source repository. The companion check-source-locks.mjs throws
// on any mismatch (strict equality); this script is the soft, advisory
// counterpart that surfaces gradual drift before it trips the strict
// check.
//
// Defaults are warnings only (exit 1). --strict turns warnings into hard
// failures (exit 2). --json emits a machine-readable summary.
//
// Thresholds (both must hold for an OK verdict):
//   - commit distance (commits the locked commit is behind HEAD) <= MAX_COMMITS
//   - age distance (committer-time delta between lock commit and HEAD) <= MAX_DAYS

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd(), '..');
const lockPath = path.join(repoRoot, 'docs', 'sources.lock.json');

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const JSON_OUT = argv.includes('--json');
const MAX_COMMITS = Number(process.env.AXI_SOURCE_LOCK_MAX_COMMITS ?? 5);
const MAX_DAYS = Number(process.env.AXI_SOURCE_LOCK_MAX_DAYS ?? 7);

function runGit(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveLocalPath(source) {
  const envPath = source.localPathEnv ? process.env[source.localPathEnv] : '';
  return path.resolve(envPath || source.defaultLocalPath || '');
}

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : '(none)';
}

const raw = await readFile(lockPath, 'utf8');
const lock = JSON.parse(raw);

if (lock.version !== 1 || typeof lock.sources !== 'object' || lock.sources === null) {
  throw new Error('docs/sources.lock.json must contain version: 1 and a sources object.');
}

const entries = Object.entries(lock.sources);
if (entries.length === 0) {
  throw new Error('docs/sources.lock.json must lock at least one external source.');
}

const findings = [];
let worstSeverity = 'ok'; // 'ok' | 'warn' | 'fail'

for (const [sourceId, source] of entries) {
  const localPath = resolveLocalPath(source);
  const head = runGit(['rev-parse', 'HEAD'], localPath);
  if (head.status !== 0) {
    findings.push({
      source: sourceId,
      severity: 'skip',
      reason: `cannot read HEAD at ${localPath}`,
    });
    continue;
  }
  const actualHead = head.stdout.trim();

  const lockedSha = source.commit;
  if (actualHead === lockedSha) {
    findings.push({
      source: sourceId,
      severity: 'ok',
      locked: shortSha(lockedSha),
      actual: shortSha(actualHead),
      commitsBehind: 0,
      daysBehind: 0,
    });
    continue;
  }

  // Locked sha must reference a real object in the source repo. If not, the
  // lock is referencing a commit that was force-pushed away, never existed,
  // or lives on a different ref than the one we can read locally.
  const lockObj = runGit(['cat-file', '-t', lockedSha], localPath);
  if (lockObj.status !== 0 || lockObj.stdout.trim() !== 'commit') {
    findings.push({
      source: sourceId,
      severity: 'warn',
      locked: shortSha(lockedSha),
      actual: shortSha(actualHead),
      commitsBehind: null,
      daysBehind: null,
      reason: `locked commit ${shortSha(lockedSha)} is not a valid object in ${localPath}`,
    });
    if (worstSeverity === 'ok') worstSeverity = 'warn';
    continue;
  }

  // Count commits the locked sha is behind HEAD and read each one's date.
  const revList = runGit(
    ['rev-list', '--count', `${lockedSha}..${actualHead}`],
    localPath,
  );
  const commitsBehind = Number(revList.stdout.trim() || '0');

  const logOut = runGit(
    ['log', '--format=%cI', '-n', '1', actualHead],
    localPath,
  );
  const headTime = logOut.stdout.trim();

  const lockOut = runGit(
    ['log', '--format=%cI', '-n', '1', lockedSha],
    localPath,
  );
  const lockTime = lockOut.stdout.trim();

  let daysBehind = 0;
  if (headTime && lockTime) {
    daysBehind = Math.max(
      0,
      (Date.parse(headTime) - Date.parse(lockTime)) / (1000 * 60 * 60 * 24),
    );
  }

  const overCommits = commitsBehind > MAX_COMMITS;
  const overDays = daysBehind > MAX_DAYS;
  const severity = overCommits || overDays ? 'warn' : 'ok';

  if (severity === 'warn' && worstSeverity === 'ok') worstSeverity = 'warn';

  findings.push({
    source: sourceId,
    severity,
    locked: shortSha(lockedSha),
    actual: shortSha(actualHead),
    commitsBehind,
    daysBehind: Number(daysBehind.toFixed(2)),
    overCommits,
    overDays,
    limits: { maxCommits: MAX_COMMITS, maxDays: MAX_DAYS },
  });
}

const summary = {
  thresholds: { maxCommits: MAX_COMMITS, maxDays: MAX_DAYS },
  strict: STRICT,
  findings,
};

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else {
  console.log(
    `[source-lock-age] thresholds: commits<=${MAX_COMMITS}, days<=${MAX_DAYS}, mode=${
      STRICT ? 'strict' : 'warn'
    }`,
  );
  for (const f of findings) {
    if (f.severity === 'ok') {
      console.log(`[source-lock-age] OK    ${f.source}: pinned at ${f.locked}`);
    } else if (f.severity === 'skip') {
      console.log(`[source-lock-age] SKIP  ${f.source}: ${f.reason}`);
    } else if (f.reason) {
      console.log(
        `[source-lock-age] ${
          STRICT ? 'FAIL' : 'WARN'
        }  ${f.source}: ${f.reason} (lock ${f.locked} vs HEAD ${f.actual})`,
      );
    } else {
      const reasons = [];
      if (f.overCommits) reasons.push(`commits behind=${f.commitsBehind} (>${MAX_COMMITS})`);
      if (f.overDays) reasons.push(`days behind=${f.daysBehind} (>${MAX_DAYS})`);
      console.log(
        `[source-lock-age] ${
          STRICT ? 'FAIL' : 'WARN'
        }  ${f.source}: lock ${f.locked} -> HEAD ${f.actual}; ${reasons.join(', ')}`,
      );
    }
  }
}

if (STRICT && worstSeverity === 'warn') {
  process.exit(2);
}
if (worstSeverity === 'warn') {
  process.exit(1);
}
process.exit(0);