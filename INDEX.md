# Axi Workbench — Doc Map (INDEX.md)

> Canonical document map for `workbench/axi-workbench`. This file is the
> single source of truth for "where do I read or update X?" inside the
> Axi Workbench monorepo. For cross-project relations, see
> `/Volumes/code/workspace/workspace.graph.json` (run
> `workspace-project show axi-workbench` /
> `workspace-project consumers axi-workbench` /
> `workspace-project deps axi-workbench`).
>
> **Last refreshed**: 2026-10-17 (P3 docs audit gap — root INDEX.md
> strengthened from 28-line pointer to full doc-map router).
>
> **Stage**: production / active — the largest Axi workbench integration
> hub with absorbed apps `axi-coder`, `axi-docs`, `axi-artboard`,
> `resource-orchestration`, `axi-docs`-derived docs hub, DevSvc Dashboard
> host, plus legacy applications per the 2026-09-20 baseline merge.

---

## Overview

**Axi Workbench** is the **AxiomaticWorld（公理世界）工作台** monorepo
and the authoritative owner of the local workbench control plane. It was
formed when the original Axi Workstation control plane absorbed DevSvc
Dashboard, Axi Coder, Verification Inbox, App Search, Fleet Console,
Ollama Menu Assistant and Axi App CLI. Today it carries the Web admin
control center (`apps/workbench`), the Mobile role-execution auxiliary
(`apps/workbench-mobile` + native Android via Capacitor / Gradle), the
Tauri-based desktop client (`apps/workbench-desktop`), the local service
Host (`apps/devsvc-dashboard`), the documentation hub and MCP server
(`apps/axi-docs`), the agent node-picker canvas (`apps/axi-artboard`),
the resource orchestration gateway UI (`apps/resource-orchestration`),
the hosted coder and inbox apps, and the Go-based API plane under
`services/`.

This repository is the **render host** for the Workspace Entrance
Spatial Graph, not its source of truth: fact ownership and data plane
live in `infra/axi-workspace-governance/`, `projects/axi-kernel/`, and
`workbench/axi-workbench-cli/`. Workbench consumes those peer
dependencies and never persists new facts.

**Six-Layer Control Plane** is the load-bearing operating model: IM
layer, Communication layer, Software layer, Base Service layer,
Physical Service layer, External Capability layer. Cross-layer bypasses
are forbidden; the rules live in
[`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md).

---

## Read Order

> Rule router: see
> [`/Volumes/code/workspace/foundation/axi-rules/INDEX.md`](../../foundation/axi-rules/INDEX.md)
> for the workspace-level rule catalog before reading project-local docs.

1. **[`AGENTS.md`](./AGENTS.md)** — root project boundary, Six-Layer SOP,
   read order, House Rules, verification, relationship metadata.
2. **[`README.md`](./README.md)** / [`README.zh-CN.md`](./README.zh-CN.md) —
   English / Chinese entrypoint, current structure, tech stack, commands.
3. **[`INDEX.md`](./INDEX.md)** *(this file)* — document map router.
4. **[`CLAUDE.md`](./CLAUDE.md)** — Claude-Code-specific addenda (per the
   `axi-rules` AGENTS multi-adapter template).
5. **[`docs/00-product-overview.md`](./docs/00-product-overview.md)** —
   merged product doc covering §1 Overview, §2 Architecture, §3 Frontend,
   §4 Backend, §5 AI Layer, §6 Infrastructure, §7 Docs Project, §8 TODO
   (frozen). Supersedes 8 historical product docs as of 2026-09-27.
6. **[`HANDOFF.md`](./HANDOFF.md)** — root pointer for commit ledger /
   active work and recent state (CL-018 / CL-020 progress).
7. **[`docs/HANDOFF.md`](./docs/HANDOFF.md)** — full handoff (commands,
   contracts, environment, troubleshooting, freshness, image-asset audit
   Wave A–G summary).
8. **[`CHANGE.md`](./CHANGE.md)** + [`docs/state/CHANGELOG.md`](./docs/state/CHANGELOG.md)
   — root pointer + canonical Keep-a-Changelog history.
9. **[`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md)**
   — physical source topology: app roles, root pnpm membership, Host
   registration, cleanup order. **Required reading before touching any
   subdirectory.**
10. **Subtree `AGENTS.md`** — `apps/AGENTS.md`, `services/AGENTS.md`,
    `packages/AGENTS.md`, `tools/AGENTS.md`, `ai/AGENTS.md`,
    `prompts/AGENTS.md`, `backend/AGENTS.md`, `infra/AGENTS.md`,
    `docs/AGENTS.md`. Pick the one matching your edit target.
11. **[`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md)**
    — Six-Layer SOP (authoritative operating model).
12. **[`docs/rules/axi-workbench-boundary-sop.md`](./docs/rules/axi-workbench-boundary-sop.md)**
    — cross-project aggregation boundary + reverse-coupling rules.
13. **[`docs/rules/epap-project-doc-agent-sop.md`](./docs/rules/epap-project-doc-agent-sop.md)**
    — project doc system SOP (every project connects via
    README/AGENTS/CHANGELOG/MILESTONE/TODO/PRD/TDD/MEMORY).
14. **[`docs/state/PRD.md`](./docs/state/PRD.md)** — current product
    positioning, A/B/C/D action grading, multi-surface split.
15. **[`docs/adr/0001-zitadel-gin-platform-core.md`](./docs/adr/0001-zitadel-gin-platform-core.md)**
    + [`0002-personal-os-project-queue.md`](./docs/adr/0002-personal-os-project-queue.md)
    — accepted ADRs; more listed in the ADR table below.
16. **[`docs/specs/2026-09-14-workspace-foundation-binding/`](./docs/specs/2026-09-14-workspace-foundation-binding/)**
    — current binding spec (foundation + workspace + workbench).
17. **[`docs/specs/2026-09-02-workbench-multi-surface-architecture/`](./docs/specs/2026-09-02-workbench-multi-surface-architecture/)**
    — multi-surface architecture (Web / Mobile / Desktop split).
18. **[`prompts/README.md`](./prompts/README.md)** + [`prompts/AGENTS.md`](./prompts/AGENTS.md)
    — prompt layering (system / global / projects) for agent behavior.

---

## Doc Index

| Path | Purpose | Owner | Update cadence |
|---|---|---|---|
| `AGENTS.md` | Root project boundary, Six-Layer SOP, House Rules, verification | owner | on rule change |
| `AGENTS.en.md` | English mirror of root AGENTS | owner | on multilingual sync |
| `INDEX.md` | This file — canonical doc map router | owner | when document map changes |
| `README.md` | English entrypoint, layout, commands, EPAP legacy status | owner | when scope changes |
| `README.zh-CN.md` | Chinese entrypoint, mirror of `README.md` | owner | when scope changes |
| `CLAUDE.md` | Claude-Code addenda (per adapter template) | owner | per Claude runtime delta |
| `ARCHITECTURE.md` | High-level architecture narrative | owner | when architecture intent changes |
| `SECURITY.md` | Root-level security note (workbench-internal) | owner + security | on policy change |
| `HANDOFF.md` | Root pointer: Commit Ledger state, recent ahead-batch | owner + control-plane | per commit-ledger delta |
| `CHANGE.md` | Top-level milestone log (AR-BOOTSTRAP-002 root pointer) | owner | per major milestone |
| `LICENSE` | Repository license | owner | frozen |
| `Makefile` | Docker + migration + backend compose orchestration | owner | per make-target change |
| `package.json` / `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.base.json` | Workspace, build, and TypeScript roots | owner | per workspace delta |
| `docker-compose.yml` / `docker-compose.backend.yml` | Local + containerized backend compose | owner | per service topology change |
| `eslint.config.mjs` | Root lint config | owner | per lint rule change |
| `workbench_changes.patch.README.md` | Guide to `archive/workbench_changes-*.patch` snapshots | owner | read-only |
| `archive/` | Read-only per-merge snapshots of historical change-patch streams | owner | read-only |
| `config/axi-ui-page-policy.json` | Static AXI UI page policy (non-runtime config) | owner | when policy changes |
| `scripts/` | Root verification / boundary / dev scripts (`check-*.mjs`, `verify-*.mjs`, `axi-ui-cli.mjs`, `dev-*.sh`) | owner | per script change |

### `docs/` (top-level files)

| Path | Purpose | Owner | Update cadence |
|---|---|---|---|
| `docs/00-product-overview.md` | Merged product doc (§1–§8 anchor supersedes 8 historical files) | owner | when product narrative changes |
| `docs/agent-swarm-kb-integration.md` | Knowledge-base / agent-swarm integration plan | owner + ai | when KB integration shifts |
| `docs/AGENTS.md` | Subtree-specific AGENTS scaffold (managed by `omx agents-init`) | owner | per OMX init run |
| `docs/HANDOFF.md` | Full handoff: entrypoints, commands, environment, contracts, troubleshooting, freshness, image-asset audit waves | owner + control-plane | per session / per Wave |
| `docs/README.md` | Legacy product-doc index (1–8 sections mapped to merged overview) | owner | frozen narrative |
| `docs/README.zh-CN.md` | Chinese mirror of `docs/README.md` | owner | frozen narrative |
| `docs/TESTING.md` | Top-level testing overview | owner + test-agent | per testing delta |
| `docs/VERIFICATION.md` | Top-level verification entry | owner + control-plane | per verify-target change |
| `docs/commit-ledger-architecture.md` | Commit-Ledger architecture decision | owner | frozen |
| `docs/commit-ledger-status.md` | Commit-Ledger task state and grading | owner | per CL delta |
| `docs/commit-ledger-verification.md` | Commit-Ledger acceptance matrix | owner | per CL delta |
| `docs/commit-ledger-final-report.md` | Commit-Ledger final acceptance report | owner | frozen |
| `docs/governance-registry-cleanup.patch` | Registry cleanup patch (historical) | owner | read-only |
| `docs/loading-dango-assets.md` | Loading dango asset note | owner | per asset delta |
| `docs/project-docs.manifest.json` | Machine-readable doc ownership manifest (`status: legacy`) | owner | regenerate from `INDEX.md` |
| `docs/wip-owner-pre-merge-2026-09-20-review-guide.md` | Pre-merge review guide (work-in-progress) | owner | when merge prep starts |

### `docs/adr/`

| ADR | Title | Status |
|---|---|---|
| [`0001-zitadel-gin-platform-core.md`](./docs/adr/0001-zitadel-gin-platform-core.md) | ZITADEL 中央身份、Gin 网关与模块化 Go 核心 | Accepted (2026-08-07) |
| [`0002-personal-os-project-queue.md`](./docs/adr/0002-personal-os-project-queue.md) | Personal OS v0.1 归属 Workbench 与项目队列优先 | Accepted (2026-09-01) |
| [`README.md`](./docs/adr/README.md) | ADR directory index | — |
| [`template.md`](./docs/adr/template.md) | ADR file template | — |

### `docs/api/`

API contract documents mirror `services/api-gateway/config/routes.yaml`.
Updates happen together with gateway route changes.

| Path | Surface |
|---|---|
| `docs/api/README.md` | API contract hub — protocol baseline, auth, response envelope, error model |
| `docs/api/auth.md` | Axi Identity OIDC + session + EPS mapping endpoints |
| `docs/api/control-plane.md` | Software-layer control API + `AgentTask` runtime surface |
| `docs/api/platform.md` | Tenant / RBAC / preferences / projects / outbox / RLS endpoints |
| `docs/api/workflow.md` | Workflow-engine orchestration + `task-execution-routing/v1` |
| `docs/api/notification.md` | Notification service + SMTP / delivery worker |
| `docs/api/file.md` | File-service + S3/MinIO + presigned URL endpoints |
| `docs/api/handoff.md` | Handoff correlation + lifecycle endpoints |
| `docs/api/personal-os.md` | Personal OS / Project Queue endpoints (PRD-01) |
| `docs/api/eps.md` | EPS external business-system integration endpoints |
| `docs/api/commit-ledger.md` | Commit-Ledger v1 endpoints + persistence |
| `docs/api/mobile.md` | Mobile role-execution endpoints (paired-device authorization) |
| `docs/api/observability.md` | Observability event ingest + outbox endpoints |

### `docs/architecture/`

| Path | Purpose |
|---|---|
| `docs/architecture/source-catalog.md` | Canonical physical source topology — app roles, root pnpm membership, Host registration, cleanup order (**required reading before any subtree edit**) |

### `docs/audit/`

| Path | Purpose |
|---|---|
| `docs/audit/2026-08-08-apps-app-search-system-ownership-decision.md` | App-Search ownership decision (kept in Workbench) |
| `docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` | Axi-Docs vs axiom-rules staleness audit |
| `docs/audit/20260913-web-legacy-consumer-validation.md` | Web legacy consumer validation (consumer cleanup evidence) |
| `docs/audit/redundancy-remediation-2026-08-06.md` | Redundancy remediation log |

### `docs/deployment/`

| Path | Purpose |
|---|---|
| `docs/deployment/REMOTE-WINDOWS-WORKBENCH-DEPLOYMENT-TODO.md` | Remote Windows deployment backlog |
| `docs/deployment/REMOTE-WINDOWS-WORKBENCH-EXECUTION-LOG.md` | Remote Windows deployment execution log |
| `docs/deployment/reverse-proxy/` | Reverse-proxy templates for Windows + Linux deploys |

### `docs/governance/`

| Path | Purpose |
|---|---|
| `docs/governance/SECURITY.md` | Project-internal security posture (workspace-wide policy lives in `foundation/workspace-governance/`) |

### `docs/logs/`

| Path | Purpose |
|---|---|
| `docs/logs/handoff/` | Handoff runtime logs |
| `docs/logs/submit/` | Submit log archive (audited via `pnpm audit:submit-logs`) |

### `docs/migrations/`

| Path | Purpose |
|---|---|
| `docs/migrations/axi-workstation-local-rename-20260525.md` | Historical `axi-workstation` → `axi-workbench` rename record |

### `docs/planning/`

| Path | Purpose |
|---|---|
| `docs/planning/PUB-01-public-ingress-planning.md` | Public ingress planning (PUB-01) |

### `docs/qa-screenshots/`

| Path | Purpose |
|---|---|
| `docs/qa-screenshots/` | Browser / mobile smoke + handoff detail + visual evidence (`latest` per Wave) |

### `docs/rules/`

| Path | Purpose |
|---|---|
| `docs/rules/README.md` | Rule layering (Rules / Playbooks / Facts / Memory / Soul / Heartbeat / Audit) |
| `docs/rules/epap-six-layer-sop.md` | Six-Layer Control Plane SOP (authoritative operating model) |
| `docs/rules/epap-project-doc-agent-sop.md` | Project doc-system SOP |
| `docs/rules/axi-workbench-boundary-sop.md` | Workbench aggregation boundary + reverse-coupling rules |
| `docs/rules/axi-ui-page-contract.md` | AXI UI page contract |
| `docs/rules/three-surface-style-architecture.md` | Three-surface style architecture |

### `docs/specs/`

| Spec dir | Anchor | Notes |
|---|---|---|
| `docs/specs/2026-08-09-multi-surface-admin-positioning/` | Multi-surface admin positioning | Capability inventory + ownership + design |
| `docs/specs/2026-08-11-web-session-trusted-device/` | Web session trusted-device design + phase-1 implementation plan | B-grade action scope |
| `docs/specs/2026-09-01-workbench-mac-packaging/` | Workbench Mac packaging (Tauri) | Desktop delivery design |
| `docs/specs/2026-09-02-workbench-multi-surface-architecture/` | Multi-surface architecture (Web / Mobile / Desktop) | Authoritative architecture for current split |
| `docs/specs/2026-09-14-workspace-foundation-binding/` | Workspace foundation binding | Owner inventory + TODO + worktree snapshot + workspace relation audit |
| `docs/specs/PUB-09-release-closure/` | Release closure plan (PUB-09) | — |

### `docs/state/`

| Path | Purpose | Owner |
|---|---|---|
| `docs/state/CAPABILITY-OWNERSHIP.md` | Web/Mobile capability ledger (A/B/C/D action grading) | owner |
| `docs/state/CHANGELOG.md` | Canonical Keep-a-Changelog history | owner |
| `docs/state/HANDOFF-PROTOCOL.md` | Cross-surface handoff correlation ID + state machine | owner |
| `docs/state/MILESTONE.md` | Milestone tracker | owner |
| `docs/state/PRD.md` | Current product positioning + action grading + multi-surface split | owner |
| `docs/state/TDD.md` | Technical design doc (TDD) | owner |
| `docs/state/TODO.md` | Active TODO list | owner |
| `docs/state/VERIFICATION.md` | Verification entrypoint | owner |

### `docs/templates/project-docs/`

| Path | Purpose |
|---|---|
| `docs/templates/project-docs/AGENTS.md` / `README.md` / `CHANGELOG.md` / `MILESTONE.md` / `TODO.md` | Per-project doc templates (used by `epap-project-doc-agent-sop.md`) |
| `docs/templates/project-docs/docs/` | Nested template directory |

### `docs/testing/`

| Path | Purpose |
|---|---|
| `docs/testing/frontend-test-contract.json` | Frontend test contract schema |

### `docs/workflows/`

| Path | Purpose |
|---|---|
| `docs/workflows/README.md` | Workbench workflow hub + cross-project workflow index |
| `docs/workflows/axi-workbench.md` | WB-AUTH-001 / WB-DESKTOP-001 / WB-SMTP-001 contract |

---

## Subdirectory Layout

```
workbench/axi-workbench/
├── AGENTS.md / AGENTS.en.md / INDEX.md / README.md / README.zh-CN.md
├── CLAUDE.md / ARCHITECTURE.md / SECURITY.md / LICENSE
├── HANDOFF.md / CHANGE.md
├── Makefile / package.json / pnpm-workspace.yaml / turbo.json / tsconfig.base.json
├── docker-compose.yml / docker-compose.backend.yml / eslint.config.mjs
├── workbench_changes.patch.README.md
├── config/                              # Static config (axi-ui-page-policy.json)
├── scripts/                             # check-*.mjs / verify-*.mjs / axi-ui-cli.mjs / dev-*.sh
├── archive/                             # Read-only change-patch snapshots
│   └── workbench_changes-2026-09-26.patch
├── apps/                                # Mixed source root (12 apps + AGENTS.md)
│   ├── AGENTS.md                        # User-side apps: only 2 user portals (Web + Mobile)
│   ├── workbench/                       # ★ Web admin control center (@axi/workbench)
│   ├── workbench-mobile/                # ★ Mobile role-execution client (@axi/workbench-mobile, Capacitor + Android)
│   ├── workbench-desktop/               # Tauri 2 desktop client
│   ├── workbench-shared/                # Cross-surface shared app shell
│   ├── devsvc-dashboard/                # Local service Host + dashboard ops shell
│   ├── axi-coder/                       # Hosted coding tool (Tauri + Rust shell)
│   ├── axi-docs/                        # Documentation hub + MCP server
│   ├── axi-artboard/                    # Agent node-picker canvas
│   ├── resource-orchestration/          # Resource orchestration gateway UI
│   ├── verification-inbox/              # OTP / IMAP inbox tool
│   ├── app-search-system/               # Embedded multi-runtime Docs/Search tool (NOT root pnpm member)
│   └── ollama-menu-assistant/           # macOS Swift menu assistant (NOT root pnpm member)
├── services/                            # Production + control + gateway + runtime services
│   ├── AGENTS.md
│   ├── api-gateway/                     # Go/Gin — only business API entrypoint
│   ├── identity-adapter/                # Go/Gin — ZITADEL OIDC + QR + EPS
│   ├── platform-core/                   # Go/Gin — tenant/RBAC/RLS/outbox
│   ├── control-plane/                   # Software-layer control API + AgentTask
│   ├── communication-gateway/           # Communication-layer envelope routing
│   ├── workflow-engine/                 # Durable workflow executor + agent runtime
│   ├── notification-service/            # Notification service + SMTP + delivery worker
│   ├── file-service/                    # File service + S3/MinIO + presigned URLs
│   ├── resource-gateway/                # Resource orchestration backend
│   ├── agent-runtime/                   # Agent runtime service
│   ├── auth-service/                    # Legacy prototype — migration compat only
│   └── core-service/                    # Spring/H2 legacy — migration compat only
├── packages/                            # Shared packages (api-client / schemas / contracts / etc.)
│   ├── AGENTS.md
│   ├── api-client/
│   ├── schemas/                         # Canonical IMEnvelope / AgentTask / contracts
│   ├── types/
│   ├── ui/                              # Legacy layout (only used during Web transition)
│   ├── utils/
│   ├── workbench-foundation/            # Web + Mobile shared auth-session + locale
│   ├── epap-schemas-compat/             # @epap/schemas migration-compat (legacy)
│   ├── commit-ledger-schema/            # Commit-Ledger v1 JSON schema
│   ├── gateway-contracts/
│   ├── resource-adapters/
│   ├── resource-api-docs/
│   ├── resource-config/
│   ├── resource-memory/
│   ├── resource-orchestrator/
│   ├── resource-session/
│   ├── artboard-vite-plugin/            # AST source-stamp Vite plugin
│   └── axi-rag/                         # Source-only directory (no manifest yet)
├── ai/                                  # Agent Platform + knowledge base integration
│   ├── AGENTS.md
│   ├── agent-platform/
│   └── knowledge-base/
├── prompts/                             # Prompt layering (system / global / projects)
│   ├── AGENTS.md / README.md / prompt-layer.manifest.json
│   ├── system/
│   ├── global/
│   └── projects/
├── backend/                             # Embedded Python runtime (NOT root pnpm member)
│   ├── AGENTS.md / pyproject.toml / uv.lock
│   ├── mini_agent/
│   └── local_server/
├── infra/                               # Fleet Console + Helm
│   ├── AGENTS.md
│   ├── fleet-console/                   # Physical-service console + Python fleetctl
│   └── helm/                            # axi-workbench-platform deployment unit
├── tools/
│   ├── AGENTS.md
│   └── axi-app-cli/                     # Scaffolding CLI (independent nested monorepo)
└── docs/                                # Documentation hub (see Doc Index above)
```

### Root pnpm membership (as of 2026-10)

| Group | Members |
|---|---|
| `apps/*` (root members) | `axi-coder`, `devsvc-dashboard`, `verification-inbox`, `workbench`, `workbench-mobile` |
| `apps/*` (NOT root members) | `app-search-system`, `ollama-menu-assistant`, `workbench-desktop`, `workbench-shared`, `axi-artboard`, `axi-docs`, `resource-orchestration` |
| `packages/*` | `api-client`, `artboard-vite-plugin`, `commit-ledger-schema`, `epap-schemas-compat`, `gateway-contracts`, `resource-adapters`, `resource-api-docs`, `resource-config`, `resource-memory`, `resource-orchestrator`, `resource-session`, `schemas`, `types`, `ui`, `utils`, `workbench-foundation` |
| `services/*` | `agent-runtime`, `api-gateway`, `auth-service`, `communication-gateway`, `control-plane`, `core-service`, `file-service`, `identity-adapter`, `notification-service`, `platform-core`, `resource-gateway`, `workflow-engine` |
| `ai/*` | `agent-platform`, `knowledge-base` |
| `tools/*` | `axi-app-cli` (top-level wrapper; nested monorepo inside) |
| `infra/*` | `fleet-console` (partial), `helm` |
| NOT root members | `apps/app-search-system`, `apps/ollama-menu-assistant`, `backend/`, `infra/fleet-console/dashboard/` (front-end), `packages/axi-rag/` |

---

## Absorbed Apps (2026-09-20 baseline merge + later)

Each row is the canonical absorbed-app entry: role + what it owns + what
to read first.

| App | Role | First read |
|---|---|---|
| `apps/workbench` | **Web admin control center** (the single Web management portal); C-grade management + governance + chrome + tabs + breadcrumbs + settings | `apps/workbench/src/main.tsx`; `apps/AGENTS.md` |
| `apps/workbench-mobile` | **Mobile role-execution auxiliary** (Web + native Android via Capacitor/Gradle); A/B-grade single-object actions; paired-device authorization | `apps/workbench-mobile/src/main.tsx`; `apps/AGENTS.md` |
| `apps/workbench-desktop` | Tauri 2 desktop client; standalone delivery of Workbench shell | `apps/workbench-desktop/` (own AGENTS) |
| `apps/workbench-shared` | Cross-surface shared app shell helpers | — |
| `apps/devsvc-dashboard` | Local-service **Host** + ops dashboard shell; registers + launches hosted apps via `config/axi-apps.json` | `apps/devsvc-dashboard/src/main.tsx` |
| `apps/axi-coder` | Hosted **coding tool**; Tauri/Rust shell + its own pages; mounted by DevSvc Dashboard | `apps/axi-coder/src/main.tsx` |
| `apps/axi-docs` | **Documentation hub + MCP server**; canonical rule router integration; provides `docs-hub` | `apps/axi-docs/` (own AGENTS); canonical: [`../../foundation/axi-rules/INDEX.md`](../../foundation/axi-rules/INDEX.md) |
| `apps/axi-artboard` | **Agent node-picker canvas** + AST source-stamp Vite plugin | `apps/axi-artboard/` |
| `apps/resource-orchestration` | Resource orchestration gateway **UI**; consumes `services/resource-gateway/` | `apps/resource-orchestration/` |
| `apps/verification-inbox` | OTP / IMAP inbox tool; vertical (NOT a portal) | `apps/verification-inbox/` |
| `apps/app-search-system` | Embedded multi-runtime Docs/Search tool (React + Electron + Python); lifecycle NOT yet in root pnpm | `apps/app-search-system/` |
| `apps/ollama-menu-assistant` | macOS Swift menu bar assistant; Swift Package (NOT Node) | `apps/ollama-menu-assistant/Sources/` |
| `services/api-gateway` | Go/Gin — only **business API entrypoint**; ZITADEL JWKS, HttpOnly session, Redis rate-limit, no-body audit | `services/api-gateway/cmd/gateway/main.go` |
| `services/identity-adapter` | Go/Gin — Axi Identity OIDC adapter + QR transaction + EPS mapping | `services/identity-adapter/cmd/identity-adapter/main.go` |
| `services/platform-core` | Go/Gin — tenant / RBAC / preferences / dictionary / projects / outbox + PostgreSQL RLS | `services/platform-core/cmd/platform-core/main.go` |
| `services/control-plane` | **Software-layer control API** + managed `AgentTask` runtime + commit ledger + Personal OS | `services/control-plane/src/server.mjs` |
| `services/communication-gateway` | Communication-layer envelope routing + control-plane forwarding | `services/communication-gateway/src/server.mjs` |
| `services/workflow-engine` | Durable workflow executor + `task-execution-routing/v1` agent runtime | `services/workflow-engine/services/agent_runtime.py` |
| `services/notification-service` | Notification + SMTP delivery worker + recovery | `services/notification-service/` |
| `services/file-service` | File + S3/MinIO + presigned URL + PostgreSQL metadata | `services/file-service/` |
| `services/resource-gateway` | Resource orchestration backend | `services/resource-gateway/` |
| `services/agent-runtime` | Agent runtime service | `services/agent-runtime/` |
| `services/auth-service` | Legacy prototype — migration compat only (NOT production identity) | — |
| `services/core-service` | Spring/H2 — read-only migration compat only | — |
| `infra/fleet-console` | Physical-service **console** + Python `fleetctl` CLI + dashboard | `infra/fleet-console/scripts/fleetctl.py` |
| `infra/helm` | Helm chart (`axi-workbench-platform`); deploy unit | `infra/helm/README.md` |
| `tools/axi-app-cli` | Scaffolding CLI; nested monorepo | `tools/axi-app-cli/AGENTS.md` + `tools/axi-app-cli/README.md` |
| `backend/` | Embedded Python runtime (mini_agent + local_server); NOT root pnpm member | `backend/AGENTS.md` |
| `ai/agent-platform` / `ai/knowledge-base` | Agent Platform + KB integration layer | `ai/AGENTS.md` |
| `prompts/` | Prompt layering (system / global / projects); loaded at agent startup | `prompts/AGENTS.md` + `prompts/README.md` |

---

## How to Update

1. **Edit boundary check first.** Read `AGENTS.md` §Project Boundary,
   then the target subtree `AGENTS.md`, then
   `docs/architecture/source-catalog.md` before touching `apps/`,
   `services/`, `packages/`, `tools/`, `ai/`, `prompts/`, or `backend/`.
2. **Top-level doc change.** Update this `INDEX.md` and
   `docs/project-docs.manifest.json` together (machine-readable and
   human-readable doc maps must stay aligned). Append a row to
   `docs/state/CHANGELOG.md` if the change is user-visible; otherwise
   update `CHANGE.md` only.
3. **New ADR.** File under `docs/adr/000N-*.md` (use `template.md`),
   update the ADR table above, and reference it from `AGENTS.md` §Authoritative Sources when it changes a binding decision.
4. **Six-Layer rule change.** Update `docs/rules/epap-six-layer-sop.md`
   first, then add a row to `docs/state/CHANGELOG.md` and re-validate
   with the narrowest meaningful verification set (see `AGENTS.md`
   §Verification).
5. **Doc-only changes are commit-eligible on their own.** Do not bundle
   doc changes with renderer / service / contract changes; this keeps
   evidence and reversibility simple.
6. **Branch discipline.** Ordinary local work stays on `dev` or
   `agent/<task>` branches; do not merge to `main` or rewrite remote
   history without explicit owner request (per workspace `AGENTS.md` Solo
   Owner Governance).
7. **Verification gate.** From the project root:
   ```bash
   # workspace graph + handoff registry
   node /Volumes/code/workspace/scripts/workspace-project validate
   # monorepo CI
   pnpm verify:ci
   # default types / tests / workstation contracts
   pnpm type-check
   pnpm test
   pnpm test:workstation
   # targeted apps
   pnpm --dir apps/devsvc-dashboard typecheck
   pnpm --dir apps/axi-coder typecheck
   npm --prefix apps/verification-inbox run typecheck
   # physical service layer
   python3 infra/fleet-console/scripts/fleetctl.py validate
   ```
   Change-driven minimum: pick the narrowest subset matching your diff
   surface (see `AGENTS.md` §Verification for the per-change matrix).
8. **Image asset policy.** Wave A–G is on dev; future image commits
   > 500KB require a derived `.webp` sibling and the gate is `pnpm
   assets:lint`. Original PNG is not deleted by automation. See
   `docs/HANDOFF.md` §"Image Asset Audit" for current state.
9. **Cross-project contract change.** Before touching any package or
   service whose export is consumed elsewhere in the workspace, run
   `workspace-project consumers axi-workbench` and re-verify each
   consumer's minimal verification set.
10. **Update this INDEX** whenever a new top-level doc, ADR, absorbed
    app, or subtree AGENTS is added or its owner changes.

---

## References

- Workspace entry: [`/Volumes/code/workspace/AGENTS.md`](../../AGENTS.md),
  [`/Volumes/code/workspace/WORKSPACE_INDEX.md`](../../WORKSPACE_INDEX.md).
- Workspace rule router (canonical): [`/Volumes/code/workspace/foundation/axi-rules/INDEX.md`](../../foundation/axi-rules/INDEX.md)
  — governance, project-bootstrap, prd-format, contract-format, lifecycle
  modules.
- Workspace ADR index: [`/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`](../../foundation/workspace-governance/docs/adr/)
  (workspace-level ADRs only; project-local ADRs live under `docs/adr/`).
- Workspace graph: [`/Volumes/code/workspace/workspace.graph.json`](../../workspace.graph.json)
  (provider/consumer graph; one row per absorbed capability; run
  `scripts/workspace-project show axi-workbench` for the canonical
  in-band view).
- Sibling convention: [`/Volumes/code/workspace/foundation/axi-observability/INDEX.md`](../../foundation/axi-observability/INDEX.md),
  [`/Volumes/code/workspace/candidates/pelagic/INDEX.md`](../../candidates/pelagic/INDEX.md),
  [`/Volumes/code/workspace/products/ielts-vocab/INDEX.md`](../../products/ielts-vocab/INDEX.md).
- Workspace PRD center:
  [`/Volumes/code/workspace/docs/prd/README.md`](../../docs/prd/README.md)
  — single entry point for PRD-01..07 + per-project PRDs and the
  L0/L2 PRD hierarchy.
- Render-host boundary (PRD-10.2):
  [`/Volumes/code/workspace/foundation/workspace-governance/docs/specs/2026-09-24-workspace-entrance-spatial-graph/REMEDIATION-PLAN.md`](../../foundation/workspace-governance/docs/specs/2026-09-24-workspace-entrance-spatial-graph/REMEDIATION-PLAN.md).

---

## Lore Trail / Provenance

- 2026-10-17 — P3 docs audit gap (batch 9): root `INDEX.md` strengthened
  from a 28-line pointer to a full doc-map router covering ~50 doc
  files, ~30 absorbed apps/services, the six subtree `AGENTS.md`
  boundaries, and the Six-Layer operating model.
- Source-of-truth docs read: `AGENTS.md`, `AGENTS.en.md`, `README.md`,
  `README.zh-CN.md`, `HANDOFF.md`, `CHANGE.md`, `CLAUDE.md`,
  `docs/HANDOFF.md`, `docs/README.md`, `docs/AGENTS.md`,
  `docs/00-product-overview.md`, `docs/architecture/source-catalog.md`,
  `docs/rules/epap-six-layer-sop.md`, `docs/rules/README.md`,
  `docs/workflows/README.md`, `docs/api/README.md`,
  `docs/state/CAPABILITY-OWNERSHIP.md` (head), `docs/state/HANDOFF-PROTOCOL.md`
  (head), `docs/adr/0001-zitadel-gin-platform-core.md`,
  `docs/adr/0002-personal-os-project-queue.md`, `docs/governance/SECURITY.md`,
  `apps/AGENTS.md`.
- Reference INDEX files used for shape: `candidates/pelagic/INDEX.md`,
  `foundation/axi-observability/INDEX.md`.