---
id: axi-docs-en-projects-axi-notify
title: Axi Notify
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Notify
graph-tags: [Projects, notify]
tags: [Axi Docs, Projects, notify, fcm, relay, android]
description: Three-in-one MVP monorepo: workflow contracts + Axi Mobile Android Compose client + Go Relay server providing the minimal cloud-event → FCM → real-device notification loop, with capability providers mobile-event-inbox, android-agent-notification-client, and mobile-workbench.
project:
  id: axi-notify
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-notify
  source-section: core
---

# Axi Notify

> Mirror of the project root `README.md` + `AGENTS.md` + `docs/state/PRD.md` + `INDEX.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-notify/README.md`](/Volumes/code/workspace/foundation/axi-notify/README.md),
> [`/Volumes/code/workspace/foundation/axi-notify/AGENTS.md`](/Volumes/code/workspace/foundation/axi-notify/AGENTS.md),
> [`/Volumes/code/workspace/foundation/axi-notify/INDEX.md`](/Volumes/code/workspace/foundation/axi-notify/INDEX.md),
> [`/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md).
> Section: core / Partition: `foundation/`.

## Summary

Axi Notify is a **three-in-one** MVP monorepo (`AGENTS.md` Project Boundary, `README.md`):
(1) **`docs/workflows/`** — workflow contracts (HTTP, session, OpenAPI, design tokens,
ADR, E2E smoke runbook, NF-* flow specs); (2) **`android-app/`** — Kotlin + Jetpack
Compose + Firebase Messaging Android client (package name **`com.mosscoder.notify`**);
(3) **`relay-server/`** — Go + SQLite + Firebase Admin relay service exposing
`/healthz`, `/v1/devices`, `/v1/events`, `/v1/bundles/*`. The minimal closed loop is
**云端事件 → Relay → FCM → 真机通知** ("cloud event → Relay → FCM → real-device
notification"). The repo is owned by Axi Spun-out Products (per `docs/state/PRD.md` §1)
under the product line `AxiomaticWorld.com`.

The package name `com.mosscoder.notify` is currently hardcoded across `android-app/app/build.gradle.kts`
namespace + applicationId, all `android-app/app/src/main/java/com/mosscoder/notify/`
sources, and Firebase `google-services.json`. Per `AGENTS.md` Project Boundary,
migrating to `com.axi.notify` requires extensive refactoring and **must** be reviewed by
a human before execution. Per `docs/state/PRD.md` §1.1: the project is **not** a
general-purpose IM / push platform; it is a workflow-contract + Compose client + Go
relay, owner-private cloud deployment + Android Debug/Release dual track; **not** a
public SaaS / cross-cloud multi-tenant.

Per `docs/workflows/agent_design_path_test.md` §"Expected provides", this project
provides the workspace-graph capabilities `relay-server`, `workflow-contracts`,
`mobile-event-inbox`, `android-agent-notification-client`, `mobile-workbench`; it
consumes `axi-workbench` (for `mobile-workbench` integration) and `axi-agent` (event
semantics). Recent commits (per `docs/state/CHANGELOG.md` + git log) added a Prometheus
`/metrics` endpoint + request counter to the relay; added `todo` event type + PayloadTodo
(`title`/`body`/`status: open|done|blocked`, optional `collapseKey`); expanded the
Android side with `InboxPresentation`/`InboxRichText`, a WeChat-style information shell,
project intelligence with workbench pairing, Keystore-encrypted device keys, nonce/token
refresh, project projection repository, and Room v6 non-destructive migration; recorded
real-device evidence on Xiaomi M2012K10C for `project-intelligence-20260729-1432`,
`-polish-20260729-1505`, and `-wechat-20260729-1530`.

**Stage**: live MVP, default branch `dev` (GitHub default already points to `dev`).
**Canonical path**: `/Volumes/code/workspace/foundation/axi-notify`.
**Branch at audit**: `dev` tracking `origin/dev`; one pending untracked file
`docs/logs/submit/20260930-082807-auto-submit.md`.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Workflow contracts | OpenAPI 3.1 (`events.openapi.yaml`, `bundles.openapi.yaml`); JSON Schema Draft 2020-12 (`events.schema.json` `$id: axi.local/schemas/notify-event-envelope.json`); design tokens (`design_tokens.json` — 深海军蓝 / 青蓝主光 / 紫辅光); ADRs; NF-* flow specs | `docs/workflows/` is the SINGLE authoritative contract source |
| Relay server (`relay-server/`) | Go + Firebase Admin SDK + SQLite (`golang.org/x/time/rate`); `slog` JSON handler | `main.go` env: `AXI_NOTIFY_API_KEY` (preferred, falls back to `MOSS_RELAY_API_KEY`); `AXI_NOTIFY_LISTEN` (default `:8080`); `AXI_NOTIFY_DB` (default `file:relay.sqlite?_pragma=busy_timeout(5000)&_fk=1`); `GOOGLE_APPLICATION_CREDENTIALS`; `AXI_NOTIFY_NO_FIREBASE=1` (or legacy `MOSS_RELAY_NO_FIREBASE=1`) for local smoke; `AXI_NOTIFY_EVENT_RETENTION_DAYS`; rate limit 25 rps / burst 50 |
| Relay HTTP API | `/healthz` GET; `/v1/devices` PUT (FCM token register); `/v1/events` POST/GET (idempotent ingest); `/v1/bundles/manifest` GET + bundle artifact GET | Auth Header: `X-Axi-Notify-Api-Key` (preferred); legacy `X-Mosscoder-Api-Key` retained (ADR-0001) |
| Relay metrics | Prometheus `/metrics` endpoint + request counter (`requestsTotal atomic.Uint64`) | Recent commit `49a05b8 feat(metrics): add Prometheus /metrics endpoint + request counter` |
| Android app (`android-app/`) | Kotlin 2.0.21 + Jetpack Compose + Firebase Messaging 4.4.2; KSP 2.0.21-1.0.25; AGP 8.7.2; `compileSdk=35`, `targetSdk=35`, `minSdk=26`, `buildToolsVersion="35.0.0"`, `ndkVersion="27.0.12077973"`; Java 17 | `android-app/build.gradle.kts` (root) + `android-app/app/build.gradle.kts` (module); `namespace="com.mosscoder.notify"`, `applicationId="com.mosscoder.notify"`, `versionCode=1`, `versionName="0.1.0-mvp"` |
| React Native dynamic bundles | `react-native@0.78.3`, `react@^19.0.0`, `@shopify/react-native-skia@^2.6.2`, `react-native-reanimated@^3.19.5`; Hermes enabled | `android-app/package.json`; bundles loaded via `MossReactNativeHost` (prefers `filesDir/bundles/active.android.bundle`, falls back to `assets/rn/preset/index.android.bundle`); component name **`MossHome`** |
| Room v6 | Non-destructive migration; `InboxDao`, `WorkspaceDao`, `WorkspaceProjectEntity`, `WorkbenchJobEntity`, `WorkbenchAgentRunEntity`, `WorkbenchStageEventEntity`, `WorkbenchWorkflowIngest`, `WorkbenchSessionStatus`, `SessionStateEntity`, `InboxEventEntity`, `AppDatabase` | `android-app/app/src/main/java/com/mosscoder/notify/data/local/` |
| Secure device store | Keystore-encrypted device keys + nonce/token refresh | `android-app/app/src/main/java/com/mosscoder/notify/data/security/SecureDeviceStore.kt` |
| Data plane | `RelayClient.kt`, `ControlPlaneClient.kt`, `BundleRepository.kt`, `WorkspaceRepository.kt`, `WorkspaceModels.kt`, `WorkspaceDebugFixture.kt` | `android-app/app/src/main/java/com/mosscoder/notify/data/{remote,bundle,workspace}/` |
| Compose shell + theming | `ui/MossRoot.kt`, `ui/components/MossTopBars.kt`, `MossGlobalDrawer.kt`, `MossBottomNavBar.kt`, `MossBottomNavItemSpec.kt`, `MossUnreadDot`, `theme/MossTokens.kt` + `Theme.kt`; `sys/BadgeChannelSettings.kt`, `MiuiLauncherBadgeDispatch.kt`, `MossUnreadShortcut.kt`; `fcm/MossFirebaseMessagingService.kt` | `android-app/app/src/main/java/com/mosscoder/notify/` |
| Badge / desktop unread | `mosscoder_badge_v2` channel (`IMPORTANCE_DEFAULT` + `setSilent(true)` + `setNumber`) + `BadgeNotifier.kt`; no float-window permission | Android 13+ requires `POST_NOTIFICATIONS` granted; `ShortcutBadger.isBadgeCounterSupported == false` on tested HyperOS / MIUI Redmi |
| ADB verification scripts | `scripts/adb-bootstrap-relay.sh`, `adb-dump-moss-notifications.sh`, `adb-goal70-e2e.sh`, `adb-rewrite-inbox-titles.sh`, `adb-seed-badge-unread.sh`, `adb-verify-moss-badge-screenshots.sh`, `android-agent-verify.sh` | All consume `extra_bootstrap_*` extras from Debug builds |
| Smoke scripts | `scripts/smoke-relay-local.sh` (random port + temp SQLite), `scripts/smoke-relay-remote.sh`, `scripts/send-relay-agent-message.sh`, `scripts/codex-notify-to-relay.sh`, `scripts/codex-notify-with-relay.sh` | Auth Header via `~/credentials/axi-notify.env` |
| Credentials injection | `~/credentials/axi-notify.env` + `~/credentials/load-credentials.sh`; relay-server/main.go `getenvFirst` / `getenvIntFirst` resolve legacy + new env names | Real `google-services.json` overrides stub locally; never committed |
| Donors | `donors/android-workspace-app/` (BRANCH_STRATEGY / JENKINS_CICD / QUICK_DEPLOY / SERVER_DEPLOYMENT / Jenkinsfile etc., **NOT** first-class project code per `agent_design_path_test.md`); `donors/feiyu-agentflow/` (agentflow backend + app + api) | External reference; repo does not maintain |
| `ultragoal/` | MEITUAN_ADB_UI_OBSERVATION.md + meituan screenshot/dump | External reference |
| Tooling | Makefile (`test-relay`, `smoke-relay-local`, `smoke-relay-remote`, `send-agent-message`, `run-relay-local`, `android-local-props`, `android-debug`, `android-lint`, `android-agent-verify`, `adb-bootstrap-relay`, `adb-goal70-e2e`); Gradle; pnpm `10.33.2`; 7890 Clash proxy via `with-local-proxy.sh` / `go-relay.sh` / `gradle-android.sh` |  |

## Project Layout

```text
axi-notify/
├── android-app/                                  # Kotlin + Compose + FCM Android client (com.mosscoder.notify)
│   ├── app/
│   │   ├── build.gradle.kts                      # AGP module config (namespace, applicationId, versionName "0.1.0-mvp")
│   │   ├── google-services.json                  # STUB in repo; real one overrides locally (NOT in VCS)
│   │   ├── proguard-rules.pro
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── assets/rn/preset/index.android.bundle  # RN preset bundle (committed; built via react-native bundle)
│   │       ├── res/                              # M3 + MossTokens theme; strings.xml (收件箱/待办/导航 related)
│   │       │   └── values/strings.xml
│   │       ├── drawable/ic_stat_notify.xml       # Status-bar small icon
│   │       └── java/com/mosscoder/notify/
│   │           ├── AppGraph.kt
│   │           ├── BadgeNotifier.kt              # mosscoder_badge_v2 channel
│   │           ├── MainActivity.kt               # Entry + intent bootstrap (sessionId/deepLink/seed/agent/todo/workspace/controlPlane)
│   │           ├── MossApplication.kt
│   │           ├── NotificationChannels.kt
│   │           ├── UserPreferences.kt
│   │           ├── data/
│   │           │   ├── bundle/BundleRepository.kt
│   │           │   ├── local/{AppDatabase, InboxDao, InboxEventEntity, SessionStateEntity, WorkbenchAgentRunEntity, WorkbenchJobEntity, WorkbenchSessionStatus, WorkbenchStageEventEntity, WorkbenchWorkflowIngest, WorkspaceDao, WorkspaceProjectEntity}.kt
│   │           │   ├── remote/{ControlPlaneClient, RelayClient}.kt
│   │           │   ├── security/SecureDeviceStore.kt
│   │           │   └── workspace/{WorkspaceDebugFixture, WorkspaceModels, WorkspaceRepository}.kt
│   │           ├── fcm/MossFirebaseMessagingService.kt
│   │           ├── feature/
│   │           │   ├── home/{HomeInboxRouteScreen, HomeScreen, HomeSearchRouteScreen}.kt
│   │           │   ├── homeshell/{HomeShellScreen, WorkbenchJobDetailScreen}.kt
│   │           │   ├── inbox/{InboxPresentation, InboxRichText}.kt
│   │           │   ├── mine/MineScreen.kt
│   │           │   ├── navigation/Routes.kt
│   │           │   ├── session/SessionDetailScreen.kt
│   │           │   ├── settings/SettingsScreen.kt
│   │           │   └── workspace/{WorkspaceComponents, WorkspaceScreens}.kt
│   │           ├── rn/{MossNativeModule, MossNativePackage, MossReactNativeHost}.kt
│   │           ├── sys/{BadgeChannelSettings, MiuiLauncherBadgeDispatch, MossUnreadShortcut}.kt
│   │           └── ui/
│   │               ├── MossBottomNavBar.kt
│   │               ├── MossBottomNavItemSpec.kt
│   │               ├── MossRoot.kt
│   │               ├── components/{MossTopBars, MossGlobalDrawer, MossUnreadDot}.kt
│   │               ├── shell/
│   │               └── theme/{MossTokens, Theme}.kt
│   ├── build.gradle.kts                          # Root AGP/Kotlin/Compose/KSP/Google Services plugins; compileSdk=35
│   ├── settings.gradle.kts
│   ├── gradle.properties                          # systemProp.*proxy* → 127.0.0.1:7890
│   ├── gradle/, gradlew, gradlew.bat
│   ├── babel.config.js, metro.config.js
│   ├── package.json                               # axi-mobile v0.0.1, RN 0.78.3, Skia 2.6.2, Reanimated 3.19.5; `bundle-android` script
│   ├── js/index.js                                # RN entry; must register `MossHome`
│   ├── metadata/mosscoder_launcher_source.png     # Launcher source icon
│   ├── local.properties.example                  # moss.relay.baseUrl template
│   ├── docs/
│   │   ├── ARCHITECTURE_HOST_AND_PACKAGES.md      # Host vs dynamic RN bundle classification
│   │   ├── RN_AND_BUNDLES.md                      # RN bundle manifest + SHA-256 + rollback
│   │   └── verification/                          # Real-device screenshots + dumps (project-intelligence-20260729-1432, -polish-20260729-1505, -wechat-20260729-1530, goal70-20260525-*, adb_*)
│   └── AGENTS.md
├── relay-server/                                  # Go + Firebase Admin + SQLite relay
│   ├── main.go                                    # env loader (AXI_NOTIFY_API_KEY / MOSS_RELAY_API_KEY, LISTEN, DB, NO_FIREBASE, EVENT_RETENTION_DAYS, LOG_LEVEL); NewHTTPServer + signal shutdown
│   ├── go.mod, go.sum
│   ├── deploy/{Dockerfile, README.md}             # Cloud deployment
│   └── internal/
│       ├── relay/{event.go, event_test.go, bundle_manifest.go}        # EventEnvelope.Validate (idempotencyKey ≥8 / workspaceId / sessionId / actor: human|agent|system / type: ping|agent.message|human.message|todo|workflow.job.{accepted,event,completed,failed}); validatePing / validateMessage / validateTodo / validateWorkflowJob; BuildFCMData
│       ├── server/{server.go, events_test.go, bundle_manifest_test.go}  # mux + withAuth + withRateLimit + handlePostEvents; sendFCM (Send for 1 token, SendEachForMulticast for >1)
│       └── store/{sqlite.go, sqlite_test.go}      # store.Open + TryConsumeIdempotency + SaveEvent + ListFCMTokensForEvent + pruneExpiredEvents
├── docs/
│   ├── workflows/                                 # SINGLE AUTHORITATIVE contract surface
│   │   ├── README.md                              # Main index + common 7-field contract + naming (NF-<STAGE>-NNN)
│   │   ├── NF-EVT-001.md                          # POST /v1/events → SQLite → FCM → device ack
│   │   ├── NF-BUNDLE-001.md                       # GET /v1/bundles/manifest → device diff pull
│   │   ├── NF-AUTH-001.md                         # withAuth middleware + Key pass/fail/expired
│   │   ├── events.openapi.yaml                    # OpenAPI 3.1 for /v1/devices, /v1/events, schemas
│   │   ├── bundles.openapi.yaml                   # OpenAPI 3.1 for bundle manifest + artifact endpoints
│   │   ├── events.schema.json                     # JSON Schema (Draft 2020-12) for EventEnvelope
│   │   ├── session_contract.md                    # workspaceId / projectId / sessionId / actor / idempotencyKey required
│   │   ├── design_tokens.json                     # Compose theme single source (深海军蓝 / 青蓝主光 / 紫辅光)
│   │   ├── design_control_workflow.md             # Visual tokens → Theme mapping → atomic components → Screen
│   │   ├── adr-0001-security-api-key.md           # ADR: API Key + TLS + dual Header compat (X-Axi-Notify-Api-Key preferred, X-Mosscoder-Api-Key legacy)
│   │   ├── codex_hook_example.md                  # curl examples for ping / agent.message / human.message / todo
│   │   ├── e2e_smoke_runbook.md                   # Local + cloud Relay real-device push verification
│   │   └── agent_design_path_test.md              # Zero-context agent perception path test (pass/fail criteria + scoring)
│   ├── state/{PRD.md, TODO.md, MILESTONE.md, TDD.md, CHANGELOG.md}
│   ├── governance/SECURITY.md
│   ├── logs/                                      # Runtime log landing zone (NOT in VCS)
│   ├── HANDOFF.md, TESTING.md, VERIFICATION.md
│   └── project-docs.manifest.json
├── config/
│   ├── README.md + README.en.md
│   ├── axi-notify.env.example                     # Template only (real creds → ~/credentials/axi-notify.env)
│   └── mosscoder.env.example                      # Legacy compat template
├── scripts/
│   ├── adb-bootstrap-relay.sh                     # adb install -r + am start --es extra_bootstrap_* (Debug only)
│   ├── adb-dump-moss-notifications.sh
│   ├── adb-goal70-e2e.sh                          # 通知 → 点击深链 → inbox → 截图
│   ├── adb-rewrite-inbox-titles.sh
│   ├── adb-seed-badge-unread.sh
│   ├── adb-verify-moss-badge-screenshots.sh       # Badger channel screenshots + dumpsys
│   ├── android-agent-verify.sh                    # assembleDebug + adb install + cold start + uiautomator dump
│   ├── codex-notify-to-relay.sh                   # Codex hook → Relay
│   ├── codex-notify-with-relay.sh
│   ├── go-relay.sh                                # `go test ./...` via 7890 proxy
│   ├── gradle-android.sh                          # :app:assembleDebug / :app:lint via 7890 proxy
│   ├── ollama-title-summary.py
│   ├── perf-goal-ui-evaluator.sh
│   ├── rewrite-inbox-titles.py
│   ├── send-relay-agent-message.sh                # MOSS_RELAY_AGENT_MSG_BODY or args/stdin
│   ├── smoke-relay-local.sh                       # random port + temp SQLite
│   ├── smoke-relay-remote.sh
│   ├── with-local-proxy.sh                        # 7890 Clash wrapper
│   └── write-android-local-properties.sh          # Moss Relay URL → android-app/local.properties
├── donors/                                        # EXTERNAL — repo does NOT maintain
│   ├── android-workspace-app/                     # BRANCH_STRATEGY / JENKINS_CICD / QUICK_DEPLOY / SERVER_DEPLOYMENT (HIGH RISK: personal IP / private keys, NOT for commit/document raw form)
│   └── feiyu-agentflow/                           # agentflow-backend + api + app
├── ultragoal/                                     # MEITUAN_ADB_UI_OBSERVATION.md + screenshots (external)
├── Makefile                                       # test-relay / smoke-relay-local / smoke-relay-remote / send-agent-message / run-relay-local / android-local-props / android-debug / android-lint / android-agent-verify / adb-bootstrap-relay / adb-goal70-e2e
├── README.md, README.en.md, README.zh-CN.md
├── AGENTS.md (中文权威) + AGENTS.en.md (英文镜像)
├── CHANGELOG.md (root pointer → docs/state/CHANGELOG.md)
├── CHANGE.md
├── LICENSE, TODO.md, MILESTONE.md, TDD.md, INDEX.md, SECURITY.md
```

## Build & Install

```bash
# Relay server — quick local start (no Firebase, random port)
cd relay-server
export MOSS_RELAY_API_KEY="dev-only-key"
export AXI_NOTIFY_API_KEY="$MOSS_RELAY_API_KEY"
export MOSS_RELAY_NO_FIREBASE=1
unset GOOGLE_APPLICATION_CREDENTIALS
../scripts/with-local-proxy.sh go run .

# Relay unit tests
make test-relay                       # scripts/go-relay.sh test ./...

# Local Relay smoke (random port + temp DB)
make smoke-relay-local                # scripts/smoke-relay-local.sh

# Remote Relay smoke (must `source ~/credentials/axi-notify.env`)
make smoke-relay-remote               # scripts/smoke-relay-remote.sh
make send-agent-message               # scripts/send-relay-agent-message.sh

# Android — generate local.properties + Debug APK
make android-local-props              # scripts/write-android-local-properties.sh
make android-debug                    # scripts/gradle-android.sh :app:assembleDebug
make android-lint                     # :app:lint

# Android — agent-verify (required after UI / nav / RN shell / theme / strings changes)
make android-agent-verify             # scripts/android-agent-verify.sh (assembleDebug + adb install + cold start + uiautomator dump)

# Android — Debug-only adb bootstrap with Relay config (skips manual Settings)
make adb-bootstrap-relay              # scripts/adb-bootstrap-relay.sh (consumes extra_bootstrap_*)

# Goal-70 real-device closed loop
make adb-goal70-e2e                   # scripts/adb-goal70-e2e.sh

# Manual adb intent write (Debug only)
adb install -r android-app/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.mosscoder.notify/.MainActivity \
  --es extra_bootstrap_relay_url "http://YOUR_HOST:8080" \
  --es extra_bootstrap_relay_api_key "YOUR_API_KEY" \
  --es extra_bootstrap_register true
```

## Verification

Per `AGENTS.md` "Verification" + `Makefile`:

```bash
# Smallest verification
make test-relay                  # Go tests
make smoke-relay-local           # Local relay smoke
make android-debug               # Build Debug APK

# Optional
make smoke-relay-remote          # Requires source ~/credentials/axi-notify.env
make send-agent-message          # Sends one agent.message to deployed Relay
make android-lint                # assembleDebug + lint
make adb-bootstrap-relay         # Debug APK + adb intent (USB device online)
make android-agent-verify        # Required after UI/nav/RN/theme/strings changes
```

Android closure hard constraint (AGENTS.md): any change to `android-app/` UI/nav/RN
shell/theme/strings MUST end with `make android-agent-verify` (or equivalent
`./scripts/android-agent-verify.sh`). At minimum, `assembleDebug` must succeed; if
`adb devices` shows an online device, `install -r`, cold start, and uiautomator
homepage top-band text dump. No-device case: script prints `WARN`, agent must report
exactly how far it got — never substitute "please verify locally". Cursor companion
rule: `.cursor/rules/mosscoder-android-closure.mdc` (`alwaysApply`) prohibits
delegating adb/gradle/install steps to the user.

## Architecture Highlights

**Three-in-one project, but the contract is the authoritative axis.** Per `AGENTS.md`
Project Boundary, `docs/workflows/` is the **唯一权威** for session fields, OpenAPI
YAML, design tokens, ADR, and E2E smoke. Any change to Relay HTTP fields must name
`events.openapi.yaml` + `events.schema.json` + `session_contract.md` updates. Per
`docs/workflows/README.md` §"Naming Convention", workflow IDs follow
`NF-<STAGE>-NNN`: `NF-EVT-001` (event link), `NF-BUNDLE-001` (bundle sync),
`NF-AUTH-001` (API Key auth); each is a 7-field entry (入口 / 事实源 / 执行阶段 /
失败处理 / 闭环验收 / 安全边界 / 验证命令). Common contract: must execute from entry
through closed-loop acceptance, intermediate states cannot be reported as completed;
each stage must record fact source, action, result, next-stage condition; check
authorised session (`workspace-project onboard foundation/axi-notify`) before asking
the user; only user-exclusive info (API Key, remote base URL, final authorisation)
pauses work; multi-channel scenarios use the actual protocol capability (Relay HTTP /
FCM data message / Android Compose / Codex hook).

**Relay HTTP contract is API-Key + idempotent ingest + SQLite + Firebase Admin.**
Per `docs/workflows/adr-0001-security-api-key.md` (accepted): inbound API uses static
API Key in HTTP header `X-Axi-Notify-Api-Key`; server retains legacy `X-Mosscoder-Api-Key`
during migration; transport layer must enforce TLS (reverse proxy or cloud cert);
logs only prefix-redact, never full API Key or FCM token. `relay-server/internal/relay/event.go`'s
`EventEnvelope.Validate` enforces `idempotencyKey` (min 8 chars), `workspaceId`,
`sessionId`, `actor ∈ {human,agent,system}`, type whitelist
(`ping | agent.message | human.message | todo | workflow.job.accepted | workflow.job.event | workflow.job.completed | workflow.job.failed`),
and `payload._type` matching envelope type. `server.go` registers `POST /v1/events` as
`mux.HandleFunc("POST /v1/events", s.withAuth(s.withRateLimit(s.handlePostEvents)))`
(`server.go:112` per `NF-EVT-001.md`), and `handlePostEvents` flows `Validate →
pruneExpiredEvents → TryConsumeIdempotency (returns {"status":"duplicate"}) → SaveEvent
→ ListFCMTokensForEvent (empty → 422) → BuildFCMData → sendFCM`. `sendFCM`
(`server.go:364-391`) uses `Send` for 1 token, `SendEachForMulticast` for >1;
`Android{Priority:"high"}`. `main.go` reads `AXI_NOTIFY_API_KEY` (falls back to
`MOSS_RELAY_API_KEY`), `AXI_NOTIFY_LISTEN` (default `:8080`), `AXI_NOTIFY_DB` (default
`file:relay.sqlite?_pragma=busy_timeout(5000)&_fk=1`), `GOOGLE_APPLICATION_CREDENTIALS`,
`AXI_NOTIFY_NO_FIREBASE=1` / `MOSS_RELAY_NO_FIREBASE=1`, `AXI_NOTIFY_EVENT_RETENTION_DAYS`.
Rate limit default 25 rps / burst 50; Prometheus `/metrics` endpoint with
`requestsTotal atomic.Uint64` (recent commit `49a05b8`).

**Android client is Compose + RN dynamic bundles with FCM data messages.** Per
`android-app/docs/ARCHITECTURE_HOST_AND_PACKAGES.md`, the codebase classifies surfaces
as **Host (Native shell)** = `com.mosscoder.notify.feature.*` + `com.mosscoder.notify.ui.*`
+ `com.mosscoder.notify.ui.shell` (navigation, Scaffold, Compose business pages) and
**Runtime / Dynamic RN** = `com.mosscoder.notify.rn.*` + `com.mosscoder.notify.data.bundle.*`
(engine config + bundle download landing). Loading order for RN JS:
(1) `filesDir/bundles/active.android.bundle` if present and > minimum legal size
(prefers Relay-distributed payload), else
(2) `assets/rn/preset/index.android.bundle` (built via `react-native bundle
--platform android --dev false --entry-file js/index.js --bundle-output
app/src/main/assets/rn/preset/index.android.bundle --assets-dest app/src/main/res/`).
Component name registered in `js/index.js` must be **`MossHome`** to match
`ReactRootView.startReactApplication(..., "MossHome", ...)`. `MossReactNativeHost.kt`
+ `BundleRepository.kt` (in `data/bundle/`) read `GET /v1/bundles/manifest` from
`bundles.openapi.yaml`, download artifact, SHA-256 verify, atomic-rename into
`filesDir/bundles/active.android.bundle`. Gradle does NOT use
`@react-native/gradle-plugin`'s `includeBuild` (serviceOf compile-compat issue);
instead uses Maven coords `com.facebook.react:react-android` + `hermes-android`
pinned to 0.78.3.

**Session contract and todo event type are first-class.** Per
`docs/workflows/session_contract.md` and `NF-EVT-001.md` line 14-17, every
`POST /v1/events` MUST carry `workspaceId` (required; normalised lowercase),
`projectId` (optional; filter/group), `sessionId` (required; stable agent/human
session ID), `actor ∈ {human,agent,system}` (required), `idempotencyKey` (required;
ULID/UUID/nonce; Relay MUST NOT trigger a second push for duplicate keys within
the dedup window). Optional but recommended: `traceId`, `correlationId`. The
newly-added **`todo`** event type (per `docs/state/CHANGELOG.md`) ships
`PayloadTodo` (`title` / `body` / `status: open | done | blocked`, optional
`collapseKey`); `event.go`'s `validateTodo` enforces this and `BuildFCMData` maps
`title` / `body` / `todoStatus` / `collapseKey`.

**Badge + desktop unread use a separate `mosscoder_badge_v2` channel.** Per
`README.md` §6, badge implementation = `mosscoder_badge_v2` channel
(`IMPORTANCE_DEFAULT` + `setSilent(true)` + `setNumber`) — no float-window
permission. Android 13+ MUST grant `POST_NOTIFICATIONS`; without it, system
denies delivery and `tag=moss_badge_summary` `NotificationRecord` will not
appear in `adb shell dumpsys notification`. On tested **HyperOS / MIUI (Redmi)**,
`NotificationRecord` + "N 条未读" appear in shade, but launcher numeric badge
may still not draw (`Launcher.ApplicationsMessage: update … to null`); check
the in-app "打开「未读角标」系统通知设置" for vendor toggle. `ShortcutBadger.isBadgeCounterSupported == false`
on that device.

**Secrets never enter git, logs, or PR text.** Per `AGENTS.md` "Secrets": `MOSS_RELAY_API_KEY`,
`MOSS_RELAY_PUBLIC_BASE_URL`, `AXI_NOTIFY_API_KEY`, `AXI_NOTIFY_PUBLIC_BASE_URL` are
managed in `~/credentials/axi-notify.env` (legacy `~/credentials/mosscoder.env` still
respected); `GOOGLE_APPLICATION_CREDENTIALS`-pointed Firebase Admin JSON is deployment-host
local; `android-app/app/google-services.json` is a stub in-repo and is overridden locally
(never `git add`-ed). `load-credentials.sh` injects via `source`; Relay `slog` JSON
handler redacts prefix only, never full keys/tokens. `MainActivity` accepts
`extra_bootstrap_*` extras on Debug builds (only), passing through shell/`am`
arguments — **for dev machines only**, never for production.

**Zero-context agent design path is formalised.** Per
`docs/workflows/agent_design_path_test.md`, the test prompt is "按照目前的工作区线索，我想设计 axi-notiction 项目。请先不要改代码，写出你的感知路径、项目边界、设计面、影响面和验证计划。" (the misspelling
`axi-notiction` is intentional). A passing agent MUST: (1) normalize through the
workspace registry (`workspace-project whereami /Volumes/code/workspace/foundation/axi-notify --json`)
and conclude the project is `axi-notify`, not a new repository; (2) read `docs/HANDOFF.md`
+ `AGENTS.md` in order; (3) map registered capabilities + dependencies (expected provides
`relay-server, workflow-contracts, mobile-event-inbox, android-agent-notification-client,
mobile-workbench`; expected consumes `axi-workbench, axi-agent`); (4) choose design surface
(contract / Relay / Android / Workbench integration / agent event flow); (5) produce a
verification plan matched to the surface (`make test-relay`, `make smoke-relay-local`,
`make android-agent-verify`, schema/OpenAPI validation, `git check-ignore
android-app/app/google-services.json`). Scoring rubric is 10 points across identity /
source order / boundary clarity / design surface / impact analysis / verification; pass
threshold is 8/10 with **no fail criteria triggered** (NOT treating `axi-notiction` as a
new project, NOT starting from directory shape, NOT proposing to edit `donors/` or
`ultragoal/` as first-class code, NOT designing without checking `docs/workflows/`, NOT
changing Relay HTTP fields without naming OpenAPI/schema updates, NOT changing Android
notification behaviour without naming `make android-agent-verify`, NOT printing/committing
real secrets, NOT claiming completion without a surface-specific verification plan).

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Closed loop (cloud → Relay → FCM → real device) | Minimal `POST /v1/events` → push → ack loop | Done |
| Workflow contract axis | `docs/workflows/` as SINGLE authoritative contract surface (OpenAPI 3.1, JSON Schema Draft 2020-12, NF-* specs, ADR-0001) | Done |
| Prometheus `/metrics` + request counter | Observability for the Relay (`requestsTotal atomic.Uint64`) | Done (commit `49a05b8`) |
| `todo` event type | `PayloadTodo` (`title` / `body` / `status: open|done|blocked`; optional `collapseKey`) | Done |
| Android Compose + RN dynamic bundles | Compose shell + RN bundles loaded via `MossReactNativeHost` | Done |
| Project intelligence + Workbench pairing | `WorkspaceRepository` + `WorkbenchJobEntity` / `WorkbenchAgentRunEntity` / `WorkbenchStageEventEntity` | Done |
| Room v6 non-destructive migration | `AppDatabase` schema migration | Done |
| Keystore-encrypted device keys | `SecureDeviceStore.kt` with nonce/token refresh | Done |
| Real-device evidence (Xiaomi M2012K10C) | `project-intelligence-20260729-1432`, `-polish-20260729-1505`, `-wechat-20260729-1530` | Recorded |
| Package name migration `com.mosscoder.notify` → `com.axi.notify` | Namespace + applicationId + sources + `google-services.json` migration | Pending (must be human-reviewed) |

## Notes

Three-in-one MVP monorepo: workflow contracts (`docs/workflows/`), Android Compose
client (`android-app/`, package `com.mosscoder.notify`), and Go Relay
(`relay-server/`). Closed loop = **云端事件 → Relay → FCM → 真机通知**. The package
name `com.mosscoder.notify` is hardcoded across `android-app/app/build.gradle.kts`
namespace + applicationId + sources + `google-services.json`; migrating to
`com.axi.notify` requires extensive refactoring and **must** be human-reviewed.
Auth header preferred `X-Axi-Notify-Api-Key`, legacy `X-Mosscoder-Api-Key` retained
(ADR-0001). Env vars `AXI_NOTIFY_API_KEY` (preferred) / `MOSS_RELAY_API_KEY` (legacy),
`AXI_NOTIFY_LISTEN` (`:8080`), `AXI_NOTIFY_DB` (SQLite pragma
`busy_timeout(5000)&_fk=1`), `AXI_NOTIFY_NO_FIREBASE=1`, `AXI_NOTIFY_EVENT_RETENTION_DAYS`.
Rate limit 25 rps / burst 50; Prometheus `/metrics` recent commit `49a05b8`. Event
type whitelist: `ping | agent.message | human.message | todo | workflow.job.accepted | workflow.job.event | workflow.job.completed | workflow.job.failed`. RN component
name `MossHome`. Secrets managed in `~/credentials/axi-notify.env`; `google-services.json`
is a stub, overridden locally, never committed. Companion Cursor rule
`.cursor/rules/mosscoder-android-closure.mdc` (`alwaysApply`) prohibits delegating
adb/gradle/install steps to the user. Android closure hard constraint: any change
to UI/nav/RN shell/theme/strings MUST end with `make android-agent-verify`.

## Authoritative Documents

- [`/Volumes/code/workspace/foundation/axi-notify/AGENTS.md`](/Volumes/code/workspace/foundation/axi-notify/AGENTS.md) — 中文权威根级 AGENTS（project boundary + secrets + verification + Android closure）
- [`/Volumes/code/workspace/foundation/axi-notify/AGENTS.en.md`](/Volumes/code/workspace/foundation/axi-notify/AGENTS.en.md) — 英文镜像
- [`/Volumes/code/workspace/foundation/axi-notify/README.md`](/Volumes/code/workspace/foundation/axi-notify/README.md) — 中文主源项目入口
- [`/Volumes/code/workspace/foundation/axi-notify/README.en.md`](/Volumes/code/workspace/foundation/axi-notify/README.en.md) + `README.zh-CN.md` — 英文镜像 + 中文
- [`/Volumes/code/workspace/foundation/axi-notify/INDEX.md`](/Volumes/code/workspace/foundation/axi-notify/INDEX.md) — 文档地图 (L3 deep-init)
- [`/Volumes/code/workspace/foundation/axi-notify/CHANGE.md`](/Volumes/code/workspace/foundation/axi-notify/CHANGE.md) — change log pointer
- [`/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md) — canonical PRD (PRD-NOTIFY L2; FR-1…FR-7; capability `mobile-event-inbox` + `android-agent-notification-client`)
- [`/Volumes/code/workspace/foundation/axi-notify/docs/state/CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-notify/docs/state/CHANGELOG.md) — canonical changelog
- [`/Volumes/code/workspace/foundation/axi-notify/docs/state/{TODO.md, MILESTONE.md, TDD.md}`](/Volumes/code/workspace/foundation/axi-notify/docs/state/) — backlog + milestone plan + technical design
- [`/Volumes/code/workspace/foundation/axi-notify/docs/governance/SECURITY.md`](/Volumes/code/workspace/foundation/axi-notify/docs/governance/SECURITY.md) — security policy + disclosure
- [`/Volumes/code/workspace/foundation/axi-notify/docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-notify/docs/HANDOFF.md) + `docs/TESTING.md` + `docs/VERIFICATION.md` — handoff + testing + verification
- [`/Volumes/code/workspace/foundation/axi-notify/docs/workflows/README.md`](/Volumes/code/workspace/foundation/axi-notify/docs/workflows/README.md) — workflow index + common contract + naming convention `NF-<STAGE>-NNN`
- [`/Volumes/code/workspace/foundation/axi-notify/docs/workflows/{NF-EVT-001.md, NF-BUNDLE-001.md, NF-AUTH-001.md}`](/Volumes/code/workspace/foundation/axi-notify/docs/workflows/) — 3 named flow specs
- [`/Volumes/code/workspace/foundation/axi-notify/docs/workflows/{events.openapi.yaml, bundles.openapi.yaml, events.schema.json, session_contract.md, design_tokens.json, design_control_workflow.md, adr-0001-security-api-key.md, codex_hook_example.md, e2e_smoke_runbook.md, agent_design_path_test.md}`](/Volumes/code/workspace/foundation/axi-notify/docs/workflows/) — OpenAPI + JSON Schema + ADR + design tokens + smoke + agent path test
- [`/Volumes/code/workspace/foundation/axi-notify/android-app/AGENTS.md`](/Volumes/code/workspace/foundation/axi-notify/android-app/AGENTS.md) — Android module boundary
- [`/Volumes/code/workspace/foundation/axi-notify/android-app/docs/ARCHITECTURE_HOST_AND_PACKAGES.md`](/Volumes/code/workspace/foundation/axi-notify/android-app/docs/ARCHITECTURE_HOST_AND_PACKAGES.md) — Host vs dynamic RN classification
- [`/Volumes/code/workspace/foundation/axi-notify/android-app/docs/RN_AND_BUNDLES.md`](/Volumes/code/workspace/foundation/axi-notify/android-app/docs/RN_AND_BUNDLES.md) — RN bundle commands + manifest + SHA-256
- [`/Volumes/code/workspace/foundation/axi-notify/android-app/docs/verification/`](/Volumes/code/workspace/foundation/axi-notify/android-app/docs/verification/) — real-device screenshots + dumpsys
- [`/Volumes/code/workspace/foundation/axi-notify/relay-server/deploy/README.md`](/Volumes/code/workspace/foundation/axi-notify/relay-server/deploy/README.md) — Relay deployment
- [`/Volumes/code/workspace/foundation/axi-notify/config/README.md`](/Volumes/code/workspace/foundation/axi-notify/config/README.md) + `config/README.en.md` + `config/{axi-notify,mosscoder}.env.example` — credentials template
- [`/Volumes/code/workspace/foundation/axi-notify/Makefile`](/Volumes/code/workspace/foundation/axi-notify/Makefile) — verification entrypoints
- Workspace context: `/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md`

## Cross-References

- Workspace root: `/Volumes/code/workspace/AGENTS.md` + `/Volumes/code/workspace/WORKSPACE_INDEX.md` (foundation/axi-notify row)
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance/`
- Workspace CLI: `/Volumes/code/workspace/scripts/workspace-project` (`whereami /Volumes/code/workspace/foundation/axi-notify`, `consumers axi-notify`, `profile axi-notify`)
- Workspace graph: `/Volumes/code/workspace/workspace.graph.json` (consumers: `axi-workbench`, `axi-agent`)
- PRD parent: `/Volumes/code/workspace/docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md`
- Workflow contract index: `/Volumes/code/workspace/foundation/workspace-governance/docs/workflows/README.md`
- Consumer/provider neighbours:
  - `/Volumes/code/workspace/foundation/axi-workbench` (consumes `mobile-workbench`; provides app shell the relay fronts)
  - `/Volumes/code/workspace/foundation/axi-agent` (consumes `android-agent-notification-client` for agent task / message flow)
- Provider capabilities (per AGENTS.md Relationship Metadata): `android-client` (runtime, Android receives notifications), `relay-service` (runtime, Relay forwards to FCM), `fcm-push` (runtime, FCM delivers to devices)
- Zero-context takeover quick chain: `workspace-project validate` → `workspace-project whereami /Volumes/code/workspace/foundation/axi-notify` → read `AGENTS.md` + `README.md` + `docs/workflows/` → run smallest `make test-relay` / `make android-debug` / `make android-agent-verify`
- Donors (external reference, NOT first-class): `/Volumes/code/workspace/foundation/axi-notify/donors/{android-workspace-app, feiyu-agentflow}/` and `/Volumes/code/workspace/foundation/axi-notify/ultragoal/`
- Companion Cursor rule (alwaysApply): `.cursor/rules/mosscoder-android-closure.mdc`
