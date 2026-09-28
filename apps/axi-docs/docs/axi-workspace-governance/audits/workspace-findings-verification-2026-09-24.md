# 工作区问题逐条核验台账（2026-09-24）

## 范围与证据基线

本台账核验 `/Volumes/code/workspace` 及其治理源，依据：

- `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- `/Volumes/code/workspace/workspace.graph.json`
- `/Volumes/code/workspace/foundation/workspace-governance/workspace.json`
- `/Volumes/code/workspace/scripts/workspace-project validate`
- `pnpm workspace:audit`
- `pnpm agent-guidance:check`

审计阶段保持只读。治理仓库原有未提交改动未触碰：`docs/project-handoff.md`、`admissions/axi-{apps,inbox,runtime,sync}.json` 及 spatial-graph prototype。

## 自动化基线

| 检查 | 结果 | 证据 |
|---|---|---|
| workspace-project validate | 失败 | incubation `desktop-automation-voice-computer-use-agent/.venv/bin/python` 为符号链接 |
| pnpm workspace:audit | 失败 | `Errors: 1`，同一 incubation 符号链接问题 |
| agent-guidance:check | 通过 | 7 份 landing files 已同步 |
| governance repo 状态 | 有既有未提交改动 | 审计前状态已记录，未归因于本次工作 |

整改后基线：`workspace-project validate` 通过；`pnpm workspace:audit` 通过（Entries 23、Admissions 8、Incubations 5、Errors 0、Warnings 0）。incubation 虚拟环境中原有的 `python`、`python3`、`python3.12` 三个生成符号链接已移除。

## 逐项结论

结论枚举：`已证实`、`设计意图`、`不成立/需改判`、`证据不足`。证据不足项不得直接进入修复批次，必须先补充可复现证据。

| 编号 | 结论 | 核验摘要 |
|---:|---|---|
| 1 | 已整改 | graph 原有 6 个 `axiom-workbench` 悬空 target 已统一修正为 `axi-workbench`；validate 已通过。 |
| 2 | 需改判 | `axi-agent` 为 graph 节点但 registry bucket 语义需按 owner/resource 分类复核，不能直接按漏登项目处理。 |
| 3 | 需改判 | voice assistant、android page patrol 存在 graph 节点；是否应注册取决于 incubation/reference 设计意图。 |
| 4 | 已整改 | 已从 graph 权威源移除失真的静态 `executionCoverage` 数字，避免继续作为治理决策依据；运行时视图按缺省无覆盖统计处理。 |
| 5 | 设计意图/已澄清 | 最新治理记录明确 `category` 表示存储分区、`tier` 表示治理角色；`axi-rules` 有意位于 `shared[]` 且物理路径为 `foundation/axi-rules`，不迁移目录。 |
| 6 | 已整改 | `axi-workbench-cli/AGENTS.md` 的验证命令已移除不存在的 `axi-pet-desktop-cli`，改为 canonical absolute paths；CLI 测试与 help 验证通过。 |
| 7 | 证据不足 | stale 注释需结合该文件当前完整上下文和补登提交来源确认。 |
| 8 | 已整改 | tools 中两条已删除目录引用已改为无当前注册独立工具，并保留归档/历史语义。 |
| 9 | 已整改 | Verdaccio 已为 `@axi-pet-desktop/*`、`@axi-agent-platform/*`、`@axi-soul-world/*` 增加本地 registry access/publish 规则，避免落入通配 npmjs proxy。 |
| 10 | 已整改 | MCP 已增加 `onboard_project`、`handoff_check`、`route_intent`、`admission_check`、`incubation_check` 五个 CLI 对齐工具；协议探测确认共 16 个工具可列出。 |
| 11 | 证据不足 | `role` 缺失是否违反当前 schema 需以 schema required 字段为准。 |
| 12 | 证据不足 | tier 结论涉及产品命名与治理意图，需读取 ADR 和项目声明后确定。 |
| 13 | 证据不足 | voice assistant 的 incubation/registered 边界需执行 route-intent 并比对 README。 |
| 14 | 证据不足 | deprecated 状态需逐项目对照 AGENTS、README、ARCHIVE 和 registry。 |
| 15 | 证据不足 | distribution 描述需对照 workspace.json 当前三项声明和实际构建入口。 |
| 16 | 证据不足 | axi-pet 双语 AGENTS 权威声明需读取完整文档后确定真实冲突。 |
| 17 | 证据不足 | Request Defaults 缺失清单需按 AR-BOOTSTRAP-002 的当前版本逐文件计算。 |
| 18 | 不成立/需改判 | 五个 service profile 均已有服务级 `health` 探针；全局 `serviceHealth` 也存在。原报告把不同配置层级混为缺失，未发现可直接整改的问题。 |
| 19 | 证据不足 | PRD 项目是否需要 service profile 不能由“已 promote”单独推导。 |
| 20 | 证据不足 | TODO/MILESTONE 状态需用 CHANGELOG 时间线逐项对照。 |
| 21 | 证据不足 | CHANGELOG 重复事件需按事件 ID/日期/提交证据去重。 |
| 22 | 证据不足 | 三份术语是否描述同一流程需建立步骤映射后判定。 |
| 23 | 证据不足 | VERIFICATION 过期需结合最新验证命令和生成时间确认。 |
| 24 | 证据不足 | PRD 中文/英文漂移需逐条需求键对照，不以关键词存在直接判定。 |
| 25 | 证据不足 | REMEDIATION-PLAN 重复需区分必要的摘要、约束和执行清单。 |
| 26 | 证据不足 | PRD 重复需按规范段落与引用关系分析，不能仅按重复短语计数。 |
| 27 | 证据不足 | 顶层键数量需用正式 schema/示例解析，而非文档段落数字直接比较。 |
| 28 | 证据不足 | 范围外枚举需以最新 ADR 为权威后比较。 |
| 29 | 证据不足 | `axi-mdns` 需搜索全 workspace 及历史/生成来源后判定。 |
| 30 | 证据不足 | MILESTONE 引用需确认 §10 当前语义与验收来源。 |
| 31 | 证据不足 | owner 顶部明示是否为强制 contract 需查 schema/rule。 |
| 32 | 证据不足 | 同名 skill 可能是语言/兼容镜像，需按 manifest、inode 和 runtime source 分类。 |
| 33 | 证据不足 | 包名漂移需对照 skill 文档的历史版本和当前 package exports。 |
| 34 | 证据不足 | vite-plugin 无消费者需同时查 distribution、构建脚本和外部消费者。 |
| 35 | 证据不足 | graph tier 缺失需以 graph schema required 规则实际验证。 |
| 36 | 证据不足 | 版本号漂移需对照 canonical package manifest 和 release policy。 |
| 37 | 证据不足 | skill 数量与两个路径错误需重新生成索引后比较。 |
| 38 | 证据不足 | md5 偏离需要 hash、生成来源和分发同步策略三重证据。 |
| 39 | 已整改 | 引导生成器中的执行提示已改为实际治理脚本路径，随后完成 sync 与 check。 |
| 40 | 需改判 | graph-only 节点包含 workspace anchor、external/reference/resource；不能整体视为孤立项目。 |
| 41 | 证据不足 | external flag 需按 graph schema 和各节点 lifecycle 统一复核。 |
| 42 | 证据不足 | `manages` 可能是 registry 元数据而非 graph relationship 类型，需查 schema。 |
| 43 | 证据不足 | health/verify 缺失需以项目类型和 v2 schema required 条件复核。 |
| 44 | 需改判 | 23、28、43 是不同 registry/graph/index 分母，先定义计数口径，不能直接判漂移。 |
| 45 | 证据不足 | completion 双写是否错误取决于一个是否为生成镜像。 |
| 46 | 证据不足 | frontmatter authority 需对照 DOC-MATRIX 的生成规则。 |
| 47 | 证据不足 | project-handoff 是否例外需查 handoff generator。 |
| 48 | 证据不足 | ADR 编号冲突需确认是否同一目录、同一序列和引用对象。 |
| 49 | 证据不足 | temp 目录可能是明确排除的翻译/开发输入，需查 manifest 和 git 状态。 |
| 50 | 证据不足 | sports-management lifecycle 需以 registry 与 ARCHIVE 的迁移规则判定。 |
| 51 | 证据不足 | 时间戳 stale 需确认该字段是否为治理 contract。 |
| 52 | 证据不足 | owner 文本是否需机读格式需查项目 handoff schema。 |
| 53 | 证据不足 | `ielts-vozab` 疑似路径/拼写问题，需先确认 canonical project path。 |
| 54 | 证据不足 | soul-world BLOCKED 的决策权属需查 HANDOFF contract 和当前 owner。 |

## 重复集群与设计意图

重复集群 55–62 暂不直接视为缺陷。必须先确定 canonical source、生成关系、运行时消费者和历史兼容约束；其中 `references: []`、external Windows path、incubation 不注册、workspace anchor、grandfathered policy 等属于设计意图候选，不进入 P0 修复。

## 当前进入整改的事项

仅以下事项已有足够证据进入下一阶段：

1. 修复 6 个 `axiom-workbench` 悬空关系（已完成）；
2. 处理 incubation 符号链接阻断（已完成）；
3. 移除失真的 `executionCoverage` 静态数字（已完成）；
4. 固化 `axi-rules` 的 registry bucket/path/category/tier 正交规则（已澄清）；
5. 为 MCP/CLI 双实现补充接口差异证据，再决定收敛方案（下一批）。

工具链批次已完成的低风险项：CLI 幽灵路径、tools 退役目录文档引用、引导生成器幽灵脚本路径、MCP 五个治理接口及 Verdaccio scope 规则。MCP 通过 CLI adapter 复用 canonical 实现，避免形成第二套业务逻辑。

新增整改：项目 post-commit 已接入 `scripts/workspace-change-propagation.mjs`。契约文件变更会自动执行 registry sync、docs sync、graph validate 和 workspace audit；普通业务源文件不会触发全工作区刷新。所有可安装目标仓库已重装 hook，`axi-workbench-cli` 不再缺少 post-commit。

其余项目只有在补齐对应证据后才可进入修复批次。
