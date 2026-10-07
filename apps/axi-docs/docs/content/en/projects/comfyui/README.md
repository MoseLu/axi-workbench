---
id: axi-docs-en-projects-comfyui
title: ComfyUI Reference
type: project
status: published
tags: [Axi Docs, Projects, references, third-party, image-generation, python, pytorch]
created: 2026-10-07
modified: 2026-10-07
graph-title: ComfyUI Reference
graph-tags: [Projects, references, image-generation]
description: Third-party reference mirror of `comfyanonymous/ComfyUI` (`0.20.1`) — modular node-graph diffusion engine in `Python` + `aiohttp` + `PyTorch`. Used as an architectural reference for Axi-side visual workflow engines. Built on `comfy_execution.graph.TopologicalSort` + `DynamicPrompt` + `comfy_execution/caching.py` + `folder_paths.py` + `comfy/model_management.py` + `protocol.py` + `server.py` + `openapi.yaml`.
project:
  id: comfyui
  partition: references/short-term
  path: /Volumes/code/workspace/references/short-term/comfyui
  upstream: https://github.com/comfyanonymous/ComfyUI
  source-section: reference
---

# ComfyUI Reference

> Read-only reference mirror of upstream ComfyUI (`0.20.1`). Source of truth
> for upstream product intent is the upstream repository; the local overlay
> (`AGENTS.md`, `INDEX.md`, `PRD.md`, `TDD.md`, `TODO.md`, `MILESTONE.md`,
> `CHANGELOG.md`, `docs/project-docs.manifest.json`) governs how Axi treats it.
> Section: reference / Partition: `references/short-term/`.

## Summary

ComfyUI is a node-graph driven AI engine for content creation: a user composes pipelines by wiring typed nodes (load model → encode prompt → sample latent → decode → save image) on a visual canvas, and the engine executes only the changed sub-graph on each re-run. It is the de-facto reference architecture for "anything-as-a-graph" content tooling — image, video, audio, 3D — and is the system against which Axi's hypothetical visual workflow engines should benchmark their node-graph model, cache strategy, and execution model.

For Axi, this is **architecture reference only**, not a product to fork or operate. The value it returns to Axi is the node-graph execution model (`comfy_execution.graph.TopologicalSort` + `DynamicPrompt` + cache strategies in `comfy_execution/caching.py`), the model-loader abstraction (`folder_paths.py` + `comfy/model_management.py`), the API surface for remote queues (`protocol.py` + `server.py` websocket binary frames), and the dual-track versioning of "core engine" vs "frontend" repos used by the upstream project to ship features on a weekly cadence without breaking custom nodes.

**Stage**: reference snapshot, third-party. **Lifecycle**: read-only mirror. **Canonical path**: `/Volumes/code/workspace/references/short-term/comfyui`. **Upstream version**: `0.20.1` (per `comfyui_version.py` and `pyproject.toml`). **Axi overlay version**: 12 commits ahead of fork point on `master` (local commit `7aed0605 chore(comfyui-): checkpoint workspace changes`), tracking 285 upstream commits behind. **Working tree**: 1 modified file (`AGENTS.md`) + 1 untracked file (`docs/project-docs.manifest.json`); no Axi-owned build or runtime expected.

## Stack

`Python 3.10+`, `aiohttp`, `PyTorch`, `safetensors`, `comfyui-frontend-package 1.42.15`, `LitElement`, `comfy-kitchen (Triton)`, `comfy-aimdo (DynamicVRAM)`, `cuda_malloc.py`, `SQLAlchemy 2.0`, `Alembic`, `Ruff`, `pylint`, `pytest`, `openapi.yaml`

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 — Node-graph execution + cache strategies | shipped | `comfy_execution/graph.py` (TopologicalSort + DynamicPrompt) + `comfy_execution/caching.py` (BasicCache / LRUCache / HierarchicalCache / RAMPressureCache / NullCache) |
| M2 — Path-driven model loader abstraction | shipped | `folder_paths.py` (`folder_names_and_paths` dict) + `comfy/model_management.py` (VRAM budget + device selection + soft-min-heap offloading) |
| M3 — Binary-event websocket protocol | shipped | `protocol.py` (BinaryEventTypes: PREVIEW_IMAGE, UNENCODED_PREVIEW_IMAGE, TEXT, PREVIEW_IMAGE_WITH_METADATA) |
| M4 — Layered middleware (CORS + origin-only + CSP) | shipped | `server.py` (1295 LOC) — `deprecation_warning`, `compress_body`, `create_origin_only_middleware` (mitigates browser CSRF quirk) |
| M5 — Versioned public API (`v0_0_1` / `v0_0_2` / `latest`) | shipped | `comfy_api/v0_0_1/`, `comfy_api/v0_0_2/`, `comfy_api/latest/` (current authoring surface) + `comfy_api/version_list.py` |
| M6 — Frontend split (npm package, served as static assets) | shipped | `comfyui-frontend-package==1.42.15` fetched + served by `app/frontend_management.py` |
| M7 — Custom node protocol (prestartup + NODE_CLASS_MAPPINGS) | shipped | `custom_nodes/*/prestartup_script.py` + `nodes.NODE_CLASS_MAPPINGS`; loaded at startup via `execute_prestartup_script()` in `main.py` |
| M8 — Vendor API nodes (BFL, Gemini, Runway, Minimax Hailuo, …) | shipped | `comfy_api_nodes/nodes_*.py` — each wraps a paid/closed model behind the same `ComfyExtension` interface |
| M9 — Asset tracking + users (SQLAlchemy + Alembic) | shipped | `app/database/db.py` + `app/database/models.py`; migrations under `alembic_db/` |
| M10 — Public HTTP API contract | shipped | `openapi.yaml` (`/Volumes/code/workspace/references/short-term/comfyui/openapi.yaml`) |
| M11 — Axi overlay docs | shipped | full `comfyui` overlay suite at the reference repo root |

## Build & Install

Axi does not build or install this reference. The upstream install recipes that the README documents remain valid for the snapshot:

```bash
# Manual install (Linux/macOS, from upstream README)
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt

# Desktop application (Windows, macOS) - shipped separately by Comfy-Org
# https://www.comfy.org/download

# CLI installer (upstream)
pip install comfy-cli
comfy install

# Run
python main.py --listen 127.0.0.1 --port 8188
# Then open http://127.0.0.1:8188
```

Required system stack (from `requirements.txt` + `pyproject.toml`):

- Python 3.10+ (project supports 3.13, recommends 3.13; free-threaded variant "works but not fully supported")
- PyTorch 2.4+ ("we generally recommend using the latest major version of pytorch with the latest cuda version unless it is less than 2 weeks old")
- One of: NVIDIA CUDA, AMD ROCm 7.2, Intel oneAPI, Apple Silicon MPS, Huawei Ascend, or `--cpu` (slow)
- ~3 GB disk for the empty engine, plus the size of any model files (checkpoints, VAEs, LoRAs, etc.)

## Architecture Highlights

**The graph model is data, not code.** A ComfyUI workflow is a JSON object whose keys are node IDs and whose values map input slot names to either literal values or to `[source_node_id, output_slot_index]` tuples. The executor (`comfy_execution.graph.TopologicalSort` + `comfy_execution.graph.DynamicPrompt`) walks this dictionary, builds a dependency graph, executes nodes in topological order, and only re-runs nodes whose inputs (as identified by `IS_CHANGED` / `fingerprint_inputs`) actually changed since the last run. This is the "only re-executes the parts of the workflow that changes between executions" claim from the upstream README, and it is the cleanest separation of *graph structure* from *execution state* that this codebase exposes.

**Execution is two-phase.** `execution.py` first validates input signatures (`CacheKeySetInputSignature`, `CacheKeySetID`), then dispatches each node on the asyncio event loop via `_async_map_node_over_list`. The cache layer (`comfy_execution/caching.py`) is pluggable: `BasicCache` keeps everything forever, `LRUCache` evicts least-recently-used outputs, `RAMPressureCache` evicts when system RAM pressure crosses a threshold, `HierarchicalCache` layers them. The choice is exposed as a CLI argument and logged at startup, so operators can tune memory behaviour without code changes.

**Model management is path-driven and explicit.** `folder_paths.py` is the single source of truth for where checkpoints, VAEs, LoRAs, CLIP, controlnet weights, and `custom_nodes/` live. Every loader in `comfy/model_management.py` takes a path string, never a Python module path. This is what lets the same engine load SD 1.5, SDXL, Flux, Wan, HunyuanVideo, and Stable Audio without code changes — the per-model weight-format quirks live in `comfy/sd.py`, `comfy/sd1_clip.py`, `comfy/model_base.py`, and the diffusion samplers in `comfy/samplers.py`. The cache is keyed on `(model_path, dtype, device)` so two requests asking for the same checkpoint on the same device get the same in-memory `ModelPatcher` object.

**The public API is versioned and the engine splits "core" from "frontend".** `comfy_api/v0_0_1/`, `v0_0_2/`, and `latest/` (which holds the current API surface) coexist on disk; `comfy_api/version_list.py` declares which versions are supported. The frontend is delivered as a separate npm package (`comfyui-frontend-package==1.42.15`) that is fetched and served as static assets by `app/frontend_management.py`. This split is what lets the upstream project ship a new core version weekly while custom nodes (which import `comfy_api.latest.io`) get a predictable contract.

**Vendored API nodes are uniform.** `comfy_api_nodes/nodes_*.py` exposes paid/closed models (BFL Flux Kontext, Google Gemini, Runway Gen, Minimax Hailuo, etc.) as the same kind of `ComfyExtension` registered node that local models expose. The pattern is consistent: one file per vendor, classes derive from `ComfyNodeABC`, all HTTP polling goes through `comfy_api_nodes/util.py` (`ApiEndpoint`, `poll_op`, `sync_op`, `download_url_to_video_output`). This is the easiest place to copy the "how do I add a new model vendor" pattern from when adapting for Axi.

**Security is layered in `server.py`.** Three middleware gates are applied to every request: `deprecation_warning` (warns once per legacy path), `compress_body` (gzip JSON/text responses), and `create_origin_only_middleware` (rejects cross-site requests when the host header doesn't match the origin). The last one specifically mitigates the browser CSRF quirk where any web page can POST to `127.0.0.1:8188`. There is no auth — the server is intended for loopback or trusted-network use.

**The model loader is hot-reloadable but the engine is not.** Custom nodes are loaded at startup (`execute_prestartup_script()` in `main.py`) and re-imported on user request; the executor itself only restarts on a process restart. This is why the README distinguishes "ComfyUI Core", "ComfyUI Desktop", and "ComfyUI Frontend" — the core can be replaced without touching the desktop shell or the UI.

## Notes

- Graph model is JSON-data-driven: `comfy_execution.graph.TopologicalSort` + `comfy_execution.graph.DynamicPrompt` walk node IDs and `[source_node_id, output_slot_index]` input tuples; only nodes whose `IS_CHANGED` / `fingerprint_inputs` changed are re-executed.
- Execution is two-phase: `execution.py` builds `CacheKeySetInputSignature` + `CacheKeySetID` for input signature validation, then dispatches each node on the asyncio event loop via `_async_map_node_over_list`.
- Cache strategies pluggable via CLI: `BasicCache` / `LRUCache` / `HierarchicalCache` / `RAMPressureCache` / `NullCache` selected through the `CacheType` enum in `execution.py`; choice is logged at startup.
- Path-driven model loader: `folder_paths.py` (`folder_names_and_paths` dict) is the single source of truth for `models/{checkpoints,vae,loras,clip_vision,...}` lookups; `comfy/model_management.py` takes a path string, never a Python module path.
- Cache key is `(model_path, dtype, device)`; two requests asking for the same checkpoint on the same device share the same in-memory `ModelPatcher`.
- Public API is versioned: `comfy_api/v0_0_1/`, `v0_0_2/`, and `latest/` (current authoring surface) coexist on disk; `comfy_api/version_list.py` declares which versions are supported; custom nodes import `comfy_api.latest.io` for a predictable contract.
- Frontend is split into a separate npm package: `comfyui-frontend-package==1.42.15` fetched + served as static assets by `app/frontend_management.py`.
- Vendor API nodes are uniform: `comfy_api_nodes/nodes_*.py` exposes BFL Flux Kontext, Google Gemini, Runway Gen, Minimax Hailuo, etc. as the same `ComfyExtension` interface; HTTP polling goes through `comfy_api_nodes/util.py` (`ApiEndpoint`, `poll_op`, `sync_op`, `download_url_to_video_output`).
- Layered middleware in `server.py`: `deprecation_warning`, `compress_body`, `create_origin_only_middleware` (rejects cross-site requests when the host header doesn't match the origin — mitigates browser CSRF quirk where any web page can POST to `127.0.0.1:8188`); no auth at all — server is intended for loopback or trusted-network use.
- Custom node protocol: `custom_nodes/*/prestartup_script.py` + `nodes.NODE_CLASS_MAPPINGS`; loaded at startup via `execute_prestartup_script()` in `main.py` and re-importable on user request; the executor itself only restarts on a process restart.
- Asset tracking + users: `app/database/db.py` + `app/database/models.py` (SQLAlchemy 2.0 + Alembic, migrations under `alembic_db/`) — used for asset tracking and user data, not for the graph itself.
- Public HTTP API contract: `openapi.yaml` (`/Volumes/code/workspace/references/short-term/comfyui/openapi.yaml`).
- Tests under `pytest` with markers `inference` / `execution`; upstream tests run via `python -m pytest -m "not inference"` / `"not execution"` (inference / execution tests deselect by default).

## Cross-References

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "ComfyUI Reference".
- Project root: `/Volumes/code/workspace/references/short-term/comfyui`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/short-term/comfyui/AGENTS.md`
- Project `README.md`: `/Volumes/code/workspace/references/short-term/comfyui/README.md`
- Upstream repository: `https://github.com/comfyanonymous/ComfyUI`
- Upstream documentation: `https://docs.comfy.org/`
- ADR sources referenced from `AGENTS.md`: ADR-001 through ADR-010 (under `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`).
- Sister Axi mirrors in `references/short-term/`: `blinko` (TypeScript inbox), `opencodex` (Node + Swift codex gateway), `tidewater-reference` (JavaScript + WebGPU ocean / fishing simulator).
- Sister Axi-owned capability work: `/Volumes/code/workspace/.cc-connect/ai-capabilities.json` (LLM, image, music, video routing — ComfyUI is the reference architecture for any local visual workflow engine Axi would build on top of this stack).