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

# VoiceAssistant — on-device voice loop prototype — PRD Slice

> Axi Docs PRD slice for **VoiceAssistant — on-device voice loop prototype**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-VOICE-ASSISTANT-ON-DEVICE-SPEECH-RECOGNITION-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for VoiceAssistant — on-device voice loop prototype. |
| Acceptance | `docs/content/{en,zh}/projects/voice-assistant-on-device-speech-recognition/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-VOICE-ASSISTANT-ON-DEVICE-SPEECH-RECOGNITION-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=voice-assistant-on-device-speech-recognition` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
