#!/usr/bin/env node
// R001 — no-fragmented-commits guard
//
// Rule file: ../../../docs/rules/R001-no-fragmented-commits.md
//
// 违反时 exit 1 并给出修复路径;通过时 exit 0。
//
// 判定规则(staged 文件):
//   - 跨 ≥3 个根目录 → 违反,除非 commit message 含 `Reason:` trailer。
//   - 由于 git commit message 在 `git diff --staged` 时刻尚未提交,本脚本读取
//     `.git/COMMIT_EDITMSG` 作为"作者意图"代理(commit-msg hook 阶段会写该文件)。
//   - 若该文件不存在(例如通过 `git commit --no-verify` 绕过),则按"无 Reason"处理。

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const THRESHOLD = 3;
const RULE_ID = 'R001';

function gitRoot() {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
}

function stagedFiles(root) {
  const out = execSync('git diff --staged --name-only', {
    encoding: 'utf8',
    cwd: root,
  }).trim();
  if (!out) return [];
  return out.split('\n').filter(Boolean);
}

function topDirs(files) {
  const set = new Set();
  for (const f of files) {
    const top = f.split('/')[0];
    set.add(top);
  }
  return [...set];
}

function hasReasonTrailer(root) {
  const msgPath = path.join(root, '.git', 'COMMIT_EDITMSG');
  if (!existsSync(msgPath)) return false;
  const text = readFileSync(msgPath, 'utf8');
  // trailers are case-insensitive on the key; we accept `Reason: ...`
  // or `Reason-xxx: ...` (e.g. `Reason-no-split:`) as bypass proof.
  return /^Reason(?:-[\w-]+)?:\s*\S+/im.test(text);
}

function main() {
  const root = gitRoot();
  const files = stagedFiles(root);
  if (files.length === 0) {
    // No staged changes — nothing to check.
    process.exit(0);
  }
  const dirs = topDirs(files);
  if (dirs.length < THRESHOLD) {
    process.exit(0);
  }
  if (hasReasonTrailer(root)) {
    // Explicit bypass.
    process.exit(0);
  }
  console.error(
    `[${RULE_ID}] staged commit 跨越 ${dirs.length} 个根目录 (阈值 ${THRESHOLD}): ${dirs.join(', ')}`,
  );
  console.error('如确需合并跨目录的改动,在 commit message 末尾加 `Reason: <解释>` trailer 放行;');
  console.error('否则请拆为多个 feature commit 或 `git restore --staged <files>`。');
  console.error('详见 docs/rules/R001-no-fragmented-commits.md。');
  process.exit(1);
}

main();
