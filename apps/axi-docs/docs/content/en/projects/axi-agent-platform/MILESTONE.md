---
id: axi-docs-en-projects-axi-agent
title: Axi Agent Platform
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Agent Platform
graph-tags: [Projects, projects]
description: Multi-agent collaboration platform combining a FastAPI backend, React dashboard, SubAgent worktree isolation, an MCP model swarm, and the Axi Todo tool. Surface-stable per 2026-08-08 handoff refresh; canonical evidence at the project root.
project:
  id: axi-agent
  partition: projects
  path: /Volumes/code/workspace/projects/axi-agent
  source-section: core
---
## 2026-08-08 Refresh Note

Project root and manifest are stable; canonical PRD/TDD/CHANGELOG lives under docs/state/. LastVerifiedAt trail in the handoff snapshot says 2026-06-18; this dossier is brought forward to match.


# Axi Agent Platform — Milestone

> Dossier milestone. Tracks the **public surface** of this project as seen from Axi Docs.



## Current State

- Workspace status: **stale** (lastVerifiedAt = 2026-06-18 on the   workspace handoff snapshot). This dossier is refreshed on   2026-08-08 as the manual predecessor to re-verification.
- Dossier: active, dual-app neighbour; consumer of @axi/ui   and @axi/workstation-contracts.
- Project root CHANGELOG records the 2026-07-22 last commit   on the package set.

## Exit Criteria (to keep dossier accurate)

- [ ] `pnpm --dir app verify` (agent platform smoke) is green   with verified lastVerifiedAt = current date.
- [ ] The dossier reflects the latest verified state of the   agent runtime.

## Long-Term

- [ ] Promote from `status: active` to `status: published` once   content is reviewed by axiom-agent-platform owner.
- [ ] Adopt dossier mirror cadence at 14-day intervals   (AR-HANDOFF-006).
