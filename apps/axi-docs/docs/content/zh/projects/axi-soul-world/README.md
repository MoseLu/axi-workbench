---
id: axi-docs-zh-projects-axi-soul-world
title: Axi Soul World
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Soul World
graph-tags: [Projects, products]
tags: [Axi Docs, 项目, products, C++20, Rust, Kotlin, multi-surface, local-first]
description: 本地优先的多端产品 —— C++20 axi-soul-api 产品核心、Kotlin/XML Android 手机客户端（Axi Mood）、Web Admin（后续打包成 Mac）、内联到核心的 Web BFF 契约，以及 Rust axi-auth-helper 本机授权。
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: core
---

# Axi Soul World

> 项目根 `AGENTS.md` + `README.md` + `PRD.md` + `BACKEND_CONTRACT.md` + `BACKEND_ARCHITECTURE_PLAN.md` + `IMPLEMENTATION_PLAN.md` + `docs/HANDOFF.md` + `docs/architecture/three-surface-bff.md` 的镜像；项目根为唯一权威。
> Source of truth:
> [`/Volumes/code/workspace/products/axi-soul-world/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md),
> [`/Volumes/code/workspace/products/axi-soul-world/README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md),
> [`/Volumes/code/workspace/products/axi-soul-world/PRD.md`](/Volumes/code/workspace/products/axi-soul-world/PRD.md),
> [`/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md),
> [`/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md),
> [`/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md),
> [`/Volumes/code/workspace/products/axi-soul-world/docs/HANDOFF.md`](/Volumes/code/workspace/products/axi-soul-world/docs/HANDOFF.md),
> [`/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md).
> Section: core / Partition: `products/`。

## 概述

Axi Soul World 是一个本地优先的多端产品，包含三个协调的端面与一个产品核心。产品核心是 `axi-soul-api/`，一个构建于 CMake 3.22 的 C++20 模块化后端，包含四个明确的层（`axi_domain` → `axi_platform` / `axi_application` / `axi_infrastructure` → `axi_transport` → `axi-soul-api`），并附带严格的依赖 DAG —— Application 层持有 `AccessContext` 与 repository/event-bus port，由 Infrastructure 层实现。Web BFF 位于 `apps/web-bff/`，是一个 contract-only slice（v1 依据 ADR-005 内联为 `axi-soul-api` 的一个模块 —— 同一有界上下文、单一消费方、无第二个进程）。Admin Web 位于 `apps/web-admin/`，仅运行在浏览器、`file://` 直供 W4 契约 slice；同一 UI 后续被打包为 Mac 壳。Android 手机客户端是 `apps/android/`（Kotlin + XML View，applicationId `com.axi.mood`，namespace `com.axi.mood`），带一个小型 C++ JNI helper `apps/android/app/src/main/cpp/axi_core` 处理仅手机端需要的格式化与相册分组 —— 它**不是**产品核心。Rust 的 `axi-auth-helper/` 是本地 UDP 广播授权 helper（绑定 `0.0.0.0:18766`，magic prefix `AXI-AUTH:`），仅本地便利，**不是**业务后端。

头条契约是 "phone scans computer QR, computer displays the login QR, the phone shows no login QR of its own"（微信风格拆分，于 2026-08-23 在 `docs/architecture/three-surface-bff.md` 中被批准，源自 ADR-005 / ADR-006）。mobile extension plan v0.2（2026-08-30）引入 M0–M6 里程碑、三条证据通道（LAN / adb / iOS devicectl），以及短期 Capacitor + 中期 Flutter 的 M1 Decision Review 仍在等待 owner 签字。W9 / W10 / W11 implementation slices 于 2026-08-25 手工合入 `dev`；W12（sync worker / UI slice）保持 **BLOCKED**，前提条件显式登记在 `docs/architecture/w12-blocked-takeover-note.md`。默认 `sync_enabled=false`，Web **不**授予 `sync:write`，LAN `AuthServer` 是本地解锁便利页（不是 QR 协议），归档的 W12 代码 slice / W11 clean variant / W1 analysis 落在 `archive/branch-consolidation-2026-08-25/*` tags 下，不得复活。

Android XML View 面是权威的手机 UI。`apps/android/app/src/main/java/com/axi/mood/` 包含 19 个 Activity（`MainActivity`、`ComposeActivity`、`CoverActivity`、`TypeFilterActivity`、`ResourceSearchActivity`、`AuthWaitActivity`、`DeviceSessionApproveActivity`、`InfoActivity`、`MediaSourceActivity`、`CheckinProjectActivity`、`SearchActivity`、`AboutActivity`、`ThemeSettingActivity`、`PhotoViewerActivity`、`ActionConfirmActivity`、`FontSettingActivity`、`AvatarActivity`、`RecordModuleActivity`）外加 `MainApplication.kt`，并组织为 `core/AxiCore.kt`（JNI loader）、`security/{DeviceSessionStateReducer, DeviceSessionPayload, DeviceSessionRemoteAdapter, HttpDeviceSessionRemoteAdapter, QrEncoder}.kt`、`auth/{AuthServer, AuthManager}.kt`、`ui/{ThemeUi, CoverHeroView, MomentsSpinnerView}.kt`，以及一个庞大的 `data/` 包，用于 repositories、prefs 与 module facades（`MoodApplicationContainer`）。Kotlin 模块接入 Android Gradle Plugin 8.2.1、Kotlin 1.9.23、kotlinx-serialization plugin、Java 17 toolchain、`minSdk 24`、`compileSdk 34`、`targetSdk 34`、`ndkVersion "26.1.10909125"`、`abiFilters "arm64-v8a"`，`externalNativeBuild.cmake` 指向 `src/main/cpp/CMakeLists.txt`。C++ JNI helper 用 `axi_core.cpp` + `axi_jni.cpp` 编译 `libaxi_core.so`，暴露 `formatFeedTime` 与 `groupAlbumDays`（用于 AlbumDayOut —— `year`、`month`、`day`、`key`、`dayLabel`、`monthLabel`、`indexes`）。

**当前阶段**：活跃产品；W9 / W10 / W11 已于 2026-08-25 手工合入 `dev`；W12 BLOCKED。
**规范路径**：`/Volumes/code/workspace/products/axi-soul-world`。
**分支**：`dev` 领先 `origin/dev` 94 个 commit。
**前孵化**：`/Volumes/code/workspace/incubator/axi-soul-world`（保留为 rollback 证据）。

## 技术栈

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

## 项目结构

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

## 构建与安装

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

## 验证

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

## 架构要点

产品核心是 `axi-soul-api/` —— 一个 C++20 模块化骨架，五个 CMake 库加一个承重的 `axi_require_sources()` 助手：它会在检出中存在缺失源文件时拒绝 configure（依据仓内政策："do not reintroduce `if(EXISTS)` or `if(FALSE)` to hide missing sources or tests"）。DAG 是 `axi_domain → axi_platform → {axi_application, axi_infrastructure} → axi_transport → axi-soul-api`；Application 持有 `AccessContext` 与 repository/event-bus port；Infrastructure 实现它们。Application 服务覆盖 `device_session_service`、`records_service`、`todos_service`、`checkin_service`、`media_service`、`exports_service`、`audit_service`、`identity_service`、`sync_service` 与 `sync_worker`；`error_envelope` 模块通过 `domain::http_status(code)` 把类型化的 `domain::ErrorCode` 归一化为 HTTP status。Domain 模块是纯类型 + 工厂（`record_kind_from_string` / `record_kind_to_string` 是 `domain/record.cpp` 中仅有的叙述代码，映射 `RecordKind::diary|memo|todo|checkin`）。Transport（`transport/http_api.cpp`）用 `authenticate(incoming, bag_.device_session)` 与 `dispatch(incoming, access, health_, bag_)` 把 `ApiServer(platform::AppConfig, application::HealthQuery, ServiceBag)` 接起来；transport 子模块：`auth_middleware`、`error_mapper`、`json_projection`、`request_parser`、`resource_search_{adapter,catalog,gateway,handler}`、`route_registry`。可选的 Drogon transport（`AXI_SOUL_WITH_DROGON=ON`）默认关闭；Conan `conanfile.txt` 申请 `drogon/1.9.10` 与 `gtest/1.15.2`，`drogon/*:with_postgres=False`、`drogon/*:with_redis=False`。五个 CMake preset 覆盖 macOS arm64（debug/release/asan，携带 `-fsanitize=address,undefined -fno-omit-frame-pointer`）、Linux x64 GCC debug、Windows x64 MSVC debug。

Web BFF 是 `apps/web-bff/contracts/`（8 个 schema + REDIRECT.md）下的 contract-only slice。v1 依据 ADR-005（同一有界上下文、单一消费方）内联为 `axi-soul-api` 的一个模块。Schema 层列举 v1 scope 集合：`records:read`、`records:write`、`devices:read`、`devices:revoke`、`exports:read`、`exports:create` —— `sync:write` **刻意缺席**，因为 sync 是显式的 Android-only 动作，永不授予 Web token。`apps/web-bff/fixtures/` 覆盖 `qr-{create,exchange,approved,expired,invalid-state,revoked,scope-mismatch}.json`、`sync-{status,apply-success,apply-conflict,changes}.json`，以及 `devices-list.json`、`export-job.json`、`resource-search-{catalog,empty}.json`。测试由 AJV 驱动（`apps/web-bff/tests/{ajv,lint-fixtures,run}.mjs`）。Admin Web MVP（`apps/web-admin/`）是一个仅 `file://` 的浏览器构建，从 `axi_tokens.xml` 自动生成 `--axi-*` 别名 token（M2-8 阶段轻脚手架）；源码模块覆盖 `qr-{api-client,contract-double,page,page-config,state-machine}.mjs`、`resource-search-{page,engine,bff}.mjs`、`sync-status-page.mjs`。浏览器既不持有 storage，也不直接调用 `/v1` —— 它消费 BFF。

Android 面（`apps/android/`）是 Kotlin + XML View 工程，构建在 AGP 8.2.1 / Kotlin 1.9.23 / Java 17 上，`applicationId = namespace = "com.axi.mood"`。19 个 Activity 覆盖 diary、todo、check-in、moments/cover、photo viewer、font/theme 设置、info/about，外加两个 scan-to-approve Activity（`DeviceSessionApproveActivity`、`AuthWaitActivity`）和本地解锁便利对（`auth/` 下的 `AuthServer` / `AuthManager`）。Activity 面**不得**成为第二个业务数据权威 —— 所有持久化都通过 `MoodStore` / `RecordRepository`（计划迁移到 `axi-soul-api`）。security 包（`security/DeviceSession{StateReducer,Payload,RemoteAdapter,HttpDeviceSessionRemoteAdapter,QrEncoder}.kt`）实现标准 QR-approve 流程。`core/AxiCore.kt` 是 `libaxi_core.so` 的 JNI loader；C++ helper（`axi_core.h` + `axi_core.cpp`）暴露 `formatFeedTime(createdAt, nowStamp)` 与 `groupAlbumDays(createdAts, nowStamp) -> std::vector<AlbumDayOut>`，仅做日期数学、没有 domain 规则。Network security 严格默认（`cleartextTrafficPermitted="false"`，仅系统信任锚），`src/debug/res/xml/` 下的 debug overlay 允许 loopback / 10.0.2.2 / 可选 LAN；M0-5 release build 仅 HTTPS。`.env.example` 提供 `AXI_SOUL_API_BASE_URL` 占位（LAN IP 由 `ifconfig` / `ipconfig getifaddr en0` 打印；当前占位 `192.168.101.10`）。

Rust `axi-auth-helper`（`axi-auth-helper/src/main.rs`）是一个单文件 UDP listener —— `UdpSocket::bind("0.0.0.0:18766")`、`set_broadcast(true)`、`set_read_timeout(Some(Duration::from_secs(1)))`、`MAGIC_PREFIX = "AXI-AUTH:"`；在 `socket.recv_from` 时校验 `msg.strip_prefix(...)`，调用 `open_browser(url.trim())` 启动系统浏览器。`Cargo.toml` 声明 `[[bin]] name = "axi-auth" path = "src/main.rs"`，edition 2021，version 0.1.0。此 helper 仅供本地便利 —— 它**不是**产品 QR 协议。

Mobile extension plan（`docs/architecture/mobile-extension-plan.md` v0.2）覆盖 M0–M6。M0–M5 已落地 `dev`：M0 green step（2026-08-22）通过 `apps/android/.env.example` 与 `apps/android/app/src/main/res/xml/network_security_config.xml` 验证 LAN 路径；M2 skeleton 落地 `apps/mobile-capacitor/AGENTS.md` 与 `apps/mobile-flutter/AGENTS.md`；M1 Decision Review（`docs/architecture/m1-mobile-stack-decision.md`）建议短期 Capacitor + 中期 Flutter、拒绝 RN、不选 iOS-native，等待 owner 签字。W9 / W10 / W11 implementation slices 已于 2026-08-25 手工合入 `dev`（object-store readiness/revalidation + SQLite media/profile repository + adapter/orchestrator + 标准 QR encoder + Activity 接线 + JVM tests）；其 controlled-environment verification 仍在 pending。W12（sync worker / UI slice）保持 **BLOCKED**，前提条件列于 `docs/architecture/w12-blocked-takeover-note.md` §3；归档的 quarantine/W12/W11 clean/W1 analysis 落在 `archive/branch-consolidation-2026-08-25/*` tags 下。W9-W12 硬规则：默认 `sync_enabled=false`，Web 永不授予 `sync:write`，不设默认 libpq/object-store profile，LAN `AuthServer` 不复用于产品 QR 协议。

跨面不变式层（`apps/AGENTS.md`）让 "no-second-business-authority" 规则适用于每一个 `apps/<surface>` 目录（含新增 mobile form）：Activity / ViewModel / Page / Web Component 不得直接读 / 写 SQLite / files / Provider / Database / Repository —— 所有持久化走 shape-agnostic Repository interface。任何 surface 都不得复制第二条 record/locator 规则、不得直连 PostgreSQL 或厂商 object store、不得授予 `sync:write`。扫码流是单向的：手机扫电脑 QR；电脑 / web-admin / mac-admin 展示产品 QR；反向禁止。LAN `AuthServer` / `AuthWaitActivity` 对显式不属于产品 QR 协议。

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| PRD | 产品需求文档 | 完成 |
| BACKEND_CONTRACT / BACKEND_ARCHITECTURE_PLAN | 跨运行时稳定契约 + 后端架构 | 完成 |
| `axi-soul-api` modular skeleton | C++20 + CMake presets + DAG `domain / platform / application / infrastructure / transport → axi-soul-api` | 完成 |
| `axi_require_sources()` fail-closed guard | 检出中存在缺失源时拒绝 configure | 完成 |
| `apps/web-bff/` contract slice | 8 schemas + REDIRECT.md + AJV runner + fixtures | 完成 |
| Web BFF v1 内联到核心（ADR-005） | 同一有界上下文、单一消费方、无第二个进程 | 完成 |
| `apps/web-admin/` file:// MVP | 仅浏览器 admin Web，承载 W4 契约 slice | 完成 |
| `apps/android/` Axi Mood 手机客户端 | Kotlin 1.9.23 + XML View + 19 Activities + AGP 8.2.1 + Java 17 | 完成 |
| `libaxi_core.so` JNI helper | `formatFeedTime` + `groupAlbumDays`，仅手机端相册分组 | 完成 |
| `axi-auth-helper` Rust UDP listener | `AXI-AUTH:` magic prefix，监听 `0.0.0.0:18766`；启动系统浏览器 | 完成 |
| Mobile extension M0（LAN green step） | 通过 `.env.example` + `network_security_config.xml` 验证 LAN 路径 | 完成（2026-08-22） |
| Mobile extension M2 skeleton | `apps/mobile-capacitor/AGENTS.md` + `apps/mobile-flutter/AGENTS.md` | 完成 |
| W9 / W10 / W11 implementation slices | object-store readiness / SQLite media+profile repo / adapter+orchestrator / 标准 QR encoder / Activity 接线 / JVM tests | 已手工合入 `dev`（2026-08-25）；controlled-environment verification 仍 pending |
| W9-W12 controlled-environment verification | 实验室 LAN / adb / iOS devicectl 证据 | 待办 |
| Mobile extension M1 Decision Review | 短期 Capacitor + 中期 Flutter；拒绝 RN；不选 iOS-native | 等待 owner 签字 |
| W12 sync worker / UI slice | `docs/architecture/w12-blocked-takeover-note.md` §3 前提条件 | BLOCKED |
| 三端 BFF（核心 / Web BFF / Web Admin（Mac）/ mobile） | 2026-08-23 在 `docs/architecture/three-surface-bff.md` 中被批准 | 完成（依据 ADR-005 / ADR-006） |
| 微信风格拆分（手机扫电脑 QR；手机端不展示登录 QR） | 头条契约 | 完成 |

## 说明

这是一个本地优先的多端产品，包含一个产品核心（`axi-soul-api/`，C++20 modular）
外加三个协调的端面：Android 手机客户端（`apps/android/`，Axi Mood，
`com.axi.mood`）、Web BFF 契约 slice（`apps/web-bff/`，v1 依据 ADR-005 内联到核心）、
admin Web（`apps/web-admin/`，仅浏览器 file:// MVP，后续打包成 Mac 壳）。Rust
`axi-auth-helper` 仅是本地 UDP 广播便利，**不是**业务后端。头条契约是 "phone
scans computer QR, computer displays the login QR, the phone shows no login
QR of its own"（微信风格拆分，2026-08-23 批准，依据 ADR-005 / ADR-006）。
W9 / W10 / W11 implementation slices 已于 2026-08-25 手工合入 `dev`；W12
（sync worker / UI slice）保持 **BLOCKED**，前提条件列于
`docs/architecture/w12-blocked-takeover-note.md` §3。硬规则：默认
`sync_enabled=false`，Web 永不授予 `sync:write`，不设默认 libpq/object-store
profile，LAN `AuthServer` 不复用于产品 QR 协议。归档的 quarantine/W12/W11
clean/W1 analysis 落在 `archive/branch-consolidation-2026-08-25/*` tags 下，
不得复活。Mobile extension M1 Decision Review 推荐短期 Capacitor + 中期
Flutter；拒绝 RN；不选 iOS-native；等待 owner 签字。

## 权威文档

- [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md) — 项目边界、W9-W12 状态、mobile-extension plan 0.2 读序。
- [`README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md) + [`README.zh-CN.md`](/Volumes/code/workspace/products/axi-soul-world/README.zh-CN.md) — 产品入口 + i18n 镜像。
- [`INDEX.md`](/Volumes/code/workspace/products/axi-soul-world/INDEX.md)、[`MILESTONE.md`](/Volumes/code/workspace/products/axi-soul-world/MILESTONE.md)、[`CHANGE.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGE.md)、[`CHANGELOG.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGELOG.md) — 文档 / 里程碑 / 变更指针。
- [`PRD.md`](/Volumes/code/workspace/products/axi-soul-world/PRD.md) — 产品需求（P0/P1/P2 切片；私密日记核心、todo/check-in、加密备份 + 跨设备同步）。
- [`BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md) — 跨本地运行时、远程运行时、Web BFF 与宿主集成的稳定契约。§1.4 = multi-shape mobile access contract。
- [`BACKEND_ARCHITECTURE_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md) — 长篇后端架构。
- [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md) — 分阶段交付计划（P0/P1/P2）。
- [`DATA_SCHEMA.md`](/Volumes/code/workspace/products/axi-soul-world/DATA_SCHEMA.md)、[`TODO.md`](/Volumes/code/workspace/products/axi-soul-world/TODO.md) — schema + 任务账本。
- [`incubation.json`](/Volumes/code/workspace/products/axi-soul-world/incubation.json) — 记录项目此前在 `/Volumes/code/workspace/incubator/axi-soul-world` 的孵化（保留为 rollback 证据，直至 owner 退役）。
- [`apps/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/apps/AGENTS.md) — 跨面不变式：无第二个业务权威；shape-agnostic Repository；不直连 PG / 厂商 object store；默认 `sync_enabled=false`；单向扫码流；LAN `AuthServer` 仅本地解锁便利；不复用 `ai-resource-orchestration` 文件；不复制第二个产品仓库。
- [`apps/android/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/apps/android/AGENTS.md) — Android 面边界（MoodStore / RecordRepository，限定 Axi Mood 面）。
- [`apps/web-bff/README.md`](/Volumes/code/workspace/products/axi-soul-world/apps/web-bff/README.md) + [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/apps/web-bff/AGENTS.md) — BFF 所有权声明（ADR-005/006）。
- [`docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md) — 批准拆分：核心 / Web BFF / admin Web（Mac）/ mobile。
- [`docs/architecture/mobile-extension-plan.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-extension-plan.md) — 多端 mobile extension plan v0.2（M0–M6 + 证据通道 + 维护规则）。
- [`docs/architecture/mobile-extension-evidence.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-extension-evidence.md) — 真机连通性证据（LAN / adb / iOS devicectl / SDK / W9-W12）。
- [`docs/architecture/mobile-ui-audit.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-ui-audit.md) — 新 mobile 面的 UI / 设计语言审计。
- [`docs/architecture/mobile-adapter-design.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/mobile-adapter-design.md) — 新 mobile 面的模块级 adapter 设计。
- [`docs/architecture/m1-mobile-stack-decision.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/m1-mobile-stack-decision.md) — 短期 Capacitor + 中期 Flutter；等待 owner。
- [`docs/architecture/w12-blocked-takeover-note.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/w12-blocked-takeover-note.md) — W12 前提条件 + BLOCKED 状态。
- [`axi-soul-api/README.md`](/Volumes/code/workspace/products/axi-soul-world/axi-soul-api/README.md) + [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/axi-soul-api/AGENTS.md) — 产品核心边界。
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/products/axi-soul-world/docs/project-docs.manifest.json) — 文档清单。

## 交叉引用

- Workspace registration: `/Volumes/code/workspace/WORKSPACE_INDEX.md` (`products/axi-soul-world`)。
- Workspace JSON: `/Volumes/code/workspace/foundation/workspace-governance/workspace.json`。
- ADR-005 (`agent-bff-ownership`)：同一有界上下文 + 单一消费方时 BFF 内联。
- ADR-006 (`gateway-taxonomy`)：gateway 不吸收产品聚合。
- Rule module: `/Volumes/code/workspace/foundation/axi-rules/INDEX.md` —— AR-BOOTSTRAP-001/002/002.1/003、AR-VERIFY-001/002/003、AR-LIFECYCLE-001/002/003、AR-ROUTING-001/004/005。
- Frontend BFF guide: `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/content/zh/guide/frontend-bff.md`。
- Frontend docs (mirrored): `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/content/en/projects/axi-soul-world/README.md` (gold standard)。
- 前孵化: `/Volumes/code/workspace/incubator/axi-soul-world`（保留为 rollback 证据）。
- Workspace scripts: `/Volumes/code/workspace/scripts/workspace-project` (handoff-check, validate, list, whereami)。
