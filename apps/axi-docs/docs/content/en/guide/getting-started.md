---
id: axi-docs-en-guide-getting-started
title: Getting Started
type: guide
status: published
tags: [Axi Docs, guide, English]
created: 2026-06-06
modified: 2026-06-08
graph-title: Getting Started
graph-tags: [Axi Docs, Guide]
description: Launch Axi Docs and learn the basic reading paths for the guide, skills library, workspace, and search.
---

## Start the local site

Install the dependencies at the repository root and launch the application:

```bash
pnpm --dir app install
pnpm --dir app dev
```

After the dev server starts, open the local address shown in the terminal. Vite will refresh the page whenever you edit Markdown under `docs/content/` or interface code under `app/src/`.

## Use the documentation navigation

1. Use the top navigation to switch between **Guide**, **Skills**, and **Workspace**.
2. Use the left grouped sidebar to pick a page from the current document set.
3. Use the right-hand page navigation to jump to a level-2 or level-3 heading in the body.
4. After reading, use the **Previous** and **Next** links at the bottom of the page to continue.

## Search the documentation

Click the search button in the top bar or press `⌘K` to open the search panel. The search matches titles, descriptions, paths, tags, and body text; once you submit a query you will land on the [Search & Index](/en/guide/search) page to view the results.

## Verify before committing

After editing the interface or content, run:

```bash
pnpm --dir app test:run
pnpm --dir app lint
pnpm --dir app verify
```

`verify` currently runs the TypeScript check and the Vite production build. The documentation structure and bilingual paths still need to be cross-checked during review.
