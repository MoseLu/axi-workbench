#!/usr/bin/env node
// R003 — mcp-log-dir-must-match guard.
//
// Rule file: ../../../docs/rules/R003-mcp-log-dir-must-match.md
//
// Strategy:
//   1. Find every path-string assignment under `app/src/mcp/**` and
//      `app/scripts/**` that ends with a `logs/runtime/...` literal.
//   2. Extract the directory portion (everything before the basename).
//   3. If multiple distinct directories are referenced, exit 1 and list
//      them; otherwise exit 0.
//
// This is a self-check for `axi-docs` itself. Other projects with MCP
// servers should mirror this guard with their own paths.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const RULE_ID = 'R003';
const repoRoot = path.resolve(process.cwd(), '..');

function* walkJs(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      yield* walkJs(p);
    } else if (/\.(mjs|cjs|js|ts|tsx)$/.test(entry)) {
      yield p;
    }
  }
}

function extractLogDirs(text) {
  // Match any string literal containing 'logs/runtime/...'.
  // Captures the path prefix up to (but not including) a basename marker
  // such as '/preview.' or '/dev.' or a closing quote.
  const re = /['"`](logs\/runtime\/[^'"`]+?)(?:\/[A-Za-z][\w.-]*\.[a-z]+\$?|\s*['"`])/g;
  const out = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const dir = m[1];
    out.add(dir);
  }
  return out;
}

function main() {
  const scopes = [
    path.join(repoRoot, 'app', 'src', 'mcp'),
    path.join(repoRoot, 'app', 'scripts'),
  ];
  // Skip rule/script files that intentionally embed the literal paths as
  // documentation or test fixtures (avoid self-flagging).
  const selfFiles = new Set([
    path.join(repoRoot, 'docs', 'rules', 'R003-mcp-log-dir-must-match.md'),
    path.join(repoRoot, 'docs', 'rules', 'R002-naming-singular-plural.md'),
    path.join(repoRoot, 'app', 'scripts', 'check-mcp-log-dir.mjs'),
    path.join(repoRoot, 'app', 'scripts', 'check-naming-drift.mjs'),
  ]);
  const allDirs = new Set();
  const foundIn = new Map(); // dir -> file
  for (const scope of scopes) {
    let exists = false;
    try {
      exists = statSync(scope).isDirectory();
    } catch {
      continue;
    }
    if (!exists) continue;
    for (const file of walkJs(scope)) {
      if (selfFiles.has(file)) continue;
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const dirs = extractLogDirs(text);
      for (const d of dirs) {
        if (!foundIn.has(d)) foundIn.set(d, file);
        allDirs.add(d);
      }
    }
  }
  // Filter placeholder regex templates: any captured `dir` that is just
  // a regex partial (e.g. ends with `...` or `{`) is documentation-only.
  const real = [...allDirs].filter((d) => !/[.{]\s*$/.test(d) && !d.endsWith('...'));
  if (real.length <= 1) {
    console.log(`[${RULE_ID}] ok (${real.length} 个 logs/runtime 路径)`);
    process.exit(0);
  }
  console.error(`[${RULE_ID}] 发现 ${real.length} 个不同的 logs/runtime 路径:`);
  for (const d of real) {
    const f = path.relative(repoRoot, foundIn.get(d) || '?');
    console.error(`  - '${d}' (首现于 ${f})`);
  }
  console.error('所有 MCP 读端与 launcher 写端应引用同一路径常量。');
  process.exit(1);
}

main();