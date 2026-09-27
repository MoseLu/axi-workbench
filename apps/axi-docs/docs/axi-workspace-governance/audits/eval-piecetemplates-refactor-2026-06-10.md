# 评估：模板化 `PIECE_TEMPLATES`

> 评估日期：2026-06-10
> 来源：`docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md` P2 #3
> 评估人：axi-docs 维护者
> 结论：**不做**（不推荐引入）

## 1. 现状

`app/scripts/build-projects-index.mjs` 的 `PIECE_TEMPLATES` 是 179 行的内联对象，键为 piece 名（`README.md` / `AGENTS.md` / `INDEX.md` / `TODO.md` / `MILESTONE.md` / `PRD.md` / `TDD.md`），值是返回字符串数组的箭头函数（`ctx` 注入 project 上下文）。所有 7 件套共用同一上下文 `ctx = { project, locale, pieces: PIECES }`。

**优点**：
- 字符串数组 + `\n.join` 是 Node.js 最朴素的模板机制，零依赖、零运行时开销。
- 每个 piece 是独立函数，单元内聚，diff review 容易（不像 Handlebars 模板还要追 `{{...}}` 变量）。
- 类型安全（`ctx.project.name` 等都在 JS 编译期校验）。

**缺点**：
- 179 行集中在一个文件，要给 README/AGENTS/INDEX 等加新段落需要改源码。
- 7 个 piece 各有"自己的小骨架"，初读时要在多段代码间跳跃。

## 2. 候选方案

### 方案 A：保留现状

啥都不做。

### 方案 B：抽出到 JSON / YAML 模板

```json
{
  "README.md": {
    "title": "{project.name}",
    "subtitle": "Workspace project dossier. Source of truth: `{project.path}`.",
    "sections": [
      { "heading": "Summary", "body": "{project.purpose || '_No purpose..._'}" },
      { "heading": "Stack", "body": "{project.stack || '_Stack not recorded..._'}" }
    ]
  }
}
```

需要写一个 mini 模板解析器（替换 `{project.x}`），并保留 `ctx.locale === 'en' ? 'zh' : 'en'` 这类条件。

**评估**：复杂度 100+ 行（解析器 + 模板文件 + 测试）；节省原文件 30 行。**净亏**。

### 方案 C：抽出到独立 `.tmpl.md` 文件

把 7 个 piece 各拆成一个 `.tmpl.md` 资源文件，build 脚本读模板文件 + 做 `String.replace` 替换 `{project.x}`。

**评估**：拆出去后 build 脚本只剩"加载 + 替换"，逻辑更简单；但失去 IDE 跳转、失去类型校验、模板要写 `{{...}}` 包围。**仅在模板有 ≥5 个**且**改动频繁**时划算。**当前 7 个 piece 改一次要 3 个月**，**净亏**。

### 方案 D：拆成独立函数（轻度重构）

把每个 `PIECE_TEMPLATES[piece]` 的箭头函数抽成 `function buildReadmeTemplate(ctx)` 这样的命名函数。

**评估**：50 行小重构，类型安全保留，可读性微升。**可做可不做的可选重构**。建议**留到下个大规模 dossier 改动时**顺手做。

## 3. 推荐

**保持方案 A**。理由：

1. PIECE_TEMPLATES 的核心是**字符串生成**，不是**模板渲染**。把它从字符串数组改造成模板引擎是"用锤子敲钉子"。
2. 当前代码**已经能通过 projects:check 验证 322 个 dossier 文件**——它的产物的正确性是受控的；改它没有量化收益。
3. 7 件套是 Axi Docs 与 build 脚本的稳定契约，要改也是改 PIECES 列表、PIECE_TEMPLATES 内部结构。

## 4. 何时重新评估

满足以下任一条件时重新评估（建议升至 P0/P1）：

- [ ] PIECE_TEMPLATES 长度 > 500 行（当前 179）
- [ ] 出现 ≥3 个 piece 的"条件渲染"（locale-specific sections / i18n 内联）
- [ ] 团队里出现"为什么 README 模板在 .mjs 里"的 review 阻塞

当前 3 条都未触发。

---

*评估在 axi-docs `docs/audits/` 留底；本评估本身就完成了 P2 #3 的"决定要不要做"环节。*
