# Claude Code Sourcemap Analysis

## Purpose

This note is a clean-room capability inventory of the local reference repository:

- source: `F:\enterprise-workspace\references\claude-code-sourcemap`
- analyzed snapshot: `restored-src/src/**`

The goal is not to copy implementation details into `axi-app-cli`, but to extract:

- reusable architectural patterns
- capability seams
- contribution models
- performance and startup strategies
- mappings into Axi's `foundation / extension / experimental` module system

## High-Level Shape

The reference repository is not a "CLI with a few subcommands". It is a capability platform with a CLI entrypoint.

Top-level file concentration under `src/`:

- `utils`: 564 files
- `components`: 389 files
- `commands`: 207 files
- `tools`: 184 files
- `services`: 130 files
- `hooks`: 104 files
- `ink`: 96 files
- `bridge`: 31 files
- `skills`: 20 files
- `cli`: 19 files

This indicates a layered system:

1. entrypoints and command routing
2. runtime orchestration
3. capability providers
4. UI and interaction surface
5. extension surface

## Primary Architectural Planes

### 1. Bootstrap Plane

Representative files:

- `src/entrypoints/cli.tsx`
- `src/entrypoints/init.ts`
- `src/main.tsx`
- `src/setup.ts`
- `src/utils/startupProfiler.ts`

Responsibilities:

- fast-path CLI dispatch
- startup checkpointing and profiling
- safe early config parsing
- environment and transport setup
- startup-time concurrency and cache warming

Important pattern:

- the bootstrap plane is intentionally tiny, performance-aware, and separated from the full runtime

### 2. Command Plane

Representative files:

- `src/commands.ts`
- `src/commands/**`
- `src/cli/handlers/**`

Responsibilities:

- register built-in commands
- merge command contributions from multiple sources
- gate commands by environment, auth, policy, feature flags, and runtime availability
- provide lazy shims for heavy command implementations

Important pattern:

- commands are not only static built-ins
- final command availability is assembled from built-in commands, bundled skills, plugin commands, skill directories, workflows, and MCP-derived capabilities

### 3. Tool Plane

Representative files:

- `src/Tool.ts`
- `src/tools.ts`
- `src/tools/**`

Responsibilities:

- define tool contracts
- register tool inventory
- attach tool permission context
- expose an execution surface to the query engine

Important pattern:

- tools are a first-class capability plane, distinct from slash commands
- command and tool systems are parallel, not the same abstraction

### 4. Query / Execution Plane

Representative files:

- `src/query.ts`
- `src/QueryEngine.ts`
- `src/tasks/**`
- `src/Task.ts`

Responsibilities:

- own message lifecycle
- run tool-call turns
- persist session-scoped state
- manage headless and interactive execution differences

Important pattern:

- execution orchestration is centralized and reusable, instead of being hidden inside UI components or command handlers

### 5. Service Plane

Representative files:

- `src/services/api/**`
- `src/services/mcp/**`
- `src/services/plugins/**`
- `src/services/lsp/**`
- `src/services/oauth/**`
- `src/services/policyLimits/**`
- `src/services/remoteManagedSettings/**`

Responsibilities:

- external I/O
- remote config
- registry clients
- plugin operations
- API and transport concerns
- policy and managed settings

Important pattern:

- service modules provide reusable capability backends consumed by commands, tools, and runtime orchestration

### 6. Interaction / UI Plane

Representative files:

- `src/screens/REPL.tsx`
- `src/components/**`
- `src/ink/**`
- `src/hooks/**`
- `src/interactiveHelpers.tsx`

Responsibilities:

- terminal UI rendering
- input handling
- dialog systems
- keyboard routing
- interrupt and prompt state coordination

Important pattern:

- input, dialogs, keybindings, and screen composition are their own layer, not mixed into core execution

### 7. Extension Plane

Representative files:

- `src/skills/**`
- `src/plugins/**`
- `src/utils/plugins/**`
- `src/services/plugins/**`

Responsibilities:

- bundled skill registration
- built-in plugin registration
- plugin command discovery
- dynamic skill loading from filesystem and external sources

Important pattern:

- extension is contribution-based, not hardcoded to one source

## Key Cross-Cutting Patterns

### Capability Aggregation Over Static Wiring

The repository repeatedly aggregates from multiple contribution sources:

- commands from built-ins + plugins + bundled skills + dynamic skills + workflows
- tools from base tool inventory + feature-gated tools + environment-gated tools
- settings from multiple sources
- MCP resources and commands from local and remote registries

Implication for Axi:

- our module system should prefer `contributions[]` over ad hoc special-case fields
- modules should be able to contribute commands, assets, docs, scaffolding outputs, policies, prompts, and future runtime capabilities through a common protocol

### Fast-Path vs Full Runtime Separation

The repository isolates cheap paths from expensive initialization:

- `--version` avoids loading the runtime
- special operational paths load only the modules they need
- heavy commands can be lazy shims

Implication for Axi:

- this pattern should become a reusable capability, not only a CLI trick
- we should model "dispatch strategy" as a foundation capability

### Early Parsing for Critical Flags

`eagerParseCliFlag()` is used for flags that affect early initialization, such as settings loading.

Implication for Axi:

- module policy, module source overrides, marketplace settings, and environment presets should be parseable before the full module graph boots

### Background Warmup with Safety Gates

The repository does startup-time warmup only when safe and only after prerequisites are ready:

- preconnect after certs/proxy setup
- system context prefetch only after trust
- plugin sync awaited in headless mode, fire-and-forget in interactive mode

Implication for Axi:

- warmup should be a capability plane with gating metadata
- modules should be able to declare optional warmups with:
  - prerequisites
  - interactive/headless policy
  - safety constraints

### Registry + Memoization

Command and skill loading is memoized and invalidatable.

Implication for Axi:

- our module registry should separate:
  - static manifests
  - resolved graph
  - cached contributions
  - invalidation hooks

### Runtime Contribution Types

The reference repository effectively supports multiple contribution types already:

- command contribution
- tool contribution
- skill contribution
- plugin contribution
- settings contribution
- prefetch/warmup contribution
- UI/dialog contribution
- transport/service contribution

Implication for Axi:

- our current `contributions` model is directionally correct, but too narrow
- it should evolve into typed contribution families

## High-Value Reference Mechanisms

### Startup / Input Responsiveness

Relevant files:

- `src/entrypoints/cli.tsx`
- `src/utils/earlyInput.ts`
- `src/utils/startupProfiler.ts`
- `src/utils/apiPreconnect.ts`

Extracted mechanisms:

- ultra-thin bootstrap entrypoint
- dynamic import routing
- early raw-stdin input buffering
- preconnect/warmup after transport setup
- explicit profiling checkpoints

Use in Axi:

- not as a CLI-only feature
- as a reusable `startup-acceleration` foundation capability

### Bundled Skills as Structured Contributions

Relevant files:

- `src/skills/bundled/index.ts`
- `src/skills/loadSkillsDir.ts`

Extracted mechanisms:

- skills are registered via explicit functions
- dynamic skills are loaded from filesystem sources
- frontmatter is parsed into typed capability metadata
- availability and visibility are runtime-checked

Use in Axi:

- maps well to our extension/experimental module contribution model
- especially relevant if we want optional feature packs, generator packs, or design-system presets to behave like installable capabilities

### Tools as a Capability Bus

Relevant files:

- `src/Tool.ts`
- `src/tools.ts`

Extracted mechanisms:

- clear tool contract
- unified tool inventory
- contextual gating and permissions
- environment-sensitive tool availability

Use in Axi:

- we should not restrict "module capability" to scaffolding files only
- some Axi modules will eventually want to contribute:
  - generators
  - validators
  - migrations
  - doctor checks
  - sync transforms

### Commands as Assembled Surface, Not Core Truth

Relevant files:

- `src/commands.ts`
- `src/cli/handlers/**`

Extracted mechanisms:

- command surface is assembled late
- heavy command bodies can load lazily
- registry and availability checks sit above actual implementation

Use in Axi:

- `axi add`, `axi sync`, `axi doctor`, `axi list`, future `axi market`, `axi template`, `axi migrate`, `axi preset`, `axi theme`, `axi component` should all be modeled as assembled command contributions

## What Maps Cleanly Into Axi's Three Layers

### Foundation Layer

Reference-derived foundation capabilities we should model explicitly:

- bootstrap/dispatch strategy
- module graph resolution
- manifest and policy loading
- contribution registry
- generator/render pipeline
- sync/reconciliation engine
- doctor/validation engine
- profiling and diagnostics
- warmup orchestration
- cache and invalidation hooks

These are not business features. They are core system infrastructure.

### Extension Layer

Reference-inspired extension patterns:

- theme packs
- style-system packs
- UI component packs
- hooks/composables packs
- backend integration packs
- docs generators
- preset bundles
- marketplace or remote catalog clients

These should contribute into the foundation layer through typed manifests.

### Experimental Layer

Reference-inspired experimental patterns:

- labs-only generators
- experimental preset families
- advanced documentation systems
- complex UI kits
- remote module registries
- AI-assisted scaffold refinement

These should be isolated and optional, but use the same contribution protocol.

## What Should Not Be Naively Copied

Some reference mechanisms are specific to the Claude Code product context and should not be transplanted directly:

- platform-specific keychain and MDM optimizations
- Anthropic API-specific transport preconnect behavior
- terminal-UI assumptions tied to Ink REPL semantics
- auth/provider/policy logic that is specific to their product model

The reusable lesson is the pattern, not the implementation.

## Concrete Design Direction For Axi

Based on the reference repository, Axi should evolve from "moduleized scaffold generator" into a capability platform with these abstractions:

### 1. Module Manifest

Each module should declare:

- `id`
- `layer`
- `version`
- `enabledByDefault`
- `dependencies`
- `configKey`
- `contributions`
- `warmups`
- `checks`

### 2. Typed Contributions

At minimum, Axi should support contribution families such as:

- `command`
- `generator`
- `template-fragment`
- `token-fragment`
- `doc-fragment`
- `script`
- `doctor-check`
- `sync-transform`
- `preset`
- `style-preset`
- `theme-preset`
- `component-pack`
- `composable-pack`

### 3. Warmup Contributions

A module should be able to declare optional boot-time or session-time warmups:

- cache prime
- local registry scan
- marketplace metadata fetch
- template manifest preload
- preset preview preload

These should be gated by environment and command mode.

### 4. Command Assembly

Commands should be assembled from module contributions rather than living only in a hardcoded CLI switch.

Examples:

- `axi add`
- `axi sync`
- `axi doctor`
- `axi list`
- `axi preset`
- `axi theme`
- `axi module`
- `axi inspect`

### 5. Capability Graph, Not Just Feature List

The long-term model should be:

- modules contribute capabilities
- capabilities expose commands, generators, checks, assets, or policies
- command routing and generation pipelines consume resolved capabilities

This is closer to the reference architecture than a plain scaffold CLI.

## Priority Recommendations

### Priority A

- formalize typed contribution families
- split bootstrap/dispatch into a reusable foundation module
- add warmup capability contracts
- separate command contribution registry from command execution

### Priority B

- make generator pipeline contribution-based
- let extension modules contribute doctor checks and sync transforms
- introduce structured profiling/diagnostics hooks

### Priority C

- add experimental capability slots for future remote catalogs, AI-assisted generation, and advanced docs systems

## Bottom Line

The strongest lesson from the reference repository is not "make CLI startup faster".

The stronger lesson is:

- keep the bootstrap thin
- move behavior into capability registries
- let multiple contribution sources assemble the final surface
- use safety-gated warmups and deferred work
- treat commands, tools, skills, services, and runtime checks as parallel capability planes

For Axi, this means the right target architecture is:

- a modular foundation runtime
- extension and experimental modules that contribute into it
- a command surface assembled from capability manifests
- scaffold generation as one capability among several, not the only one
