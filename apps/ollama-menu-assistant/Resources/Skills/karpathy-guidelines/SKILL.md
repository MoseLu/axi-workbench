---
name: karpathy-guidelines
description: Use automatically for every non-trivial coding-related request, including writing, reviewing, debugging, testing, refactoring, planning implementation, editing existing files, or explaining code changes. Behavioral coding guidelines derived from Andrej Karpathy's observations about common LLM coding mistakes; apply to reduce wrong assumptions, avoid overcomplication, make surgical changes, preserve unrelated code, push back when needed, and define verifiable success criteria.
---

# Karpathy Guidelines

Use these guidelines to keep coding work explicit, simple, scoped, and verifiable.
They bias toward caution over speed; for trivial typo fixes and obvious one-line edits, use judgment.

Source adapted for Codex from `forrestchang/andrej-karpathy-skills`.

## Activation

Apply this skill by default for non-trivial coding work. Do not use it for clearly unrelated tasks such as translation, scheduling, email drafting, image generation, or simple factual Q&A.

## 1. Think Before Coding

Do not assume. Do not hide confusion. Surface tradeoffs.

Before implementing:
- State task-critical assumptions explicitly.
- Ask when ambiguity affects behavior, data safety, public APIs, security, or user-visible output.
- Present multiple plausible interpretations when the request can reasonably mean different things.
- Push back when a simpler or safer approach fits the request better.
- Stop and name what is unclear when guessing would create risky or wasteful work.

## 2. Simplicity First

Implement the minimum code that solves the problem. Add nothing speculative.

- Do not add features beyond what was asked.
- Do not create abstractions for single-use code.
- Do not add configurability, extensibility, or framework layers unless the current task requires them.
- Do not add broad error handling for impossible or irrelevant scenarios.
- If the solution becomes much larger than the problem, simplify before proceeding.

Ask: would a senior engineer reasonably call this overcomplicated? If yes, reduce it.

## 3. Surgical Changes

Touch only what the task requires. Clean up only consequences of your own edits.

When editing existing code:
- Do not improve adjacent code, comments, formatting, or naming unless required for the task.
- Do not refactor unrelated working code.
- Match the local style even when another style is personally preferable.
- If unrelated dead code or design debt is discovered, mention it instead of changing it.

When your change creates unused code:
- Remove imports, variables, functions, or tests that became unused because of your edit.
- Do not remove pre-existing dead code unless the user asked for cleanup.

Every changed line should trace directly to the user's request or to validation required by that request.

## 4. Goal-Driven Execution

Turn coding requests into verifiable goals, then loop until checked.

For implementation tasks:
- Define the smallest success criteria that prove the requested behavior.
- Prefer a failing test or reproduction for bugs before fixing.
- Prefer focused tests over broad, slow suites when the change is narrow.
- Run the relevant formatter, typecheck, lint, test, or manual verification before claiming completion.

Transform vague instructions into testable targets:
- "Add validation" -> test invalid inputs, then make them pass.
- "Fix the bug" -> reproduce the bug, then verify it no longer occurs.
- "Refactor X" -> preserve behavior with tests before and after.

For multi-step work, use a brief plan with verification attached to each step:

```text
1. Inspect the current behavior -> verify by reading the relevant code/tests.
2. Make the smallest targeted change -> verify with focused tests.
3. Check for side effects -> verify with the nearest broader guard.
```

Strong success criteria let Codex proceed independently. Weak criteria such as "make it work" require clarification or a concrete proposed interpretation before implementation.
