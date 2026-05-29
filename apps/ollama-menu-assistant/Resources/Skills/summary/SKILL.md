---
name: summary
description: Write a compact handoff summary for continuing the current Codex thread in a new conversation. Use when the user types /summary, asks to manually compact context, asks for a continuation or handoff summary, or wants to avoid Codex App automatic remote compact failures near the context limit.
---

# Summary

## Overview

Produce a user-visible continuation summary that can be pasted into a fresh Codex thread. Treat the summary as manual context compaction; do not call `/compact`, invoke remote compact APIs, or rely on automatic compression.

## Slash Command Fast Path

When triggered by `/summary`, skip tool-heavy exploration unless a fact is both important and cheap to verify. Start with the current conversation state, any known workspace path, and the most recent task.

Return only the handoff content plus a short note when verification was skipped. Do not add broad advice, status-page commentary, or unrelated troubleshooting.

## Handoff Format

Use this structure unless the user asks for a different format:

- Current goal: the user's active objective and why it matters.
- Workspace: cwd, repo paths, branch/status if known, and important environment facts.
- Constraints and preferences: instructions the next thread must preserve.
- Completed work: concrete edits, commands run, decisions made, and validated results.
- Current state: what is in progress, what remains uncertain, and any blockers.
- Relevant files: absolute paths and line anchors when useful.
- Next steps: the most likely continuation plan in execution order.
- Resume prompt: a concise prompt the user can paste into a new thread.

## Content Rules

- Preserve exact file paths, commands, error text, dates, model/config values, and user-stated preferences when they matter.
- Prefer compact bullets over narrative. Keep enough detail for a fresh Codex instance to continue without re-reading the whole thread.
- Mark unverified or memory-derived facts explicitly.
- Include local changes that may not be committed, plus tests or checks that still need to run.
- If there is an active long-running command or server, include its session, port, and expected next observation when known.
- If no substantive work has happened, say that briefly and provide the small amount of context that exists.

## Verification

Use tools only when the summary would otherwise contain risky guesses. For repo work, cheap checks can include `pwd`, `git status --short`, `git branch --show-current`, and targeted `rg` or `git diff --stat`. Keep verification minimal because the purpose of this skill is to save context.
