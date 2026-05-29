---
name: matt-pocock-skills
description: >-
  Use Matt Pocock's "Skills For Real Engineers" workflows for disciplined
  software engineering: grilling requirements, diagnosing bugs, TDD, issue
  triage, PRD or issue generation, architecture improvement, codebase zoom-out,
  terse communication, article editing, or repo setup for these workflows.
  Trigger when the user asks for Matt Pocock skills, wants to be grilled on a
  plan, asks for diagnosis/debugging with a feedback loop, asks for
  red-green-refactor/TDD, wants architecture refactoring opportunities, wants
  issues or PRDs created from a plan, asks to triage issues, asks to zoom out on
  code, or wants these upstream workflows adapted inside Codex.
---

# Matt Pocock Skills

Use this skill as a router for Matt Pocock's upstream "Skills For Real Engineers" workflow set, adapted for Codex. Keep the main context small: load only the upstream reference file for the workflow the user needs.

Source snapshot: `mattpocock/skills` at commit `b843cb5` (`Add structured sections for 'what-to-do' and 'supporting-info' in SKILL.md`). The copied upstream materials live under `references/upstream/`; see `references/source-map.md` for the full map.

## Routing

Read exactly the referenced workflow before acting:

- **Plan stress-test or design interview**: read `references/upstream/skills/productivity/grill-me/SKILL.md`.
- **Plan stress-test plus domain docs or ADR updates**: read `references/upstream/skills/engineering/grill-with-docs/SKILL.md`; read its `CONTEXT-FORMAT.md` or `ADR-FORMAT.md` only when writing those files.
- **Bug, broken behavior, failure, performance regression, or "diagnose/debug this"**: read `references/upstream/skills/engineering/diagnose/SKILL.md`.
- **TDD, red-green-refactor, test-first feature work, or behavior-focused tests**: read `references/upstream/skills/engineering/tdd/SKILL.md`; read the adjacent `tests.md`, `mocking.md`, `interface-design.md`, `deep-modules.md`, or `refactoring.md` only as needed.
- **Architecture cleanup, refactoring opportunities, better testability, or deep modules**: read `references/upstream/skills/engineering/improve-codebase-architecture/SKILL.md`; read `LANGUAGE.md`, `DEEPENING.md`, and `INTERFACE-DESIGN.md` only when needed.
- **Issue triage or preparing work for an agent/human**: read `references/upstream/skills/engineering/triage/SKILL.md`; read `AGENT-BRIEF.md` or `OUT-OF-SCOPE.md` only when posting or writing those artifacts.
- **Turn a plan/conversation into a PRD**: read `references/upstream/skills/engineering/to-prd/SKILL.md`.
- **Break a plan/spec/PRD into issues**: read `references/upstream/skills/engineering/to-issues/SKILL.md`.
- **Explain unfamiliar code from a broader system perspective**: read `references/upstream/skills/engineering/zoom-out/SKILL.md`.
- **Set up repo-local docs/config for these workflows**: read `references/upstream/skills/engineering/setup-matt-pocock-skills/SKILL.md`.
- **Ultra-compressed communication**: read `references/upstream/skills/productivity/caveman/SKILL.md`.
- **Create another skill**: prefer the local `skill-creator` skill; read `references/upstream/skills/productivity/write-a-skill/SKILL.md` only for Matt Pocock's upstream framing.
- **Personal writing or Obsidian workflows**: read `references/upstream/skills/personal/edit-article/SKILL.md` or `references/upstream/skills/personal/obsidian-vault/SKILL.md`.
- **Miscellaneous repo automation**: read the matching file under `references/upstream/skills/misc/`.

## Codex Adaptation Rules

- Follow Codex system and developer instructions first. Treat upstream Claude-specific wording, slash-command names, and tool names as workflow intent, not literal tool requirements.
- Use Codex-native tools and project conventions. For example, use `rg`, shell commands, browser tools, GitHub CLI/connectors, or available MCP tools as appropriate instead of assuming Claude Code commands.
- Preserve the upstream workflow discipline even when translating names. `/diagnose` means build a real feedback loop before fixing. `/tdd` means one behavior test at a time. `/grill-with-docs` means ask one question at a time and update domain docs only as decisions crystallize.
- Avoid broad activation. If the user's request is ordinary coding with no sign of these workflows, continue normally. If the user explicitly asks for this skill or names one of the upstream workflows, use the router.
- Do not load every upstream file by default. Start with the single routed `SKILL.md`, then load adjacent references only when the workflow says they are needed.
- When upstream instructions say to ask before writing or before a design branch, respect that unless the user has explicitly delegated execution and the current Codex instructions say to proceed.

## Repo Setup Notes

The upstream setup workflow writes repo-local `AGENTS.md`/`CLAUDE.md` and `docs/agents/*.md` configuration. In Codex, prefer `AGENTS.md` when a new agent instruction file must be created, but update an existing `CLAUDE.md` or `AGENTS.md` in place if one already exists. Never overwrite unrelated user content.

For issue-tracker actions, verify the actual repo and available tools first. If GitHub is used, prefer authenticated `gh`/GitHub connector paths already available in the environment. If no issue tracker is configured, follow the upstream setup workflow before creating or triaging issues.
