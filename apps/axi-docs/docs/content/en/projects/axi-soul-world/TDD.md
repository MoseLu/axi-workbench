---
id: axi-docs-en-projects-axi-soul-world-tdd
title: "Axi Soul World — TDD"
type: project
status: published
tags: [Axi Docs, Projects, products, tdd]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Behaviour-test plan for the Axi Soul World product.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
---

# Axi Soul World — TDD

> Mirror pointer to the project verification surface at
> [`/Volumes/code/workspace/products/axi-soul-world/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md)
> and
> [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md).

## Verification commands (canonical, from project root)

```bash
git diff --check
test -f docs/architecture/three-surface-bff.md
test -f axi-soul-api/README.md && test -f apps/web-admin/index.html
cd apps/android && ./gradlew :app:checkDesignTokens
cd apps/android && ./gradlew :app:testDebugUnitTest
cd axi-soul-api && cmake --preset mac-arm64-clang-debug
cd axi-soul-api && cmake --build --preset mac-arm64-clang-debug
cd axi-soul-api && ctest --preset mac-arm64-clang-debug --output-on-failure
cargo test --manifest-path axi-auth-helper/Cargo.toml
```

## Behaviour tests

- [x] Android module boots in emulator/device.
  Evidence: device `m7lru45xu4mjcq7x` install + UI smoke for Todo
  Today/Active/Done, secondary editor, and Material date/time pickers.
- [x] `BACKEND_CONTRACT.md` boundary is honoured by `axi-soul-api` skeleton.
  Evidence: contract tests + `/healthz` + `/readyz` loopback pass.
- [ ] Admin Web QR login + Android scan-to-approve end-to-end.
- [ ] PostgreSQL migration up and down against an empty database.
- [ ] Check-in domain history: streak under repeated taps, missed days,
      timezone change, archive.
- [ ] Sync opt-in: Android → `axi-soul-api` → another client round-trip;
      no payload leaves the device when sync is disabled.