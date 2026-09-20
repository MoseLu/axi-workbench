# ADR-004: Use APM As The Agent Context Package Layer

## Status

Accepted on 2026-06-11.

## Context

The workspace is optimized for zero-context agent takeover. Existing Axi
governance already provides project identity, boundaries, handoff manifests,
relationship graph lookups, CodeGraph-backed code exploration, and repository
verification commands.

The remaining gap is reproducible cross-harness agent context installation.
`axi-skills` is already the canonical source for shared skills, but different
agent clients still need a stable way to install the same bootstrap skill set
and eventually audit/pin that context.

Microsoft APM provides an `apm.yml` manifest, lockfile, package resolution,
security scan, policy, and multi-harness deployment model for agent skills,
instructions, prompts, agents, plugins, and MCP declarations.

## Decision

Adopt APM as an adapter layer for agent context packaging and reproducible
installation.

APM is not the workspace project registry, not the handoff manifest format, and
not the source of project identity. The workspace remains a polyrepo governed by
`workspace.json`, `workspace.graph.json`, `WORKSPACE_INDEX.md`,
`docs/HANDOFF.md`, and `workspace-project`.

The first APM source package is `shared/axi-skills/apm.yml`. It exposes the
shared skill tree plus a zero-context bootstrap entry and keeps `skills/` as
the canonical runtime source tree.

## Operating Rules

- Do not run APM from `/Volumes/code/workspace`; the root is not a package root
  or git repository.
- Use APM from project repositories or scratch roots only.
- Keep APM generated directories out of source repositories unless a consuming
  project intentionally commits its own `apm.lock.yaml`.
- APM manifests may reference Axi-owned skills and approved external packages
  only after governance review.
- MCP server declarations belong to consuming projects or workspace governance,
  not to the shared `axi-skills` provider package.
- APM policy starts in documentation/governance mode. Blocking CI gates require
  a later explicit rollout.

## Consequences

Positive:

- Fresh agents can reproduce the same zero-context skill surface across Codex,
  Claude, Cursor, OpenCode, Gemini, Copilot, and `.agents/skills` compatible
  runtimes.
- APM lockfiles and audits can become evidence for agent context freshness and
  supply-chain integrity.
- `axi-skills` gains a standards-aligned consumption surface without migrating
  the whole catalog.

Tradeoffs:

- There is now one more manifest to keep current when bootstrap skills are
  renamed or replaced.
- Full-catalog packaging is deliberately deferred because trigger collisions,
  package size, and audit noise need a separate review.
- APM policy is still treated as a rollout surface, not an immediate hard gate.

## Verification

- `shared/axi-skills/apm.yml` exists and publishes the shared skill tree plus
  the zero-context bootstrap contract.
- `shared/axi-skills/docs/APM.md` documents consumer usage, scratch-root
  preview, and generated-output guardrails.
- `python3 scripts/verify.py` passes in `shared/axi-skills`.
- `workspace-project validate` passes after registry/graph updates.
