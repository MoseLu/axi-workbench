---
id: axi-docs-zh-projects-voice-assistant-on-device-speech-recognition
title: VoiceAssistant — on-device voice loop prototype
type: project
status: draft
tags: [Axi Docs, Projects, candidates, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: VoiceAssistant — on-device voice loop prototype
graph-tags: [Projects, candidates]
description: VoiceAssistant on-device speech recognition prototype — streaming sherpa-onnx ASR + on-device chat model + locally served TTS on Android. Moved from products/ to candidates/ on 2026-09-25 (pending maturity review).
project:
  id: voice-assistant-on-device-speech-recognition
  partition: candidates
  path: /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition
  source-section: core
---

# VoiceAssistant — on-device voice loop prototype — TDD Slice

> Axi Docs TDD slice for **VoiceAssistant — on-device voice loop prototype**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/voice-assistant-on-device-speech-recognition/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=voice-assistant-on-device-speech-recognition` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/voice-assistant-on-device-speech-recognition` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
