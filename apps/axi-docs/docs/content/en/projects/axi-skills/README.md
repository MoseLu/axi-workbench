---
id: axi-docs-en-projects-axi-skills
title: Axi Skills
type: project
status: published
tags: [Axi Docs, Projects, foundation, shared-skill-catalog]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Skills
graph-tags: [Projects, foundation, shared-skill-catalog]
description: Shared, version-controlled skill catalog for Axi agents (Codex, Claude, Cursor, MiniMax, OpenCode, Gemini, Copilot, .agents/skills). Provides the codex-skill-catalog, apm-agent-context-package, and skill-i18n-batch-contract surfaces, plus zero-context bootstrap and Chinese intent routing.
project:
  id: axi-skills
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-skills
  source-section: shared
---

# Axi Skills

> Mirror of the project root `README.md` and `INDEX.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-skills/README.md`](/Volumes/code/workspace/foundation/axi-skills/README.md),
> [`/Volumes/code/workspace/foundation/axi-skills/INDEX.md`](/Volumes/code/workspace/foundation/axi-skills/INDEX.md).
> Section: shared-skill-catalog / Partition: `foundation/`.

## Summary

`axi-skills` is the shared, version-controlled skill tree for Axi-compatible
agents. It exposes one runtime source of truth (`skills/`) that Codex,
Claude, Cursor, MiniMax, OpenCode, Gemini, Copilot, and `.agents/skills`
compatible runtimes all read instead of maintaining drifting copies. The
catalog currently holds **880 `SKILL.md` files** and is treated as **cold
storage**: agents load one workflow OS (L1) plus stage-gated feature
plugins (L2); `docs/SKILL_INDEX.md` is for `grep` lookup only and must
never be hot-loaded. The repo also ships the APM zero-context bootstrap
contract (`apm.yml` + `.apm/instructions/*`), a verifier-backed i18n
batch contract for the localized `skills.zh/` mirror, and an installer for
the global skill-root cutover.

**Stage**: shared foundation, stage `shared` per `MILESTONE.md`.
**Canonical path**: `/Volumes/code/workspace/foundation/axi-skills`.
**APM version**: `0.1.0` (`type: hybrid`, `targets: 7`).
**Working tree**: 3 commits ahead of `origin/dev` on `dev` (ZCode agent-pool
orchestration and macOS pressure admission in flight).

Branch policy: `main` carries releasable builds; `dev` carries daily
integration. Initial import came from `/Users/mose/.agent-skills/skills` and
is kept in sync via `scripts/sync-from-global.sh` (dry-run by default;
`--apply` to mutate).

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Skill format | Markdown with YAML frontmatter (`name`, `description`, optional `metadata.aliases`, `metadata.catalog`) | Entry point must be named `SKILL.md` |
| Bootstrap | `axi-zero-context` + `axi-skill-router` + 2 `.apm/instructions/*` files | APM installs the bundle via `apm.yml` `includes` |
| Verifier (runtime tree) | `python3 scripts/verify.py` (298 lines) | Frontmatter parse, secret-pattern / GitHub-100MB guards, forbidden-dir checks, `INDEX.md` regen |
| Verifier (i18n scaffold) | `python3 scripts/verify_i18n.py` (396 lines) | Manifest, fence / URL / inline-backtick / UPPER_SNAKE_CASE / protected-token invariants |
| Batch generator | `python3 scripts/build_batches.py` (115 lines) | Disjoint batches; large files (>=20 KB) get their own batch; ~20 paths per normal batch |
| Installer | `bash scripts/install-global-links.sh`, `bash scripts/sync-from-global.sh` | Dry-run by default; `--apply` mutates agent runtimes |
| Translation workers | `scripts/agents/translate-batch.sh`, `scripts/parallel_translate.py`, `scripts/batch_translate.sh`, `scripts/rebuild_zh.py` | Delegated to a dedicated worker, not the main agent |
| Tests | `python3 scripts/test_skill_loading_policy.py`, `python3 scripts/test_skill_router.py`, `python3 scripts/test_workspace_commit_batch.py`, `python3 scripts/test_minimax_direct_route.py` | Smoke tests for the loading policy and router |
| Migration | `docs/MIGRATION.md` + `scripts/install-global-links.sh` | Manages `~/.agent-skills/skills`, `~/.agents/skills`, `~/.codex/skills` (overlay), `~/.claude/skills`, `~/.cursor/skills`, `~/.minimax/skills` |
| Chinese commands | `commands/claude/` (linked to `~/.claude/commands/`) | `/提交`, `/审计`, `/更新`, `/技能` dispatch into `axi-skill-router` |

## Project Layout

```text
axi-skills/
├── apm.yml                       # APM package manifest, 7 targets, hybrid type
├── AGENTS.md / AGENTS.zh-CN.md   # agent rules, i18n layout, verifier, relationship metadata
├── README.md / README.zh-CN.md   # layout, verification, sync, link setup
├── INDEX.md                      # authoritative document map (read order + contracts)
├── CHANGE.md                     # pointer to docs/state/CHANGELOG.md
├── CHANGELOG.md                  # canonical change log (Keep a Changelog)
├── MILESTONE.md                  # verified shared skill catalog acceptance criteria
├── TODO.md                       # active maintenance queue (SKILL_INDEX, i18n batches, cutover, APM)
├── skills/                       # English runtime source of truth (880 SKILL.md files)
│   ├── axi-zero-context/         # zero-context bootstrap
│   ├── axi-skill-router/         # Chinese intent dispatcher (/提交 /审计 /更新 /技能)
│   ├── axi-*-group-*             # 30+ Axi skill-group browsable skills
│   ├── .system/                  # system-area skills (imagegen, openai-docs, plugin-creator, ...)
│   └── (third-party + ecosystem skills)
├── skills.zh/                    # Chinese localized mirror (git-ignored; not runtime)
├── docs/
│   ├── APM.md                    # APM integration contract (source contract, consumer usage)
│   ├── MIGRATION.md              # global skill-root cutover, sync, rollback
│   ├── SKILL_INDEX.md            # generated catalog table (880 entries)
│   ├── i18n/
│   │   ├── README.md             # i18n guardrail contract, batching rules
│   │   └── batches/              # batch-001.txt .. batch-164.txt (one path per line)
│   ├── project-docs.manifest.json
│   └── HANDOFF.md
├── scripts/
│   ├── verify.py                 # English skill-tree validator + index regen
│   ├── verify_i18n.py            # i18n scaffold verifier
│   ├── build_batches.py          # regenerate docs/i18n/batches/batch-*.txt
│   ├── build_skill_groups.py     # rebuild axi-group-* browseable skills
│   ├── list_skill_group.py       # list skills in a given group
│   ├── regen_skill_index.py      # alternative index regenerator
│   ├── install-global-links.sh   # global runtime linker (dry-run by default)
│   ├── sync-from-global.sh       # legacy -> shared sync (dry-run by default)
│   ├── install_exe.sh            # reapply executable bits on runnable scripts
│   ├── agents/translate-batch.sh # delegated translation worker
│   ├── batch_translate.sh        # large-batch translation driver
│   ├── parallel_translate.py     # parallel translation runner
│   ├── preserve_fence_translate.py / realign_fences.py / fix_fences.py  # fence repair
│   ├── generate_zh_skill_families_fulltext.mjs / generate_zh_skill_titles_fulltext.mjs
│   ├── translate_i18n.py         # i18n driver
│   ├── rebuild_api_design.py / rebuild_zh.py / regen_skill_index.py
│   ├── repo_cleanup_chain.sh     # cleanup helper
│   ├── run_pending_batches.sh    # resume unfinished batches
│   ├── test_skill_loading_policy.py / test_skill_router.py
│   ├── test_workspace_commit_batch.py / test_minimax_direct_route.py
│   └── (verifier + tests)
├── commands/claude/              # Claude-only /提交 /审计 /更新 /技能 aliases
├── .apm/
│   └── instructions/
│       ├── axi-skill-loading-policy.instructions.md   # L0 bootstrap → L1 OS → L2 plugins
│       └── axi-workspace-routing.instructions.md      # always-on routing discipline
├── .githooks/                    # Git hooks (commit-time verification)
├── .github/                      # GitHub workflow files
├── .omx/                         # OMX harness artifacts
└── skills/.sync-manifest.json    # version-1 per-skill lastSyncedAt manifest
```

## Build & Install

```bash
# Setup (Python 3 required for verification)
python3 --version

# Synchronize the shared tree from the legacy global skill directory
scripts/sync-from-global.sh            # dry-run
scripts/sync-from-global.sh --apply    # mutate

# Cut over agent runtimes to read this repo
scripts/install-global-links.sh        # dry-run
scripts/install-global-links.sh --apply # backup legacy + link shared tree

# Optional: install the Chinese Claude commands
ln -sf "$(pwd)/commands/claude"/* ~/.claude/commands/
```

Consumers can also pull the bundle through APM:

```bash
apm install /Volumes/code/workspace/foundation/axi-skills --dry-run --target agent-skills
apm install /Volumes/code/workspace/foundation/axi-skills --target codex
```

## Verification

```bash
# Runtime skill-tree validator
python3 scripts/verify.py
python3 scripts/verify.py --write-index   # regenerate docs/SKILL_INDEX.md

# i18n manifest + translation invariants
python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff
python3 scripts/verify_i18n.py --paths-from docs/i18n/batches/batch-001.txt --forbid-english-diff
python3 scripts/verify_i18n.py --all --forbid-english-diff

# Batch manifest regen (after adding / removing / renaming skills)
python3 scripts/build_batches.py

# Smoke
python3 scripts/test_skill_loading_policy.py
python3 scripts/test_skill_router.py
```

The runtime verifier rejects `FORBIDDEN_DIRS` (`.git`, `__pycache__`, `.cache`,
`.venv`, `venv`, `node_modules`, `dist`, `build`, `coverage`, `test-results`,
`sessions`), `SECRET_FILE_PATTERNS` (`*.env`, `*.pem`, `*.p12`, `*.pfx`,
`id_rsa*`, `id_ed25519*`, `credentials.json`, `secrets.json`, `tokens.json`),
and `SECRET_CONTENT_PATTERNS` (`-----BEGIN ... PRIVATE KEY-----`, GitHub
tokens, OpenAI-style keys, AWS access keys except the documented
`AKIAIOSFODNN7EXAMPLE` placeholder). It also rejects files ≥100 MB.

The i18n verifier enforces (against the English file):

- mirror exists at the same relative path;
- `git diff --name-only -- skills` is empty (`--forbid-english-diff`);
- YAML key set is identical; `name` is byte-identical; `description`
  differs (when English has a description);
- body length ≥ ~40 chars when English body is non-empty;
- fenced code-block count, URL multiset, inline backtick multiset, and
  UPPER_SNAKE_CASE token multiset all match;
- `API_KEY`, `OPENAI_BASE_URL`, `MINIMAX_TOKEN_PLAN_API_KEY` are protected
  and must not be removed or altered.

## Architecture Highlights

The catalog is **cold storage**: the loading policy
(`.apm/instructions/axi-skill-loading-policy.instructions.md`) defines a
strict three-tier dispatch. **L0 bootstrap** at session start routes the
agent through `axi-project-admission` for any project-creation intent, then
`axi-zero-context` for takeover, then picks **one** L1 workflow OS
(`workspace-audit-remediation` for audit; `axi-zero-context` for zero
context; OMX `autopilot`/`ralph` for vague / large; gstack `gstack-spec`
for web-product spec; GSD `gsd-progress` for multi-phase roadmap; `do` for
single feature; `gstack-investigate` for bug / regression; `deep-research`
or `best-practice-research` for research; vertical chain for bio / clinical
DB lookups). **L2 feature plugins** are stage-gated (`ENTER → CLARIFY →
DESIGN → BUILD → VERIFY → SHIP`) — stack skills load only at BUILD, design
at DESIGN, verification at VERIFY, ship at SHIP. Agents may load **at most
one** skill per family at the same stage (e.g. `react-best-practices` xor
`vercel-react-best-practices`). For Axi tasks, the always-on routing
discipline is `.apm/instructions/axi-workspace-routing.instructions.md`:
resolve project identity through `WORKSPACE_INDEX.md`,
`workspace.graph.json`, or `scripts/workspace-project`; read the
project-local `AGENTS.md` / `CLAUDE.md` / `README.md`; do not use APM as a
replacement for handoff / workspace-graph contracts.

**Zero-context bootstrap** lives in `skills/axi-zero-context/SKILL.md`:
"route first" (treat `/Volumes/code/workspace` as the workspace container,
resolve identity through `WORKSPACE_INDEX.md` / `workspace.graph.json` /
`scripts/workspace-project`); "read the handoff" (project-local AGENTS.md,
`docs/HANDOFF.md`, `docs/project-docs.manifest.json`, then
`git status --short --branch`); "map the surface" (product UI, backend,
shared package, local tool, documentation, reference); "use existing
skills" (`axi-workspace-routing`, `codebase-onboarding`, `agentic-engineering`,
`code-review`, `git-commit-batch`, `git-workflow`, `git-clean`). APM exposes
this bootstrap through `apm.yml` `includes`, so fresh agent environments
install the same bundle across all 7 supported targets.

**Chinese intent routing** lives in `skills/axi-skill-router/SKILL.md`
(frontmatter declares `aliases: /提交 /审计 /更新 /技能`,
`catalog: docs/SKILL_INDEX.md`, and `chinese_titles:
docs/i18n/zh-skill-title-candidates.jsonl`). The router treats the shortcut
as a category, not as authorization. It runs `python3 scripts/route_skill.py
--alias "<alias>" --query "<user request>"` (with `--json` for
machine-readable output) against `docs/SKILL_INDEX.md` plus the generated
Chinese title / family metadata, returns ranked candidates, shows at most
three, and asks **one** clarification question before loading a
side-effecting skill. After the answer it loads the smallest skill set
that covers the request and follows them without weakening their safety /
verification rules.

**APM zero-context package** (`apm.yml`) packages the canonical `skills/`
tree plus the two `.apm/instructions/*.md` files for Codex, Claude,
Cursor, OpenCode, Gemini, and `.agents/skills`. It generates
`apm.lock.yaml` in consuming projects for reproducibility, can run APM
policy / audit checks before agent context reaches a harness, but does
**not** replace project identity, handoff readiness, or workspace graph
contracts. Consumers run `apm install <path> --dry-run --target agent-skills`
for local preview without harness-file mutations, or `--target codex` to
materialize the bundle in a real Codex config.

**Skill-i18n batch contract** keeps a Chinese localized mirror at
`skills.zh/` (git-ignored) without ever letting it become runtime source.
Every English `SKILL.md` is assigned to exactly one batch file under
`docs/i18n/batches/`; `scripts/build_batches.py` puts files `>20 KB` into
their own batch and groups the rest into ~20-path batches (15–25 range,
final tail may be smaller). Today there are **164 batch files** (batch-001
through batch-164). Translation work is delegated to dedicated workers
(`scripts/agents/translate-batch.sh`, `parallel_translate.py`,
`batch_translate.sh`) and validated by `scripts/verify_i18n.py`, which
guards frontmatter parity, body length, fenced-block / URL / inline-
backtick / UPPER_SNAKE_CASE multisets, and protected tokens (`API_KEY`,
`OPENAI_BASE_URL`, `MINIMAX_TOKEN_PLAN_API_KEY`).

**Global skill-root cutover** is owned by
`scripts/install-global-links.sh` and `docs/MIGRATION.md`. The installer
manages `~/.agent-skills/skills`, `~/.agents/skills`, `~/.codex/skills`
(individual shared-skill overlay; `.system` preserved),
`~/.claude/skills`, `~/.cursor/skills`, `~/.minimax/skills`. It first
moves a real legacy global skill directory to a timestamped backup, then
links the shared agent entrypoints to this repository. Codex's user skill
entrypoint is `~/.agents/skills`; the installer also overlays shared
sclills into `~/.codex/skills` without replacing that directory or its
`.system` contents. `scripts/sync-from-global.sh` provides the inverse
direction (legacy → shared) with an explicit exclusion list and only
removes repository files that no longer exist in the global tree when
`--apply` is supplied.

## Key Modules/Files

| Path | Role |
| --- | --- |
| `apm.yml` | APM package manifest (`version: 0.1.0`, `type: hybrid`, 7 targets, `includes: [axi-zero-context, axi-skill-router, axi-skill-loading-policy, axi-workspace-routing]`) |
| `skills/axi-zero-context/SKILL.md` | Zero-context workspace takeover: route → read handoff → map surface → use existing skills |
| `skills/axi-skill-router/SKILL.md` | Chinese intent dispatcher (`/提交 /审计 /更新 /技能`); routes via `scripts/route_skill.py` against `docs/SKILL_INDEX.md` |
| `skills/axi-*-group-*/SKILL.md` | ~30 Axi skill-group browsable skills (`axi-group-agent-orchestration`, `axi-group-backend-api`, `axi-group-bio-health-research`, `axi-group-frontend-ui`, etc.) |
| `skills/.sync-manifest.json` | `version: 1`, per-skill `lastSyncedAt` epoch (used by `sync-from-global.sh`) |
| `.apm/instructions/axi-skill-loading-policy.instructions.md` | L0 bootstrap → L1 OS → L2 stage-gated plugins; stack probe rules; cold-storage rules for `SKILL_INDEX.md` |
| `.apm/instructions/axi-workspace-routing.instructions.md` | Always-on routing: resolve through workspace registry, do not use APM as a replacement |
| `scripts/verify.py` | Frontmatter parse, secret-pattern / GitHub-100MB / forbidden-dir guards, index regen |
| `scripts/verify_i18n.py` | Manifest, fence / URL / inline-backtick / UPPER_SNAKE_CASE / protected-token invariants |
| `scripts/build_batches.py` | Disjoint batch generation; large files get their own batch |
| `scripts/build_skill_groups.py` | Rebuild `axi-group-*` browseable skills |
| `scripts/list_skill_group.py` | List skills in a given group |
| `scripts/regen_skill_index.py` | Alternative index regenerator |
| `scripts/install-global-links.sh` | Global runtime linker (dry-run by default; `--apply` mutates) |
| `scripts/sync-from-global.sh` | Legacy → shared sync (dry-run by default; `--apply` mutates) |
| `scripts/agents/translate-batch.sh` | Delegated translation worker |
| `scripts/batch_translate.sh` / `parallel_translate.py` | Large-batch translation drivers |
| `scripts/preserve_fence_translate.py` / `realign_fences.py` / `fix_fences.py` | Fence repair during translation |
| `scripts/test_skill_loading_policy.py` / `test_skill_router.py` / `test_workspace_commit_batch.py` / `test_minimax_direct_route.py` | Smoke tests |
| `docs/APM.md` | APM source contract, consumer usage, scratch-root preview |
| `docs/MIGRATION.md` | Global skill-root cutover, sync, rollback contract |
| `docs/SKILL_INDEX.md` | Generated 880-row catalog (886 lines) |
| `docs/i18n/README.md` | i18n guardrail contract, batching rules, verifier usage |
| `docs/i18n/batches/batch-001.txt` … `batch-164.txt` | One English `SKILL.md` path per line; disjoint |
| `docs/state/PRD.md` | Purpose, users, requirements, success criteria |
| `docs/state/TDD.md` | Verification surface (runtime catalog, i18n manifest, global link dry-run) |
| `docs/state/MILESTONE.md` | Verified shared skill catalog acceptance criteria |
| `docs/state/TODO.md` | Active maintenance queue (SKILL_INDEX sync, i18n batch sync, cutover, APM alignment) |
| `docs/project-docs.manifest.json` | v2 handoff manifest source |
| `docs/HANDOFF.md` | Zero-context handoff; readiness `stale` per `workspace-project onboard` |
| `commands/claude/` | `/提交`, `/审计`, `/更新`, `/技能` aliases linked to `~/.claude/commands/` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Verified shared skill catalog | Keep `axi-skills` registered as canonical, verified shared skill source | Active acceptance: `docs/project-docs.manifest.json` v2; `docs/HANDOFF.md` regenerated; `verify.py` exits 0; `verify_i18n.py --check-manifest-only --forbid-english-diff` exits 0; workspace graph + handoff registry include `axi-skills` |
| Zero-context bootstrap | `axi-zero-context` + `axi-workspace-routing` + `axi-skill-loading-policy` available through APM | Live (`apm.yml` includes; `scripts/install-global-links.sh` link path) |
| Chinese intent routing | `/提交 /审计 /更新 /技能` aliases + `axi-skill-router` for ambiguous intent | Live (`commands/claude/` + `skills/axi-skill-router` + `scripts/route_skill.py`) |
| Skill-i18n batch contract | `skills.zh/` mirror validated by 164 batches; English `SKILL.md` never mutated | Live (`verify_i18n.py` invariants); translation tail continues (latest commits `f0fdc39`, `0d89f14`, `bfdd138`, `54dbb61`, `60abd25`, `4715a07`, `47a2f64`) |
| Global skill-root cutover | `~/.agents/skills` + `~/.codex/skills` (overlay) + `~/.claude/skills` + `~/.cursor/skills` + `~/.minimax/skills` point at this repo | Documented (`docs/MIGRATION.md`); dry-run via `scripts/install-global-links.sh` |
| Skill-index regen | `docs/SKILL_INDEX.md` rebuilt from 880 SKILL.md entries | Live (`python3 scripts/verify.py --write-index`) |
| ZCode native agent-pool admission | macOS pressure admission + pool ledger + concurrency honest bookkeeping | In flight (commit `6a3684e` recorded scoped verification + runtime limits; `44908e5` ZCode pool invocation; `c9eaa33` native worker ledger) |
| Audit-remediation tail | `axi-skills` registry + auto-submit log snapshot | In flight (commits `d476360`, `f723cb1`, `a2243e1`, `1b364ff`, `9da82ea`, `d946aa3`, `6e57f13`, `aa04368`, `4738c76`) |

See `docs/state/MILESTONE.md` for the authoritative acceptance list and
`TODO.md` for the active maintenance queue.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-skills/AGENTS.md) — agent rules, cold-storage policy, i18n layout, verifier commands, relationship metadata
- [`README.md`](/Volumes/code/workspace/foundation/axi-skills/README.md) — repository layout, verification, sync, link setup, Chinese intent entry
- [`INDEX.md`](/Volumes/code/workspace/foundation/axi-skills/INDEX.md) — read order, contracts, find-my-skill workflow
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-skills/CHANGE.md) — pointer to `docs/state/CHANGELOG.md`
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-skills/CHANGELOG.md) — Keep a Changelog entries
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-skills/MILESTONE.md) — verified shared skill catalog acceptance
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-skills/TODO.md) — active maintenance queue
- [`apm.yml`](/Volumes/code/workspace/foundation/axi-skills/apm.yml) — APM package manifest
- [`docs/APM.md`](/Volumes/code/workspace/foundation/axi-skills/docs/APM.md) — APM source contract, consumer usage
- [`docs/MIGRATION.md`](/Volumes/code/workspace/foundation/axi-skills/docs/MIGRATION.md) — global skill-root cutover contract
- [`docs/SKILL_INDEX.md`](/Volumes/code/workspace/foundation/axi-skills/docs/SKILL_INDEX.md) — generated 880-row catalog
- [`docs/i18n/README.md`](/Volumes/code/workspace/foundation/axi-skills/docs/i18n/README.md) — i18n guardrail contract
- [`docs/i18n/batches/batch-001.txt` … `batch-164.txt`](/Volumes/code/workspace/foundation/axi-skills/docs/i18n/batches/) — translation batch manifests
- [`docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/PRD.md) — purpose, users, requirements, success criteria
- [`docs/state/TDD.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/TDD.md) — verification surface
- [`docs/state/MILESTONE.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/MILESTONE.md) — verified shared skill catalog acceptance
- [`docs/state/TODO.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/TODO.md) — active maintenance queue
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-skills/docs/HANDOFF.md) — zero-context handoff
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/foundation/axi-skills/docs/project-docs.manifest.json) — v2 handoff manifest source
- [`.apm/instructions/axi-skill-loading-policy.instructions.md`](/Volumes/code/workspace/foundation/axi-skills/.apm/instructions/axi-skill-loading-policy.instructions.md) — L0/L1/L2 dispatch contract
- [`.apm/instructions/axi-workspace-routing.instructions.md`](/Volumes/code/workspace/foundation/axi-skills/.apm/instructions/axi-workspace-routing.instructions.md) — always-on workspace routing discipline
- [`skills/axi-zero-context/SKILL.md`](/Volumes/code/workspace/foundation/axi-skills/skills/axi-zero-context/SKILL.md) — zero-context bootstrap
- [`skills/axi-skill-router/SKILL.md`](/Volumes/code/workspace/foundation/axi-skills/skills/axi-skill-router/SKILL.md) — Chinese intent dispatcher

## Cross-References

- Workspace root: `/Volumes/code/workspace/AGENTS.md`, `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance`
- Workspace registry / project graph: `/Volumes/code/workspace/workspace.graph.json`, `scripts/workspace-project list`
- Relationship metadata as a Provider — capabilities `skill-tree` (build), `apm-package` (build), `i18n-scaffold` (build), `skill-catalog` (runtime), `axiom-zero-context` (runtime), `skill-index` (runtime); requiredness `required`
- ADR references: `/Volumes/code/workspace/foundation/axi-rules/rules/project-bootstrap/AGENTS.md` (AR-BOOTSTRAP-ADMISSION-001 … AR-BOOTSTRAP-AFTER-001)
- Skill-index search: `bash ~/.claude/skills/scripts/find-my-skill.sh <keyword>` (`fms` alias); registry at `~/.claude/skills/SKILL_REGISTRY.md`
- Recent trajectory: `6a3684e` scoped ZCode pool verification + runtime limits; `44908e5` ZCode pool invocation + honest concurrency; `c9eaa33` pressure-aware native worker ledger; `ddcd948` private governance remote; `47a2f64` replace forbidden milestone term to satisfy audit; `f0fdc39` SKILL_INDEX refresh + maintain-axi-ui-docs + `axi-workspace-git-audit`; `bfdd138` + `54dbb61` i18n batches 001–163; `60abd25` restore missing zh-CN mirror tokens; `b0aa706` sync registry + scripts + skills docs

## Notes

`axi-skills` is the shared, version-controlled skill tree for Axi agents at `/Volumes/code/workspace/foundation/axi-skills`. The 880 `SKILL.md` files in `skills/` are **cold storage**: `docs/SKILL_INDEX.md` is for `grep` lookup only and must never be hot-loaded. Three surfaces: `codex-skill-catalog` (`apm.yml` with `type: hybrid`, `version: 0.1.0`, 7 targets) + `apm-agent-context-package` (`.apm/instructions/axi-skill-loading-policy.instructions.md` + `axi-workspace-routing.instructions.md` for L0 bootstrap → L1 OS → L2 stage-gated feature plugins) + `skill-i18n-batch-contract` (the `skills.zh/` mirror is git-ignored and validated by `scripts/verify_i18n.py` against frontmatter parity, fenced-block / URL / inline-backtick / UPPER_SNAKE_CASE multisets, and the protected tokens `API_KEY`, `OPENAI_BASE_URL`, `MINIMAX_TOKEN_PLAN_API_KEY`). `scripts/install-global-links.sh` + `docs/MIGRATION.md` manage `~/.agents/skills` + `~/.codex/skills` (overlay) + `~/.claude/skills` + `~/.cursor/skills` + `~/.minimax/skills` cutover. Zero-context bootstrap lives in `skills/axi-zero-context/SKILL.md` (route → read handoff → map surface → use existing skills); Chinese intent routing lives in `skills/axi-skill-router/SKILL.md` (`aliases: /提交 /审计 /更新 /技能`, runs `scripts/route_skill.py` against `docs/SKILL_INDEX.md` + `docs/i18n/zh-skill-title-candidates.jsonl`). `commands/claude/` links `/提交 /审计 /更新 /技能` into `~/.claude/commands/`. Translation workers (`scripts/agents/translate-batch.sh`, `parallel_translate.py`, `batch_translate.sh`, `scripts/build_batches.py` which regenerates disjoint batches `docs/i18n/batches/batch-001.txt` … `batch-164.txt`) are dedicated workers, not the main agent. `scripts/sync-from-global.sh` provides the inverse direction (dry-run by default; `--apply` mutates).