---
id: axi-docs-en-guide-routing
title: Navigation and Routing
type: guide
status: published
tags: [Axi Docs, routing, navigation, English]
created: 2026-06-07
modified: 2026-06-07
graph-title: Navigation and Routing
graph-tags: [Axi Docs, Routing]
description: Understand locale prefixes, document-set routes, document routes, and internal navigation.
---

## Guide routes

Guide pages use `/{locale}/guide/{pageId}`, for example `/en/guide/getting-started`. Supported locales are `zh` and `en`; page ids are defined by the guide configuration in `app/src/config/siteConfig.ts`.

## Document-set routes

Skills and Workspace use `/{locale}/{collection}`, including `/en/skills` and `/en/workspace`. Their sidebars are generated from source catalogs rather than the fixed Guide page list.

## Document routes

Individual documents use `/docs/{sourceId}/{documentPath}`. The source id and relative path identify the content; the `.md` extension is omitted from the URL.

## Internal links

Guide pages should use explicit localized paths such as `[Frontmatter](/en/guide/frontmatter)`. External HTTP links open in a new tab and receive the external-link marker.
