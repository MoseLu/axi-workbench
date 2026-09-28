# PRD 中心 — 工作区产品需求文档单一入口

> 这里是整个 `/Volumes/code/workspace` 的 **PRD 地图与单一入口**。
> 当你（几周后的自己，或一个全新的 AI agent）需要回忆"造了什么、为什么这么设计、边界在哪"时，**从这里开始**。
> 体系规则（怎么写、怎么编号、何时更新）见 [`00-PRD-SYSTEM-GUIDE.md`](./00-PRD-SYSTEM-GUIDE.md)。

---

## 1. 我想……（按意图快速跳转）

| 我想…… | 看这里 |
|---|---|
| 10 分钟理解整个工作区是什么、怎么分层 | [`01-AxiomaticWorld-Personal-OS-PRD.md`](./01-AxiomaticWorld-Personal-OS-PRD.md) §0–§5 |
| 回忆某个子项目的定位与边界 | 总纲 §8 **子项目设计快照全景** |
| 搞清楚"当初为什么选这个方案" | 总纲 §9 + 对应 **ADR**（见下方 §5） |
| 看现在做到哪了、下一步 | 总纲 §10 + 各项目 `docs/HANDOFF.md` |
| 看方向 / 路线图 | 总纲 §11 + `docs/ROADMAP.md` |
| 给新项目写 PRD | [`templates/PROJECT-PRD-TEMPLATE.md`](./templates/PROJECT-PRD-TEMPLATE.md) |
| 规划一次迭代 / 特性 | [`templates/SPRINT-PRD-TEMPLATE.md`](./templates/SPRINT-PRD-TEMPLATE.md) |
| 约束 agent 不自由发挥（UI / 依赖 / 边界契约） | [`02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md`](./02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md) |
| 了解文档该怎么管 / 何时必须更新 | [`00-PRD-SYSTEM-GUIDE.md`](./00-PRD-SYSTEM-GUIDE.md) §5 |

---

## 2. 接手阅读顺序（zero-context onboarding）

1. 本文件（建立地图）。
2. [`01-...PRD.md`](./01-AxiomaticWorld-Personal-OS-PRD.md) §0 定位、§5 架构、§8 子项目快照。
3. 目标项目的 `AGENTS.md` → `README.md` → `docs/HANDOFF.md`。
4. 涉及边界 / Schema 决策时读对应 ADR。
5. 按 `AGENTS.md` 跑 handoff 链：`workspace-project validate` → `whereami` → `onboard` → `handoff-check`。

> 目标：10 分钟内重建设计上下文，而不是重新通读代码。

---

## 3. 四层文档体系

```text
L0 平台总纲 ……… docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md（1 份）
L1 产品线 PRD …… 复杂时独立成文，当前并入 L0
L2 项目 PRD ……… 各项目仓库内 PRD.md（见 §4 总表）
L3 迭代 PRD ……… 项目内 docs/sprints/，轻量、完成后归档
元规范 ………… docs/prd/00-PRD-SYSTEM-GUIDE.md
模板 …………… docs/prd/templates/
```

---

## 4. PRD 总表

### 4.1 工作区 PRD 中心（本目录）

| 文档 | 编号 | 层级 | 状态 | 最后更新 |
|---|---|---|---|---|
| [PRD 体系宪章](./00-PRD-SYSTEM-GUIDE.md) | PRD-GUIDE-00 | 元规范 | Active | 2026-09-27 |
| [平台总纲](./01-AxiomaticWorld-Personal-OS-PRD.md) | PRD-01（平台） | L0 | Active | 2026-09-25 |
| [契约与约束治理](./02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md) | PRD-02（契约） | 治理 | Active | 2026-09-25 |
| [项目级模板 v1.1](./templates/PROJECT-PRD-TEMPLATE.md) | — | 模板 | v1.1 Active | 2026-09-27 |
| [迭代级模板](./templates/SPRINT-PRD-TEMPLATE.md) | — | 模板 | — | 2026-09-25 |

### 4.2 项目内 PRD（L2，按分区）

| 项目 | PRD 位置 | 状态 | 最后更新 | 备注 |
|---|---|---|---|---|
| Axi Workbench | [workbench/axi-workbench/PRD.md](../../workbench/axi-workbench/PRD.md) | Active | 2026-09-20 | 根为 stub，权威在 `docs/state/PRD.md` |
| Axi Pet Desktop | [workbench/axi-pet-desktop/PRD.md](../../workbench/axi-pet-desktop/PRD.md) | Active | 2026-09-24 | |
| Axi Agent | [agent-cluster/axi-agent/docs/PRD.md](../../agent-cluster/axi-agent/docs/PRD.md) | Active | 2026-09-17 | 英文，FR/AC 结构 |
| Axi Rules | [foundation/axi-rules/PRD.md](../../foundation/axi-rules/PRD.md) | Active | 2026-09-24 | |
| Axi UI | [foundation/axi-ui/PRD.md](../../foundation/axi-ui/PRD.md) | Active | 2026-09-24 | |
| Axi Registry | [foundation/axi-registry/PRD.md](../../foundation/axi-registry/PRD.md) | Active | 2026-09-24 | |
| Axi Skills | [foundation/axi-skills/docs/PRD.md](../../foundation/axi-skills/docs/PRD.md) | Active | 2026-08-22 | |
| Axi Soul World | [products/axi-soul-world/PRD.md](../../products/axi-soul-world/PRD.md) | Active | 2026-09-24 | |
| Story Graph（专题 1） | [products/story-graph/PRD_时间线叙事人物关系图谱.md](../../products/story-graph/PRD_时间线叙事人物关系图谱.md) | Active | 2026-08-05 | 专题 PRD |
| Story Graph（专题 2） | [products/story-graph/PRD_MINIMAX_人物关系图谱完善.md](../../products/story-graph/PRD_MINIMAX_人物关系图谱完善.md) | Active | 2026-08-05 | 专题 PRD |
| Voice Assistant | [candidates/voice-assistant-on-device-speech-recognition/PRD.md](../../candidates/voice-assistant-on-device-speech-recognition/PRD.md) | Active (candidate, maturity-v1 pending) | 2026-09-25 | *归属决策已落地：2026-09-25 从 `products/` 搬至 `candidates/`；maturity-v1 评审进行中（见总纲 §8.4） |
| 桌面自动化（孵化） | [incubator/desktop-automation-voice-computer-use-agent/PRD.md](../../incubator/desktop-automation-voice-computer-use-agent/PRD.md) | Draft | 2026-09-24 | 非项目孵化 |

### 4.3 L2 PRD 补齐状态

> 2026-09-25 整改：12 个 stub PRD 全部升级为正式 PRD；本节移除历史"待补齐"清单与 `axi-video-downloader`（已存在 `docs/state/PRD.md`）。

| 编号 | 项目路径 | PRD 状态 | 备注 |
|---|---|---|---|
| PRD-01 | `foundation/axi-kernel` | Active | 2026-09-25 升级 |
| PRD-02 | `foundation/axi-workbench-cli` | Active | 2026-09-25 升级 |
| PRD-03 | `foundation/axi-inbox` | Active | 2026-09-25 升级 |
| PRD-04 | `foundation/axi-sync` | Active | 2026-09-25 升级 |
| PRD-05 | `foundation/axi-runtime` | Active | 2026-09-25 升级 |
| PRD-06 | `foundation/axi-apps` | Active | 2026-09-25 升级 |
| PRD-07 | `foundation/axi-observability` | Active | 2026-09-25 升级 |
| — | `foundation/axi-notify` | Active | 2026-09-25 升级 |
| — | `workbench/axi-image-preview` | Active（complete） | 2026-09-25 升级 |
| — | `products/ielts-vocab` | Active（promoted） | 2026-09-25 升级 |
| — | `products/story-graph` | Active | 2026-09-25 升级；另有专题 PRD 1 / PRD 2 |
| — | `candidates/pelagic` | Active | 2026-09-25 升级 |

> 补齐方式（今后新增项目适用）：复制项目级模板 → 以总纲 §8 快照为骨架 → 对照代码与 HANDOFF 填实 → 回填本表。

### 4.4 v1.1 模板试点与迁移进度

> 自 2026-09-27 起 L2 PRD 进入**结构化继承** PROJECT-PRD-TEMPLATE.md v1.1。规则：`foundation/axi-rules/rules/prd-format/AGENTS.md`（AR-PRD-FORMAT-001..005）。截至 2026-09-27 已升级 8 份；其余 L2 PRD 进入 30 天迁移窗口（AR-PRD-FORMAT-005，截止 2026-10-27）。

| PRD | 模板版本 | 升级日期 | 形态 / 备注 |
|---|---|---|---|
| PRD-01 `foundation/axi-kernel/PRD.md` | v1.1 | 2026-09-27 | 共享提供者（6 模块 + 自有 v7 schema） |
| PRD-02 `foundation/axi-workbench-cli/PRD.md` | v1.1 | 2026-09-27 | CLI 入口（4 模块 + sys.path 注入 + 8 项 health） |
| PRD-03 `foundation/axi-inbox/PRD.md` | v1.1 | 2026-09-27 | 多模块 + 侧存 + 6 态状态机 |
| PRD-04 `foundation/axi-sync/PRD.md` | v1.1 | 2026-09-27 | 消费侧 + 4 模块 + 7 态 queue |
| PRD-05 `foundation/axi-runtime/PRD.md` | v1.1 | 2026-09-27 | 6 模块 + v6 schema 4 类型 + 3R/3S/1A 默认种 |
| PRD-06 `foundation/axi-apps/PRD.md` | v1.1 | 2026-09-27 | 多 CLI 汇聚 + 3 子 CLI 投影层 |
| PRD-07 `foundation/axi-observability/PRD.md` | v1.1 | 2026-09-27 | 5 SDK + 5 容器 + 8 件控制组件 |
| PRD-RULES `foundation/axi-rules/PRD.md` | v1.1 | 2026-09-27 | 13 category + ≥ 50 AR 规则（含 self-reference） |
| 其余 ~10 份 L2 PRD | v1.0 | 待迁移 | 30 天窗口；优先 `axi-registry` / `axi-ui` / `axi-skills` / `axi-notify` |

**机器校验**：

```bash
# 验证某份 PRD 已继承 v1.1（继承声明 + 分层理念 + 量化锚点 + 收口 FR）
grep -E "^(> template_version: v1\.1|> inherits: )" <project>/PRD.md
grep -E "^## 2\. 分层理念" <project>/PRD.md
grep -E "^\| FR-[0-9]+ .*(整合|≥|ADR-|v[0-9]|exit [0-9])" <project>/PRD.md

# 工作区级未迁移清单
grep -rL 'template_version: v1\.1' /Volumes/code/workspace/foundation /Volumes/code/workspace/workbench \
  /Volumes/code/workspace/products /Volumes/code/workspace/candidates --include='PRD.md'
```

---

## 5. 架构决策记录（ADR）索引

- **工作区级 ADR 权威目录**：`foundation/workspace-governance/docs/adr/`（ADR-001 ~ ADR-010）。
- 速览见总纲 §9。最常被引用：**ADR-008 Personal OS 仓库拓扑与边界冻结**、ADR-003 工作区根非 Git 容器、ADR-007 命名别名契约。
- 项目内部决策放项目内 `docs/adr/`。
- ADR 只追加；推翻旧决策 = 新增 ADR 并把旧条目标 Superseded。

### 5.1 PRD 格式规则（axi-rules 引用）

- **模块**：`foundation/axi-rules/rules/prd-format/AGENTS.md`。
- **规则 ID**：`AR-PRD-FORMAT-001` (P0) 继承声明 · `002` (P1) §2 分层理念 · `003` (P1) FR 量化锚点 · `004` (P1) 模块收口 FR · `005` (P2) 模板升版迁移。
- 适用层级：所有 L2 / L3 PRD；新写 PRD 默认按 v1.1 落，旧 PRD 进入 §4.4 迁移窗口。

---

## 6. 第三方参考 PRD（非 Axi 所有，不作为自有需求）

位于 `references/`，仅作模式参考：`cockpit-tools`、`sub2api`、`image2prompt`、`opencodex`、`blinko`、`comfyui` 等。这些**不登记**进上方自有 PRD 总表，所有权与结论不归 Axi。

---

## 7. 如何新增 / 更新一份 PRD

1. 判断层级（L0–L3），从 `templates/` 复制对应模板（**当前 L2 模板 v1.1**）。
2. L2 / L3 放项目仓库内；填写编号（规则见宪章 §3）；**文首必须保留 `template_version: v1.1` 与 `inherits:` 两行**（AR-PRD-FORMAT-001）。
3. 多模块项目必须按 §2 分层理念铺能力地图（AR-PRD-FORMAT-002），并在 §6.1 加"整合 X"收口 FR（AR-PRD-FORMAT-004）；FR 行内必须含量化锚点（AR-PRD-FORMAT-003）。
4. 完成后在本文件 §4 表登记：位置、状态、最后更新、模板版本（如已升级 v1.1 在 §4.4 同步标记）。
5. 触及边界 / Schema / 跨项目契约时，同步发 ADR 并更新 `workspace.graph.json`。
6. 状态变化（Draft→Active→Stale→Deprecated）随提交更新文首与本表。

**更新触发**：新增能力、改边界/契约、改 Schema、改验收/验证命令、promote/归档、做出不易理解的取舍、模板升版（AR-PRD-FORMAT-005 触发 30 天迁移窗口）——详见宪章 §5。

---

## 8. 维护说明

- 本中心由 solo owner 维护；每次接手 / 阶段收尾时刷新本索引的"最后更新"与状态。
- 同一条信息只在一个权威文档里写，其他地方引用，避免重复维护（职责边界见宪章 §6）。
- 凭据 / 密钥 / 个人隐私不入任何 PRD。
