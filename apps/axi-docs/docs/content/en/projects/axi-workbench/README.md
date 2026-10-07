---
id: axi-docs-en-projects-axi-workbench
title: Axi Workbench
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench
graph-tags: [Projects, workbench]
tags: [Axi Docs, Projects, workbench, monorepo, control-plane]
description: Canonical AxiomaticWorld workbench monorepo that owns the six-layer control plane, web/mobile/desktop user apps, the DevSvc host, Axi Coder, Axi Docs, Verification Inbox, Fleet Console, the Ollama menu assistant, and the Axi App CLI scaffolder.
project:
  id: axi-workbench
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench
  source-section: core
---

# Axi Workbench

> Mirror of the project root `README.md` + `AGENTS.md` + `docs/HANDOFF.md`. Source of truth:
> [`/Volumes/code/workspace/workbench/axi-workbench/README.md`](/Volumes/code/workspace/workbench/axi-workbench/README.md),
> [`/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md),
> [`/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md).
> Section: core / Partition: `workbench/`.

## Summary

`Axi Workbench` is the canonical monorepo for the AxiomaticWorld（公理世界）product line. It
owns the **six-layer control plane**（IM / Communication / Software / Base Service / Physical
Service / External Capability） that the rest of the workspace depends on, and ships the two
real user surfaces (`apps/workbench` web admin at `:5173` and `apps/workbench-mobile` mobile
shell at `:5174`) plus the desktop variant (`apps/workbench-desktop` Tauri 2). The monorepo
also hosts the **DevSvc Dashboard host**（`apps/devsvc-dashboard`）、Axi Coder（`apps/axi-coder`）、
Axi Docs（`apps/axi-docs`）、Verification Inbox（`apps/verification-inbox`）、App Search
（`apps/app-search-system`）、Ollama Menu Assistant（`apps/ollama-menu-assistant`）、Resource
Orchestration（`apps/resource-orchestration`）、Axi ArtBoard（`apps/axi-artboard`）and the
scaffolding CLI（`tools/axi-app-cli/`）. The back end is split across `services/`（`api-gateway`
Go/Gin single HTTP entrypoint at host port `18088`, plus `identity-adapter`, `platform-core`,
`workflow-engine`, `notification-service`, `file-service`, `auth-service`, `core-service`,
`communication-gateway`, `control-plane`, `resource-gateway`, `agent-runtime`）and
`backend/`（embedded Python `mini_agent` + `local_server` runtime）.

The repository is the **Workspace Entrance Spatial Graph render host**, not the fact owner:
per AGENTS.md §"Workspace Entry Render Host Boundary" (added 2026-09-24), fact source and
data plane live in `infra/axi-workspace-governance/`（`workspace.json`, `workspace.graph.json`,
catalog, handoff, completion, audit）and `axi-kernel`（object registry v6 schema）; this
repo only consumes them through peerDependencies and the `axi-workbench-cli` data-plane
contract. Per `services/AGENTS.md`, the two business planes are: **business API plane**
（host port 18088 → six internal containers）and **workstation control plane**
（`control-plane:8092`, `communication-gateway:8093` — bypasses `api-gateway` on purpose）.
`auth-service` and Spring/H2 `core-service` are migration-compatibility sources, not
production identity / business data owners.

**Stage**: live monorepo（distributed across `apps/` `services/` `packages/` `tools/` `ai/`
`prompts/` `backend/` `infra/` `docs/`）.
**Canonical path**: `/Volumes/code/workspace/workbench/axi-workbench`.
**Branch**: `dev` ahead of `origin/dev` by 16 commits as of 2026-09-24（HANDOFF.md）; working
branch at audit time was `feature/axi-docs-token-convergence` with token-baseline adoption in
progress.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Root build | Turborepo `^2.0.0` + pnpm `9.6.0` workspaces, `node>=18` | `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` |
| Web admin (`apps/workbench`) | React 18 + TypeScript + Vite, `@axi/workbench` | `pnpm dev:workbench` → `:5173`; pages: CommandCenter, Projects, ProjectDetail, Legal, Login, Register, AuthCallback, Home, plus `admin/`, `commit-ledger/`, `personal-os/`, `workspaceRegistry` |
| Mobile (`apps/workbench-mobile`) | Vite + Web; native Android `android/` subproject; Capacitor | `pnpm dev:mobile` → `:5174`; WeChat-style header, four bottom-nav items (Home / Projects / Workspace / Me); `playwright.config.ts` + `e2e/` + `vitest.config.ts` |
| Desktop (`apps/workbench-desktop`) | Tauri 2 (Rust shell + webview); `@axi/workbench-desktop` | `pnpm dev:desktop`; build flavours `build:desktop`, `build:desktop:dmg`, `build:desktop:local[:dmg]`, `build:desktop:remote[:dmg]`; `src-tauri/` |
| DevSvc Dashboard host (`apps/devsvc-dashboard`) | React + Vite, `@axi/devsvc-dashboard` | Local service host; mounts sub-apps via `apps/devsvc-dashboard/config/axi-apps.json` |
| Axi Coder (`apps/axi-coder`) | React + Vite + Tauri shell; `@axi/coder` | Hosted sub-app; `sign-dev.sh`; `pty_test`, `test_ipc` |
| Axi Docs (`apps/axi-docs`) | React + Vite + TypeScript, `@axi/docs` | Documentation hub + MCP; subsumes legacy `projects/axi-docs/` per 2026-09-24 ADR-008 |
| Verification Inbox (`apps/verification-inbox`) | React + Vite, `@axi/verification-inbox` | OTP / IMAP inbox |
| Axi ArtBoard (`apps/axi-artboard`) | React + Vite, `@axi/artboard` | Agent node-picker overlay; uses `packages/artboard-vite-plugin` |
| Ollama Menu Assistant (`apps/ollama-menu-assistant`) | macOS Swift (SwiftPM) | `Package.swift`; menu-bar; not a Node package |
| App Search (`apps/app-search-system`) | React + Vite; embedded multi-runtime docs/search | Not currently a root pnpm member |
| Resource Orchestration (`apps/resource-orchestration`) | React + Vite, `@axi/resource-orchestration` | Resource gateway UI |
| Workbench-shared (`apps/workbench-shared`) | Shared between web + mobile | Auth + language state |
| API gateway (`services/api-gateway`) | Go 1.x + Gin, CGO-disabled in main build | Single business HTTP entrypoint; routes declared in `services/api-gateway/config/routes.yaml`; modules: `circuitbreaker`, `cmd/gateway`, `discovery`, `gateway`, `handlers`, `identity`, `middleware`, `observability`, `ratelimit`; Rust migration scaffold in `src-rs/` (ADR-017); stage 2 governor adds rate-limit + circuit breaker + JWKS auth + Prometheus `/metrics` |
| Identity adapter (`services/identity-adapter`) | Go + Gin, port 8081 | ZITADEL JWKS, short-lived QR transactions in Redis, long-lived mapping in PostgreSQL |
| Platform core (`services/platform-core`) | Go + Gin, port 8082 | Modular tenant core: members/RBAC, profile, commit-ledger, dict, outbox, PostgreSQL RLS |
| Workflow engine (`services/workflow-engine`) | Python, port 8083 | Durable workflow executor, Kafka consumer |
| Notification service (`services/notification-service`) | Go + SMTP, port 8084 | Recoverable delivery worker, mailpit for dev |
| File service (`services/file-service`) | Python, port 8085 | Production S3/MinIO + PostgreSQL metadata + short-lived presigned URLs |
| Auth service (`services/auth-service`) | legacy | Migration compatibility only — not production identity |
| Core service (`services/core-service`) | Spring/H2 | Read-only migration compatibility |
| Control plane (`services/control-plane`) | Node 20 (`mjs` + `.ts` mix), port 8092 | Software layer: commit-ledger, EPS scanner/probe/persistence, pairing, idempotency, observability-events, personal-os; Rust migration split per ADR-018 (`src-rs/` modules `control-plane-server-rs`, `control-plane-view-registry-rs`, `control-plane-resource-policy-rs`, `control-plane-outbox-rs`, `control-plane-event-store-rs`) |
| Communication gateway (`services/communication-gateway`) | Node/TypeScript, port 8093 | IM envelope routing; bypasses `api-gateway` |
| Resource gateway (`services/resource-gateway`) | Backend to `apps/resource-orchestration` | Resource orchestration backend |
| Agent runtime (`services/agent-runtime`) | Agent runtime services | (per AGENTS.md services table) |
| Shared packages | `@axi/api-client`, `@axi/schemas`, `@axi/types`, `@axi/ui` (legacy layout), `@axi/utils`, `@axi/workbench-foundation` (web/mobile shared auth + language state), `epap-schemas-compat` (legacy alias), `commit-ledger-schema`, `gateway-contracts`, `artboard-vite-plugin`, `axi-rag`, `resource-adapters`, `resource-api-docs`, `resource-config`, `resource-memory`, `resource-orchestrator`, `resource-session` |  |
| Backend Python (`backend/`) | Python `mini_agent` + `local_server` | Embedded runtime; not a root pnpm member |
| Infra (`infra/`) | `fleet-console/` Python scripts + Helm chart (`infra/helm/`) | Helm chart `axi-workbench-platform` |
| AI integration (`ai/`) | Knowledge base + Agent Platform integration layer | `ai/AGENTS.md` authoritative |
| Prompts (`prompts/`) | Prompt layer底座: `system/*.mdc` (immutable) / `global/*.mdc` / `projects/*.mdc` | `prompts/AGENTS.md` + `prompts/README.md` + `prompts/prompt-layer.manifest.json` |
| Tooling | ESLint `^9`, `@commitlint/{cli,config-conventional}`, `typescript ^5.3.3`, security overrides in `pnpm.overrides` | `eslint.config.mjs`, `.commitlintrc*` |

## Project Layout

```text
axi-workbench/
├── apps/
│   ├── workbench/                    # @axi/workbench — Web admin (Vite + React 18)
│   │   └── src/{App.tsx, layouts/, pages/, components/, contexts/, hooks/, i18n/, lib/, styles/, types/, __tests__/}
│   │       └── pages/                # CommandCenter, Projects, ProjectDetail, Home, LegalDocument, Login, Register, AuthCallback
│   │                                 #   admin/, commit-ledger/, personal-os/, workspaceRegistry.ts/.test.ts
│   ├── workbench-mobile/             # @axi/workbench-mobile — Mobile shell (Vite + native android/, Capacitor)
│   │   └── src/ + android/ + e2e/ + scripts/ + playwright.config.ts + vitest.config.ts
│   ├── workbench-desktop/            # @axi/workbench-desktop — Tauri 2 desktop
│   │   └── src/ + src-tauri/ + scripts/
│   ├── workbench-shared/             # Shared between web + mobile (auth + language)
│   ├── devsvc-dashboard/             # @axi/devsvc-dashboard — Local host (NOT a second user portal)
│   ├── axi-coder/                    # @axi/coder — Hosted coding tool (Tauri shell)
│   ├── axi-docs/                     # @axi/docs — Documentation hub + MCP (subsumed 2026-09-24 ADR-008)
│   ├── axi-artboard/                 # @axi/artboard — Agent node-picker overlay
│   ├── verification-inbox/           # @axi/verification-inbox — OTP / IMAP
│   ├── app-search-system/            # Multi-runtime docs/search (not root pnpm member)
│   ├── ollama-menu-assistant/        # macOS Swift Package (not Node)
│   └── resource-orchestration/       # @axi/resource-orchestration — Resource gateway UI
├── packages/
│   ├── api-client/                   # @axi/api-client
│   ├── axi-rag/                      # RAG source (not yet in root pnpm lifecycle)
│   ├── schemas/                      # @axi/schemas
│   ├── epap-schemas-compat/          # @epap/schemas migration-compat shim (LEGACY)
│   ├── types/                        # @axi/types
│   ├── ui/                           # @axi/ui (legacy layout, workbench transition only)
│   ├── workbench-foundation/         # @axi/workbench-foundation — web/mobile shared auth + language
│   ├── utils/                        # @axi/utils
│   ├── artboard-vite-plugin/         # AST source-stamp Vite plugin for axi-artboard
│   ├── commit-ledger-schema/         # packages/commit-ledger-schema/schema.json
│   ├── gateway-contracts/            # API contract types
│   ├── resource-{adapters,api-docs,config,memory,orchestrator,session}/
│   └── (utility packages)
├── services/
│   ├── api-gateway/                  # Go/Gin host:18088 — single business HTTP entrypoint
│   │   └── {circuitbreaker, cmd/gateway, config/routes.yaml, discovery, gateway, handlers, identity, middleware, observability, ratelimit, src-rs/}
│   ├── identity-adapter/             # Go/Gin :8081 — ZITADEL/QR/Redis/PG
│   ├── platform-core/                # Go/Gin :8082 — tenant core + commit-ledger + outbox + PG RLS
│   ├── workflow-engine/              # Python :8083 — durable workflow + Kafka
│   ├── notification-service/         # Go :8084 — SMTP + delivery worker
│   ├── file-service/                 # Python :8085 — S3/MinIO + PG metadata + presigned URLs
│   ├── auth-service/                 # LEGACY migration-compat
│   ├── core-service/                 # LEGACY Spring/H2 migration-compat
│   ├── communication-gateway/        # :8093 — IM envelope routing (bypasses api-gateway)
│   ├── control-plane/                # :8092 — Software layer: commit-ledger, EPS, pairing, idempotency
│   │   └── src/{commit-ledger, eps, server.mjs, control-plane.mjs, pairing.mjs, idempotency.mjs, observability-events.mjs, personal-os.mjs, smoke.mjs}
│   │   └── src/commit-ledger/{collect-all,evidence-linker,ingestion,persistence,api-routes,api-handlers,scheduler,fs-watcher,repos-loader,collector}.{mjs,ts}
│   │   └── src-rs/                   # Rust split: server-rs, view-registry-rs, resource-policy-rs, outbox-rs, event-store-rs
│   ├── resource-gateway/             # Backend to apps/resource-orchestration
│   └── agent-runtime/                # Agent runtime services
├── backend/                          # Embedded Python runtime: mini_agent + local_server
├── ai/                               # Knowledge base + Agent Platform integration layer (ai/AGENTS.md)
├── prompts/                          # system/ global/ projects/ prompt layers + prompt-layer.manifest.json
├── infra/
│   ├── fleet-console/                # Python scripts for physical service console
│   └── helm/                         # Helm chart (axi-workbench-platform deployment unit)
├── tools/
│   └── axi-app-cli/                  # Independent nested monorepo scaffolder
├── docs/                             # 01-overview.md ~ 08-todo.md + rules/ + templates/ + project-docs.manifest.json
│   └── architecture/source-catalog.md
│   └── rules/epap-six-layer-sop.md
│   └── rules/axi-workbench-boundary-sop.md
│   └── rules/epap-project-doc-agent-sop.md
│   └── state/{PRD.md, CHANGELOG.md, TODO.md, MILESTONE.md, TDD.md}
│   └── adr/0001-zitadel-gin-platform-core.md (and ADR-017 Rust migration, ADR-018 control-plane split)
├── config/                           # Static configs (axi-ui-page-policy.json)
├── scripts/                          # Root-level verification/check/tools (check-*.mjs, verify-*.mjs, axi-ui-cli.mjs, dev-*.sh)
├── docker-compose.yml
├── docker-compose.backend.yml
├── package.json                      # Workspace root (turbo.json, pnpm-workspace.yaml)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Build & Install

```bash
# Install all workspaces
pnpm install

# Web admin
pnpm dev:workbench           # → http://127.0.0.1:5173
pnpm build:workbench

# Mobile shell
pnpm dev:mobile              # → http://127.0.0.1:5174
pnpm type-check:mobile
pnpm test:mobile

# Desktop (Tauri 2)
pnpm dev:desktop
pnpm build:desktop            # verify:contracts + build
pnpm build:desktop:local      # local flavour
pnpm build:desktop:dmg        # DMG packaging

# DevSvc host + Axi Coder
pnpm dev:dashboard
pnpm dev:coder

# Full library builds / tests
pnpm build
pnpm type-check
pnpm test
pnpm test:workstation         # control-plane + communication-gateway + contracts
pnpm verify:ci                # drives CI contract verification

# Backend local stack (containers, gateway at 18088; Control Plane from host process)
make docker-up
make migrate-identity
make migrate-platform
make dev-backend              # identity + platform + workflow + notification + file + gateway + control-plane
make docker-backend           # containerised production form, host port 18088
make verify-docker-backend
make docker-backend-down

# Targeted checks
pnpm check:boundaries         # cross-package boundary enforcement
pnpm check:styles             # CSS architecture
pnpm check:capabilities       # capability inventory
pnpm check:dossier            # dossier drift
pnpm check:contracts          # contract validation
pnpm check:axi-ui             # adoption checks
pnpm check:ui                 # UI import boundaries
pnpm check:deps               # dependency policy
pnpm check:all                # contracts + dossier + capabilities + boundaries + styles

# Workspace governance
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project handoff-check axi-workbench
python3 infra/fleet-console/scripts/fleetctl.py validate
```

## Verification

Per `AGENTS.md` "Verification" + `services/AGENTS.md` + `apps/AGENTS.md`:

```bash
# Cross-project contracts + graph integrity
/Volumes/code/workspace/scripts/workspace-project validate

# Whole-repo CI verification (includes distributions)
pnpm verify:ci

# Whole-repo type-check
pnpm type-check

# Whole-repo tests
pnpm test

# Control-plane contract tests
pnpm test:workstation

# Per-surface type-check
pnpm --dir apps/devsvc-dashboard typecheck
pnpm --dir apps/axi-coder typecheck
npm --prefix apps/verification-inbox run typecheck
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile verify:contracts

# Fleet Console
python3 infra/fleet-console/scripts/fleetctl.py validate
```

Change-driven最小验证选择（AGENTS.md）:
- 改 `apps/<x>/**` → 跑 `apps/<x>` 的最小验证（typecheck / test），再视改动范围跑 `pnpm test:workstation`
- 改 `services/<x>/**` → 跑对应服务的 `go test` / `mvn test` / `pytest` 入口
- 改 `packages/<x>/**`（尤其 `epap-schemas-compat`）→ 跑 `pnpm type-check` + 至少一个下游 app 的 `typecheck`
- 改 `tools/axi-app-cli/**` → 跑 `pnpm --dir tools/axi-app-cli boundaries:check` + `capabilities:check`
- 改 `prompts/**` → 跑 `prompts/AGENTS.md` 与 `prompts/README.md` 所列分层校验
- 改 `docs/rules/*` 或根 `AGENTS.md` → 不需构建
- 跨项目共享契约 → 跑 `workspace-project consumers axi-workbench` 列出的所有消费者的最小验证

## Architecture Highlights

**Six-Layer Control Plane is the operating model.** Per `AGENTS.md` "规范运行模型（六层控制面）"
+ `docs/rules/epap-six-layer-sop.md`, every IM, communication, project management,
AgentTask, memory, docs, and base capability must be classified into one of six layers:
(1) IM Layer — user input/output only; (2) Communication Layer — route binding,
pairing, approval, attachment refs, idempotency, receipts, channel rendering;
(3) Software Layer — projects, services, workflows, AgentTasks, runtime sessions,
project state; (4) Base Service Layer — memory, docs, files, audit, tool registry,
MCP/skills, local model/browser/runtime capability catalog; (5) Physical Service Layer —
machines, devices, ports, disks, processes, networks (physical resources never own
projects); (6) External Capability Layer — third-party APIs, remote model services,
remote agent services. Hard boundaries: IM adapter cannot run business logic or read
project directories; communication-gateway cannot call Codex, read workspace index,
query memory tables, or own project state; control-plane business input must come from
standard `IMEnvelope` or typed control APIs; agent execution must be expressed as
software-layer managed `AgentTask`; memory/docs/files/audit/tool registry/capability
catalog belong to base service; servers/ADB devices/ports/processes/host health belong
to physical service; third-party APIs and remote agents belong to external capability.
Hooks must never be used as a runtime bypass.

**Two-app user entrance.** Per `apps/AGENTS.md` "用户工作台是两个独立应用": the workbench
product is exactly two independent user-facing apps. `apps/workbench` (`@axi/workbench`)
is the web admin control center — Axi Dashboard Chrome, tab bar, breadcrumbs, settings
panel, C-level management/governance work. `apps/workbench-mobile` (`@axi/workbench-mobile`)
is the mobile role-execution/auxiliary end — WeChat-style header, four pinned nav items
(Home / Projects / Workspace / Me), badges, top-mounted scan action, A/B-level mobile
task combos. `apps/web-portal` is an archived legacy portal. The two apps share only
authentication, API, contracts, language preference, and design tokens — not pages or
layout. Axi UI sidebar/topbar/tabs/breadcrumbs/settings belong to web only; WeChat-style
header / four pinned nav items / top scan action belong to mobile only. User capabilities
must first be classified per `docs/state/PRD.md`'s A/B/C/D action levels: mobile takes
A-level observation/reminders and policy-permitted B-level single-object execution; C-level
governance stays on web; D-level specialized/physical operations stay in dedicated tools.
Do NOT fold `workbench-mobile` back into `workbench`'s viewport/CSS branch; do NOT build
a third duplicate user portal.

**Workspace Entry Spatial Graph render host boundary.** Per `AGENTS.md` §"Workspace Entry
Render Host Boundary" (added 2026-09-24 REMEDIATION-PLAN §WP-02), this repo is the **render
host**, NOT the fact owner. Fact source = `axi-workspace-governance` (`infra/axi-workspace-governance/`,
owns `workspace.json`, `workspace.graph.json`, catalog, handoff, completion, audit). Data
plane = `axi-kernel` (PRD-01, `projects/axi-kernel/`, owns Registry v6 schema: object
registration, relations, change, drift detection) and `axi-workbench-cli` (PRD-02,
`workbench/axi-workbench-cli/`, owns workspace scan, 8 health checks, DOT/JSON relation
graph, §7 metric primitives — CLI + DOT/JSON, no Web UI). Render host = this repo
(`workbench/axi-workbench/`): `apps/workbench` Web / Desktop (Tauri 2) / Mobile (Capacitor)
read-only consumers, does NOT persist any facts. Hard constraints: (1) MUST NOT modify
fact source files; (2) `axi-kernel` and `axi-workbench-cli` appear as `peerDependencies`,
version contract locked via `workspace.graph.json.contracts`; (3) pure render code (UI /
interaction / view state without new facts) may be modified locally; (4) any new fact
must first be added to `workspace.json` / `workspace.graph.json`; (5) `axi-workbench-cli`
is the data-plane consumer counterpart (CLI/DOT/JSON), not a second Workbench UI — this
repo's web/desktop/mobile forms are three delivery forms of the same Workbench product.

**Commit ledger canonical owner + Rust migration in flight.** Per `HANDOFF.md` (CL-019,
2026-09-15), the Commit Ledger feature has shipped local integration (CL-014/015/017) on
`apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx` + `useCommitLedger.ts` with
Web route `apps/workbench/src/lib/navigationRegistry.ts:82,133`, 7 gateway routes in
`services/api-gateway/config/routes.yaml:301-363`, OpenAPI at
`services/control-plane/openapi/commit-ledger.v1.yaml`, and core modules in
`services/control-plane/src/commit-ledger/`. CL-018 (`node --test services/control-plane/src/commit-ledger/integration.test.ts`,
694 lines) and CL-020 (final integration review) are pending. External gates remain
BLOCKED (production DB migration, production deploy, public OIDC). Recent git log shows
the Rust migration scaffold for `control-plane` (`control-plane-server-rs`,
`control-plane-view-registry-rs`, `control-plane-resource-policy-rs`,
`control-plane-outbox-rs`, `control-plane-event-store-rs`) and `api-gateway`
(`src-rs/`, ADR-017), plus SECURITY batches A–D covering undici, brace-expansion, postcss,
`@opentelemetry/*`, `sharp`, `protobufjs`, fast-uri 3.1.6 → ^3.1.8, xlsx → `@e965/xlsx`
fork, vitest 1.6.1 → 3.2.7. devsvc-dashboard already cut initial CSS by 57% via lazy
`Shell` + dynamic `@axi/*` CSS.

**EPAP → `@axi/workstation-*` migration status is transitional.** Per `README.md` "EPAP
迁移状态（Legacy）", `packages/epap-schemas-compat/` is legacy alias for
`@axi/workstation-contracts`; `--filter=@epap/*` and `@epap/*` tsconfig path aliases are
transitional; the remote repo's EPAP name is transitional. New public service / contract
packages should use `@axi/workstation-control-plane`, `@axi/workstation-communication-gateway`,
and `@axi/workstation-contracts` directly. The compatibility exports remain until
downstream consumers (other Axi Dashboard Apps) have validated the migration.

**Token layer & design system.** Per `README.md` §"Naming" + `apps/axi-docs/...`, the
canonical design tokens ship as `@axi/tokens` (workspace:^), with `axi_tokens.xml` for
Android-side analogues; the `@axi/icons` workspace dep appears in the root. The recent
commit `e821572f refactor(axi-docs): converge token namespace to --axi-docs-*, adopt
@axi/tokens baseline` shows the tokens strategy converging on the `@axi/tokens` baseline
across the docs app. WEB and mobile share auth, API, contracts, language preference, and
**only** the design tokens — they do not share pages, layouts, or topbar/navbar
implementations.

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Six-layer SOP | Six-layer control plane normative model | Done (per `docs/rules/epap-six-layer-sop.md`) |
| Workspace Entry render-host boundary | Render-host vs fact-owner separation | Done (added 2026-09-24 per AGENTS.md §WP-02) |
| Commit Ledger CL-014/015/017 | Local integration (UI + Web route + 7 gateway routes + OpenAPI + core modules) | Done |
| Commit Ledger CL-018/020 | Integration test (694 lines) + final review | Pending |
| External gates | Production DB migration, production deploy, public OIDC | BLOCKED |
| `api-gateway` Rust migration | ADR-017 scaffold in `src-rs/` | In progress |
| `control-plane` Rust split | ADR-018 scaffold: server-rs, view-registry-rs, resource-policy-rs, outbox-rs, event-store-rs | In progress |
| Security batches A–D | undici / brace-expansion / postcss / `@opentelemetry/*` / sharp / protobufjs / fast-uri 3.1.6 → ^3.1.8 / xlsx → `@e965/xlsx` fork / vitest 1.6.1 → 3.2.7 | Done |
| Token baseline convergence | `@axi/tokens` adoption + `--axi-docs-*` namespace | In progress (`e821572f`) |
| devsvc-dashboard CSS reduction | Lazy `Shell` + dynamic `@axi/*` CSS | Done (–57%) |

## Notes

This monorepo is the **render host** of the Workspace Entrance Spatial Graph — not the
fact owner. Fact source lives in `infra/axi-workspace-governance/` (`workspace.json`,
`workspace.graph.json`, catalog, handoff, completion, audit) and data plane lives in
`axi-kernel` (`projects/axi-kernel/`, Registry v6 schema). Hard constraint: MUST NOT
modify fact source files; any new fact must first land in `workspace.json` /
`workspace.graph.json`. EPAP → `@axi/workstation-*` migration is transitional; new public
packages should use `@axi/workstation-control-plane`, `@axi/workstation-communication-gateway`,
`@axi/workstation-contracts` directly. `auth-service` and Spring/H2 `core-service` are
migration-compatibility sources only, NOT production identity / business data owners.
The renderer is intentionally split across Web (`apps/workbench`), Mobile
(`apps/workbench-mobile` at `:5174` with native Android `android/`), and Desktop
(`apps/workbench-desktop` Tauri 2); these are three delivery forms of the same Workbench
product, NOT three separate products. `apps/web-portal` is archived; do NOT build a third
duplicate user portal. Token layer strategy converges on `@axi/tokens` baseline.

## Authoritative Documents

- [`/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md) — project boundary + 6-layer SOP + Workspace Entry render-host boundary
- [`/Volumes/code/workspace/workbench/axi-workbench/README.md`](/Volumes/code/workspace/workbench/axi-workbench/README.md) — primary entrypoint
- [`/Volumes/code/workspace/workbench/axi-workbench/INDEX.md`](/Volumes/code/workspace/workbench/axi-workbench/INDEX.md) — top-level entry pointer
- [`/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md) — zero-context handoff (CL-019, ahead-batch snapshot)
- [`/Volumes/code/workspace/workbench/axi-workbench/CHANGE.md`](/Volumes/code/workspace/workbench/axi-workbench/CHANGE.md) — change log pointer → `docs/state/CHANGELOG.md`
- [`/Volumes/code/workspace/workbench/axi-workbench/CLAUDE.md`](/Volumes/code/workspace/workbench/axi-workbench/CLAUDE.md) — points to AGENTS.md
- [`/Volumes/code/workspace/workbench/axi-workbench/PRD.md`](/Volumes/code/workspace/workbench/axi-workbench/PRD.md) — root stub pointing to `docs/state/PRD.md`
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/state/PRD.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/state/PRD.md) — canonical PRD (14 REQ-*)
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/state/CHANGELOG.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/state/CHANGELOG.md) — canonical changelog
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/architecture/source-catalog.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/architecture/source-catalog.md) — source-role catalog
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-six-layer-sop.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-six-layer-sop.md) — 6-layer control plane SOP
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/rules/axi-workbench-boundary-sop.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/rules/axi-workbench-boundary-sop.md) — boundary SOP
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-project-doc-agent-sop.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-project-doc-agent-sop.md) — project docs SOP
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/adr/0001-zitadel-gin-platform-core.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/adr/0001-zitadel-gin-platform-core.md) — ADR-001 ZITADEL + Gin + platform-core
- [`/Volumes/code/workspace/workbench/axi-workbench/apps/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/apps/AGENTS.md) — apps subtree + two-app workbench rule
- [`/Volumes/code/workspace/workbench/axi-workbench/services/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/services/AGENTS.md) — services subtree + port assignments
- [`/Volumes/code/workspace/workbench/axi-workbench/prompts/README.md`](/Volumes/code/workspace/workbench/axi-workbench/prompts/README.md) + `prompts/AGENTS.md` + `prompts/prompt-layer.manifest.json` — prompt layer
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/project-docs.manifest.json`](/Volumes/code/workspace/workbench/axi-workbench/docs/project-docs.manifest.json) — document manifest (status: legacy)
- Workspace graph: `/Volumes/code/workspace/WORKSPACE_INDEX.md` + `/Volumes/code/workspace/workspace.graph.json`

## Cross-References

- Workspace root: `/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md` (Axi Workbench row)
- Workspace governance (read-only): `/Volumes/code/workspace/infra/axi-workspace-governance/`
- Workspace relationship graph CLI: `/Volumes/code/workspace/scripts/workspace-project`
- Naming + brand: `/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`
- DevSvc / PM2 service orchestration: `/Volumes/code/workspace/docs/DEV_SERVICES.md` + `/Volumes/code/workspace/dev-services.config.json`
- Workspace Entry Spatial Graph PRD: `/Volumes/code/workspace/infra/axi-workspace-governance/docs/specs/2026-09-24-workspace-entrance-spatial-graph/PRD.md` (§2.1 / §10.2 / §19 #9 / §21)
- Workspace governance project catalog: `/Volumes/code/workspace/infra/axi-workspace-governance/docs/project-catalog.md`
- Neighbour projects (consumers / providers): `foundation/axi-notify` (Android client + Relay consumer of control-plane + platform-core), `foundation/axi-pet`, `foundation/axi-agent`, `foundation/axi-image-preview` (also exposed as workspace sibling), `shared/axi-ui`, `shared/axi-registry`, `tools/axi-app-cli`
- Sibling monorepo under same workbench partition: `workbench/axi-image-preview` (separate dossier)
- Sibling monorepo under foundation: `foundation/axi-notify` (separate dossier), `foundation/axi-kernel` (data plane owner — read-only contract for this repo)
- Axi App CLI scaffolder: `tools/axi-app-cli/AGENTS.md` + `tools/axi-app-cli/README.md` (per AGENTS.md backlink)
