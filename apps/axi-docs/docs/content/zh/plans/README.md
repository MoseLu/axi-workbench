---
id: axi-docs-zh-plans-root
title: 方案库
type: index
status: active
tags: [Axi Docs, 方案, 想法到落地, 执行]
created: 2026-06-13
modified: 2026-06-13
graph-title: 方案库
graph-tags: [Axi Docs, 方案]
description: 长期保存“想法到落地”方案，执行任务则链接到 Axi Todo。
---

# 方案库

本目录是“想法到落地”方案的权威来源。

适合放在这里的内容：

- 原始想法以及它要解决的问题
- grill-me 过程中被追问出来的假设
- 被拒绝的替代方案与判断标准
- 落地阶段、验收检查与验证证据
- 指向 Axi Todo 执行任务的链接

不要把本目录当成任务队列。Axi Todo 负责任务状态、排期和下一步动作。方案页可以链接到 Axi Todo 条目，但方案正文应足够稳定，让未来的读者和 agent 能复原这件事为什么存在。

## 当前文档

- [想法到落地方案契约](idea-to-landing.md)
- [知识中枢稳态化方案](knowledge-hub-stability-plan.md) —— 草稿，覆盖同步 I/O / CORS / Vite-MCP 重复抽取三项 owner action（底稿来自 `todo/04-roadmap.md` 与 `todo/02-legacy-audit.md`）

## 方案状态说明

- `draft` —— 想法已捕获，grill-me 进行中，尚未开执行任务。
- `active` —— grill-me 已收敛，执行任务挂在 Axi Todo，方案正文稳定。
- `landed` —— 验收标准有证据，文档仍能解释最终形态。
- `superseded` —— 被后续方案替代，正文里链向继任方案。
