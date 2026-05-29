# Axi Runtime Lifecycle Specification

## Goal

Define a consistent runtime lifecycle for all Axi commands so that:

- modules can contribute behavior safely
- users get predictable outcomes
- sync and doctor can reason about the same state model
- performance work has explicit lifecycle boundaries

## Lifecycle Model

Axi should treat every invocation as a lifecycle-driven operation.

Not every command uses every phase, but all commands should fit within the same frame.

## Primary Runtime Phases

### Phase 1. Bootstrap

Responsibilities:

- parse minimal argv
- resolve fast paths like help and version
- initialize lightweight diagnostics or profiling
- determine command class

Design rules:

- fast paths should avoid heavy module graph loading
- bootstrap should remain as thin as possible

### Phase 2. Context Resolution

Responsibilities:

- resolve `cwd`
- determine interaction mode
- identify whether the command is read-only, mutating, or repair-oriented
- read minimal project metadata needed for routing

### Phase 3. Policy Load

Responsibilities:

- load `.axi/modules.json`
- normalize policy state
- apply default preset or built-in policy where needed

Outputs:

- desired module state

### Phase 4. Snapshot Load

Responsibilities:

- load `.axi/scaffold.manifest.json`
- identify last applied state
- prepare drift comparison basis

Outputs:

- applied module state

### Phase 5. Registry Assembly

Responsibilities:

- load foundation module manifests
- load extension and experimental module manifests
- resolve typed contributions

Outputs:

- raw capability registry

### Phase 6. Graph Resolution

Responsibilities:

- expand dependencies
- detect conflicts
- evaluate conditions
- compute final enabled module graph

Outputs:

- resolved module graph
- visible contributions

### Phase 7. Command-Specific Planning

Responsibilities vary by command.

Examples:

- `init/create`: generation plan
- `add`: incremental module application plan
- `sync`: reconciliation plan
- `doctor`: diagnostic plan
- `list`: inspection plan

Outputs:

- operation plan

### Phase 8. Preflight Validation

Responsibilities:

- ensure target directory safety
- validate command-specific prerequisites
- validate contribution invariants
- confirm mutation in interactive mode if required

### Phase 9. Execution

Responsibilities:

- run command-specific contributions
- apply templates, docs, scripts, sync transforms, or checks
- track managed outputs

### Phase 10. Install / Verify

Responsibilities:

- run dependency installation if enabled
- run verification if enabled
- skip gracefully when policy or flags say to skip

### Phase 11. Persist

Responsibilities:

- write applied snapshot
- update managed file inventory
- write generated policy-derived artifacts if needed

### Phase 12. Deferred Work

Responsibilities:

- run deferred warmups
- refresh caches
- perform non-blocking housekeeping

This phase should never compromise the correctness of the just-completed command.

## Command-Class Lifecycles

### Inspection Commands

Examples:

- `list`
- `doctor`

Typical phases:

- bootstrap
- context resolution
- policy load
- snapshot load
- registry assembly
- graph resolution
- command-specific planning
- execution

Rules:

- prefer cache-only resolution where possible
- no mutation unless explicitly in repair mode

### Mutation Commands

Examples:

- `init`
- `create`
- `add`
- `sync`

Typical phases:

- bootstrap
- context resolution
- policy load
- snapshot load
- registry assembly
- graph resolution
- planning
- preflight
- execution
- install / verify
- persist
- deferred work

### Repair Commands

Examples:

- `doctor --fix`

Typical phases:

- bootstrap
- context resolution
- policy load
- snapshot load
- registry assembly
- graph resolution
- diagnostic planning
- repair planning
- preflight
- execution
- persist

Rules:

- repair scope must be bounded
- repair actions must stay within managed responsibility

## Warmup Model

Warmups are optional runtime accelerators contributed by modules.

They should declare:

- `when`
- `mode`
- `blocking`

### Blocking Classes

- `eager`
  Needed before the command can proceed correctly.
- `deferred`
  Safe to start after the critical path but still relevant to the current session.
- `background`
  Optional and non-essential for the current invocation.

### Example Uses

- template catalog preload
- token registry scan
- extension module index cache
- remote marketplace metadata fetch

## Mode Model

### Interactive

Characteristics:

- can ask for confirmation
- can provide richer progress narration
- may schedule deferred work after initial progress becomes visible

### Recommended

Characteristics:

- no interruptions
- uses deterministic defaults
- still follows the same lifecycle and persistence model

### CI

Characteristics:

- no prompt dependency
- deterministic exits
- minimal noise

### JSON

Characteristics:

- structured stdout
- human guidance may move to stderr
- should compose with inspection workflows

## Persistence Rules

### Policy File

Represents desired state.

Rules:

- user-editable
- durable across invocations
- input to sync and doctor

### Snapshot File

Represents applied state.

Rules:

- runtime-owned
- records last successful application
- basis for managed cleanup and drift detection

## Drift Model

Drift exists when:

- desired modules differ from applied modules
- managed files are missing or stale
- applied outputs no longer match current resolved contributions

`doctor` should detect drift.  
`sync` should reconcile drift.  
`doctor --fix` may reconcile bounded drift when safe.

## Error Handling Model

Each failure should be attributable to a lifecycle phase.

Recommended internal failure categories:

- bootstrap failure
- policy failure
- snapshot failure
- registry failure
- graph resolution failure
- preflight failure
- execution failure
- install failure
- verify failure
- persist failure

Benefits:

- more actionable diagnostics
- cleaner telemetry later
- easier repair planning

## Performance Model

The lifecycle should explicitly support:

- fast paths for trivial commands
- cache-only inspection paths
- deferred module loading
- phase-aware warmups
- minimal bootstrap cost

This is product behavior, not only implementation detail.

## Recommended Internal Contracts

```ts
type RuntimePhase =
  | 'bootstrap'
  | 'context'
  | 'policy-load'
  | 'snapshot-load'
  | 'registry-assembly'
  | 'graph-resolution'
  | 'planning'
  | 'preflight'
  | 'execution'
  | 'install'
  | 'verify'
  | 'persist'
  | 'deferred-work';
```

```ts
type RuntimeMode = 'interactive' | 'recommended' | 'ci' | 'json';
```

```ts
type RuntimeCommandClass = 'inspection' | 'mutation' | 'repair';
```

## Design Direction

The key runtime idea is:

- one lifecycle
- multiple command classes
- typed module contributions
- explicit policy and snapshot separation

This gives Axi a stable runtime foundation for:

- richer module systems
- optional interaction runtimes
- external capability providers
- future marketplace or remote registry features
