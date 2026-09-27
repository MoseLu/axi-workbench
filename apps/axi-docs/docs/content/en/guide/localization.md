---
id: axi-docs-en-guide-localization
title: Localization
type: guide
status: published
tags: [Axi Docs, localization, English]
created: 2026-06-07
modified: 2026-06-07
graph-title: Localization
graph-tags: [Axi Docs, Localization]
description: Maintain mirrored English and Chinese pages, locale routes, and interface copy.
---

## Locale routes

Chinese Guide pages use `/zh/guide/*`; English pages use `/en/guide/*`. The header language menu preserves the current path while replacing the locale prefix, so both locales must use the same page id.

## Mirrored files

Source files live in:

```text
docs/content/zh/guide/
docs/content/en/guide/
```

When adding, renaming, or deleting a page, update the same filename in both directories and synchronize page titles in `app/src/config/siteConfig.ts`.

## Translation rules

Keep heading order and link targets aligned without translating terms mechanically. Preserve code, paths, configuration keys, and commands. Use the labels actually displayed by the interface.

## Interface copy

Navigation, search, and error strings live in locale configuration. Page content belongs in Markdown; control labels belong in TypeScript configuration.
