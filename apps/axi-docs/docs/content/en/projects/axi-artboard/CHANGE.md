---
id: axi-docs-en-projects-axi-artboard
title: Axi Artboard
type: project
status: draft
tags: [Axi Docs, Projects, products, reference]
created: 2026-08-23
modified: 2026-08-23
graph-title: Axi Artboard
graph-tags: [Projects, products]
description: Single-page canvas / artboard frontend for the Axi Spun-out Products line.
project:
  id: axi-artboard
  partition: products
  path: /Volumes/code/workspace/products/axi-artboard
  source-section: reference
---

# Axi Artboard Change Log

## Unreleased

- Maintains the agent-node-picker interaction contract: right-click pins a
  component, left-drag selects a region, and both gestures are exposed through
  `window.__artboard.targets()`.
- Keeps the generated project handoff and catalog manifest aligned with the
  workspace registry.

## 2026-07-17

- Promoted the project from manifest-stage to feature-stage after shipping the
  first real agent-node-picker feature.
