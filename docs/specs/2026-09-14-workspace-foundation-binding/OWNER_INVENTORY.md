# 基础项目 Owner 清单

> 创建日期：2026-09-14
> 更新日期：2026-09-14（Owner 补全）
> 来源：workspace.graph.json remediation 审计
> 维护方：axi-workbench 专项

## 目标项目 Owner 状态（已补全）

| 项目 | graph remediation_status | remediation_owner | Owner 来源 |
|------|-------------------------|-------------------|------------|
| `axi-workbench` | supported | libu | workspace.json registry |
| `axi-agent` | supported | libu | workspace.json registry |
| `axi-notify` | supported | hubu | workspace.json registry |
| `axi-image-preview` | supported | libu | workspace.json registry |
| `axi-pet` | supported | libu | workspace.json registry |
| `axi-pet-desktop` | supported | libu | workspace.json registry |
| `axi-rules` | supported | libu | workspace.json registry |
| `axi-skills` | supported | libu | workspace.json registry |
| `axi-registry` | supported | libu | workspace.json registry |
| `axi-workspace-governance` | supported | AxiomaticWorld workspace owner | graph 原生 |
| `axi-ui` | supported | libu | workspace.json registry |
| `axi-docs` | supported | libu | workspace.json registry |
| `axi-coder` | supported | Axi Core Projects | graph 原生 |
| `axi-model-gateway` | supported | Axi Core Projects | graph 原生 |
| `axi-accounts` | supported | Axi Resources | graph 原生 |
| `axi-proxy-companion` | supported | libu | workspace.json registry |
| `axi-video-downloader` | supported | libu | workspace.json registry |
| `axi-feishu-codex-bridge` | supported | libu | workspace.json registry |
| `axi-tauri-starter` | supported | libu | workspace.json registry |
| `axi-artboard` | supported | libu | workspace.json registry |
| `ielts-vocab` | supported | libu | workspace.json registry |
| `story-graph` | supported | Mose | workspace.json registry |
| `ai-resource-orchestration` | supported | libu | workspace.json registry |
| `axi-soul-world` | supported | Mose | workspace.json registry |

## 产品/工具类项目

| 项目 | graph remediation_status | remediation_owner | Owner 来源 |
|------|-------------------------|-------------------|------------|
| `axi-workbench-web-dist` | supported | Axi Core Projects | graph 原生 |
| `axi-workbench-mobile-dist` | supported | Axi Core Projects | graph 原生 |
| `axi-workbench-desktop-dist` | supported | Axi Core Projects | graph 原生 |
| `dbskill` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `sub2api` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `cliproxyapi` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `image2prompt` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `opencodex` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `cockpit-tools` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `blinko` | supported | AxiomaticWorld workspace owner | legacy-reference |
| `comfyui` | supported | AxiomaticWorld workspace owner | legacy-reference |

## Owner 命名规范

| Owner 值 | 使用场景 |
|----------|----------|
| `libu` | Axi 核心产品/项目 owner |
| `hubu` | Axi 核心产品 owner（axi-notify） |
| `Mose` | 个人项目 owner |
| `Axi Core Projects` | Axi Coder 相关组件 |
| `Axi Resources` | Axi 共享资源合约 |
| `AxiomaticWorld workspace owner` | 工作区级基础设施/legacy-reference |

## 执行结果

**P0-1 任务已完成：**
- 所有 27 个 axiom-* 相关项目的 `remediation_status` 已从 `blocked` 变更为 `supported`
- `missing_owner` blocker 已全部清除
- `remediation_owner` 字段已从 `null` 补充为具体 owner 值
- 同步更新了 `remediation_reason`（从 missing_owner 变更为 has_owner_and_verify）
- 为每个项目添加了 `remediation_inputSchema`、`remediation_timeoutMs`、`remediation_rollbackStrategy` 字段

## 参考文件

- Graph 源：`/Volumes/code/workspace/workspace.graph.json`
- Registry 源：`/Volumes/code/workspace/infra/axi-workspace-governance/workspace.json`
