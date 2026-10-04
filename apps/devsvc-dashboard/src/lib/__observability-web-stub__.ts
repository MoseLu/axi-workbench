// Local stub for `@axi/observability-web`.
//
// `@axi/observability-web` is not yet published into this workspace's
// `packages/`; the closest artifact lives in
// `/Volumes/code/workspace/foundation/axi-observability/web`, which transitively
// depends on `@axi/observability-logging` — a server-side pino + AsyncLocalStorage
// logger. Pulling that chain into a browser bundle breaks the SPA with
// `Module "node:async_hooks" has been externalized for browser compatibility`.
//
// The `src/main.tsx` dynamic import only calls `installWeb` as a no-op telemetry
// hook, so we alias the module id to this stub at the Vite resolve.alias level.
// `installWeb` simply returns a teardown function and never touches the network.
// Replace this once `@axi/observability-web` ships a browser-safe build.
export interface InstallWebOptions {
  service: string
  env: string
  ingestUrl: string
  [extra: string]: unknown
}

export function installWeb(_options: InstallWebOptions): () => void {
  // Intentional no-op. Replace with the real package once published.
  return () => undefined
}

export default { installWeb }