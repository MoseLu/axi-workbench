# Axi Workbench — Repository Root AGENTS

> This file is the **Axi Workbench repository root-level** AGENTS, the first stop for any agent entering this repo.
> Each app under the workbench (`apps/*`), service (`services/*`), shared package (`packages/*`), and tool (`tools/axi-app-cli/`) has its own subtree `AGENTS.md`; this root file does not repeat subtree details, but only describes the constraints for the **"repository facade + cross-project boundary + Six-Layer Control Plane"**.
> **The relationship between the two: root AGENTS = cross-project boundary and Six-Layer SOP; `apps/AGENTS.md` / `services/AGENTS.md` / `packages/AGENTS.md` / `tools/AGENTS.md` / `prompts/AGENTS.md` / `ai/AGENTS.md` = subtree-internal implementation and contracts.** Before editing any subtree under `apps/` `services/` `packages/` `tools/` `ai/` `prompts/`, first read the corresponding subtree `AGENTS.md`; any judgment about repository structure, cross-project contracts, or Six-Layer Control Plane boundaries is read from this file first.

*Last updated: 2026-06-07 — on top of the Six-Layer SOP hand-maintained on 2026-05-30, strengthened the Authoritative Sources / Cross-Project Boundary / Verification / House Rules sections, landed by workspace-docs-gap subagent W1.*

---

## Scope

- **Applies to**: every agent (including Codex, Cursor, automated scanners, doc-audit subagents, and the OMX orchestrator) on first contact with `/Volumes/code/workspace/projects/axi-workbench`.
- **Does not apply to**:
  - Sub-package install/path examples such as `tools/axi-app-cli/packages/*/README.md` (**only cite the top-level** `tools/axi-app-cli/AGENTS.md` / `README.md`, to avoid confusing sub-package Windows/macOS path examples with the local build paths).
  - `references/*`, `infra/axi-workspace-governance/references/*`, `infra/axi-workspace-governance/temp/*` (their governance lives in `infra/axi-workspace-governance/`; see "Cross-Project Boundary").
  - Runtime / build / orchestrator state such as `node_modules/`, `dist/`, `build/`, `.turbo/`, `.omx/`, `.codegraph/`, `.git/`.
- **Reading order**: this file → subtree `AGENTS.md` (if editing any subtree under `apps/` `services/` `packages/` `tools/` `ai/` `prompts/`) → `docs/rules/epap-six-layer-sop.md` (if changing the Six-Layer Control Plane boundary) → `docs/rules/epap-project-doc-agent-sop.md` (if changing the project doc system).

---

## Project Boundary

Axi Workbench is the **"AxiomaticWorld (公理世界) Workbench"** — the canonical owner of the Axi Workbench grand project. It was formed by absorbing the original Axi Workstation control plane together with DevSvc Dashboard, Axi Coder, Verification Inbox, App Search, Fleet Console, Ollama Menu Assistant, and Axi App CLI, carrying the Web portal, `IMEnvelope`, `AgentTask`, resource snapshots, audit, artifact service boundaries, and the local workbench entry point. The remote repository name and a small set of `EPAP_*` / `@epap/*` compatibility entry points are kept until the migration verification is complete.

**Project boundary** (i.e. the modification radius of this agent):

| Path | In project | Note |
|------|------------|------|
| `apps/` | yes | 6 Dashboard Apps (web-portal / devsvc-dashboard / axi-coder / verification-inbox / app-search-system / ollama-menu-assistant), detailed in subtree `apps/AGENTS.md` |
| `services/` | yes | 8 microservices (api-gateway / auth-service / core-service / file-service / notification-service / communication-gateway / control-plane / workflow-engine), detailed in subtree `services/AGENTS.md` |
| `packages/` | yes | 8 shared packages (api-client / axi-rag / desktop / schemas / epap-schemas-compat / types / ui / utils / web), detailed in subtree `packages/AGENTS.md` |
| `tools/axi-app-cli/` | yes | Axi app scaffolding CLI (standalone sub-monorepo); the authoritative entry points are `tools/axi-app-cli/AGENTS.md` / `README.md`; **do not cite** sub-package `README.md` |
| `ai/` | yes | Knowledge base / Agent Platform integration layer (`ai/AGENTS.md`) |
| `prompts/` | yes | Prompt layered foundation (system / global / projects), detailed in `prompts/AGENTS.md` and `prompts/README.md` |
| `docs/` | yes | Project docs (`01-overview.md` ~ `08-todo.md`, `rules/`, `templates/`, `project-docs.manifest.json`) |
| `infra/fleet-console/` | yes | Fleet Console physical service management |
| `AGENTS.md`, `README.md`, `SECURITY.md`, `Makefile`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml` | yes | Root-level project facade and build orchestration |
| `references/*` (workspace-level) | no | Governed by `infra/axi-workspace-governance/`; this project does not translate or edit it |
| `infra/axi-workspace-governance/` | no | Workspace governance repo, not owned by this project |
| `node_modules/`, `dist/`, `build/`, `.turbo/`, `.omx/`, `.codegraph/` | no | Runtime / build / orchestrator state, must not be committed |

**Do not** treat `references/*` or `infra/axi-workspace-governance/` content as the writable scope of this project.

---

## Authoritative Sources

| Topic | Authoritative source |
|------|----------|
| Project entry and current structure | [`README.md`](README.md) |
| Security policy | [`SECURITY.md`](SECURITY.md) |
| Six-Layer Control Plane boundary and runtime SOP | [`docs/rules/epap-six-layer-sop.md`](docs/rules/epap-six-layer-sop.md) |
| Project doc system SOP | [`docs/rules/epap-project-doc-agent-sop.md`](docs/rules/epap-project-doc-agent-sop.md) |
| Prompt layering (system / global / projects) | `prompts/README.md`, [`prompts/AGENTS.md`](prompts/AGENTS.md), `prompts/prompt-layer.manifest.json` |
| Subtree-internal implementation and contracts | `apps/AGENTS.md`, `services/AGENTS.md`, `packages/AGENTS.md`, `tools/AGENTS.md`, `ai/AGENTS.md` |
| Axi App CLI scaffolding (standalone sub-monorepo) | [`tools/axi-app-cli/AGENTS.md`](tools/axi-app-cli/AGENTS.md), [`tools/axi-app-cli/README.md`](tools/axi-app-cli/README.md) |
| Executable scripts and package boundaries | `package.json`, `pnpm-workspace.yaml`, each sub-package `package.json`, `turbo.json` |
| Document inventory and ownership | [`docs/project-docs.manifest.json`](docs/project-docs.manifest.json) (status: legacy; see House Rules § "manifest status note") |
| Workspace relations and verification | `/Volumes/code/workspace/WORKSPACE_INDEX.md`, `/Volumes/code/workspace/workspace.graph.json` |

> **When priorities conflict**: root `AGENTS.md` > `docs/rules/epap-six-layer-sop.md` > subtree `AGENTS.md` > `prompts/` layering > personal memory.
> When cross-workspace references conflict, workspace root `AGENTS.md` > governance mirror > this project's root `AGENTS.md`.

---

## Cross-Project Boundary

- **Do not translate**: `references/*`, `references/archives/*`, `infra/axi-workspace-governance/references/*`, `infra/axi-workspace-governance/temp/*`.
- **Do not copy content into this project**: README, AGENTS, and ADR files from other workspace projects must not be moved verbatim into `docs/`. This project only carries the 8 product documents of "Axi Workbench itself" (`01-overview.md` ~ `08-todo.md`) + rules + templates.
- **Do not pretend to be the source**: rule files such as `docs/rules/epap-six-layer-sop.md` have already been migrated into this repo; if a same-named file reappears on the governance side, write back into this repo and regenerate the mirror.
- **Consumable**: query the `consumes` / `consumers` / `provides` / `contracts` of `axi-workbench` through the workspace graph (`workspace-project`); do not hard-code cross-project absolute paths in business code.
- **Consumed by**: this project exposes the workbench capability to the outside world through the `IMEnvelope` / `AgentTask` protocol, shared packages such as `@axi/workstation-control-plane`, and the Dashboard Apps `pnpm typecheck` verification entry; downstream consumers (other Axi Dashboard Apps, AI agents, CC-Connect) must connect through these contract entry points.

### Cross-workspace back-links (mandatory, captured in root AGENTS)

The executive overview requires that, when filling in the ROOT_AGENTS of an owner project, the cross-workspace back-links must be back-filled so that a change in any one place can be found by the other projects.

- Workspace root index: [`/Volumes/code/workspace/AGENTS.md`](/Volumes/code/workspace/AGENTS.md), [`/Volumes/code/workspace/WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) (Axi Workbench row)
- Naming and branding: [`/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`](/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md)
- DevSvc / PM2 service orchestration: [`/Volumes/code/workspace/docs/DEV_SERVICES.md`](/Volumes/code/workspace/docs/DEV_SERVICES.md), [`/Volumes/code/workspace/dev-services.config.json`](/Volumes/code/workspace/dev-services.config.json)
- Governance repo: [`/Volumes/code/workspace/infra/axi-workspace-governance/`](/Volumes/code/workspace/infra/axi-workspace-governance/) (referenced by this repo, not written into) + [`infra/axi-workspace-governance/docs/project-catalog.md`](/Volumes/code/workspace/infra/axi-workspace-governance/docs/project-catalog.md)
- Governance PR template and release process: [`/Volumes/code/workspace/infra/axi-workspace-governance/.github/PULL_REQUEST_TEMPLATE.md`](/Volumes/code/workspace/infra/axi-workspace-governance/.github/PULL_REQUEST_TEMPLATE.md), [`/Volumes/code/workspace/infra/axi-workspace-governance/docs/RELEASING.md`](/Volumes/code/workspace/infra/axi-workspace-governance/docs/RELEASING.md)
- Workspace-level i18n overview and gap audit: [`/Volumes/code/workspace/docs/audit/workspace-i18n-translation-2026-06-07.md`](/Volumes/code/workspace/docs/audit/workspace-i18n-translation-2026-06-07.md), [`/Volumes/code/workspace/docs/audit/workspace-docs-gap-audit-2026-06-07.md`](/Volumes/code/workspace/docs/audit/workspace-docs-gap-audit-2026-06-07.md)
- Workspace graph CLI: [`/Volumes/code/workspace/scripts/workspace-project`](/Volumes/code/workspace/scripts/workspace-project) (`deps axi-workbench` / `consumers axi-workbench` / `validate`)
- Neighbour projects (consumed by this workbench control plane): `/Volumes/code/workspace/projects/axi-notify/`, `/Volumes/code/workspace/projects/axi-pet/`, `/Volumes/code/workspace/projects/axi-agent-platform/`, `/Volumes/code/workspace/projects/axi-docs/`, `/Volumes/code/workspace/projects/axi-image-preview/`, `/Volumes/code/workspace/shared/axi-ui/`, `/Volumes/code/workspace/shared/axi-registry/`, `/Volumes/code/workspace/tools/axi-app-cli/`

---

## Verification

Minimum verification sequence (from the Axi Workbench row of the workspace index `WORKSPACE_INDEX.md`):

```bash
# Cross-project contract and graph integrity
/Volumes/code/workspace/scripts/workspace-project validate

# Repo-wide default type check
pnpm type-check

# Repo-wide default test
pnpm test

# Control plane contract test
pnpm test:workstation

# DevSvc Dashboard
pnpm --dir apps/devsvc-dashboard typecheck

# Axi Coder
pnpm --dir apps/axi-coder typecheck

# Verification Inbox
npm --prefix apps/verification-inbox run typecheck

# Fleet Console
python3 infra/fleet-console/scripts/fleetctl.py validate
```

Change-driven minimum verification selection:

- Edit `apps/<x>/**` → run `apps/<x>` minimum verification (`typecheck` / `test`), and depending on the change scope also run `pnpm test:workstation`.
- Edit `services/<x>/**` → run the corresponding service's `go test` / `mvn test` / `pytest` entry.
- Edit `packages/<x>/**` (especially `epap-schemas-compat`) → run `pnpm type-check` + at least one downstream app's `typecheck`.
- Edit `tools/axi-app-cli/**` → run `pnpm --dir tools/axi-app-cli boundaries:check` + `pnpm --dir tools/axi-app-cli capabilities:check`.
- Edit `prompts/**` → run the layered checks listed in `prompts/AGENTS.md` and `prompts/README.md`; do not terminate the session or force-overwrite user content just to generate AGENTS.
- Edit `docs/rules/*` or this file → no build needed; ensure file existence + that the back-links are not broken.
- Cross-project shared contracts (`@axi/workstation-*` packages) → run the minimum verification of every consumer listed by `workspace-project consumers axi-workbench`.

---

## Workspace Entry (preserved 2026-05-30 section)

- Current project root: `/Volumes/code/workspace/projects/axi-workbench`.
- Parent workspace rules: `/Volumes/code/workspace/AGENTS.md`.
- Workspace index: `/Volumes/code/workspace/WORKSPACE_INDEX.md`.
- Workspace relation graph: `/Volumes/code/workspace/workspace.graph.json`.
- Before any cross-project edit, first use `/Volumes/code/workspace/scripts/workspace-project deps axi-workbench` or `/Volumes/code/workspace/scripts/workspace-project consumers <project>` to confirm the provider/consumer boundary.
- Do not treat `/Volumes/code/workspace` as a single monorepo; follow the index into the real owner project and then read the nearest `AGENTS.md`.

## Standard Runtime Model (Six-Layer Control Plane)

All work related to IM, communication, project management, AgentTask, memory, documents, and base capabilities must uniformly use the Axi Workbench Six-Layer Control Plane model:

1. **IM Layer**: only responsible for user input and message presentation.
2. **Communication Layer**: only responsible for route binding, pairing, approval, attachment references, idempotency, receipts, and channel rendering.
3. **Software Layer**: owns projects, services, workflows, AgentTask, runtime sessions, and project state.
4. **Base Service Layer**: owns the memory store, document store, file store, audit store, tool registry, MCP/skills, and the local model/browser/runtime capability catalog.
5. **Physical Service Layer**: owns machines, devices, ports, disks, processes, and network resources. Physical resources never own a project.
6. **External Capability Layer**: owns third-party API, remote model services, and remote agent services.

> The legacy product-tech-stack layering in the architecture document is kept only as historical design context; control plane runtime decisions follow [`docs/rules/epap-six-layer-sop.md`](docs/rules/epap-six-layer-sop.md).

## Mandatory Boundaries (Six-Layer Control Plane)

- An IM adapter **must not** execute business logic, **must not** read the project directory.
- communication-gateway **must not** invoke Codex, **must not** read the workspace index, **must not** query the memory table, **must not** own project state.
- The business input of control-plane **must** come from a standard `IMEnvelope` or a typed control API.
- Agent execution **must** be expressed as a software-layer-managed `AgentTask`.
- memory, docs, files, audit, tool registry, and capability catalog all belong to the Base Service Layer.
- Servers, ADB devices, ports, processes, and host health only belong to the Physical Service Layer.
- Third-party API and remote agents only belong to the External Capability Layer.
- **Hooks must not** be used as an Axi Workbench runtime bypass.

## SOPs that Must Be Followed (Required SOP)

- Before adding or modifying a control-plane workflow, first consult [`docs/rules/epap-six-layer-sop.md`](docs/rules/epap-six-layer-sop.md).
- Before adding or modifying agent behavior, output style, or default working mode, first consult [`prompts/README.md`](prompts/README.md) and the three prompt layers:
  - `prompts/system/*.mdc`: immutable foundation.
  - `prompts/global/*.mdc`: shared by all projects.
  - `prompts/projects/*.mdc`: per-project supplements.
- Before adding or modifying the project doc system, first consult [`docs/rules/epap-project-doc-agent-sop.md`](docs/rules/epap-project-doc-agent-sop.md).
- Each workflow **must** declare: entry layer / authoritative source of truth / allowed downstream layers / output renderer / audit artefact / verification path.

When testing user-visible behavior, use the layered verification ladder:

1. API-level deterministic tests.
2. Control-plane audit checks.
3. When UI is involved, use Codex browser or Chrome for visual / product-experience checks.
4. When claiming a real user action is available, use `computer-use` or device-level verification.

---

## House Rules

- **Do not** commit OMX internal state (`.omx/metrics.json`, `.omx/state/subagent-tracking.json`, `.omx/state/tmux-hook-state.json`, `.omx/state/session.json`, etc.).
- **Do not** commit Codex/Cursor session directories (`.codegraph/`, the agent transcripts folder, `.cursor/projects/.../terminals/`).
- **Do not** put `.omx/` as a whole under version control (only explicit configuration exceptions such as `.omx/config/` are allowed).
- **Do not** merge into `main`, push tags, delete remote branches, or publish a formal release without an explicit owner instruction.
- **Do not** treat `references/*` or `infra/axi-workspace-governance/` content as the writable scope of this project.
- **Do not** directly cite sub-package install/path examples such as `tools/axi-app-cli/packages/*/README.md`; only cite the top-level `tools/axi-app-cli/AGENTS.md` / `tools/axi-app-cli/README.md`.
- **Do not** repeat any hard-coded JWT / API key / personal email; if a literal token is encountered, **redact it to a `Bearer <REDACTED>` placeholder**.
- **Do** keep the two-layer structure of the root `AGENTS.md` and the 6 subtree `AGENTS.md` files (`apps/` `services/` `packages/` `tools/` `ai/` `prompts/`): the root talks about boundaries and the Six-Layer SOP, the subtree talks about implementation and contracts.
- **Do** query `/Volumes/code/workspace/scripts/workspace-project consumers axi-workbench` before changing cross-project contracts.
- **Do** keep placeholders such as `git clone <url>` verbatim, and do not replace them with local absolute paths.

### manifest status note

The `status: legacy` in `docs/project-docs.manifest.json` means that the root-level facade files of this repo (such as `CHANGELOG.md` / `TODO.md` / `MILESTONE.md`) **have not yet been completed** (see `docs/audit/workspace-docs-gap-audit-2026-06-07.md` §2.1 P0 list). Until the owner decides the completion order, the auditable changes of this repo must **go directly through the commit log + `docs/08-todo.md`**, and must not rely on the root-level facade files listed by the manifest.
