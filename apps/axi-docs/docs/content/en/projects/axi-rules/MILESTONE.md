---
id: axi-docs-en-projects-axi-rules
title: Axi Rules
type: project
status: active
tags: [Axi Docs, Projects, projects, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Rules
graph-tags: [Projects, projects]
description: Axi shared rule and SOP authority. The 2026-08 workbench batch added AR-LIFECYCLE-004/005, AR-VERIFY-004/005, and AR-HANDOFF-006 covering the v3 dual-app workbench posture, dual-lane verification recipe, and docs/rules freshness sync. Total rules now 55 (was 50).
project:
  id: axi-rules
  partition: projects
  path: /Volumes/code/workspace/projects/axi-rules
  source-section: shared
---
## 2026-08-08 Refresh Note

axi-rules gained six new AR-* rule entries in the 2026-08 workbench follow-up (AR-LIFECYCLE-004/005, AR-VERIFY-004/005, AR-HANDOFF-006). Total rules now 55. Mirror reflects that delta; canonical rule definitions live in projects/axi-rules/rules/*/AGENTS.md.


# Axi Rules — Milestone

> Dossier milestone. Tracks the **public surface** of this project as seen from Axi Docs.



## Current State

- Workspace status: **stale** (lastVerifiedAt = 2026-06-11 on   the workspace handoff snapshot).
- Dossier: active, refreshed 2026-08-08 to track the 2026-08   batch rule additions.
- Rule catalog now has 55 entries (50 -> 55). Recent   additions: AR-LIFECYCLE-004/005, AR-VERIFY-004/005,   AR-HANDOFF-006.

## Exit Criteria (to keep dossier accurate)

- [ ] `python3 scripts/build-index.py` +   `python3 scripts/validate-index.py` both exit 0.
- [ ] `axi-rules` lastVerifiedAt advances within 30 days   after this dossier lands.

## Long-Term

- [ ] Promote from `status: active` to `status: published`   once architect review approves.
- [ ] Adopt 14-day mirror cadence (AR-HANDOFF-006).
