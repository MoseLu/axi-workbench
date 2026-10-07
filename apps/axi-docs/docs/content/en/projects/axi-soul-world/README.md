---
id: axi-docs-en-projects-axi-soul-world
title: Axi Soul World
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Soul World
graph-tags: [Projects, products]
tags: [Axi Docs, Projects, products, C++20, Rust, Kotlin, multi-surface, local-first]
description: Local-first multi-surface product — C++20 axi-soul-api product core, Kotlin/XML Android phone client (Axi Mood), web-admin (later Mac), web-bff contract inlined into the core, and Rust axi-auth-helper local authorization.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: core
---

# Axi Soul World

> Mirror of the project root `AGENTS.md` + `README.md` + `PRD.md` + `BACKEND_CONTRACT.md` + `BACKEND_ARCHITECTURE_PLAN.md` + `IMPLEMENTATION_PLAN.md` + `docs/HANDOFF.md` + `docs/architecture/three-surface-bff.md`. Source of truth:
> [`/Volumes/code/workspace/products/axi-soul-world/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md),
> [`/Volumes/code/workspace/products/axi-soul-world/README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md),
> [`/Volumes/code/workspace/products/axi-soul-world/PRD.md`](/Volumes/code/workspace/products/axi-soul-world/PRD.md),
> [`/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md),
> [`/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md),
> [`/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md),
> [`/Volumes/code/workspace/products/axi-soul-world/docs/HANDOFF.md`](/Volumes/code/workspace/products/axi-soul-world/docs/HANDOFF.md),
> [`/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md).
> Section: core / Partition: `products/`.

## Summary

Axi Soul World is a local-first multi-surface product with three coordinated surfaces and one product core. The product core is `axi-soul-api/`, a C++20 modular backend built on CMake 3.22 with four explicit layers (`axi_domain` → `axi_platform` / `axi_application` / `axi_infrastructure` → `axi_transport` → `axi-soul-api`) and a strict dependency DAG that Application owns `AccessContext` and the repository/event-bus ports while Infrastructure implements them. The Web BFF lives at `apps/web-bff/` and is a contract-only slice (v1 is inlined as a module of `axi-soul-api` per ADR-005 — same bounded context, single consumer, no second process). The admin Web is at `apps/web-admin/` — browser-only, lives on `file://` for the W4 contract slice; the same UI is later packaged as a Mac shell. The Android phone client is `apps/android/` (Kotlin + XML View, applicationId `com.axi.mood`, namespace `com.axi.mood`), with a small C++ JNI helper `apps/android/app/src/main/cpp/axi_core` for phone-only formatting/album grouping that is NOT the product core. The Rust `axi-auth-helper/` is a local UDP-broadcast authorization helper (binds `0.0.0.0:18766`, magic prefix `AXI-AUTH:`) — local convenience, NOT the business backend.

The headline contract is "phone scans computer QR, computer displays the login QR, the phone shows no login QR of its own" (微信-style split, ratified 2026-08-23 in `docs/architecture/three-surface-bff.md` and backed by ADR-005 / ADR-006). The mobile extension plan v0.2 (2026-08-30) introduces M0-M6 milestone stages, three evidence lanes (LAN / adb / iOS devicectl), and a short-term Capacitor + mid-term Flutter M1 Decision Review still pending owner sign-off. W9 / W10 / W11 implementation slices were hand-merged into `dev` on 2026-08-25; W12 (sync worker / UI slice) remains BLOCKED with explicit owner-gated prerequisites listed in `docs/architecture/w12-blocked-takeover-note.md`. Default `sync_enabled=false`, Web `sync:write` is never granted, LAN `AuthServer` is the local-unlock convenience page (not the QR protocol), and the archived W12 code slice / W11 clean variant / W1 analysis live under `archive/branch-consolidation-2026-08-25/*` tags and must not be revived.

The Android XML View surface is the canonical phone UI. `apps/android/app/src/main/java/com/axi/mood/` contains 19 Activities (`MainActivity`, `ComposeActivity`, `CoverActivity`, `TypeFilterActivity`, `ResourceSearchActivity`, `AuthWaitActivity`, `DeviceSessionApproveActivity`, `InfoActivity`, `MediaSourceActivity`, `CheckinProjectActivity`, `SearchActivity`, `AboutActivity`, `ThemeSettingActivity`, `PhotoViewerActivity`, `ActionConfirmActivity`, `FontSettingActivity`, `AvatarActivity`, `RecordModuleActivity`) plus `MainApplication.kt`, organized into `core/AxiCore.kt` (JNI loader), `security/{DeviceSessionStateReducer, DeviceSessionPayload, DeviceSessionRemoteAdapter, HttpDeviceSessionRemoteAdapter, QrEncoder}.kt`, `auth/{AuthServer, AuthManager}.kt`, `ui/{ThemeUi, CoverHeroView, MomentsSpinnerView}.kt`, and a large `data/` package housing repositories, prefs, and module facades (`MoodApplicationContainer`). The Kotlin module is wired to Android Gradle Plugin 8.2.1, Kotlin 1.9.23, kotlinx-serialization plugin, Java 17 toolchain, `minSdk 24`, `compileSdk 34`, `targetSdk 34`, `ndkVersion "26.1.10909125"`, `abiFilters "arm64-v8a"`, with `externalNativeBuild.cmake` pointing at `src/main/cpp/CMakeLists.txt`. The C++ JNI helper builds `libaxi_core.so` from `axi_core.cpp` + `axi_jni.cpp` exposing `formatFeedTime` and `groupAlbumDays` for the AlbumDayOut (`year`, `month`, `day`, `key`, `dayLabel`, `monthLabel`, `indexes`) record.

**Stage**: live product; W9 / W10 / W11 hand-merged into `dev` on 2026-08-25; W12 BLOCKED.
**Canonical path**: `/Volumes/code/workspace/products/axi-soul-world`.
**Branch**: `dev` ahead of `origin/dev` by 94 commits.
**Former incubation**: `/Volumes/code/workspace/incubator/axi-soul-world` (retained as rollback evidence).

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Product core `axi-soul-api` | C++20, CMake 3.22 presets, Conan 2 (Drogon + GTest), modular DAG `axi_domain` / `axi_platform` / `axi_application` / `axi_infrastructure` / `axi_transport` | Domain + use cases + swappable runtime; NOT the Android app. Optional `AXI_SOUL_WITH_DROGON=OFF` (default); presets: `mac-arm64-clang-{debug,release,asan}`, `linux-x64-gcc-debug`, `windows-x64-msvc-debug`. |
| Web BFF v1 (contract slice) | `apps/web-bff/` — JSON Schemas, Markdown contracts, fixtures, AJV runner | v1 implementation is inlined as a module of `axi-soul-api` per ADR-005 (same bounded context, single consumer). |
| Admin Web | `apps/web-admin/` browser-only MVP, lives on `file://` | Cookie + QR + DTO surface; later Mac shell wrapping the same UI. |
| Mac shell (reserved) | `apps/mac-admin/` | Reuses web-admin UI; not an independent product. |
| Android phone client | Kotlin 1.9.23 + XML View + Android Gradle Plugin 8.2.1 + Java 17 + kotlinx-serialization | `com.axi.mood` (historical applicationId / namespace); JNI helper in `src/main/cpp/` (`libaxi_core.so`). |
| JNI helper | C++17 `libaxi_core` (CMake 3.22.1) | Phone-only `formatFeedTime` / `groupAlbumDays`; NOT the product core. |
| Rust auth helper | `axi-auth-helper` (edition 2021), single `[[bin]] axi-auth` from `src/main.rs` | UDP `0.0.0.0:18766` broadcast listener; magic prefix `AXI-AUTH:`; opens browser on receipt. |
| Storage (Android default) | Android SQLite (local-authority by default) | Remote sync is opt-in only. |
| M0-5 LAN evidence | `apps/android/app/src/main/res/xml/network_security_config.xml` | Release HTTPS-only; debug overlay in `src/debug/res/xml/` adds loopback / 10.0.2.2 / opt-in LAN; `cleartextTrafficPermitted="false"` in main file. |
| Design tokens | `axi_tokens.xml` (semantic) and `--axi-*` alias table auto-generated | Bridge M2-8 to `@axi/*` future CSS. |

## Project Layout

```text
axi-soul-world/
├── AGENTS.md                                 # Project boundary + W9-W12 + M-extension plan 0.2
├── README.md  README.zh-CN.md
├── INDEX.md  MILESTONE.md  CHANGE.md  CHANGELOG.md
├── PRD.md  BACKEND_CONTRACT.md  BACKEND_ARCHITECTURE_PLAN.md
├── DATA_SCHEMA.md  IMPLEMENTATION_PLAN.md  TODO.md
├── incubation.json
├── axi-soul-api/                              # Product core (C++20)
│   ├── AGENTS.md  README.md
│   ├── CMakeLists.txt  CMakePresets.json  conanfile.txt
│   ├── include/axi/soul/{application,domain,infrastructure,platform,transport}/...
│   ├── src/
│   │   ├── main.cpp                          # wires application + transport + infrastructure
│   │   ├── domain/                           # device_session, record, local_date, todo, checkin,
│   │   │                                       media, exports, audit, sync
│   │   ├── platform/                         # clock, config, hash, id, log, net
│   │   ├── application/                      # device_session_service, error_envelope, health_query,
│   │   │                                       records_service, todos_service, checkin_service,
│   │   │                                       media_service, exports_service, audit_service,
│   │   │                                       identity_service, sync_service, sync_worker
│   │   ├── infrastructure/                   # in_memory_*_repository, migration_runner, null_adapters,
│   │   │                                       in_memory_postgres, sse_bus, file_object_store,
│   │   │                                       in_memory_object_store, postgres_adapters (libpq)
│   │   └── transport/                        # auth_middleware, error_mapper, http_api,
│   │                                           json_projection, request_parser,
│   │                                           resource_search_{adapter, catalog, gateway, handler},
│   │                                           route_registry
│   ├── migrations/                           # SQL migrations (used when libpq is enabled)
│   ├── Testing/  tests/  build/  conanfile.txt
├── apps/
│   ├── AGENTS.md                             # Cross-surface invariants (cookie/csrf, sync, scan direction)
│   ├── android/                              # Axi Mood phone client
│   │   ├── AGENTS.md  build.gradle  settings.gradle
│   │   ├── .env.example                      # AXI_SOUL_API_BASE_URL placeholder 192.168.101.10
│   │   └── app/
│   │       ├── build.gradle                  # AGP 8.2.1, Kotlin 1.9.23, abiFilters arm64-v8a
│   │       ├── scripts/                      # collect-resource-search-evidence.sh,
│   │       │                                   install-with-miui-tap.sh,
│   │       │                                   real-device-test.sh, wechat-cover-probe.sh
│   │       └── src/main/
│   │           ├── AndroidManifest.xml
│   │           ├── cpp/                     # libaxi_core.so (C++17 JNI helper)
│   │           │   ├── CMakeLists.txt
│   │           │   ├── axi_core.h  axi_core.cpp  axi_jni.cpp
│   │           ├── java/com/axi/mood/        # 19 Activities + MainApplication + data/ + ui/ + security/ + auth/ + core/
│   │           └── res/{drawable, drawable-nodpi, layout, mipmap-*, raw, values, values-night, xml}/
│   ├── web-bff/                              # Contract slice (v1 inlined into axi-soul-api)
│   │   ├── AGENTS.md  README.md
│   │   ├── contracts/                        # 8 schema/md files + REDIRECT.md
│   │   ├── fixtures/                         # qr-*, sync-*, devices-list, export-job, resource-search-*
│   │   └── tests/{ajv, lint-fixtures, run}.mjs
│   ├── web-admin/                            # Browser-only MVP, lives on file:// for W4
│   │   ├── AGENTS.md  README.md  package.json  index.html  resource-search.html
│   │   ├── src/  test/  test-results/        # qr-api-client, qr-contract-double, qr-page,
│   │   │                                       qr-state-machine, sync-status-page,
│   │   │                                       resource-search-{page,engine,bff}
│   └── mac-admin/  mobile-capsitor/  mobile-flutter/   # reserved / M2 skeletons
├── axi-auth-helper/                          # Rust local UDP auth helper
│   ├── Cargo.toml  Cargo.lock
│   ├── src/main.rs                           # AXI-AUTH: broadcast listener, opens browser
│   └── target/
├── architecture-inputs/                      # 7 markdown inputs (01-cpp-runtime … 08-test-critique)
├── docs/
│   ├── HANDOFF.md  VERIFICATION.md  MOBILE-STACK-RECOMMENDATION.md
│   ├── project-docs.manifest.json
│   ├── architecture/                         # three-surface-bff.md, mobile-extension-{plan,evidence,
│   │                                           ui-audit}.md, m1-mobile-stack-decision.md,
│   │                                           mobile-adapter-design.md, w12-blocked-takeover-note.md
│   ├── evidence/  integrations/  proposals/  logs/
├── build/  logs/  scripts/
```

## Build & Install

```bash
# C++ product core
cd axi-soul-api
cmake --preset mac-arm64-clang-debug             # or: mac-arm64-clang-release / asan / linux-x64-gcc-debug
cmake --build --preset mac-arm64-clang-debug
ctest --preset mac-arm64-clang-debug --output-on-failure
# Optional Drogon transport (requires Conan deps): AXI_SOUL_WITH_DROGON=ON

# Rust auth helper
cargo test --manifest-path axi-auth-helper/Cargo.toml

# Android phone client
export ANDROID_HOME=/Users/mose/.local/opt/android-sdk
cd apps/android
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
./gradlew :app:checkDesignTokens                  # design-token verification
./gradlew :app:testDebugUnitTest
# Install via LAN-attached device fingerprint:
./apps/android/scripts/install-with-miui-tap.sh \
  apps/android/app/build/outputs/apk/release/app-release.apk \
  m7lru45xu4mjcq7x

# Web admin (no build needed; lives on file://)
test -f apps/web-admin/index.html
test -f apps/web-admin/resource-search.html

# Web BFF contract runner (validates JSON Schemas + fixtures)
node apps/web-bff/tests/run.mjs
node apps/web-bff/tests/lint-fixtures.mjs

# Mobile extension scaffolding (M2)
test -f apps/mobile-capacitor/AGENTS.md
test -f apps/mobile-flutter/AGENTS.md

# Workspace handoff
node /Volumes/code/workspace/scripts/workspace-project handoff-check axi-soul-world
```

## Verification

```bash
# Workspace project handoff (mandatory before merge to main)
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project handoff-check axi-soul-world

# Surface minimums (from AGENTS.md Verification)
git diff --check
test -f docs/architecture/three-surface-bff.md
test -f axi-soul-api/README.md && test -f apps/web-admin/index.html

cd apps/android && ./gradlew :app:checkDesignTokens
cd apps/android && ./gradlew :app:testDebugUnitTest

cd axi-soul-api && cmake --preset mac-arm64-clang-debug
cd axi-soul-api && cmake --build --preset mac-arm64-clang-debug
cd axi-soul-api && ctest --preset mac-arm64-clang-debug --output-on-failure

cargo test --manifest-path axi-auth-helper/Cargo.toml

# Web BFF contract
node apps/web-bff/tests/run.mjs && node apps/web-bff/tests/lint-fixtures.mjs

# Web admin unit + e2e
cd apps/web-admin
npm run test:unit          # node --test test/qr-state-machine.test.mjs
npm run test:api-client    # node test/qr-api-client.test.mjs
npm run test:sync          # node test/sync-contract.test.mjs
npm run test:resource-search
npm run test:web-bff
npm run test               # full chain
```

## Architecture Highlights

The product core is `axi-soul-api/` — a C++20 modular skeleton with five CMake libraries and a load-bearing `axi_require_sources()` helper that refuses to configure when a source file is missing from the checkout (per the in-tree policy: "do not reintroduce `if(EXISTS)` or `if(FALSE)` to hide missing sources or tests"). The DAG is `axi_domain → axi_platform → {axi_application, axi_infrastructure} → axi_transport → axi-soul-api`; Application owns `AccessContext` and the repository/event-bus ports; Infrastructure implements them. Application services cover `device_session_service`, `records_service`, `todos_service`, `checkin_service`, `media_service`, `exports_service`, `audit_service`, `identity_service`, `sync_service`, and `sync_worker`; the `error_envelope` module normalises typed `domain::ErrorCode` into HTTP status via `domain::http_status(code)`. Domain modules are pure types + factories (`record_kind_from_string` / `record_kind_to_string` are the only narrative code in `domain/record.cpp`, mapping `RecordKind::diary|memo|todo|checkin`). Transport (`transport/http_api.cpp`) wires `ApiServer(platform::AppConfig, application::HealthQuery, ServiceBag)` with `authenticate(incoming, bag_.device_session)` and `dispatch(incoming, access, health_, bag_)`; transport submodules: `auth_middleware`, `error_mapper`, `json_projection`, `request_parser`, `resource_search_{adapter,catalog,gateway,handler}`, `route_registry`. Optional Drogon transport (`AXI_SOUL_WITH_DROGON=ON`) is off by default; Conan `conanfile.txt` requests `drogon/1.9.10` and `gtest/1.15.2` with `drogon/*:with_postgres=False` and `drogon/*:with_redis=False`. Five CMake presets cover macOS arm64 (debug/release/asan with `-fsanitize=address,undefined -fno-omit-frame-pointer`), Linux x64 GCC debug, and Windows x64 MSVC debug.

The Web BFF is a contract-only slice at `apps/web-bff/contracts/` (8 schemas + REDIRECT.md). v1 is inlined as a module of `axi-soul-api` per ADR-005 (same bounded context, single consumer). The schema layer enumerates the v1 scope set: `records:read`, `records:write`, `devices:read`, `devices:revoke`, `exports:read`, `exports:create` — `sync:write` is **deliberately absent** because sync is an explicit Android-only action and is never granted to a Web token. `apps/web-bff/fixtures/` covers `qr-{create,exchange,approved,expired,invalid-state,revoked,scope-mismatch}.json`, `sync-{status,apply-success,apply-conflict,changes}.json`, plus `devices-list.json`, `export-job.json`, and `resource-search-{catalog,empty}.json`. Tests are AJV-driven (`apps/web-bff/tests/{ajv,lint-fixtures,run}.mjs`). The admin Web MVP (`apps/web-admin/`) is a file://-only browser build with `--axi-*` alias tokens auto-generated from `axi_tokens.xml` (M2-8 scaffolded light); its source modules cover `qr-{api-client,contract-double,page,page-config,state-machine}.mjs`, `resource-search-{page,engine,bff}.mjs`, `sync-status-page.mjs`. The browser does not own storage and does not call `/v1` directly — it consumes the BFF.

The Android surface (`apps/android/`) is a Kotlin + XML View project on AGP 8.2.1 / Kotlin 1.9.23 / Java 17, with `applicationId = namespace = "com.axi.mood"`. 19 Activities cover diary, todo, check-in, moments/cover, photo viewer, font/theme settings, info/about, plus the two scan-to-approve activities (`DeviceSessionApproveActivity`, `AuthWaitActivity`) and the local-unlock convenience pair (`AuthServer` / `AuthManager` in `auth/`). The Activity surface must not become a second business-data authority — all persistence goes through `MoodStore` / `RecordRepository` (planned to migrate into `axi-soul-api`). The security package (`security/DeviceSession{StateReducer,Payload,RemoteAdapter,HttpDeviceSessionRemoteAdapter,QrEncoder}.kt`) implements the standard QR-approve flow. `core/AxiCore.kt` is the JNI loader for `libaxi_core.so`; the C++ helper (`axi_core.h` + `axi_core.cpp`) exposes `formatFeedTime(createdAt, nowStamp)` and `groupAlbumDays(createdAts, nowStamp) -> std::vector<AlbumDayOut>` for album grouping — pure date math, no domain rules. Network security is strict-by-default (`cleartextTrafficPermitted="false"`, system trust anchors only) with a debug overlay in `src/debug/res/xml/` allowing loopback / 10.0.2.2 / opt-in LAN; the M0-5 release build is HTTPS-only. `.env.example` ships an `AXI_SOUL_API_BASE_URL` placeholder for the LAN IP printed by `ifconfig` / `ipconfig getifaddr en0` (current placeholder `192.168.101.10`).

The Rust `axi-auth-helper` (`axi-auth-helper/src/main.rs`) is a single-file UDP listener — `UdpSocket::bind("0.0.0.0:18766")`, `set_broadcast(true)`, `set_read_timeout(Some(Duration::from_secs(1)))`, `MAGIC_PREFIX = "AXI-AUTH:"`; on `socket.recv_from`, validate `msg.strip_prefix(...)`, call `open_browser(url.trim())` to launch the system browser. `Cargo.toml` declares `[[bin]] name = "axi-auth" path = "src/main.rs"`, edition 2021, version 0.1.0. This helper is local convenience only — it does not implement the product QR protocol.

The mobile extension plan (`docs/architecture/mobile-extension-plan.md` v0.2) covers M0–M6. M0–M5 already landed in `dev`: M0 green step (2026-08-22) verified the LAN path via `apps/android/.env.example` and `apps/android/app/src/main/res/xml/network_security_config.xml`; M2 skeleton landed `apps/mobile-capacitor/AGENTS.md` and `apps/mobile-flutter/AGENTS.md`; M1 Decision Review (`docs/architecture/m1-mobile-stack-decision.md`) recommends Capacitor short-term + Flutter mid-term, rejects RN, declines iOS-native, and is awaiting owner sign-off. W9 / W10 / W11 implementation slices were hand-merged into `dev` on 2026-08-25 (object-store readiness/revalidation + SQLite media/profile repository + adapter/orchestrator + standard QR encoder + Activity wiring + JVM tests); their controlled-environment verification is still pending. W12 (sync worker / UI slice) stays BLOCKED with explicit prerequisites listed in `docs/architecture/w12-blocked-takeover-note.md` §3; archived quarantine/W12/W11 clean/W1 analysis sit under `archive/branch-consolidation-2026-08-25/*` tags. W9-W12 hard rules: default `sync_enabled=false`, Web `sync:write` never granted, no default libpq/object-store profile, no LAN `AuthServer` reuse for the product QR protocol.

The cross-surface invariant layer (`apps/AGENTS.md`) makes the no-second-business-authority rule apply to every `apps/<surface>` directory (including new mobile forms): Activity / ViewModel / Page / Web Component must not directly read/write SQLite / files / Provider / Database / Repository — all persistence goes through a shape-agnostic Repository interface. No surface may copy a second record/locator rule, may connect to PostgreSQL or vendor object stores directly, or grant `sync:write`. The scan flow is one-way: phone scans computer QR; computer / web-admin / mac-admin displays the product QR; the reverse direction is forbidden. The LAN `AuthServer` / `AuthWaitActivity` pair is explicitly not part of the product QR protocol.

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| PRD | Product requirements document | Done |
| BACKEND_CONTRACT / BACKEND_ARCHITECTURE_PLAN | Stable cross-runtime contract + backend architecture | Done |
| `axi-soul-api` modular skeleton | C++20 + CMake presets + DAG `domain / platform / application / infrastructure / transport → axi-soul-api` | Done |
| `axi_require_sources()` fail-closed guard | Refuse to configure when a source is missing from checkout | Done |
| `apps/web-bff/` contract slice | 8 schemas + REDIRECT.md + AJV runner + fixtures | Done |
| Web BFF v1 inlined into core (ADR-005) | Same bounded context, single consumer, no second process | Done |
| `apps/web-admin/` file:// MVP | Browser-only admin Web for W4 contract slice | Done |
| `apps/android/` Axi Mood phone client | Kotlin 1.9.23 + XML View + 19 Activities + AGP 8.2.1 + Java 17 | Done |
| `libaxi_core.so` JNI helper | `formatFeedTime` + `groupAlbumDays` for phone-only album grouping | Done |
| `axi-auth-helper` Rust UDP listener | `AXI-AUTH:` magic prefix on `0.0.0.0:18766`; opens system browser | Done |
| Mobile extension M0 (LAN green step) | Verified LAN path via `.env.example` + `network_security_config.xml` | Done (2026-08-22) |
| Mobile extension M2 skeleton | `apps/mobile-capacitor/AGENTS.md` + `apps/mobile-flutter/AGENTS.md` | Done |
| W9 / W10 / W11 implementation slices | Object-store readiness / SQLite media+profile repo / adapter+orchestrator / standard QR encoder / Activity wiring / JVM tests | Hand-merged into `dev` (2026-08-25); controlled-environment verification still pending |
| W9-W12 controlled-environment verification | Lab LAN / adb / iOS devicectl evidence | Pending |
| Mobile extension M1 Decision Review | Capacitor short-term + Flutter mid-term; rejects RN; declines iOS-native | Awaiting owner sign-off |
| W12 sync worker / UI slice | `docs/architecture/w12-blocked-takeover-note.md` §3 prerequisites | BLOCKED |
| Three-surface BFF (核心 / Web BFF / Web Admin (Mac) / mobile) | Ratified 2026-08-23 in `docs/architecture/three-surface-bff.md` | Done (backed by ADR-005 / ADR-006) |
| WeChat-style split (phone scans computer QR; phone shows no login QR) | Headline contract | Done |

## Notes

This is a local-first multi-surface product with one product core (`axi-soul-api/`,
C++20 modular) plus three coordinated surfaces: Android phone client
(`apps/android/`, Axi Mood, `com.axi.mood`), Web BFF contract slice
(`apps/web-bff/`, v1 inlined into the core per ADR-005), and admin Web
(`apps/web-admin/`, browser-only file:// MVP, later packaged as Mac shell).
The Rust `axi-auth-helper` is local UDP-broadcast convenience only — **NOT**
the business backend. Headline contract is "phone scans computer QR, computer
displays the login QR, the phone shows no login QR of its own" (微信-style split,
ratified 2026-08-23, backed by ADR-005 / ADR-006). W9 / W10 / W11 implementation
slices were hand-merged into `dev` on 2026-08-25; W12 (sync worker / UI slice)
remains BLOCKED with prerequisites listed in
`docs/architecture/w12-blocked-takeover-note.md` §3. Hard rules: default
`sync_enabled=false`, Web `sync:write` never granted, no default
libpq/object-store profile, no LAN `AuthServer` reuse for the product QR protocol.
Archived quarantine/W12/W11 clean/W1 analysis under `archive/branch-consolidation-2026-08-25/*`
must not be revived. Mobile extension M1 Decision Review recommends
Capacitor short-term + Flutter mid-term; rejects RN; declines iOS-native;
awaits owner sign-off.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md) — project boundary, W9-W12 status, mobile-extension plan 0.2 read order.
- [`README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md) + [`README.zh-CN.md`](/Volumes/code/workspace/products/axi-soul-world/README.zh-CN.md) — product entrypoint + i18n mirror.
- [`INDEX.md`](/Volumes/code/workspace/products/axi-soul-world/INDEX.md), [`MILESTONE.md`](/Volumes/code/workspace/products/axi-soul-world/MILESTONE.md), [`CHANGE.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGE.md), [`CHANGELOG.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGELOG.md) — doc / milestone / change pointers.
- [`PRD.md`](/Volumes/code/workspace/products/axi-soul-world/PRD.md) — product requirements (P0/P1/P2 slices; private journal core, todo/check-in, encrypted backup + cross-device sync).
- [`BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md) — stable contract across local runtime, remote runtime, Web BFF, and host integrations. §1.4 = multi-shape mobile access contract.
- [`BACKEND_ARCHITECTURE_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md) — long-form backend architecture.
- [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md) — staged delivery plan (P0/P1/P2).
- [`DATA_SCHEMA.md`](/Volumes/code/workspace/products/axi-soul-world/DATA_SCHEMA.md), [`TODO.md`](/Volumes/code/workspace/products/axi-soul-world/TODO.md) — schema + task ledger.
- [`incubation.json`](/Volumes/code/workspace/products/axi-soul-world/incubation.json) — records the project's prior incubation under `/Volumes/code/workspace/incubator/axi-soul-world` (kept as rollback evidence until owner retires it).
- [`apps/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/apps/AGENTS.md) — cross-surface invariants: no second business authority; shape-agnostic Repository; no direct PG / vendor object store; default `sync_enabled=false`; one-way scan flow; LAN `AuthServer` is local-unlock convenience only; no copied `ai-resource-orchestration` files; no second product repo.
- [`apps/android/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/apps/android/AGENTS.md) — Android surface boundary (MoodStore / RecordRepository, scoped to the Axi Mood surface).
- [`apps/web-bff/README.md`](/Volumes/code/workspace/products/axi-soul-world/apps/web-bff/README.md) + [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/apps/web-bff/AGENTS.md) — BFF ownership declaration (ADR-005/006).
- [`docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md) — ratified split: core / Web BFF / admin Web (Mac) / mobile.
- [`docs/architecture/mobile-extension-plan.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-extension-plan.md) — multi-surface mobile extension plan v0.2 (M0–M6 + evidence lanes + maintenance rules).
- [`docs/architecture/mobile-extension-evidence.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-extension-evidence.md) — real-device connectivity evidence (LAN / adb / iOS devicectl / SDK / W9-W12).
- [`docs/architecture/mobile-ui-audit.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-ui-audit.md) — UI / design-language audit for new mobile surfaces.
- [`docs/architecture/mobile-adapter-design.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-adapter-design.md) — module-level adapter design for new mobile surfaces.
- [`docs/architecture/m1-mobile-stack-decision.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/m1-mobile-stack-decision.md) — Capacitor short-term + Flutter mid-term; awaits owner.
- [`docs/architecture/w12-blocked-takeover-note.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/w12-blocked-takeover-note.md) — W12 prerequisites + BLOCKED state.
- [`axi-soul-api/README.md`](/Volumes/code/workspace/products/axi-soul-world/axi-soul-api/README.md) + [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/axi-soul-api/AGENTS.md) — product core boundary.
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/products/axi-soul-world/docs/project-docs.manifest.json) — doc inventory.

## Cross-References

- Workspace registration: `/Volumes/code/workspace/WORKSPACE_INDEX.md` (`products/axi-soul-world`).
- Workspace JSON: `/Volumes/code/workspace/foundation/workspace-governance/workspace.json`.
- ADR-005 (`agent-bff-ownership`): BFF inlined when same bounded context + single consumer.
- ADR-006 (`gateway-taxonomy`): gateway does not absorb product aggregation.
- Rule module: `/Volumes/code/workspace/foundation/axi-rules/INDEX.md` — AR-BOOTSTRAP-001/002/002.1/003, AR-VERIFY-001/002/003, AR-LIFECYCLE-001/002/003, AR-ROUTING-001/004/005.
- Frontend BFF guide: `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/content/zh/guide/frontend-bff.md`.
- Frontend docs (mirrored): `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/content/en/projects/axi-soul-world/README.md` (gold standard).
- Former incubation: `/Volumes/code/workspace/incubator/axi-soul-world` (retained as rollback evidence).
- Workspace scripts: `/Volumes/code/workspace/scripts/workspace-project` (handoff-check, validate, list, whereami).
