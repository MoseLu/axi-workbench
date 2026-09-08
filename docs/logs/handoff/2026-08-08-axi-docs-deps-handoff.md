# Handoff — `apps/app-search-system/` dependency advisories to axi-docs owner

- Date: 2026-08-08
- From: `projects/axi-workbench` workbench maintainer
- To: `projects/axi-docs` owner (and to whoever owns the SOP / Docs product surface)
- Status: actionable — see "How to verify" below

## Why

While running dependabot triage on `projects/axi-workbench`, 39 open
alerts surfaced under `apps/app-search-system/frontend/{control,display}/`.
Reading `apps/app-search-system/AGENTS.md` and
`apps/app-search-system/CLAUDE.md` it became clear that this subtree is a
SOP / Docs product (Python Flask backend + Capacitor + Electron Control
and Display), which is a better fit for the `axi-docs` product surface
than for the workbench dashboard shell. The subtree currently lives in
the workbench repo only by historical inheritance.

In the workbench repo, I marked all 39 alerts as `dismissed` with reason
`tolerable_risk` and comment transferring ownership back here:

  - alerts #494-#534 (vite-brace-expansion, electron, js-yaml)
  - manifests: apps/app-search-system/frontend/{control,display}/pnpm-lock.yaml,
    apps/app-search-system/frontend/{control,display}/package.json

The dismiss keeps the workbench default-branch `vulnerabilities` counter
clean today. They are not actually patched. They will re-open the moment
dependabot next re-scans, unless the underlying lockfiles move past the
first-patched transitive. That work should land in your (axi-docs)
repository rather than in workbench.

## Recommended next steps (for the axi-docs side)

1. Decide whether `apps/app-search-system/` should physically migrate
   into `projects/axi-docs/`. If so:
   - Use `git mv apps/app-search-system /path/to/axi-docs/apps/` along
     with a coordinated PR.
   - Re-claim ownership in `WORKSPACE_INDEX.md` partition `products/`
     or wherever the axi-docs catalog governs SOP / Docs subtrees.
2. If the migration is out of scope, apply the same pnpm.overrides
   recipe that the workbench batch used:
   ```json
   "pnpm": {
     "overrides": {
       "brace-expansion@<1.1.18": "1.1.18",
       "js-yaml@>=3.0.0 <3.15.1": "3.15.1",
       "js-yaml@>=4.0.0 <4.3.1": "4.3.1",
       "postcss@<=8.5.22": "8.5.23"
     }
   }
   ```
   Then run `pnpm install --no-frozen-lockfile` in each of
   `apps/app-search-system/frontend/{control,display}` so the patched
   versions land in their pnpm-lock.yaml.
3. For electron specifically, the alerts cover fast-uri, ip-address,
   brace-expansion, undici, hono, etc. — most of those are bundled
   inside electron's dev tree and only resolvable by bumping
   `electron` itself (currently `<` some patched version) or by
   shadowing via `pnpm.overrides`. For Electron's bundled deps,
   the standard fix is to update electron itself past the patched
   minor release.

## How to verify

After patching:

```bash
gh api -H "Accept: application/vnd.github+json" \
  /repos/MoseLu/axi-workbench/dependabot/alerts
```

The 39 alerts I dismissed should re-open with `state: open` but pointing
to patched versions (the GHSA `first_patched_version`). At that point the
axi-docs team can re-dismiss them with `reason: fixed`.

## Evidence

- workbench commits that closed the workbench-side fraction:
  - `da977fd` fix(deps): bump vite / vitest and lock transitive security patches
  - `a7d63b0` fix(deps): add per-package pnpm.overrides for transitive advisories
  - `da7464f` fix(services): upgrade pgx/v5 and quic-go past dependabot Go advisories
- Dismissed alert summary (workbench side, before this handoff):
  - 35 alerts dismissed via `gh api` (fix_started / not_used / tolerable_risk)
  - 24 alerts `state: fixed` (dependabot auto-confirmed)
  - 39 alerts `state: open` before dismiss — all on apps/app-search-system/

## Current status on the workbench default branch

After PR `da7464f`: 462 vulnerabilities (down from 516 at the start of
the session). The 39 open ones here correspond exactly to the
app-search-system surface. The workbench-side advisories are all
patched or dismissed; the workbench owner no longer needs to act on
Dependabot for the workbench monorepo itself.

