---
id: axi-docs-en-projects-opencodex
title: OpenCodex Reference
type: project
status: published
tags: [Axi Docs, Projects, references, reference, codex, computer-use, mcp, macos, gateway]
created: 2026-10-07
modified: 2026-10-07
graph-title: OpenCodex Reference
graph-tags: [Projects, references, codex, computer-use]
description: Local Node.js gateway plus macOS wrapper app that unlocks `Codex Desktop` for third-party APIs (`MiniMax`, `DeepSeek`, OpenAI-compatible proxies), hosts a glassmorphic provider-switching dashboard, and ships a custom `Computer Use` engine that exposes native macOS mouse / keyboard / window control as MCP tools. Single runtime dep `@modelcontextprotocol/sdk ^1.6.0`; entrypoint `src/server.ts`; computer-use via `src/cu/actions.ts` + `src/cu/screenshot.ts`; macOS wrapper `scripts/macos-app/OpenCodexApp.swift`; quota-aware worker loop `scripts/minimax-axi-todo-loop.mjs`.
project:
  id: opencodex
  partition: references
  path: /Volumes/code/workspace/references/short-term/opencodex
  source-section: reference
---

# OpenCodex Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/short-term/opencodex`.
> Section: reference / Partition: `references/`.

## Summary

`OpenCodex` is a local Node.js gateway + macOS wrapper app that unlocks Codex Desktop for third-party APIs (MiniMax, DeepSeek, OpenAI-compatible proxies), hosts a glassmorphic provider-switching dashboard, and ships a custom **Computer Use** engine that exposes native macOS mouse / keyboard / window control as MCP tools. It is also the only reference repo in this batch that ships two end-user surfaces from one TypeScript build: an HTTP/SSE proxy that Codex Desktop talks to in place of `chatgpt.com/backend-api/codex` (`src/proxy/index.ts`), and a Swift / WebKit wrapper app (`scripts/macos-app/OpenCodexApp.swift`) that boots the proxy and embeds the dashboard inside a native macOS window. The repo's headline integration is its **MiniMax Axi Todo Loop** (`scripts/minimax-axi-todo-loop.mjs`), a quota-gated worker loop that queries the MiniMax Token Plan quota endpoint, claims tasks from `axi-todo`, dispatches `codex exec` workers with `MiniMax-M3` / `MiniMax-M2.7-highspeed`, and updates the Axi Todo store on completion — proof that the same proxy can drive both an interactive Codex Desktop and headless worker loops behind a single auth surface.

For Axi, OpenCodex is the canonical reference for three things that nothing else in this batch covers. First, it shows how to put a local, isolated proxy in front of an existing desktop product (Codex Desktop) without forking it: the proxy listens on `OPENCODEX_PORT` (default 8765), translates `chat.completions` ↔ OpenAI `responses` (`src/proxy/translator.ts`, 1181 LOC), streams SSE logs to the dashboard (`addLog` + `activeSseClients` in `proxy/index.ts` lines 76-94), and writes Codex-side docs into context (`PROJECT_DOC_FALLBACK_FILENAMES = '["CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]'`, `PROJECT_DOC_MAX_BYTES = 65536` — `proxy/index.ts` lines 39-49). Second, it shows how to expose macOS-native primitives as MCP tools without a heavyweight accessibility framework: `src/cu/actions.ts` writes a Swift script to `/tmp/oc-act-*.swift` and `spawnSync("/usr/bin/swift", …)` to invoke `CGEvent` (`mouseEventSource`, `mouseType`, `mouseCursorPosition`, `mouseButton`) for click / drag / scroll / type / key / window focus; `src/cu/screenshot.ts` does the same for `CGDisplayCreateImage(CGMainDisplayID())` with `screencapture` as the fallback. Third, it shows how to package a Node daemon inside a native macOS .app — `scripts/build-macos-app.sh` produces `dist-macos/OpenCodex.app`, the Swift `AppDelegate` (440 LOC) bootstraps the Node child process, redirects `SIGTERM`/`SIGINT` through `DispatchSource.makeSignalSource`, polls `/health` until the proxy responds, then loads the dashboard URL into a `WKWebView` (size 1180×780, `.titled | .closable | .miniaturizable | .resizable`).

Axi's own codex-related surfaces (`codex-local-gateway-reference`, `codex-computer-use-proxy-reference`, `macos-wrapper-app-reference`) should treat OpenCodex as the shape-of-the-art implementation. The patterns are: (a) provider registry as code in `BUILTIN_PRESETS` (`src/proxy/presets.ts`) with `auto_api_key` so credentials load from CC Switch / `~/.credentials/load-credentials.sh` / env vars, (b) Codex home isolation via `getCodexHome()` / `getNativeCodexHome()` plus symlinked session entries (`SHARED_CODEX_SESSION_ENTRIES` — `state_5.sqlite`, `session_index.jsonl`, `history.jsonl`, `sessions/`, `archived_sessions/`, `shell_snapshots/`), and (c) worker loop with quota awareness that drains the 5-hour window using `--drain-window --concurrency 3 --max-concurrency 8 --expected-worker-percent 8 --tail-min-remaining-percent 0.5` (`minimax-axi-todo-loop.mjs` defaults lines 17-24).

## Stack

`Node 18+`, `TypeScript`, `tsc`, `Express-style HTTP/SSE proxy`, `WKWebView`, `Swift (AppDelegate)`, `WebGPU`, `CGEvent`, `CGMainDisplayID`, `screencapture`, `@modelcontextprotocol/sdk ^1.6.0`, `codex exec`, `MiniMax Token Plan`, `CC Switch SQLite`, `load-credentials.sh`, `BUILTIN_PRESETS`, `chat.completions`, `responses`, `dist-macos/OpenCodex.app`

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 — HTTP/SSE proxy that front-ends Codex Desktop | shipped | `src/proxy/index.ts` (2942 LOC) + `src/proxy/translator.ts` (1181 LOC); listens on `OPENCODEX_PORT` (default 8765) |
| M2 — Glassmorphic dashboard + SSE log bus | shipped | `src/proxy/dashboard.ts` (1469 LOC) generated in-process; `addLog` + `activeSseClients` in `proxy/index.ts` lines 76-94 |
| M3 — Provider preset table + credential-resolution chain | shipped | `BUILTIN_PRESETS = { native-openai, ccswitch-gpt, minimax, deepseek }` in `src/proxy/presets.ts`; `resolveProviderApiKey` reads env → `~/.credentials/load-credentials.sh` → CC Switch SQLite |
| M4 — Codex home isolation + session-store symlinks | shipped | `ensureCodexLaunchHome()` + `SHARED_CODEX_SESSION_ENTRIES` (`state_5.sqlite`, `session_index.jsonl`, `history.jsonl`, `sessions/`, `archived_sessions/`, `shell_snapshots/`) |
| M5 — MCP server (Computer Use engine) | shipped | `src/server.ts` wires `MCP Server` with 8 tools: `screenshot`, `click`, `drag`, `scroll`, `page_scroll`, `type_text`, `press_key`, `get_windows`, `focus_window` |
| M6 — Computer Use engine (Swift-scripted) | shipped | `src/cu/actions.ts` (225 LOC) + `src/cu/screenshot.ts` (51 LOC); `CGEvent` + `CGDisplayCreateImage` + `screencapture` fallback; 10-15s timeout |
| M7 — macOS wrapper `.app` (Swift + WKWebView) | shipped | `scripts/macos-app/OpenCodexApp.swift` `AppDelegate` (440 LOC); bundles Node child + dashboard `WKWebView`; `// Codex Plus` flavor hides the window after readiness |
| M8 — Workspace doc injection for every Codex turn | shipped | `WORKSPACE_DOC_FILENAMES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]` + `WORKSPACE_DOC_MARKER = "opencodex:workspace-instructions"` |
| M9 — Quota-gated MiniMax Axi Todo Loop | shipped | `scripts/minimax-axi-todo-loop.mjs` (996 LOC); `--drain-window --concurrency 3 --max-concurrency 8 --expected-worker-percent 8 --tail-min-remaining-percent 0.5` |
| M10 — Reversible Codex provider registration | shipped | `scripts/enable-aggregate-codex-app.sh` (additive only) + `scripts/rollback-codex-app-config.sh` |
| M11 — Axi overlay docs | shipped | full `opencodex` overlay suite at the reference repo root |

## Build & Install

```bash
# 1. Install (one runtime dep, plus typescript + @types/node as devDeps)
git clone https://github.com/AITabby/opencodex.git
cd opencodex
npm install         # postinstall: tsc  → emits dist/

# 2. Run the proxy + dashboard + MCP server (default port 8765)
npm start           # = NODE_USE_ENV_PROXY=1 node --disable-warning=UNDICI-EHPA dist/server.js

# 3. Optional: HTTP-only mode (no MCP stdio transport) for launchd
OPENCODEX_HTTP_ONLY=1 npm run start:http

# 4. Optional: register the OpenCodex provider with Codex Desktop
OPENCODEX_MANAGE_CODEX=1 npm start                              # patches ~/.codex/config.toml
# OR reversible register-only (Codex stays on native GPT):
OPENCODEX_PORT=8794 OPENCODEX_NO_BROWSER_OPEN=1 npm run start:http
OPENCODEX_PORT=8794 scripts/enable-aggregate-codex-app.sh
scripts/rollback-codex-app-config.sh

# 5. Build the macOS wrapper .app
npm run build:macos                       # produces dist-macos/OpenCodex.app
open dist-macos/OpenCodex.app
# Or the Codex Plus flavor:
npm run build:macos:plus                   # produces dist-macos/Codex Plus.app
```

Worker-loop usage:

```bash
MINIMAX_TOKEN_PLAN_API_KEY=... npm run minimax:axi-todo-loop -- --once
npm run minimax:axi-todo-loop -- --concurrency 3 --min-remaining-percent 5
npm run minimax:axi-todo-loop -- --drain-window --concurrency 3 --max-concurrency 8 \
  --expected-worker-percent 8 --min-remaining-percent 3 --tail-min-remaining-percent 0.5 \
  --interval-ms 30000
```

Verification commands (per `AGENTS.md`):

```bash
npm run build
node test_translator.mjs
node scripts/test-macos-readiness.mjs
node scripts/test-codex-project-docs.mjs
```

## Architecture Highlights

**Single Node process owns three independent surfaces: HTTP proxy, MCP stdio server, and dashboard SSE bus.** `src/server.ts` (224 LOC) constructs `ProxyServer(port)`, `ScreenshotTaker`, `ActionPerformer`, and an MCP `Server` with `tools: {}` capability, then connects the MCP server to `StdioServerTransport`. The MCP tools list (`TOOLS`, lines 27-118) is eight entries: `screenshot`, `click`, `drag`, `scroll`, `page_scroll`, `type_text`, `press_key`, `get_windows`, `focus_window`. Each tool dispatches to the same `ActionPerformer` / `ScreenshotTaker` instance. This is the cleanest "computer-use MCP server" reference in the workspace — no Python, no separate daemon, no AppleScript bridge.

**The proxy translates OpenAI `chat.completions` ↔ OpenAI `responses` in real time and stamps Codex-native config blocks into `~/.codex/config.toml`.** `src/proxy/translator.ts` exports `responsesToChat`, `chatCompletionToResponse`, `extractNamespaceMap`, `ResponsesStreamState`, `compressImagesInRequest`, `createStreamingThinkStripper`, `sanitizeChatCompletionPayload`, `sanitizeChatCompletionStreamChunk`. `src/proxy/index.ts` (2942 LOC) does the heavy lifting on the Codex side: `ensureCodexLaunchHome()` syncs `auth.json`, `AGENTS.md`, `models_cache.json`, `version.json`, `.codex-global-state.json` from `~/.codex` into an isolated `~/.opencodex/codex-app-home` (or shared), preserves `# >>> opencodex managed >>> … # <<< opencodex managed <<<` blocks (`stripManagedBlocks`, `stripOpenCodexProviderBlock`, `stripTopLevelModelSelection`), symlinks `skills`, `rules`, `pets`, merges `plugins`, `browser`, `computer-use`, and rewrites Codex launch references (`rewriteCodexLaunchReferences`). Session state is shared via the symlink table `SHARED_CODEX_SESSION_ENTRIES` (`state_5.sqlite`, `state_5.sqlite-wal`, `state_5.sqlite-shm`, `session_index.jsonl`, `history.jsonl`, `external_agent_session_imports.json`, `sessions/`, `archived_sessions/`, `shell_snapshots/`) — opencodex doesn't copy or rewrite the session store on every restart, it just symlinks, so previous Codex threads stay alive across launches.

**Provider presets are a code table; credentials are loaded from three sources in priority order.** `src/proxy/presets.ts` defines `BUILTIN_PRESETS = { "native-openai", "ccswitch-gpt", "minimax", "deepseek" }`. `OPENAI_OAUTH_PROVIDER = "native-openai"` is `https://chatgpt.com/backend-api/codex` with `auto_api_key: true`. `GPT_PROXY_PROVIDER = "ccswitch-gpt"` is `http://127.0.0.1:15721/v1` (CC Switch relay). `minimax` is `https://api.minimaxi.com/v1` with models `MiniMax-M2.7-highspeed`, `MiniMax-M3`. `deepseek` is `https://api.deepseek.com/v1` with model `deepseek-v4-pro`. Credential resolution order (in `resolveProviderApiKey`): explicit config → env var (`$MINIMAX_API_KEY` shortcut syntax) → `~/.credentials/load-credentials.sh` via `zsh -lc 'source "$HOME/credentials/load-credentials.sh"; printf %s "${MINIMAX_API_KEY:-}"'` (line 91-94) → CC Switch SQLite (`sqlite3 ~/.cc-switch/cc-switch.db "SELECT settings_config FROM providers WHERE app_type='codex' AND name='minimax' ORDER BY is_current DESC LIMIT 1;"`, line 175-179). No credential is ever committed; the loader script is trusted but never executed.

**Workspace + project docs are injected into every Codex turn.** `proxy/index.ts` defines `DEFAULT_WORKSPACE_ROOT = "/Volumes/code/workspace"`, `WORKSPACE_DOC_MAX_BYTES = 65536`, `WORKSPACE_DOC_FILENAMES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]`, plus `PROJECT_DOC_FALLBACK_FILENAMES = '["CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]'` and `PROJECT_DOC_MAX_BYTES = 65536`. These get stamped into the Codex-side `config.toml` (`project_doc_fallback_filenames = [...]`, `project_doc_max_bytes = 65536`) and the proxy itself reads `WORKSPACE_DOC_MARKER = "opencodex:workspace-instructions"` to mark the injected block. **The model does not read files**; opencodex loads the docs into the model context before the turn so third-party models (which are worse at inferring workflow intent) get the same contract Codex native sees. This is exactly the right pattern for Axi: even non-native models should see `AGENTS.md` first.

**The Computer Use engine is "compile Swift to a temp file, `swift` it, return stdout".** `src/cu/actions.ts` (225 LOC) and `src/cu/screenshot.ts` (51 LOC) implement every UI primitive as a Swift source string. For click: `import Cocoa` + `CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)!.post(tap: .cghidEventTap)` for both `.leftMouseDown` and `.leftMouseUp`. For drag: 20 interpolated steps with `Thread.sleep(forTimeInterval: 0.01)` between `.leftMouseDragged` events. For screenshot: `CGDisplayCreateImage(CGMainDisplayID())` → `NSBitmapImageRep` → `rep.representation(using: .png, properties: [:])` → write to `/tmp/oc-shot-*.png`, with `/usr/sbin/screencapture -x -t png` as the fallback. All temp files are `unlinkSync`'d in `finally`. Timeout is 10-15s per call. **No accessibility permission prompts**, no `osascript`, no Electron — just `spawnSync("/usr/bin/swift", ...)`.

**The macOS wrapper app is a 440-LOC Swift file that owns a Node child process.** `scripts/macos-app/OpenCodexApp.swift` `AppDelegate.applicationDidFinishLaunching` does: `installMenu()` (one Quit item, keyEquivalent `q`), `installTerminationSignalHandlers()` (`Darwin.signal(SIGTERM, SIG_IGN)` + `DispatchSource.makeSignalSource` for both `SIGTERM`/`SIGINT`), `createWindow()` (1180×780, `.titled | .closable | .miniaturizable | .resizable`, centered), `resolveProjectPath()` (check `Bundle.main.resourceURL/project-path.txt`, then bundled `opencodex-runtime`, then `bundleURL.deletingLastPathComponent().deletingLastPathComponent()`), `resolveNodePath()`, `openLogFile()`, `startService()` (spawn Node child, capture log handle), then `waitForDashboard()` which polls `http://127.0.0.1:{port}/health` every 0.25s (1.0s after 80 attempts — `readinessWarningAttempt = 80`) and loads `http://127.0.0.1:{port}/dashboard` into the `WKWebView` once `status: ok && opencodex: true`. The Codex Plus variant (`CODEX_PLUS_APP=1` or app name contains "Codex Plus") hides the window after health (`window.orderOut(nil)`, `NSApp.hide(nil)`) — `applicationShouldTerminateAfterLastWindowClosed` returns `false` so the menu-bar app stays alive.

**The MiniMax Axi Todo Loop is a quota-aware worker dispatcher.** `scripts/minimax-axi-todo-loop.mjs` (996 LOC) implements: `parseArgs` with defaults `DEFAULT_MODEL = "MiniMax-M3"`, `DEFAULT_FALLBACK_MODEL = "MiniMax-M2.7-highspeed"`, `DEFAULT_CODEX_PROVIDER = "opencodex"`, `DEFAULT_CONCURRENCY = 3`, `DEFAULT_MAX_CONCURRENCY = 8`, `DEFAULT_MIN_REMAINING_PERCENT = 5`, `DEFAULT_INTERVAL_MS = 60_000`, `DEFAULT_EXPECTED_WORKER_PERCENT = 8`, `DEFAULT_TAIL_WINDOW_MINUTES = 45`, `DEFAULT_TAIL_MIN_REMAINING_PERCENT = 1`. It queries `https://api.minimaxi.com/v1/token_plan/remains` (with two fallbacks at `/v1/api/openplatform/coding_plan/remains` and `/v1/coding_plan/remains`) via `parseMiniMaxQuota` → `preferredIntervalNode` → `percentFromNode` → `resetFromNodes`. If `remainingPercent < minRemainingPercent`, the loop waits until reset; otherwise it claims tasks from `axi-todo` (path default `/Volumes/code/workspace/agent-cluster/axi-agent/tools/axi-todo`) and dispatches `codex exec` workers with `agentRole` / `agentCategory` / `executionMode` routing metadata (`agentCategory=quick|writing|unspecified-low` → fallback; `deep|ultrabrain|visual-engineering|unspecified-high` or `executionMode=plan|consult` → primary). `--drain-window` scales the launch batch toward `--max-concurrency` based on the current 5-hour remaining percentage. Every worker prompt embeds a portable operating contract (Axi Todo/PostgreSQL as completion truth, `agentmemory` as semantic memory only, bounded startup protocol, final `Result` / `Files Changed` / `Evidence` / `State Update` / `Memory Card` / `Blockers` sections). The loop fails closed unless `--allow-unknown-quota` is passed.

## Notes

- Entry point `src/server.ts` (224 LOC) wires `ProxyServer`, `ScreenshotTaker`, `ActionPerformer`, and an MCP `Server` with eight tools (`screenshot`, `click`, `drag`, `scroll`, `page_scroll`, `type_text`, `press_key`, `get_windows`, `focus_window`).
- HTTP/SSE proxy lives in `src/proxy/index.ts` (2942 LOC); the chat.completions ↔ responses streaming translator is `src/proxy/translator.ts` (1181 LOC) (`responsesToChat`, `chatCompletionToResponse`, `extractNamespaceMap`, `ResponsesStreamState`, `compressImagesInRequest`, `createStreamingThinkStripper`, `sanitizeChatCompletionPayload`, `sanitizeChatCompletionStreamChunk`).
- Glassmorphic dashboard is a single in-process template `src/proxy/dashboard.ts` (1469 LOC); SSE log bus uses `addLog` + `activeSseClients` (lines 76-94).
- Provider presets in `src/proxy/presets.ts`: `BUILTIN_PRESETS = { native-openai, ccswitch-gpt, minimax, deepseek }`; `OPENAI_OAUTH_PROVIDER = "native-openai"` with `auto_api_key: true`, `GPT_PROXY_PROVIDER = "ccswitch-gpt"`, `minimax` models `MiniMax-M2.7-highspeed` and `MiniMax-M3`, `deepseek` model `deepseek-v4-pro`.
- Credential resolution chain: explicit config → env var (`$MINIMAX_API_KEY` shortcut syntax) → `~/.credentials/load-credentials.sh` via `zsh -lc 'source "$HOME/credentials/load-credentials.sh"; printf %s "${MINIMAX_API_KEY:-}"'` (line 91-94) → CC Switch SQLite (`sqlite3 ~/.cc-switch/cc-switch.db "SELECT settings_config FROM providers WHERE app_type='codex' AND name='minimax' ORDER BY is_current DESC LIMIT 1;"`, line 175-179).
- Codex home isolation: `ensureCodexLaunchHome()` syncs `auth.json`, `AGENTS.md`, `models_cache.json`, `version.json`, `.codex-global-state.json` into `~/.opencodex/codex-app-home`; managed-block markers `# >>> opencodex managed >>> … # <<< opencodex managed <<<` preserved by `stripManagedBlocks`, `stripOpenCodexProviderBlock`, `stripTopLevelModelSelection`.
- Session-store symlink table `SHARED_CODEX_SESSION_ENTRIES`: `state_5.sqlite`, `state_5.sqlite-wal`, `state_5.sqlite-shm`, `session_index.jsonl`, `history.jsonl`, `external_agent_session_imports.json`, `sessions/`, `archived_sessions/`, `shell_snapshots/`.
- Workspace doc injection: `WORKSPACE_DOC_FILENAMES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]` + `WORKSPACE_DOC_MAX_BYTES = 65536` + `PROJECT_DOC_FALLBACK_FILENAMES = '["CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]'`; the proxy stamps `WORKSPACE_DOC_MARKER = "opencodex:workspace-instructions"` into the injected block.
- Computer Use engine: `src/cu/actions.ts` (225 LOC) writes Swift to `/tmp/oc-act-*.swift` then `spawnSync("/usr/bin/swift", ...)`; `CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left).post(tap: .cghidEventTap)` for both `.leftMouseDown` and `.leftMouseUp`; 10-15s timeout per call; temp files `unlinkSync`'d in `finally`.
- Screenshot: `src/cu/screenshot.ts` (51 LOC); `CGDisplayCreateImage(CGMainDisplayID())` → `NSBitmapImageRep` → `rep.representation(using: .png, properties: [:])` → `/tmp/oc-shot-*.png`; `/usr/sbin/screencapture -x -t png` as the fallback.
- macOS wrapper: `scripts/macos-app/OpenCodexApp.swift` `AppDelegate` (440 LOC); 1180×780 `WKWebView` (`.titled | .closable | .miniaturizable | .resizable`); `Darwin.signal(SIGTERM, SIG_IGN)` + `DispatchSource.makeSignalSource`; `/health` polling every 0.25s with `readinessWarningAttempt = 80`.
- Codex Plus flavor (`CODEX_PLUS_APP=1` or app name contains "Codex Plus") hides the window after health (`window.orderOut(nil)`, `NSApp.hide(nil)`) and `applicationShouldTerminateAfterLastWindowClosed` returns `false`.
- Worker loop `scripts/minimax-axi-todo-loop.mjs` (996 LOC); defaults `DEFAULT_MODEL = "MiniMax-M3"`, `DEFAULT_FALLBACK_MODEL = "MiniMax-M2.7-highspeed"`, `DEFAULT_CODEX_PROVIDER = "opencodex"`, `DEFAULT_CONCURRENCY = 3`, `DEFAULT_MAX_CONCURRENCY = 8`; queries `https://api.minimaxi.com/v1/token_plan/remains` (with fallbacks `/v1/api/openplatform/coding_plan/remains` and `/v1/coding_plan/remains`).
- Reversible provider registration: `scripts/enable-aggregate-codex-app.sh` (additive only, never touches `model_provider` / `model_catalog_json`) + `scripts/rollback-codex-app-config.sh`.
- Build: `scripts/build-macos-app.sh` produces `dist-macos/OpenCodex.app` (and `--flavor codex-plus` for the Codex Plus variant).
- Single runtime dep: `@modelcontextprotocol/sdk ^1.6.0` (per `package.json`); `type: "module"` at the root; production entry is `node --disable-warning=UNDICI-EHPA dist/server.js` to silence undici's "headers already sent" warning during aggressive chunked streaming.

## Cross-References

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "OpenCodex Reference".
- Project root: `/Volumes/code/workspace/references/short-term/opencodex`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/short-term/opencodex/AGENTS.md`
- Project `README.md`: `/Volumes/code/workspace/references/short-term/opencodex/README.md`
- Upstream repository: `https://github.com/AITabby/opencodex`
- **Axi Codex-local-gateway reference** (`codex-local-gateway-reference`): copy the provider-registry-as-table in `BUILTIN_PRESETS`, the CC Switch + `~/.credentials/load-credentials.sh` + env var credential resolution chain in `resolveProviderApiKey`, the Codex home isolation in `ensureCodexLaunchHome` (`getCodexHome` / `getNativeCodexHome`), the managed-blocks pattern (`# >>> opencodex managed >>> … # <<< opencodex managed <<<` with `stripManagedBlocks` / `stripOpenCodexProviderBlock` / `stripTopLevelModelSelection`), and the session-store symlink table `SHARED_CODEX_SESSION_ENTRIES`. These four pieces are exactly the right shape for any "proxy in front of Codex Desktop without forking it".
- **Axi Codex-computer-use-proxy reference** (`codex-computer-use-proxy-reference`): the eight MCP tools (`screenshot`, `click`, `drag`, `scroll`, `page_scroll`, `type_text`, `press_key`, `get_windows`, `focus_window`) plus the `ActionPerformer` + `ScreenshotTaker` Swift-source generator is the smallest viable computer-use MCP server. There is no need for an accessibility framework or an Electron host; `spawnSync("/usr/bin/swift", ["/tmp/oc-act-{Date.now()}.swift"])` is enough. The temp-file lifecycle (`writeFileSync` → `spawnSync` → `unlinkSync` in `finally`) and 10-15s timeout are the right defaults.
- **Axi macOS-wrapper-app reference** (`macos-wrapper-app-reference`): the `AppDelegate` shape (1180×780 `WKWebView`, signal-trap via `Darwin.signal(SIGTERM, SIG_IGN)` + `DispatchSource.makeSignalSource`, `/health` polling loop with 80-attempt warning threshold, project-path resolution via `Bundle.main.resourceURL/project-path.txt` → bundled `opencodex-runtime` → repo parent) is the right shape for any "Mac app that owns a local daemon and embeds its dashboard". The Codex Plus flavor (`CODEX_PLUS_APP=1`, `applicationShouldTerminateAfterLastWindowClosed` returns `false`, hide window after health) is the right pattern for a menu-bar / always-on variant.
- **Axi workspace-doc injection**: the `WORKSPACE_DOC_FILENAMES` table + `WORKSPACE_DOC_MAX_BYTES` + `WORKSPACE_DOC_MARKER` (a marker comment that lets the proxy find its own injected block in `config.toml`) is the cleanest way to enforce "every Codex turn in this workspace sees AGENTS.md + fallbacks". Adopt the same table for any other agent surface.
- **Axi quota-gated worker loops**: the `minimax-axi-todo-loop.mjs` shape — query quota, parse to `remainingPercent` + `reset`, claim tasks only if `remainingPercent >= minRemainingPercent`, scale concurrency with `--drain-window`, fail closed unless `--allow-unknown-quota`, embed a portable operating contract in every worker prompt, require an `Evidence` section in the final answer — should be the template for any Axi loop that delegates to a paid model.
- **Axi streaming translation**: `responsesToChat` / `chatCompletionToResponse` plus `compressImagesInRequest` + `createStreamingThinkStripper` are reusable building blocks for any "proxy that talks to multiple model APIs from a single Codex-style client".
- **Reversible provider registration**: `enable-aggregate-codex-app.sh` (additive only — never touches `model_provider` / `model_catalog_json`) plus `rollback-codex-app-config.sh` is a clean template for any "register a provider with Codex Desktop without taking it over".