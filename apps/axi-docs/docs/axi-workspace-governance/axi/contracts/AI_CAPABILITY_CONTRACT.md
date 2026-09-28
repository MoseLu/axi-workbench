---
title: AI Capability Layer Contract
description: Local AI capability layer providing ASR, vision, OCR, LLM, generation, and embedding services to workspace projects.
tags:
  - contract
  - ai-capability
  - external-infra
  - workspace-resource
graph-tags:
  - AI
  - Capability
  - Contract
updated: 2026-09-20
---

# AI Capability Layer Contract

## Overview

| Property | Value |
|---|---|
| **Node ID** | `ai-capability` |
| **Kind** | `local-capability-layer` |
| **Path** | `/Users/mose/.cc-connect` |
| **Lifecycle** | `external-infra` |
| **Owner** | AxiomaticWorld workspace owner |

This node represents the local AI capability layer that provides multimodal AI services (ASR, vision, OCR, LLM, generation, embedding) to workspace projects. It is external infrastructure managed outside the workspace tree.

## Capabilities Provided

| Capability | Description |
|---|---|
| `asr` | Automatic speech recognition |
| `image-recognition` | Image classification and object detection |
| `ocr` | Optical character recognition |
| `document-extraction` | Structured data extraction from documents |
| `llm` | Large language model inference |
| `image-generation` | Image synthesis |
| `audio-generation` | Audio/speech synthesis |
| `video-generation` | Video generation |
| `embedding` | Text and image embeddings |
| `vector-memory-health` | Vector memory system health check |

## Contract

The canonical contract file is located at:

```
/Users/mose/.cc-connect/ai-capabilities.json
```

## Health Check

```bash
/Users/mose/.cc-connect/bin/ai-capability status --json
```

## Verification

```bash
/Users/mose/.cc-connect/bin/ai-capability status --json
```

## Consumers

The following projects consume this capability:

- `axi-workbench`
- `axi-model-gateway` (deprecated, replaced by sub2api)
- `axi-agent`
- `axi-pet`
- `axi-pet-desktop`
- `ielts-vocab`

## Relationships

| Consumer | Requiredness | Environment |
|---|---|---|
| `axi-workbench` | optional | workspace |
| `axi-model-gateway` | optional | external |
| `axi-agent` | optional | external |
| `axi-pet` | optional | external |
| `axi-pet-desktop` | optional | external |
| `ielts-vocab` | optional | external |

## Usage Notes

- This is **external infrastructure** managed outside the workspace tree
- Remediation is not supported (超出 workspace 治理范围)
- All consumers treat this as optional runtime capability
- Health checks should be performed before relying on this capability in critical paths
