# EPAP 项目文档系统 Agent SOP

## 目的

每个 EPAP 纳管项目都应有可被 agent 读取、维护和审计的文档系统。文档系统属于基础服务层的 DOCS/MEMORY 面；文档维护动作属于软件层 `AgentTask`，不得由通信层或 IM 层直接写入。

## 标准项目文档清单

| 文件或目录 | 必需 | 所属面 | 用途 |
| --- | --- | --- | --- |
| `README.md` | 是 | DOCS / Facts | 项目入口、运行方式、当前能力 |
| `AGENTS.md` | 是 | Rules / Prompts bridge | 本项目 agent 规则、边界、验证命令 |
| `CHANGELOG.md` | 是 | Audit / Facts | 用户可读变更记录 |
| `TODO.md` | 是 | Playbooks / Facts | 待办、优先级、状态 |
| `MILESTONE.md` | 是 | Facts / Planning | 阶段目标、验收口径 |
| `docs/PRD.md` | 推荐 | Product Docs | 产品需求、用户场景、验收标准 |
| `docs/TDD.md` | 推荐 | Technical/Test Docs | 技术设计或测试驱动设计，项目内需说明含义 |
| `docs/ADR/` | 推荐 | Rules / Decision | 架构决策记录 |
| `docs/MEMORY.md` | 可选 | MEMORY | 项目独立记忆摘要，必须带来源和时间 |
| `docs/project-docs.manifest.json` | 推荐 | Facts | 文档系统机器可读索引 |

说明：

- 用户写成 `MINESTONE` 时，系统应归一为 `MILESTONE`，但不要创建拼错文件。
- 独立 MEMORY 不是普通笔记；它是项目级记忆摘要，写入必须带 provenance。
- 文档库可以被检索，但写入必须经过 docs agent 的 `AgentTask`。

## Docs Agent 接入流程

1. control-plane 收到“更新文档/整理 PRD/生成 TDD/总结里程碑/写 changelog”等意图。
2. control-plane 解析目标项目，并读取项目文档 manifest。
3. 如果项目缺少 manifest，则按标准清单探测文档，但只作为“未完成接入”状态上报。
4. control-plane 创建软件层 `AgentTask`，runtime 可为 `codex_cli` 或后续 docs 专用 runtime。
5. docs agent 只在目标项目目录内读写文档文件。
6. 每次写入必须更新审计：来源请求、变更文件、摘要、验证结果。
7. 如果写入 `docs/MEMORY.md`，必须同时记录来源 run、时间、置信度和是否可覆盖。

## 权限边界

允许：

- 读取标准文档。
- 创建缺失的标准文档模板。
- 更新 `README.md`、`CHANGELOG.md`、`TODO.md`、`MILESTONE.md`、`docs/PRD.md`、`docs/TDD.md`、`docs/ADR/*`。
- 在明确项目目录内维护 `docs/MEMORY.md`。

禁止：

- 通信层直接写文档。
- 将项目 MEMORY 写成无来源的事实。
- 用项目文档覆盖 system/global prompt。
- 把物理服务器、ADB 设备或端口写成项目所有者。
- 从文档 agent 直接执行破坏性代码操作。

## 文档状态分级

| 状态 | 含义 |
| --- | --- |
| `ready` | 必需文档和 manifest 都存在 |
| `partial` | 必需文档存在一部分，agent 可补模板 |
| `legacy` | 有 README 等传统文档，但未接入 manifest |
| `missing` | 基本文档缺失 |
| `memory-isolated` | 项目有独立 MEMORY，需单独同步和检索 |

## 验证

Docs agent 完成后至少验证：

- manifest JSON 可解析。
- 标准文档链接存在。
- 新增/修改文档没有把项目事实写到错误层。
- `AGENTS.md` 指向本项目的验证命令。
- 如果更新 MEMORY，条目含来源和时间。

