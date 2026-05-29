# Changelog

## 1.0.1

- refactor the scaffolder repository into a pnpm workspace monorepo
- split the CLI shell into `apps/cli`
- move scaffold runtime, registry, and templates into `packages/scaffold-core`
- split shared contracts into `packages/scaffold-kit`
- split layered module registry and preset policy into `packages/scaffold-registry`
- split CLI runtime, sync, doctor, install, and file orchestration into `packages/scaffold-runtime`
- remove the redundant `packages/scaffold-core` facade and point the CLI straight at the runtime
- split web, api, and token foundations into dedicated workspace packages
- split workspace, governance, docs, and resource foundations into `packages/foundation-ops`
- split theme, UI, hooks, and experimental modules into dedicated feature packages

## 1.0.0

- initialize the Axi App CLI repository
- add the TypeScript CLI entrypoint and generation pipeline
- introduce the default full-stack monorepo template contract
- add layered module config in `.axi/modules.json`
- add `axi sync` to reconcile edited module state
- remove stale managed files when modules are disabled
- add `axi list` and `axi doctor` for module inventory and scaffold diagnostics
- add `--json` output for `list` and `doctor`
- add `doctor --fix` for controlled scaffold repair
