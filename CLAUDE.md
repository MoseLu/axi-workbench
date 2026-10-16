# axi-workbench Claude Code Conventions

> Canonical Claude-Code entrypoint for `workbench/axi-workbench`.
> `AGENTS.md` is the source of truth for project rules; this file is
> the Claude-Code-flavored overlay that names the read order, common
> tasks, conventions, and boundaries without duplicating the long-form
> rules already in `AGENTS.md`. When the two files disagree, `AGENTS.md`
> wins.

## Overview

`workbench/axi-workbench` is the **AxiomaticWorld Workbench** — the
authoritative owner of the Personal OS workbench product. It is a pnpm
+ Turbo monorepo that evolved from the original Axi Workstation control
plane by absorbing DevSvc Dashboard, Axi Coder, Verification Inbox, App
Search, Fleet Console, Ollama Menu Assistant, and the Axi App CLI
scaffolder. The repo carries:

- A monorepo facade with `apps/`, `services/`, `packages/`, `tools/`,
  `ai/`, `prompts/`, `docs/`, `infra/`, `backend/`, `scripts/`, `config/`.
- Three delivery forms of the workbench UI: web (`apps/workbench`),
  Capacitor mobile (`apps/workbench-mobile`), Tauri desktop
  (`apps/workbench-desktop`), unified under one build pipeline.
- A host (`apps/devsvc-dashboard`) that launches the hosted/vertical
  sub-apps under the same render-host contract.
- A production backend plane under `services/` (Go / Python / Java
  mixed; see `services/AGENTS.md`), the embedded Python runtime in
  `backend/`, and the Fleet Console physical-service manager in
  `infra/fleet-console/`.
- The six-layer control-plane SOP (IM / Communication / Software /
  Base Service / Physical Service / External Capability) as documented
  in `docs/rules/epap-six-layer-sop.md`.

The repo is also a **Workspace Entry Render Host** for the Workspace
Entrance Spatial Graph PRD — it renders, but it does not own workspace
fact. Fact ownership lives with `axi-workspace-governance` (registration)
and `axi-kernel` / `axi-workbench-cli` (data plane).

## Read Order

For a fresh Claude Code session touching this repo, read in this order
and stop to re-read only when a diff touches an earlier layer:

1. `AGENTS.md` — root agent rules, six-layer SOP, workspace render-host
   boundary, cross-project boundary, project boundary, verification.
2. `CLAUDE.md` — this file (Claude-Code overlay: tasks, conventions,
   boundaries).
3. `README.md` / `ARCHITECTURE.md` / `INDEX.md` — entry, architecture
   facade, and canonical document map.
4. `HANDOFF.md` and `docs/HANDOFF.md` — current work, active scripts,
   contracts, freshness.
5. `CHANGE.md` (root pointer) and `docs/state/CHANGELOG.md` (canonical
   log) — recent changes; append new entries under
   `docs/state/CHANGELOG.md`, not the root pointer.
6. `docs/rules/epap-six-layer-sop.md` — six-layer control-plane rules;
   read before any workflow / cross-layer change.
7. `docs/rules/axi-workbench-boundary-sop.md` — anti-coupling rules
   for the workbench boundary; read before any cross-project contract
   change.
8. `docs/rules/epap-project-doc-agent-sop.md` — project document SOP;
   read before adding or moving documents.
9. `docs/architecture/source-catalog.md` — source roles, main entries,
   workspace membership per `apps/AGENTS.md` / `services/AGENTS.md` /
   `packages/AGENTS.md` / `tools/AGENTS.md` / `ai/AGENTS.md` /
   `prompts/AGENTS.md`.
10. `docs/governance/SECURITY.md` — secret-handling and operator
    policy; read before touching any secret, `.env`, or remote host.
11. Project rule router:
    `/Volumes/code/workspace/foundation/axi-rules/INDEX.md` for
    cross-cutting rule routing (memory, verification, safety).
12. Workspace-level façade: `/Volumes/code/workspace/AGENTS.md` and
    `/Volumes/code/workspace/WORKSPACE_INDEX.md`.

When a task is a takeover/readiness check, also run the local handoff
chain (`workspace-project validate` + canonical-path `whereami` +
project `AGENTS.md` + `workspace-project onboard axi-workbench --json`
+ `workspace-project handoff-check axi-workbench` +
`git status --short --branch` + nearest read-only verification), per
the global Entry Read Order in `/Volumes/code/workspace/AGENTS.md`.

## Project Context

- **Stack**: pnpm + Turbo monorepo. TypeScript + React + Vite (web
  portals under `apps/`). Tauri 2 (`apps/workbench-desktop`) and
  Capacitor (`apps/workbench-mobile`) for desktop and mobile shells.
  Go services under `services/` (control plane, communication
  gateway, resource gateway, workflow engine, identity adapter,
  platform core, etc.). Python `backend/` (`mini_agent` +
  `local_server`). Helm chart under `infra/helm/` for
  `axi-workbench-platform`. `aiofleet` console under
  `infra/fleet-console/`.
- **Six layers** (canonical control plane, see
  `docs/rules/epap-six-layer-sop.md`): IM / Communication / Software /
  Base Service / Physical Service / External Capability. Every new
  workflow must declare its entry layer, authority source, allowed
  downstream layers, output renderer, audit artifact, and verification
  path before it ships.
- **Apps** (mixed source tree, three delivery forms plus host plus
  hosted/verticals; see `apps/AGENTS.md` and
  `docs/architecture/source-catalog.md`):
  `apps/workbench` (Web admin), `apps/workbench-mobile` (Capacitor),
  `apps/workbench-desktop` (Tauri 2), `apps/devsvc-dashboard` (Host),
  hosted/verticals (`axi-coder`, `verification-inbox`,
  `resource-orchestration`, `axi-docs`, `axi-artboard`,
  `ollama-menu-assistant`, etc.). `axi-ui` is referenced via
  `workspace:*` — never copy it; always link it.
- **Services** (production backend plane; not "same runtime" just
  because they share a parent; see `services/AGENTS.md`): control
  plane, communication gateway, resource gateway, workflow engine,
  identity adapter, platform core, plus dedicated split services.
- **Packages** (shared layer; see `packages/AGENTS.md`): `api-client`,
  `schemas`, **epap-schemas-compat (legacy migration compat)**, `types`,
  `ui`, `utils`, `workbench-foundation`, `artboard-vite-plugin` (AST
  source-stamp Vite plugin).
- **Tools**: `tools/axi-app-cli/` is an independent sub-monorepo
  scaffolder. Authoritative entry is
  `tools/axi-app-cli/AGENTS.md` / `README.md`; do not cite child
  package READMEs.
- **AI** + **Prompts**: `ai/` is the knowledge base / Agent Platform
  integration layer. `prompts/` is the three-layer prompt substrate
  (`system/`, `global/`, `projects/`); see
  `prompts/AGENTS.md` / `prompts/README.md` /
  `prompts/prompt-layer.manifest.json`.
- **Workbench absorb history**: `axi-coder`, `verification-inbox`,
  `axi-docs`, `axi-artboard`, and other verticals were absorbed into
  the workbench tree. AGENTS.md references them as absorbed apps;
  trust the in-tree capability semantics for them, and augment with the
  canonical rule router pointer
  (`../../foundation/axi-rules/INDEX.md`).
- **Production topology**: Helm-deployed unit
  `axi-workbench-platform` under `infra/helm/`. Local dev uses
  DevSvc / PM2 profiles from `/Volumes/code/workspace/dev-services.config.json`
  when long-running processes are needed.
- **Workspace Entry Render Host boundary** (PRD §10.2 hard
  constraint): this repo **renders** the workspace spatial graph; the
  fact source is `axi-workspace-governance` (`workspace.json`,
  `workspace.graph.json`), and the data plane is
  `axi-kernel` (objects, relations, drift detection) plus
  `axi-workbench-cli` (CLI/DOT/JSON, no Web UI). This repo must not
  edit those registries directly; all persistent governance changes
  flow through `scripts/workspace-project-cli.mjs` or
  `axi_kernel.register_*` APIs.

## Common Tasks

The verification philosophy is "narrow, layered, evidence-backed".
Pick the smallest set that covers the diff.

### Root verification entry points

```bash
# Cross-project contract + graph integrity
/Volumes/code/workspace/scripts/workspace-project validate

# Whole-repo CI (includes distributions build verification)
/Volumes/code/workspace/scripts/workspace-project verify axi-workbench
# or, inside the repo:
pnpm verify:ci

# Whole-repo default typecheck + test
pnpm type-check
pnpm test

# Workstation control-plane contract tests
pnpm test:workstation
```

### Per-subtree verification

```bash
# DevSvc Dashboard (Host)
pnpm --dir apps/devsvc-dashboard typecheck

# Axi Coder (absorbed app)
pnpm --dir apps/axi-coder typecheck

# Verification Inbox
npm --prefix apps/verification-inbox run typecheck

# Axi App CLI scaffolder boundaries + capabilities
pnpm --dir tools/axi-app-cli boundaries:check
pnpm --dir tools/axi-app-cli capabilities:check

# Fleet Console physical-service manager
python3 infra/fleet-console/scripts/fleetctl.py validate

# Workbench anti-coupling boundaries
pnpm check:boundaries
```

### Per-diff minimum verification (pick by surface)

- `apps/<x>/**` → that app's `typecheck` + `test`; widen to
  `pnpm test:workstation` when the control plane is touched.
- `services/<x>/**` → service's native test entry (`go test`,
  `mvn test`, `pytest`).
- `packages/<x>/**` (especially `epap-schemas-compat`) → `pnpm
  type-check` + at least one downstream app `typecheck`.
- `tools/axi-app-cli/**` → `pnpm --dir tools/axi-app-cli
  boundaries:check` + `capabilities:check`.
- `prompts/**` → `prompts/AGENTS.md` / `prompts/README.md` layered
  validation; never terminate a session or overwrite user content to
  "fix" a generated AGENTS.
- `docs/rules/*` or this file → no build required; confirm presence
  and unbroken back-links.
- Cross-project shared contracts (`@axi/workstation-*` packages) →
  run `workspace-project consumers axi-workbench` and execute the
  minimum verification of every listed consumer.

## Conventions

### Commit style (Lore Commit Protocol)

- Conventional Commits scope tag, e.g. `docs(workbench): ...`,
  `fix(workbench): ...`, `chore(workbench): ...`,
  `perf(workbench): ...`.
- Subject line in English, imperative mood, `<= 72` characters.
- Body explains the **why** (what problem, what evidence) more than the
  **what**. Include `Tested:`, `Not-tested:`, `Confidence:`,
  `Scope-risk:` blocks when the diff is non-trivial.
- Lore trailer at the end: `Directive: <ticket> / <source>`, e.g.
  `Directive: P3-52 / workspace-audit-remediation`. Lore trailers are
  required for workspace-audit-remediation and Wave-driven batches;
  optional but recommended for ordinary feature work.
- Branch off `dev`, not `main`. Working tree on `dev` or a short
  `agent/<task>` branch. Do not merge to `main` without an explicit
  owner request.
- Pre-commit hook refreshes `project-completion.json` automatically;
  do not hand-edit that file.

### Six-layer control plane

- IM adapters must not run business logic, must not read project
  directories.
- `communication-gateway` must not call Codex, must not read the
  workspace index, must not query memory tables, must not own project
  state.
- Control-plane business input must come from a typed `IMEnvelope` or
  typed control API.
- Agent execution must be expressed as a software-layer `AgentTask`.
- Memory, docs, files, audit, tool registry, and capability catalog
  belong to the Base Service layer.
- Servers, ADB devices, ports, processes, host health belong to the
  Physical Service layer.
- Third-party APIs and remote agent services belong to the External
  Capability layer.
- Hooks must not be used as a Workbench runtime bypass.

### Workspace Entry Render Host boundary

- Do not edit `workspace.json`, `workspace.graph.json`, or the Kernel
  registry from this repo. All persistent governance change goes
  through `scripts/workspace-project-cli.mjs` or `axi_kernel.register_*`
  APIs.
- Declare `axi-kernel` and `axi-workbench-cli` as `peerDependencies`;
  version contracts are locked in
  `workspace.graph.json.contracts`.
- Pure rendering code (UI / interaction / view state that introduces
  no new fact) can be modified locally.
- Any new fact (node, relation, layout coordinate, lens state, detail
  field) must first become authoritative in `workspace.json` /
  `workspace.graph.json`, then be exposed by the data-plane adapter.
- `axi-workbench-cli` is the CLI/DOT/JSON consumer counterpart of this
  repo's Web/Desktop/Mobile — it is not a second Workbench UI.

### Cross-project boundary

- Do not translate `references/*` or `infra/axi-workspace-governance/`
  content into this repo.
- Do not copy other projects' README / AGENTS / ADR content into
  `docs/`; this repo only carries its own product doc
  (`docs/00-product-overview.md`) + rules + templates.
- Do not hard-code cross-project absolute paths inside business code;
  use `workspace-project` contracts and `consumes` / `consumers` /
  `provides` queries.
- Before changing an exported capability or contract, run this
  provider's verification **and** the listed consumer verifications in
  `workspace.graph.json`.

## Boundaries

- **Writable**: `apps/`, `services/`, `packages/`, `tools/`,
  `ai/`, `prompts/`, `docs/`, `infra/fleet-console/`, `infra/helm/`,
  `backend/`, `scripts/`, `config/`, plus root `AGENTS.md`,
  `CLAUDE.md`, `README.md`, `ARCHITECTURE.md`, `INDEX.md`,
  `HANDOFF.md`, `CHANGE.md`, `Makefile`, `package.json`,
  `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`,
  `docs/governance/SECURITY.md`.
- **Not writable**: `references/*` (workspace-level, governed by
  `infra/axi-workspace-governance/`); `infra/axi-workspace-governance/`
  itself; `node_modules/`, `dist/`, `build/`, `.turbo/`, `.omx/`,
  `.codegraph/`, `.git/` and any other runtime/build/orchestrator
  state.
- **Never without explicit owner instruction**: merge to `main`,
  publish a formal release, push tags, delete remote branches, change
  production secrets, change Helm production values, run destructive
  Fleet Console operations against production hosts.
- **Never commit**: hard-coded JWT, API keys, user emails, OAuth
  material, production secrets, or OMX / Codex-Cursor session state
  (`.omx/`, `.codegraph/`, agent transcripts, `.cursor/projects/.../terminals/`,
  etc.). When citing a literal token in docs, **redact to `Bearer
  <REDACTED>`**.
- **Never bypass**: `gateway-bff`-style ingress in apps that have one;
  never hand-edit generated outputs flagged by project guidance
  (`project-completion.json`, sync-generated files in `docs/state/`,
  rule-router index JSON in `foundation/axi-rules/index/`).
- **Never** use `tools/axi-app-cli/packages/*/README.md` as a path
  reference; use the top-level `tools/axi-app-cli/AGENTS.md` /
  `README.md` only.

## Request Defaults

- Treat the user's most recent message as current fact.
- For "接手" / "zero-context takeover" / "检查当前状态" / readiness
  prompts: run the local handoff chain
  (`workspace-project validate` + canonical-path
  `whereami /Volumes/code/workspace/workbench/axi-workbench` +
  `workspace-project onboard axi-workbench --json` +
  `workspace-project handoff-check axi-workbench` +
  `git status --short --branch` + nearest read-only verification),
  then read this file, `AGENTS.md`, `README.md` / `ARCHITECTURE.md`,
  and `docs/state/CHANGELOG.md`.
- After a verified result, do not list multiple-choice next steps.
  Pick the default next safe action and execute it, then report.
- If a true blocker is hit, name the blocker, the minimal default
  plan, and the single irreversible action that would resolve it —
  do not invent extra checkpoints.
- Reply in the user's language. For Chinese prompts, prefer concise
  Chinese reports with file paths in absolute form.
