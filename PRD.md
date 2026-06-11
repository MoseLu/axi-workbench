# Axi Workbench PRD

## Problem

Axi Workbench - canonical workbench monorepo for control plane, dashboards, coder, docs/search, fleet, inbox, local assistants, and app CLI

The project needs a complete root documentation suite so humans and agents can understand scope, ownership, requirements, tests, and delivery status before editing.

## Users

- Maintainers working inside `/Volumes/code/workspace/projects/axi-workbench`.
- Agents that need stable read order, boundaries, and verification commands.
- Downstream projects that depend on this root or reference it from the workspace index.

## Requirements

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| REQ-DOC-001 | Maintain the full root documentation suite. | All required docs exist and are internally consistent. |
| REQ-VERIFY-001 | Document runnable verification. | `TDD.md` lists concrete commands or exact blockers. |
| REQ-BOUNDARY-001 | Preserve ownership boundaries. | `AGENTS.md` explains writable scope and cross-project limits. |
| REQ-MILESTONE-001 | Track delivery status. | `MILESTONE.md` records current state and exit criteria. |

## Non-Goals

- Do not replace implementation source files with documentation.
- Do not create broad architecture claims that are not supported by local files.


## Success Metrics

- Required docs are present.
- P0/P1 TODO entries include requirement IDs and tests.
- Verification commands are specific enough for a future agent to run without rediscovery.
