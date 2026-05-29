# Axi Module Contribution Schema

## Goal

Modules in Axi must evolve from "file bundles" into typed capability contributors.

A module should declare:

- identity
- layer
- policy defaults
- dependencies
- conditions
- contributions
- checks
- warmups

The CLI runtime should then assemble these into the final product surface.

## Core Concepts

### Module

A module is a versioned unit of capability that can be resolved, enabled, applied, inspected, and synchronized.

### Policy

Policy expresses desired state.

In Axi today, this is primarily represented by:

- `.axi/modules.json`

### Snapshot

Snapshot expresses applied state.

In Axi today, this is primarily represented by:

- `.axi/scaffold.manifest.json`

### Contribution

A contribution is a typed piece of functionality that a module offers to the runtime.

Examples:

- command
- template fragment
- doctor check
- sync transform
- warmup

## Proposed Module Manifest Shape

```ts
type ModuleLayer = 'foundation' | 'extension' | 'experimental';

type ModuleManifest = {
  id: string;
  displayName: string;
  version: string;
  layer: ModuleLayer;
  enabledByDefault: boolean;
  configKey: string;
  description?: string;
  dependencies?: string[];
  optionalDependencies?: string[];
  conflicts?: string[];
  conditions?: ModuleCondition[];
  contributions?: ModuleContribution[];
  doctorChecks?: DoctorCheckContribution[];
  syncTransforms?: SyncTransformContribution[];
  warmups?: WarmupContribution[];
  policies?: PolicyContribution[];
};
```

## Policy File Shape

Policy should remain editable and user-owned.

Recommended direction:

```json
{
  "version": 1,
  "modules": [
    {
      "id": "web-core",
      "enabled": true,
      "layer": "foundation",
      "configKey": "modules.webCore",
      "version": "1.0.0"
    }
  ]
}
```

Rules:

- policy expresses desired state
- policy should not store transient runtime caches
- policy may include user choices and overrides

## Snapshot Shape

Snapshot should record what was actually applied.

Recommended direction:

```json
{
  "version": 2,
  "modules": [
    {
      "id": "web-core",
      "layer": "foundation",
      "enabled": true,
      "version": "1.0.0"
    }
  ],
  "managedFiles": [],
  "appliedAt": "2026-04-02T00:00:00.000Z"
}
```

Rules:

- snapshot is runtime-owned
- snapshot is the basis for drift detection
- snapshot should capture enough data to support cleanup and reconciliation

## Contribution Families

### `command`

Adds a command or subcommand to the assembled CLI surface.

```ts
type CommandContribution = {
  type: 'command';
  id: string;
  command: string;
  group?: 'scaffold' | 'inspect' | 'repair' | 'experimental';
  availability?: AvailabilityRule[];
  load: () => Promise<CommandHandler>;
};
```

### `template`

Adds files, directories, or template fragments to generation output.

```ts
type TemplateContribution = {
  type: 'template';
  id: string;
  phase: 'init' | 'create' | 'add' | 'sync';
  targets: string[];
  render: (ctx: RenderContext) => ProjectFile[];
};
```

### `doc-fragment`

Adds sections to generated docs or repository-facing design docs.

```ts
type DocContribution = {
  type: 'doc-fragment';
  id: string;
  documents: string[];
  render: (ctx: RenderContext) => DocFragment[];
};
```

### `script`

Adds executable scripts, tasks, or generated task runners.

```ts
type ScriptContribution = {
  type: 'script';
  id: string;
  phase: 'init' | 'sync';
  render: (ctx: RenderContext) => ProjectFile[];
};
```

### `doctor-check`

Adds a health or drift validator.

```ts
type DoctorCheckContribution = {
  type: 'doctor-check';
  id: string;
  categories: string[];
  run: (ctx: DoctorContext) => Promise<DoctorFinding[]>;
};
```

### `sync-transform`

Adds reconciliation logic used during sync or repair.

```ts
type SyncTransformContribution = {
  type: 'sync-transform';
  id: string;
  order?: number;
  run: (ctx: SyncContext) => Promise<SyncAction[]>;
};
```

### `warmup`

Adds optional preload or cache priming behavior.

```ts
type WarmupContribution = {
  type: 'warmup';
  id: string;
  when: Array<'bootstrap' | 'init' | 'add' | 'sync' | 'list' | 'doctor'>;
  mode: Array<'interactive' | 'recommended' | 'ci' | 'json'>;
  blocking: 'eager' | 'deferred' | 'background';
  run: (ctx: WarmupContext) => Promise<void>;
};
```

### `preset`

Adds grouped defaults or policy bundles.

```ts
type PresetContribution = {
  type: 'preset';
  id: string;
  category: 'theme' | 'style' | 'project' | 'feature-set';
  includes: string[];
};
```

### `policy`

Adds policy defaults, restrictions, or precedence behavior.

```ts
type PolicyContribution = {
  type: 'policy';
  id: string;
  apply: (ctx: PolicyContext) => PolicyPatch;
};
```

## Conditions

Modules should support conditional activation without becoming brittle.

```ts
type ModuleCondition =
  | { type: 'file-exists'; path: string }
  | { type: 'directory-exists'; path: string }
  | { type: 'module-enabled'; id: string }
  | { type: 'command-mode'; value: 'interactive' | 'recommended' | 'ci' | 'json' }
  | { type: 'platform'; value: 'windows' | 'macos' | 'linux' };
```

Use cases:

- contribute only when `vite.config.ts` exists
- contribute only when `style-system` is enabled
- skip interactive-only capabilities in CI

## Assembly Order

Deterministic assembly is required.

Recommended precedence:

1. foundation built-ins
2. foundation policies
3. extension built-ins
4. project-level modules
5. experimental modules
6. session or temporary overlays

Rules:

- dependencies are resolved before precedence is applied
- precedence affects override and merge order
- snapshot should record the final resolved graph

## Visibility vs Execution

A capability should support two separate decisions:

- `visible`: should this contribution appear in the assembled surface
- `runnable`: may this contribution execute right now

This distinction is especially important for:

- commands
- doctor checks
- warmups
- future external providers

## Suggested Runtime Types

```ts
type CapabilitySpec = {
  id: string;
  type: string;
  provenance: 'builtin' | 'module' | 'external' | 'generated';
  visibility: 'always' | 'deferred' | 'hidden';
  safety: 'read-only' | 'mutating' | 'interactive';
};

type CapabilityProvider = {
  moduleId: string;
  contributionId: string;
  resolve: () => Promise<unknown>;
};

type ExecutionPolicy = {
  allow: boolean;
  reason?: string;
  blocking?: 'eager' | 'deferred' | 'background';
};
```

## Validation Rules

The runtime should validate that:

- module ids are unique
- `configKey` is stable and unique
- dependencies exist
- conflicts are not simultaneously enabled
- contributions have stable ids
- warmups declare allowed phases and modes
- doctor checks are read-only by contract

## Design Direction

The schema should let Axi evolve toward:

- modular commands
- modular generation
- modular diagnostics
- modular warmups
- modular interactive capabilities

without forcing the CLI core to know each module by name.
