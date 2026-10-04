<!-- 由 `pnpm sync:workspace` 自动生成 at 2026-09-27T14:58:29.211Z -- DO NOT EDIT -->

# AxiomaticWorld 工作区项目索引

> 自动生成的项目清单。数据源：`/Volumes/code/workspace/workspace.graph.json`。

> 本页列出在工作区中发现的全部 active AxiomaticWorld 项目。由 `pnpm sync:workspace` 自动重新生成，请勿手工修改。

> 生成时间 / Generated at: **2026-09-27T14:58:29.211Z** · 数据源 / Source: `workspace.graph.json` · 项目数 / Projects: **37**

## 项目清单 / Project Roster

| 项目 ID | 分区 | 一句话描述 | 入口文件 | 状态 |
| --- | --- | --- | --- | --- |

### `foundation/` (13)

| `axi-apps` | `foundation（共享基础）` | This directory is the canonical **Axi Applications** (PRD-06 AXI Applications). | `AGENTS.md` | `usable` |
| `axi-sync` | `foundation（共享基础）` | This directory is the canonical **Axi Change Sync** (PRD-04 Change Sync). | `AGENTS.md` | `usable` |
| `axi-runtime` | `foundation（共享基础）` | This directory is the canonical **Axi Governance Runtime** (PRD-05 Rule/Skill/Agent Runtime). | `AGENTS.md` | `usable` |
| `axi-inbox` | `foundation（共享基础）` | This directory is the canonical **Axi Inbox** (PRD-03 Resource Inbox). | `AGENTS.md` | `usable` |
| `axi-kernel` | `foundation（共享基础）` | The canonical Python implementation of the AXI Personal OS **Kernel** (PRD-01, Phase 0). | `AGENTS.md` | `usable` |
| `axi-registry` | `foundation（共享基础）` | This file governs work under `/Volumes/code/workspace/foundation/axi-registry`. Read it before editing files in this root. | `AGENTS.md` | `usable` |
| `axi-notify` | `foundation（共享基础）` | > 本文件是 **Axi Notify 仓库根级** AGENTS，是进入本仓库的 agent 第一站。 > `axi-notify` 是 **zh-primary** 项目：本文件（中文）为权威源；英文镜像见 [`AGENTS.en.md`](AGENTS.en.md)。 > 任何对 `android-app/`… | `AGENTS.md` | `usable` |
| `axi-observability` | `foundation（共享基础）` | `foundation/axi-observability` 是 AXI 工作区的可观测性基础能力项目（PRD-07）。 提供工作区级日志聚合（Loki）、指标采集（Prometheus）、分布式追踪 （OpenTelemetry + Tempo）、可视化（Grafana）和共享 SDK（Python / Go /… | `AGENTS.md` | `shared-foundation` |
| `axi-workbench-cli` | `foundation（共享基础）` | This is the canonical governance CLI for the **AXI Personal OS Workbench** (PRD-02). The product repository is `axi-workbench`; this repository manages workspa… | `AGENTS.md` | `usable` |
| `axi-rules` | `foundation（共享基础）` | `axi-rules` is the first local authority for Axi agent behavior after system, developer, and direct user instructions. It is the workspace agent-read rule and… | `AGENTS.md` | `shared-rule-index` |
| `axi-skills` | `foundation（共享基础）` | This repository is the version-controlled source for skills shared by Codex, Claude, Cursor, MiniMax, and other compatible agents. | `AGENTS.md` | `usable` |
| `axi-ui` | `foundation（共享基础）` | This file governs work under `/Volumes/code/workspace/foundation/axi-ui`. Read it before editing files in this root. This is a workspace-owned root unless a ne… | `AGENTS.md` | `usable` |
| `workspace-governance` | `foundation（共享基础）` | This file governs work under `/Volumes/code/workspace/foundation/workspace-governance`. Read it before editing files in this root. | `AGENTS.md` | `usable` |

### `workbench/` (5)

| `axi-coder` | `workbench（工作台）` | This guide governs the nested Axi Coder application at `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`. The parent rules in `../../AGENTS.md` a… | `AGENTS.md` | `usable` |
| `axi-image-preview` | `workbench（工作台）` | > 本文件是 **Axi Image Preview 仓库根级** AGENTS，是进入本仓库的 agent 第一站。 > 内部实现与组件边界详见 [`AGENTS.zh-CN.md`](AGENTS.zh-CN.md)（中文版）与 `AGENTS.md`（英文原版）。 > **两者的关系：根级 AGENTS = 项… | `AGENTS.md` | `complete` |
| `axi-coder` | `workbench（工作台）` | This guide governs the nested Axi Coder application at `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`. The parent rules in `../../AGENTS.md` a… | `AGENTS.md` | `usable` |
| `axi-pet-desktop` | `workbench（工作台）` | > 本文件是 `/Volumes/code/workspace/workbench/axi-pet-desktop` 仓库的**根级** AGENTS。 > 本仓库是从 `axi-pet` (`../axi-pet`) 完整剥离出的独立 Electron 桌面应用 monorepo,完全独立维护,不与上游 `axi-… | `AGENTS.md` | `usable` |
| `axi-workbench` | `workbench（工作台）` | > 本文件是 **Axi Workbench 仓库根级** AGENTS，是进入本仓库的 agent 第一站。 > 工作台下的应用（`apps/*`）、服务（`services/*`）、共享包（`packages/*`）、工具（`tools/axi-app-cli/`）均有各自的子级 `AGENTS.md`；本文件不… | `AGENTS.md` | `building` |

### `products/` (3)

| `axi-soul-world` | `products（独立产品）` | This guide covers the canonical Axi Soul World product at `/Volumes/code/workspace/products/axi-soul-world`. The product owns the core backend, the local-first… | `AGENTS.md` | `verified` |
| `ielts-vocab` | `products（独立产品）` | > Added 2026-06-03 after a real failure on `products/ielts-vocab`: the agent completed a 13-commit `git-commit-batch` cycle, then listed four "next step" optio… | `AGENTS.md` | `product` |
| `story-graph` | `products（独立产品）` | This guide covers the canonical `story-graph` project at `/Volumes/code/workspace/products/story-graph`. It is an evidence-driven local novel relationship grap… | `AGENTS.md` | `usable` |

### `candidates/` (2)

| `pelagic` | `candidates（候选项目）` | Pelagic is an independently released WebGL visual experiment for procedural ocean, sky, weather, and time rendering. | `AGENTS.md` | `standalone-candidate` |
| `voice-assistant-on-device-speech-recognition` | `candidates（候选项目）` | On-device streaming Mandarin speech recognition plus a locally hosted reply model and TTS for the Voice Assistant surface. Registered under `candidates/` on 20… | `AGENTS.md` | `prototype` |

### `distributions/` (3)

| `axi-workbench-desktop` | `distributions（分发产物）` | Tauri 2 desktop application wrapping the Axi Workbench web UI for native macOS experience. | `README.md` | `usable` |
| `axi-workbench-mobile` | `distributions（分发产物）` | Mobile 分发的独立仓库，包含 Axi Workbench Mobile 应用及其依赖。 | `README.md` | `usable` |
| `axi-workbench-web` | `distributions（分发产物）` | Standalone monorepo for Axi Workbench web application deployment. | `README.md` | `usable` |

### `tools/` (1)

| `axi-video-downloader` | `tools（本地工具）` | > Root-level agent rules for `tools/axi-video-downloader`. This file is > the first stop for any agent entering the repository. Read in order: > this file → `R… | `AGENTS.md` | `personal-video-processing-tool` |

### `references/` (7)

| `blinko` | `references（外部参考）` | This file governs work under `/Volumes/code/workspace/references/blinko`. Read it before editing files in this root. | `AGENTS.md` | `legacy-reference` |
| `cockpit-tools` | `references（外部参考）` | This file governs work under `/Volumes/code/workspace/references/cockpit-tools`. Read it before editing files in this root. | `AGENTS.md` | `legacy-reference` |
| `comfyui` | `references（外部参考）` | This file governs work under `/Volumes/code/workspace/references/comfyui`. Read it before editing files in this root. | `AGENTS.md` | `legacy-reference` |
| `dbskill` | `references（外部参考）` | DBSkill is a **commercial diagnosis toolkit** providing 21 Agent skills for business analysis, content creation, decision-making, and learning. Extracted from… | `AGENTS.md` | `legacy-reference` |
| `image2prompt` | `references（外部参考）` | This file governs work under `/Volumes/code/workspace/references/image2prompt`. Read it before editing files in this root. | `AGENTS.md` | `legacy-reference` |
| `opencodex` | `references（外部参考）` | <!-- OpenCodex project instructions --> | `AGENTS.md` | `legacy-reference` |
| `sub2api` | `references（外部参考）` | This file governs work under `/Volumes/code/workspace/references/sub2api`. Read it before editing files in this root. | `AGENTS.md` | `legacy-reference` |

### `archive/` (1)

| `axi-sports-management-app` | `archive（已归档）` | > Root-level agent rules for `archive/axi-sports-management-app`. This > file is the first stop for any agent entering the repository. Read in > order: this fi… | `AGENTS.md` | `sports-fullstack-app` |

### `agent-cluster/` (2)

| `axi-agent` | `agent-cluster（代理集群）` | > 本文件是 **`/Volumes/code/workspace/agent-cluster/axi-agent-platform` 仓库根级** AGENTS，是进入本仓库的 agent 第一站。 > 子模块（后端、前端、`infra/axi-agent-mcp`、升级方案镜像）的内部约束在各自的目录文件里，详见… | `AGENTS.md` | `active-development` |
| `axi-feishu-codex-bridge` | `agent-cluster（代理集群）` | This project owns the source code for the local Feishu IM to Codex bridge. Runtime state is outside source control. | `AGENTS.md` | `axi-agent-support-tool` |

## 备注 / Notes

- 工作区索引源：`WORKSPACE_INDEX.md`（工作区根）。机器可读注册表：`workspace.graph.json`。
- 修改 `WORKSPACE_INDEX.md` 或调整项目根目录后，请重新运行 `pnpm sync:workspace`。
- 本文件由脚本生成，请勿手工编辑。
