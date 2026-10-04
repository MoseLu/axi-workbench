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

# VoiceAssistant — on-device voice loop prototype — Agent Contract

> This dossier is the Axi Docs agent contract for **VoiceAssistant — on-device voice loop prototype** (workspace path: `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/voice-assistant-on-device-speech-recognition/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
