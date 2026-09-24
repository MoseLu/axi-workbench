---
id: reference-axi-workspace-repo-topology
title: Axi Workspace Repo Topology
type: reference
status: evergreen
tags: [workspace, topology, architecture]
created: 2026-09-24
modified: 2026-09-24
agent-readable: true
---

# Axi Workspace Repo Topology

最后生成：2026-09-24

## 控制面

| Component | Path | Role |
|---|---|---|
| workspace container | `/Volumes/code/workspace` | 非 Git 仓库；只承载项目目录、参考目录、生成快照和 launcher shim |
| workspace incubator | `/Volumes/code/workspace/incubator` | 未完成 idea / PRD / prototype 的非项目验证区；不进入 project graph |
| workspace.json | `/Volumes/code/workspace/infra/axi-workspace-governance/workspace.json` | 权威治理清单 |
| registry | `/Volumes/code/workspace/infra/axi-workspace-governance/.workspace/registry.json` | 生成式注册表 |
| docs source | `/Volumes/code/workspace/infra/axi-workspace-governance/docs` | 权威索引文档目录 |
| axi-docs source | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance` | Axi Docs 镜像入口 |

## 工作区根目录契约

- `/Volumes/code/workspace` 不是 monorepo、代码仓库、提交单元或项目 handoff 目标。
- 根层文件用于导航、生成快照、workspace graph、dev services 和 agent guidance。
- `workspace-anchor`、`workspace.graph.json`、`dev-services.config.json` 等资源按工作区资源治理，不按普通项目文档套件计分。

## Infra

- `../../infra/axi-registry` | Axi Local Registry | branch=`dev` | canonical=yes | compliance=`node-single-repo`
  remote: https://github.com/axiomaticworld/axi-registry.git
- `C:\Users\12081\.openclaw` | OpenClaw Gateway | branch=`-` | canonical=yes | compliance=`external-infra`
  remote: https://github.com/axiomaticworld/openclaw-gateway

## Projects

- `../../projects/axi-apps` | Axi Applications | branch=`-` | canonical=yes | compliance=`axi-apps`
- `../../projects/axi-docs` | Axi Docs | branch=`-` | canonical=no | compliance=`generated-docs-companion`
  remote: https://github.com/MoseLu/axi-workbench.git
- `../../projects/axi-image-preview` | Axi Image Preview | branch=`dev` | canonical=yes | compliance=`node-single-repo`
  remote: https://github.com/MoseLu/axi-image-preview.git
- `../../projects/axi-inbox` | Axi Inbox | branch=`-` | canonical=yes | compliance=`axi-inbox`
- `../../projects/axi-kernel` | Axi Kernel | branch=`dev` | canonical=yes | compliance=`object-registry`
  remote: https://github.com/MoseLu/axi-kernel.git
- `../../projects/axi-notify` | Axi Notify | branch=`dev` | canonical=yes | compliance=`android-fullstack`
  remote: https://github.com/MoseLu/axi-notify.git
- `../../projects/axi-pet` | Axi Pet | branch=`dev` | canonical=yes | compliance=`node-monorepo-approved`
  remote: https://github.com/moeru-ai/airi.git
  upstream: https://github.com/moeru-ai/airi.git
- `../../projects/axi-pet-desktop` | Axi Pet Desktop | branch=`dev` | canonical=yes | compliance=`node-monorepo-approved`
  remote: https://github.com/moeru-ai/airi.git
- `../../projects/axi-runtime` | Axi Governance Runtime | branch=`dev` | canonical=yes | compliance=`axi-runtime`
  remote: https://github.com/MoseLu/axi-runtime.git
- `../../projects/axi-sports-management-app` | 体育管理应用 | branch=`dev` | canonical=yes | compliance=`polyrepo-mixed-stack`
  remote: https://github.com/MoseLu/axi-sports-management-app.git
- `../../projects/axi-sync` | Axi Change Sync | branch=`dev` | canonical=yes | compliance=`axi-sync`
- `../../projects/axi-workbench` | Axi Workbench | branch=`dev` | canonical=yes | compliance=`node-monorepo-approved`
  remote: https://github.com/MoseLu/axi-workbench.git
- `../../projects/axi-workbench-cli` | AXI Personal OS Workbench CLI | branch=`dev` | canonical=yes | compliance=`personal-os-cli`
  remote: https://github.com/MoseLu/axi-workbench-cli.git

## Products

- `../../products/axi-soul-world` | Axi Soul World | branch=`lane-c/web-admin-resource-search` | canonical=yes | compliance=`android-fullstack`
  remote: https://github.com/MoseLu/Axi-Soul-World.git
- `../../products/ielts-vocab` | IELTS Vocabulary | branch=`dev` | canonical=yes | compliance=`node-monorepo-approved`
  remote: https://github.com/MoseLu/ielts-vocab.git
- `../../products/story-graph` | Story Graph | branch=`dev` | canonical=yes | compliance=`node-monorepo-approved`
  remote: https://github.com/MoseLu/story-graph.git

## Shared

- `../../projects/axi-rules` | Axi Rules | branch=`dev` | canonical=yes | compliance=`constraint-index`
  remote: https://github.com/MoseLu/axi-rules.git
- `../../shared/axi-skills` | Axi Skills | branch=`dev` | canonical=yes | compliance=`agent-skill-catalog`
  remote: https://github.com/MoseLu/axi-skills.git
- `../../shared/axi-tauri-starter` | Axi Tauri Starter | branch=`dev` | canonical=yes | compliance=`template-reference`
  remote: https://github.com/MoseLu/axi-tauri-starter.git
- `../../shared/axi-ui` | Axi UI | branch=`dev` | canonical=yes | compliance=`node-monorepo-approved`
  remote: https://github.com/MoseLu/axi-ui.git

## Tools

- `../../tools/axi-feishu-codex-bridge` | Axi Feishu Codex Bridge | branch=`dev` | canonical=yes | compliance=`python-tool-local-runtime`
  remote: https://github.com/MoseLu/axi-feishu-codex-bridge.git

## 已批准项目级 Monorepo

- `../../projects/axi-workbench`
- `../../projects/axi-pet`
- `../../products/ielts-vocab`
- `../../shared/axi-ui`
- `../../products/story-graph`
