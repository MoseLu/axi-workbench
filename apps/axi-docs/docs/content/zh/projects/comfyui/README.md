---
id: axi-docs-zh-projects-comfyui
title: ComfyUI 参考
type: project
status: published
tags: [Axi Docs, 项目, references, third-party, image-generation, python, pytorch]
created: 2026-10-07
modified: 2026-10-07
graph-title: ComfyUI 参考
graph-tags: [Projects, references, image-generation]
description: 第三方参考镜像 `comfyanonymous/ComfyUI`（`0.20.1`）——基于 `Python` + `aiohttp` + `PyTorch` 的模块化节点图扩散引擎。供 Axi 端可视化工作流引擎作为架构参考。基于 `comfy_execution.graph.TopologicalSort` + `DynamicPrompt` + `comfy_execution/caching.py` + `folder_paths.py` + `comfy/model_management.py` + `protocol.py` + `server.py` + `openapi.yaml`。
project:
  id: comfyui
  partition: references/short-term
  path: /Volumes/code/workspace/references/short-term/comfyui
  upstream: https://github.com/comfyanonymous/ComfyUI
  source-section: reference
---

# ComfyUI 参考

> 对上游 ComfyUI（`0.20.1`）的只读参考镜像。上游产品意图的权威源是上游仓库；本地 overlay（`AGENTS.md`、`INDEX.md`、`PRD.md`、`TDD.md`、`TODO.md`、`MILESTONE.md`、`CHANGELOG.md`、`docs/project-docs.manifest.json`）规定 Axi 如何对待它。
> 章节：reference / 分区：`references/short-term/`。

## 概要

ComfyUI 是一个由节点图驱动的内容创作 AI 引擎：用户在可视化画布上连线"加载模型 → 编码 prompt → 潜空间采样 → 解码 → 保存图像"等带类型的输入节点，引擎只对每次重跑中发生变化的那部分子图执行。它是"anything-as-a-graph"内容工具（图像、视频、音频、3D）的实际参考架构，也是 Axi 假想的可视化工作流引擎应当用来对齐节点图模型、缓存策略与执行模型的参考系统。

对 Axi 来说，这是**仅作架构参考**的对象，不应被 fork 或运营。它为 Axi 提供的价值是：节点图执行模型（`comfy_execution.graph.TopologicalSort` + `DynamicPrompt` + 位于 `comfy_execution/caching.py` 的缓存策略）、模型加载抽象（`folder_paths.py` + `comfy/model_management.py`）、用于远程队列的 API 形态（`protocol.py` + `server.py` 的 websocket 二进制帧），以及上游项目所采取的"核心引擎 vs 前端"双轨版本管理——这是上游能以周节奏发版而不破坏自定义节点的关键。

**阶段**：第三方参考快照。**生命周期**：只读镜像。**权威路径**：`/Volumes/code/workspace/references/short-term/comfyui`。**上游版本**：`0.20.1`（见 `comfyui_version.py` 与 `pyproject.toml`）。**Axi overlay 版本**：在 `master` 上比 fork 点领先 12 个提交（本地提交 `7aed0605 chore(comfyui-): checkpoint workspace changes`），落后上游 285 个提交。**工作树**：1 个修改文件（`AGENTS.md`）+ 1 个未跟踪文件（`docs/project-docs.manifest.json`）；预期不出现 Axi 拥有的构建或运行时。

## Stack

`Python 3.10+`, `aiohttp`, `PyTorch`, `safetensors`, `comfyui-frontend-package 1.42.15`, `LitElement`, `comfy-kitchen (Triton)`, `comfy-aimdo (DynamicVRAM)`, `cuda_malloc.py`, `SQLAlchemy 2.0`, `Alembic`, `Ruff`, `pylint`, `pytest`, `openapi.yaml`

## Milestone Status

| 里程碑 | 状态 | 证据 |
| --- | --- | --- |
| M1 — 节点图执行 + 缓存策略 | 已交付 | `comfy_execution/graph.py`（TopologicalSort + DynamicPrompt）+ `comfy_execution/caching.py`（BasicCache / LRUCache / HierarchicalCache / RAMPressureCache / NullCache） |
| M2 — 路径驱动的模型加载抽象 | 已交付 | `folder_paths.py`（`folder_names_and_paths` 字典）+ `comfy/model_management.py`（VRAM 预算 + 设备选择 + soft-min-heap 卸载） |
| M3 — Binary-event websocket 协议 | 已交付 | `protocol.py`（BinaryEventTypes：PREVIEW_IMAGE、UNENCODED_PREVIEW_IMAGE、TEXT、PREVIEW_IMAGE_WITH_METADATA） |
| M4 — 分层中间件（CORS + origin-only + CSP） | 已交付 | `server.py`（1295 LOC）—— `deprecation_warning`、`compress_body`、`create_origin_only_middleware`（缓解浏览器 CSRF 怪癖） |
| M5 — 版本化的公开 API（`v0_0_1` / `v0_0_2` / `latest`） | 已交付 | `comfy_api/v0_0_1/`、`comfy_api/v0_0_2/`、`comfy_api/latest/`（当前作者面）+ `comfy_api/version_list.py` |
| M6 — 前端拆分（npm 包，作为静态资源提供） | 已交付 | `comfyui-frontend-package==1.42.15` 由 `app/frontend_management.py` 拉取并以静态资源形式提供 |
| M7 — 自定义节点协议（prestartup + NODE_CLASS_MAPPINGS） | 已交付 | `custom_nodes/*/prestartup_script.py` + `nodes.NODE_CLASS_MAPPINGS`；通过 `main.py` 的 `execute_prestartup_script()` 在启动时加载 |
| M8 — 厂商 API 节点（BFL、Gemini、Runway、Minimax Hailuo 等） | 已交付 | `comfy_api_nodes/nodes_*.py` —— 每个节点把付费/闭源模型包装为同一 `ComfyExtension` 接口 |
| M9 — 资产追踪 + 用户（SQLAlchemy + Alembic） | 已交付 | `app/database/db.py` + `app/database/models.py`；迁移位于 `alembic_db/` |
| M10 — 公开 HTTP API 契约 | 已交付 | `openapi.yaml`（`/Volumes/code/workspace/references/short-term/comfyui/openapi.yaml`） |
| M11 — Axi overlay 文档 | 已交付 | 在 reference repo 根目录完整的 `comfyui` overlay 套件 |

## Build & Install

Axi 不构建也不安装这个参考。README 中记录的上游安装步骤对当前快照仍然有效：

```bash
# 手动安装（Linux/macOS，源自上游 README）
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt

# 桌面应用（Windows、macOS）—— 由 Comfy-Org 单独分发
# https://www.comfy.org/download

# 上游 CLI 安装器
pip install comfy-cli
comfy install

# 运行
python main.py --listen 127.0.0.1 --port 8188
# 然后访问 http://127.0.0.1:8188
```

所需系统栈（来自 `requirements.txt` + `pyproject.toml`）：

- Python 3.10+（项目支持 3.13，推荐 3.13；free-threaded 变体"可用但未完全支持"）
- PyTorch 2.4+（"我们一般建议使用 pytorch 最新主版本，配合最新 cuda 版本，除非发布未满两周"）
- 任选其一：NVIDIA CUDA、AMD ROCm 7.2、Intel oneAPI、Apple Silicon MPS、Huawei Ascend，或 `--cpu`（较慢）
- 空引擎约 3 GB 磁盘空间，加上模型文件（checkpoints、VAEs、LoRAs 等）的体积

## Architecture Highlights

**节点模型是数据，不是代码。** ComfyUI 工作流是一个 JSON 对象，其键是节点 ID，值把输入槽名映射为字面量或 `[source_node_id, output_slot_index]` 元组。执行器（`comfy_execution.graph.TopologicalSort` + `comfy_execution.graph.DynamicPrompt`）遍历该字典，构建依赖图，按拓扑顺序执行节点，且只重跑那些输入（由 `IS_CHANGED` / `fingerprint_inputs` 标识）相对于上次执行确实改变的节点。这对应上游 README 中的"only re-executes the parts of the workflow that changes between executions"主张，也是该代码库中 *graph 结构* 与 *执行状态* 之间最干净的分离。

**执行分为两阶段。** `execution.py` 首先校验输入签名（`CacheKeySetInputSignature`、`CacheKeySetID`），然后通过 `_async_map_node_over_list` 把每个节点调度到 asyncio 事件循环上。缓存层（`comfy_execution/caching.py`）是可插拔的：`BasicCache` 永久保留一切，`LRUCache` 淘汰最久未用输出，`RAMPressureCache` 在系统 RAM 压力越界时淘汰，`HierarchicalCache` 把它们分层。选项暴露为 CLI 参数并在启动时记录日志，使运维无需改代码就能调节内存行为。

**模型管理是路径驱动且显式的。** `folder_paths.py` 是 checkpoints、VAEs、LoRAs、CLIP、controlnet 权重与 `custom_nodes/` 所在位置的单一真实源。`comfy/model_management.py` 中每一个 loader 都接受路径字符串，从不接受 Python 模块路径。这让同一引擎无需改代码就能加载 SD 1.5、SDXL、Flux、Wan、HunyuanVideo 与 Stable Audio——各模型权重格式的特殊性落在 `comfy/sd.py`、`comfy/sd1_clip.py`、`comfy/model_base.py` 以及 `comfy/samplers.py` 中的扩散采样器里。缓存键为 `(model_path, dtype, device)`，所以同一个 checkpoint 在同一设备上的两个请求会共享同一个内存中的 `ModelPatcher`。

**公开 API 版本化，引擎把"核心"与"前端"拆分。** `comfy_api/v0_0_1/`、`v0_0_2/` 与 `latest/`（当前 API 面）共存于磁盘；`comfy_api/version_list.py` 声明支持的版本。前端作为单独的 npm 包（`comfyui-frontend-package==1.42.15`）分发，由 `app/frontend_management.py` 拉取并以静态资源形式提供。这种拆分让上游可以周节奏发布核心新版本，而自定义节点（它们 import `comfy_api.latest.io`）则获得可预期的契约。

**Vendor API 节点统一。** `comfy_api_nodes/nodes_*.py` 把付费/闭源模型（BFL Flux Kontext、Google Gemini、Runway Gen、Minimax Hailuo 等）暴露为与本地模型相同类型的 `ComfyExtension` 注册节点。模式一致：每个厂商一个文件，类派生自 `ComfyNodeABC`，所有 HTTP 轮询都通过 `comfy_api_nodes/util.py`（`ApiEndpoint`、`poll_op`、`sync_op`、`download_url_to_video_output`）。这是在适配 Axi 时复制"如何新增模型厂商"模式最简单的地方。

**`server.py` 中安全是分层的。** 三个中间件门被作用于每个请求：`deprecation_warning`（每个遗留路径警告一次）、`compress_body`（gzip JSON/文本响应）、`create_origin_only_middleware`（当 Host 头与 Origin 不匹配时拒绝跨站请求）。最后一个特别缓解了"任意网页都能 POST 到 `127.0.0.1:8188`"的浏览器 CSRF 怪癖。完全没有鉴权——服务器只预期跑在 loopback 或受信网络下。

**模型加载器可热重载，但引擎不行。** 自定义节点在 `main.py` 的 `execute_prestartup_script()` 启动时加载，并在用户请求时重新 import；执行器本身只能在进程重启时重启。这就是 README 区分"ComfyUI Core"、"ComfyUI Desktop"与"ComfyUI Frontend"的原因——核心可以替换而不影响桌面外壳或 UI。

## 说明

- 节点图模型由 JSON 数据驱动：`comfy_execution.graph.TopologicalSort` + `comfy_execution.graph.DynamicPrompt` 遍历节点 ID 与 `[source_node_id, output_slot_index]` 输入元组；只有输入 `IS_CHANGED` / `fingerprint_inputs` 改变的节点会被重新执行。
- 执行分两阶段：`execution.py` 为输入签名校验构建 `CacheKeySetInputSignature` + `CacheKeySetID`，然后通过 `_async_map_node_over_list` 把每个节点调度到 asyncio 事件循环上。
- 缓存策略通过 CLI 可插拔：`BasicCache` / `LRUCache` / `HierarchicalCache` / `RAMPressureCache` / `NullCache` 由 `execution.py` 的 `CacheType` 枚举选择；选择会在启动时记录日志。
- 路径驱动的模型加载器：`folder_paths.py`（`folder_names_and_paths` 字典）是 `models/{checkpoints,vae,loras,clip_vision,...}` 查找的单一真实源；`comfy/model_management.py` 接受路径字符串，从不接受 Python 模块路径。
- 缓存键为 `(model_path, dtype, device)`；同一个 checkpoint 在同一设备上的两个请求共享同一内存中的 `ModelPatcher`。
- 公开 API 版本化：`comfy_api/v0_0_1/`、`v0_0_2/` 与 `latest/`（当前作者面）共存于磁盘；`comfy_api/version_list.py` 声明支持的版本；自定义节点 import `comfy_api.latest.io` 以获得可预期的契约。
- 前端拆分为独立的 npm 包：`comfyui-frontend-package==1.42.15` 由 `app/frontend_management.py` 拉取并以静态资源形式提供。
- 厂商 API 节点统一：`comfy_api_nodes/nodes_*.py` 暴露 BFL Flux Kontext、Google Gemini、Runway Gen、Minimax Hailuo 等，共享同一 `ComfyExtension` 接口；HTTP 轮询走 `comfy_api_nodes/util.py`（`ApiEndpoint`、`poll_op`、`sync_op`、`download_url_to_video_output`）。
- `server.py` 中的分层中间件：`deprecation_warning`、`compress_body`、`create_origin_only_middleware`（当 Host 头与 Origin 不匹配时拒绝跨站请求——缓解任意网页都能 POST 到 `127.0.0.1:8188` 的浏览器 CSRF 怪癖）；完全不设鉴权——服务器仅预期用于 loopback 或受信网络。
- 自定义节点协议：`custom_nodes/*/prestartup_script.py` + `nodes.NODE_CLASS_MAPPINGS`；通过 `main.py` 的 `execute_prestartup_script()` 在启动时加载，并可在用户请求时重新 import；执行器本身仅在进程重启时重启。
- 资产追踪 + 用户：`app/database/db.py` + `app/database/models.py`（SQLAlchemy 2.0 + Alembic，迁移位于 `alembic_db/`）——用于资产追踪和用户数据，而非节点图本身。
- 公开 HTTP API 契约：`openapi.yaml`（`/Volumes/code/workspace/references/short-term/comfyui/openapi.yaml`）。
- 测试通过 `pytest` 标记 `inference` / `execution` 运行；上游测试通过 `python -m pytest -m "not inference"` / `"not execution"` 执行（inference 与 execution 测试默认 deselect）。

## Cross-References

- 工作区入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "ComfyUI Reference"。
- 项目根目录：`/Volumes/code/workspace/references/short-term/comfyui`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/short-term/comfyui/AGENTS.md`
- 项目 `README.md`：`/Volumes/code/workspace/references/short-term/comfyui/README.md`
- 上游仓库：`https://github.com/comfyanonymous/ComfyUI`
- 上游文档：`https://docs.comfy.org/`
- AGENTS.md 引用的 ADR：ADR-001 至 ADR-010（位于 `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`）。
- `references/short-term/` 中的姐妹 Axi 镜像：`blinko`（TypeScript inbox）、`opencodex`（Node + Swift codex gateway）、`tidewater-reference`（JavaScript + WebGPU 海洋/钓鱼模拟器）。
- 姐妹 Axi 能力工作：`/Volumes/code/workspace/.cc-connect/ai-capabilities.json`（LLM、图像、音乐、视频路由——ComfyUI 是任何 Axi 在此技术栈上构建本地可视化工作流引擎的参考架构）。