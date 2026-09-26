# ADR-008: Personal OS repository topology — boundary freeze and CLI bucket correction

**Status:** Accepted on 2026-09-24.
**Decision driver:** `docs/specs/2026-09-24-workspace-entrance-spatial-graph/REMEDIATION-PLAN.md` review.
**Related ADRs:** ADR-002 (progressive repository naming policy), ADR-003 (workspace-root-is-non-git-container), ADR-007 (naming alias contract).

## Context

经过多轮治理迭代，工作区出现四类真实但可分离的混淆：

1. `axi-workbench-cli` 在 `workspace.json.distributions[]` 数组中，但其字段声明 `category=project / role=governance-tool / manages=[axi-workbench] / tier=axi-core-product`，与 distribution 分桶语义不一致；`workspace.graph.json` 同时把它放在 `projects` 关系对象中。这是事实源层的双记录。
2. 一份早期评估方案把 PRD 的产品 Phase 误读为 Git 仓库边界，主张归档 4 个已 promote 项目（`axi-inbox` / `axi-sync` / `axi-runtime` / `axi-apps`）并把它们直接移入 `axi-workbench/services/`。该方案未审计消费者、独立生命周期与回滚路径。
3. `axi-notify` 含 Android 客户端，被误读为"违反 PRD V0.1 非目标：移动端应用"。V0.1 非目标规定的是"本次不实现移动端应用"，不是"工作区禁止存在移动端项目"。
4. Workspace Entrance Spatial Graph 的早期原型（HTML + 硬编码坐标 + 静态事实）留在治理仓库 spec 下，但没有正式实现路径、事实源依赖与 owner 归属。

这四类混淆已在 2026-09-24 评审。结论：PRD phase 不等于仓库边界；Personal OS 子项目保持独立 canonical 仓库；修正 cli 注册表分桶；Spatial Graph 正式实现归位 `axi-workbench`。

### 1.1 当前 `axi-workbench-cli` 注册表不一致（pre-ADR）

```text
registry bucket: workspace.json.distributions[]
path:             ../../projects/axi-workbench-cli
category:         project
role:             governance-tool
manages:          ["axi-workbench"]
canonical:        true
tier:             axi-core-product
```

`workspace.graph.json` 已将 `axi-workbench-cli` 列为 `projects` 关系对象，分桶在事实源层是双记录。

## Decision

1. **唯一工作区入口产品**：`/Volumes/code/workspace/projects/axi-workbench`。它是 Web 门户、本地工作台入口、DevSvc Dashboard、Axi Coder、Verification Inbox 等能力的宿主。Spatial Graph 的正式实现必须落在 `axi-workbench/apps/workbench/`。
2. **治理数据平面**：`/Volumes/code/workspace/projects/axi-workbench-cli`。CLI + DOT/JSON 输出，无 web UI（per PRD-02 §5）；通过 `cli/axi_workbench/kernel_bridge.py` 在运行时挂载 PRD-01 Kernel。
3. **对象数据平面**：`/Volumes/code/workspace/projects/axi-kernel`。AXI Personal OS 的稳定内核，提供 Project / Document / Change / Resource 等对象注册。
4. **PRD Phase 不自动决定仓库合并**：Phase 2 (Resource Inbox) / Phase 3 (AI Governance) / Phase 4 (Applications) 是交付节奏，不是 Git 仓库数量。`axi-inbox` / `axi-sync` / `axi-runtime` / `axi-apps` 保留为独立 canonical 项目，是否合并必须由消费者与能力重叠审计决定（REMEDIATION-PLAN §5 WP-03）。
5. **范围外项目保留真实注册身份**：`axi-notify`（含 Android 客户端）属于 AxiomaticWorld 自营产品，不属于 Personal OS V0.1 入口实现；`axi-image-preview`、`axi-pet`、`axi-pet-desktop`、`axi-soul-world`、`ielts-vocab`、`story-graph` 等按当前分类保留，不因工作区存在被计入 V0.1 验收。
6. **Workspace Entrance Spatial Graph 不注册为独立项目**：原型归档在 `infra/axi-workspace-governance/docs/specs/2026-09-24-workspace-entrance-spatial-graph/prototype/`；正式实现归属 `axi-workbench/apps/workbench/`，节点与边必须来自 `workspace.json` + `workspace.graph.json` + Kernel adapter，HTML/JSX 不允许硬编码项目坐标或状态。
7. **`workspace.json.distributions[]` 数组中只允许包含 3 个 distribution 项目**：`axi-workbench-web-dist`、`axi-workbench-mobile-dist`、`axi-workbench-desktop-dist`。`axi-workbench-cli` 移入 `projects[]` 数组，保留所有现有字段（`canonical=true`、`category=project`、`role=governance-tool`、`manages=["axi-workbench"]`、`tier=axi-core-product` 等）。

## Consequences

- 任何对 Personal OS 子项目（`axi-inbox` / `axi-sync` / `axi-runtime` / `axi-apps`）的归档、合并、迁移必须先完成消费者与能力重叠审计，并提供迁移 / 回滚包。
- 工作区治理验证（`workspace-project validate` / `workspace-audit.mjs` / `pnpm workspace:docs:sync`）必须将 `.venv` 越界软链等既有阻塞单独记录，不能包装为"整改全绿"。
- UI 不允许复制维护项目坐标 / 关系事实；任何写入必须经过治理 CLI 或 Kernel 公共 API（per REMEDIATION-PLAN §2.2）。
- 后续 PRD 文档必须显式区分"产品层（Personal OS）"和"仓库层（polyrepo）"。
- 当前不归档、不删除、不移动任何 promote 项目；不在缺乏事实来源的情况下重命名（如 `axi-mdns` 在当前注册表中未找到对应实体，暂停处理）。

## Reference

完整整改工作包、迁移决策矩阵、提交策略、验收清单：

- `/Volumes/code/workspace/infra/axi-workspace-governance/docs/specs/2026-09-24-workspace-entrance-spatial-graph/REMEDIATION-PLAN.md`

## Cross-references

- `WORKSPACE_INDEX.md` § Core Active
- `workspace.json` § distributions / projects
- `workspace.graph.json` § projects.axi-workbench / projects.axi-workbench-cli / projects.axi-kernel
- `projects/axi-workbench/AGENTS.md` § Project Boundary
- `projects/axi-workbench-cli/AGENTS.md` § Scope / Boundaries
- `projects/axi-kernel/AGENTS.md` § What this is / What this is not