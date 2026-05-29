# Axi CLI Product Principles

## Purpose

`axi` is not only a command runner. It is the primary product surface for:

- scaffold creation
- module composition
- policy-driven synchronization
- project diagnostics
- future capability packs

The CLI must therefore be designed as a product with a stable mental model, not as a loose collection of scripts.

## Product Definition

Axi is a modular scaffold platform with three simultaneous responsibilities:

1. `Capability Runtime`
   Resolve modules, contributions, policies, and execution phases.
2. `Product Surface`
   Present a coherent command system to humans and machines.
3. `Experience Layer`
   Make long-running or high-choice workflows understandable, recoverable, and consistent.

## Primary User Modes

The CLI must serve these user modes without changing its core mental model:

- `interactive`: guided setup and confirmation-heavy workflows
- `recommended`: no-interruption path via `--yes`
- `maintenance`: list, doctor, sync, repair, inspect
- `automation`: CI, scripts, machine-readable status, deterministic exits
- `ecosystem authoring`: future module, preset, and capability contributors

## Core Principles

### 1. Predictable Over Clever

The CLI should feel consistent before it feels magical.

- same command names should mean the same thing everywhere
- flags should not silently change command meaning across contexts
- interactive and non-interactive flows should be equivalent in outcome

### 2. Progressive Disclosure

Simple tasks must stay simple.

- `--version` and `--help` must be near-zero cognitive and runtime cost
- common actions should require minimal flags
- advanced controls should exist without polluting the first-run surface

### 3. Safe By Default

Mutation commands must be explicit, reversible where possible, and well-signposted.

- read-only commands should never mutate project state
- destructive or wide-impact operations should be announced clearly
- repair flows should be bounded and explain what they touched

### 4. Human UX and Machine UX Are Both First-Class

The CLI must work equally well for:

- a person reading progress in a terminal
- a script parsing structured output
- a CI job deciding pass/fail

This implies:

- stable exit codes
- consistent stdout/stderr discipline
- structured output modes for inspection commands

### 5. The Mental Model Must Stay Stable As Modules Grow

As Axi adds more modules, commands, presets, and optional packs, the user should still feel like they are operating one system.

The stable model is:

- policy says what should be enabled
- snapshot says what is currently applied
- sync reconciles the difference
- doctor explains drift and health
- list explains current capability shape

### 6. Long Operations Need Narrative

When the CLI is doing meaningful work, users should understand:

- what phase it is in
- why it is doing that phase
- what happened if it failed
- what to do next

### 7. Modularity Must Be Visible

Modules are not an internal implementation detail.

Users should be able to answer:

- what is installed
- why it is installed
- what depends on it
- which layer it belongs to
- whether it is policy-enabled, applied, or drifting

### 8. Recovery Is Part Of The Design

Failures are not exceptional in scaffold work.

The CLI should be designed around:

- resumable intent
- explicit drift reporting
- safe reconciliation
- bounded repair
- helpful next-step suggestions

### 9. Capability Contributions Must Not Break The Main Surface

Future commands and module contributions must extend the system without fragmenting it.

This requires:

- typed contribution families
- deterministic assembly order
- policy-aware availability
- explicit precedence rules

### 10. Performance Is Product Behavior

Fast paths are part of UX quality, not implementation polish.

- trivial commands should stay trivial
- heavy capability loading should be deferred
- warmups should be safe, phase-aware, and optional
- read-only commands should prefer cache-only resolution where possible

## Experience Contracts

### Command Contract

Every public command must answer three questions immediately:

- what it does
- what it changes
- what artifact or status it leaves behind

### Output Contract

Every command should follow one of these patterns:

- `inspection`: produce status or inventory
- `mutation`: announce plan, apply changes, summarize result
- `repair`: explain drift, apply bounded reconciliation, summarize repaired state

### Mode Contract

Interactive and non-interactive are two interaction modes over the same lifecycle, not two separate products.

- interactive mode asks before key mutations
- recommended mode chooses defaults and continues
- both should converge to the same applied result given the same module policy

### Error Contract

Errors should be actionable, not merely descriptive.

An error message should ideally tell the user:

- what failed
- at which phase
- whether anything was applied already
- whether retry, sync, or doctor is the next step

## Non-Goals

The CLI should not become:

- a general shell replacement
- a hidden framework-specific control panel
- a dumping ground for unrelated developer utilities
- an interactive UI by default for workflows that should remain scriptable

## Quality Bar For New CLI Features

A new command or product behavior should only land if it satisfies all of the following:

- it fits the existing mental model
- it has clear phase ownership
- it can be explained in one short help sentence
- it has deterministic exit semantics
- it does not degrade trivial command paths unnecessarily
- it improves either clarity, recoverability, or composability

## Product North Star

The ideal Axi experience is:

- first use feels guided
- repeated use feels fast
- automation use feels deterministic
- module growth feels orderly
- failures feel recoverable
- the CLI remains understandable even as the platform becomes more capable
