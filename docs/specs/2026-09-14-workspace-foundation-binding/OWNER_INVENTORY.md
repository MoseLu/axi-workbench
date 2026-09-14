# 基础项目 Owner 清单

> 创建日期：2026-09-14
> 来源：workspace.graph.json remediation 审计
> 维护方：axi-workbench 专项（实际补齐由治理项目执行）

## 目标项目 Owner 状态

| 项目 | graph 中的 remediation_status | remediation_owner | Owner 来源分析 |
|------|------------------------------|------------------|---------------|
| `axi-workbench` | blocked | null | AGENTS.md 声明为"Axi 工作台大项目的权威 owner"，但未在 graph 中声明具体 functionalOwner/backupOwner |
| `axi-agent-platform` | blocked | null | AGENTS.md 无 owner 声明 |
| `axi-notify` | blocked | null | README.md 提到由 `mosscoder` 迁移为 Axi 第一波 owner，AGENTS.md 无 owner 声明 |
| `axi-image-preview` | blocked | null | AGENTS.md/README.md 无 owner 声明 |
| `axi-rules` | blocked | null | AGENTS.md 无 owner 声明 |
| `axi-skills` | blocked | null | AGENTS.md 无 owner 声明 |
| `axi-registry` | blocked | null | README.md 无 owner 声明 |
| `axi-workspace-governance` | **supported** | `"AxiomaticWorld workspace owner"` | graph 中已有 |
| `axi-ui` | blocked | null | AGENTS.md 无 owner 声明 |
| `axi-docs` | blocked | null | AGENTS.md 无 owner 声明 |

## Owner 命名参考

以下是在 workspace.graph.json 中已出现的 Owner 值：

| Owner 值 | 出现的项目 |
|----------|-----------|
| `axi-workbench` | codex-app-projects.eventSources[0] |
| `Axi Core Projects` | axi-coder, axi-model-gateway, axiom-docs (3个), axiom-accounts |
| `Axi Resources` | axiom-rules |
| `AxiomaticWorld workspace owner` | axi-workspace-governance |

## 后续行动

1. **由治理项目执行**：`workspace-project onboard <project-id>` 流程会要求补充 functionalOwner 和 backupOwner
2. Owner 值应使用上述已定义值或新声明的标准 Owner 标识
3. 补齐后执行 `workspace-project handoff-check <project-id>` 验证 remediation 状态变为 `supported`

## 参考文件

- Graph 源：`/Volumes/code/workspace/workspace.graph.json`
- 各项目 AGENTS.md / README.md（见上方 Owner 来源分析）
