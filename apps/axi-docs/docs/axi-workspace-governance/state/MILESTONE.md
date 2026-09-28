<!-- Layer: 3 | Milestone | Module: workspace-root -->
<!-- Parent Architecture: .claude/ARCHITECTURE.md -->
<!-- Updated: 2026-09-20 -->

# Workspace Milestone

Milestone describe workspace-level documentation and governance maturity. They
do not replace project-local roadmaps.

## Version Target

| Field | Value |
| --- | --- |
| Version | 2026.06-docs-layering |
| Goal | Establish a layered workspace documentation system and make it visible through Axi Docs. |
| Start | 2026-06-07 |
| Target | TBD by owner |

## Milestone

### WRK.1 - Layered Documentation Baseline

Goal:
Create the L1 -> L2 -> L3 documentation chain for the workspace root.

Exit Criteria:
- [x] `.claude/PARADIGM.md` exists and defines requirement/test binding.
- [x] `.claude/ARCHITECTURE.md` exists and defines module ownership.
- [x] Root `docs/state/TODO.md` and `docs/state/MILESTONE.md` exist.
- [x] `docs/`, `scripts/`, `infra/`, `shared/`, and `tools/` have `AGENTS.md`.

Verification:
- `test -f .claude/PARADIGM.md`
- `test -f .claude/ARCHITECTURE.md`
- `test -f docs/AGENTS.md`

### WRK.2 - Axi Docs Workspace Ingestion

Goal:
Make workspace operator docs and graph contracts discoverable in Axi Docs.

Exit Criteria:
- [x] Root workspace docs are included in the Axi Docs workspace source.
- [x] `workspace.graph.json` capability nodes have readable pages or generated entries.
- [ ] Axi Docs `project-docs.manifest.json` matches actual files.
- [ ] Axi Docs governance check validates manifest references.

Notes:
- projects.index.json (Axi Docs project dossier index) is generated and lists 30 projects.
- Two project manifest files are missing: `axi-proxy-companion` (directory does not exist) and `axi-video-downloader` (directory exists but has no `docs/` subdir).
- Governance check cannot run without `pnpm install` in axi-docs/app (node_modules absent) and fails on current git branch.

Verification:
- `pnpm --dir projects/axi-docs/app governance:check`
- `pnpm --dir projects/axi-docs/app verify`

### WRK.3 - Governance And Service Consistency

Goal:
Keep workspace graph, dev services, and governance docs synchronized.

Exit Criteria:
- [ ] `workspace-project validate` passes after docs and graph changes.
- [x] `docs/DEV_SERVICES.md` matches `dev-services.config.json` active profiles.
- [ ] Governance mirror gaps are either synced or explicitly excluded.

Notes:
- `workspace-project validate` fails because `axi-proxy-companion` is registered in `workspace.graph.json` and `projects.index.json` but the path `/Volumes/code/workspace/tools/axi-proxy-companion` does not exist.
- `devsvc doctor core` passes: `devsvc-dashboard` is online.
- DEV_SERVICES.md profiles (manage/monitor/ingress/core/daily/frontend/ielts-vocab/fleet-console/axi-verification-inbox/cockpit-tools/axi-coder/sub2api/axi-notify) are documented; config tracks runtime services (devsvc-*, fleet-console-dashboard, ielts-vocab-*, ai-resource-orchestration-web, axi-notify-relay) — structural alignment present.

Verification:
- `/Volumes/code/workspace/scripts/workspace-project validate`
- `/Volumes/code/workspace/scripts/service/devsvc/devsvc doctor core`

<!-- MANUAL: workspace-specific milestone notes preserved across updates -->
