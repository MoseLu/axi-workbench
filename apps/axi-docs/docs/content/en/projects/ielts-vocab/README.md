---
id: axi-docs-en-projects-ielts-vocab
title: IELTS Vocabulary
type: project
status: published
tags: [Axi Docs, Projects, products, learning, microservices]
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

> Mirror of the project root `README.md` plus deep dives into the
> microservices layout, gateway BFF, and mac-bridge MCP surface.
> Source of truth:
> [`/Volumes/code/workspace/products/ielts-vocab/README.md`](/Volumes/code/workspace/products/ielts-vocab/README.md).
> Section: core / Partition: `products/`.

## Summary

IELTS Vocabulary is a single-product monorepo that delivers a 30-day IELTS
vocabulary learning experience across three clients (Web, React Native
Android/iOS, and a Mac-packaged Vite app) and a split microservice backend.
It is the only `products/` project in the Axi workspace whose canonical
local runtime is a fleet of nine FastAPI/Flask split services fronted by
a FastAPI gateway BFF, plus an independent Socket.IO speech service. The
project also ships a small MCP server (`packages/mac-bridge-mcp`) that
exposes health/log/launch controls for the local Mac runtime.

The Web stack is React 19 + TypeScript + Vite (`frontend/`) with a shared
client-core package (`packages/app-core`) used by both Web and Mobile.
The Mobile stack is React Native under `apps/mobile/` (Capacitor-era
folder was folded back into a unified React Native app per the root
`AGENTS.md`). The backend is split across nine services under `services/`
plus a gateway under `apps/gateway-bff/`, all backed by PostgreSQL via
SQLAlchemy; a Flask monolith entry (`backend/app.py`) and a
Socket.IO speech entry (`backend/speech_service.py`) remain for
compatibility/rollback drills only.

The project has been through Wave 1–6 closeouts; the current focus is
keeping the post-Wave microservice baseline stable, finishing admin /
notes / ai projection cutover (Wave 5), and finalising the remote
release/deploy/preflight/smoke/storage-drill closeout. The PRD is split
across `README.md` (current capability) and `PRD.md` (formal scope);
verification commands live in `VERIFICATION.md` and the canonical
workspace command is `pnpm --dir frontend verify:repo-guards`.

**Stage**: live product (split backend is canonical; monolith kept as a
rollback surface).
**Canonical path**: `/Volumes/code/workspace/products/ielts-vocab`.

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

Do not split `services/` into a separate repository. Splitting `apps/mobile`
is allowed only via an explicit native-split decision in the future. New
clients land under `apps/*` (e.g. `apps/miniprogram` for a future WeChat
mini-program).

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

The root `VERIFICATION.md` notes that the last full
`verify:repo-guards` re-run was on 2026-08-23 and that the owner must
re-run it to confirm current frontend verification still passes.

## Architecture Highlights

The split-runtime architecture is the load-bearing decision in this
project. The root `AGENTS.md` is explicit: split backend is the
canonical local path; the Flask monolith and the
`start-monolith-compat.sh` script remain only for rollback drills
(e.g. Wave 6C compatibility drill presetting `--monolith-compat-surface
rollback` narrows to `tts-admin` and switches the readiness canary to
`/api/tts/books-summary`). Each microservice in `services/*/main.py` is
a thin shell: it loads split-service env, mounts a per-domain Flask
app via `platform_sdk.<service>_runtime.create_<service>_flask_app()`,
then wraps it with `a2wsgi.WSGIMiddleware` and mounts it inside a
FastAPI `create_service_shell_app` so `/ready`, `/health`, and the
service-specific readiness checks are exposed uniformly. The shared
Python SDK at `packages/platform-sdk/platform_sdk/` is therefore the
de-facto contract layer between services — every cross-service call
(`identity_admin_internal_client.py`, `learning_core_internal_client.py`,
`catalog_content_internal_client.py`) is a typed client over the
service-internal `/internal/*` routes defined there.

The gateway BFF (`apps/gateway-bff/main.py`) is the only browser
ingress. It proxies `/api/*` to the right split service via
`platform_sdk.gateway_browser_routes`, and uses
`platform_sdk.gateway_media_proxy` to forward TTS audio, word audio,
follow-read chunked audio, and ASR uploads. The Vite config
(`frontend/vite.config.ts`) matches the gateway boundary exactly: dev
proxies `/api -> 127.0.0.1:8000` and `/socket.io -> 127.0.0.1:5001`,
preview applies the same rules, and the production-style local proxy
chain (nginx → vite preview → gateway → split services) is described
in the root `README.md` and operationalised in `nginx.conf.example`.

Eventing is event-sourced via outbox publishers and grouped domain
workers. `start-microservices.sh` boots a canonical worker set:
`core-eventing-worker` (identity eventing), `notes-domain-worker`,
`ai-execution-domain-worker`, and `admin-ops-domain-worker`. Each
worker is a standalone Python entry (`services/<svc>/domain_worker.py`
or `eventing_worker.py`) that consumes from RabbitMQ and materialises
into service-owned projection tables (e.g. `notes_projected_study_sessions`,
`notes_projected_wrong_words`, `ai_projected_daily_summaries`,
`admin_projected_users`). The Wave 5 closeout (see
`packages/platform-sdk/platform_sdk/wave5_projection_cutover.py` and
`scripts/run-wave5-projection-cutover.py`) replaced direct shared-table
reads in `admin`, `notes`, and `ai` with projection-first reads gated
on bootstrap-marker cursors so projection parity is a controlled
switch, not a count check.

The Mac-app launcher and mac-bridge MCP are the operator surface for
this project. `scripts/run-mac-local-app.sh` generates
`IELTS Vocab Dev.app` and `IELTS Vocab Preview.app` shells that wrap
the Vite binary and open via the system Application launcher; logs go
to `logs/runtime/mac-app/dev.*.log` (or `preview.*.log`). The
`packages/mac-bridge-mcp` server (`server.py`) exposes four MCP tools —
`check_services`, `get_logs`, `launch_app`, `kill_app` — that read the
same `SERVICES` table (frontend-dev/preview, gateway-bff, eight split
services, asr-socketio) used by the manual `curl /ready` probes, so
agents and humans see the same health snapshot. This is also the only
project that ships an MCP surface for its own runtime; the standard
contract is that stable shared capabilities become MCP surfaces, not
every business repo.

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

See `docs/state/MILESTONE.md` and `docs/milestone/` for full Wave
history.

## Notes

- The Mac-app launcher pattern (`scripts/run-mac-local-app.sh`) is specific to this repo; do not propagate to other products without an explicit owner request.
- The `_graph/`-style legacy `_view/` rollback shell pattern from `products/story-graph` does not apply here — `ielts-vocab` has no legacy single-page shell to retire.
- `mac-bridge` MCP is the only project-level MCP surface in `products/`; treat it as a stable contract (4 tools, 12 known services) before adding new ones.
- The `Wave 5 cutover` validation drill (`scripts/run-wave5-projection-cutover.py`) is the operator entry for `admin / notes / ai` projection parity.

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
- `mac-bridge` MCP is the only project-level MCP surface in `products/`; treat it as a stable contract (4 tools, 12 known services) before adding new ones.
- The `Wave 5 closeout` work (`run-wave5-projection-cutover.py`, `scripts/cloud-deploy/*`) is the next wave and the only unfinished post-Wave 5 closure is the remote release/deploy/preflight/smoke/storage-drill closeout.