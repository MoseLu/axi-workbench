# Axi Coder

Axi Coder is the Axi development workbench product line. It is not an account ledger, provider catalog, or ops dashboard. Its job is to carry complete development capability: project context, AI coding CLI orchestration, terminal sessions, agent task execution, artifact review, model routing, and reversible local configuration.

The product line has two first-class client surfaces:

- Mac desktop: the current Tauri 2 app in this repo.
- Mobile companion: the mobile Axi Coder surface that consumes the same Workstation, Agent, Notify, Accounts, and Model Gateway contracts.

Axi Coder can also run as an Axi Dashboard hosted app at
`/apps/axi-coder/overview`. In hosted mode the dashboard injects
`AXI_APP_BASE` and `AXI_APP_PORT`; the React app uses the stable route while
native-only Tauri commands fall back to browser-safe mock behavior instead of
calling the host dashboard's Tauri runtime.

Provider routing and proxying are part of Axi Coder because a development workbench needs models, routes, and CLI control. They do not reduce Axi Coder to the `axi-model-gateway` infrastructure role.

## Current Scope

- Tauri 2 desktop shell with React, TypeScript, Rust, SQLite, and system Keychain secret storage.
- Provider setup with one-time base URL/API key entry, automatic provider type inference, model discovery for OpenAI-compatible APIs, and DeepSeek-first defaults.
- Local proxy foundation on `127.0.0.1:15721` for Claude Messages, OpenAI Chat/Responses, and Gemini native request shapes.
- Managed CLI takeover and restore for Claude, Codex, and Gemini config files.
- Development workbench contract for Mac desktop and mobile companion surfaces.
- Health checks with diagnostic categories for auth, billing, rate limit, invalid request, provider errors, timeouts, DNS, and TLS failures.
- Request log table, per-CLI route controls, all-CLI proxy toggle, automatic parameter derivation, and local Ollama scan.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm tauri dev
```

Rust checks live under `src-tauri`:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Secrets are stored in the system keychain. The SQLite database stores only a secret reference.

## Verification Notes

- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- `cargo check --manifest-path src-tauri/Cargo.toml --offline` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml --offline` passes with 10 unit tests.
- `/Users/mose/Desktop/API.txt` was used only for a local DeepSeek smoke test. The first key in that file successfully completed a minimal `/v1/chat/completions` request; another key returned 401 and was not stored.
