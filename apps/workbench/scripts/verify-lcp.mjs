#!/usr/bin/env node
// verify-lcp.mjs — report LCP / FCP / CLS for the local workbench app.
//
// The target URL is read from LCP_URL (default http://127.0.0.1:3602/) and
// the app must already be running (dev server or preview). All repo paths
// are resolved relative to this script via import.meta.url — no absolute
// workspace paths — so the check works from any checkout location.
//
// Usage:
//   node apps/workbench/scripts/verify-lcp.mjs [--headed] [--help]
//
// Env:
//   LCP_URL      target URL (default: http://127.0.0.1:3602/)
//   CHROME_PATH  Chrome/Chromium executable (falls back to Playwright's bundle)
//
// Requires: playwright (devDependency of apps/workbench).

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// apps/workbench/scripts -> apps/workbench -> apps -> repo root
const REPO_ROOT = resolve(__dirname, '../../..');
const APP_DIR = resolve(REPO_ROOT, 'apps/workbench');

const args = process.argv.slice(2);
const wantsHelp = args.includes('--help') || args.includes('-h');
const headed = args.includes('--headed');
const targetUrl = process.env.LCP_URL ?? 'http://127.0.0.1:3602/';
const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (wantsHelp) {
  console.log(`verify-lcp.mjs — measure LCP / FCP / CLS on a running workbench app

Usage:
  node apps/workbench/scripts/verify-lcp.mjs [--headed] [--help]

Options:
  --headed   run with a visible browser window
  --help     print this help and exit

Environment:
  LCP_URL      target URL (default: ${targetUrl})
  CHROME_PATH  Chrome/Chromium executable (default: ${chromePath})

Repo-relative paths resolved from this script (import.meta.url):
  script dir: ${__dirname}
  app dir:    ${APP_DIR}
  repo root:  ${REPO_ROOT}

The app must already be running (for example: pnpm --filter workbench dev);
this script does not start a server.`);
  process.exit(0);
}

if (!existsSync(APP_DIR)) {
  console.error(`verify-lcp: app directory not found at ${APP_DIR}`);
  process.exit(2);
}
if (!existsSync(resolve(APP_DIR, 'dist/index.html'))) {
  console.error(
    `verify-lcp: note: ${resolve(APP_DIR, 'dist/index.html')} is absent — measuring ${targetUrl} requires a running dev/preview server`,
  );
}

const { chromium } = await import('playwright');

const executablePath = existsSync(chromePath) ? chromePath : undefined;
const browser = await chromium.launch({
  headless: !headed,
  executablePath,
  args: ['--no-sandbox'],
});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(targetUrl, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const v = await page.evaluate(
    () =>
      new Promise((r) => {
        const o = { lcp: null, fcp: null, cls: null };
        try {
          new PerformanceObserver((l) => {
            o.lcp = l.getEntries().at(-1)?.startTime ?? null;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {}
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') o.fcp = e.startTime;
          }).observe({ type: 'paint', buffered: true });
        } catch {}
        try {
          new PerformanceObserver((l) => {
            let c = 0;
            for (const e of l.getEntries()) if (!e.hadRecentInput) c += e.value;
            o.cls = c;
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
        setTimeout(() => r(o), 800);
      }),
  );
  console.log(JSON.stringify({ url: targetUrl, ...v }, null, 2));
} finally {
  await browser.close();
}
