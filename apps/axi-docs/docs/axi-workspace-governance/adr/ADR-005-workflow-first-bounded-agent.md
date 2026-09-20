# ADR-005: Workflow-first，Agent 仅作为受限探索执行器

## 状态

Accepted — 2026-08-10。

## 背景

工作区已经拥有确定性工作流、规则/SOP、文档 MCP 和 Agent 运行时。把可枚举
的业务路径交给模型现场选择工具和循环，会降低复现性、成本可预测性、延迟上界
和安全边界的可控性。

## 决策

采用 Workflow-first hybrid：

- `axi-rules` 定义控制流归属和可验证证据；
- 工作流引擎持有路由、编排、审批、重试、取消和审计；
- Agent 平台仅执行有路由凭证的 `bounded_agent` 只读探索；
- `axi-docs` 为 Agent 提供带版本引用的只读上下文，文档写入必须变为副作用提案；
- 跨仓边界使用 `task-execution-routing/v1`，而不是相邻仓源码导入。

工作流路线固定为 `workflow`、`bounded_agent`、`escalate`。命令、写入、
外部副作用、权限提升、未知请求或任何预算/工具/沙箱越界均走 `escalate`。

## 后果

- `strategy_mode`、`use_subagent_mode` 和类似历史字段仅可作为输入建议，不能直接
  启动执行或覆盖硬规则。
- 每个新任务都必须持久化版本、路由决定、`traceId` 和幂等键。
- Agent 的副作用输出必须经过 durable approval，并与不可变 `actionDigest` 精确匹配。
- 正式生产启用仍需独立发布授权；本 ADR 不构成生产放量许可。

## 验证

- `node --test scripts/task-execution-routing-contract.test.mjs`
- `workspace-project validate`
- 各消费者的路由、兼容、审批、工具权限和事件测试。
