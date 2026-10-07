---
id: axi-docs-en-projects-axi-video-downloader
title: Axi Video Downloader (Python + mitmproxy + ADB video capture)
type: project
status: published
tags: [Axi Docs, Projects, tools, python, mitmproxy, adb, flask, video-capture]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Video Downloader
graph-tags: [Projects, tools, python, video-capture]
description: Personal local Python 3.12 tool that combines mitmproxy (TLS pass-through video capture), uiautomator2 (Android click automation), ADB (device control), Flask + Socket.IO (Web UI) and SQLAlchemy/SQLite (records) to batch-capture videos from a personal Android device.
project:
  id: axi-video-downloader
  partition: tools
  path: /Volumes/code/workspace/tools/axi-video-downloader
  source-section: reference
---

# Axi Video Downloader (Python + mitmproxy + ADB video capture)

> Source of truth: `/Volumes/code/workspace/tools/axi-video-downloader/`.
> Partition: `tools/`. Branch: `dev` (clean). Lifecycle: maintained
> (`docs/state/MILESTONE.md` M-CURRENT, doc-suite alignment).
> Last verified: 2026-09-25.

## Summary

Axi Video Downloader is a **local-only** Python tool that combines
**mitmproxy** (TLS pass-through video capture), **uiautomator2** (Android
click / scroll automation), **ADB** (device control), **Flask +
Flask-SocketIO** (Web UI on port 5000), and **SQLAlchemy on SQLite**
(records) to batch-capture videos from a personal Android device. The user
plugs a phone in over USB (with USB debugging enabled and the mitmproxy CA
installed), starts the Web UI, and clicks "开始抓取"; the orchestrator
launches `mitmdump` with a custom `mitm_proxy.py` add-on in the background,
opens the target app on the phone via `am start`, scrolls a video list,
taps each thumbnail, and the mitmproxy add-on intercepts the resulting
video responses, persists them to `downloads/` with a SHA-256-equivalent
checksum, and writes a `Video` row plus per-click `FetchProgress` row into
`video_fetcher.db`. A built-in `_smart_fetch_loop` auto-detects the end of
the video list (three consecutive empty downloads → bottom reached) and
aborts on five consecutive failures.

The architecture cleanly separates four concerns: (1) `app.py` is the
Flask + SocketIO surface, exposing a single REST surface (`/api/status`,
`/api/fetch/start|stop|pause|resume`, `/api/videos`, `/api/downloads`,
`/api/sessions`, `/api/workflow/start|stop`, `/api/monitor/*`,
`/api/download/*`, `/api/devices`, `/api/check/start`) and pushing
`progress / status_change / video_downloaded / error / workflow_*` events
back to the browser; (2) `main.py` owns the `VideoFetcher` state machine
(`IDLE / DETECTING / READY / RUNNING / PAUSED / STOPPED / COMPLETED /
ERROR`) and the smart fetch loop; (3) `mitm_proxy.py` registers a
`VideoCaptureAddon` with mitmproxy whose `request()` filters URLs by
extension / MIME and whose `response()` saves the response body directly
to disk under `downloads/`; (4) `modules/workflow.py` orchestrates the
end-to-end pipeline (`AppLauncher → RealtimeVideoMonitor → DownloadManager
→ IntegrityChecker`) as a background thread exposed through
`/api/workflow/start|stop`.

The "video-capture-records" surface is the SQLAlchemy layer in
`database.py`: three tables (`videos`, `fetch_sessions`, `fetch_progress`)
plus their repositories (`VideoRepository`, `SessionRepository`,
`ProgressRepository`). Video records carry URL / filename / local_path /
file_size / checksum / status (pending / downloading / completed / failed /
skipped) / retry_count / error_message / created_at / updated_at /
downloaded_at / content_type / request_headers / response_headers; fetch
sessions capture batch totals + config snapshot; fetch progress logs each
click / verify action with timestamp. Per `AGENTS.md` and `docs/HANDOFF.md`,
the project is **not** a network service — it does not scrape third-party
platforms at scale, it only intercepts traffic the user explicitly routed
through the local mitmproxy listener.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Runtime | Python 3.8–3.13 (3.12 recommended for mitmproxy compatibility) | `requirements.txt` pins `mitmproxy>=10.0.0`; `README.md` requires Python 3.12 |
| Web framework | Flask ≥ 2.3.0 + Flask-SocketIO ≥ 5.3.0 + flask-cors ≥ 4.0.0 | `app.py:39-57` creates `Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)`, `CORS(app)`, `SocketIO(app, cors_allowed_origins="*", async_mode="threading")` |
| Proxy / capture | mitmproxy ≥ 10.0.0 | `mitm_proxy.py` provides `VideoCaptureAddon` (filter) + `VideoCaptureManager` (subprocess wrapper for `mitmdump -s mitm_proxy.py`); uses `tls_clienthello` to opt all connections into `ignore_connection` (TLS pass-through, no certificate required) |
| Networking / HTTP | `requests` ≥ 2.31.0, `urllib3` ≥ 2.0.0 | `requests` used by `DownloadManager` for HEAD/GET; `urllib3` baseline |
| Database | SQLAlchemy ≥ 2.0.0 on SQLite (`video_fetcher.db`) | Declarative base + `scoped_session` + context-managed `get_session()` |
| Android automation | uiautomator2 ≥ 2.16.0 (`u2.Device`), plus raw `adb` subprocess calls from `adb_controller.py` and `modules/app_launcher.py` | Default device ID hardcoded fallback `'93ac8549'` in `uicontroller.py:71` |
| Utilities | python-dotenv ≥ 1.0.0, tqdm ≥ 4.65.0, colorlog ≥ 6.7.0 | tqdm / colorlog imported but not heavily used in `app.py` / `main.py` |
| HTML / JS / CSS | `ui/templates/index.html` (single template, ~700 lines of static structure) + `ui/static/js/main.js` + `ui/static/css/style.css` | `index.html` loads `socket.io/4.7.2` from cdnjs; 4 nav tabs (完整工作流 / 手动控制 / 实时监控 / 已下载) |
| Logging | stdlib `logging` + `utils/logger.py` `get_logger(__name__)` | File log: `logs/video_fetcher.log` (10 MB × 5 backup); level via `LogConfig.LEVEL = "INFO"` |

## Project Layout

```text
axi-video-downloader/
├── AGENTS.md                          # root agent rules + cross-project boundaries
├── README.md / README.zh-CN.md        # bilingual entrypoint
├── CLAUDE.md                          # redirect to AGENTS.md
├── INDEX.md                           # document map
├── CHANGELOG.md                       # canonical change log (Keep a Changelog)
├── CHANGE.md                          # pointer to docs/state/CHANGELOG.md (AR-BOOTSTRAP-002.1)
├── TODO.md                            # TODO-T-001, TODO-T-002 backlog
├── MILESTONE.md                       # pointer to docs/state/MILESTONE.md
├── __init__.py                        # package re-exports of config singletons
├── config.py                          # AppConfig / MitmProxyConfig / ADBConfig
│                                      # / DatabaseConfig / LogConfig /
│                                      # VideoConfig / FetchStrategyConfig
├── requirements.txt                   # 10 pinned deps (Flask / mitmproxy / SQLAlchemy …)
├── adb_controller.py                  # `find_adb_path()` + ADB subprocess helpers
├── app.py                             # Flask + SocketIO entrypoint (1251 lines)
├── database.py                        # SQLAlchemy models + repositories (451 lines)
├── main.py                            # `VideoFetcher` + `_smart_fetch_loop` (720 lines)
├── mitm_proxy.py                      # `VideoCaptureAddon` + `VideoCaptureManager` (677 lines)
├── uicontroller.py                    # uiautomator2 `UiController` (603 lines)
├── certs/                             # empty; reserved for `mitmproxy-ca.pem`
├── downloads/                         # runtime output (gitignored)
├── logs/                              # runtime log files (gitignored)
├── __pycache__/                       # gitignored
├── modules/                           # workflow modules
│   ├── __init__.py
│   ├── app_launcher.py                # `AppLauncher` + `NavigationStep` (532 lines)
│   ├── integrity_checker.py           # MD5/size/duration verification (402 lines)
│   ├── realtime_monitor.py            # `RealtimeVideoMonitor` (268 lines)
│   ├── video_downloader.py            # `DownloadManager` + `DownloadTask` (441 lines)
│   └── workflow.py                    # `VideoCaptureWorkflow` orchestrator (369 lines)
├── utils/
│   ├── __init__.py
│   └── logger.py                      # `get_logger()` factory
├── ui/
│   ├── templates/index.html           # single SPA template (4 tabs)
│   └── static/{css/style.css, js/main.js}
└── docs/
    ├── HANDOFF.md                     # zero-context handoff (auto-generated from manifest)
    ├── project-docs.manifest.json     # v2 manifest (kind, entrypoints, contracts)
    └── state/
        ├── CHANGELOG.md               # canonical state log
        ├── MILESTONE.md               # M-0 + M-CURRENT dashboard
        ├── PRD.md                     # REQ-DOC-001 / REQ-VERIFY-001 / REQ-BOUNDARY-001
        ├── TDD.md                     # verification commands + tech design
        ├── TODO.md                    # mirrors TODO.md
        └── VERIFICATION.md            # last verified at 2026-09-25
```

`docs/HANDOFF.md` is regenerated from `docs/project-docs.manifest.json`
(see the closing line: `> Generated from docs/project-docs.manifest.json;
edit the manifest, then regenerate this file.`).

## Build & Install

```bash
# 1) Create venv (Python 3.12 recommended)
python3.12 -m venv .venv312
source .venv312/bin/activate    # Windows: .\.venv312\Scripts\Activate.ps1

# 2) Install
pip install -r requirements.txt

# 3) (Optional) install mitmproxy separately if not pulled in
pip install mitmproxy
mitmdump --version              # should print mitmproxy version

# 4) Prepare the phone:
#    - enable USB debugging
#    - install + trust the mitmproxy CA on the phone
#    - set the phone's Wi-Fi proxy to "host LAN IP:8080"

# 5) Start the tool
python app.py                   # → http://localhost:5000
```

`config.py` defines `BASE_DIR`, `DOWNLOADS_DIR`, `CERTS_DIR`, `LOGS_DIR`,
`DATABASE_PATH = BASE_DIR / "video_fetcher.db"`, and creates all three
directories with `.mkdir(exist_ok=True)` on import.

## Verification

Per `AGENTS.md` "Verification" and `docs/HANDOFF.md`:

```bash
# Compile check (every *.py)
python -m py_compile app.py main.py config.py database.py adb_controller.py \
  mitm_proxy.py uicontroller.py __init__.py modules/*.py utils/*.py

# Import smoke
python -c "import axi_video_downloader; print(axi_video_downloader.__version__)"
# (1.0.0 per __init__.py)

# Doc integrity
for f in README.md README.zh-CN.md AGENTS.md INDEX.md \
         docs/state/CHANGELOG.md docs/state/TODO.md \
         docs/state/MILESTONE.md docs/state/PRD.md docs/state/TDD.md; do
  test -f "$f" || exit 1
done

# Optional: run the Web UI
python app.py
curl http://localhost:5000/api/status
```

The full runtime smoke (ADB connect, mitmproxy capture, video download)
**requires** a real Android device + the mitmproxy CA installed on it,
which `AGENTS.md` and `docs/HANDOFF.md` flag as known failures: the
verification pass is intentionally a compile + import check.

## Architecture Highlights

**Single global `VideoFetcher` orchestrating device + proxy + DB.**
`app.py:get_fetcher()` uses a double-checked `threading.Lock` to lazily
build `fetcher = create_fetcher()` from `main.py` and wires four
callbacks (`on_progress`, `on_status_change`, `on_video_downloaded`,
`on_error`) into `socketio.emit(...)`. `VideoFetcher` owns `FetchState`
(`IDLE / DETECTING / READY / RUNNING / PAUSED / STOPPED / COMPLETED /
ERROR`), a `ThreadPoolExecutor(max_workers=3)`, a `_stop_event`, a
`_pause_event`, and a `current_session` (a SQLAlchemy `FetchSession`
row). `_smart_fetch_loop` first calls `_detect_video_count()` which
delegates to `uicontroller.get_video_count_from_ui()` (parses the
target app's UI text e.g. "视频 191"), then loops `_click_video(index)`
followed by `time.sleep(click_timeout)` and `_check_new_download()`
(matches `capture_manager.downloaded_count` before/after the click to
decide if the click produced a video). Three consecutive empty
downloads or five consecutive failures end the loop. The whole loop is
submitted to the executor from `start_session()` so it runs as a
background thread; `pause_session()` / `resume_session()` flip
`_pause_event.clear() / set()`.

**mitmproxy add-on with TLS pass-through (no cert required).**
`mitm_proxy.py` opts every connection into `ignore_connection` via
`tls_clienthello` so HTTPS traffic is **not decrypted** — the add-on
can only see plaintext HTTP. `VideoCaptureAddon.request()` hashes
`f"{url}{method}"` with MD5, dedups via `self.captured_requests: Set[str]`,
and matches the URL path against
`mitm_config.VIDEO_EXTENSIONS = ['.mp4', '.flv', '.m3u8', '.avi',
'.mov', '.wmv', '.mkv']` **or** the request Content-Type against
`video_config.ALLOWED_MIME_TYPES`. On match it builds a `VideoRequest`
dataclass and calls `self.on_video_detected(...)` (which routes through
`_on_video_downloaded` → `VideoRepository.add(Video(...))` in
`main.py`). `VideoCaptureAddon.response()` writes the response body
directly to `downloads/` when the response is a video, avoiding the
extra round-trip of downloading from a URL. `VideoCaptureManager` is
the subprocess wrapper that spawns `mitmdump -s mitm_proxy.py
--listen-port 8080` and pipes stdout/stderr to `mitm_output.txt` /
`mitm_error.txt`. `get_debug_info()` exposes `proxy_running /
request_count / video_request_count / downloaded_count` for
`/api/debug`.

**uiautomator2 + ADB as the device automation surface.** `uicontroller.py`
imports `uiautomator2 as u2` and calls `u2.connect(device_id)` with a
fallback to `'93ac8549'` when `device_id is None`. `UiController.connect()`
captures `device.info` into a `DeviceInfo` dataclass and exposes
`get_video_count_from_ui()` (parses UI text), `get_video_position(index)`,
`tap`, `swipe_down`, etc. `adb_controller.py` separately shells out to
`adb` for things uiautomator2 doesn't cover: `find_adb_path()` searches
a list of common paths and `PATH`, and `_run_adb(*args, timeout=10)` is
the wrapper that `app.py` uses for `/api/devices`, `/api/devices/
connect_wifi`, `/api/devices/disconnect`, `/api/devices/tcpip`,
`/api/current-app`, `/api/apps`, `/api/app/start|stop`. The
`AppLauncher` in `modules/app_launcher.py` consumes `NavigationStep`
records (`action / selector / value / timeout`) to drive the target app
to a known page before the capture loop runs.

**SQLAlchemy records + repository pattern.** `database.py` declares
`Base = declarative_base()`, creates the engine against
`sqlite:///{DATABASE_PATH}`, and exposes `Video`,
`FetchSession`, `FetchProgress` plus `VideoRepository`,
`SessionRepository`, `ProgressRepository`. A `get_session()`
context-manager (`@contextmanager`) yields a `scoped_session` and
commits on success / rolls back on exception. The `Video.to_dict()`
serializer is the single shape consumed by the Web UI — every
`/api/videos*` route returns `[v.to_dict() for v in videos]`. SQLite
is intentionally single-file (`video_fetcher.db`) so the project can be
backed up by copying the file; per `AGENTS.md`, the `*.db` /
`*.sqlite*` files are gitignored.

**End-to-end workflow as a backgrounded module.** `modules/workflow.py`
`VideoCaptureWorkflow` composes `AppLauncher + RealtimeVideoMonitor +
DownloadManager + IntegrityChecker` behind a single `WorkflowConfig`
(`target_package / target_activity / navigation_steps / scroll_count /
scroll_interval / capture_timeout`). `app.py` exposes
`POST /api/workflow/start` which builds a fresh workflow, wires
`on_step_changed / on_progress / on_video_detected / on_check_completed`
to `socketio.emit('workflow_*', ...)`, then runs `workflow.run()` on a
daemon `threading.Thread` whose result is emitted as
`workflow_completed`. `/api/workflow/stop` calls `workflow.stop()`.
This is the closest the project gets to a "headless capture workflow"
for callers who don't want to drive the fetch loop manually through
`/api/fetch/*`.

**Web UI = static HTML + SocketIO.** `ui/templates/index.html` ships a
single SPA with four nav tabs (完整工作流 / 手动控制 / 实时监控 /
已下载). `socket.io/4.7.2` is loaded from cdnjs; all live updates
arrive as SocketIO events (`progress`, `status_change`,
`video_downloaded`, `error`, `workflow_step`, `workflow_progress`,
`video_detected`, `check_completed`, `workflow_completed`). The
rest surface under `/api` is exhaustively listed in `app.py`
(`/api/status / /api/stats / /api/debug / /api/capture/{start,stop} /
/api/fetch/{start,stop,pause,resume,detect} / /api/videos[/{id}|/export] /
/api/sessions[/{id}] / /api/downloads[/{filename}] / /api/devices[/*]
/ /api/network/local_ip / /api/current-app / /api/apps / /api/app/
{start,stop} / /api/monitor/{status,clear,export} / /api/download/
{add,add_batch,status,start,stop,clear_completed,retry} / /api/check/
start / /api/workflow/{start,stop}`).

**Configuration as static class values (not env-loaded).**
`config.py` defines six classes (`AppConfig`, `MitmProxyConfig`,
`ADBConfig`, `DatabaseConfig`, `LogConfig`, `VideoConfig`,
`FetchStrategyConfig`) and exports their instances as module-level
singletons (`app_config`, `mitm_config`, `adb_config`, `db_config`,
`log_config`, `video_config`, `fetch_config`). `load_custom_config()`
is a YAML loader for `config_custom.yaml` but is the only thing that
touches the filesystem for config; `.env.example` documents
`FLASK_DEBUG / FLASK_SECRET_KEY / MITM_LISTEN_PORT / ADB_TIMEOUT /
DOWNLOAD_TIMEOUT / LOG_LEVEL` but `docs/HANDOFF.md` flags this as a
known failure: `config.py` does not currently load those env vars. The
single binding between code and config lives at module import time, so
edits to `config.py` require a restart.

## Key Modules/Files

| Module / file | Role | Lines |
| --- | --- | --- |
| `app.py` | Flask + SocketIO entrypoint on `0.0.0.0:5000`; wires fetcher / monitor / downloader / workflow singletons with double-checked locks; exposes ~30 REST routes + 4 SocketIO handlers + 404/500 error handlers; `run_server()` calls `socketio.run(app, allow_unsafe_werkzeug=True)` | 1251 |
| `main.py` | `VideoFetcher` orchestrator + `_smart_fetch_loop` (background thread) + `FetchConfig` / `FetchStats` / `FetchState` dataclasses; `start_session / stop_session / pause_session / resume_session / detect_video_count / start_proxy_only / stop_proxy_only`; CLI entrypoint `main()` writes progress to stdout | 720 |
| `mitm_proxy.py` | `VideoCaptureAddon` (mitmproxy add-on, request + response hooks, MD5 dedup, video extension / MIME filter, response body save) + `VideoCaptureManager` (subprocess wrapper for `mitmdump -s mitm_proxy.py`); uses `tls_clienthello` for TLS pass-through (no cert required); exposes `get_debug_info()` for `/api/debug` | 677 |
| `uicontroller.py` | `UiController` wrapping `uiautomator2.Device` (connect / disconnect / tap / swipe_down / swipe_up / get_screen_size / get_video_count_from_ui / get_video_position) + `VideoInfo` / `DeviceInfo` / `UiAutomator2Error` dataclasses; hardcodes fallback `device_id='93ac8549'` | 603 |
| `adb_controller.py` | `find_adb_path()` (searches common Windows / PATH locations) + low-level subprocess wrappers (`adb devices -l`, `adb connect / disconnect / tcpip`, `adb shell pm list packages -3`, `adb shell dumpsys window windows`, `adb shell am start ...`, `adb shell am force-stop`) | 606 |
| `database.py` | SQLAlchemy `Base / engine / SessionLocal / scoped_session` + `Video` / `FetchSession` / `FetchProgress` models + `VideoRepository` / `SessionRepository` / `ProgressRepository` + `@contextmanager get_session()`; `Video.to_dict()` is the API shape | 451 |
| `modules/workflow.py` | `VideoCaptureWorkflow` orchestrator composing `AppLauncher + RealtimeVideoMonitor + DownloadManager + IntegrityChecker` behind `WorkflowConfig` + 5 callbacks (`on_step_changed / on_progress / on_video_detected / on_check_completed / on_error`) | 369 |
| `modules/app_launcher.py` | `AppLauncher` + `NavigationStep` + `DeviceInfo`; USB / WiFi connect, `tcpip` mode, app launch via `cmd package resolve-activity` + `am start -n <pkg>/<activity> -f 0x20000000`, dumpsys window introspection | 532 |
| `modules/video_downloader.py` | `DownloadManager` + `DownloadTask` (priority queue, `Queue`, `ThreadPoolExecutor`, `max_workers=3`); supports ffmpeg for m3u8 streams; `add_task / add_tasks_from_list / start / stop / clear_completed / retry_failed / get_stats / get_task_list` | 441 |
| `modules/integrity_checker.py` | `IntegrityChecker` + `VideoCheckResult` + `Report`; checks file size / MD5 / duration; `load_manifest_from_json / check_all_videos / check_local_directory / print_report / export_report` | 402 |
| `modules/realtime_monitor.py` | `RealtimeVideoMonitor` + `VideoMetadata`; receives mitmproxy events in real time, holds in-memory list; `is_monitoring / get_video_count / get_video_list / clear / export_to_json` | 268 |
| `config.py` | 6 config classes + module-level singletons (`app_config`, `mitm_config`, `adb_config`, `db_config`, `log_config`, `video_config`, `fetch_config`); `BASE_DIR / DOWNLOADS_DIR / CERTS_DIR / LOGS_DIR / DATABASE_PATH / TEMPLATES_DIR / STATIC_DIR`; `load_custom_config()` for `config_custom.yaml` | 247 |
| `__init__.py` | Package re-exports: `__version__ = "1.0.0"`, `BASE_DIR`, `DOWNLOADS_DIR`, `DATABASE_PATH`, all 6 config singletons | 36 |
| `utils/logger.py` | `get_logger(name)` factory (colorlog + rotating file handler at `logs/video_fetcher.log`, 10 MB × 5 backup) | 99 |
| `ui/templates/index.html` | Single SPA template with header, 4-tab nav (workflow / manual / monitor / downloads), SocketIO bootstrap from cdnjs | small (template only) |
| `ui/static/js/main.js` + `ui/static/css/style.css` | Live progress display, SocketIO event subscriptions, tab switching | small |
| `docs/HANDOFF.md` | Auto-generated from manifest; zero-context handoff: 90-second read order, entrypoints, commands, environment, contracts, troubleshooting, freshness | ~110 |
| `docs/project-docs.manifest.json` | v2 manifest: `kind: local-android-video-capture-tool`, entrypoints (`web-ui / capture-controller / capture-addon / device-controller / database / workflow-orchestrator`), read order, contracts | medium |
| `docs/state/{PRD.md,TDD.md,MILESTONE.md,CHANGELOG.md,TODO.md,VERIFICATION.md}` | doc-suite aligned with deep-init-pro standard; `PRD` = REQ-DOC-001 / REQ-VERIFY-001 / REQ-BOUNDARY-001 / REQ-MILESTONE-001 | small |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| M-0 | Workspace governance scaffolding (`AGENTS.md`, `INDEX.md`, `CLAUDE.md`, doc-suite under `docs/state/`) | Done |
| M-CURRENT | Doc-suite alignment with deep-init-pro standard; bilingual entrypoint | Done (last verified 2026-09-25) |
| TODO-T-001 | Replace hardcoded fallback `device_id='93ac8549'` in `uicontroller.py:71` | Open |
| TODO-T-002 | Wire `config.py` to actually load `FLASK_DEBUG / FLASK_SECRET_KEY / MITM_LISTEN_PORT / ADB_TIMEOUT / DOWNLOAD_TIMEOUT / LOG_LEVEL` from `.env` | Open |

## Notes

- The project is **not** a network service — it only intercepts traffic the user explicitly routed through the local mitmproxy listener.
- The full runtime smoke (ADB connect, mitmproxy capture, video download) **requires** a real Android device + the mitmproxy CA installed on it; verification is intentionally a compile + import check.
- `docs/HANDOFF.md` is auto-generated from `docs/project-docs.manifest.json`; edit the manifest, then regenerate.
- `*.db` / `*.sqlite*` files are gitignored; SQLite is intentionally single-file so the project can be backed up by copying the file.

## Authoritative Documents

- [`/Volumes/code/workspace/tools/axi-video-downloader/README.md`](/Volumes/code/workspace/tools/axi-video-downloader/README.md) — English entrypoint
- [`/Volumes/code/workspace/tools/axi-video-downloader/README.zh-CN.md`](/Volumes/code/workspace/tools/axi-video-downloader/README.zh-CN.md) — Simplified Chinese entrypoint
- [`/Volumes/code/workspace/tools/axi-video-downloader/AGENTS.md`](/Volumes/code/workspace/tools/axi-video-downloader/AGENTS.md) — root agent rules, project boundary, cross-project boundary, verification
- [`/Volumes/code/workspace/tools/axi-video-downloader/INDEX.md`](/Volumes/code/workspace/tools/axi-video-downloader/INDEX.md) — document map
- [`/Volumes/code/workspace/tools/axi-video-downloader/docs/HANDOFF.md`](/Volumes/code/workspace/tools/axi-video-downloader/docs/HANDOFF.md) — zero-context handoff (generated from manifest)
- [`/Volumes/code/workspace/tools/axi-video-downloader/docs/project-docs.manifest.json`](/Volumes/code/workspace/tools/axi-video-downloader/docs/project-docs.manifest.json) — v2 manifest
- [`/Volumes/code/workspace/tools/axi-video-downloader/docs/state/PRD.md`](/Volumes/code/workspace/tools/axi-video-downloader/docs/state/PRD.md) — requirements
- [`/Volumes/code/workspace/tools/axi-video-downloader/docs/state/TDD.md`](/Volumes/code/workspace/tools/axi-video-downloader/docs/state/TDD.md) — tech design + verification
- [`/Volumes/code/workspace/tools/axi-video-downloader/docs/state/MILESTONE.md`](/Volumes/code/workspace/tools/axi-video-downloader/docs/state/MILESTONE.md) — M-0 + M-CURRENT dashboard
- [`/Volumes/code/workspace/tools/axi-video-downloader/config.py`](/Volumes/code/workspace/tools/axi-video-downloader/config.py) — runtime configuration
- [`/Volumes/code/workspace/tools/axi-video-downloader/requirements.txt`](/Volumes/code/workspace/tools/axi-video-downloader/requirements.txt) — Python dependencies
- [`/Volumes/code/workspace/tools/axi-video-downloader/app.py`](/Volumes/code/workspace/tools/axi-video-downloader/app.py) — Flask + SocketIO entrypoint
- [`/Volumes/code/workspace/tools/axi-video-downloader/main.py`](/Volumes/code/workspace/tools/axi-video-downloader/main.py) — capture controller
- [`/Volumes/code/workspace/tools/axi-video-downloader/mitm_proxy.py`](/Volumes/code/workspace/tools/axi-video-downloader/mitm_proxy.py) — mitmproxy add-on
- [`/Volumes/code/workspace/tools/axi-video-downloader/database.py`](/Volumes/code/workspace/tools/axi-video-downloader/database.py) — records schema

## Cross-References

- Sibling tool project: `/Volumes/code/workspace/tools/` (other workspace tools).
- Sibling candidate project: `/Volumes/code/workspace/candidates/axi-file-preview` (also ingests video files via a Vite middleware; complementary surface — that one is read-only browsing, this one is capture).
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance/` — the canonical project registry; this project's `docs/project-docs.manifest.json` is generated by that tool.
- ADR index referenced from `AGENTS.md`: `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/` (ADR-001 through ADR-010 — governance repo as index plane, progressive naming, non-git root, agent context package, agent BFF ownership, gateway taxonomy, naming alias contract, personal-OS repo topology, workflow-first bounded agent, observability architecture).
- Known personal-OS PRD family: `/Volumes/code/workspace/docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md` is referenced from sibling `candidates/pelagic/PRD.md` as upstream L1; this tool does not depend on it directly but shares the local-only tool posture.