---
stale-doc: true
stale-reason: 历史文档含 axiom-* 用法，未同步更新到 axi-* 命名约定
last-synced: 2026-09-25
synced-by: audit-remediation-2026-09-25
---

# Axi Workbench Architecture

## 1. Overview

Axi Workbench is a **multi-service enterprise control plane** that provides a unified administrative interface for managing agents, workflows, notifications, and platform operations across web, mobile, and desktop surfaces.

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend Apps | React, TypeScript, Vite, Capacitor, Tauri 2 |
| Backend Services | Go/Gin, Node.js, Spring/H2, Python |
| Infrastructure | Docker Compose, GitHub Actions |
| Design System | @axi/shell, @axi/core, @axi/tokens |

---

## 2. Monorepo Structure

```
axi-workbench/
├── apps/                      # User-facing applications
├── packages/                 # Shared TypeScript packages
├── services/                 # Backend microservices
├── ai/                       # Knowledge base + agent integration
├── infra/                    # Infrastructure tooling
├── tools/                    # Standalone CLI tools
├── docs/                     # Project documentation
├── backend/                  # Embedded Python runtime
├── prompts/                  # Prompt layer
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Workspace Configuration

All workspace packages are declared in `pnpm-workspace.yaml` and `turbo.json` for build orchestration.

---

## 3. Platform Apps

### 3.1 `apps/workbench` — Web Admin Control Center

**Package**: `@axi/workbench`

The primary administrative interface for the enterprise control plane.

| Command | Action |
|---------|--------|
| `pnpm dev:workbench` | Start development server |
| `pnpm build:workbench` | Production build |
| `pnpm --filter @axi/workbench type-check` | TypeScript validation |

### 3.2 `apps/workbench-mobile` — Mobile Role Terminal

**Package**: `@axi/workbench-mobile`

Cross-platform mobile application built with Capacitor for Android and iOS.

| Command | Action |
|---------|--------|
| `pnpm dev:mobile` | Start mobile dev server |
| `pnpm build:mobile` | Production build |
| `pnpm --filter @axi/workbench-mobile verify:contracts` | Contract validation |

### 3.3 `apps/workbench-desktop` — Tauri Desktop Shell

**Package**: `@axi/workbench-desktop`

Native macOS desktop application using Tauri 2 with a Rust backend.

| Command | Action |
|---------|--------|
| `pnpm dev:desktop` | Start desktop dev server |
| `pnpm build:desktop` | Production build |
| `pnpm build:desktop:dmg` | macOS DMG package |
| `pnpm build:desktop:local` | Local build |

### 3.4 `apps/axi-coder` — Full Development Workbench

**Package**: `axi-coder`

Hosted coding tool providing a full development environment on Tauri desktop.

| Command | Action |
|---------|--------|
| `pnpm dev:coder` | Start development server |
| `pnpm build` | Production build |

### 3.5 Other Apps

| App | Purpose |
|-----|---------|
| `devsvc-dashboard` | Local service host + Axi app host |
| `verification-inbox` | OTP verification inbox |
| `app-search-system` | Embedded multi-runtime docs/search |
| `ollama-menu-assistant` | macOS Swift menu assistant |

---

## 4. Key Packages

### 4.1 `@axi/api-client`

Axios-based API client with React Query integration. Provides typed API calls with hooks for the frontend applications.

### 4.2 `@axi/workstation-contracts` (schemas)

Canonical contract definitions using Zod schemas. Key types:

- `IMEnvelope` — Instant messaging envelope format
- `AgentTask` — Agent task protocol definitions

### 4.3 `@axi/types`

Shared TypeScript type definitions used across all apps and services.

### 4.4 `@axi/utils`

Utility helpers including: `cn` (class names), `date`, `string`, and `storage` utilities.

### 4.5 `@axi/workbench-foundation`

Foundation module providing:

- `auth` — Authentication session management
- `icons` — Icon system
- `locale` — Internationalization
- `shell-contracts` — Shell integration contracts

---

## 5. Key Services

### 5.1 Go/Gin Services

| Service | Purpose |
|---------|---------|
| `api-gateway` | Sole business API entry point; ZITADEL JWKS authentication, Redis rate-limiting |
| `identity-adapter` | Axi Identity OIDC adapter; QR code login flow |
| `platform-core` | Modular tenant core; RBAC, projects, and tasks management |

### 5.2 Node.js Services

| Service | Purpose |
|---------|---------|
| `control-plane` | Agent orchestration using LangChain/LangGraph |
| `communication-gateway` | IM routing; route binding and channel rendering |

### 5.3 Legacy/Other Services

| Service | Purpose |
|---------|---------|
| `auth-service` | Legacy prototype (migration compatibility) |
| `core-service` | Spring/H2 read-only migration compatibility |
| `file-service` | File management |
| `notification-service` | Notification dispatch |
| `workflow-engine` | Workflow execution |

---

## 6. Shared Axi-UI Integration

Design system packages are located in `/foundation/axi-ui/packages/` and consumed via `workspace:*` protocol.

### Consumed Packages

| Package | Consumed By | Purpose |
|---------|-------------|---------|
| `@axi/core` | workbench, workbench-mobile, axi-coder | Core primitives |
| `@axi/shell` | workbench, axi-coder | Dashboard shell layout |
| `@axi/tokens` | workbench, workbench-mobile, axi-coder | Design tokens |
| `@axi/crud` | workbench | CRUD components |
| `@axi/presets` | workbench | Preset configurations |
| `@axi/settings` | workbench | Settings components |
| `@axi/widgets` | workbench | Shared widgets |

---

## 7. Build Commands

### Monorepo-Wide Commands

```bash
pnpm install              # Install dependencies
pnpm build               # Turbo build all packages
pnpm type-check          # Turbo type-check all
pnpm test                # Turbo test all
pnpm lint                # Turbo lint all
pnpm dev:workbench       # Web admin
pnpm dev:mobile          # Mobile app
pnpm dev:desktop         # Desktop app
pnpm dev:dashboard       # DevSvc host
pnpm dev:coder           # Axi Coder
pnpm verify:ci           # CI contract validation
pnpm test:workstation    # Control plane contract tests
```

---

## 8. CI/CD Pipeline

### Workflow: `.github/workflows/axi-ci.yml`

**Triggered on**: Pull requests to `dev`, `main`; Push to `dev`, `main`, `feature/**`, `debug/**`, `hotfix/**`, `release/**`

### Jobs

#### Contracts Job
Validates workspace integrity:

- Root `package.json` has required scripts: `build`, `type-check`, `test`, `verify:ci`
- `turbo.json` contains `build`, `type-check`, `test` tasks
- `pnpm-workspace.yaml` includes `packages` declaration
- `.github/workflows/axi-ci.yml` contains required CI steps

#### Baseline Job
Runs on every push to tracked branches:

1. `lint` — Code linting
2. `type-check` — TypeScript validation
3. `test` — Test suite
4. `build` — Production build

### Other Workflows

| Workflow | Purpose |
|----------|---------|
| `axi-branch-cleanup.yml` | Branch lifecycle management |
| `axi-desktop-macos.yml` | macOS desktop build |
| `axi-release.yml` | Release automation |
| `axi-shared-contracts.yml` | Shared contract validation |
| `axi-rules-hooks.yml` | Rules hook enforcement |
| `axi-pr-metadata.yml` | PR metadata handling |

---

## 9. Why axiom-agent and axiom-notify Are Separate

### axiom-agent

**Location**: `/Volumes/code/workspace/agent-cluster/axi-agent`

A distinct monorepo for agent runtime and task orchestration capabilities:

- `agent-runtime-owner` — Core agent execution runtime
- `managed-agent-tasks` — Task management
- `workstation-agent-task-api` — API surface
- `mcp-quality-gate-runtime` — MCP quality enforcement
- `terminal-agent-transport` — Terminal transport layer
- `remote-codex-session-bridge` — Codex integration
- `local-task-ledger` — Local state management
- `bounded-agent-runtime-v1` — Bounded runtime variant

**Separation rationale**: Agent execution runtime is a distinct capability domain. Workbench provides the UI/dashboard control surface; axiom-agent owns the agent execution engine, MCP services, and transport layers.

### axiom-notify

**Location**: `/Volumes/code/workspace/foundation/axi-notify`

A distinct monorepo for notification relay and mobile surfaces:

- `relay-server` — Notification relay server
- `workflow-contracts` — Workflow contract definitions
- `mobile-event-inbox` — Mobile event inbox
- `android-agent-notification-client` — Android notification client
- `mobile-workbench` — Mobile workbench variant

**Separation rationale**: Mobile notification/relay is a distinct domain from the web-based control plane. It handles Android-native surfaces, event inbox, and mobile-specific workflows with a different tech stack (Android/Kotlin vs web/React).

### Key Distinction

| Project | Domain | Tech Stack |
|---------|--------|------------|
| axiom-workbench | Control plane UI, admin dashboard, cross-platform shell | React, TypeScript, Go/Gin, Node.js |
| axiom-agent | Agent execution runtime, MCP services, task orchestration | Node.js, TypeScript, LangChain/LangGraph |
| axiom-notify | Notification relay, mobile surfaces, event inbox | Android/Kotlin, Node.js, mobile-specific |

Both `axiom-agent` and `axi-notify` are consumed by `axiom-workbench` as independent capability providers.

---

## 10. Contract Validation

Contract validation ensures backward compatibility across service boundaries:

```bash
pnpm verify:ci              # Full CI contract validation
pnpm test:workstation       # Control plane contract tests
```

The validation script (`scripts/verify-ci-contracts.mjs`) checks:

1. All required build scripts exist in root `package.json`
2. Turbo pipeline is properly configured
3. Workspace declarations are complete
4. CI workflow includes all required jobs
