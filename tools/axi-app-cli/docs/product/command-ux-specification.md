# Axi Command UX Specification

## Scope

This document defines the user-facing command behavior for the Axi CLI.

It covers:

- command families
- flag behavior
- interaction modes
- output rules
- error and exit semantics

It does not define internal implementation details.

## Public Command Surface

Current core commands:

- `axi init`
- `axi create <name>`
- `create-axi-app <name>`
- `axi add <module-id...>`
- `axi sync`
- `axi list`
- `axi doctor`

Future commands may be added through typed command contributions, but must follow the same UX model.

## Command Families

### Scaffold Commands

These change project shape:

- `init`
- `create`
- `add`
- `sync`

Expected UX:

- explain intended mutation
- show progress by lifecycle phase
- leave behind updated policy and applied snapshot

### Inspection Commands

These do not change project shape:

- `list`
- `doctor` without `--fix`

Expected UX:

- default to read-only
- support machine-readable output
- be fast enough for repeated operational use

### Repair Commands

These reconcile drift:

- `doctor --fix`
- future bounded repair commands

Expected UX:

- always declare repair intent
- remain scoped to safe, managed reconciliation
- summarize what changed

## Global UX Rules

### Help

- `-h` and `--help` should be available everywhere
- help text should describe behavior, not internal plumbing
- examples should reflect real usage paths

### Version

- `-v` and `--version` should return immediately
- version output must be plain and script-friendly

### Unknown Commands

- unknown commands should fail fast
- error output should include the closest valid surface where helpful
- help text should be suggested, not dumped excessively

## Global Options

### `--yes`

Use recommended defaults without human interruption.

Rules:

- only valid on workflows that would otherwise ask questions
- must produce the same resulting project shape as accepting all recommended interactive choices

### `--interactive`

Force guided prompts where supported.

Rules:

- should only affect mutation flows
- should not be required for read-only commands

### `--no-install`

Skip dependency installation and any phases that depend on it.

Rules:

- verification that requires installed dependencies must also be skipped
- the summary must say that installation was intentionally skipped

### `--no-verify`

Skip verification after generation or synchronization.

Rules:

- should not skip structural validation needed to avoid obviously broken output
- should be reported in the final summary

### `--cwd`

Override target workspace or project root.

Rules:

- must be resolved deterministically
- all path-sensitive summaries should reflect the effective working directory

### `--json`

Emit machine-readable output for inspection commands.

Rules:

- only supported on commands that declare structured output
- stdout must contain only JSON
- human guidance should move to stderr when necessary

### `--fix`

Allow safe repair for `doctor`.

Rules:

- not a generic mutation flag
- only valid on repair-capable inspection commands

## Command-Level UX

### `axi init`

Behavior:

- scaffold the current directory

UX expectations:

- verify target suitability early
- clarify whether the current directory is empty or already managed
- in interactive mode, ask before the first meaningful mutation

### `axi create <name>`

Behavior:

- scaffold a new child directory

UX expectations:

- treat project name as a primary input, not an optional detail
- show the final target path clearly
- use the same lifecycle phases as `init`

### `create-axi-app <name>`

Behavior:

- equivalent product outcome to `axi create <name>`

UX expectations:

- feel like a focused entrypoint, not a separate product
- share docs, defaults, and lifecycle semantics with `axi create`

### `axi add <module-id...>`

Behavior:

- append or enable additional modules

UX expectations:

- explain what is requested
- explain what dependencies were also selected
- distinguish direct selections from transitive inclusions

### `axi sync`

Behavior:

- reconcile the project from `.axi/modules.json`

UX expectations:

- treat module policy as source of truth
- explain that synchronization is policy-driven
- summarize adds, updates, removals, and skipped phases

### `axi list`

Behavior:

- inspect current layered module inventory

UX expectations:

- group by `foundation / extension / experimental`
- distinguish desired state from applied state when drift exists
- support both human-readable and JSON output

### `axi doctor`

Behavior:

- diagnose drift, invalid policy, missing managed files, dependency issues, and other health failures

UX expectations:

- present findings grouped by severity or category
- say whether the project is healthy
- suggest `sync` or `doctor --fix` when relevant

### `axi doctor --fix`

Behavior:

- apply bounded safe repair

UX expectations:

- announce repair mode clearly
- avoid silent broad mutations
- summarize repaired findings and residual risks

## Output Rules

### Human Output

Human-readable output should favor:

- phase-based progress
- plain status summaries
- explicit next steps when failure occurs

Avoid:

- dumping internal stack semantics by default
- noisy logs on successful trivial commands

### Machine Output

Structured output should be:

- deterministic
- minimal but sufficient
- stable enough for CI and wrappers

Recommended shape:

- `command`
- `cwd`
- `ok`
- `findings` or `modules`
- `actionsTaken`
- `nextAction`

## Exit Semantics

Recommended exit code policy:

- `0`: success
- `1`: command failed, doctor found unresolved errors, or validation blocked execution
- higher specialized codes may be introduced later only if they materially improve automation ergonomics

Rules:

- inspection failures must still be usable in CI
- `doctor --json` should preserve machine-readable output even when exit code is non-zero

## Interaction Mode Model

### Interactive Mode

Use when:

- user intent is ambiguous
- the command will mutate a large or visible project surface
- recommended defaults still deserve confirmation

### Recommended Mode

Use when:

- user explicitly requests no interruption
- the product can apply a deterministic default policy

### CI / Automation Mode

The CLI should remain understandable without a TTY.

Rules:

- inspection commands must behave well in pipelines
- mutation commands must fail clearly if user interaction is required but impossible

## Error UX

Each user-facing error should ideally contain:

- failed phase
- affected scope
- whether state may be partially applied
- suggested next command

Examples of good next actions:

- `axi sync`
- `axi doctor`
- `axi doctor --fix`
- rerun with `--no-install`

## Reserved Future UX Patterns

These patterns are recommended for future commands:

- `--dry-run` for mutation previews
- `--json` for any command with operational value in automation
- command contributions that register into grouped help output
- capability-aware help that can explain why a command is unavailable

## Product Rule

Every new command must be explainable in one sentence:

- what it reads
- what it writes
- what state it updates

If that sentence is unclear, the command surface is probably too complicated.
