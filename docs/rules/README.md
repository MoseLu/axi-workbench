# EPAP 规则库

本目录存放强制运行规则。它们不是普通设计笔记，而是定义 EPAP 各组件允许做什么、不允许做什么。

## 文档库分层

| 分层 | 用途 | 示例 | 可变性 |
| --- | --- | --- | --- |
| Rules | 强制运行规则 | SOP、安全策略、层级边界 | 少改，需审慎 |
| Playbooks | 可重复执行流程 | E2E 测试流程、发布流程、故障处理 | 受控更新 |
| Facts | 当前事实源摘要 | 项目目录、能力注册表 | 由摄入/同步更新 |
| Memory | 历史观察和偏好 | 用户语言习惯、项目状态、历史 run | 带来源追加/更新 |
| Soul | 稳定产品身份和决策原则 | 语气、使命、UX 姿态、安全原则 | 少改，需明确决策 |
| Heartbeat | 周期检查和活性契约 | 健康检查、提醒、过期任务检查 | 调度执行 |
| Audit | 不可变执行证据 | run 日志、审批、截图、任务输出 | 只追加 |

不要把这些层混成一个知识桶。用户查询可以跨层读取，但写入必须落到正确分层，并携带来源。

## Prompt 层

Prompt 与 Rules 并列管理，目录为 [`../../prompts`](../../prompts)：

- System：不可变底座。
- Global：所有项目通用。
- Project：项目级补充。

## 项目文档系统

每个纳管项目的文档接入规则见 [`epap-project-doc-agent-sop.md`](./epap-project-doc-agent-sop.md)。标准模板见 [`../templates/project-docs`](../templates/project-docs)。
