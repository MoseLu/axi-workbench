---
id: axi-docs-en-projects-axi-coder
title: Axi Coder
type: project
status: draft
tags: [Axi Docs, Projects, workbench, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Coder
graph-tags: [Projects, workbench]
description: Axi Coder is the full development workbench surface and consumes the generated workspace project completion snapshot.
project:
  id: axi-coder
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder
  source-section: core
---

# Axi Coder Change Log

## 2026-08-23

- Replaced the temporary workspace-remediation placeholder with project-owned
  agent guidance, verification evidence, and a manifest that describes the
  actual Axi Coder surface.
- Preserved the grandfathered `axi-model-gateway` contract alias at this
  physical path instead of treating it as a second repository.

## Existing product baseline

- Tauri 2 desktop shell with React, TypeScript, Rust, SQLite, and system
  Keychain secret storage.
- Hosted browser surface for provider setup, CLI routing, terminal sessions,
  agent tasks, artifact review, and the mobile companion contract.
