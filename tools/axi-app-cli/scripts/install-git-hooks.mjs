#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('.git') || !existsSync('.githooks')) {
  process.exit(0);
}

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  encoding: 'utf8',
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
