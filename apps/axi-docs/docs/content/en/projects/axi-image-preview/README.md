---
id: axi-docs-en-projects-axi-image-preview
title: Axi Image Preview
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Image Preview
graph-tags: [Projects, image-preview]
tags: [Axi Docs, Projects, image-preview, mcp, wallpaper]
description: Standalone Vite/React 19 image and wallpaper gallery preview prototype plus stdio MCP wallpaper upload server (axi_image_upload_wallpaper), with optional macOS Swift shell wrapper.
project:
  id: axi-image-preview
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-image-preview
  source-section: core
---

# Axi Image Preview

> Mirror of the project root `README.md` + `AGENTS.md` + `INDEX.md`. Source of truth:
> [`/Volumes/code/workspace/workbench/axi-image-preview/README.md`](/Volumes/code/workspace/workbench/axi-image-preview/README.md),
> [`/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md`](/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md),
> [`/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md`](/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md).
> Section: core / Partition: `workbench/`.

## Summary

Axi Image Preview is a **two-in-one** project: (1) a Vite + React 19 + TypeScript + Sass
**image / wallpaper gallery preview prototype** that exercises wallpaper browsing,
filter-toolbar behavior, hover-card interactions, detail routing, and macOS preview
surfaces; and (2) a **stdio MCP wallpaper upload server** (`scripts/axi-image-preview-mcp.mjs`)
exposing tool `axi_image_upload_wallpaper` so Codex / AI agents can push generated images
straight into the local "我的壁纸" collection. Both share the same user-data root
(default `~/Library/Application Support/Axi Image Preview/` on macOS, overridable via
`AXI_IMAGE_PREVIEW_USER_DATA_ROOT`); the desktop shell is a thin SwiftPM WebView wrapper
(`Package.swift` + `Sources/AxiImagePreviewDesktop/AxiImagePreviewDesktopApp.swift`).

Routing intentionally uses local React state + a lightweight history path instead of
React Router; the bottom filter toolbar is a two-state control (floats near the viewport
bottom while browsing, docks above pagination near the end of the gallery). Production
builds emit `public/build-info.json` and stamp `data-axi-build-version` /
`data-axi-build-tag` onto `document.documentElement` for debugging; the build title
includes commit details. Versioning follows SemVer 2.0.0 (X.Y.Z stored in `package.json`
and `src/app/data/changelog.ts`; `vX.Y.Z` is the Git tag/release label); PATCH for
backward-compatible fixes, MINOR for backward-compatible functionality, MAJOR for
incompatible changes. Release intent is declared in `release/manifest.json` (current
release `0.2.6` on 2026-06-10, level `patch`, "Exercise the manifest-driven release
workflow by advancing the app, MCP server, in-app changelog, and GitHub tag contract to
0.2.6 together"); CI runs `pnpm release:validate` to ensure `release/manifest.json`,
`package.json`, MCP `serverInfo.version`, in-app changelog, and GitHub tag stay aligned.

**Stage**: live prototype (current `package.json` `version: 0.2.6`).
**Canonical path**: `/Volumes/code/workspace/workbench/axi-image-preview`.
**Branch**: `dev` ahead of `origin/dev` by 10 commits at audit time
(`docs/logs/submit/20260928-045214-grouped-commit.md` modified).

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| App | React 19 + TypeScript 5.9 + Vite 7 + Sass 1.100+ | `pnpm dev` → `127.0.0.1:5173` (strictPort); `pnpm preview` → `127.0.0.1:4173`; React Router intentionally NOT used |
| Build info | Custom `prebuild` script `scripts/write-build-info.mjs` writes `public/build-info.json` | Vite build stamps `data-axi-build-version` + `data-axi-build-tag` on `documentElement` |
| MCP server | Node stdio MCP `scripts/axi-image-preview-mcp.mjs`; `serverInfo.name="axi-image-preview-wallpapers"`, version `0.2.6`, protocol `2024-11-05` | Exposes tool `axi_image_upload_wallpaper` |
| macOS shell | SwiftPM `Package.swift` + `Sources/AxiImagePreviewDesktop/AxiImagePreviewDesktopApp.swift` (WebView over running Vite dev server) | `pnpm macos:dev` / `pnpm macos:build` / `pnpm macos:install`; `AXI_IMAGE_PREVIEW_DEV_SERVER_URL` env |
| Build tooling | pnpm `10.33.2` workspaces, `vite ^7.0.0`, `tsc -b` | `pnpm build` = `tsc -b && vite build` |
| Test runner | `node --test` | 6 test suites in `tests/` |
| Rollup | `rollup: "npm:@rollup/wasm-node@^4.60.4"` | devDep override for native-module-free macOS sandboxed build |
| Local vision | `qwen3-vl:32b-instruct` via local Ollama for upload recognition (replaced 8B per 2026-06-10 changelog) | `scripts/wallpaperUploadJobs.ts` flow |
| Release flow | `release/manifest.json` single source of truth → `scripts/release-manifest.mjs {validate, notes}` | GitHub Actions creates `axi-image-preview/vX.Y.Z` + Release notes |

## Project Layout

```text
axi-image-preview/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── layout.tsx                       # AppLayout shell (BuildInfoMarker + <main className="app">)
│   │   ├── page.tsx                         # WallpaperPage (~770 lines): state, gallery, pagination, toolbar dock, detail routing
│   │   ├── components/
│   │   │   ├── AppMenuDialog.tsx            # App menu dialog (collections + upload + focused job)
│   │   │   ├── BackToTopRocket.tsx
│   │   │   ├── BuildInfoMarker.tsx          # Reads build-info.json → stamps data-axi-build-* on <html>
│   │   │   ├── Topbar.tsx                   # Theme toggle, nav, menu, notice toggle, collection back/forward
│   │   │   └── UploadNotificationPanel.tsx
│   │   ├── data/changelog.ts                # In-app release-facing changelog (mirror of release/manifest.json)
│   │   └── hooks/ (implicit; useBodyTheme etc. live under src/hooks/)
│   ├── components/ui/                       # Shared UI primitives
│   ├── composables/
│   │   ├── pagination.composable.ts
│   │   └── wallpaperPaging.composable.ts
│   ├── features/
│   │   ├── filter-toolbar/                  # @/features/filter-toolbar
│   │   │   ├── components/FilterToolbar.tsx # Floating → docked two-state bottom toolbar
│   │   │   ├── data/filterGroups.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── wallpaper/                       # @/features/wallpaper
│   │   │   ├── components/{MyWallpaperCollectionGrid, Pagination, WallpaperCard, WallpaperGallery}.tsx
│   │   │   ├── api/wallpaperApi.ts          # fetchWallpaperPage, fetchMyWallpaperCollections, fetchWallpaperDetail, fetchWallpaperRelated, fetchWallpaperSuggestions, moveMyWallpaperToCollection, renameMyWallpaperCollection, updateMyWallpaperPrompt
│   │   │   ├── data/wallpaperSections.ts    # WallpaperNavId union: desktop-wallpaper / mobile-wallpaper / avatar / my-wallpapers
│   │   │   ├── hooks/
│   │   │   ├── types.ts
│   │   │   ├── wallpaperFilterCore.ts
│   │   │   ├── wallpaperFilters.ts
│   │   │   ├── wallpaperId.ts               # getMyWallpaperCollectionPath, getMyWallpapersPath, getWallpaperDetailPath, getWallpaperHomePath, getWallpaperId, readMyWallpaperCollectionLocationId, readWallpaperLocationId
│   │   │   ├── index.ts
│   │   │   └── CHANGE.md
│   │   ├── wallpaper-detail/                # @/features/wallpaper-detail
│   │   │   ├── components/{AvatarMakerOverlay, MacWallpaperPreview, WallpaperDetailPage}.tsx
│   │   │   └── index.ts
│   │   └── wallpaper-upload/                # @/features/wallpaper-upload
│   │       ├── components/WallpaperUploadDialog.tsx
│   │       ├── uploadQueueCore.{mjs,d.mts}
│   │       ├── uploadRemoteSources.{mjs,d.mts}
│   │       ├── wallpaperUploadJobs.ts       # Subscribable upload queue (snapshot, mark-read, clear, retry, subscribe)
│   │       └── CHANGE.md
│   ├── hooks/
│   │   ├── useBodyTheme.ts
│   │   ├── useNavHighlight.ts
│   │   └── useOutsideClick.ts
│   ├── styles/                              # Sass
│   ├── types/
│   │   └── theme.ts                         # ThemeMode = "dark" | "light"
│   └── vite-env.d.ts
├── tests/                                   # node --test suites
│   ├── upload-tag-rules.test.mjs
│   ├── upload-queue-core.test.mjs
│   ├── upload-remote-sources.test.mjs
│   ├── my-wallpaper-collections.test.mjs
│   ├── user-data-paths.test.mjs
│   └── release-manifest.test.mjs
├── scripts/
│   ├── axi-image-preview-mcp.mjs            # stdio MCP server (the wallpaper upload tool)
│   ├── upload-tag-rules.mjs                 # buildUploadTags / normalizeLooseTagList
│   ├── user-data-paths.mjs                  # getAxiImagePreviewUserDataPaths (resolves AXI_IMAGE_PREVIEW_USER_DATA_ROOT)
│   ├── my-wallpaper-collections.mjs         # resolveSubmittedMyWallpaperCollection / unassignedCollectionId
│   ├── sync-my-wallpaper-collections.mjs
│   ├── import-my-wallpaper-source-batch.mjs
│   ├── fetch-haowallpaper-gallery.mjs       # One-off gallery scrape
│   ├── download-wallpaper-assets.mjs        # One-off asset download
│   ├── build-macos-app.sh                   # macOS SwiftPM build
│   ├── install-macos-app.sh
│   ├── macos-app-server.mjs                 # Local API server mirroring macOS app collection mutation routes
│   ├── release-manifest.mjs                 # `release:validate` + `release:notes`
│   └── write-build-info.mjs                 # `prebuild`
├── data/                                    # Runtime data (NOT in version control)
│   ├── my-wallpaper-collections.json
│   ├── my-wallpapers.json (+ .bak-20260529092954)
│   └── wallpaper-sections.json
├── dist/                                    # Vite production build (NOT in version control)
├── dist-macos/                              # macOS SwiftPM build (NOT in version control)
├── artifacts/                               # Build outputs (NOT in version control)
├── resources/                               # Runtime resources
├── coverage/                                # Test coverage
├── public/                                  # Vite static assets (incl. build-info.json after prebuild)
├── release/manifest.json                    # SINGLE source of truth for app version, GitHub tag, release reason, verification, rollback
├── Sources/AxiImagePreviewDesktop/
│   └── AxiImagePreviewDesktopApp.swift      # macOS Swift shell (NOT currently the primary path per AGENTS.md)
├── Package.swift                            # macOS SwiftPM manifest
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── eslint.config / stylelint / vitest (if present)
└── package.json                             # v0.2.6, scripts: dev / build / preview / test / mcp:wallpapers / release:{validate,notes} / macos:{dev,build,install} / fetch:gallery / download:wallpapers / verify:macos
```

## Build & Install

```bash
# Install
pnpm install

# Dev server
pnpm dev                                # vite → 127.0.0.1:5173 (strictPort)

# Production build (writes build-info.json then vite build)
pnpm build                              # tsc -b && vite build

# Preview production locally
pnpm preview                            # vite preview → 127.0.0.1:4173

# Tests (node --test, six suites)
pnpm test                               # upload-tag-rules, upload-queue-core, upload-remote-sources,
                                        # my-wallpaper-collections, user-data-paths, release-manifest

# MCP wallpaper upload server
pnpm mcp:wallpapers                     # node scripts/axi-image-preview-mcp.mjs

# macOS shell (SwiftPM WebView)
pnpm macos:build                        # bash scripts/build-macos-app.sh
pnpm macos:dev                          # AXI_IMAGE_PREVIEW_DEV_SERVER_URL=http://127.0.0.1:5173 swift run AxiImagePreviewDesktop
pnpm macos:install                      # bash scripts/install-macos-app.sh
pnpm verify:macos                       # pnpm test && pnpm macos:install

# Release flow
pnpm release:validate                   # release/manifest.json + package.json + MCP serverInfo + in-app changelog + GitHub tag must agree
pnpm release:notes                      # render GitHub Release notes from release/manifest.json

# One-off data acquisition
pnpm fetch:gallery                      # node scripts/fetch-haowallpaper-gallery.mjs
pnpm download:wallpapers                # node scripts/download-wallpaper-assets.mjs

# Codex MCP registration
codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs
```

## Verification

Per `AGENTS.md` "Verification" + `INDEX.md` §3:

```bash
pnpm build                              # required after any src/** change
pnpm test                               # required after any scripts/** change (especially axi-image-preview-mcp.mjs / upload-tag-rules.mjs / user-data-paths.mjs)
pnpm mcp:wallpapers                     # smoke-test the stdio MCP server after scripts/** changes
pnpm release:validate                   # required for any release
pnpm verify:macos                       # pnpm test && pnpm macos:install (macOS shell changes)
```

Document-only changes (AGENTS / README / manifest) do not need a build but must preserve
translation invariants.

## Architecture Highlights

**Two-in-one project by design.** Per `AGENTS.md` "Project Boundary", the repo combines
a **local image/wallpaper preview prototype** (Vite/React 19/Sass) and a **stdio MCP
wallpaper upload server** (`scripts/axi-image-preview-mcp.mjs`). The MCP server ships
one tool — `axi_image_upload_wallpaper` — registered with Codex via
`codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs`.
Inputs: exactly one of `imagePath`, `imageBase64`, `dataUrl`, `remoteImageUrl`; optional
`title`, `tags`, `tagGroups`, `sourcePrompt`. Uploaded assets, 我的壁纸 metadata, and
collection metadata all share the same user-data root as the desktop app
(`~/Library/Application Support/Axi Image Preview/` on macOS; overridable via
`AXI_IMAGE_PREVIEW_USER_DATA_ROOT`). Uploaded assets, 我的壁纸 metadata, and collection
metadata all use the same user data root as the desktop app: macOS
`~/Library/Application Support/Axi Image Preview/`, or `AXI_IMAGE_PREVIEW_USER_DATA_ROOT`
when set.

**No React Router; history-based detail routing.** Per `README.md` "Notes", the app
intentionally uses local React state plus a lightweight history path for detail routing
instead of React Router. `WallpaperPage` (`src/app/page.tsx`, ~770 lines) coordinates
`activeNavId` (WallpaperNavId: `desktop-wallpaper` | `mobile-wallpaper` | `avatar` |
`my-wallpapers`), `selectedMyWallpaperCollectionId`, `selectedWallpaper`, `currentPage`,
`filterSelections`, `searchTerm`, `theme`, `toolbarCollapsed`, `toolbarDocked`,
`appMenuOpen`, `noticePanelOpen`, `avatarMakerItem`, plus the upload-queue snapshot.
Detail routing uses `window.history.pushState` + path helpers in
`src/features/wallpaper/wallpaperId.ts` (`getWallpaperDetailPath`, `getMyWallpaperCollectionPath`,
`getMyWallpapersPath`, `getWallpaperHomePath`, `readWallpaperLocationId`,
`readMyWallpaperCollectionLocationId`).

**Two-state bottom filter toolbar + mobile waterfall pagination.** Per `README.md` and
the page-level `useEffect`s that measure dock top vs window bottom, the
`FilterToolbar` (`src/features/filter-toolbar/components/FilterToolbar.tsx`) floats while
browsing and docks above pagination near the end of the gallery. On
`mobile-wallpaper` an `IntersectionObserver` watches
`mobileWaterfallSentinelRef.current` to advance `currentPage` automatically; on other
variants, `Pagination` (`src/features/wallpaper/components/Pagination.tsx`) drives page
changes through `clampPage(page, totalPages)`. `navigationProgress` (RAF + setTimeout)
is bound to `<div className="navigation-progress" role="progressbar">` for transition feedback.

**macOS desktop shell is a SwiftPM WebView wrapper.** Per `AGENTS.md`, `Package.swift` +
`Sources/AxiImagePreviewDesktop/AxiImagePreviewDesktopApp.swift` are "currently not the
main path"; the shell wraps a running Vite dev server (`AXI_IMAGE_PREVIEW_DEV_SERVER_URL`)
via WebView. `scripts/macos-app-server.mjs` mirrors the macOS app's collection mutation
routes so renaming and moving wallpapers persist while running the local browser dev
server. `pnpm verify:macos` rebuilds + reinstalls `/Applications/Axi Image Preview.app`
after tests pass.

**Release manifest is the single source of truth.** Per `release/manifest.json`
(current: `version 0.2.6`, `tag axi-image-preview/v0.2.6`, `level patch`, `releasedAt
2026-06-10T14:13:11+08:00`) and `scripts/release-manifest.mjs validate`, the manifest
must agree with `package.json`, MCP `serverInfo.version`, in-app changelog, and the
GitHub tag. `pnpm release:validate` runs in CI to prevent drift. The in-app changelog
(`src/app/data/changelog.ts`) is **release-facing** only — it does not receive
development-time notes; those go to root `CHANGE.md` and per-feature `CHANGE.md`
(e.g. `src/features/wallpaper/CHANGE.md`, `src/features/wallpaper-upload/CHANGE.md`).

**User-data root resolution is centralised.** Per `AGENTS.md` "Key Variables", the
canonical resolver is `scripts/user-data-paths.mjs`'s `getAxiImagePreviewUserDataPaths`;
per `House Rules`, changes to `AXI_IMAGE_PREVIEW_USER_DATA_ROOT` parsing logic MUST
sync `scripts/user-data-paths.mjs` AND `tests/user-data-paths.test.mjs`; do NOT bypass
the path-resolution module to assemble paths from strings. `tests/user-data-paths.test.mjs`
is one of six `node --test` suites run by `pnpm test`.

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Two-in-one project shape | Wallpaper preview prototype + stdio MCP upload server under one repo | Done |
| Release manifest workflow | `release/manifest.json` ↔ `package.json` ↔ MCP `serverInfo.version` ↔ in-app changelog ↔ GitHub tag | Done (current `0.2.6` aligned) |
| Manifest-driven release v0.2.6 | Advance app, MCP server, in-app changelog, and GitHub tag contract together | Done (2026-06-10, level `patch`) |
| Local vision model swap | `qwen3-vl:8b` → `qwen3-vl:32b-instruct` for upload recognition | Done (per 2026-06-10 changelog) |
| macOS SwiftPM shell | SwiftPM WebView wrapper for running Vite dev server | Active but NOT the primary path per AGENTS.md |
| WallpaperPage rewrite | Single-page rewrite to ~770 lines (state + gallery + pagination + dock + detail routing) | Done |

## Notes

This is a two-in-one project: a local image / wallpaper gallery preview prototype
(Vite + React 19 + Sass, no React Router) and a stdio MCP wallpaper upload server
(`scripts/axi-image-preview-mcp.mjs`). The MCP server exposes one tool
`axi_image_upload_wallpaper`, registered with Codex via
`codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs`.
Both share `AXI_IMAGE_PREVIEW_USER_DATA_ROOT` (default macOS `~/Library/Application Support/Axi Image Preview/`).
`release/manifest.json` is the single source of truth for `version: 0.2.6`,
GitHub tag `axi-image-preview/v0.2.6`, and release notes; `pnpm release:validate`
must pass before any release. Local vision upgraded to `qwen3-vl:32b-instruct`
(replaced 8B). React Router is intentionally NOT used; routing is via local React
state + `window.history.pushState` with helpers in `src/features/wallpaper/wallpaperId.ts`.

## Authoritative Documents

- [`/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md`](/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md) — project boundary + verification + key variables + house rules (en)
- [`/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.zh-CN.md`](/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.zh-CN.md) — Chinese mirror, authoritative implementation constraints
- [`/Volumes/code/workspace/workbench/axi-image-preview/README.md`](/Volumes/code/workspace/workbench/axi-image-preview/README.md) — primary entrypoint (en)
- [`/Volumes/code/workspace/workbench/axi-image-preview/README.zh-CN.md`](/Volumes/code/workspace/workbench/axi-image-preview/README.zh-CN.md) — Chinese mirror, scripts + Codex MCP registration
- [`/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md`](/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md) — document map (L3 deep-init layer)
- [`/Volumes/code/workspace/workbench/axi-image-preview/PRD.md`](/Volumes/code/workspace/workbench/axi-image-preview/PRD.md) — product requirements
- [`/Volumes/code/workspace/workbench/axi-image-preview/TDD.md`](/Volumes/code/workspace/workbench/axi-image-preview/TDD.md) — technical design + test strategy
- [`/Volumes/code/workspace/workbench/axi-image-preview/TODO.md`](/Volumes/code/workspace/workbench/axi-image-preview/TODO.md) — P0/P1/P2 backlog
- [`/Volumes/code/workspace/workbench/axi-image-preview/MILESTONE.md`](/Volumes/code/workspace/workbench/axi-image-preview/MILESTONE.md) — evidence-driven milestone plan
- [`/Volumes/code/workspace/workbench/axi-image-preview/CHANGELOG.md`](/Volumes/code/workspace/workbench/axi-image-preview/CHANGELOG.md) — Keep-a-Changelog 1.1 release history
- [`/Volumes/code/workspace/workbench/axi-image-preview/SECURITY.md`](/Volumes/code/workspace/workbench/axi-image-preview/SECURITY.md) — security policy
- [`/Volumes/code/workspace/workbench/axi-image-preview/CHANGE.md`](/Volumes/code/workspace/workbench/axi-image-preview/CHANGE.md) — root development change log (NOT release-facing)
- [`/Volumes/code/workspace/workbench/axi-image-preview/docs/project-docs.manifest.json`](/Volumes/code/workspace/workbench/axi-image-preview/docs/project-docs.manifest.json) — project docs manifest (v1, status legacy)
- [`/Volumes/code/workspace/workbench/axi-image-preview/release/manifest.json`](/Volumes/code/workspace/workbench/axi-image-preview/release/manifest.json) — release source-of-truth (current 0.2.6)
- [`/Volumes/code/workspace/workbench/axi-image-preview/docs/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-image-preview/docs/HANDOFF.md) — handoff doc
- Workspace context: `/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md`

## Cross-References

- Workspace root: `/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- Naming + brand: `/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance/`
- Sibling monorepo under same workbench partition: `/Volumes/code/workspace/workbench/axi-workbench/` (larger monorepo that owns `apps/axi-docs`, `apps/axi-coder`, the six-layer control plane, the DevSvc host, and many other Dashboard Apps)
- Provider capabilities (per AGENTS.md "Relationship Metadata"): `image-preview-ui` (runtime, Preview UI renders when user opens images), `mcp-wallpaper-server` (runtime, MCP server exposes wallpaper tools), `wallpaper-upload` (runtime, upload capability via MCP)
- Codex MCP registration command: `codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs`
- Workspace graph CLI: `/Volumes/code/workspace/scripts/workspace-project` (`workspace-project consumers axi-image-preview` before changing cross-project contracts)
