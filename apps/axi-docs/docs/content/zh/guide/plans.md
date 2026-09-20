---
id: axi-docs-zh-guide-plans
title: 方案库
type: guide
status: published
tags: [Axi Docs, 方案, 想法, 执行, 中文]
created: 2026-06-13
modified: 2026-06-13
graph-title: 方案库
graph-tags: [Axi Docs, 方案]
description: 用 Axi Docs 保存长期“想法到落地”方案，用 Axi Todo 跟踪执行。
---

## 用途

方案库把“想法到落地”的材料从任务队列中分离出来。这里存放未来的人和 agent 需要检索、引用、修订的长期方案记录。

## 权威来源

权威方案写在 `docs/content/{locale}/plans/`。存在翻译时，英文与简体中文保持相同相对路径。

Axi Todo 仍然是执行队列。Todo 条目应链接回方案页，而不是复制方案正文。

## 推荐流程

1. 捕捉想法，或用 grill-me 追问到目标结果、约束和被拒绝的替代方案足够清楚。
2. 在 Axi Docs 写入带 frontmatter、验收标准和验证备注的方案。
3. 只为可执行切片创建 Axi Todo 任务。
4. 每个任务链接回方案页。
5. 最终形态变化时更新方案；普通任务状态变化不写入方案正文。

## 从这里开始

- [方案库](/docs/axi-docs-zh/plans/README)
- [想法到落地方案契约](/docs/axi-docs-zh/plans/idea-to-landing)
