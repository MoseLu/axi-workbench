# docs/axi — AxiomaticWorld 工作区级契约与归档

> 本目录是工作区**根级**的 Axi 契约与历史决策归档。
> 它**不**归 `axi-docs` App 拥有（`axi-docs` 已于 2026-09-24 ADR-008 absorbed 进 `workbench/axi-workbench/apps/axi-docs/`，原独立 `projects/axi-docs` 路径不存在），**也不**被 `axi-docs` 的 source registry 自动 ingestion。
> `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/` 是来自 `foundation/workspace-governance/` 的**只读镜像**，是另一回事。

## 阅读顺序

1. `AXIOMATICWORLD_NAMING.md` — 品牌、命名、组织层级（任何其他文档的前置阅读）
2. `contracts/` — 跨项目共享 schema / 接口契约（**正在工作的契约**）
3. `merge-plans/` — 历史合并方案与决策快照（**已完成归档**）
4. `adr/` — 未来需要新建的架构决策记录（占位）

## 目录索引

### 根级

| 文件 | 性质 | 何时阅读 |
|---|---|---|
| `AXIOMATICWORLD_NAMING.md` | 命名 / 品牌 / 组织层级 | 必读 |
| `AXIOMATICWORLD_NAMING.zh-CN.md` | 命名 / 品牌的中文镜像主源 | 必读（中文读者） |

### `contracts/` — 共享契约（活跃）

| 文件 | 范围 | 状态 |
|---|---|---|
| `AI_CAPABILITY_CONTRACT.md` | AI 能力层（ASR/Vision/OCR/LLM/生成/向量）契约 | 活跃 |
| `OLLAMA_LOCAL_CONTRACT.md` | Ollama 本地模型供应商契约 | 活跃 |
| `MINIMAX_TOKENPLAN_CONTRACT.md` | MiniMax 云端能力 CLI 契约 | 活跃 |
| `AXI_ACCOUNTS_SHARED_SCHEMA.md` | 账号、凭据引用、配额、唤醒任务 schema | 草案 |

**新增合约的归属判断**：被 2+ Axi 项目直接 import / 引用的 schema、共享字典、跨项目接口 → 入 `contracts/`。

### `merge-plans/` — 历史合并方案与决策（归档）

| 文件 | 时间 | 范围 |
|---|---|---|
| `AXI_FUNCTION_MERGE_TODO.md` | 2026-05-25（5-27 更新） | 工作区所有 Axi-owned active roots 的合并 TODO |
| `AXI_ACCOUNTS_MERGE_PLAN.md` | 2026-05-25 | Accounts 域合并方案 |
| `AXI_AGENT_MERGE_PLAN.md` | 2026-05-25 | Agent 域合并方案 |
| `AXI_DASHBOARD_CONSOLIDATION.md` | 2026-05-26 | Dashboard 单一入口决策 |

**性质**：这些是合并完成前的**历史决策快照**，不应当被原地更新。
合并完成后的进展在 `docs/ROADMAP.md`（季度投影）和各项目自己的 CHANGELOG。

### `adr/` — 架构决策记录

占位目录。**未来**遇到本工作区范围（≥ 2 个 Axi 项目）的非平凡技术决策时，按
[`adr/README.md`](adr/README.md) 的模板新建 `0001-<slug>.md`、`0002-<slug>.md` 编号。
**与 merge-plans 的区别**：`merge-plans/` 是已经发生过的合并/整合决策；`adr/` 是面向
未来、可能影响工作区结构的决策。

## 与其他文档的关系

| 引用方 | 引用的本目录文件 | 处理 |
|---|---|---|
| `WORKSPACE_INDEX.md` / `AGENTS.md` | `AXIOMATICWORLD_NAMING.md` | 根级，路径不变 |
| `workspace.graph.json` (`axi-accounts` 节点) | `contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md`、`merge-plans/AXI_ACCOUNTS_MERGE_PLAN.md` | 强契约，必须同步 |
| `docs/ROADMAP.md` | `merge-plans/AXI_FUNCTION_MERGE_TODO.md` | 季度投影源 |
| `docs/audit/workspace-i18n-*.md`、`workspace-docs-gap-audit-2026-06-07.md` | 历史 `docs/axi/...` 路径 | **不改**——历史审计报告是冻结快照 |
| `foundation/workspace-governance/CHANGELOG.md` | 历史 `docs/axi/...` 路径 | **不改**——历史 CHANGELOG 是冻结 |
| `workbench/axi-workbench/apps/devsvc-dashboard/config/axi-resources.json` | `ownerPath: docs/axi` | **不动**——目录入口路径不变 |

## 本地规则

- 文件名保持现状（`AXI_*.md`）。当一份文档**实质上**不再属于 Axi 命名空间（例如改名为通用 workspace 文档）时，搬到 `docs/` 根级而非保留前缀。
- `contracts/` 内的文档被改时，必须同步更新 `workspace.graph.json` 和 `docs/AGENTS.md` Key Files。
- `merge-plans/` 内的文档**禁止原地更新**。新的进展去 `docs/ROADMAP.md` 或新建 ADR。
- `adr/` 内的文档必须按编号顺序，文件名 `NNNN-<kebab-case-slug>.md`。

## 验证

- `test -f docs/axi/AXIOMATICWORLD_NAMING.md`
- `test -f docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md`
- `test -f docs/axi/merge-plans/AXI_FUNCTION_MERGE_TODO.md`
- `test -f docs/axi/merge-plans/AXI_ACCOUNTS_MERGE_PLAN.md`
- `test -f docs/axi/merge-plans/AXI_AGENT_MERGE_PLAN.md`
- `test -f docs/axi/merge-plans/AXI_DASHBOARD_CONSOLIDATION.md`
- `workspace-project validate`
