---
id: axi-docs-zh-projects-axi-video-downloader
title: Axi Video Downloader (Python + mitmproxy + ADB video capture)
type: project
status: published
tags: [Axi Docs, 项目, tools, python, mitmproxy, adb, flask, video-capture]
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

> 权威来源:`/Volumes/code/workspace/tools/axi-video-downloader/`。
> Partition:`tools/`。Branch:`dev`(干净)。Lifecycle:maintained
> (`docs/state/MILESTONE.md` M-CURRENT,doc-suite alignment)。
> 最近一次验证:2026-09-25。

## Summary

Axi Video Downloader 是一个 **仅本地运行** 的 Python 工具,组合
**mitmproxy**(TLS pass-through 视频抓取)、**uiautomator2**(Android 点击
/ 滚动自动化)、**ADB**(设备控制)、**Flask + Flask-SocketIO**(端口 5000
上的 Web UI)与 **SQLAlchemy on SQLite**(记录),用于从个人 Android 设备
批量抓取视频。用户通过 USB 连接手机(需开启 USB 调试并安装 mitmproxy CA),
打开 Web UI 再点 "开始抓取";orchestrator 在后台启动 `mitmdump` + 自定义
`mitm_proxy.py` add-on,通过 `am start` 在手机上打开目标 app,滚动视频列
表,逐个缩略图点击;mitmproxy add-on 拦截由此产生的视频响应,存入
`downloads/`(带 SHA-256 等效 checksum),并向 `video_fetcher.db` 写入一条
`Video` 行 + 每次点击的 `FetchProgress` 行。内置的 `_smart_fetch_loop`
自动检测视频列表末尾(连续 3 次空下载 → 抵达底部)并在连续 5 次失败后
中止。

架构将四个关注点清晰拆分:(1)`app.py` 是 Flask + SocketIO 表面,暴露一
个 REST 表面(`/api/status`、`/api/fetch/start|stop|pause|resume`、
`/api/videos`、`/api/downloads`、`/api/sessions`、
`/api/workflow/start|stop`、`/api/monitor/*`、`/api/download/*`、
`/api/devices`、`/api/check/start`),并向浏览器推送 `progress /
status_change / video_downloaded / error / workflow_*` 事件;(2)`main.py`
拥有 `VideoFetcher` 状态机(`IDLE / DETECTING / READY / RUNNING / PAUSED
/ STOPPED / COMPLETED / ERROR`)与 smart fetch loop;(3)`mitm_proxy.py`
向 mitmproxy 注册一个 `VideoCaptureAddon`,其 `request()` 按扩展名 / MIME
过滤 URL,`response()` 把响应体直接落到磁盘的 `downloads/` 下;(4)
`modules/workflow.py` 编排端到端 pipeline(`AppLauncher →
RealtimeVideoMonitor → DownloadManager → IntegrityChecker`),作为后台线
程通过 `/api/workflow/start|stop` 暴露。

"video-capture-records" 表面对应 `database.py` 中的 SQLAlchemy 层:三张表
(`videos`、`fetch_sessions`、`fetch_progress`)及其 repositories
(`VideoRepository`、`SessionRepository`、`ProgressRepository`)。Video 记录
包含 URL / filename / local_path / file_size / checksum / status(pending
/ downloading / completed / failed / skipped) / retry_count /
error_message / created_at / updated_at / downloaded_at / content_type /
request_headers / response_headers;fetch sessions 捕获批次总数 + config 快照;
fetch progress 以时间戳记录每次点击 / 验证动作。依据 `AGENTS.md` 与
`docs/HANDOFF.md`,该项目 **不是** 网络服务 —— 它不会大规模抓取第三方平台,
只拦截用户显式路由到本地 mitmproxy listener 的流量。

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

`docs/HANDOFF.md` 由 `docs/project-docs.manifest.json` 重新生成(见尾行
`> Generated from docs/project-docs.manifest.json; edit the manifest, then
regenerate this file.`)。

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

`config.py` 定义 `BASE_DIR`、`DOWNLOADS_DIR`、`CERTS_DIR`、`LOGS_DIR`、
`DATABASE_PATH = BASE_DIR / "video_fetcher.db"`,并在 import 时通过
`.mkdir(exist_ok=True)` 创建所有三个目录。

## Verification

依据 `AGENTS.md` "Verification" 与 `docs/HANDOFF.md`:

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

完整的运行时 smoke(ADB connect、mitmproxy capture、video download)**需要**
真实的 Android 设备 + 已安装的 mitmproxy CA;`AGENTS.md` 与 `docs/HANDOFF.md`
将其标注为已知失败:验证过程被刻意限定为 compile + import check。

## Architecture Highlights

**Single global `VideoFetcher` orchestrating device + proxy + DB.**
`app.py:get_fetcher()` 使用 double-checked `threading.Lock` 懒构造
`fetcher = create_fetcher()`(来自 `main.py`),并把四个回调(`on_progress`、
`on_status_change`、`on_video_downloaded`、`on_error`)接入
`socketio.emit(...)`。`VideoFetcher` 持有 `FetchState`(`IDLE / DETECTING
/ READY / RUNNING / PAUSED / STOPPED / COMPLETED / ERROR`)、一个
`ThreadPoolExecutor(max_workers=3)`、`_stop_event`、`_pause_event`,以及
`current_session`(一个 SQLAlchemy `FetchSession` 行)。`_smart_fetch_loop`
首先调用 `_detect_video_count()`,它又调用
`uicontroller.get_video_count_from_ui()`(解析目标 app 的 UI 文本,例如
"视频 191"),随后循环 `_click_video(index)` + `time.sleep(click_timeout)`
+ `_check_new_download()`(匹配点击前后的 `capture_manager.downloaded_count`
以决定点击是否产出视频)。连续 3 次空下载或 5 次连续失败即终止循环。整个
循环通过 `start_session()` 提交到 executor,作为后台线程运行;
`pause_session()` / `resume_session()` 翻转 `_pause_event.clear() / set()`。

**mitmproxy add-on with TLS pass-through (no cert required).**
`mitm_proxy.py` 通过 `tls_clienthello` 把所有连接 opt 进
`ignore_connection`,因此 HTTPS 流量 **不被解密** —— add-on 只能看到明文
HTTP。`VideoCaptureAddon.request()` 用 MD5 哈希 `f"{url}{method}"`,通过
`self.captured_requests: Set[str]` 去重,并把 URL path 与
`mitm_config.VIDEO_EXTENSIONS = ['.mp4', '.flv', '.m3u8', '.avi', '.mov',
'.wmv', '.mkv']` **或** 把请求 Content-Type 与 `video_config.ALLOWED_MIME_TYPES`
匹配。命中后构建一个 `VideoRequest` dataclass,调用
`self.on_video_detected(...)`(经 `_on_video_downloaded` →
`VideoRepository.add(Video(...))`,在 `main.py`)。`VideoCaptureAddon.response()`
在响应是视频时把 body 直接写入 `downloads/`,省去从 URL 下载的额外往返。
`VideoCaptureManager` 是 subprocess wrapper,spawn `mitmdump -s mitm_proxy.py
--listen-port 8080`,把 stdout / stderr 接到 `mitm_output.txt` /
`mitm_error.txt`。`get_debug_info()` 向 `/api/debug` 暴露
`proxy_running / request_count / video_request_count / downloaded_count`。

**uiautomator2 + ADB as the device automation surface.** `uicontroller.py`
import `uiautomator2 as u2` 并以 `u2.connect(device_id)` 调用,在
`device_id is None` 时回退到 `'93ac8549'`。`UiController.connect()` 把
`device.info` 捕获到 `DeviceInfo` dataclass,暴露 `get_video_count_from_ui()`
(解析 UI 文本)、`get_video_position(index)`、`tap`、`swipe_down` 等。
`adb_controller.py` 独立 shell 出 `adb` 处理 uiautomator2 不覆盖的部分:
`find_adb_path()` 搜索一组常见路径与 `PATH`,`_run_adb(*args, timeout=10)`
是 `app.py` 用于 `/api/devices`、`/api/devices/connect_wifi`、
`/api/devices/disconnect`、`/api/devices/tcpip`、`/api/current-app`、
`/api/apps`、`/api/app/start|stop` 的 wrapper。`modules/app_launcher.py`
中的 `AppLauncher` 消费 `NavigationStep` 记录(`action / selector /
value / timeout`),在抓取 loop 之前把目标 app 驱动到一个已知页面。

**SQLAlchemy records + repository pattern.** `database.py` 声明
`Base = declarative_base()`,针对 `sqlite:///{DATABASE_PATH}` 创建 engine,
并暴露 `Video`、`FetchSession`、`FetchProgress` 加上 `VideoRepository`、
`SessionRepository`、`ProgressRepository`。`get_session()`
context-manager(`@contextmanager`)yield 一个 `scoped_session`,成功时
commit,异常时 rollback。`Video.to_dict()` serializer 是 Web UI 消费的
单一 shape —— 每个 `/api/videos*` 路由返回 `[v.to_dict() for v in videos]`。
SQLite 刻意保持单文件(`video_fetcher.db`),便于通过复制文件来备份;按
`AGENTS.md`,`*.db` / `*.sqlite*` 文件被 gitignore。

**End-to-end workflow as a backgrounded module.** `modules/workflow.py`
的 `VideoCaptureWorkflow` 在一个 `WorkflowConfig`(`target_package /
target_activity / navigation_steps / scroll_count / scroll_interval /
capture_timeout`)背后组合 `AppLauncher + RealtimeVideoMonitor +
DownloadManager + IntegrityChecker`。`app.py` 暴露
`POST /api/workflow/start`,构造一个新 workflow、把 `on_step_changed /
on_progress / on_video_detected / on_check_completed` 接到
`socketio.emit('workflow_*', ...)`,随后在 daemon `threading.Thread` 上
跑 `workflow.run()`,结果以 `workflow_completed` 发出。
`/api/workflow/stop` 调用 `workflow.stop()`。这是项目对不希望通过
`/api/fetch/*` 手动驱动抓取 loop 的调用者提供的最接近"headless capture
workflow"的形式。

**Web UI = static HTML + SocketIO.** `ui/templates/index.html` 是一个 single
SPA,带有 4 个 nav tab(完整工作流 / 手动控制 / 实时监控 / 已下载)。
`socket.io/4.7.2` 从 cdnjs 加载;所有实时更新以 SocketIO 事件到达
(`progress`、`status_change`、`video_downloaded`、`error`、`workflow_step`、
`workflow_progress`、`video_detected`、`check_completed`、`workflow_completed`)。
`/api` 下的 REST surface 在 `app.py` 中详尽列出
(`/api/status / /api/stats / /api/debug / /api/capture/{start,stop} /
/api/fetch/{start,stop,pause,resume,detect} / /api/videos[/{id}|/export] /
/api/sessions[/{id}] / /api/downloads[/{filename}] / /api/devices[/*]
/ /api/network/local_ip / /api/current-app / /api/apps / /api/app/
{start,stop} / /api/monitor/{status,clear,export} / /api/download/
{add,add_batch,status,start,stop,clear_completed,retry} / /api/check/
start / /api/workflow/{start,stop}`)。

**Configuration as static class values (not env-loaded).** `config.py`
定义 6 个 config 类(`AppConfig`、`MitmProxyConfig`、`ADBConfig`、
`DatabaseConfig`、`LogConfig`、`VideoConfig`、`FetchStrategyConfig`),
并把它们作为 module-level singletons 导出(`app_config`、`mitm_config`、
`adb_config`、`db_config`、`log_config`、`video_config`、`fetch_config`)。
`load_custom_config()` 是 `config_custom.yaml` 的 YAML loader,也是 config
触碰文件系统的唯一入口;`.env.example` 文档化
`FLASK_DEBUG / FLASK_SECRET_KEY / MITM_LISTEN_PORT / ADB_TIMEOUT /
DOWNLOAD_TIMEOUT / LOG_LEVEL`,但 `docs/HANDOFF.md` 把它标为已知失败:
`config.py` 当前并未真正加载这些 env vars。代码与 config 之间的单一绑定
发生在模块 import 时刻,所以 `config.py` 的编辑需要重启。

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

## 备注

- 项目 **不是** 网络服务 —— 它只拦截用户显式路由到本地 mitmproxy listener
  的流量。
- 完整的运行时 smoke(ADB connect、mitmproxy capture、video download)
  **需要** 真实 Android 设备 + 已安装的 mitmproxy CA;验证被刻意限定为
  compile + import check。
- `docs/HANDOFF.md` 由 `docs/project-docs.manifest.json` 自动生成;编辑
  manifest 后重新生成。
- `*.db` / `*.sqlite*` 文件被 gitignore;SQLite 刻意保持单文件,便于通过复
  制文件来备份。

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

- 兄弟工具项目:`/Volumes/code/workspace/tools/`(其他 workspace 工具)。
- 兄弟候选项目:`/Volumes/code/workspace/candidates/axi-file-preview`(也通过 Vite middleware 摄入视频文件;互补表面 —— 那个只读浏览,这个抓取)。
- Workspace governance:`/Volumes/code/workspace/foundation/workspace-governance/` —— 规范的项目注册;本项目的 `docs/project-docs.manifest.json` 由该工具生成。
- 由 `AGENTS.md` 引用的 ADR 索引:`/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`(ADR-001 至 ADR-010 —— governance repo as index plane、progressive naming、non-git root、agent context package、agent BFF ownership、gateway taxonomy、naming alias contract、personal-OS repo topology、workflow-first bounded agent、observability architecture)。
- 已知 personal-OS PRD 家族:`/Volumes/code/workspace/docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md` 由兄弟 `candidates/pelagic/PRD.md` 作为上游 L1 引用;本工具不直接依赖它,但共享"仅本地工具"姿态。