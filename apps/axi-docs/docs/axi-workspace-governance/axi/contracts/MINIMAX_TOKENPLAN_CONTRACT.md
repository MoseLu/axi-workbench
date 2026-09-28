---
title: MiniMax Token Plan Contract
description: Cloud capability CLI providing web search, image understanding, generation, speech, music, and lyrics services via MiniMax.
tags:
  - contract
  - minimax-tokenplan
  - cloud-capability-cli
  - external-infra
  - workspace-resource
graph-tags:
  - AI
  - Cloud
  - MiniMax
  - Contract
updated: 2026-09-20
---

# MiniMax Token Plan Contract

## Overview

| Property | Value |
|---|---|
| **Node ID** | `minimax-tokenplan` |
| **Kind** | `cloud-capability-cli` |
| **Path** | `/Users/mose/.cc-connect` |
| **Lifecycle** | `external-infra` |
| **Owner** | AxiomaticWorld workspace owner |

This node represents the MiniMax Token Plan CLI providing cloud-based AI capabilities including web search, image understanding, generation, speech synthesis, music generation, and lyrics services.

## Capabilities Provided

| Capability | Description |
|---|---|
| `web-search` | Web search functionality |
| `image-understanding-fallback` | Cloud-based image understanding when local capability is unavailable |
| `image-generation` | Image synthesis via MiniMax |
| `speech-generation` | Text-to-speech synthesis |
| `music-generation` | Music creation |
| `lyrics` | Lyrics generation |
| `music-cover` | Music cover/cover song generation |

## Contract

The canonical contract is the MiniMax Token Plan CLI:

```
/Users/mose/.cc-connect/bin/minimax-tokenplan
```

## Health Check

```bash
/Users/mose/.cc-connect/bin/minimax-tokenplan tools
```

## Verification

```bash
/Users/mose/.cc-connect/bin/minimax-tokenplan tools
```

## Consumers

The following projects consume this capability:

- `axi-workbench`
- `axi-model-gateway` (deprecated)
- `axi-agent`
- `axi-pet`
- `axi-pet-desktop`
- `ielts-vocab`
- `ai-resource-orchestration`

## Relationships

| Consumer | Requiredness | Environment |
|---|---|---|
| `axi-workbench` | optional | workspace |
| `axi-model-gateway` | optional | external |
| `axi-agent` | optional | external |
| `axi-pet` | optional | external |
| `axi-pet-desktop` | optional | external |
| `ielts-vocab` | optional | external |
| `ai-resource-orchestration` | optional | workspace |

## Usage Notes

- This is **cloud-based infrastructure** requiring API tokens
- Acts as fallback for image understanding when `ai-capability` local services are unavailable
- Supports music and lyrics generation for creative applications
- Health check confirms available tools
- This is **external infrastructure** managed outside the workspace tree
- Remediation is not supported (超出 workspace 治理范围)

## Related

- See `ai-capability` for the local AI capability layer
- See `ollama-local` for local model provider
