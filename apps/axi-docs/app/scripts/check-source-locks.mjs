import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd(), '..');
const lockPath = path.join(repoRoot, 'docs', 'sources.lock.json');

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

function validateSha(value, sourceId) {
  if (!/^[0-9a-f]{40}$/iu.test(value)) {
    throw new Error(`Source "${sourceId}" has invalid commit SHA: ${value}`);
  }
}

function validateSource(sourceId, source) {
  const requiredStringFields = ['repo', 'ref', 'commit', 'localPathEnv'];
  for (const field of requiredStringFields) {
    if (typeof source[field] !== 'string' || source[field].trim() === '') {
      throw new Error(`Source "${sourceId}" is missing required string field "${field}".`);
    }
  }
  validateSha(source.commit, sourceId);
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

for (const [sourceId, source] of entries) {
  validateSource(sourceId, source);

  const localPath = resolveLocalPath(source);
  const head = runGit(['rev-parse', 'HEAD'], localPath);
  if (head.status !== 0) {
    if (source.requiredForBuild) {
      throw new Error(
        [
          `Source "${sourceId}" is not available at ${localPath}.`,
          `Set ${source.localPathEnv} or checkout ${source.repo} at ${source.commit}.`,
        ].join(' '),
      );
    }
    console.warn(`[source-lock] skipped optional source "${sourceId}": ${localPath}`);
    continue;
  }

  const actualCommit = head.stdout.trim();
  if (actualCommit !== source.commit) {
    throw new Error(
      [
        `Source "${sourceId}" is at ${actualCommit}, but docs/sources.lock.json pins ${source.commit}.`,
        `Update the lock file intentionally after validating the new source snapshot.`,
      ].join(' '),
    );
  }

  const status = runGit(['status', '--porcelain'], localPath);
  const dirty = status.status === 0 && status.stdout.trim().length > 0;
  console.log(`[source-lock] ${sourceId} pinned at ${actualCommit}${dirty ? ' (local tree has uncommitted changes)' : ''}`);
}

console.log('[source-lock] external source locks passed.');
