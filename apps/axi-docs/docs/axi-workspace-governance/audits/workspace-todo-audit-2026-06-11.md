# Workspace TODO Audit — 2026-06-11

## Scope

This audit covers active projects, products, shared foundations, infrastructure,
and tools registered in `workspace.json`. Reference repositories are excluded
from delivery prioritization.

## Summary

| Classification | Result |
| --- | --- |
| Projects with no open root TODO items | `axi-notify`, `axi-agent-platform`, `axi-image-preview`, `sports-management`, `ielts-vocab`, `axi-video-downloader`, `axi-proxy-companion` |
| Continuous governance templates | `axi-registry`, `axi-workbench`, `axi-pet`, `axi-ui`, `axi-tauri-starter` |
| Active implementation backlog | `axi-docs`, `axi-rules`, `axi-feishu-codex-bridge` |
| Stale completion state corrected | `axi-docs`, `axi-rules`, `axi-feishu-codex-bridge` |

## Priority Findings

### P0

- `axi-docs`: revoke the previously exposed Blinko JWT and add a committed
  secret-scanning gate. Source hard-coding has already been removed.
- `axi-docs`: replace synchronous filesystem operations on request paths and
  add bounded request timeouts.
- `axi-feishu-codex-bridge`: add CI that runs the existing 93-test unittest
  suite on pull requests.
- `axi-rules`: finish `TD-FE-001` by adding the frontend ESLint configuration
  and `lint` script.

### P1

- `axi-docs`: finish CORS hardening in `vite.config.plugin.ts`; the MCP HTTP
  server already uses configured origins and restricted headers.
- `axi-docs`: consolidate duplicated Vite-plugin and MCP document operations.
- `axi-docs`: add API security/error tests, a coverage threshold, graceful
  shutdown, structured logging, and the remaining user-facing error states.
- `axi-feishu-codex-bridge`: prove live Feishu end-to-end operation for
  `codex-app-ws` and `codex-plus-cdp`, then add per-surface smoke tests.
- `axi-feishu-codex-bridge`: implement routing-hint based surface selection and
  a command-line `--dry-run` option. Environment-based dry-run already exists.
- `axi-rules`: finish the frontend coverage gate in `TD-FE-003`; the current
  unit suite passes but thresholds are not enforced.

## Documentation Corrections

- `axi-rules/MILESTONE.md`: v1 acceptance is now marked shipped. The index has
  schema v2, 16 rules, at least three rules in each core category, a concrete
  safety category, and a CI validation workflow.
- `axi-feishu-codex-bridge/TODO.md`: runtime-path documentation, the script
  wrapper migration, and the shared backend interface are marked complete.
- `axi-docs/TODO.md` and `TODO.zh-CN.md`: items with direct source or test
  evidence are marked complete, including authentication, rate limiting,
  traversal guards, body limits, request cancellation, ErrorBoundary,
  stable result keys, `.env.example`, App integration tests, and container
  manifests.

## Validation

- `axi-rules`: `python3 scripts/validate-index.py` passed.
- `axi-feishu-codex-bridge`: 93 unittest cases passed.
- `axi-docs`: `pnpm --dir app docs:check` passed.
- `axi-docs`: `App.test.tsx` passed 14/14.
- `axi-docs`: the Axi Skills index test passes with a 10-second timeout but
  takes about 5.77 seconds, exceeding the default 5-second threshold in one
  full-suite run. Track this as test performance/flakiness work.

## Counting Notes

- The five-item `REQ-*` TODO files in several repositories are continuing
  governance controls, not five unfinished product features per repository.
- `axi-rules/TODO.md` is only a facade. The active backlog is the four task
  contracts registered in `todo/index.json`, especially the remaining lint and
  coverage gates.
- `axi-docs` still has 46 unchecked entries in `TODO.md`. Many are granular
  subtasks under broader initiatives; the priority list above is the actionable
  compressed view.
