# AxiomaticWorld / AXI Personal OS 平台总纲（L0 Vision PRD）

> 文档编号：PRD-01（平台总纲）　层级：L0 愿景 / 平台 PRD
> 文档状态：Active　Owner：libu（solo owner）
> 创建：2026-09-25　最后更新：2026-09-25
> 取代：本文件是工作区内权威版本，取代工作区外的桌面文件 `~/Desktop/AXI-Personal-OS-PRD.md`（该文件停留在 V0.1 基线，建议归档或删除）
> 受众：几周/几个月后重新接手的作者本人，以及任何需要快速理解全局的 AI 协作者（Codex / Claude / agent）
> 配套：体系规则见 [`00-PRD-SYSTEM-GUIDE.md`](./00-PRD-SYSTEM-GUIDE.md)；子项目索引见 [`README.md`](./README.md)

---

## 0. 一句话定位

> **AXI Personal OS 是一个面向个人创造过程的"工作操作系统"：在保留传统文件与 Git 工程边界的前提下，叠加一层稳定的语义对象、关系与变更吸收机制，把分散的项目、文档、资源和 AI 协作组织成一个可理解、可演化、可验证的创造系统。**

- 品牌母体：**AxiomaticWorld（公理世界）**，域名 `axiomaticworld.com`，口号 *"Build your working world from first principles." / "以第一性原则，构建可验证的工作世界。"*
- `Axi` 是稳定短前缀，**任何语言下都不翻译**。
- 它**不是**"功能最多的超级 App"，**不是** monorepo，**不是**要把每个文件都对象化，也**不是**让一个常驻 Agent 接管所有文件。

### 它是什么 / 不是什么

| 它是 | 它不是 |
|---|---|
| 多仓库联邦之上的语义层 | 单一 Git 仓库 / monorepo |
| 稳定内核 + 快速应用层 | 功能堆叠的超级 App |
| 文件/Git 事实与语义认知的映射 | 替代文件系统或 Git |
| 确定性优先、Agent 按需介入 | 常驻 Agent 实时监控一切 |
| 可追踪、可解释、可恢复的同步 | 静默自动改写核心文档 |

---

## 1. 背景与要解决的系统性问题

1. 历史项目、产品、工具、基础设施、文档分散在几十处，**缺少统一认知入口**。
2. 文件目录只能表达物理位置，**不能表达**项目、资源、规则、技能之间的语义关系。
3. UI、脚手架、规则、技能重复建设，AI **缺少可执行的动态约束**。
4. 代码变化、文档变化、项目状态、注册信息**容易不同步**。
5. 直接做"超级 App"会范围失控；只做 Todo / 收藏夹 / 项目列表又会造成未来重构。
6. 让 Agent 实时理解所有变化，**成本高、不可控、易产生错误更新**。
7. （本轮新增）多轮迭代后，**作者本人会遗忘当初的设计与边界**——这正是建立本 PRD 体系的直接动因。

---

## 2. 产品目标

### 2.1 长期目标

- 建立 Axi 世界统一的**基本对象模型**。
- 让**文件世界 ↔ 认知世界**建立可追踪映射。
- 让项目、资源、规则、技能、任务、产物可关联、检索、演化。
- 让**机器负责确定性工作，Agent 负责需要理解与判断的工作**。
- 为未来的资源管理、AI Agent、社交分享、移动端提供稳定内核。

### 2.2 阶段性目标（V0.1 → 当前）

V0.1 的验证命题是：**Workbench 能否让用户更快理解、维护、推进已有项目。** 具体目标：

- 注册并扫描已有项目；展示**整个工作区地图**而非单个项目列表。
- 聚合项目健康度、最近活动、缺失文档、阻塞项。
- 建立项目关系视图；验证对象注册模型与文件位置映射。
- 产出可供同步系统消费的 Change Event / Change Object 基础数据。

当前已在 V0.1 之上继续推进到资源收件箱、变化同步、治理运行时与应用层（PRD-03 ~ PRD-06，见 §10 当前状态）。

### 2.3 非目标（明确不做）

- 社交 / 朋友圈 / 公开分享（P2）。
- 把"移动端应用"作为当前入口阶段的交付物（注意：工作区**允许存在**移动项目如 `axi-notify`，只是不计入 Personal OS 入口 V0.1 验收——见 ADR-008）。
- 完整 Todo / 日程系统；自动生成完整项目代码。
- 常驻 Agent 管理所有文件；对所有文件全面对象化。
- 未经审核自动修改 PRD、架构文档、规则、Schema。

---

## 3. 核心产品原则

1. **对象化认知，不打散文件**：文件保留传统工程结构，对象层只加语义索引与关系。
2. **先收集，再分类**：Resource Inbox 低成本收集，分类与关联延后。
3. **稳定内核，渐进应用**：先定义少量稳定对象，再长应用。
4. **事实与认知分离**：Git 记录物理变化，AXI 记录语义变化。
5. **确定性优先**：脚本扫描计算 → 规则触发 → 技能封装 → Agent 只处理不确定判断。
6. **批量吸收变化**：不把每次文件修改都升级为系统级变化。
7. **可追踪、可解释、可恢复**：任何自动同步都能说明来源、影响、处理状态。

---

## 4. 用户与核心场景

**唯一核心用户**：AXI 个人创造者——同时是产品决策者、项目维护者、AI 协作者。

| 场景 | 描述 |
|---|---|
| A. 查看创造生态 | 打开 Workbench 看到项目地图、阶段、活动、健康度、阻塞、关系，而非逐个翻文件夹 |
| B. 接管历史项目 | 扫描并注册为 Project Object，记录位置/技术栈/文档/依赖/状态，**不移动原文件** |
| C. 发现治理缺口 | 识别缺 README / 架构 / 状态记录 / 验证命令 / 依赖声明的项目并列为可处理问题 |
| D. 理解一次有意义的变化 | 从 Git + 注册信息聚合出 Change Object，判断是产物/能力/架构变化 |
| E. 按需调用 Agent | 仅当变化影响项目模型、公共能力或架构时才请 Agent 分析；普通修改不触发 |
| F. （新增）跨周期重建设计记忆 | 作者隔一段时间后，通过本总纲 + ADR 在 10 分钟内回忆"造了什么、为什么这么设计" |

---

## 5. 整体架构

### 5.1 分层总览

```text
                         AXI Personal OS
                                │
                 Workspace Governance / Registry（索引平面）
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
  Physical Layer         Semantic Layer           Application Layer
  Git 仓库（polyrepo）    AXI Kernel               Axi Workbench（入口宿主）
  foundation/            Project/Document/        Workbench CLI
  workbench/             Change/Resource         Inbox / Sync /
  products/              Repository Registry     Runtime / Apps
  tools/ ...             Relation / Schema       Axi Docs / Coder
       │                 JSON-on-disk            （UI / 服务）
       └───────────────┬────────┴───────────────┬────────┘
                       │                        │
                Repository Adapter       Workspace Registry
                       │                        │
                 Git commits/events     graph + catalog + handoff
                       └──────────┬─────────────┘
                                  │
                     Rules / Skills / Agents
                                  │
                        Human review boundary（人工审核边界）
```

**关键判断**：工作区不是 Git 仓库，而是多个项目/产品/共享/治理数据的**联邦容器**；AXI Kernel 是 Git 之上的**语义对象与变化吸收层**。

### 5.2 各层职责

- **Workspace Container（`/Volumes/code/workspace`）**：稳定分区边界 + 导航治理入口（`WORKSPACE_INDEX.md`、`workspace.graph.json`、`AGENTS.md`）；不保存统一代码历史，不 `git init`，不做跨项目业务实现。
- **Physical Layer**：每个项目拥有独立 Git 仓库与分支历史；事实来源是 Git、清单、项目本地 AGENTS/README；Kernel 不替代它。
- **Governance Registry**：权威源 `foundation/workspace-governance/workspace.json` + 根 `workspace.graph.json`；声明项目身份/路径/分区/层级/生命周期/远程/owner，以及 provides/consumes/contracts/health/verification；管理 admission、handoff、completion、审计。
- **Semantic Layer（Kernel）**：见 §6。
- **Application Layer**：见 §8 子项目快照。

### 5.3 所有权边界（最重要的一张表）

```text
Kernel      拥有：identity / schema / persistence / relation / raw change source / cursor
Workbench   拥有：scan 呈现 / dashboard / onboarding / graph 视图 / UI 状态
Governance  拥有：项目 admission / catalog / handoff / audit policy（"允许什么、如何登记、如何验证"）
Git         拥有：commit / branch / remote / diff / release 历史
Agent       拥有：规则升级之后、仍存在歧义的语义分析
```

> Kernel 不移动项目、不替代 Git、不直接决定高影响认知更新；Governance 不做第二个对象数据库；对象层错误不得破坏文件层。

### 5.4 核心数据流

**(1) 项目注册流**
```text
workspace.json / workspace.graph.json → workspace-project → Workbench CLI scanner
   →（候选项目 / 人工修正 / handoff 证据）→ AXI Kernel Project
```
扫描器只提候选，不静默覆盖用户认知；路径/名称/阶段/健康度/关系都要可追溯。

**(2) Git → Change 变化流**
```text
Git 仓库（commit/branch/diff）→ Repository Adapter（raw_event）
→ Kernel Change Stream（cursor + 幂等）→ Change Sync（聚合 + impact）
→ Rule Engine：L0/L1 记录或索引；L2 能力复核/可选 Agent；L3 架构复核 + 人工批准
```
Git commit 粒度与 AXI Change 粒度**故意分离**：多个 commit 可聚合成一个语义 Change，一个 commit 也可能只是 L0 噪声。

**(3) Agent 升级边界**
```text
确定性扫描 → 规则分类 → 证据包 →（仅当歧义/影响高）→ Agent 分析 → 人工审核 → 语义注册更新
```

---

## 6. 核心对象模型

第一阶段只把高价值、需统一治理的对象纳入模型。**V0.1 必须实现 Project / Document / Change**；其余允许登记或预留。

| 对象 | 定义 | V0.1 状态 |
|---|---|---|
| **Project** | 正在创造、维护、交付的项目 | 必须实现（已闭环） |
| **Document** | 项目说明、架构、PRD、交接、记录 | 必须可关联（已建基础） |
| **Change** | 经聚合的有意义语义变化 | 必须实现基础模型（已建） |
| **Resource** | 内外部可复用内容、素材、参考（URL/文件/inbox 项） | 预留并可登记 |
| **Repository** | Git 仓库 / 分支 / 远程 / commit / raw event | 已实现（Repository Registry） |
| Skill | 可复用能力封装 | 登记元数据 |
| Rule | 约束、触发条件、治理规则 | 登记元数据 |
| Task | 待完成工作项 | 预留（Kernel 原生闭环未完成） |
| Artifact | 构建产物、设计稿、报告、发布物 | 预留（边界已存在，API 未统一） |
| Relation | 对象间 uses/depends_on/belongs_to 关系 | 已建基础（须区分声明 vs 推断） |

**Project 示例**
```json
{
  "id": "AXI-WORKBENCH", "type": "Project", "name": "AXI Workbench",
  "stage": "development", "location": "/workspace/workbench/axi-workbench",
  "status": "active", "health": "warning",
  "relations": { "uses": ["AXI-UI", "AXI-SKILLS"], "depends_on": ["AXI-WORKSPACE-GOVERNANCE"] },
  "documents": [], "skills": [], "rules": []
}
```

**Change 合同（0.1 freeze 后固化）**
```json
{
  "id": "change_xxx", "type": "Change", "subject_id": "project-axi-kernel",
  "summary": "feat(kernel): add repository adapter", "change_type": "feature",
  "impact_score": 72, "impact_level": "L2",
  "scope": ["axi-kernel", "repository"],
  "evidence": ["git:/repo:commit:path"], "state": "pending_review"
}
```
向后兼容：缺字段读取时用 `other / 0 / L0 / 空 / pending_review` 默认值；新增字段不改写 Git 历史。

**Event Store 与 Registry 分界**：`Event Store = 发生过什么（append-only，可 replay）`；`Registry = 现在是什么（当前语义状态）`。Event Store 未完成前，不得把 Registry 当完整历史库。

---

## 7. 变化同步机制

### 7.1 分层职责

```text
File/Git → Script 采集事实 → Automation 决定何时跑 → Skill 封装同步能力
→ Rule Engine 判断是否升级 → Agent 处理需语义理解的判断
```

### 7.2 变化等级 L0–L3

| 等级 | 名称 | 示例 | 处理 |
|---|---|---|---|
| L0 | Noise 噪声 | typo、颜色、注释、临时实验 | 仅 Git 记录 |
| L1 | Artifact Change 产物变化 | 新增文档、组件、资源 | 更新索引 |
| L2 | Capability Change 能力变化 | 新增项目健康检测能力 | 更新能力注册，必要时 Agent |
| L3 | Architecture Change 架构变化 | 修改 Project 对象模型 | 发 ADR、改 Schema、人工确认 |

### 7.3 聚合与触发

- 不以每行代码同步，而把 Raw Events **聚合**为 Change Object。
- 触发：数量阈值（累计提交/变更文件数）；类型阈值（核心文件变更立即触发）；时间阈值（每日 Daily Reflection）；用户主动触发。
- V0.1 用 **cursor/tick + 定时批处理**，不做常驻 event-driven subscription（事件订阅/重试/幂等/背压/死信延后到 Phase 3/6，不得把定时任务标记为事件驱动能力）。

### 7.4 影响评分（可解释）

```text
Impact Score = 文件权重 + 对象权重 + 关系影响 + 变更范围
```
0–20 记录即可；20–60 进同步队列；60–90 请 Agent 分析；90–100 必须人工审核才能写核心认知。

---

## 8. 子项目设计快照全景（记忆核心）

> 本节是"忘记设计"时的主要恢复入口：每个项目一张卡，讲清定位、边界、能力、状态。
> 实时事实以 `WORKSPACE_INDEX.md` 与 `workspace.graph.json` 为准；进度细节以各项目 `docs/HANDOFF.md` 为准。
> 路径前缀统一省略为 `/Volumes/code/workspace`。

### 8.1 Personal OS 六大能力模块（foundation，PRD-01~06）

#### ▣ PRD-01 · Axi Kernel — `foundation/axi-kernel`
- **定位**：Personal OS 的稳定内核，JSON-on-disk 对象注册表 + CLI `axi-kernel`。
- **拥有**：身份 / Schema / 持久化 / 关系 / Raw Event·Change 基础 / 游标；schema migration。
- **核心对象**：`Project / Document / Change / Resource` + Repository Registry（`Repository / Branch / GitRemote / Commit / RawEvent`）。
- **不拥有**：不是数据库（Phase 0 刻意 JSON-on-disk）、不替代 Git、不多用户/不联网、不含 Todo/日历/聊天/Dashboard 布局/UI 状态/业务工作流。
- **状态**：active，0.1 freeze；SCHEMA_VERSION 4。**验证**：`python3 -m unittest discover -s tests`；`python3 -m axi_kernel --help`。
- 由 `incubator/object-registry/` 于 2026-09-21 promote。

#### ▣ PRD-02 · Axi Workbench CLI — `foundation/axi-workbench-cli`
- **定位**：Workbench 的个人 OS CLI / 扫描与验证工具（无 Web UI，仅 CLI + DOT/JSON）。
- **拥有**：工作区扫描器、8 项健康检查、dashboard、关系图（JSON/DOT）、§7 度量原语；通过 `cli/axi_workbench/kernel_bridge.py` 以运行时 `sys.path` 挂载 PRD-01 Kernel。
- **不拥有**：不做 Web UI；是 `axi-workbench` 的数据平面（`manages=["axi-workbench"]`），不是另一个 Workbench 产品，也不是 Kernel。
- **状态**：active。**验证**：`PYTHONPATH=cli python3 -m unittest discover -s tests -v`。

#### ▣ PRD-03 · Axi Inbox — `foundation/axi-inbox`
- **定位**：资源入口能力层（Resource Inbox），统一接收图片/链接/文件/想法。
- **拥有**：低成本收集、延后分类、项目关联、状态流转。
- **状态**：active（Phase 2，应用化未完全完成）。**验证**：`PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests`。
- 由 `incubator/resource-inbox/` 于 2026-09-23 promote。

#### ▣ PRD-04 · Axi Change Sync — `foundation/axi-sync`
- **定位**：变化同步，从 Git/文件事实形成 Raw Event 与候选 Change。
- **拥有**：事实采集、聚合、影响评分、证据包、待审核项输出。
- **状态**：active（Phase 2/3）。**验证**：`PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests`。
- 由 `incubator/change-sync/` 于 2026-09-23 promote。

#### ▣ PRD-05 · Axi Governance Runtime — `foundation/axi-runtime`
- **定位**：治理运行时，执行规则触发、游标、幂等流程。
- **拥有**：可被 cron/launchd 调用的 `daily-reflection` CLI（`--since 30m/24h/7d`）、非破坏性 `scripts/audit.sh`。
- **不拥有**：Workbench 内 Daily Report UI 属后续；不含业务数据。
- **状态**：active（Phase 3）。Daily Reflection 已安装为 macOS LaunchAgent `com.axi-runtime.daily-reflection` 并完成真实触发。
- 由 `incubator/governance-runtime/` 于 2026-09-23 promote。

#### ▣ PRD-06 · Axi Applications — `foundation/axi-apps`
- **定位**：应用能力层，消费对象/关系/变化，承载更高层应用行为。
- **拥有**：面向 Personal OS 的应用切片（CLI 形态验证）。
- **状态**：active（Phase 4）。**验证**：`PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests`。
- 由 `incubator/applications/` 于 2026-09-23 promote。

### 8.2 工作台与入口（workbench）

| 项目 | 路径 | 设计快照 | 状态 |
|---|---|---|---|
| **Axi Workbench** | `workbench/axi-workbench` | **唯一工作区入口产品 / 工作台宿主 monorepo**。承载：Web 门户 `apps/workbench`、移动执行端 `apps/workbench-mobile`、DevSvc Dashboard、Axi Coder、Verification Inbox、Axi Artboard、Resource Orchestration（workbench+gateway）、Axi Docs hub、Fleet Console、Ollama 菜单助手、App CLI。六层控制面；两 App 入口。技术栈 React/TS/Tauri/Rust/Node/Python/Ansible/Swift。 | active |
| **Axi Image Preview** | `workbench/axi-image-preview` | 图片/壁纸画廊预览应用，用于视觉参考、hover/详情交互、预览实验。React/TS/Vite。 | active |
| **Axi Pet Desktop** | `workbench/axi-pet-desktop` | 桌宠 Electron monorepo，运行时 `apps/desktop-pet`（React19 + R3F + VRM）；命名空间 `@axi-pet-desktop/*`。 | active |

### 8.3 Agent 集群（agent-cluster）

| 项目 | 路径 | 设计快照 | 状态 |
|---|---|---|---|
| **Axi Agent** | `agent-cluster/axi-agent` | **唯一 Agent 集群核心**：拥有 Agent runtime、MCP、传输、远程会话、工具运行时、任务编排；其他 Agent 能力均为其内部模块/附属服务/外部能力提供者。Python/FastAPI/React/TS/Node/MCP/WebSocket。 | active |
| **Axi Feishu Codex Bridge** | `agent-cluster/axi-agent/tools/axi-feishu-codex-bridge` | `axi-agent` 附属工具：把飞书消息桥接到 Codex CLI/App/Plus CDP，接入 axi-rules 记忆。物理独立仓库，治理归 Agent 集群（`parent_project=axi-agent`）。 | active |

### 8.4 独立产品（products，AxiomaticWorld spun-out）

| 项目 | 路径 | 设计快照 | 状态 |
|---|---|---|---|
| **IELTS Vocabulary** | `products/ielts-vocab` | 独立 IELTS 词汇产品；已达 1.0.0 并成功部署上线，运行实例暂停。React/TS/Vite + Flask/SQLite/微服务。接受工作区治理但不并入 Workbench/基础层。 | paused-runtime |
| **Story Graph** | `products/story-graph` | 证据驱动的本地小说人物关系图谱工作台：语料摄入、可复核图数据、SQLite、React/Vite 查看器。 | active |
| **Axi Soul World** | `products/axi-soul-world` | 多表面、本地优先产品根，稳定跨运行时契约 + 本地运行时边界 + Axi Mood Android 记录面。Android/Kotlin/C++20/Rust/SQLite。 | active |
| **Voice Assistant (on-device ASR)** | `candidates/voice-assistant-on-device-speech-recognition` | 端侧语音识别实验（MLX/Whisper）。2026-09-25 已从 `products/` 搬至 `candidates/`，README 同步更新；maturity-v1 评审进行中（per WORKSPACE_INDEX.md §Voice Assistant）。 | prototype-pending-review |

### 8.5 候选 / 工具 / 基础支撑

| 项目 | 路径 | 设计快照 | 状态 |
|---|---|---|---|
| **Pelagic** | `candidates/pelagic` | Three.js/WebGL 程序化远海视觉实验（海面/天空/天气/星体/时间控制）。未过产品成熟度评审。 | active-candidate |
| **Axi Video Downloader** | `tools/axi-video-downloader` | 个人 Android 视频处理工具：ADB + mitmproxy + Flask + SQLite，管理手机视频抓取/下载/记录。 | active |
| **Axi Rules** | `foundation/axi-rules` | 本地权威：agent 行为、项目路由、记忆源优先级、验证规则、安全边界、前端 3D 记忆召回管线。 | active |
| **Axi Skills** | `foundation/axi-skills` | 共享、版本化技能目录（Codex/Claude/Cursor/MiniMax 等）；运行时源 `skills/`。 | active |
| **Axi UI** | `foundation/axi-ui` | 品牌 tokens + 核心 primitives + 控制台 shell/设置/CRUD/widgets/addon，发布 `@axi/*`。 | active |
| **Axi Registry** | `foundation/axi-registry` | 本地 Verdaccio，仅发布/安装 `@axi/*` 包。 | active |
| **Axi Notify** | `foundation/axi-notify` | 通知/移动 monorepo：relay、Android 客户端、事件收件箱、移动工作台；含 donor 迁移材料。 | active |
| **Axi Observability** | `foundation/axi-observability` | 统一可观测性：结构化日志/指标/追踪/分级告警/Workbench 查询/移动通知（Loki/Promtail/Prom/OTel/Tempo/Grafana）。 | active-foundation / prototype |
| **Workspace Governance** | `foundation/workspace-governance` | 工作区注册表、生成目录、审计脚本、治理文档（治理仓库，非 monorepo）。 | active |

### 8.6 分发包 / 参考 / 归档（速览）

- **分发包（distributions，只 3 个）**：`axi-workbench-web` / `-mobile` / `-desktop`，从 `axi-workbench` 对应 app 切出的可构建部署件，镜像源、不拥有业务语义。
- **参考仓库（references，非 Axi 所有）**：cockpit-tools、dbskill、sub2api、image2prompt、opencodex、blinko、comfyui——仅作模式/能力参考，不提升为自有产品。
- **归档（archive）**：`axi-sports-management-app`（1.5 年零业务逻辑，2026-09-17 废弃）；`axi-proxy-companion`（物理检出已删，仅存 dossier）。
- **非项目孵化（incubator）**：`desktop-automation-voice-computer-use-agent` 等；不注册、不发布，promote 需重走 `route-intent`。

---

## 9. 关键架构决策（ADR 速览）

> 细节以 `foundation/workspace-governance/docs/adr/` 原文为准；ADR 只追加，被推翻则新增并标 Superseded。

| ADR | 决策要点 |
|---|---|
| ADR-001 | 治理仓库作为索引平面（index plane） |
| ADR-002 | 渐进式仓库命名策略 |
| ADR-003 | 工作区根是非 Git 容器（无根级 CI / husky） |
| ADR-004 | apm-agent-context 包分层 |
| ADR-005 | agent-bff 所有权归属 |
| ADR-006 | 网关分类法（gateway taxonomy） |
| ADR-007 | 命名别名契约（alias contract） |
| **ADR-008** | **Personal OS 仓库拓扑与边界冻结（2026-09-24）**：PRD Phase ≠ 仓库边界；六模块保持独立 canonical 仓库；`axi-workbench` 是唯一入口；Spatial Graph 归 `axi-workbench`；distributions 只 3 个 |
| ADR-009 | 工作流优先的有界 agent（workflow-first bounded agent） |
| ADR-010 | 可观测性治理 |

---

## 10. 当前实现状态（截至 2026-09-25）

- **工作区规模**：约 35 个跟踪条目；canonical / active 为主体；分区边界已于 2026-09-24（ADR-008）冻结。
- **Personal OS 六模块均已从 incubator promote 为 canonical 项目**（PRD-01/02 于 09-21，PRD-03~06 于 09-23）。
- **本地行为测试**：2026-09-21 基线 PRD-01~06 合计 127 项通过（37 / 31 / 18 / 20 / 10 / 11）；此后 Runtime 审计为 32 项（数字随迭代变化，**以各项目 HANDOFF / 实跑为准**）。
- **已跑通的 P0 纵向切片**：`axi-kernel` commit → `GitRepositoryAdapter.collect()` → `GitCommit` → `to_change_input` → 可供 `register_change` 消费的 Change 合同输入（样本 commit `79d16f6`）。adapter 当前为只读事实采集器。
- **Daily Reflection**：已安装并真实触发，输出有效 JSON。
- **结构通过 ≠ 运行时通过**：单元/结构绿灯不代表 Workbench UI、Android 真机、生产 DB、远程 CI、HTTPS、S3/PG、恢复演练全部完成。

### 10.1 已知未完成项 / 风险

1. 跨所有仓库的统一 Git webhook / 提交后采集 / 批量聚合 / 失败重放**尚未关闭为生产能力**。
2. L0–L3 与 impact 评分仍有局部各自实现，需收敛为可版本化合同。
3. **Task / Artifact 尚无 Kernel 原生闭环**；完整 Event Store 未独立落地。
4. Workbench UI 地图/健康度/变化审核接入统一证据包仍在推进。
5. Voice Assistant 归属遗留；个别 `.venv` 越界软链曾阻塞治理审计。
6. 本地提交 ≠ 已 push / 已合 main / 已发布；main 稳定与禁 force-push 仍受保护。

---

## 11. 路线图（方向，非承诺日期）

> solo owner 模式：季度窗口表达方向与先后，不锁完成日；详见 `docs/ROADMAP.md`。

- **Phase 0 · Kernel v0.1**：对象/项目 Schema、关系、注册表、变化模型、最小扫描器 —— 已落地（freeze）。
- **Phase 1 · Workbench V0.1**：项目注册、地图、健康度、详情、关系图、基础变化记录 —— 基线已落地。
- **Phase 2 · Resource Inbox**：统一收集、延迟分类、关联、状态流转 —— 已 promote，应用化推进中。
- **Phase 3 · AI Governance**：规则引擎、技能运行时、变化分析、Agent Gateway、审核工作流、事件驱动专项 —— 部分落地（Runtime / Sync 已就位）。
- **Phase 4 · Applications**：社交、分享、移动端及更多个人创造应用 —— 切片验证中。

**收敛顺序**：固化 Repository Adapter → 收敛 Change 评分/阈值合同 → 补 Task/Artifact 最小模型 → Workbench UI 接入统一证据包 → 高影响变化人工审核与可恢复写入 → 本地契约稳定后再推移动/社交/常驻 Agent（P2）。

---

## 12. 成功指标（不以功能数量衡量）

- 用户能在**一个入口**内理解整个工作区。
- 接管历史项目的人工整理时间明显下降。
- 发现治理缺口的时间明显下降。
- 能区分普通代码变化 / 能力变化 / 架构变化。
- 关键认知变化**有记录、有来源、有状态**。
- 新增应用**不需重写**核心对象与关系模型。
- （新增）作者跨周期重建设计上下文的时间从"重新翻代码"降到"10 分钟读总纲 + ADR"。

---

## 13. 验收标准（平台 / 入口 V0.1）

1. 能注册并展示一组真实历史项目；路径/状态/阶段/关系可追溯到来源。
2. 工作区地图展示健康度、最近活动、阻塞项。
3. 至少一种关系能在关系图与项目详情间双向查看。
4. 代码/文档变化可生成 Raw Event 并聚合成 Change Object。
5. L0/L1 不触发不必要 Agent；L2/L3 进入待分析/待审核。
6. 删除或失效对象层数据不删除原项目文件；可重新扫描恢复。
7. 关键流程有可重复验证命令或测试记录。

---

## 14. 验证命令（最小集）

```bash
# 工作区契约 / 治理
/Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs

# Personal OS 各模块（以 axi-kernel 为例，其余替换项目名并设 PYTHONPATH）
python3 -m unittest discover -s /Volumes/code/workspace/foundation/axi-kernel/tests

# Runtime 非破坏性本地审计 + Daily Reflection
bash /Volumes/code/workspace/foundation/axi-runtime/scripts/audit.sh
```
> 各项目完整验证命令见 `WORKSPACE_INDEX.md` 表格与其 `docs/HANDOFF.md`；不在本总纲复制长清单。

---

## 15. 术语表

| 术语 | 含义 |
|---|---|
| AxiomaticWorld（公理世界） | 母品牌 / 公司身份，`axiomaticworld.com` |
| AXI Personal OS | 本平台，个人创造工作操作系统 |
| Kernel | 语义对象与变化基础（PRD-01） |
| Workbench | 入口工作台产品；其 CLI 为 Workbench CLI（PRD-02） |
| Inbox / Sync / Runtime / Apps | 资源收件箱 / 变化同步 / 治理运行时 / 应用层（PRD-03~06） |
| Change / Raw Event | 语义变化 / 未聚合的原始事件 |
| L0–L3 | 变化等级：噪声 / 产物 / 能力 / 架构 |
| ADR | 架构决策记录，承载"为什么" |
| polyrepo | 多独立仓库联邦（相对 monorepo） |
| provides / consumes | 项目对外提供 / 依赖的能力契约 |

---

## 16. 变更记录

| 日期 | 变更 | Owner |
|---|---|---|
| 2026-09-25 | 首版 L0 总纲：收编桌面母 PRD，更新到六模块已 promote 的当前状态，新增 §8 子项目设计快照全景与场景 F | libu |
