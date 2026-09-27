---
id: axi-docs-en-projects-axi-soul-world
title: Axi Soul World
type: project
status: published
tags: [Axi Docs, Projects, products, core]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Local-first multi-surface product: Axi Soul World product core in this repo, Axi Mood on Android, an admin Web (later Mac), and a WeChat-style phone QR login.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: core
---

# Axi Soul World

> Mirror of the project root `README.md`. Source of truth:
> [`/Volumes/code/workspace/products/axi-soul-world/README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md).
> Section: core / Partition: `products/`.

## Summary

A multi-surface local-first product: the product core (`axi-soul-api`), the
Axi Mood Android phone client, an admin Web (later the same UI as a Mac app),
and a Web BFF. The computer displays a login QR code; the phone scans and
approves. The phone itself shows no login QR. The legacy `axi-mood-app/`
folder was folded into `apps/android/`; `com.axi.mood` is only the historical
applicationId.

**Stage**: live project (product and runtime still delivered in PRD/P0/P1/P2 slices).
**Canonical path**: `/Volumes/code/workspace/products/axi-soul-world`.

Branch policy: `main` carries only releasable builds; `dev` carries daily
integration. New work branches off `dev` as `feature/*`, `fix/*`, or `codex/*`,
merges back through review and verification, and only then merges to `main`.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Product core `axi-soul-api` | C++20 modular skeleton (CMake presets, domain/application/platform/infrastructure/transport layers) | Domain + use cases + stable contracts; not the Android app |
| Local runtime | Android SQLite (currently the only canonical runtime) | Local-authority by default; explicit sync required for remote use |
| Web BFF | `apps/web-bff` contract, v1 inlined into the core process | Cookie sessions, login QR, admin DTOs |
| Admin Web | `apps/web-admin` web MVP | Big-screen triage; later packed as Mac |
| Android client | Kotlin + XML View | The Axi Mood phone surface: records + scan-to-approve |
| JNI helper | C++ `axi_core` | Phone-only time / album grouping, not the product core |
| Auth helper | Rust (`axi-auth-helper`) | Local authorization helper, not the business backend |
| Design system | `axi_tokens.xml`, future `@axi/*` | Semantic design tokens |

## Project Layout

```text
axi-soul-world/
├── axi-soul-api/           # Product core backend (domain + swappable runtime)
├── apps/web-bff/           # BFF contract for the admin Web (v1 inlined)
├── apps/web-admin/         # Admin web MVP, later packed as Mac
├── apps/mac-admin/         # Reserved Mac shell, reuses web-admin
├── apps/android/           # Phone client (the Gradle project)
├── axi-auth-helper/        # Rust local authorization helper
├── docs/architecture/      # Three-surface split and BFF boundary
├── architecture-inputs/    # API, sync, security inputs
├── BACKEND_CONTRACT.md     # Cross-runtime stable contract
└── BACKEND_ARCHITECTURE_PLAN.md
```

Do not split `apps/android` into a separate product repository. Domain and
storage behaviours migrate to `axi-soul-api`; the phone keeps UI, local
adapters, and the scan-to-approve flow.

## Build

```bash
# Debug
export ANDROID_HOME=/Users/mose/.local/opt/android-sdk
cd apps/android
./gradlew :app:assembleDebug

# Release
cd apps/android
./gradlew :app:assembleRelease
```

## Install (requires device fingerprint)

```bash
cd axi-soul-world
./apps/android/scripts/install-with-miui-tap.sh \
  apps/android/app/build/outputs/apk/release/app-release.apk \
  m7lru45xu4mjcq7x
```

## Verification

```bash
# Design-token audit
cd apps/android && ./gradlew :app:checkDesignTokens

# Workspace registration and handoff
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs handoff-check axi-soul-world
```

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| PRD | Product requirements document | Done |
| P0 | Private journal core | In progress (Android MVP shipped; backend loopback only) |
| P1 | Personal life organisation (todo / check-in / attachments) | In progress (Todo v3 shipped; check-in domain history still TODO) |
| P2 | Encrypted backup and cross-device sync | Pending privacy decision |

See `CHANGE.md` for the full unreleased history and
[`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md)
for the staged plan.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md) — project boundary and verification rules
- [`README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md) — primary entrypoint
- [`CHANGE.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGE.md) — change log
- [`TODO.md`](/Volumes/code/workspace/products/axi-soul-world/TODO.md) — task tracker
- [`PRD.md`](/Volumes/code/workspace/products/axi-soul-world/PRD.md) — product requirements
- [`BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md) — cross-runtime contract
- [`BACKEND_ARCHITECTURE_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md) — backend architecture
- [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md) — staged delivery plan
- [`docs/HANDOFF.md`](/Volumes/code/workspace/products/axi-soul-world/docs/HANDOFF.md) — zero-context takeover brief
- [`docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md) — core backend / admin Web / phone split
- [`apps/android/README.md`](/Volumes/code/workspace/products/axi-soul-world/apps/android/README.md) — Android surface
- [`axi-soul-api/README.md`](/Volumes/code/workspace/products/axi-soul-world/axi-soul-api/README.md) — product core backend