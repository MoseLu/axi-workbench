# Axi Workbench Agent 规则

本仓库是 Axi Workbench 大项目，由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成。修改代码、测试、文档或本地运行流程前，必须遵守本文件和因兼容性保留旧文件名的 `docs/rules/epap-six-layer-sop.md`。

## 规范运行模型

所有 IM、通信、项目管理、AgentTask、记忆、文档和基础能力相关工作，统一使用 Axi Workbench 六层控制面模型：

1. IM 层：只负责用户输入和消息展示。
2. 通信层：只负责 route 绑定、配对、审批、附件引用、幂等、回执和渠道渲染。
3. 软件层：拥有项目、服务、工作流、AgentTask、运行时会话和项目状态。
4. 基础服务层：拥有记忆库、文档库、文件库、审计库、工具注册表、MCP/skills、本地模型/浏览器/运行时能力目录。
5. 物理服务层：拥有机器、设备、端口、磁盘、进程、网络资源。物理资源永远不拥有项目。
6. 外接能力层：拥有第三方 API、远端模型服务和远端 agent 服务。

架构文档中的旧产品技术栈分层只作为历史设计说明；控制面运行决策以六层 SOP 为准。

## 强制边界

- IM adapter 不得执行业务逻辑，不得读取项目目录。
- communication-gateway 不得调用 Codex，不得读取工作区索引，不得查询记忆表，不得拥有项目状态。
- control-plane 的业务输入必须来自标准 `IMEnvelope` 或类型化控制 API。
- Agent 执行必须表示为软件层受管 `AgentTask`。
- memory、docs、files、audit、tool registry、capability catalog 都属于基础服务层。
- 服务器、ADB 设备、端口、进程、主机健康只属于物理服务层。
- 第三方 API 和远端 agent 只属于外接能力层。
- 不得用 hook 作为 Axi Workbench 运行时旁路。

## 必须执行的 SOP

新增或修改控制面工作流前，先检查 `docs/rules/epap-six-layer-sop.md`。

新增或修改 agent 行为、输出风格、默认工作方式前，先检查 `prompts/README.md` 和三层 prompt：

- `prompts/system/*.mdc`：不可变底座。
- `prompts/global/*.mdc`：所有项目通用。
- `prompts/projects/*.mdc`：特定项目补充。

新增或修改项目文档系统前，先检查 `docs/rules/epap-project-doc-agent-sop.md`。每个项目的惯例文档为 `README.md`、`AGENTS.md`、`CHANGELOG.md`、`TODO.md`、`MILESTONE.md`、`docs/PRD.md`、`docs/TDD.md`，可选 `docs/MEMORY.md`。

每个工作流必须声明：

- 入口层。
- 权威事实源。
- 允许访问的下游层。
- 输出渲染器。
- 审计产物。
- 验证路径。

测试用户可见行为时，使用分层验证梯：

1. API 级确定性测试。
2. 控制面审计检查。
3. 涉及 UI 时，用 Codex 浏览器或 Chrome 做视觉/产品体验检查。
4. 声称真实用户操作可用时，用 `computer-use` 或设备级验证。
