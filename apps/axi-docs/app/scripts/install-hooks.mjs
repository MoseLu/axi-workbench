import { existsSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

const rootDir = process.cwd();

if (!existsSync(path.join(rootDir, '.git'))) {
  run('git', ['init', '-b', 'dev']);
}

run('git', ['config', 'core.hooksPath', '.githooks']);
run('node', ['./scripts/setup-git-governance.mjs']);

for (const hookName of ['pre-commit', 'pre-push', 'commit-msg']) {
  const hookPath = path.join(rootDir, '.githooks', hookName);
  await chmod(hookPath, 0o755);
}

console.log('[governance] Git hooks installed.');
