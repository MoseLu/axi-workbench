# EPAP Prompt 层

EPAP prompt 层和 rules 层一样分级管理，但两者职责不同：

- `rules/` 定义组件允许做什么。
- `prompts/` 定义 agent 在不同上下文中如何思考、表达和执行。

## 文件格式

Prompt 正文使用 MDC 文件，不使用普通 `.md`：

```md
---
description: "给 agent 判断用途的说明"
globs: ["**/*"]
alwaysApply: true
epapLayer: "system"
locked: true
---

正文 prompt...
```

MDC 借鉴 Cursor Project Rules 的格式：frontmatter 负责元数据和加载策略，正文仍用 markdown 语法表达。目录内的 `README.md` 只用于人类说明，不作为 prompt 正文。

## 三层结构

| 层级 | 路径 | 生效范围 | 变更规则 |
| --- | --- | --- | --- |
| System | `prompts/system/*.mdc` | EPAP prompt runtime 的不可变底座 | 默认不可改；修改必须有 ADR/owner 决策 |
| Global | `prompts/global/*.mdc` | 所有项目通用 | 可受控迭代 |
| Project | `prompts/projects/*.mdc` | 指定项目 | 可随项目演进 |

## 合成顺序

1. 先加载 system。
2. 再加载 global。
3. 最后加载匹配 project。

冲突处理：

- system 永远优先。
- project 可以细化 global，但不能违反 system。
- global 不能覆盖 system，只能补充默认行为。

## 外部公开 Prompt 的使用边界

只允许纳入以下内容：

- 官方公开文档中的行为原则。
- GitHub 上公开项目的 prompt layering/rules 机制总结。
- 对公开材料的短摘录、摘要或改写模板。

不得纳入：

- 疑似泄露的完整 proprietary system prompt。
- Claude Code、Cursor 等产品未由官方明确公开的内部完整 system prompt。
- 违反来源许可或无法确认来源的长篇原文。

公开来源索引见 `prompts/global/references/public-ai-coding-prompts.md`。
