---
id: axi-docs-zh-projects-axi-workbench
title: Axi Workbench
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench
graph-tags: [Projects, workbench]
tags: [Axi Docs, 项目, workbench, monorepo, control-plane]
description: AxiomaticWorld 的权威 workbench monorepo —— 拥有六层控制面、Web/Mobile/Desktop 用户端、DevSvc 宿主、Axi Coder、Axi Docs、Verification Inbox、Fleet Console、Ollama 菜单助手以及 Axi App CLI 脚手架。
project:
  id: axi-workbench
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench
  source-section: core
---

# Axi Workbench

> 项目根 `README.md` + `AGENTS.md` + `docs/HANDOFF.md` 的镜像；项目根为唯一权威。
> Source of truth:
> [`/Volumes/code/workspace/workbench/axi-workbench/README.md`](/Volumes/code/workspace/workbench/axi-workbench/README.md),
> [`/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md),
> [`/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md).
> Section: core / Partition: `workbench/`。

## 概述

`Axi Workbench` 是 AxiomaticWorld（公理世界）产品线的权威 monorepo。它承载工作区其他项目所依赖的**六层控制面**（IM / Communication / Software / Base Service / Physical Service / External Capability），并交付两个真实用户入口（`apps/workbench` Web 管理端 `:5173` 与 `apps/workbench-mobile` 移动端 `:5174`），再加桌面变体 `apps/workbench-desktop` Tauri 2。monorepo 同时承载**DevSvc Dashboard 宿主**（`apps/devsvc-dashboard`）、Axi Coder（`apps/axi-coder`）、Axi Docs（`apps/axi-docs`）、Verification Inbox（`apps/verification-inbox`）、App Search（`apps/app-search-system`）、Ollama Menu Assistant（`apps/ollama-menu-assistant`）、Resource Orchestration（`apps/resource-orchestration`）、Axi ArtBoard（`apps/axi-artboard`）以及脚手架 CLI（`tools/axi-app-cli/`）。后端拆分为 `services/`（`api-gateway` Go/Gin 单 HTTP 入口，宿主机端口 `18088`，外加 `identity-adapter`、`platform-core`、`workflow-engine`、`notification-service`、`file-service`、`auth-service`、`core-service`、`communication-gateway`、`control-plane`、`resource-gateway`、`agent-runtime`）和 `backend/`（嵌入式 Python `mini_agent` + `local_server` 运行时）。

仓库是 **Workspace Entrance Spatial Graph 的渲染宿主**而非事实拥有者：依据 AGENTS.md §"Workspace Entry Render Host Boundary"（2026-09-24 加入），事实源与数据面位于 `infra/axi-workspace-governance/`（`workspace.json`、`workspace.graph.json`、catalog、handoff、completion、audit）和 `axi-kernel`（object registry v6 schema）；本仓仅通过 peerDependencies 与 `axi-workbench-cli` 数据面契约消费它们。依据 `services/AGENTS.md`，两条业务面为：**业务 API 面**（宿主机端口 18088 → 六个内部容器）和 **workstation 控制面**（`control-plane:8092`、`communication-gateway:8093` —— 故意绕过 `api-gateway`）。`auth-service` 与 Spring/H2 `core-service` 只是迁移期兼容来源，不是生产身份 / 业务数据的拥有者。

**当前阶段**：活跃 monorepo（分布于 `apps/` `services/` `packages/` `tools/` `ai/` `prompts/` `backend/` `infra/` `docs/`）。
**规范路径**：`/Volumes/code/workspace/workbench/axi-workbench`。
**分支**：`dev` 截至 2026-09-24（HANDOFF.md）领先 `origin/dev` 16 个 commit；审计时的工作分支为 `feature/axi-docs-token-convergence`，正在推进 token-baseline 改造。

## 技术栈

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

## 项目结构

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

## 构建与安装

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

## 验证

依据 `AGENTS.md` "Verification" + `services/AGENTS.md` + `apps/AGENTS.md`：

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

变更驱动的最小验证选择（AGENTS.md）：
- 改 `apps/<x>/**` → 跑 `apps/<x>` 的最小验证（typecheck / test），再视改动范围跑 `pnpm test:workstation`
- 改 `services/<x>/**` → 跑对应服务的 `go test` / `mvn test` / `pytest` 入口
- 改 `packages/<x>/**`（尤其 `epap-schemas-compat`）→ 跑 `pnpm type-check` + 至少一个下游 app 的 `typecheck`
- 改 `tools/axi-app-cli/**` → 跑 `pnpm --dir tools/axi-app-cli boundaries:check` + `capabilities:check`
- 改 `prompts/**` → 跑 `prompts/AGENTS.md` 与 `prompts/README.md` 所列分层校验
- 改 `docs/rules/*` 或根 `AGENTS.md` → 不需构建
- 跨项目共享契约 → 跑 `workspace-project consumers axi-workbench` 列出的所有消费者的最小验证

## 架构要点

**六层控制面是运行模型本身。** 依据 `AGENTS.md` "规范运行模型（六层控制面）" 与 `docs/rules/epap-six-layer-sop.md`，每条 IM、通讯、项目管理、AgentTask、内存、文档与基础能力都必须归入六层之一：(1) IM 层 —— 仅负责用户输入输出；(2) 通讯层 —— 路由绑定、配对、审批、附件引用、幂等、回执、通道渲染；(3) 软件层 —— 项目、服务、工作流、AgentTask、运行时会话、项目状态；(4) 基础服务层 —— 内存、文档、文件、审计、工具注册表、MCP/skills、本地模型/浏览器/运行时能力目录；(5) 物理服务层 —— 机器、设备、端口、磁盘、进程、网络（物理资源永不持有项目）；(6) 外部能力层 —— 第三方 API、远程模型服务、远程 Agent 服务。硬边界：IM 适配器不能运行业务逻辑或读取项目目录；communication-gateway 不能调用 Codex、读取 workspace index、查询 memory 表或持有项目状态；control-plane 业务输入必须来自标准 `IMEnvelope` 或类型化控制 API；Agent 执行必须以软件层托管的 `AgentTask` 表达；memory/docs/files/audit/工具注册表/能力目录归属于基础服务；服务器/ADB 设备/端口/进程/宿主机健康归属于物理服务；第三方 API 与远程 Agent 归属于外部能力。Hook 严禁用作运行时绕过通道。

**两应用用户入口。** 依据 `apps/AGENTS.md` "用户工作台是两个独立应用"：Workbench 产品恰好是两个独立用户应用。`apps/workbench`（`@axi/workbench`）是 Web 管理控制中心 —— Axi Dashboard Chrome、tab bar、breadcrumbs、settings panel、C 级管理/治理工作。`apps/workbench-mobile`（`@axi/workbench-mobile`）是移动端的角色执行/辅助端 —— 微信风格 header、四个常驻导航项（Home / Projects / Workspace / Me）、badge、顶部扫码入口、A/B 级移动任务组合。`apps/web-portal` 是归档的旧门户。两个应用**仅**共享认证、API、契约、语言偏好与设计 tokens —— 不共享页面或布局。Axi UI 侧边栏/顶栏/tabs/breadcrumbs/settings 仅属于 Web；微信风格 header / 四个常驻导航项 / 顶部扫码入口仅属于移动端。用户能力必须先按 `docs/state/PRD.md` 的 A/B/C/D 行动级分类：移动端承载 A 级观察/提醒与策略许可的 B 级单对象执行；C 级治理保留在 Web；D 级专项/物理操作保留在专用工具。**不要**将 `workbench-mobile` 合回 `workbench` 的 viewport/CSS 分支；**不要**再造第三个重复的用户门户。

**Workspace Entry Spatial Graph 渲染宿主边界。** 依据 `AGENTS.md` §"Workspace Entry Render Host Boundary"（2026-09-24 REMEDIATION-PLAN §WP-02 加入），本仓是**渲染宿主**，不是事实拥有者。事实源 = `axi-workspace-governance`（`infra/axi-workspace-governance/`，持有 `workspace.json`、`workspace.graph.json`、catalog、handoff、completion、audit）。数据面 = `axi-kernel`（PRD-01，`projects/axi-kernel/`，持有 Registry v6 schema：对象注册、关系、变更、漂移检测）与 `axi-workbench-cli`（PRD-02，`workbench/axi-workbench-cli/`，持有 workspace scan、8 项健康检查、DOT/JSON 关系图、§7 metric primitives —— CLI + DOT/JSON，无 Web UI）。渲染宿主 = 本仓（`workbench/axi-workbench/`）：`apps/workbench` Web / Desktop (Tauri 2) / Mobile (Capacitor) 的只读消费者，**不**持久化任何事实。硬约束：(1) 严禁修改事实源文件；(2) `axi-kernel` 与 `axi-workbench-cli` 以 `peerDependencies` 出现，版本契约由 `workspace.graph.json.contracts` 锁定；(3) 纯渲染代码（UI / 交互 / 不含新事实的视图状态）可在本地修改；(4) 任何新事实必须先加入 `workspace.json` / `workspace.graph.json`；(5) `axi-workbench-cli` 是数据面消费对位（CLI/DOT/JSON），不是第二个 Workbench UI —— 本仓的 web/desktop/mobile 形态是同一 Workbench 产品的三种交付形态。

**Commit Ledger 权威所有者 + Rust 迁移进行中。** 依据 `HANDOFF.md`（CL-019，2026-09-15），Commit Ledger 功能已在 `apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx` + `useCommitLedger.ts` 上完成本地集成（CL-014/015/017），Web 路由位于 `apps/workbench/src/lib/navigationRegistry.ts:82,133`，7 条 gateway 路由位于 `services/api-gateway/config/routes.yaml:301-363`，OpenAPI 在 `services/control-plane/openapi/commit-ledger.v1.yaml`，核心模块位于 `services/control-plane/src/commit-ledger/`。CL-018（`node --test services/control-plane/src/commit-ledger/integration.test.ts`，694 行）与 CL-020（最终集成评审）待办。外部闸门仍 **BLOCKED**（生产 DB 迁移、生产部署、公开 OIDC）。近期 git log 显示 `control-plane`（`control-plane-server-rs`、`control-plane-view-registry-rs`、`control-plane-resource-policy-rs`、`control-plane-outbox-rs`、`control-plane-event-store-rs`）与 `api-gateway`（`src-rs/`，ADR-017）的 Rust 迁移脚手架，以及 SECURITY batches A–D 覆盖的 undici、brace-expansion、postcss、`@opentelemetry/*`、`sharp`、`protobufjs`、fast-uri 3.1.6 → ^3.1.8、xlsx → `@e965/xlsx` fork、vitest 1.6.1 → 3.2.7。devsvc-dashboard 已通过懒加载 `Shell` + 动态 `@axi/*` CSS 削减初始 CSS 57%。

**EPAP → `@axi/workstation-*` 迁移状态为过渡期。** 依据 `README.md` "EPAP 迁移状态（Legacy）"，`packages/epap-schemas-compat/` 是 `@axi/workstation-contracts` 的旧别名；`--filter=@epap/*` 与 `@epap/*` tsconfig 路径别名是过渡的；远端仓库的 EPAP 命名也是过渡的。新的公共服务 / 契约包应直接使用 `@axi/workstation-control-plane`、`@axi/workstation-communication-gateway`、`@axi/workstation-contracts`。兼容导出在下游消费方（其他 Axi Dashboard Apps）验证完迁移前保留。

**Token 层与设计系统。** 依据 `README.md` §"Naming" 与 `apps/axi-docs/...`，权威设计 tokens 以 `@axi/tokens`（workspace:^）发布，`axi_tokens.xml` 作为 Android 端类比；`@axi/icons` 工作区依赖出现在根目录。近期 commit `e821572f refactor(axi-docs): converge token namespace to --axi-docs-*, adopt @axi/tokens baseline` 展示了 token 策略在 docs app 上收敛到 `@axi/tokens` baseline。Web 与 Mobile 共享认证、API、契约、语言偏好，以及**仅** design tokens —— 不共享页面、布局或顶栏/导航栏实现。

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| Six-layer SOP | 六层控制面规范模型 | 完成（依据 `docs/rules/epap-six-layer-sop.md`） |
| Workspace Entry render-host boundary | 渲染宿主 vs 事实拥有者的隔离 | 完成（2026-09-24 加入，依据 AGENTS.md §WP-02） |
| Commit Ledger CL-014/015/017 | 本地集成（UI + Web 路由 + 7 条 gateway 路由 + OpenAPI + 核心模块） | 完成 |
| Commit Ledger CL-018/020 | 集成测试（694 行）+ 最终评审 | 待办 |
| External gates | 生产 DB 迁移、生产部署、公开 OIDC | BLOCKED |
| `api-gateway` Rust migration | ADR-017 脚手架，位于 `src-rs/` | 进行中 |
| `control-plane` Rust split | ADR-018 脚手架：server-rs、view-registry-rs、resource-policy-rs、outbox-rs、event-store-rs | 进行中 |
| Security batches A–D | undici / brace-expansion / postcss / `@opentelemetry/*` / sharp / protobufjs / fast-uri 3.1.6 → ^3.1.8 / xlsx → `@e965/xlsx` fork / vitest 1.6.1 → 3.2.7 | 完成 |
| Token baseline convergence | `@axi/tokens` 采纳 + `--axi-docs-*` 命名空间 | 进行中（`e821572f`） |
| devsvc-dashboard CSS reduction | 懒加载 `Shell` + 动态 `@axi/*` CSS | 完成（–57%） |

## 说明

本 monorepo 是 Workspace Entrance Spatial Graph 的**渲染宿主**，而非事实拥有者。事实源位于 `infra/axi-workspace-governance/`（`workspace.json`、`workspace.graph.json`、catalog、handoff、completion、audit），数据面位于 `axi-kernel`（`projects/axi-kernel/`，Registry v6 schema）。硬约束：严禁修改事实源文件；任何新事实必须先落入 `workspace.json` / `workspace.graph.json`。EPAP → `@axi/workstation-*` 迁移处于过渡期；新公共包应直接使用 `@axi/workstation-control-plane`、`@axi/workstation-communication-gateway`、`@axi/workstation-contracts`。`auth-service` 与 Spring/H2 `core-service` 只是迁移期兼容源，**不是**生产身份 / 业务数据的拥有者。渲染层被刻意拆为 Web（`apps/workbench`）、Mobile（`apps/workbench-mobile`，端口 `:5174`，含原生 Android `android/`）与 Desktop（`apps/workbench-desktop`，Tauri 2）；这三者是同一 Workbench 产品的三种交付形态，**不是**三个独立产品。`apps/web-portal` 已归档；**不要**再造第三个重复的用户门户。Token 层策略收敛到 `@axi/tokens` baseline。

## 权威文档

- [`/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/AGENTS.md) — 项目边界 + 六层 SOP + Workspace Entry 渲染宿主边界
- [`/Volumes/code/workspace/workbench/axi-workbench/README.md`](/Volumes/code/workspace/workbench/axi-workbench/README.md) — 主入口
- [`/Volumes/code/workspace/workbench/axi-workbench/INDEX.md`](/Volumes/code/workspace/workbench/axi-workbench/INDEX.md) — 顶层入口指针
- [`/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-workbench/HANDOFF.md) — 零上下文接手（CL-019、领先批次快照）
- [`/Volumes/code/workspace/workbench/axi-workbench/CHANGE.md`](/Volumes/code/workspace/workbench/axi-workbench/CHANGE.md) — 变更日志指针 → `docs/state/CHANGELOG.md`
- [`/Volumes/code/workspace/workbench/axi-workbench/CLAUDE.md`](/Volumes/code/workspace/workbench/axi-workbench/CLAUDE.md) — 指向 AGENTS.md
- [`/Volumes/code/workspace/workbench/axi-workbench/PRD.md`](/Volumes/code/workspace/workbench/axi-workbench/PRD.md) — 根桩，指向 `docs/state/PRD.md`
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/state/PRD.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/state/PRD.md) — 权威 PRD（14 REQ-*）
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/state/CHANGELOG.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/state/CHANGELOG.md) — 权威变更日志
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/architecture/source-catalog.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/architecture/source-catalog.md) — 源-角色目录
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-six-layer-sop.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-six-layer-sop.md) — 六层控制面 SOP
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/rules/axi-workbench-boundary-sop.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/rules/axi-workbench-boundary-sop.md) — 边界 SOP
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-project-doc-agent-sop.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/rules/epap-project-doc-agent-sop.md) — 项目文档 SOP
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/adr/0001-zitadel-gin-platform-core.md`](/Volumes/code/workspace/workbench/axi-workbench/docs/adr/0001-zitadel-gin-platform-core.md) — ADR-001 ZITADEL + Gin + platform-core
- [`/Volumes/code/workspace/workbench/axi-workbench/apps/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/apps/AGENTS.md) — apps 子树 + 双应用 workbench 规则
- [`/Volumes/code/workspace/workbench/axi-workbench/services/AGENTS.md`](/Volumes/code/workspace/workbench/axi-workbench/services/AGENTS.md) — services 子树 + 端口分配
- [`/Volumes/code/workspace/workbench/axi-workbench/prompts/README.md`](/Volumes/code/workspace/workbench/axi-workbench/prompts/README.md) + `prompts/AGENTS.md` + `prompts/prompt-layer.manifest.json` — prompt 层
- [`/Volumes/code/workspace/workbench/axi-workbench/docs/project-docs.manifest.json`](/Volumes/code/workspace/workbench/axi-workbench/docs/project-docs.manifest.json) — 文档清单（status: legacy）
- 工作区图：`/Volumes/code/workspace/WORKSPACE_INDEX.md` + `/Volumes/code/workspace/workspace.graph.json`

## 交叉引用

- 工作区根：`/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md`（Axi Workbench 行）
- 工作区治理（只读）：`/Volumes/code/workspace/infra/axi-workspace-governance/`
- 工作区关系图 CLI：`/Volumes/code/workspace/scripts/workspace-project`
- 命名与品牌：`/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`
- DevSvc / PM2 服务编排：`/Volumes/code/workspace/docs/DEV_SERVICES.md` + `/Volumes/code/workspace/dev-services.config.json`
- Workspace Entry Spatial Graph PRD：`/Volumes/code/workspace/infra/axi-workspace-governance/docs/specs/2026-09-24-workspace-entrance-spatial-graph/PRD.md`（§2.1 / §10.2 / §19 #9 / §21）
- 工作区治理项目目录：`/Volumes/code/workspace/infra/axi-workspace-governance/docs/project-catalog.md`
- 邻居项目（消费方 / 提供方）：`foundation/axi-notify`（Android 客户端 + Relay 消费 control-plane + platform-core）、`foundation/axi-pet`、`foundation/axi-agent`、`foundation/axi-image-preview`（也作为工作区 sibling 暴露）、`shared/axi-ui`、`shared/axi-registry`、`tools/axi-app-cli`
- 同 workbench 分区的兄弟 monorepo：`workbench/axi-image-preview`（独立 dossier）
- 同 foundation 分区的兄弟 monorepo：`foundation/axi-notify`（独立 dossier）、`foundation/axi-kernel`（数据面所有者 —— 本仓的只读契约）
- Axi App CLI 脚手架：`tools/axi-app-cli/AGENTS.md` + `tools/axi-app-cli/README.md`（依据 AGENTS.md 反向链接）
