---
id: axi-docs-zh-projects-axi-rules
title: Axi Rules
type: project
status: draft
tags: [Axi Docs, Projects, projects, shared]
created: 2026-07-22
modified: 2026-07-22
graph-title: Axi Rules
graph-tags: [Projects, projects]
description: Local authority for Axi agent routing, memory, safety, verification, and generated project/rule indexes, with a React visualization of the memory pipeline.
project:
  id: axi-rules
  partition: projects
  path: /Volumes/code/workspace/projects/axi-rules
  source-section: shared
---

# Axi Rules Change Log

Development-facing log for behavior, workflow, validation, user-visible, and
rollback-relevant changes. This is not a release changelog and does not record
full diffs.

Entries are newest-first under `## Unreleased`.

## Unreleased

### Added

- Added `registry_id` cross-reference aliases in `scripts/build-index.py`
  `PROJECT_OVERRIDES` for `axi-notify` (registry id `axi-notify-mobile`) and
  `axi-sports-management-app` (registry id `sports-management`). The
  scan-based index keys projects by directory basename, while the owner
  registry (`infra/axi-workspace-governance/workspace.json`) and handoff
  snapshot use a product-aggregate id by design (monorepos carrying several
  logical products). Recording `registry_id` in the generated
  `index/projects.json` lets this index cross-reference the handoff /
  axi-docs dossiers without renaming the canonical owner key. Also backfilled
  their `purpose`/`stack`, which were previously empty in the scan output.

- Added `photo-sort-samples` and `photo-sort-tools` to `EXCLUDED_NAMES` in
  `scripts/build-index.py`. These are unregistered scratch/data directories
  under `shared/` (absent from `WORKSPACE_INDEX.md`, `workspace.graph.json`,
  and the handoff snapshot) that the discovery scan had been surfacing as
  shared projects, which made `validate-index.py` fail the shared-consumer
  check. Regenerated `index/*` accordingly (project count 32 → 30).

- Added five P0 project-admission rules that require intent routing before
  mutation, place experiments in registered hosts, preserve provider ownership,
  require independent boundaries for standalone projects, and block canonical
  registration without accepted admission evidence.
- Added the first full lifecycle rule set for agent-read project work:
  AR-LIFECYCLE-001 through AR-CICD-004 define change sizing, lifecycle
  artifacts, project bootstrap, development SOP, automatic git commits, submit
  logs, and GitHub Actions / Vercel / Docker CI/CD gates.

### Changed

- Reframed axi-rules as the workspace rule and SOP authority for local agents,
  especially weaker Claude Code CLI / MiniMax M3 sessions that need explicit
  steps for project discovery, execution, verification, handoff, and commits.
- Clarified the workspace-root to project read chain, `workspace-project
  whereami` path semantics, CodeGraph's post-resolution role, and
  surface-specific verification so noninteractive agents do not invent
  frontend or consumer checks.
- Added local validation for `docs/project-docs.manifest.json`, repaired its
  malformed duplicate verification field, and corrected stale TODO/milestone
  paths used by zero-context handoff.
- Classified tool permission denials, timeouts, and budget exhaustion as
  execution-state failures rather than evidence that a file or project is
  missing.
- Clarified that workspace verification lists are inventories, project-local
  surface rules choose the required subset, and generated index JSON is never
  a hand-edit target.
- Added a bounded noninteractive Claude regression harness that separates
  deterministic workspace probes from the model judgment, preventing repeated
  file exploration from consuming the entire budget.
- Separated the handoff manifest `version: 2` contract from the generated
  project index `schema_version`, and pinned the extensionless
  `workspace-project` executable name for weaker agents.
- Promoted weak-prompt takeover/readiness checks into an explicit handoff gate:
  agents must run validate, canonical-path whereami, onboard, handoff-check,
  git status, and read-only verification before claiming development can begin.
- Converted the Claude noninteractive regression into a true weak-prompt test:
  the candidate now receives only a natural user readiness request, while the
  harness audits stream-json tool actions for root/project read order,
  canonical project `whereami`, explicit README/TODO/MILESTONE reads, no
  forbidden write shortcuts, and no final choice-menu handoff.
- Added evidence that the strict weak-prompt standard passed on r8 with
  `ok: true`, `complete: true`, and no P0 failures.
- Tightened readiness audits after manual Claude testing: ordinary readiness
  checks now forbid `workspace-project deps`, `consumers`, `profile`, and
  `test-claude-noninteractive.py --prepare-only`.
- Recorded a full-workspace uncommitted/unpushed audit (2026-06-13) covering
  `projects/`, `products/`, `shared/`, `infra/`, and `tools/`. Codified a
  standing audit constraint: `references/` and everything under it is
  excluded from all future workspace audits, readiness probes, takeover
  chains, dependency/consumer scans, submit logs, and handoff reports.
- Added AR-GIT-005 mandatory commit-msg Lore trailer enforcement across
  the 17 axiom-owned registries; the new `commit-msg` hook blocks any
  commit missing `Tested:` / `Not-tested:` / `Confidence:` /
  `Scope-risk:` / `Directive:` and is generated by
  `infra/axi-workspace-governance/scripts/workspace-git-hooks.mjs`.
  Submit-log bookkeeping now blocks the commit instead of being
  recorded after the fact.
- Added AR-GIT-006 data-driven Lore trailer set: the
  `axi-commit-msg-lore-trailer.mjs` generator now resolves the
  required trailer names from
  `projects/axi-rules/index/rules.json` (with
  `AXI_RULES_INDEX_PATH` override) instead of a hard-coded
  constant, and the validator refuses to register a rule index
  that omits the canonical five trailers. Adding a new
  required trailer is now a one-edit change to
  `RULE_DEFINITIONS` plus `make rules` plus
  `pnpm workspace:git:hooks:install`, with no governance-仓
  code patch.
- Corrected the `AR-GIT-002` cross-reference to
  `git-commit-batch` and added `AR-GIT-008` (P2,
  informational) so the rule body no longer pretends a
  governance-shipped `git-commit-batch.mjs` binary exists.
  The Codex skill under
  `projects/axi-workbench/apps/ollama-menu-assistant/Resources/Skills/git-commit-batch/`
  is the canonical implementation of the grouping contract
  that `AR-GIT-002` describes.
