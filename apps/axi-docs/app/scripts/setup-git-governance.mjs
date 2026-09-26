import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`Git command failed: git ${args.join(' ')}`);
  }

  return options.capture ? result.stdout.trim() : '';
}

if (!existsSync('.git')) {
  git(['init', '-b', 'dev']);
}

git(['config', 'core.hooksPath', '.githooks']);

const currentBranch = git(['branch', '--show-current'], { capture: true });
const hasHeadCommit =
  spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  }).status === 0;

if (!hasHeadCommit) {
  if (!currentBranch || currentBranch === 'main' || currentBranch === 'master') {
    git(['symbolic-ref', 'HEAD', 'refs/heads/dev']);
  }

  console.log('[governance] git flow bootstrap complete for an unborn dev branch.');
  process.exit(0);
}

const hasDevBranch = git(['branch', '--list', 'dev'], { capture: true }).trim().length > 0;

if (!hasDevBranch) {
  if (!currentBranch || currentBranch === 'main' || currentBranch === 'master') {
    git(['checkout', '-b', 'dev']);
  } else {
    git(['branch', 'dev']);
  }
} else if (currentBranch === 'main' || currentBranch === 'master') {
  git(['checkout', 'dev']);
}

console.log('[governance] git flow bootstrap complete.');
