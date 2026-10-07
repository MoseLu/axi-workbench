---
id: axi-docs-zh-projects-axi-image-preview
title: Axi Image Preview
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Image Preview
graph-tags: [Projects, image-preview]
tags: [Axi Docs, 项目, image-preview, mcp, wallpaper]
description: 独立的 Vite/React 19 图像与壁纸画廊预览原型 + stdio MCP 壁纸上传服务器（axi_image_upload_wallpaper），附带可选的 macOS Swift 壳包装。
project:
  id: axi-image-preview
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-image-preview
  source-section: core
---

# Axi Image Preview

> 项目根 `README.md` + `AGENTS.md` + `INDEX.md` 的镜像；项目根为唯一权威。
> Source of truth:
> [`/Volumes/code/workspace/workbench/axi-image-preview/README.md`](/Volumes/code/workspace/workbench/axi-image-preview/README.md),
> [`/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md`](/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md),
> [`/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md`](/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md).
> Section: core / Partition: `workbench/`。

## 概述

Axi Image Preview 是一个**二合一**项目：(1) 基于 Vite + React 19 + TypeScript + Sass
的**图像 / 壁纸画廊预览原型**，用于演练壁纸浏览、筛选 toolbar 行为、hover 卡片交互、
详情路由以及 macOS 预览面；(2) 一个 **stdio MCP 壁纸上传服务器**
（`scripts/axi-image-preview-mcp.mjs`），暴露工具 `axi_image_upload_wallpaper`，使 Codex
/ AI Agent 能将生成的图像直接推入本地"我的壁纸"集合。两者共享同一个 user-data 根
（macOS 默认 `~/Library/Application Support/Axi Image Preview/`，可通过
`AXI_IMAGE_PREVIEW_USER_DATA_ROOT` 覆盖）；桌面壳是一个轻量的 SwiftPM WebView 包装
（`Package.swift` + `Sources/AxiImagePreviewDesktop/AxiImagePreviewDesktopApp.swift`）。

路由刻意使用本地 React state + 一条轻量 history 路径，而不使用 React Router；底部
filter toolbar 是一个二态控件（在浏览时悬浮于视口底部，到画廊尾部时停靠于分页之上）。
生产构建会输出 `public/build-info.json`，并将 `data-axi-build-version` /
`data-axi-build-tag` 印记到 `document.documentElement` 用于调试；构建标题包含 commit
详情。版本遵循 SemVer 2.0.0（X.Y.Z 存于 `package.json` 与 `src/app/data/changelog.ts`；
`vX.Y.Z` 即 Git tag / Release 标签）；PATCH 用于向后兼容的修复，MINOR 用于向后兼容的
功能，MAJOR 用于不兼容变更。发布意图声明于 `release/manifest.json`（当前 release `0.2.6`
于 2026-06-10，level `patch`，说明 "Exercise the manifest-driven release workflow by
advancing the app, MCP server, in-app changelog, and GitHub tag contract to 0.2.6
together"）；CI 跑 `pnpm release:validate`，确保 `release/manifest.json`、`package.json`、
MCP `serverInfo.version`、应用内 changelog 与 GitHub tag 保持一致。

**当前阶段**：活跃原型（当前 `package.json` `version: 0.2.6`）。
**规范路径**：`/Volumes/code/workspace/workbench/axi-image-preview`。
**分支**：`dev` 截至审计时领先 `origin/dev` 10 个 commit
（`docs/logs/submit/20260928-045214-grouped-commit.md` 已修改）。

## 技术栈

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

## 项目结构

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

## 构建与安装

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

## 验证

依据 `AGENTS.md` "Verification" + `INDEX.md` §3：

```bash
pnpm build                              # required after any src/** change
pnpm test                               # required after any scripts/** change (especially axi-image-preview-mcp.mjs / upload-tag-rules.mjs / user-data-paths.mjs)
pnpm mcp:wallpapers                     # smoke-test the stdio MCP server after scripts/** changes
pnpm release:validate                   # required for any release
pnpm verify:macos                       # pnpm test && pnpm macos:install (macOS shell changes)
```

纯文档变更（AGENTS / README / manifest）不需要构建，但必须保留翻译一致性。

## 架构要点

**二合一项目是设计本身。** 依据 `AGENTS.md` "Project Boundary"，本仓合并了
**本地图像/壁纸预览原型**（Vite / React 19 / Sass）与 **stdio MCP 壁纸上传服务器**
（`scripts/axi-image-preview-mcp.mjs`）。MCP 服务器仅暴露一个工具
—— `axi_image_upload_wallpaper` —— 通过
`codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs`
注册到 Codex。输入：恰好一个 `imagePath`、`imageBase64`、`dataUrl`、`remoteImageUrl`；可选
`title`、`tags`、`tagGroups`、`sourcePrompt`。上传资源、"我的壁纸"元数据与集合元数据
全部与桌面应用共享同一 user-data 根（macOS `~/Library/Application Support/Axi Image Preview/`；
可通过 `AXI_IMAGE_PREVIEW_USER_DATA_ROOT` 覆盖）。上传资源、"我的壁纸"元数据与集合元数据
均使用与桌面应用相同的 user data 根：macOS 上为
`~/Library/Application Support/Axi Image Preview/`，或在设置了
`AXI_IMAGE_PREVIEW_USER_DATA_ROOT` 时使用该值。

**不用 React Router；基于 history 的详情路由。** 依据 `README.md` "Notes"，应用刻意使用
本地 React state 加轻量 history 路径来驱动详情路由，而不使用 React Router。
`WallpaperPage`（`src/app/page.tsx`，~770 行）协调 `activeNavId`（WallpaperNavId：
`desktop-wallpaper` | `mobile-wallpaper` | `avatar` | `my-wallpapers`）、
`selectedMyWallpaperCollectionId`、`selectedWallpaper`、`currentPage`、
`filterSelections`、`searchTerm`、`theme`、`toolbarCollapsed`、`toolbarDocked`、
`appMenuOpen`、`noticePanelOpen`、`avatarMakerItem`，以及上传队列快照。详情路由使用
`window.history.pushState` + `src/features/wallpaper/wallpaperId.ts` 中的路径助手
（`getWallpaperDetailPath`、`getMyWallpaperCollectionPath`、`getMyWallpapersPath`、
`getWallpaperHomePath`、`readWallpaperLocationId`、
`readMyWallpaperCollectionLocationId`）。

**底部 filter toolbar 二态 + 移动端瀑布流分页。** 依据 `README.md` 与测量 dock top
相对 window bottom 的 page-level `useEffect`，`FilterToolbar`
（`src/features/filter-toolbar/components/FilterToolbar.tsx`）在浏览时悬浮，到画廊尾部
时停靠在分页之上。在 `mobile-wallpaper` 上，`IntersectionObserver` 监听
`mobileWaterfallSentinelRef.current` 自动推进 `currentPage`；其他变体下，
`Pagination`（`src/features/wallpaper/components/Pagination.tsx`）通过
`clampPage(page, totalPages)` 驱动翻页。`navigationProgress`（RAF + setTimeout）绑定
到 `<div className="navigation-progress" role="progressbar">` 用作过渡反馈。

**macOS 桌面壳是 SwiftPM WebView 包装。** 依据 `AGENTS.md`，`Package.swift` +
`Sources/AxiImagePreviewDesktop/AxiImagePreviewDesktopApp.swift` "currently not the
main path"；该壳通过 WebView 包裹一个正在运行的 Vite dev server
（`AXI_IMAGE_PREVIEW_DEV_SERVER_URL`）。`scripts/macos-app-server.mjs` 镜像了 macOS app
的集合变更路由，以便在本地浏览器 dev server 中运行时，重命名与移动壁纸的操作也能持久化。
`pnpm verify:macos` 在测试通过后重建 + 重装 `/Applications/Axi Image Preview.app`。

**Release manifest 是唯一真相源。** 依据 `release/manifest.json`（当前：`version 0.2.6`、
`tag axi-image-preview/v0.2.6`、`level patch`、`releasedAt 2026-06-10T14:13:11+08:00`）与
`scripts/release-manifest.mjs validate`，manifest 必须与 `package.json`、MCP
`serverInfo.version`、应用内 changelog 与 GitHub tag 一致。`pnpm release:validate` 在 CI
中运行以防漂移。应用内 changelog（`src/app/data/changelog.ts`）**仅**面向 release —— 不接收
开发期笔记；后者归入根 `CHANGE.md` 与每个 feature 的 `CHANGE.md`
（如 `src/features/wallpaper/CHANGE.md`、`src/features/wallpaper-upload/CHANGE.md`）。

**User-data 根解析是集中式的。** 依据 `AGENTS.md` "Key Variables"，权威解析器是
`scripts/user-data-paths.mjs` 的 `getAxiImagePreviewUserDataPaths`；依据 "House Rules"，
对 `AXI_IMAGE_PREVIEW_USER_DATA_ROOT` 解析逻辑的修改必须同步
`scripts/user-data-paths.mjs` 与 `tests/user-data-paths.test.mjs`；**不要**绕过路径解析
模块直接用字符串拼接路径。`tests/user-data-paths.test.mjs` 是 `pnpm test` 运行的六套
`node --test` 套件之一。

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| Two-in-one project shape | 壁纸预览原型 + stdio MCP 上传服务器共享同一仓库 | 完成 |
| Release manifest workflow | `release/manifest.json` ↔ `package.json` ↔ MCP `serverInfo.version` ↔ 应用内 changelog ↔ GitHub tag | 完成（当前 `0.2.6` 对齐） |
| Manifest-driven release v0.2.6 | 同步推进 app、MCP server、应用内 changelog、GitHub tag 契约 | 完成（2026-06-10，level `patch`） |
| Local vision model swap | `qwen3-vl:8b` → `qwen3-vl:32b-instruct` 用于上传识别 | 完成（依据 2026-06-10 changelog） |
| macOS SwiftPM shell | SwiftPM WebView 包装，用于运行 Vite dev server | 活跃但依据 AGENTS.md 不是主路径 |
| WallpaperPage rewrite | 单页重写到 ~770 行（state + gallery + pagination + dock + 详情路由） | 完成 |

## 说明

本项目是二合一：本地图像 / 壁纸画廊预览原型（Vite + React 19 + Sass，不使用 React Router）
与 stdio MCP 壁纸上传服务器（`scripts/axi-image-preview-mcp.mjs`）。MCP 服务器仅暴露一个
工具 `axi_image_upload_wallpaper`，通过
`codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs`
注册到 Codex。两者共享 `AXI_IMAGE_PREVIEW_USER_DATA_ROOT`（macOS 默认
`~/Library/Application Support/Axi Image Preview/`）。`release/manifest.json` 是
`version: 0.2.6`、GitHub tag `axi-image-preview/v0.2.6` 与 release notes 的唯一真相源；
任何发布前必须通过 `pnpm release:validate`。本地视觉模型升级到 `qwen3-vl:32b-instruct`
（替换 8B）。React Router 刻意**不**使用；路由走本地 React state +
`window.history.pushState`，路径助手位于 `src/features/wallpaper/wallpaperId.ts`。

## 权威文档

- [`/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md`](/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.md) — 项目边界 + 验证 + 关键变量 + house rules（en）
- [`/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.zh-CN.md`](/Volumes/code/workspace/workbench/axi-image-preview/AGENTS.zh-CN.md) — 中文镜像，权威实现约束
- [`/Volumes/code/workspace/workbench/axi-image-preview/README.md`](/Volumes/code/workspace/workbench/axi-image-preview/README.md) — 主入口（en）
- [`/Volumes/code/workspace/workbench/axi-image-preview/README.zh-CN.md`](/Volumes/code/workspace/workbench/axi-image-preview/README.zh-CN.md) — 中文镜像，scripts + Codex MCP 注册
- [`/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md`](/Volumes/code/workspace/workbench/axi-image-preview/INDEX.md) — 文档地图（L3 deep-init 层）
- [`/Volumes/code/workspace/workbench/axi-image-preview/PRD.md`](/Volumes/code/workspace/workbench/axi-image-preview/PRD.md) — 产品需求
- [`/Volumes/code/workspace/workbench/axi-image-preview/TDD.md`](/Volumes/code/workspace/workbench/axi-image-preview/TDD.md) — 技术设计 + 测试策略
- [`/Volumes/code/workspace/workbench/axi-image-preview/TODO.md`](/Volumes/code/workspace/workbench/axi-image-preview/TODO.md) — P0/P1/P2 任务列表
- [`/Volumes/code/workspace/workbench/axi-image-preview/MILESTONE.md`](/Volumes/code/workspace/workbench/axi-image-preview/MILESTONE.md) — 证据驱动的里程碑
- [`/Volumes/code/workspace/workbench/axi-image-preview/CHANGELOG.md`](/Volumes/code/workspace/workbench/axi-image-preview/CHANGELOG.md) — Keep-a-Changelog 1.1 发布历史
- [`/Volumes/code/workspace/workbench/axi-image-preview/SECURITY.md`](/Volumes/code/workspace/workbench/axi-image-preview/SECURITY.md) — 安全策略
- [`/Volumes/code/workspace/workbench/axi-image-preview/CHANGE.md`](/Volumes/code/workspace/workbench/axi-image-preview/CHANGE.md) — 根开发变更日志（不面向 release）
- [`/Volumes/code/workspace/workbench/axi-image-preview/docs/project-docs.manifest.json`](/Volumes/code/workspace/workbench/axi-image-preview/docs/project-docs.manifest.json) — 项目文档清单（v1，status legacy）
- [`/Volumes/code/workspace/workbench/axi-image-preview/release/manifest.json`](/Volumes/code/workspace/workbench/axi-image-preview/release/manifest.json) — 发布唯一真相源（当前 0.2.6）
- [`/Volumes/code/workspace/workbench/axi-image-preview/docs/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-image-preview/docs/HANDOFF.md) — 接手文档
- 工作区上下文：`/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md`

## 交叉引用

- 工作区根：`/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- 命名与品牌：`/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`
- 工作区治理：`/Volumes/code/workspace/foundation/workspace-governance/`
- 同 workbench 分区的兄弟 monorepo：`/Volumes/code/workspace/workbench/axi-workbench/`（更大的 monorepo，持有 `apps/axi-docs`、`apps/axi-coder`、六层控制面、DevSvc 宿主及众多 Dashboard Apps）
- Provider 能力（依据 AGENTS.md "Relationship Metadata"）：`image-preview-ui`（runtime，Preview UI 在用户打开图像时渲染）、`mcp-wallpaper-server`（runtime，MCP 服务器暴露壁纸工具）、`wallpaper-upload`（runtime，通过 MCP 提供上传能力）
- Codex MCP 注册命令：`codex mcp add axi-image-preview-wallpapers -- node /Volumes/code/workspace/workbench/axi-image-preview/scripts/axi-image-preview-mcp.mjs`
- 工作区图 CLI：`/Volumes/code/workspace/scripts/workspace-project`（在改动跨项目契约前跑 `workspace-project consumers axi-image-preview`）
