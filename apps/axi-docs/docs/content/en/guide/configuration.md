---
id: axi-docs-en-guide-configuration
title: Configuration and Sources
type: guide
status: published
tags: [Axi Docs, configuration, sources, English]
created: 2026-06-07
modified: 2026-06-08
graph-title: Configuration and Sources
graph-tags: [Axi Docs, Configuration]
description: Locate site navigation, document sources, path overrides, and local service configuration.
---

## Site configuration

`app/src/config/siteConfig.ts` manages locales, the top navigation, Guide groups, page titles, document-set mappings, and UI copy. A new Guide page needs an id, group membership, and labels for both locales.

## Document sources

`app/src/config/documentSources.ts` manages source ids, paths, adapters, locales, and read-only properties. Reuse an existing adapter unless the source introduces a new storage protocol.

## Path overrides

Local paths can be overridden with environment variables:

```bash
AXI_DOCS_CONTENT_PATH=/path/to/content
AXI_SKILLS_PATH=/path/to/axi-skills
AXI_WORKSPACE_GOVERNANCE_PATH=/path/to/governance
```

Local path settings may live in environment files. Credentials and access tokens must not be documented or committed.

## Verify configuration

After editing, run the focused unit tests, `pnpm --dir app lint`, and `pnpm --dir app verify`, then open the affected locale routes and document sets in a browser.
