---
name: git-commit-batch
description: Analyze the current git working tree versus HEAD, group related edits into feature-based commits, split oversized features above 1000 changed lines, commit groups in file-modification order, and add a docs/logs/submit record. Use when Codex needs to turn a dirty repo into intentional local commits instead of one bulk commit.
---

# Git Commit Batch

## Overview

Turn an existing working tree into a clean batch of local commits without losing chronology.

Use the bundled script to collect change metadata, then make the final feature grouping decision from the actual diff. The script is a planning aid; commit boundaries still need engineering judgment.

On macOS and Linux, prefer `python3`. On Windows, prefer `py -3`. The bundled script should stay compatible with older system Python builds by avoiding newer stdlib-only conveniences in its own implementation. If the system `python3` is still too old or otherwise broken for this script, fall back to the repo's managed runtime before giving up. In all examples below, the script path is:

```bash
${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py
```

## Slash Command Fast Path

When the user triggers this skill with a slash command, do not start with a long explanation.

Default behavior:

1. Run the planner first:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py" plan --repo .
```

For a direct one-shot run, prefer:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py" execute --repo .
```

2. Read the suggested groups and immediately start executing if the split is straightforward.
3. Assume the current working directory is the target repo unless the user names a different path.
4. Treat `HEAD` as the comparison base unless the user explicitly asks for a different base.
5. Return a short status update in this order:
   - whether the tree is clean or dirty
   - the proposed commit groups in chronological order
   - whether any file or feature still needs manual judgment

If the planner reports no changes, stop there and say the working tree is already clean.

## Workflow

1. Run the planner first for slash-command use, or use `execute` when you want a direct batch run:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py" plan --repo <repo-path>
```

or:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py" execute --repo <repo-path>
```

or:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py" analyze --repo <repo-path>
```

2. Build commit groups from the analyzer output and the real diff.

- Compare only against `HEAD`.
- Include modified, deleted, and untracked files.
- Keep tests with the feature they verify.
- If a file spans multiple features, split it by hunk instead of forcing the whole file into one commit.
- If a single feature exceeds 1000 changed lines, split it into multiple commits by subfeature or chronology, even if it is one larger initiative.

3. Commit groups in chronological order.

- Order groups by the earliest file modification time inside each group.
- Use clear imperative commit subjects.
- If one feature needs multiple commits, keep the same subject root and differentiate the scope.

4. After the feature commits, verify the worktree and write the submit log:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/git-commit-batch/scripts/git_commit_batch.py" write-log --repo <repo-path> --commit <sha1> --commit <sha2>
```

Commit the generated log as the final commit so the worktree returns to clean.

The `execute` command already performs this end-to-end flow.

## Commit Grouping Rules

- Group by user-visible feature or operational concern, not by file extension.
- Fold docs/tests/config changes into the feature they belong to when they are tightly coupled.
- Break out pure cleanup or workspace artifact deletion into a separate commit.
- Stop and ask the user only when a file mixes unrelated user edits that cannot be safely separated.

## Non-Interactive Hunk Splitting

Avoid `git add -p`. Use non-interactive staging:

1. Inspect the precise diff:

```bash
git diff -U0 -- <path>
```

2. Save the needed hunk(s) into a temporary patch file.

3. Stage only that patch:

```bash
git apply --cached --unidiff-zero <patch-file>
```

4. Stage the matching working-tree hunk with `git apply --unidiff-zero <patch-file>` only if you need to keep the index and worktree aligned after a revert/replay flow.

## Validation

- Run the feature-specific tests that cover the grouped changes when practical.
- Check `git status --short` after each commit boundary if the split is complex.
- Before the final response, confirm the generated submit log path and list the created commit SHAs.
- If `execute` stops because a single file exceeds 1000 changed lines, split that file manually before retrying.

## Default Assumptions

- Use the current repo root.
- Use chronological order based on the earliest file modification time in each group.
- Split any feature above 1000 changed lines.
- Keep tests with the feature they verify.
- Create the submit log as the final commit unless the user explicitly asks for planning only.
