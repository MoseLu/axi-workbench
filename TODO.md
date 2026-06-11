# TODO

Tasks are grouped by inferred requirements. P0/P1 items include test cases.

## P0

- [ ] REQ-DOC-001: Keep the root documentation suite complete and current.
  - Test: verify `README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md` exist in `/Volumes/code/workspace/projects/axi-workbench`.
  - Test: run `rg -n "REQ-DOC-001|PRD|TDD|Milestone" README.md PRD.md TDD.md MILESTONE.md INDEX.md`.

## P1

- [ ] REQ-VERIFY-001: Keep verification commands accurate for the real project stack.
  - Test: run the commands listed in `TDD.md` or document the blocker in `CHANGELOG.md`.

- [ ] REQ-BOUNDARY-001: Preserve ownership and cross-project boundaries.
  - Test: review `AGENTS.md` before broad edits and confirm no generated caches or external sources were edited.

## P2

- [ ] REQ-DOC-002: Add deeper module docs only where source ownership and repeated workflows justify them.
- [ ] REQ-MILESTONE-001: Update `MILESTONE.md` after each verified delivery batch.
