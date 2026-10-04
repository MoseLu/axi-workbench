---
id: axi-docs-en-projects-observability
title: Axi Observability
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Observability
graph-tags: [Projects, foundation]
description: Axi Observability workspace project.
project:
  id: observability
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-observability
  source-section: shared
---

# Behavior / Workflow / Validation Changes

This file logs changes that affect agent behavior, workflow, or validation
rules. Routine implementation commits go to `CHANGELOG.md` instead.

## 2026-09-24 — bootstrap

- New candidate project `candidates/observability` registered under
  governance. Affects log-meter / metric / trace verification path
  across all workspace projects that adopt the SDK.
- ADR-010 added to the rule router. Future changes to workspace logging,
  metrics, or tracing policies MUST update ADR-010 in the same PR.
- Five SDK package contracts introduced:
  - Python: `axi_observability.logging.setup(service, env, level)`
  - Go: `axilog.WithService(name)` + `axilog.GinMiddleware()`
  - Node: `@axi/observability-logging.createLogger(service)`
  - Android: `axilog.init(context, service)`
  - Web: `axilogWeb.install(service, ingestUrl)`
- Grafana datasource provisioning default points at local Docker
  containers (not Loki Cloud / not OSS).

## Migration cookbook (when projects adopt the SDK)

Each adopting project must:

1. Add a verification entry to its `AGENTS.md` referencing the relevant
   SDK package.
2. Replace bare `print(` / `console.*` with the SDK call in the file
   touched (do not rewrite the whole project in one go).
3. Add a unit test that captures a structured record and asserts on
   `service` / `env` / `trace_id` fields.
4. Update `CHANGELOG.md` with the migration entry and link to the
   cookbook.