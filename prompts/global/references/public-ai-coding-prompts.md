# 公开 AI Coding Prompt / Rules 参考

本文件只记录公开来源和可借鉴原则，不保存第三方完整 proprietary system prompt。

## Anthropic Claude.ai / Mobile System Prompts

来源：https://platform.claude.com/docs/en/release-notes/system-prompts

可借鉴原则：

- 官方公开的是 Claude.ai 网页端和移动端 system prompt 更新。
- 这些更新用于提供日期等上下文，并鼓励特定行为，例如用 Markdown 输出代码。
- 官方说明这些 system prompt 更新不适用于 Claude API。

EPAP 采用方式：

- 只借鉴“上下文显式化、Markdown 代码、行为原则公开记录”的做法。
- 不把 Claude.ai 完整 prompt 原文复制到 system 层。

## Claude Code System Prompt 边界

来源：https://github.com/anthropics/claude-code/issues/4141

可借鉴原则：

- Claude.ai 的 system prompt 有官方发布页。
- Claude Code 内部 system prompt 没有官方完整公开版本。
- 自定义行为应通过 `CLAUDE.md` 或 append system prompt 这类公开扩展面完成。

EPAP 采用方式：

- 不收录 Claude Code 内部 prompt 的第三方提取版本。
- 只借鉴分层扩展面：system 不可改，global/project 追加约束。

## Cursor Rules

来源：https://github.com/hutchic/.cursor/blob/main/docs/cursor-rules.md
官方文档：https://docs.cursor.com/en/context/rules

可借鉴原则：

- Cursor Project Rules 存放在 `.cursor/rules/*.mdc`。
- MDC 文件包含 frontmatter 元数据和正文内容。
- 常见 frontmatter 字段为 `description`、`globs`、`alwaysApply`。
- rules 是持久上下文，用于在模型上下文开始处提供稳定指导。
- project rules 放在项目目录，适合领域知识、项目流程和风格约定。
- user/global rules 适合个人偏好、沟通风格和通用编码约定。
- team rules 或更高层规则应优先于项目/用户规则。

EPAP 采用方式：

- 将 rules 和 prompts 分开：rules 管权限和边界，prompts 管行为和表达。
- 建立 system/global/project 三层 `.mdc` prompt。
- 同步提供 `.cursor/rules/*.mdc` 兼容入口，让 Cursor 能读取 EPAP 边界。

## ccc Layered Claude Launcher

来源：https://github.com/3rd/ccc

可借鉴原则：

- 配置可按 global、preset、project 分层加载。
- prompt 可以分成 system 与 user/project 指令。
- 可以输出合成后的 prompt 用于调试。

EPAP 采用方式：

- 使用 `prompt-layer.manifest.json` 记录三层结构和冲突策略。
- 后续 control-plane 可增加“合成 prompt 预览/审计”能力。
