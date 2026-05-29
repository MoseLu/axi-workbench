# Axi Workstation 六层控制面 SOP

## 目的

这份 SOP 用来防止 Axi Workstation 工作流绕过六层架构。文件名暂保留 `epap-` 前缀以兼容已有引用；自然语言控制、通信适配、AgentTask、记忆检索、文档检索、物理资源检查、外接能力调用，都以本文为运行边界。

## 六层模型

| 顺序 | 层级 | 拥有什么 | 不得拥有什么 |
| --- | --- | --- | --- |
| 1 | IM 层 | 用户输入、消息展示、渠道 UX | 路由策略、业务判断、项目状态 |
| 2 | 通信层 | `RouteBinding`、配对、审批 UI、附件引用、幂等、回执、响应渲染 | Codex 执行、记忆读取、项目目录扫描 |
| 3 | 软件层 | 项目、服务、工作流、`AgentTask`、运行时会话、项目状态 | 物理机器所有权、密钥材料 |
| 4 | 基础服务层 | PostgreSQL 记忆、文档库、文件库、审计库、工具注册表、MCP/skills、本地模型/浏览器能力目录 | IM route 决策、项目所有权 |
| 5 | 物理服务层 | 服务器、本机、ADB 设备、端口、磁盘、进程、网络可达性 | 项目、工作流、用户意图 |
| 6 | 外接能力层 | 第三方 API、托管模型、远端 agent API | 本地项目状态、物理资源所有权 |

## 控制面

### PROMPT

`PROMPT` 是 agent 行为和表达的分层上下文，不是权限系统。权限、边界、拒绝条件仍由 rules/SOP 决定。

规则：

- system prompt 是不可变底座，不放第三方完整 proprietary prompt。
- global prompt 对所有项目生效，用于通用工程行为和输出风格。
- project prompt 只补充特定项目领域知识和验证入口。
- prompt 不得授予越层权限；任何 prompt 都不能覆盖本 SOP。

### AGENT

`AGENT` 是软件层执行契约，不是聊天传输。Agent 只能通过受管 `AgentTask` 创建或修改项目。

规则：

- 每个非平凡执行请求都必须创建 `AgentTask`。
- 必须记录 runtime、cwd、prompt、审批状态、audit id、结果摘要和 artifact 引用。
- 执行前必须经过 control-plane 策略。
- 默认本地运行时是 `codex_cli`；`codex_app` 只能通过同一个 `AgentTask` 契约尝试，失败降级必须审计。

### MEMORY

`MEMORY` 是基础服务层的事实和历史面。它回答“过去观察/记住了什么”，不回答“磁盘现在有什么”。

规则：

- memory-only 请求不得扫描目录或工作区索引。
- 记忆回答必须尽量说明来源和新鲜度。
- 写入必须带 provenance：来源 run、route、时间戳、置信度。

### SOUL

`SOUL` 是平台和用户交互风格的稳定身份面。

规则：

- 存储稳定产品原则、用户语言偏好、IM 定位、安全姿态和回复风格。
- 不得和临时任务记忆混在一起。
- 用户可见回复默认中文；项目名、命令、API、代码标识符可以保留英文。
- Feishu 是情报站：简洁、结构化、可读的 card/table/list。
- MossCoder 是全能工作台：更丰富的任务卡、执行状态、artifact 链接和控制项。

### HEARTBEAT

`HEARTBEAT` 是活性和周期检查面。它关注过期任务、服务健康、未回推结果、周期巡检。

规则：

- heartbeat job 必须显式命名并可审计。
- heartbeat 可以观察和通知；不得静默执行破坏性操作或生产写操作。
- heartbeat 结果应带来源和时间戳写入 audit 与 memory。

### DOCS

`DOCS` 是分层文档库，不是单一 markdown 文件夹。

规则：

- Rules：强制 SOP 和策略。
- Playbooks：步骤化流程。
- Facts：当前目录和能力地图。
- Memory：历史观察和偏好。
- Soul：稳定身份、语气和产品原则。
- Heartbeat：周期检查定义。
- Audit：不可变运行证据。

项目文档系统接入规则见 `docs/rules/epap-project-doc-agent-sop.md`。Docs agent 属于软件层 `AgentTask`，文档和项目 MEMORY 属于基础服务层。

## 自然语言请求 SOP

所有 IM 来源请求必须按这个流程走：

1. IM 层接收自然语言，只做渠道原生展示。
2. 通信层标准化为 `IMEnvelope`，检查 route 配对、幂等、附件引用和审批命令。
3. control-plane 从标准 envelope 解析 intent。
4. control-plane 选择权威事实源：
   - 项目状态：按用户请求从软件注册表或 memory 读取；
   - memory-only 查询：只读 memory；
   - 文档问题：读 docs/knowledge；
   - 主机/进程/设备问题：读物理服务层；
   - 第三方能力问题：读外接能力注册表。
5. 危险或未声明动作必须拒绝，或转换为审批请求。
6. Agent 工作必须创建 `AgentTask`，不得由通信 adapter 执行。
7. 结果先写 audit，再返回给 IM 渲染。
8. 通信层按渠道渲染中文输出。

## E2E 验证 SOP

不要把 API smoke 叫成端到端测试。必须使用验证梯：

1. API 模拟验证 route、配对、幂等、intent、audit 和 task 创建。
2. Agent 执行验证产物、命令、日志和 run result。
3. 浏览器自动化用确定性断言验证 UI 行为。
4. Codex 浏览器或 Chrome 验证真实浏览器里的产品体验。
5. 当结论涉及桌面、Android、Feishu、MossCoder 或类真人输入时，用 `computer-use` 做真实操作验证。
6. 问题按层分类：通信层、控制面、agent 执行、项目实现、浏览器/设备验证。

## 审批和拒绝规则

自动允许：

- 只读状态查询。
- 已注册的 health 和 verify 命令。
- 符合运行策略的受管 `AgentTask` 创建。
- 带来源的文档和记忆检索。

自动拒绝：

- `rm`、`git reset --hard`、`git clean`、破坏性文件操作。
- 密钥或凭据外泄。
- 未声明 shell 执行。
- 未经明确审批的公网端口暴露。
- 生产写操作。
- 通信层尝试执行业务逻辑。

需要审批：

- 任何不可逆状态变更。
- 声明项目/任务目录之外的大范围文件写入。
- 外部服务变更。
- 超出观察范围的物理主机变更。
