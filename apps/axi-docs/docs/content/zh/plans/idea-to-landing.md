---
id: axi-docs-zh-plans-idea-to-landing
title: 想法到落地方案契约
type: plan-contract
status: published
tags: [Axi Docs, 方案, grill-me, TODO, 执行]
created: 2026-06-13
modified: 2026-06-13
graph-title: 想法到落地方案契约
graph-tags: [Axi Docs, 方案, 执行]
description: 定义 grill-me 产物、长期方案记录与 Axi Todo 执行任务的归属边界。
---

# 想法到落地方案契约

## 放置规则

Axi Docs 承担长期方案。Axi Todo 承担执行队列。

如果一次 grill-me 会话产出了一组想法、取舍、约束、阶段和验收标准，规范做法是把权威方案写入 `docs/content/{locale}/plans/`，再为具体执行步骤创建或链接 Axi Todo 任务。

## 哪些内容属于 Axi Docs

- 问题陈述与目标结果
- 受众、owner 与受影响项目
- 访谈中暴露出的假设
- 决策、非目标与被拒绝的替代方案
- 从想法到落地的阶段计划
- 验收标准与验证证据
- 指向 Axi Todo 任务记录的链接
- 指向 ADR、PRD、项目档案或来源文档的链接

## 哪些内容属于 Axi Todo

- 任务标题与当前状态
- 优先级、owner、截止时间与依赖顺序
- agent 或 owner 应执行的下一步动作
- 指回权威方案页的链接
- 不应成为长期设计历史的完成备注

## 方案页模板

```markdown
# <方案名称>

## 目标结果

落地后应该有什么事实成立？

## 背景

这个想法从哪里来？哪些现有文档、任务或代码路径相关？

## Grill 结论

- 假设：
- 约束：
- 拒绝：
- 开放风险：

## 落地计划

1. 固化契约。
2. 实现或记录最小可用切片。
3. 用能证明主张的最小命令或审查完成验证。
4. 把执行任务链接回本方案。

## 执行链接

- Axi Todo：
- 相关文档：
- 验证：
```

## 完成规则

不要因为 Axi Todo 条目关闭就把方案标为已落地。只有当验收标准有证据，且文档仍能解释最终形态时，方案才算落地。
