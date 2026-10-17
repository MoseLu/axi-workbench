#!/usr/bin/env node
// Optimize tracked PNGs: derive WebP siblings.
// Requires: cwebp on PATH (apt: webp; brew: webp)
// Additive: never deletes originals. WebP siblings are sidecars that
// consumers may opt into via <picture> / <source srcset=".webp">.
//
// Threshold defaults to 500 KB; tune via FIRST arg if needed:
//   node scripts/optimize-images.mjs 200     # lower threshold to 200 KB
//   node scripts/optimize-images.mjs 1000    # raise threshold to 1 MB
import { readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const THRESHOLD_KB = Number(process.argv[2] ?? 500);
const CWEBP_QUALITY = 80;
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
  '.pnpm-store',
  // backend-generated pdf artifacts (not authored by humans):
  'apps/app-search-system/backend/pdf_images',
]);
const IMAGE_RE = /\.(png|jpe?g)$/i;

const execFileP = promisify(execFile);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.isFile() && IMAGE_RE.test(e.name)) {
      yield p;
    }
  }
}

let converted = 0;
let skipped = 0;
let failed = 0;
let alreadyHadWebp = 0;
const failures = [];

for await (const f of walk(ROOT)) {
  const s = await stat(f);
  if (s.size < THRESHOLD_KB * 1024) {
    skipped++;
    continue;
  }
  const webp = f.replace(/\.(png|jpe?g)$/i, '.webp');
  // skip if webp sibling already on disk
  try {
    await stat(webp);
    alreadyHadWebp++;
    continue;
  } catch {
    // not present, continue
  }
  try {
    await execFileP('cwebp', ['-q', String(CWEBP_QUALITY), '-m', '6', f, '-o', webp]);
    const ws = await stat(webp);
    const saving = (((s.size - ws.size) / s.size) * 100).toFixed(1);
    console.log(
      `✓ ${relative(ROOT, f)} (${(s.size / 1024).toFixed(0)}KB -> ${(ws.size / 1024).toFixed(0)}KB, -${saving}%)`,
    );
    converted++;
  } catch (e) {
    console.warn(`✗ ${relative(ROOT, f)}: ${e.message?.split('\n')[0] ?? e.message}`);
    failures.push(relative(ROOT, f));
    failed++;
  }
}

console.log(
  `\nSummary: ${converted} converted, ${alreadyHadWebp} already had .webp, ${skipped} skipped (< ${THRESHOLD_KB}KB), ${failed} failed`,
);
if (failed > 0) {
  console.warn(`Failed files:\n  - ${failures.join('\n  - ')}`);
}
process.exit(failed > 0 ? 1 : 0);