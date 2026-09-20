# Axi Docs — 约束性经验日志 (docs/rules/)

> 本目录是 **axi-docs 项目内** 的"约束池",承载可被 hook 拦截、可被 agent 立即
> 消费的硬规则,与 ERROR.md(结构性 RCA)/ submit/(per-commit 流水)/ axi-rules
> rules/(工作区 SOP)有清晰边界。

## 它不是什么

- **不是** 文档类总结。每条规则是一段"机器/人都能照着做"的硬约束,**不是**叙事。
- **不是** 复盘 / RCA。结构性缺陷的复盘归 `docs/state/ERROR.md`(P0/P1/P2)。
- **不是** SOP / 流程规则。跨项目的 SOP 归 `projects/axi-rules/rules/*` (AR-* 体系)。
- **不是** per-commit 流水日志。提交流水归 `docs/logs/submit/`。

## 它是什么

每条 `R-NNN-*.md` 文件是 **一条约束**:

- 一段**触发场景**(什么时候这条规则开始生效)
- 一段**硬约束**(do / don't,带判定标准)
- 一段**守卫命令**(`pnpm --dir app rule:check-<id>`,违反即 exit 1)
- 一段**证据**(首次发现的 commit / 关联规则)
- 一段**相关**(上游规则、ERROR.md 条目、兄弟约束)

每条约束配对一个 Node 校验脚本,接入 `pnpm --dir app rule:check` 与
`pnpm --dir app verify` 链,违反即红并给出修复路径。

## 编号

- `R-NNN` 编号独立于 `AR-*`(axi-rules 编号空间),避免在 axi-rules 注册新分类的
  governance 影响面。
- 若某条 `R-NNN` 需要升级为工作区级 AR-* 规则,走
  `axi-rules/rules/<new-category>/AGENTS.md` 新分类提案;本目录作为该规则的
  素材池与历史档案,规则升级后本条目标记 `status: superseded-by:AR-XXX` 保留。

## 新增一条规则

1. 复制 `_template.md` 为 `RNNN-短描述.md`(NNN 从 `INDEX.md` 当前最大编号 +1)。
2. 按模板填 5 段(`Trigger` / `Constraint` / `Guard` / `Evidence` / `Related`),
   frontmatter 必填字段完整。
3. 在 `app/scripts/` 下新增 `check-<short-id>.mjs` 守卫脚本,**单文件可独立跑**,
   违反 exit 1,提示修复路径。
4. 在 `INDEX.md` 表格里加一行。
5. 在 `package.json` 的 `scripts` 段加 `rule:check-<short-id>` 一行,**并在
   `run-all-rule-checks.mjs` 的白名单里登记**(避免漏挂)。
6. 跑 `pnpm --dir app rules-doc:lint` + `pnpm --dir app rule:check` 验证通过后
   提交。

## 升格 / 降级

- **R-NNN → AR-***:工作区级化,提案到 `axi-rules`。
- **R-NNN → ERROR.md**:出现 P0/P1 故障后,同步开 ERROR.md 条目并把 `related.error`
  填上;R-NNN 标记 `status: active (promoted-to-error:YYYY-MM-DD-NN)`。
- **R-NNN active → deprecated / superseded**:在新条目里 `Related` 字段加
  `Supersedes: Rxxx`,旧条目 `status` 改 `superseded-by:yyy`,不在 INDEX.md 隐藏,
  保留可追溯。

## 验证入口

```bash
pnpm --dir app rules-doc:lint         # 校验 R-NNN 结构、frontmatter、INDEX 对齐
pnpm --dir app rule:check              # 跑全部 R-NNN 守卫
pnpm --dir app rule:check-<id>         # 单条守卫
pnpm --dir app verify                  # 含 rule:check 的全量校验
```

## 详见

- `INDEX.md` — 全表
- `_template.md` — 模板

---

*最后更新:2026-08-17 — ZC-DOCS-006 创建;首版承载 R001 ~ R003 三条约束*
