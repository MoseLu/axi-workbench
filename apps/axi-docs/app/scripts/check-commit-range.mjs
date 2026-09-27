import { spawnSync } from 'node:child_process';

function readFlagValue(flagName) {
  const flags = process.argv.slice(2);
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Expected a value after ${flagName}`);
  }

  return value;
}

function git(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (result.status !== 0) {
    throw new Error(`Git command failed: git ${args.join(' ')}`);
  }

  return result.stdout.trim();
}

function normalizeFromSha(value) {
  if (!value || /^0+$/.test(value)) {
    return git(['rev-list', '--max-parents=0', 'HEAD']).split(/\r?\n/)[0];
  }

  return value;
}

const from = normalizeFromSha(
  readFlagValue('--from') ??
    process.env.AXI_DOCS_COMMIT_FROM ??
    '',
);
const to =
  readFlagValue('--to') ??
  process.env.AXI_DOCS_COMMIT_TO ??
  process.env.GITHUB_SHA ??
  'HEAD';

const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'commitlint', '--from', from, '--to', to, '--verbose'],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  throw new Error(`Conventional commit check failed for range ${from}..${to}`);
}

console.log(`[governance] commit range accepted: ${from}..${to}`);
