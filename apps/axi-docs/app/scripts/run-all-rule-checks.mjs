#!/usr/bin/env node
// Run all R-NNN rule guards by walking docs/rules/ frontmatter.
//
// Reads each `R*.md` file's `verified-by` field and invokes the
// corresponding `pnpm rule:check-<id>` script. Exits 0 only if every
// guard exits 0; otherwise prints a summary and exits 1.
//
// Used by `pnpm rule:check` and plugged into `pnpm verify`.

import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const rulesDir = path.join(repoRoot, 'docs', 'rules');
const appDir = path.join(repoRoot, 'app');

function listRuleFiles() {
  return readdirSync(rulesDir)
    .filter((f) => /^R\d{3}-.+\.md$/.test(f))
    .sort();
}

function extractFrontmatter(text) {
  // Tiny frontmatter parser — only used to read `verified-by`.
  // Matches `verified-by: <value>` in the YAML block at the top of the file.
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const body = m[1];
  const field = name => {
    const re = new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'm');
    const r = body.match(re);
    return r ? r[1] : undefined;
  };
  return { id: field('id'), verifiedBy: field('verified-by'), status: field('status') };
}

function runOne(ruleFile, fm) {
  if (fm.status && fm.status.startsWith('superseded-by')) {
    console.log(`[run-all-rule-checks] skip ${fm.id || ruleFile} (${fm.status})`);
    return { ok: true, skipped: true };
  }
  if (!fm.verifiedBy) {
    console.error(`[run-all-rule-checks] ${ruleFile} 缺 verified-by frontmatter`);
    return { ok: false, skipped: false };
  }
  // verified-by is `pnpm --dir app rule:check-<short>`; extract `<short>`.
  const m = fm.verifiedBy.match(/rule:check-([\w-]+)/);
  if (!m) {
    console.error(`[run-all-rule-checks] ${ruleFile} verified-by 无法解析: ${fm.verifiedBy}`);
    return { ok: false, skipped: false };
  }
  const short = m[1];
  console.log(`[run-all-rule-checks] -> pnpm rule:check-${short}`);
  const r = spawnSync('pnpm', ['rule:check-' + short], {
    cwd: appDir,
    stdio: 'inherit',
    env: process.env,
  });
  return { ok: r.status === 0, skipped: false };
}

function main() {
  const files = listRuleFiles();
  if (files.length === 0) {
    console.log('[run-all-rule-checks] no R-NNN files in docs/rules; nothing to do.');
    process.exit(0);
  }
  const results = [];
  for (const f of files) {
    const text = readFileSync(path.join(rulesDir, f), 'utf8');
    const fm = extractFrontmatter(text);
    results.push({ file: f, ...runOne(f, fm) });
  }
  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`[run-all-rule-checks] total=${results.length} failed=${failed.length}`);
  if (failed.length > 0) {
    console.error('failed:');
    for (const f of failed) console.error(`  - ${f.file}`);
    process.exit(1);
  }
}

main();
