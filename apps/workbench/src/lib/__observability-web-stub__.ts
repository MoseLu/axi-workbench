// Local stub for `@axi/observability-web`.
//
// The monorepo's `apps/workbench/package.json` declares the package as a
// workspace dependency, but the package itself is not yet published into
// `packages/`. The `apps/workbench/src/main.tsx` dynamic import is wrapped
// in a `void import(...)` chain with `.then(...)` and the goal is a no-op
// telemetry hook (see the comment block above the import). To keep dev
// servers runnable without depending on a yet-unpublished package, we
// alias the module id to this stub at the Vite resolve.alias level. The
// stub's `installWeb` simply returns a teardown function and never
// touches the network.
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