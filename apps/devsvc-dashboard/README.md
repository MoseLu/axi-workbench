# Axi DevSvc Dashboard

Local PM2 service management dashboard for the workspace dev services.

## Runtime

The dashboard source lives in this project, but the running PM2 service is
started by the workspace wrapper:

```bash
/Volumes/code/workspace/scripts/devsvc restart devsvc-dashboard
```

Production assets are served by:

```text
/Volumes/code/workspace/scripts/devsvc-dashboard.mjs
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

The PM2-hosted dashboard is available at:

```text
http://127.0.0.1:17888/
```

## macOS App

The Tauri shell builds a native macOS app named `Axi Dashboard`. The release
window loads the local dashboard service at `http://127.0.0.1:17888`, so keep
`workspace:devsvc-dashboard` running before opening the app:

```bash
/Volumes/code/workspace/scripts/devsvc start devsvc-dashboard
pnpm tauri build
open "src-tauri/target/release/bundle/macos/Axi Dashboard.app"
```

## Axi Dashboard Host

The dashboard is an AxiomaticWorld (公理世界) surface. `Axi` is the stable short
prefix used for local ids and UI labels; it should not be expanded into path or
package renames without a dedicated migration.

`config/axi-apps.json` declares Axi applications that can be opened inside the
dashboard under stable routes such as `/apps/axi-fleet-console/dashboard`. The
dashboard allocates the real loopback port at runtime and injects it through
`AXI_APP_PORT`; app config keeps only the `${port}` placeholder. Browser-based
Axi apps, including Axi Docs, Axi Image Preview, and the Axi Agent Platform
frontend, are entered through this shell instead of requiring separate visible
ports.

`config/axi-resources.json` is the dashboard-side Axi resource index. Use it for
Axi owners that are not directly iframe-hosted, such as Workstation,
Notify/Mobile, Todo, Axi UI, and the local registry. New Axi entrypoints should
be registered here or in `config/axi-apps.json` instead of creating a separate
dashboard shell.

In the dashboard sidebar, `Axi 应用` lists **Axi Dashboard Apps** only, while
`Axi 资源` holds the broader **Axi Resources** index and other non-app entries.

The desktop shell lives under `src-tauri/` and follows the workspace Tauri
starter boundary: shared cache/bootstrap conventions stay in
`/Volumes/code/workspace/shared/axi-tauri-starter`, while app registry, routing,
and host behavior stay in this repo.
