---
title: Ollama Local Contract
description: Local model provider offering LLM, VLM, and embedding services via Ollama.
tags:
  - contract
  - ollama-local
  - local-model-provider
  - external-infra
  - workspace-resource
graph-tags:
  - AI
  - Local Model
  - LLM
  - Contract
updated: 2026-09-20
---

# Ollama Local Contract

## Overview

| Property | Value |
|---|---|
| **Node ID** | `ollama-local` |
| **Kind** | `local-model-provider` |
| **Path** | `/Users/mose/.cc-connect` |
| **Lifecycle** | `external-infra` |
| **Owner** | AxiomaticWorld workspace owner |

This node represents the local Ollama instance providing LLM, VLM (vision-language model), and embedding services locally without external API calls.

## Capabilities Provided

| Capability | Description |
|---|---|
| `local-llm` | Local large language model inference |
| `local-vlm` | Local vision-language model inference |
| `local-embedding` | Local text and image embeddings |

## Contract

The canonical contract is the Ollama CLI:

```
/Users/mose/.cc-connect/bin/ollama-local
```

## Health Check

```bash
/Users/mose/.cc-connect/bin/ollama-local models
```

## Verification

```bash
/Users/mose/.cc-connect/bin/ollama-local embed --model mxbai-embed-large:latest --text smoke
```

## Consumers

The following projects consume this capability:

- `axi-workbench`
- `axi-model-gateway` (deprecated)
- `axi-agent`
- `ielts-vocab`
- `axi-feishu-codex-bridge`

## Relationships

| Consumer | Requiredness | Environment |
|---|---|---|
| `axi-workbench` | optional | workspace |
| `axi-model-gateway` | optional | external |
| `axi-agent` | optional | external |
| `ielts-vocab` | optional | external |
| `axi-feishu-codex-bridge` | optional | external |

## Usage Notes

- This is **local infrastructure** using Ollama - no external API calls required
- Useful for offline development and cost-free inference
- Embedding verification uses `mxbai-embed-large:latest` model
- Health check confirms models are available
- This is **external infrastructure** managed outside the workspace tree
- Remediation is not supported (超出 workspace 治理范围)

## Related

- See `ai-capability` for the broader local AI capability layer
- See `minimax-tokenplan` for cloud-based model capabilities
