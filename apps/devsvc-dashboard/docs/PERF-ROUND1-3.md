# devsvc-dashboard — Performance Test Report (Round 1–3)

> Project: `@axi/devsvc-dashboard` (workbench/axi-workbench)
> Branch: `dev`
> Date: 2026-09-29
> Operator: ZCode interactive session
> Methodology: `node /Volumes/code/workspace/.axi-perf/measure.mjs` — 3 rounds × 6 concurrent downloads, decode gzip/brotli, report wire + decoded sizes for HTML and initial assets.

## CORE FLOW

The application boots into `/overview` (OverviewPage). The user can then navigate to:

1. `/overview` — overview dashboard with charts.
2. `/services` — services list (heavyest page, uses AxiCrud + AxiTable).
3. `/servers` — server list (similar CRUD UI).
4. `/alerts` — alerts list.
5. `/observability` — observability dashboards.
6. `/deploy` — deploy UI.
7. `/axi-resources` — Axi UI resource catalogue.
8. `/apps/:id` — embedded hosted mini-apps.

A representative "CORE FLOW" used for this measurement:

- Open `/` (SPA shell — `<div id="root">`).
- Pull HTML.
- Pull every asset referenced by HTML at first paint.
- Measure wire (transfer size, post-encoding) and decoded (raw bytes after gzip/br decompression).
- 6 parallel downloads, 3 iterations, average reported.

Interaction response, CPU, memory, and visible jank were **not** measured in this round because the test rig is a Node-side curl-based harness, not a headless browser. They are recorded as known gaps for follow-up.

## Measurement results

| Round | Change | Initial assets | Wire KB | Decoded KB | JS decoded KB | CSS decoded KB | HTML TTFB |
|-------|--------|----------------|---------|------------|---------------|-----------------|-----------|
| **baseline** | (none — fresh baseline) | 10 | **1078.8** | **4062.0** | **3845.3** | **216.6** | 2.46 ms |
| **lazy-round1** | Route-level `lazy()` for 7 pages + `RouteFallback` inside `Shell.tsx` | 10 | 1067.1 | 4012.2 | 3795.6 | 216.6 | 3.22 ms |
| **chunk-split-round2** | Fix `chunkVendor` regex in `vite.config.ts` (`/foundation/axi-ui/packages/...` + `/shared/axi-ui/packages/...` + `/node_modules/@axi/...`), relax `maxChunkSizeBytes` 1 MB → 2 MB | 19 | 1076.4 | 4013.8 | 3796.4 | 217.4 | 3.84 ms |
| **lazy-shell-round3** | Lazy-load `Shell` in `AppRouter.tsx`, move `@axi/shell` + `@axi/settings` + `@axi/widgets` CSS from `main.tsx` (eager) into `Shell.tsx` (lazy); move `@axi/crud/styles.css` from `main.tsx` into `ServicesPage.tsx` | **12** | **995.6** | **3764.9** | **3672.1** | **92.9** | 2.92 ms |

### Δ vs baseline

| Round | Wire | Decoded | JS | CSS |
|-------|------|---------|----|-----|
| lazy-round1 | −1.1% | −1.2% | −1.3% | 0.0% |
| chunk-split-round2 | −0.2% | −1.2% | −1.3% | +0.3% |
| **lazy-shell-round3** | **−7.7%** | **−7.3%** | **−4.5%** | **−57.1%** |

## What was learned

1. **Route-level lazy alone is a small win (≈ 50 KB wire, −1.1 %).**
   The 7 page components themselves are tiny; the bigger code sits in `@axi/crud`, `@axi/shell`, `@axi/widgets`. Vite's `<link rel="modulepreload">` for adjacent async chunks already pulls a lot of what the page needs at first paint.

2. **`chunkVendor` regex had a stale `/shared/axi-ui/packages/...` path.**
   The actual pnpm-link target is `/foundation/axi-ui/packages/...`. With only the old path matched, every `@axi/*` module was silently coalesced back into the entry chunk. The fix is structural — the new `inAxiUi(name)` helper matches both paths so future renames still work.

3. **The real win is moving CSS imports out of the synchronous entry.**
   Vite hoists every `import "*.css"` from the import graph into `<link rel="stylesheet">` tags inside the HTML head. Four `@axi/*` CSS files (`shell`, `crud`, `settings`, `widgets`) totaling **217 KB decoded / 60 KB gzip** were being downloaded at first paint even though their content was only needed once the corresponding page/shell rendered. Moving them behind `lazy()` boundaries drops the initial CSS bundle by 57.1 % and frees ~83 KB of wire.

4. **`<link rel="modulepreload">` does NOT preload lazy chunks.**
   It preloads JS chunks that the static graph references. CSS attached to a lazy JS chunk is only fetched when the lazy chunk itself is fetched, which is what makes round 3 work.

## Why each change was kept

| Change | Verdict | Reason |
|--------|---------|--------|
| Route-level `lazy()` for 7 pages | **Kept** | Even with small byte win, it makes future per-page code-splitting possible (e.g. moving `recharts` into OverviewPage). |
| `chunkVendor` regex fix | **Kept** | Pure correctness fix — restores intended chunk boundaries. Without it, the @axi/* packages would always stay in the entry chunk no matter what you do. |
| Lazy Shell + dynamic CSS | **Kept** | Largest single win (−83 KB wire / −297 KB decoded / −123 KB CSS). |

## Bottlenecks still remaining (next round candidates)

Initial-paint wire (995 KB gzip) still has two huge individual assets:

| Asset | Wire | Decoded | Why still initial |
|-------|------|---------|-------------------|
| `antd-CYJh2jnR.js` | 517 KB | 1700 KB | Most antd components are reachable from `AppRouter` -> `Shell` -> `OverviewPage` charts. Cannot easily defer. |
| `axi-core-MoEyEwg3.js` | 298 KB | 1424 KB | The icon data chunks (`icon-data-chunks/chunk-N.ts`) and the icon registry are eagerly required by `getAxiIconData()` even though icons are only displayed per-page. |
| `charts-BsMw6plP.js` | 103 KB | 364 KB | Recharts; reachable from OverviewPage. Could be lazy-loaded only when OverviewPage mounts. |

Other candidates worth a follow-up round each:

- **Defer Recharts until OverviewPage is in viewport** — saves ~103 KB wire / ~365 KB decoded at first paint.
- **Make `axi-core-icons-*` truly lazy** — currently they sit in `axi-core` because `AxiDashboardShell` uses icons in the sidebar. Split the sidebar icons into a separate chunk and only fetch when the sidebar mounts (which is the same time as the Shell, so not strictly lazy, but allows the icon-data chunks to move out of the entry path).
- **Tree-shake AntD** — the current build pulls the whole antd bundle. A per-component tree-shake pass (`vite-plugin-style-import` with `babel-plugin-import`) could remove unused antd components.
- **Reduce `axi-core` to the actual surface used** — `@axi/core` is 1.4 MB raw. It exports `getAxiIconData`, `createAxiAntdTheme`, `AxiTag`, `AxiSvgIcon`, etc. A consumption audit should identify any exports that are imported but never called.

## Interaction / CPU / memory — not measured in this round

The current harness is HTTP-based and does not run a browser. To address the original task statement fully, a follow-up round with Playwright / Puppeteer is required to capture:

- Time to first interactive (TTFI) and Time to Interactive (TTI).
- Per-navigation transition latency (e.g. `/overview` → `/services`).
- Cumulative layout shift and dropped frames during route transitions.
- CPU and memory profiles over the CORE FLOW.

This is out of scope for round 1–3 because the build kept crashing until `@axi/icons` was added and the vite config regex was corrected, which had to happen before the bundle could be measured at all.

## Reproduce

```bash
cd /Volumes/code/workspace/workbench/axi-workbench/apps/devsvc-dashboard
pnpm build
pnpm preview &      # serves on http://127.0.0.1:17890
node /Volumes/code/workspace/.axi-perf/measure.mjs \
  http://127.0.0.1:17890/ \
  <label>            # writes /Volumes/code/workspace/.axi-perf/<label>.json
```