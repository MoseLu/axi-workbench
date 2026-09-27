#!/usr/bin/env node
// R002 — naming-singular-plural guard.
//
// Rule file: ../../../docs/rules/R002-naming-singular-plural.md
//
// Strategy:
//   1. Maintain a list of (canonical, forbidden) pairs, e.g.
//      ['logs/runtime/mac-app', 'logs/runtime/mac-apps']. The forbidden
//      form, if found anywhere in the NEW source/config, exits 1.
//   2. Scope: app/ and docs/rules/ under the project root; recursively.
//      Other paths under docs/ (state, governance, content) are
//      historical archives and may legitimately cite the forbidden form
//      when describing past incidents.
//   3. Allow-list: any path that contains both forms is reported with the
//      full path so the developer can decide.
//
// Pairs are loaded from the frontmatter `forbidden-pairs` field of the
// rule file (default to a hard-coded fallback if absent). To add a
// pair, edit the rule file's frontmatter; no code change needed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const RULE_ID = 'R002';
const repoRoot = path.resolve(process.cwd(), '..');

function loadForbiddenPairs() {
  const rulePath = path.join(repoRoot, 'docs', 'rules', 'R002-naming-singular-plural.md');
  // Default pair from the original incident.
  const fallback = [['logs/runtime/mac-app', 'logs/runtime/mac-apps']];
  try {
    const text = readFileSync(rulePath, 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) return fallback;
    const m = fm[1].match(/^forbidden-pairs:\s*\[(.*?)\]/m);
    if (!m) return fallback;
    const pairs = [...m[1].matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)].map((x) => [
      x[1],
      x[2],
    ]);
    return pairs.length > 0 ? pairs : fallback;
  } catch {
    return fallback;
  }
}

function* walk(dir) {
  // Skip noise.
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const p = path.join(dir, entry);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(p);
    } else if (st.isFile()) {
      yield p;
    }
  }
}

function main() {
  const pairs = loadForbiddenPairs();
  const scopes = ['app', 'docs/rules'];
  // Skip files that legitimately reference `forbidden` for the purpose of
  // documenting or testing the rule (the rule file itself, plus this
  // script which embeds the canonical/forbidden pair in code).
  const selfFiles = new Set([
    path.join(repoRoot, 'docs', 'rules', 'R002-naming-singular-plural.md'),
    path.join(repoRoot, 'docs', 'rules', 'R003-mcp-log-dir-must-match.md'),
    path.join(repoRoot, 'app', 'scripts', 'check-naming-drift.mjs'),
    path.join(repoRoot, 'app', 'scripts', 'check-mcp-log-dir.mjs'),
  ]);
  const violations = [];
  for (const scope of scopes) {
    const root = path.join(repoRoot, scope);
    let exists = false;
    try {
      exists = statSync(root).isDirectory();
    } catch {
      continue;
    }
    if (!exists) continue;
    for (const file of walk(root)) {
      if (selfFiles.has(file)) continue;
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const [canon, forbidden] of pairs) {
        if (text.includes(forbidden)) {
          violations.push({ file: path.relative(repoRoot, file), forbidden, canon });
        }
      }
    }
  }
  if (violations.length === 0) {
    console.log(`[${RULE_ID}] ok (${pairs.length} 对全部一致)`);
    process.exit(0);
  }
  console.error(`[${RULE_ID}] 发现 ${violations.length} 处 forbidden 命名:`);
  for (const v of violations) {
    console.error(`  - ${v.file}: 含 '${v.forbidden}' (canonical: '${v.canon}')`);
  }
  console.error('请将所有引用迁移到 canonical 形式后重跑。');
  process.exit(1);
}

main();