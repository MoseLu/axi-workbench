#!/usr/bin/env node
// assets:lint — fail if tracked image > HARD_LIMIT_KB and has no WebP sibling.
// Soft-warns on > SOFT_LIMIT_KB without a WebP sibling.
//
// Runs against `git ls-files`, so it only inspects tracked images.
// Reads blob sizes via `git cat-file -s` to avoid filesystem mtime surprises.
//
// Exit code: 0 if no hard violations, 1 if any hard violation.
import { execSync } from 'node:child_process';

const HARD_LIMIT_KB = 500;
const SOFT_LIMIT_KB = 200;

const tracked = execSync('git ls-files "*.png" "*.jpg" "*.jpeg" "*.gif"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

if (tracked.length === 0) {
  console.log('No tracked images found. Nothing to lint.');
  process.exit(0);
}

let hardViolations = 0;
let softWarnings = 0;
const hardList = [];
const softList = [];

for (const f of tracked) {
  let size;
  try {
    size = parseInt(
      execSync(`git cat-file -s HEAD:"${f}"`, { encoding: 'utf8' }).trim(),
      10,
    );
  } catch (e) {
    console.warn(`⚠ skip ${f}: ${e.message?.split('\n')[0] ?? e.message}`);
    continue;
  }
  if (Number.isNaN(size)) continue;
  const kb = size / 1024;

  const webpSibling = f.replace(/\.(png|jpe?g)$/i, '.webp');
  let webpTracked = '';
  try {
    webpTracked = execSync(`git ls-files "${webpSibling}" || true`, {
      encoding: 'utf8',
    }).trim();
  } catch {
    // ignore — sibling just doesn't exist
  }

  if (kb > HARD_LIMIT_KB && !webpTracked) {
    console.error(`✗ HARD ${f}: ${kb.toFixed(0)}KB > ${HARD_LIMIT_KB}KB and no .webp sibling`);
    hardList.push(f);
    hardViolations++;
  } else if (kb > SOFT_LIMIT_KB && !webpTracked) {
    console.warn(`⚠ SOFT ${f}: ${kb.toFixed(0)}KB > ${SOFT_LIMIT_KB}KB, consider .webp sibling`);
    softList.push(f);
    softWarnings++;
  }
}

console.log(
  `\nResult: scanned ${tracked.length} tracked images, ${hardViolations} hard violations, ${softWarnings} soft warnings`,
);
if (hardViolations > 0) {
  console.error(`\nHard violations:\n  - ${hardList.join('\n  - ')}`);
}
if (softWarnings > 0 && hardViolations === 0) {
  console.warn(`\nSoft warnings:\n  - ${softList.join('\n  - ')}`);
}
process.exit(hardViolations > 0 ? 1 : 0);