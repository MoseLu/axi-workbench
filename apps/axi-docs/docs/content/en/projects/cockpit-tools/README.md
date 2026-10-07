---
id: axi-docs-en-projects-cockpit-tools
title: Cockpit Tools Reference
type: project
status: published
tags: [Axi Docs, Projects, references, reference, desktop, tauri, multi-account]
created: 2026-10-07
modified: 2026-10-07
graph-title: Cockpit Tools Reference
graph-tags: [Projects, references]
description: Third-party `jlcodes99/cockpit-tools` (GitHub) reference checkout — Tauri 2 + React 19 desktop app that manages twelve external AI IDE/CLI accounts at once (Antigravity, Codex, GitHub Copilot, Windsurf, Kiro, Cursor, Gemini Cli, CodeBuddy, CodeBuddy CN, Qoder, Trae, Zed + Workbuddy), with per-vendor credential switching and multi-instance IDE manager.
project:
  id: cockpit-tools
  partition: references
  path: /Volumes/code/workspace/references/short-term/cockpit-tools
  source-section: reference
---

# Cockpit Tools Reference

> Reference checkout. Source of truth:
> [`/Volumes/code/workspace/references/short-term/cockpit-tools`](/Volumes/code/workspace/references/short-term/cockpit-tools).
> Upstream: `jlcodes99/cockpit-tools` (GitHub). License: CC-BY-NC-SA-4.0.
> Partition: `references/`.

## Summary

Cockpit Tools (`/Volumes/code/workspace/references/short-term/cockpit-tools`) is a third-party desktop application — built with Tauri 2 + React 19 + Tailwind/DaisyUI — that acts as a "Cockpit" for managing many external AI IDE/CLI accounts at once. It currently supports twelve IDE/CLI surfaces (Antigravity, Codex, GitHub Copilot, Windsurf, Kiro, Cursor, Gemini Cli, CodeBuddy, CodeBuddy CN, Qoder, Trae, Zed) plus a built-in Workbuddy mode, and its primary job is to let a single user hold many paid subscriptions on different IDEs, switch between them in one click, run multiple IDE instances in parallel, and keep an eye on per-account quota consumption and reset windows. This is the inverse problem of `sub2api`: where Sub2API is a *server-side relay* that shares one upstream account across many downstream users, Cockpit Tools is a *client-side switcher* that lets one user hold many upstream accounts and select which one is "live" in the local IDE right now.

For Axi, the most valuable lessons are about how to model "an external account that exists on somebody else's machine" inside a desktop runtime: how to persist credentials securely (a SQLite-backed `state.vscdb` borrowed from the IDE's own data layout, plus the platform's native safe-storage crypto for Copilot/VS Code), how to surface quota snapshots per account without coupling the UI to a particular vendor's API, and how to expose a unified Tauri command surface (38 commands across `commands/`) that abstracts the differences between Antigravity OAuth, Codex OAuth, GitHub Copilot JWT, Cursor OAuth, and so on. The cross-vendor abstraction layer is interesting because it ships as a stable Rust data shape — `axi_accounts_contract.rs` defines `AxiAccountProfile`, `AxiCredentialRef`, `AxiQuotaSnapshot`, `AxiInstanceBinding` and a `secret_ref:axi-accounts/{provider}/{account_id}` namespace — so the same desktop app could in principle export a vendor-neutral credential ledger to an external `axi-accounts` consumer service.

The secondary lesson is the **multi-instance runtime UI** itself. Each platform supports launching one or more isolated IDE instances, each with its own user-data-dir, custom launch args, and bound account. The data lives in `~/.antigravity_cockpit/instances.json` with a mutex-guarded store (`modules/instance.rs` + `instance_store.rs`), the runtime is rendered by `pages/InstancesPage.tsx` and a floating-card window (`pages/FloatingCardWindow.tsx` defined as a separate Tauri webview in `tauri.conf.json` — `label: "floating-card"`, transparent, no decorations, always-on-top), and the desktop menu integration comes from a Swift bridge under `src-tauri/native/macos-native-menu/Sources`. The result is a small but production-grade example of a multi-window, multi-account, multi-vendor desktop manager that has to live on macOS/Windows/Linux simultaneously.

## Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Desktop runtime | Tauri 2 (Rust shell) | `src-tauri/Cargo.toml` lib name `antigravity_cockpit_tools_lib`; `rust-version = "1.77"`; `tauri = "2"` with `macos-private-api`, `tray-icon`; `tauri-plugin-global-shortcut 2`, `tauri-plugin-single-instance 2`, `tauri-plugin-notification 2`; Swift bridge at `src-tauri/native/macos-native-menu/Sources` |
| Build pipeline | Tauri + Vite 7 + Tailwind 3 + DaisyUI 5 + sass | `pnpm tauri build` produces macOS `.app`/`.dmg`, Windows `.msi`, Linux `.deb`/`.AppImage`; `pnpm build` (no tauri) produces `dist/` for the webview only; `scripts/sync-version.js` keeps `Cargo.toml` + `package.json` + `tauri.conf.json` at v0.21.3 |
| Frontend stack | TypeScript + React 19 + Vite + Zustand 5 + react-i18next | `src/main.tsx`, `src/App.tsx`; `src/stores/createProviderAccountStore.ts` generic store factory parameterised by platform (backing `useCodexAccountStore`, `useCursorAccountStore`, …); `react-i18next` with 18 locale JSON files in `src/locales/` and normalisation table (`'zh-CN' → 'zh-cn'`, `'pt-BR' → 'pt-br'`, …) in `src/i18n/index.ts` |
| Commands surface | 38 `#[tauri::command]` handlers in `src-tauri/src/commands/` | One-line wrappers calling into `modules/`; `system.rs` is the largest at 1,726 lines (settings/import/export/diagnostics/logs); thin-command / fat-module split |
| Cross-vendor modules | `src-tauri/src/modules/{account,account_index_repair,codex_account,codex_oauth,codex_quota,codex_wakeup,codex_wakeup_scheduler,codex_remote_bridge,codex_account_switch_status,codex_auto_resume,codex_session_manager,codex_session_visibility,codex_thread_sync,antigravity_switch_history,antigravity_oauth,antigravity_*,cursor_account,cursor_instance,cursor_oauth,gemini_account,gemini_instance,gemini_oauth,github_copilot_account,github_copilot_oauth,kiro_account,kiro_oauth,kiro_instance,trae_account,trae_oauth,trae_instance,codebuddy_account,codebuddy_oauth,codebuddy_instance,codebuddy_cn_*,qoder_*,wakatime*,workbuddy_*,zed_*}.rs` | Largest module is `codex_account.rs` (3,914 lines); per-platform triple `(platform)_account.rs` + `(platform)_oauth.rs` + `(platform)_instance.rs` |
| Vendor-neutral contract | `src-tauri/src/modules/axi_accounts_contract.rs` | Defines `AxiCredentialKind`, `AxiCredentialRef`, `AxiQuotaSnapshot`, `AxiInstanceBinding`, `AxiAccountProfile`, `AxiProviderProfile`; per-vendor mappers (`map_codex_oauth_account`, `map_codex_api_provider`, `map_gemini_account`, `map_cursor_account`, `map_windsurf_account`); credential_ref uses namespaced form `secret_ref:axi-accounts/{provider}/{account_id}` with `owner: "axi-accounts"` |
| VS Code / GitHub Copilot integration | `src-tauri/src/modules/vscode_inject.rs` (1,157 lines) + `src-tauri/src/modules/db.rs` | Platform crypto model: Windows DPAPI + AES-256-GCM (`v10`); macOS Keychain + AES-128-CBC (`v10`); Linux Secret Service + AES-128-CBC (`v11`, with `v10` fallback); reads Antigravity `Library/Application Support/Antigravity/User/globalStorage/state.vscdb`, decrypts GitHub auth sessions, swaps the token, re-encrypts, writes back; protobuf OAuth-token writer for `antigravityUnifiedStateSync.oauthToken` |
| Quota / wakeup | `src-tauri/src/modules/wakeup.rs` (2,187 lines) + `wakeup_scheduler.rs` (1,110 lines) + `codex_wakeup.rs` + `codex_wakeup_scheduler.rs` | Antigravity wakeup streams SSE to `daily-cloudcode-pa.googleapis.com`; cancel scopes via `tokio::sync::watch`; Codex wakeup subsystem periodically issues small chat-completions call to keep daily quota window healthy |
| OAuth-on-desktop | `src-tauri/src/modules/oauth_server.rs` + `oauth_pending_state.rs` + `codex_oauth.rs` + per-platform `*_oauth.rs` | Local HTTP callback server captures OAuth redirect on desktop; persisted OAuth-pending state survives app restart |
| Multi-instance store | `src-tauri/src/modules/instance.rs` + `instance_store.rs` | `~/.antigravity_cockpit/instances.json` mutex-guarded; `DefaultInstanceSettings` block; `process.rs` for IDE process lifecycle; `pages/InstancesPage.tsx` + per-platform `*InstancesPage.tsx` |
| Floating card + tray | `src-tauri/src/modules/floating_card_window.rs` + `tray.rs` + `tray_layout.rs` + `macos_native_menu.rs` | Always-on-top floating card webview declared in `tauri.conf.json` (`label: "floating-card"`); tray with main menu + double-click; Swift bridge for native macOS menu bar |
| External import / deep-link | `src-tauri/src/modules/external_import.rs` | Deep-link `cockpit-tools://…` URL handler; single-instance plugin reuses existing window on second launch |
| Fingerprint + device | `src-tauri/src/modules/fingerprint.rs` + `device.rs` | Risk-control-aware fingerprinting feature (device fingerprint binding reduces vendor risk-control risk) |
| Package metadata | `package.json` (v0.21.3), `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `Casks/` (Homebrew cask), `announcements.json` (in-app announcement feed) |
| Reference-overlay verification | `pnpm install` + `pnpm test` + `pnpm build` (per TDD.md); no live Postgres/Redis required; no Axi-owned verification | Docs completeness only |

## Project Layout

```
cockpit-tools/
├── AGENTS.md                        # Axi reference overlay
├── README.en.md / README.md / README.zh-CN.md
├── CHANGELOG.md / CHANGELOG.zh-CN.md
├── SECURITY.md
├── INDEX.md / PRD.md / TDD.md / TODO.md / MILESTONE.md
├── package.json (v0.21.3) / package-lock.json
├── tsconfig.json / tsconfig.node.json / vite.config.ts
├── tailwind.config.js / postcss.config.js
├── index.html
├── announcements.json               # in-app announcement feed
├── Casks/                           # Homebrew cask definitions
├── public/                          # static web assets
├── src/                             # React 19 frontend
│   ├── main.tsx / App.tsx / App.css
│   ├── assets/icons/                # provider SVG/PNG icons (also bundled into Tauri menu)
│   ├── components/
│   │   ├── admin/ announcementModal/ channels/ charts/ common/ easter-egg/ Guide/
│   │   ├── icons/ keys/ layout/ payment/ platform/ user/
│   │   ├── account/  accountSwitcher/
│   │   └── codebuddy/ codebuddy-suite/ codex/
│   ├── hooks/                       # useAutoRefresh, useDropdownPanelPlacement, …
│   ├── i18n/                        # i18next bootstrap
│   ├── locales/                     # 18 locale JSON files
│   ├── pages/
│   │   ├── AccountsPage.tsx, CodexAccountsPage.tsx, WindsurfAccountsPage.tsx, …
│   │   ├── CodexInstancesPage.tsx, CursorInstancesPage.tsx, …
│   │   ├── DashboardPage.tsx, FingerprintsPage.tsx, FloatingCardWindow.tsx
│   │   ├── TwoFactorAuthPage.tsx, ManualPage.tsx, WakeupTasksPage.tsx, …
│   │   └── settings/                # Settings sub-pages
│   ├── presentation/                # cross-platform display logic
│   ├── services/                    # per-platform Tauri wrappers (~40 files)
│   │   ├── accountService.ts, codexService.ts, codexInstanceService.ts, …
│   │   └── platform/createPlatformInstanceService.ts
│   ├── stores/                      # Zustand stores per platform
│   │   ├── createInstanceStore.ts, createProviderAccountStore.ts
│   │   └── useAccountStore.ts, useCodexAccountStore.ts, useInstanceStore.ts, …
│   ├── styles/                      # Tailwind + page-specific CSS
│   ├── types/                       # TypeScript domain types
│   └── utils/                       # 30+ utility modules (account, modelNames, updaterRetry, …)
├── src-tauri/                       # Rust + Tauri 2 backend
│   ├── Cargo.toml (lib name: antigravity_cockpit_tools_lib)
│   ├── build.rs / Cargo.lock
│   ├── tauri.conf.json              # windows: main + floating-card; updater pubkey
│   ├── icons/                       # 32x32 …, ios/, android/, .icns/.ico
│   ├── capabilities/                # Tauri ACL capabilities
│   ├── gen/                         # Tauri-generated schemas
│   ├── native/
│   │   └── macos-native-menu/Sources/   # Swift bridge for native macOS menu
│   ├── src/
│   │   ├── main.rs / lib.rs
│   │   ├── error.rs
│   │   ├── commands/                # 38 #[tauri::command] handlers
│   │   │   ├── mod.rs
│   │   │   ├── account.rs, announcement.rs, oauth.rs
│   │   │   ├── codex.rs / codex_instance.rs
│   │   │   ├── codebuddy.rs / codebuddy_instance.rs / codebuddy_cn.rs / codebuddy_cn_instance.rs
│   │   │   ├── cursor.rs / cursor_instance.rs / data_transfer.rs / device.rs
│   │   │   ├── gemini.rs / gemini_instance.rs / github_copilot.rs / github_copilot_instance.rs
│   │   │   ├── group.rs / import.rs / instance.rs / kiro.rs / kiro_instance.rs
│   │   │   ├── logs.rs / provider_current.rs / qoder.rs / qoder_instance.rs
│   │   │   ├── system.rs (1,726 lines) / trae.rs / trae_instance.rs / update.rs
│   │   │   ├── wakeup.rs / wakatime…  / windsurf.rs / w…_instance.rs
│   │   │   ├── workbuddy.rs / workbuddy_instance.rs / zed.rs
│   │   ├── models/                  # account/codex/cursor/gemini/…/zed structs
│   │   ├── modules/                 # the heart of the runtime
│   │   │   ├── account.rs (2,310 lines) / account_index_repair.rs
│   │   │   ├── codex_account.rs (3,914 lines) / codex_oauth.rs / codex_quota.rs
│   │   │   ├── codex_wakeup.rs / codex_wakeup_scheduler.rs / codex_remote_bridge.rs
│   │   │   ├── codex_account_switch_status.rs / codex_auto_resume.rs
│   │   │   ├── codex_session_manager.rs / codex_session_visibility.rs / codex_thread_sync.rs
│   │   │   ├── antigravity_switch_history.rs / antigravity_oauth.rs / antigravity_*.rs
│   │   │   ├── cursor_account.rs / cursor_instance.rs / cursor_oauth.rs
│   │   │   ├── gemini_account.rs / gemini_instance.rs / gemini_oauth.rs
│   │   │   ├── github_copilot_account.rs / github_copilot_oauth.rs
│   │   │   ├── kiro_account.rs / kiro_oauth.rs / kiro_instance.rs
│   │   │   ├── trae_account.rs / trae_oauth.rs / trae_instance.rs
│   │   │   ├── codebuddy_account.rs / codebuddy_oauth.rs / codebuddy_instance.rs
│   │   │   ├── codebuddy_cn_account.rs / codebuddy_cn_oauth.rs / codebuddy_cn_instance.rs
│   │   │   ├── qoder_account.rs / qoder_oauth.rs / qoder_instance.rs
│   │   │   ├── wakatime…  / workbuddy_account.rs / workbuddy_oauth.rs / workbuddy_instance.rs
│   │   │   ├── zed_account.rs / zed_oauth.rs / zed_instance.rs
│   │   │   ├── wakatime — see above / axxxx — see openclaw_auth.rs / opencode_auth.rs
│   │   │   ├── oauth_pending_state.rs / oauth_server.rs (local OAuth callback server)
│   │   │   ├── vscode_inject.rs (1,157 lines; VS Code / Copilot crypto injector)
│   │   │   ├── vscode_paths.rs / process.rs (process lifecycle)
│   │   │   ├── instance_store.rs / instance.rs (multi-instance store)
│   │   │   ├── fingerprint.rs / device.rs (device fingerprint management)
│   │   │   ├── config.rs (1,591 lines; user config + server status file)
│   │   │   ├── db.rs (SQLite access for VS Code state.vscdb)
│   │   │   ├── atomic_write.rs / external_import.rs / web_report.rs / websocket.rs
│   │   │   ├── tray.rs / tray_layout.rs / macos_native_menu.rs / floating_card_window.rs
│   │   │   ├── wakeup.rs (2,187 lines; Antigravity wakeup) / wakeup_scheduler.rs
│   │   │   ├── wakeup_verification.rs / wakeup_history.rs / wakeup_gateway.rs
│   │   │   ├── codex_wakeup.rs / codex_wakeup_scheduler.rs
│   │   │   ├── quota.rs / quota_cache.rs / refresh_retry.rs
│   │   │   ├── i18n.rs / sync_settings.rs / group_settings.rs
│   │   │   ├── linux_updater.rs / update_checker.rs / logger.rs
│   │   │   ├── axi_accounts_contract.rs (vendor-neutral external contract)
│   │   │   └── mod.rs
│   │   └── utils/                   # protobuf helpers (for Antigravity state), etc.
│   ├── tests/                       # cargo tests
│   └── target/                      # cargo build output (git-ignored)
├── scripts/
│   ├── sync-version.js              # keeps Cargo.toml + package.json + VERSION in sync
│   ├── check_locales.cjs
│   ├── update_locales.cjs
│   └── release/preflight.cjs
├── dist/                            # Vite build output
├── release-artifacts/               # shipped binaries / DMGs
├── docs/                            # documentation + image assets
│   └── project-docs.manifest.json   # Axi overlay
├── announcements.json               # in-app announcement feed
└── .vscode/ .github/ .omc/ .omx/ .agent/ .minimax/   # editor / agent workspace config
```

## Build & Install

### Desktop app — Tauri 2

Prerequisites per upstream README:

- Node.js 18+ / pnpm
- Rust 1.77+ (edition 2021)
- Platform-specific: Xcode CLT (macOS), WebView2 (Windows), webkit2gtk + libsoup + libayatana-appindicator (Linux)

```bash
git clone https://github.com/jlcodes99/cockpit-tools.git
cd cockpit-tools
pnpm install
pnpm tauri dev        # dev with hot-reload; devUrl http://localhost:1420
pnpm tauri build      # produces macOS .app/.dmg, Windows .msi, Linux .deb/.AppImage
pnpm release:preflight  # node scripts/release/preflight.cjs pre-flight checks
```

`pnpm build` (without `tauri`) is the Vite-only build that produces `dist/` for the webview; `pnpm tauri` then embeds that bundle into the Rust binary. `pnpm sync-version` (node `scripts/sync-version.js`) keeps `Cargo.toml`, `package.json`, and `tauri.conf.json` versions aligned at `0.21.3` (current).

Upstream releases ship via Tauri's official updater (`tauri-plugin-updater` with minisign public key in `tauri.conf.json` and endpoint `https://github.com/jlcodes99/cockpit-tools/releases/latest/download/latest.json`), and a Homebrew cask in `Casks/` for macOS.

### Reference-overlay verification (Axi)

```bash
for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md; do
  test -f "/Volumes/code/workspace/references/short-term/cockpit-tools/$f" || exit 1
done
rg -n "REQ-DOC-001|PRD|TDD|Milestone" \
  "/Volumes/code/workspace/references/short-term/cockpit-tools/PRD.md" \
  "/Volumes/code/workspace/references/short-term/cockpit-tools/TDD.md" \
  "/Volumes/code/workspace/references/short-term/cockpit-tools/TODO.md" \
  "/Volumes/code/workspace/references/short-term/cockpit-tools/MILESTONE.md" \
  "/Volumes/code/workspace/references/short-term/cockpit-tools/INDEX.md"
```

`pnpm install` / `pnpm test` / `pnpm build` are the upstream-verified commands; they would run end-to-end here given node toolchain but the workspace explicitly skips expensive verification per the agent task contract.

## Verification

Reference overlay (TDD.md): `pnpm install`, `pnpm test`, `pnpm build`. There is no test suite in the overlay — the commands are imported directly from `package.json` scripts.

Upstream CI is implicit (no `.github/workflows/` is exposed in the checkout). `package.json` has `vitest` available via the `vite`/`vitest` devDependencies, but no `test` script is wired; coverage is via the Rust `cargo test` only, and `src-tauri/tests/` is empty in this checkout.

The reference overlay only requires documentation completeness — the overlay TDD.md intentionally mirrors `pnpm install`/`pnpm test`/`pnpm build` so that an Axi agent can decide locally whether to attempt a full build. Building this project requires platform GUI dependencies (webkit/gtk on Linux, WebView2 on Windows) that are out of scope for the batch sweep.

## Architecture Highlights

Cockpit Tools is a **Tauri 2 desktop shell** that wraps a React 19 SPA. The Rust side holds all platform-specific state and the IDE/CLI integration logic, the web side renders a 12-platform dashboard. The `lib.rs` bootstrap (`src-tauri/src/lib.rs`) registers plugins (dialog, fs, opener, notification, single-instance with deep-link, updater, process, autostart), then in the `.setup(|app| { … })` closure spawns: a single-instance handler that calls `external_import::handle_external_import_args` (lets the user invoke "Import into Cockpit Tools" from a browser via the `cockpit-tools://` deep link), a websocket server (`modules/websocket::start_server`, default port `19528`) and a separate HTTP report server (`modules/web_report::start_server`, port `18081`), per-platform OAuth-pending-state restorers, two wakeup schedulers (`wakeup_scheduler::ensure_started`, `codex_wakeup_scheduler::ensure_started`), a Codex remote bridge init, a macOS activation policy handler (`apply_macos_activation_policy` toggling `ActivationPolicy::Accessory`/`Regular`), a tray menu skeleton, and finally the floating-card window. The `on_window_event` for the main window implements three close behaviors (Minimize / Quit / Ask) — a small but useful pattern for a "systray app".

The **Rust `commands/` layer** is a flat list of ~38 `#[tauri::command]` functions exposed to the JS side (each ending up in the `invoke_handler!` macro in `lib.rs`). They do almost no work themselves — they are 1-line wrappers that call into `modules/`. Examples: `list_codex_accounts` calls `codex_account::list_accounts_checked`; `open_codex_config_toml` calls `app.opener().open_path(...)` on the Codex home dir; `get_codex_quick_config` returns the Codex quick-config struct. The `system.rs` command file is the largest at 1,726 lines because it bundles settings/import/export/diagnostics/logs. This thin-command / fat-module split keeps the IPC surface stable while business logic evolves underneath, and is a useful Tauri pattern.

The **per-platform `modules/` tree** is the deepest part of the codebase and the most direct reference for any Axi product that has to talk to multiple AI vendor APIs. Each platform gets its own `(platform)_account.rs` + `(platform)_oauth.rs` + `(platform)_instance.rs` triple (e.g. `codex_account.rs` is 3,914 lines). These modules are responsible for: storing account credentials to disk, listing/adding/deleting accounts, refreshing OAuth tokens, switching the "current" account, querying quota from the vendor's quota endpoint, and writing back credentials after a switch. `codex_account.rs` is the canonical example: it manages a local Codex-compatible `auth.json` + `config.toml`, supports multi-profile Codex, exposes a quick-config view, and integrates with `codex_auto_resume` (resume the last Codex session when restarting), `codex_session_manager`, `codex_session_visibility`, `codex_thread_sync`, and `codex_remote_bridge` (lets the user point Codex at a remote Codex-API compatible server). The Codex wakeup subsystem (`codex_wakeup.rs` + `codex_wakeup_scheduler.rs`) periodically issues a small chat-completions call to keep the daily quota window healthy.

The **VS Code / GitHub Copilot integration** (`modules/vscode_inject.rs`, 1,157 lines) is a particularly interesting example because it deals with the platform-specific safe-storage crypto used by VS Code/Electron. The file's doc-comment spells out the platform crypto model: Windows DPAPI + AES-256-GCM (`v10` prefix), macOS Keychain + AES-128-CBC (`v10`), Linux Secret Service + AES-128-CBC (`v11`, with `v10` fallback), then decrypts the existing GitHub auth sessions from `state.vscdb`, swaps the token, re-encrypts, and writes back. `modules/db.rs` shows the SQLite injection path used for Antigravity's `Library/Application Support/Antigravity/User/globalStorage/state.vscdb` and includes a hand-rolled protobuf helper for writing the OAuth token (`antigravityUnifiedStateSync.oauthToken`). Together these two files demonstrate a non-trivial "modify another app's local credential store" pattern that Axi is unlikely to need, but that documents the depth required for any "switch the credential in the local IDE" feature.

The **`axi_accounts_contract.rs`** module is the most surprising find for Axi. It defines a vendor-neutral external contract — `AxiCredentialKind`, `AxiCredentialRef`, `AxiQuotaSnapshot`, `AxiInstanceBinding`, `AxiAccountProfile`, `AxiProviderProfile` — and exposes per-vendor `map_codex_oauth_account(value: &Value) -> AxiAccountProfile`, `map_codex_api_provider`, `map_gemini_account`, `map_cursor_account`, `map_windsurf_account` etc. The credential_ref uses the namespaced form `secret_ref:axi-accounts/{provider}/{account_id}` with `owner: "axi-accounts"`. This is a Rust-side contract whose shape mirrors what the `axi-accounts` consumer service would consume: it lets the desktop app export its locally-stored credentials into a stable, vendor-neutral JSON shape that an external vault or gateway could read. For Axi this is a strong hint about how a *desktop credential manager* and a *cloud credential vault* should agree on a contract, and is worth lifting directly.

The **multi-instance runtime** is the second half of the user-facing story. `modules/instance.rs` and `modules/instance_store.rs` keep an `instances.json` file under the app data dir, guarded by a `Mutex<()>`, with a `DefaultInstanceSettings` block that controls new instances' defaults (root dir, user-data-dir, follow-local-account). Each platform's `*_instance.rs` module (e.g. `codex_instance.rs`, `cursor_instance.rs`) reads the instance list, lets the user pick one, and spawns a process with the bound account and the platform-specific launch args via `modules/process.rs`. The frontend renders this through `pages/InstancesPage.tsx` and `pages/{Codex,Cursor,Windsurf,…}InstancesPage.tsx`, with `services/createPlatformInstanceService.ts` factoring the common shape. The "floating card" window (`pages/FloatingCardWindow.tsx`, defined in `tauri.conf.json` as a second transparent webview `label: "floating-card"`) is a small always-on-top indicator showing the current account, and is the kind of "secondary window" that Axi's desktop tools could reuse.

The **frontend architecture** is conventional but disciplined: a single `App.tsx` lazy-loads every page (`lazy(() => import('./pages/…'))`), wires 13+ Zustand stores (one per platform + a global modal + a layout store + a top-right ad store), exposes a hook layer (`useAutoRefresh`, `useDropdownPanelPlacement`, `usePagination`, `usePlatformRuntimeSupport`, `useProviderAccountsPage`), and uses `createProviderAccountStore<T>` (`stores/createProviderAccountStore.ts`) as a generic store factory parameterised by platform — the same factory backs `useCodexAccountStore`, `useCursorAccountStore`, etc. with per-platform `ProviderService` and `ProviderMapper` implementations. Internationalisation uses `react-i18next` with 18 locale JSON files in `src/locales/` and a normalisation table (`'zh-CN' → 'zh-cn'`, `'pt-BR' → 'pt-br'`, etc.) in `src/i18n/index.ts`. `scripts/check_locales.cjs` and `scripts/update_locales.cjs` are the locale-keep-in-sync utilities.

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| Upstream initial release | Pin | Pin: upstream `jlcodes99/cockpit-tools` at (inferred from overlay) `56bae7bb chore(workspace): sync governance stubs (AGENTS + manifest)` |
| Axi reference-overlay landing | Shipped | `2c0beebd Normalize local reference milestone docs`, `ec720d92 Record reference milestone naming submit batch`, `c267c7a0 Record submit log for cockpit-tools batch`; overlay files `AGENTS.md`, `INDEX.md`, `PRD.md`, `TDD.md`, `TODO.md`, `MILESTONE.md`, `SECURITY.md`, `docs/project-docs.manifest.json` in place |
| Workspace preflight / audit | Shipped | `5f537c69 chore(cockpit-tools-): checkpoint workspace changes`; `1aa7eed2 Make workspace git tracking auditable`; `56bae7bb chore(workspace): sync governance stubs (AGENTS + manifest)` |
| Active Axi development on this checkout | Not started | Checkout is read-only reference; no Axi-owned commits other than overlay/doc normalization (`7ebd6c2f Preserve tdd changes`, `094a2ba4 Preserve prd changes`, `83ef416b Preserve index changes`, `25ec339c Preserve milestone changes`) |
| 12-vendor cross-platform matrix | Shipped (upstream) | Antigravity + Codex + GitHub Copilot + Windsurf + Kiro + Cursor + Gemini Cli + CodeBuddy + CodeBuddy CN + Qoder + Trae + Zed + Workbuddy; per-vendor triple in `modules/` |
| Vendor-neutral account contract | Shipped (upstream) | `src-tauri/src/modules/axi_accounts_contract.rs` defines `AxiCredentialKind`, `AxiCredentialRef`, `AxiQuotaSnapshot`, `AxiInstanceBinding`, `AxiAccountProfile`, `AxiProviderProfile`; `secret_ref:axi-accounts/{provider}/{account_id}` namespace |
| Multi-instance runtime UI | Shipped (upstream) | `instances.json` mutex-guarded store; `pages/InstancesPage.tsx` + per-platform instance pages; `services/createPlatformInstanceService.ts`; floating-card webview in `tauri.conf.json` |

## Authoritative Documents

- `/Volumes/code/workspace/references/short-term/cockpit-tools/README.en.md` — upstream English overview (full feature matrix, 12-platform support list, multi-instance description).
- `/Volumes/code/workspace/references/short-term/cockpit-tools/README.md` — upstream Simplified Chinese overview.
- `/Volumes/code/workspace/references/short-term/cockpit-tools/CHANGELOG.md` (142 KB) and `CHANGELOG.zh-CN.md` (131 KB) — extensive per-version history.
- `/Volumes/code/workspace/references/short-term/cockpit-tools/SECURITY.md` — desktop-app threat-model summary.
- `/Volumes/code/workspace/references/short-term/cockpit-tools/announcements.json` — in-app announcement feed (full content embedded in repo).
- Axi reference overlay: `AGENTS.md`, `INDEX.md`, `PRD.md`, `TDD.md`, `TODO.md`, `MILESTONE.md`, `docs/project-docs.manifest.json`.

## Cross-References

- **`axi-accounts` / Axi credentials vault service (per agent-bff ADR-005 and gateway ADR-006)** — `src-tauri/src/modules/axi_accounts_contract.rs` ships a vendor-neutral account/credential/quota/instance contract and is the closest available reference for the shape Axi should adopt between a desktop credential manager and a cloud vault. The namespaced `secret_ref:axi-accounts/{provider}/{account_id}` is exactly the kind of ref-id convention Axi's credential layer needs.
- **Multi-window Tauri desktop tools (`axi-pet-desktop-runtime`, future Axi dashboard apps)** — `lib.rs` setup hook, `floating_card_window.rs`, `macos_native_menu.rs`, and the second webview declared in `tauri.conf.json` form a small, complete template for a "main window + always-on-top indicator + system tray + deep-link intake" desktop app.
- **Multi-instance launcher UI** — `pages/InstancesPage.tsx` + `services/platform/createPlatformInstanceService.ts` + `stores/createProviderAccountStore.ts` is the cleanest multi-instance, multi-platform dashboard abstraction in the workspace; lift the generic factory shape for any Axi product that needs a "many workers, one operator" view.
- **Quota/window polling UI** — `hooks/useAutoRefresh.ts`, `modules/quota_cache.rs`, `modules/wakeup_scheduler.rs`, and `pages/DashboardPage.tsx` together document a refresh-pacing pattern that avoids hammering upstream quota endpoints while keeping the dashboard live. Reuse for any Axi quota/usage dashboard.
- **OAuth-on-the-desktop pattern** — `modules/oauth_server.rs` (local HTTP callback server), `modules/oauth_pending_state.rs` (persist across restart), `modules/codex_oauth.rs` and the rest of the per-platform `*_oauth.rs` files document a stable "OAuth flow that survives app restart, deep links, and machine sleep" implementation. Directly applicable to any Axi desktop or web-app that needs third-party vendor OAuth.
- **Per-vendor credential storage pattern (anti-pattern caveat)** — `modules/vscode_inject.rs` and `modules/db.rs` show how to read/write another application's SQLite credential store, including platform-specific safe-storage crypto. Useful as a *cautionary* reference — Axi should NOT replicate this in production; it documents the depth required and the legal/ToS risk of touching vendor credential stores.
- **Sibling reference (`sub2api`)** — together with the sub2api dossier, this reference shows the two complementary execution models for the same conceptual problem of "many upstream AI subscriptions behind one platform": sub2api is server-side (one upstream account shared across many downstream API keys, billed by token), cockpit-tools is client-side (many upstream accounts held by one user, switched in-place). The **Axi-account contract** defined in `axi_accounts_contract.rs` is the natural bridge between the two, and is the most actionable insight for the Axi platform.
- **i18next + 18-locale pattern** — `src/i18n/index.ts` + `scripts/check_locales.cjs` is a small but complete template for any Axi product that needs multi-locale support without per-locale duplication.