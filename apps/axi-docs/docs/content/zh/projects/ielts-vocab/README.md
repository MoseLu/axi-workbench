---
id: axi-docs-zh-projects-ielts-vocab
title: IELTS Vocabulary
type: project
status: published
tags: [Axi Docs, 项目, products, learning, microservices]
created: 2026-10-07
modified: 2026-10-07
graph-title: IELTS Vocabulary
graph-tags: [Projects, products, microservices, learning]
description: IELTS vocabulary learning monorepo with React 19 web, React Native mobile, shared TypeScript client core, split Flask/FastAPI microservices, gateway BFF, macOS local app launcher, and mac-bridge MCP server.
project:
  id: ielts-vocab
  partition: products
  path: /Volumes/code/workspace/products/ielts-vocab
  source-section: core
---

# IELTS Vocabulary

> 项目根 `README.md` 的镜像,深入剖析微服务布局、gateway BFF 与
> `mac-bridge` MCP 表面。权威来源:
> [`/Volumes/code/workspace/products/ielts-vocab/README.md`](/Volumes/code/workspace/products/ielts-vocab/README.md)。
> Section: core / Partition: `products/`。

## Summary

`IELTS Vocabulary` 是一个单一产品 monorepo,通过三个客户端(Web、React
Native Android/iOS、Mac 封装 Vite 应用)以及拆分式微服务后端,交付 30
天 IELTS 词汇学习体验。它是 Axi 工作区中唯一一个 `products/` 项目,
其规范本地运行时由九個 FastAPI/Flask 拆分服务组成的舰队构成,前置一层
FastAPI gateway BFF,并附带一个独立的 Socket.IO 语音服务。该项目还附带
一个小型的 MCP 服务器(`packages/mac-bridge-mcp`),用于暴露本地 Mac
运行时的健康/日志/启动控制。

Web 技术栈是 React 19 + TypeScript + Vite(`frontend/`),搭配 Web 与
Mobile 共用的 client-core 包(`packages/app-core`)。Mobile 端采用
React Native,代码位于 `apps/mobile/`(Capacitor 时期的目录已经按根
`AGENTS.md` 要求折回统一的 React Native 应用)。后端在 `services/` 下拆
分为九個服务,并在 `apps/gateway-bff/` 下放置 gateway,全部依赖 SQLAlchemy
访问 PostgreSQL;Flask 单体入口(`backend/app.py`)与 Socket.IO 语音
入口(`backend/speech_service.py`)仅保留用于兼容/回滚演练。

项目已经历 Wave 1–6 收尾,当前重点是保持 Wave 之后微服务基线稳定、完成
admin / notes / ai 的 projection cutover(Wave 5),并敲定远程 release /
deploy / preflight / smoke / storage-drill 的收尾。PRD 拆分到 `README.md`
(当前能力)与 `PRD.md`(正式范围);验证命令位于 `VERIFICATION.md`,规范工作
区命令为 `pnpm --dir frontend verify:repo-guards`。

**Stage**: 线上产品(拆分后端为规范;单体保留为回滚面)。
**Canonical path**: `/Volumes/code/workspace/products/ielts-vocab`。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Web frontend | React 19 + TypeScript + Vite (`frontend/`) | Dev `127.0.0.1:3020`, preview `127.0.0.1:3002`; SCSS + CSS vars, Zod runtime schemas |
| Mobile app | React Native (`apps/mobile/`) | Android + iOS owned by the same app unless a future native split is explicitly chosen; Android tested via AVD `ielts_vocab_api35` |
| Shared client core | `@ielts-vocab/app-core` (`packages/app-core/`) | Zod schemas + platform-neutral types; built with `tsx` |
| Mac app launcher | Bash + custom `.app` bundle (`scripts/run-mac-local-app.sh`) | Builds `IELTS Vocab Dev.app` / `IELTS Vocab Preview.app` shells that wrap Vite dev/preview |
| Backend monolith (compat) | Flask + Flask-SocketIO + Flask-SQLAlchemy (`backend/app.py`, `backend/speech_service.py`) | Port `5000` / `5001`; only used for compatibility / rollback drills |
| Split services (canonical) | FastAPI + Flask wrapped in `a2wsgi` + Uvicorn | `services/{identity,learning-core,catalog-content,ai-execution,tts-media,asr,notes,admin-ops}-service/main.py` + `services/asr-service/socketio_main.py` for Socket.IO |
| Gateway BFF | FastAPI (`apps/gateway-bff/main.py`) | Browser ingress on `127.0.0.1:8000`, route prefix `/api/*` proxied to split services |
| Shared Python SDK | `platform_sdk` (`packages/platform-sdk/platform_sdk/`) | Runtime env loader, service-app shell, gateway browser routes, media proxy, Redis/RabbitMQ helpers, projection bootstrap, outbox publishers |
| Storage | PostgreSQL via SQLAlchemy; Redis (rate-limit, ASR session state); RabbitMQ (event bus); Aliyun OSS (`oss2`) | All defined in `backend/requirements.txt` + `services/requirements.txt` |
| Realtime ASR | Flask-SocketIO + python-socketio (`services/asr-service/socketio_main.py`) | Port `5001`; client reaches it via Vite proxy `/socket.io` or `/speech-socket.io` |
| Auth | PyJWT + HttpOnly Cookie refresh session; internal service auth via signed headers (`platform_sdk/internal_service_auth.py`) | |
| Validation | Zod (`packages/app-core`, `frontend/src/lib/schemas.ts`) | |
| Process orchestration | `start-project.sh`, `start-microservices.sh`, `start-monolith-compat.sh` | Workspace port lease (`PORT`) is required to derive per-service ports |
| MCP surface | `mcp>=1.0.0` (`packages/mac-bridge-mcp/server.py`) | Tools: `check_services`, `get_logs`, `launch_app`, `kill_app` |

## Project Layout

```text
products/ielts-vocab/
├── apps/
│   ├── gateway-bff/                 # FastAPI browser ingress (:8000)
│   │   └── main.py                  # gateway-bff entry; routes /api/* -> split services
│   └── mobile/                      # React Native Android/iOS
│       ├── App.tsx, index.js, package.json, metro.config.js
│       ├── android/, ios/, hyperframes/, scripts/, e2e/, tests/
│       └── src/
├── backend/                         # Flask monolith + speech service (compat)
│   ├── app.py                       # monolith on :5000
│   ├── speech_service.py            # speech on :5001 (compat)
│   ├── models.py, model_definitions/, routes/, services/, tests/
│   ├── API.md, README.md, requirements.txt
│   └── database.sqlite + migrations + tts_cache/ + word_tts_cache/
├── services/                        # ★ canonical split microservices
│   ├── identity-service/            # :8101 main.py + eventing_worker.py + outbox_publisher.py
│   ├── learning-core-service/       # :8102 main.py + outbox_publisher.py
│   ├── catalog-content-service/     # :8103 main.py
│   ├── ai-execution-service/        # :8104 main.py + outbox_publisher.py + domain_worker.py + projection workers
│   ├── tts-media-service/           # :8105 main.py + outbox_publisher.py + example_audio_runtime/storage.py + runtime_helpers.py
│   ├── asr-service/                 # :8106 main.py + socketio_main.py (:5001)
│   ├── notes-service/               # :8107 main.py + outbox_publisher.py + domain_worker.py + projection workers
│   ├── admin-ops-service/           # :8108 main.py + domain_worker.py + 6 projection workers
│   └── requirements.txt, requirements.lock.txt
├── packages/
│   ├── app-core/                    # @ielts-vocab/app-core — shared TS/Zod core
│   ├── platform-sdk/                # platform_sdk — shared Python SDK (gateway, runtime, redis, rabbitmq, projections)
│   └── mac-bridge-mcp/              # MCP server (Python, stdio) for local app control
├── frontend/                        # React 19 + Vite
│   ├── package.json, vite.config.ts, vitest.config.ts, playwright.config.ts
│   └── src/{app,components,composables,contexts,features,hooks,lib,styles,test,types,assets}
├── docs/                            # architecture/, governance/, milestone/, operations/, planning/, state/, logs/
├── scripts/                         # guard scripts, deploy scripts, repo utilities
├── vocabulary_data/                 # word books + chapter assets (exempt from 500-line cap)
├── reference-materials/raw/         # IELTS PDFs/audio (git-ignored)
├── nginx.conf.example
├── start-project.sh                 # one-button production-style local startup
├── start-microservices.sh           # default split-backend startup
├── start-monolith-compat.sh         # compat-mode drill startup
├── start-lowmem.sh
└── pnpm-workspace.yaml
```

不要将 `services/` 拆分到独立仓库。未来仅在明确的 native 拆分决策下才允许
拆分 `apps/mobile`。新客户端落在 `apps/*`(例如未来 WeChat 小程序的
`apps/miniprogram`)。

## Build

```bash
# Web (dev / preview)
cd /Volumes/code/workspace/products/ielts-vocab
pnpm install
pnpm --dir frontend dev          # http://127.0.0.1:3020 (Vite dev)
pnpm --dir frontend preview      # http://127.0.0.1:3002 (Vite preview)

# Production-style local startup
./start-project.sh               # gateway-bff + split services + ASR Socket.IO + Vite preview

# Microservices only (default split runtime)
PORT=8100 ./start-microservices.sh   # gateway on 8100, services 8101-8108, ASR Socket.IO on 8109

# Mobile
pnpm --dir apps/mobile android
pnpm --dir apps/mobile ios
```

## Verification

```bash
# Repo guards (file-line, design tokens, style discipline, lint, build, test)
pnpm --dir frontend verify:repo-guards

# Workspace governance
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs handoff-check ielts-vocab

# Service health (after start-microservices.sh)
curl http://127.0.0.1:8101/ready   # identity-service
curl http://127.0.0.1:8108/ready   # admin-ops-service
curl http://127.0.0.1:5001/ready   # asr-socketio

# Backend test surface
pytest -q
pytest backend/tests/test_source_text_integrity.py -q

# Wave 5 cutover drill
python3 scripts/run-wave5-projection-cutover.py
```

根 `VERIFICATION.md` 记录最近一次完整 `verify:repo-guards` 重新执行于
2026-08-23,owner 必须重新运行以确认当前前端验证仍然通过。

## Architecture Highlights

拆分运行时架构是本项目最具决定性的决策。根 `AGENTS.md` 明确:拆分后端
为规范本地路径;Flask 单体与 `start-monolith-compat.sh` 脚本仅保留用于
回滚演练(例如 Wave 6C 兼容性演练预设 `--monolith-compat-surface rollback`
将范围收窄到 `tts-admin`,并将 readiness canary 切换到
`/api/tts/books-summary`)。`services/*/main.py` 中的每个微服务都是薄壳,
负责:加载拆分服务环境,通过 `platform_sdk.<service>_runtime.create_<service>_flask_app()`
挂载领域专属 Flask 应用,再以 `a2wsgi.WSGIMiddleware` 包裹后嵌入 FastAPI
`create_service_shell_app`,使 `/ready`、`/health` 与服务特定的 readiness
检查统一呈现。因此,位于 `packages/platform-sdk/platform_sdk/` 的共享
Python SDK 才是服务间的 contract 层,所有跨服务调用
(`identity_admin_internal_client.py`、`learning_core_internal_client.py`、
`catalog_content_internal_client.py`)都是基于 `service-internal /internal/*`
路由的强类型客户端。

Gateway BFF(`apps/gateway-bff/main.py`)是唯一的浏览器入口。它通过
`platform_sdk.gateway_browser_routes` 将 `/api/*` 代理到正确的拆分服务,
并借助 `platform_sdk.gateway_media_proxy` 转发 TTS 音频、单词音频、跟读
分块音频与 ASR 上传。Vite 配置(`frontend/vite.config.ts`)与网关边界一一
吻合:dev 代理 `/api -> 127.0.0.1:8000`、`/socket.io -> 127.0.0.1:5001`,
preview 应用同一套规则;生产式本地代理链(nginx → vite preview → gateway
→ split services)在根 `README.md` 中说明,并由 `nginx.conf.example`
落地。

事件机制基于 outbox publishers 与分组 domain workers 实现事件溯源。
`start-microservices.sh` 启动规范 worker 集:`core-eventing-worker`
(identity eventing)、`notes-domain-worker`、`ai-execution-domain-worker`
与 `admin-ops-domain-worker`。每个 worker 都是独立的 Python 入口
(`services/<svc>/domain_worker.py` 或 `eventing_worker.py`),从 RabbitMQ
消费并物化到服务自有的 projection 表(例如 `notes_projected_study_sessions`、
`notes_projected_wrong_words`、`ai_projected_daily_summaries`、
`admin_projected_users`)。Wave 5 收尾(参见
`packages/platform-sdk/platform_sdk/wave5_projection_cutover.py` 与
`scripts/run-wave5-projection-cutover.py`)在 `admin / notes / ai` 中以
projection-first reads 取代直接 shared-table reads,并以 bootstrap-marker
游标为门控,使 projection 一致性成为一种受控开关而非计数检查。

Mac 应用启动器与 `mac-bridge` MCP 是本项目的运维面。
`scripts/run-mac-local-app.sh` 生成 `IELTS Vocab Dev.app` 与
`IELTS Vocab Preview.app` 壳层以包装 Vite 二进制,通过系统 Application
launcher 打开;日志落到 `logs/runtime/mac-app/dev.*.log`(或 `preview.*.log`)。
`packages/mac-bridge-mcp` 服务器(`server.py`)暴露 4 个 MCP 工具
—— `check_services`、`get_logs`、`launch_app`、`kill_app` —— 读取与手动
`curl /ready` 探测相同的 `SERVICES` 表(frontend-dev/preview、gateway-bff、
八個拆分服务、asr-socketio),以便 agent 与人看到一致的健康快照。这也是
唯一自带 MCP 表面的项目;规范合同是稳定的共享能力成为 MCP 表面,而不是
每一个业务仓都这样做。

## Key Modules/Files

| Path | Role |
| --- | --- |
| `/Volumes/code/workspace/products/ielts-vocab/package.json` | pnpm workspace root; scripts for `dev`, `preview`, `build`, `test`, `verify:clients`, `verify:repo-guards` |
| `/Volumes/code/workspace/products/ielts-vocab/start-microservices.sh` | Workspace-port-leased boot of 9 services + 4 grouped workers, with PID/log rotation and `wait_http_ready` |
| `/Volumes/code/workspace/products/ielts-vocab/start-project.sh` | One-button production-style local startup (gateway + split + Vite preview + logs + health) |
| `/Volumes/code/workspace/products/ielts-vocab/apps/gateway-bff/main.py` | FastAPI BFF, mounts `platform_sdk.gateway_browser_routes` and `gateway_media_proxy` for `/api/*` and `/socket.io` |
| `/Volumes/code/workspace/products/ielts-vocab/services/identity-service/main.py` | Mounts `platform_sdk.identity_runtime.create_identity_flask_app()`; service shell with DB readiness + auth compat |
| `/Volumes/code/workspace/products/ielts-vocab/services/learning-core-service/main.py` | Mounts `learning_core_runtime` Flask app; readiness includes `learning_progress_compatibility` |
| `/Volumes/code/workspace/products/ielts-vocab/services/catalog-content-service/main.py` | Mounts `catalog_content_runtime`; default port `8103` |
| `/Volumes/code/workspace/products/ielts-vocab/services/ai-execution-service/main.py` | Mounts `ai_runtime`; loads `learner_profile_application_support` and `learning_core_quick_memory_read_adapter` lazily; AI dependency probe endpoint |
| `/Volumes/code/workspace/products/ielts-vocab/services/tts-media-service/main.py` | Mounts `tts_media_runtime`; exposes word/example/follow-read audio via OSS-backed cache; uses `internal_service_auth` headers |
| `/Volumes/code/workspace/products/ielts-vocab/services/asr-service/main.py` | FastAPI service shell with `/v1/speech/transcribe` upload endpoint and `upload_transcription` readiness |
| `/Volumes/code/workspace/products/ielts-vocab/services/asr-service/socketio_main.py` | Socket.IO ASR realtime on port `5001`; uses `platform_sdk.asr_runtime.create_socketio_service` + Redis-backed session snapshots |
| `/Volumes/code/workspace/products/ielts-vocab/services/notes-service/main.py` | Mounts `notes_runtime`; readiness includes OSS bucket; `notes-domain-worker` materialises projections |
| `/Volumes/code/workspace/products/ielts-vocab/services/admin-ops-service/main.py` | Mounts `admin_ops_runtime`; six projection workers (`user`, `study_session`, `wrong_word`, `tts_media`, `prompt_run`, `daily_summary`) |
| `/Volumes/code/workspace/products/ielts-vocab/frontend/vite.config.ts` | Dev port `3020`, preview `3002`; `/api` → gateway `8000`, `/socket.io` → speech `5001`; `manualChunks` for vendor-react/validation/socket/markdown |
| `/Volumes/code/workspace/products/ielts-vocab/frontend/package.json` | Web scripts (`dev`, `build`, `lint`, `test`, `test:e2e`, `verify:repo-guards`); deps: `@rive-app/react-canvas`, `@tiptap/*`, `@floating-ui/react`, `dompurify`, `marked` |
| `/Volumes/code/workspace/products/ielts-vocab/packages/platform-sdk/platform_sdk/` | Shared Python SDK: `runtime_env`, `service_app`, `gateway_browser_routes`, `gateway_media_proxy`, `identity_runtime`, `learning_core_runtime`, `catalog_content_runtime`, `ai_runtime`, `tts_media_runtime`, `asr_runtime`, `notes_runtime`, `admin_ops_runtime`, `internal_service_auth`, `service_table_plan`, `wave5_projection_cutover`, per-service `*_projection_runtime` |
| `/Volumes/code/workspace/products/ielts-vocab/packages/app-core/package.json` | `@ielts-vocab/app-core` shared TS core (Zod schemas); `test` via `node --import tsx --test` |
| `/Volumes/code/workspace/products/ielts-vocab/packages/mac-bridge-mcp/server.py` | MCP stdio server; tools `check_services` (12 services), `get_logs` (mac-app or service logs), `launch_app` (dev/preview), `kill_app` (dev/preview) |
| `/Volumes/code/workspace/products/ielts-vocab/scripts/run-mac-local-app.sh` | Builds `IELTS Vocab Dev.app` / `IELTS Vocab Preview.app`; generates `.icns` from `frontend/assets/images/logo.png`; falls back to direct Vite when `IELTS_DISABLE_MAC_APP=1` |
| `/Volumes/code/workspace/products/ielts-vocab/scripts/run-wave5-projection-cutover.py` | Operator command that runs `admin / notes / ai` bootstrap flows + marker readiness + source/projected count parity |
| `/Volumes/code/workspace/products/ielts-vocab/scripts/cloud-deploy/{run-service.sh,release-common.sh,smoke-check.sh,preflight-check.sh}` | Wave 5 worker-aware deploy contract: outbox/projection workers routed through `ielts-service@<worker>`, smoke verifies worker systemd activity |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Wave 1 | Initial microservice split (identity + learning-core + catalog) | Done |
| Wave 4 | Code-side storage/artifact parity tooling; shared-`SQLite` scoped-override restart records | Done |
| Wave 5 | Shared-read retirement on `admin / notes / ai`; Redis-backed ASR session state; Redis-backed identity rate-limit; remote broker rollout on `119.29.182.134` | In progress (projection cutover drill operational; remote release/deploy/preflight closeout pending) |
| Wave 6 | Speech-service split out of Flask app into `backend/speech_service.py` on port `5001` | Done |
| Wave 6C | Cutover validation + rollback drill preset (`--monolith-compat-surface rollback`) | Done (validation script `pwsh ./scripts/validate-wave6c-rollback-drill.ps1` exists) |

完整 Wave 历史见 `docs/state/MILESTONE.md` 与 `docs/milestone/`。

## 备注

- Mac-app 启动器模式(`scripts/run-mac-local-app.sh`)为本仓库专用,未经
  owner 明确请求不得推广至其他产品。
- 来自 `products/story-graph` 的 `_graph/` 风格 legacy `_view/` 回滚壳层
  模式不适用于此处 —— `ielts-vocab` 没有需要废弃的 legacy 单页面壳层。
- `mac-bridge` MCP 是 `products/` 中唯一的项目级 MCP 表面;在新增工具
  之前应将其视为稳定合同(4 个工具、12 个已知服务)。
- `Wave 5 cutover` 验证演练(`scripts/run-wave5-projection-cutover.py`)
  是 `admin / notes / ai` projection 一致性的运维入口。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/products/ielts-vocab/AGENTS.md) — repo-level working agreements, no-stop lockdown, file-line guardrail, technology stack
- [`README.md`](/Volumes/code/workspace/products/ielts-vocab/README.md) — primary English entrypoint, run topology, quick start
- [`README.zh-CN.md`](/Volumes/code/workspace/products/ielts-vocab/README.zh-CN.md) — Simplified Chinese mirror
- [`INDEX.md`](/Volumes/code/workspace/products/ielts-vocab/INDEX.md) — single source of truth for "where do I read or update X?"
- [`CLAUDE.md`](/Volumes/code/workspace/products/ielts-vocab/CLAUDE.md) — points to `AGENTS.md`
- [`CHANGE.md`](/Volumes/code/workspace/products/ielts-vocab/CHANGE.md) — pointer to canonical `docs/state/CHANGELOG.md`
- [`CHANGELOG.md`](/Volumes/code/workspace/products/ielts-vocab/CHANGELOG.md) — Keep-a-Changelog stub maintained by owner
- [`VERIFICATION.md`](/Volumes/code/workspace/products/ielts-vocab/VERIFICATION.md) — current verification state (last verified 2026-09-25; full re-run pending)
- [`MILESTONE.md`](/Volumes/code/workspace/products/ielts-vocab/MILESTONE.md) — milestone overview
- [`TODO.md`](/Volumes/code/workspace/products/ielts-vocab/TODO.md) — active tasks
- [`SECURITY.md`](/Volumes/code/workspace/products/ielts-vocab/SECURITY.md) — operator-channel / secret-handling policy (added in M3 audit remediation)
- [`docs/state/PRD.md`](/Volumes/code/workspace/products/ielts-vocab/docs/state/PRD.md) — formal PRD (separate from `README.md` capability summary)
- [`docs/state/TDD.md`](/Volumes/code/workspace/products/ielts-vocab/docs/state/TDD.md) — test/technical design
- [`docs/architecture/`](/Volumes/code/workspace/products/ielts-vocab/docs/architecture/) — `backend-layered-architecture.md`, `service-ownership-matrix.md`, `gateway-service-contracts.md`, `domain-event-contracts.md`, `frontend-boundaries.md`, `multi-client-monorepo.md`, `audits/`, `specs/realtime_waveform.md`
- [`backend/README.md`](/Volumes/code/workspace/products/ielts-vocab/backend/README.md) — backend layering
- [`backend/API.md`](/Volumes/code/workspace/products/ielts-vocab/backend/API.md) — API index
- [`backend/requirements.txt`](/Volumes/code/workspace/products/ielts-vocab/backend/requirements.txt) and [`services/requirements.txt`](/Volumes/code/workspace/products/ielts-vocab/services/requirements.txt) — Python dependency manifests
- [`nginx.conf.example`](/Volumes/code/workspace/products/ielts-vocab/nginx.conf.example) — production-style local proxy walkthrough
- [`packages/platform-sdk/`](/Volumes/code/workspace/products/ielts-vocab/packages/platform-sdk/) — shared Python SDK; the actual cross-service contract layer

## Cross-References

- Workspace graph: [`/Volumes/code/workspace/workspace.graph.json`](/Volumes/code/workspace/workspace.graph.json) — `ielts-vocab` provides `ielts-vocab-app` and consumes workspace governance.
- `mac-bridge` MCP 是 `products/` 中唯一的项目级 MCP 表面;在新增工具
  之前应将其视为稳定合同(4 个工具、12 个已知服务)。
- `Wave 5 closeout` 工作(`run-wave5-projection-cutover.py`、`scripts/cloud-deploy/*`)
  是下一个 wave;唯一未完成的 post-Wave 5 收尾是远程 release / deploy /
  preflight / smoke / storage-drill 收尾。