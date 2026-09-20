---
id: axi-docs-zh-projects-axi-ui
title: Axi UI
type: project
status: draft
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-07-22
graph-title: Axi UI
graph-tags: [Projects, shared]
description: Canonical Axi Black Gold design tokens and theme runtime, plus shared React primitives, shell, settings, CRUD, widgets, addons, and Vite tooling published as @axi packages.
project:
  id: axi-ui
  partition: shared
  path: /Volumes/code/workspace/shared/axi-ui
  source-section: shared
---

# Change Log

Canonical log: [`docs/state/CHANGELOG.md`](docs/state/CHANGELOG.md).

Per AR-BOOTSTRAP-002.1 (axi-rules), this root `CHANGE.md` exists as a pointer to the canonical subdirectory log. B-class projects may also satisfy the 5-file minimum with this pointer plus a docs/HANDOFF.md equivalent.

Created: 2026-06-18 (workspace docs completeness audit F1 remediation)
Reference: infra/axi-workspace-governance/docs/audits/workspace-docs-completeness-audit-2026-06-18.md

## 2026-07-19 — Documentation Sync

- Updated `AGENTS.md` to require the canonical 90-second read order (AGENTS / README / INDEX / PRD / TDD / TODO / MILESTONE / CHANGELOG / HANDOFF), and to forbid hand-editing `docs/HANDOFF.md`.
- Updated `INDEX.md` and `INDEX.zh-CN.md` so the document map covers every authoritative file in `docs/state/`, `docs/axi-ui/`, `docs/governance/`, `docs/brand/`, `docs/reference/`, the v2 manifest, and the lifecycle specs directory.
- Reference: `docs/state/CHANGELOG.md` `[Unreleased]` for any future visible behavior changes.

## 2026-07-19 — Code Style Audit

- Added a read-only audit (`docs/audits/2026-07-19-code-style.md`) covering JSDoc absence, type duplication, `[key: string]: any` overuse, `Promise<any>` returns, hard-coded labels in the default CRUD dictionary, and similar `AxiNumberRange` / hook families across `core`, `shell`, `crud`, `widgets`, `settings`, `vite-plugin`.
- Findings severity: 4 high (H1-H4), 5 medium (M1-M5), 4 low (L1-L4). Each finding lists path, line range, why it matters, and the smallest safe fix. Suggested execution order is H2+H3 → H4 → H1 → M-batch → L-batch.
- Verified clean baseline (no `@axi/*` cycles, no stray `console.log`, no `@ts-ignore`, no leftover TODO/FIXME markers).
- Registered the new `docs/audits/` directory in both `INDEX.md` and `INDEX.zh-CN.md`.

## 2026-07-19 — Spec: Axi Dict Option Consolidation

- Opened `docs/specs/2026-07-19-axi-dict-option-consolidation/` (DESIGN/PRD/TASK).
- Scope: move `AxiDictOption`, `AnyRecord`, and the dictionary-tree lookup into `@axi/core` and let `crud` / `widgets` re-export them, removing the two duplicate declarations surfaced by the audit.
- Out of scope: the broader index-signature cleanup (H4), the `AxiNumberRange` consolidation (M3), and the JSDoc documentation pass (H1). Each remains on the audit follow-up list and is independent of this spec.
- Status: specification stage. Implementation will proceed per TASK.md in 14 atomic commits once the spec is signed off.
