---
id: axi-docs-zh-projects-axi-notify
title: Axi Notify
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Notify
graph-tags: [Projects, notify]
tags: [Axi Docs, 项目, notify, fcm, relay, android]
description: 三合一的 MVP monorepo：工作流契约 + Axi Mobile Android Compose 客户端 + Go Relay 服务器，提供最小的 云端事件 → FCM → 真机通知 闭环；能力提供者 mobile-event-inbox、android-agent-notification-client、mobile-workbench。
project:
  id: axi-notify
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-notify
  source-section: core
---

# Axi Notify

> 项目根 `README.md` + `AGENTS.md` + `docs/state/PRD.md` + `INDEX.md` 的镜像；项目根为唯一权威。
> Source of truth:
> [`/Volumes/code/workspace/foundation/axi-notify/README.md`](/Volumes/code/workspace/foundation/axi-notify/README.md),
> [`/Volumes/code/workspace/foundation/axi-notify/AGENTS.md`](/Volumes/code/workspace/foundation/axi-notify/AGENTS.md),
> [`/Volumes/code/workspace/foundation/axi-notify/INDEX.md`](/Volumes/code/workspace/foundation/axi-notify/INDEX.md),
> [`/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md).
> Section: core / Partition: `foundation/`。

## 概述

Axi Notify 是一个**三合一** MVP monorepo（依据 `AGENTS.md` Project Boundary 与 `README.md`）：
(1) **`docs/workflows/`** —— 工作流契约（HTTP、session、OpenAPI、design tokens、ADR、E2E smoke runbook、NF-* 流规范）；(2) **`android-app/`** —— Kotlin + Jetpack
Compose + Firebase Messaging Android 客户端（包名 **`com.mosscoder.notify`**）；
(3) **`relay-server/`** —— Go + SQLite + Firebase Admin relay 服务，暴露
`/healthz`、`/v1/devices`、`/v1/events`、`/v1/bundles/*`。最小闭环是**云端事件 → Relay → FCM → 真机通知**。本仓归 Axi Spun-out Products 拥有（依据 `docs/state/PRD.md` §1），隶属 `AxiomaticWorld.com` 产品线。

包名 `com.mosscoder.notify` 当前硬编码在 `android-app/app/build.gradle.kts`
namespace + applicationId、所有 `android-app/app/src/main/java/com/mosscoder/notify/`
源码以及 Firebase `google-services.json` 中。依据 `AGENTS.md` Project Boundary，迁移到
`com.axi.notify` 需要大范围重构，且**必须**经人工 review 后执行。依据 `docs/state/PRD.md` §1.1：本项目**不是**通用 IM / 推送平台；它是工作流契约 + Compose 客户端 + Go relay 的 owner-private 云部署 + Android Debug/Release 双轨；**不是**公开 SaaS / 跨云多租户。

依据 `docs/workflows/agent_design_path_test.md` §"Expected provides"，本项目提供工作区图能力
`relay-server`、`workflow-contracts`、`mobile-event-inbox`、`android-agent-notification-client`、`mobile-workbench`；消费 `axi-workbench`（用于 `mobile-workbench` 集成）和 `axi-agent`（事件语义）。近期提交（依据 `docs/state/CHANGELOG.md` 与 git log）为 relay 添加了 Prometheus `/metrics` 端点 + request counter；新增 `todo` 事件类型 + `PayloadTodo`（`title`/`body`/`status: open|done|blocked`，可选 `collapseKey`）；Android 侧扩展了 `InboxPresentation`/`InboxRichText`、微信风格的信息壳、与 workbench 配对的项目情报、Keystore 加密的设备密钥、nonce/token 刷新、项目投影仓库、以及 Room v6 non-destructive migration；在 Xiaomi M2012K10C 上记录了 `project-intelligence-20260729-1432`、`-polish-20260729-1505` 与 `-wechat-20260729-1530` 的真机证据。

**当前阶段**：活跃 MVP，默认分支 `dev`（GitHub 默认已指向 `dev`）。
**规范路径**：`/Volumes/code/workspace/foundation/axi-notify`。
**审计时分支**：`dev` 跟踪 `origin/dev`；一个待办的未跟踪文件
`docs/logs/submit/20260930-082807-auto-submit.md`。

## 技术栈

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

## 项目结构

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

## 构建与安装

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

## 验证

依据 `AGENTS.md` "Verification" + `Makefile`：

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

Android closure 硬约束（AGENTS.md）：对 `android-app/` UI/nav/RN shell/theme/strings 的任何修改**必须**以 `make android-agent-verify`（或等价的 `./scripts/android-agent-verify.sh`）收尾。最低限度 `assembleDebug` 必须成功；若 `adb devices` 显示有在线设备，则继续 `install -r` + 冷启动 + uiautomator 首页顶部文本 dump。无设备场景：脚本打印 `WARN`，agent 必须如实汇报走到了哪一步 —— 绝不能用 "please verify locally" 替代。配套 Cursor 规则 `.cursor/rules/mosscoder-android-closure.mdc`（`alwaysApply`）禁止把 adb/gradle/install 步骤委派给用户。

## 架构要点

**三合一项目，但契约轴是权威。** 依据 `AGENTS.md` Project Boundary，`docs/workflows/` 是 session 字段、OpenAPI YAML、design tokens、ADR 与 E2E smoke 的**唯一权威**。任何 Relay HTTP 字段的变更必须同时点名 `events.openapi.yaml` + `events.schema.json` + `session_contract.md` 的更新。依据 `docs/workflows/README.md` §"Naming Convention"，workflow ID 遵循 `NF-<STAGE>-NNN`：`NF-EVT-001`（事件链路）、`NF-BUNDLE-001`（bundle 同步）、`NF-AUTH-001`（API Key 鉴权）；每条都是 7 字段条目（入口 / 事实源 / 执行阶段 / 失败处理 / 闭环验收 / 安全边界 / 验证命令）。通用契约：必须从入口执行到闭环验收，中间状态不能上报完成；每一阶段必须记录事实源、动作、结果与下一阶段条件；在向用户询问前先核对授权会话（`workspace-project onboard foundation/axi-notify`）；只有用户独有的信息（API Key、远端 base URL、最终授权）才暂停工作；多通道场景使用真实协议能力（Relay HTTP / FCM data message / Android Compose / Codex hook）。

**Relay HTTP 契约是 API-Key + 幂等摄入 + SQLite + Firebase Admin。** 依据 `docs/workflows/adr-0001-security-api-key.md`（accepted）：入站 API 使用 HTTP header `X-Axi-Notify-Api-Key` 静态 API Key；服务端保留旧名 `X-Mosscoder-Api-Key` 以兼容迁移；传输层必须强制 TLS（反向代理或云证书）；日志只对前缀打码，绝不打印完整 API Key 或 FCM token。`relay-server/internal/relay/event.go` 的 `EventEnvelope.Validate` 强制 `idempotencyKey`（至少 8 字符）、`workspaceId`、`sessionId`、`actor ∈ {human,agent,system}`、类型白名单
（`ping | agent.message | human.message | todo | workflow.job.accepted | workflow.job.event | workflow.job.completed | workflow.job.failed`），以及 `payload._type` 与 envelope 类型一致。`server.go` 将 `POST /v1/events` 注册为
`mux.HandleFunc("POST /v1/events", s.withAuth(s.withRateLimit(s.handlePostEvents)))`
（`server.go:112`，依据 `NF-EVT-001.md`），`handlePostEvents` 走 `Validate →
pruneExpiredEvents → TryConsumeIdempotency (returns {"status":"duplicate"}) → SaveEvent
→ ListFCMTokensForEvent (empty → 422) → BuildFCMData → sendFCM`。`sendFCM`
（`server.go:364-391`）对 1 个 token 用 `Send`，对 >1 个 token 用 `SendEachForMulticast`；`Android{Priority:"high"}`。`main.go` 读取 `AXI_NOTIFY_API_KEY`（回退到 `MOSS_RELAY_API_KEY`）、`AXI_NOTIFY_LISTEN`（默认 `:8080`）、`AXI_NOTIFY_DB`（默认
`file:relay.sqlite?_pragma=busy_timeout(5000)&_fk=1`）、`GOOGLE_APPLICATION_CREDENTIALS`、
`AXI_NOTIFY_NO_FIREBASE=1` / `MOSS_RELAY_NO_FIREBASE=1`、`AXI_NOTIFY_EVENT_RETENTION_DAYS`。
默认限流 25 rps / burst 50；Prometheus `/metrics` 端点携带 `requestsTotal atomic.Uint64`（近期 commit `49a05b8`）。

**Android 客户端是 Compose + RN 动态 bundle + FCM data message。** 依据 `android-app/docs/ARCHITECTURE_HOST_AND_PACKAGES.md`，代码库将面分类为 **Host（原生壳）** = `com.mosscoder.notify.feature.*` + `com.mosscoder.notify.ui.*`
+ `com.mosscoder.notify.ui.shell`（navigation、Scaffold、Compose 业务页）与
**Runtime / Dynamic RN** = `com.mosscoder.notify.rn.*` + `com.mosscoder.notify.data.bundle.*`
（引擎配置 + bundle 下载落点）。RN JS 加载顺序：
(1) `filesDir/bundles/active.android.bundle`（若存在且大于最小合法尺寸，优先使用 Relay 分发的 payload），否则
(2) `assets/rn/preset/index.android.bundle`（通过 `react-native bundle
--platform android --dev false --entry-file js/index.js --bundle-output
app/src/main/assets/rn/preset/index.android.bundle --assets-dest app/src/main/res/` 构建）。
`js/index.js` 中注册的组件名必须为 **`MossHome`**，以匹配
`ReactRootView.startReactApplication(..., "MossHome", ...)`。`MossReactNativeHost.kt`
与 `data/bundle/` 中的 `BundleRepository.kt` 从 `bundles.openapi.yaml` 读取 `GET /v1/bundles/manifest`，下载工件、做 SHA-256 校验，然后 atomic-rename 到 `filesDir/bundles/active.android.bundle`。Gradle **不**使用
`@react-native/gradle-plugin` 的 `includeBuild`（serviceOf 编译兼容性问题）；改用 Maven 坐标 `com.facebook.react:react-android` + `hermes-android` 固定为 0.78.3。

**Session 契约与 `todo` 事件类型是一等公民。** 依据 `docs/workflows/session_contract.md` 与 `NF-EVT-001.md` 第 14-17 行，每个 `POST /v1/events` **必须**携带 `workspaceId`（必填，小写归一化）、`projectId`（可选，过滤/分组）、`sessionId`（必填，稳定的 agent/human 会话 ID）、`actor ∈ {human,agent,system}`（必填）、`idempotencyKey`（必填，ULID/UUID/nonce；Relay 在去重窗口内**不得**为同一键触发第二次推送）。可选但推荐：`traceId`、`correlationId`。新加入的 **`todo`** 事件类型（依据 `docs/state/CHANGELOG.md`）承载 `PayloadTodo`（`title` / `body` / `status: open | done | blocked`，可选 `collapseKey`）；`event.go` 的 `validateTodo` 强制该结构，`BuildFCMData` 映射 `title` / `body` / `todoStatus` / `collapseKey`。

**Badge 与桌面未读使用独立 `mosscoder_badge_v2` 通道。** 依据 `README.md` §6，badge 实现 = `mosscoder_badge_v2` 通道（`IMPORTANCE_DEFAULT` + `setSilent(true)` + `setNumber`）—— 不使用悬浮窗权限。Android 13+ **必须**授予 `POST_NOTIFICATIONS`；未授权时，系统拒绝下发，`tag=moss_badge_summary` 的 `NotificationRecord` 也不会出现在 `adb shell dumpsys notification` 中。在已测的 **HyperOS / MIUI (Redmi)** 上，`NotificationRecord` 与 "N 条未读" 会出现在下拉通知栏，但启动器数字角标仍可能不绘制（`Launcher.ApplicationsMessage: update … to null`）；需检查 app 内的 "打开「未读角标」系统通知设置" 厂商开关。该设备上 `ShortcutBadger.isBadgeCounterSupported == false`。

**密钥永不进入 git、日志、PR 文案。** 依据 `AGENTS.md` "Secrets"：`MOSS_RELAY_API_KEY`、`MOSS_RELAY_PUBLIC_BASE_URL`、`AXI_NOTIFY_API_KEY`、`AXI_NOTIFY_PUBLIC_BASE_URL` 由 `~/credentials/axi-notify.env` 管理（旧名 `~/credentials/mosscoder.env` 仍受尊重）；`GOOGLE_APPLICATION_CREDENTIALS` 指向的 Firebase Admin JSON 位于部署机本地；`android-app/app/google-services.json` 在仓内只是 stub，部署机本地覆盖（绝不 `git add`）。`load-credentials.sh` 通过 `source` 注入；Relay `slog` JSON handler 只对前缀打码，绝不打印完整 key/token。`MainActivity` 接收 `extra_bootstrap_*` extras（仅 Debug 构建），透传自 shell/`am` 参数 —— **仅用于开发机**，绝不用于生产。

**零上下文 Agent 设计路径已形式化。** 依据 `docs/workflows/agent_design_path_test.md`，测试 prompt 是 "按照目前的工作区线索，我想设计 axi-notiction 项目。请先不要改代码，写出你的感知路径、项目边界、设计面、影响面和验证计划。"（其中 `axi-notiction` 的拼写错误是有意的）。通过的 agent 必须：(1) 通过工作区注册表归一化（`workspace-project whereami /Volumes/code/workspace/foundation/axi-notify --json`）并得出结论：项目即 `axi-notify`，不是新仓库；(2) 按顺序读 `docs/HANDOFF.md` + `AGENTS.md`；(3) 映射已注册能力与依赖（期望 provides `relay-server, workflow-contracts, mobile-event-inbox, android-agent-notification-client, mobile-workbench`；期望 consumes `axi-workbench, axi-agent`）；(4) 选择设计面（contract / Relay / Android / Workbench 集成 / agent event flow）；(5) 生成与面对应的验证计划（`make test-relay`、`make smoke-relay-local`、`make android-agent-verify`、schema/OpenAPI 校验、`git check-ignore android-app/app/google-services.json`）。评分维度 10 分（身份 / 源序 / 边界清晰 / 设计面 / 影响分析 / 验证），通过线 8/10 且**无任一失败标准触发**（不能把 `axi-notiction` 当作新项目；不能从目录形态起步；不能将 `donors/`、`ultragoal/` 当作一等代码；不能跳过 `docs/workflows/` 就设计；不能不在 OpenAPI/schema 更新同步点名的情况下改 Relay HTTP 字段；不能不在 `make android-agent-verify` 同步点名的情况下改 Android 通知行为；不能打印/提交真实密钥；不能在没有面对应验证计划时宣称完成）。

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| 闭环（云端 → Relay → FCM → 真机） | 最小 `POST /v1/events` → 推送 → 回执 闭环 | 完成 |
| 工作流契约轴 | `docs/workflows/` 作为唯一权威契约面（OpenAPI 3.1、JSON Schema Draft 2020-12、NF-* 规范、ADR-0001） | 完成 |
| Prometheus `/metrics` + request counter | Relay 可观测性（`requestsTotal atomic.Uint64`） | 完成（commit `49a05b8`） |
| `todo` 事件类型 | `PayloadTodo`（`title` / `body` / `status: open|done|blocked`；可选 `collapseKey`） | 完成 |
| Android Compose + RN 动态 bundle | Compose 壳 + 通过 `MossReactNativeHost` 加载 RN bundle | 完成 |
| 项目情报 + Workbench 配对 | `WorkspaceRepository` + `WorkbenchJobEntity` / `WorkbenchAgentRunEntity` / `WorkbenchStageEventEntity` | 完成 |
| Room v6 non-destructive migration | `AppDatabase` schema 迁移 | 完成 |
| Keystore 加密的设备密钥 | `SecureDeviceStore.kt` 携带 nonce/token 刷新 | 完成 |
| 真机证据（Xiaomi M2012K10C） | `project-intelligence-20260729-1432`、`-polish-20260729-1505`、`-wechat-20260729-1530` | 已记录 |
| 包名迁移 `com.mosscoder.notify` → `com.axi.notify` | namespace + applicationId + 源码 + `google-services.json` 迁移 | 待办（必须人工 review） |

## 说明

三合一 MVP monorepo：工作流契约（`docs/workflows/`）、Android Compose 客户端
（`android-app/`，包名 `com.mosscoder.notify`）、Go Relay（`relay-server/`）。闭环 = **云端事件 → Relay → FCM → 真机通知**。包名 `com.mosscoder.notify` 硬编码在 `android-app/app/build.gradle.kts`
namespace + applicationId + 源码 + `google-services.json` 中；迁移到 `com.axi.notify`
需要大范围重构，且**必须**经人工 review。Auth header 优先 `X-Axi-Notify-Api-Key`，旧名
`X-Mosscoder-Api-Key` 保留（ADR-0001）。环境变量 `AXI_NOTIFY_API_KEY`（优先）/ `MOSS_RELAY_API_KEY`（旧名）、`AXI_NOTIFY_LISTEN`（`:8080`）、`AXI_NOTIFY_DB`（SQLite pragma `busy_timeout(5000)&_fk=1`）、`AXI_NOTIFY_NO_FIREBASE=1`、`AXI_NOTIFY_EVENT_RETENTION_DAYS`。
默认限流 25 rps / burst 50；Prometheus `/metrics` 近期 commit `49a05b8`。事件类型白名单：
`ping | agent.message | human.message | todo | workflow.job.accepted | workflow.job.event | workflow.job.completed | workflow.job.failed`。RN 组件名 `MossHome`。密钥由 `~/credentials/axi-notify.env` 管理；`google-services.json` 是 stub，本地覆盖，永不提交。配套 Cursor 规则 `.cursor/rules/mosscoder-android-closure.mdc`（`alwaysApply`）禁止把 adb/gradle/install 步骤委派给用户。Android closure 硬约束：UI/nav/RN shell/theme/strings 的任何修改**必须**以 `make android-agent-verify` 收尾。

## 权威文档

- [`/Volumes/code/workspace/foundation/axi-notify/AGENTS.md`](/Volumes/code/workspace/foundation/axi-notify/AGENTS.md) — 中文权威根级 AGENTS（project boundary + secrets + verification + Android closure）
- [`/Volumes/code/workspace/foundation/axi-notify/AGENTS.en.md`](/Volumes/code/workspace/foundation/axi-notify/AGENTS.en.md) — 英文镜像
- [`/Volumes/code/workspace/foundation/axi-notify/README.md`](/Volumes/code/workspace/foundation/axi-notify/README.md) — 中文主源项目入口
- [`/Volumes/code/workspace/foundation/axi-notify/README.en.md`](/Volumes/code/workspace/foundation/axi-notify/README.en.md) + `README.zh-CN.md` — 英文镜像 + 中文
- [`/Volumes/code/workspace/foundation/axi-notify/INDEX.md`](/Volumes/code/workspace/foundation/axi-notify/INDEX.md) — 文档地图 (L3 deep-init)
- [`/Volumes/code/workspace/foundation/axi-notify/CHANGE.md`](/Volumes/code/workspace/foundation/axi-notify/CHANGE.md) — change log pointer
- [`/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-notify/docs/state/PRD.md) — canonical PRD (PRD-NOTIFY L2; FR-1…FR-7; capability `mobile-event-inbox` + `android-agent-notification-client`)
- [`/Volumes/code/workspace/foundation/axi-notify/docs/state/CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-notify/docs/state/CHANGELOG.md) — canonical changelog
- [`/Volumes/code/workspace/foundation/axi-notify/docs/state/{TODO.md, MILESTONE.md, TDD.md}`](/Volumes/code/workspace/foundation/axi-notify/docs/state/) — backlog + milestones + technical design
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

## 交叉引用

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
