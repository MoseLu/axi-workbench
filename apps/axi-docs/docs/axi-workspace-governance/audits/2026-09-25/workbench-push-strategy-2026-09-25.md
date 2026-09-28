# workbench/axi-workbench 专项 Push 策略 (2026-09-25)

> 本文档是 `docs/state/audit-remediation-push-and-cleanup-2026-09-25.md` 的专项补充，
> 专门处理 **workbench/axi-workbench** 单一仓库的 ahead 25 commits + 1050 uncommitted 文件积压。
> 这是工作区所有项目里 ahead 积压最严重的单一仓库（ahead #1，未提交文件数 #1）。

## 一、当前状态（2026-09-25 现场快照）

```
$ cd /Volumes/code/workspace/workbench/axi-workbench
$ git branch --show-current
dev                                       # 分支策略已合规
$ git rev-list --count origin/dev..HEAD
25                                        # ahead 25 commits
$ git status --porcelain | wc -l
1050                                      # uncommitted
$ git status --porcelain | awk '{print $1}' | sort | uniq -c
   1 D                                    # 删除：ADR-005（被 ADR-009 替换）
  23 ??                                   # untracked：新文件
1026 M                                    # 修改
```

> **关键事实**：项目已经在 dev 分支（合规）。ahead 25 commits 全部在 dev 上、未推到 origin。
> 1050 uncommitted 文件分散在该仓的 monorepo (apps/axi-coder, apps/axi-artboard, services/control-plane, services/identity-adapter, apps/axi-docs) 上。

## 二、25 Ahead Commits 时间线与类型分布

按提交类型分（已通过 `git log origin/dev..HEAD --pretty='%s'` 解析）：

| 类型 | 数量 | 代表 commit |
|---|---:|---|
| `feat(` 工作台功能 | **4** | `feat(workbench): wire 5 sidebar routes + add RESTful API docs` |
| `fix(` 工作台修复 | **4** | `fix(workbench): align menu / tab / breadcrumb labels` |
| `feat(` 控制面 | **2** | `feat(control-plane): adopt @axi/observability-logging` |
| `refactor(` 样式 | **1** | `refactor(styles): remove forced overrides across frontends` |
| `chore(` 工作流 | **5** | `chore(git-hooks): make workspace preflight read-only` |
| `docs(` 日志 | **10** | `docs(logs): append submit log for ...` |
| `other` | **1** | `chore(axi-workbench-): checkpoint workspace changes` |
| **合计** | **25** | — |

按提交日期分（按时间倒序）：

| 日期 | 数量 | 主要内容 |
|---|---:|---|
| 2026-09-25 | **8** | 5 路由 sidebar、RESTful API、`@axi/observability-logging` 集成 |
| 2026-09-24 | **11** | docs/PRD retire、git-hooks sync、handoff 块 regen |
| 2026-09-22 | **4** | 样式 three-surface 架构 + 日志 |
| 2026-09-21 | **2** | checkpoint + 日志 |

## 三、25 Ahead Commits 推荐分批 Push 策略（owner 决策）

### 推荐方案：4 批小规模 push

把 25 commits 拆成 **4 批**，每批 ≤ 7 commits，按"主题"而非"时间"分组。
避免一批 push 太大、CI 出错时回滚困难。

| 批 | commit 数 | 主题 | 涉及范围 | 推送建议 |
|---|---:|---|---|---|
| **Batch 1** | 4 | feat(workbench): 工作台核心功能 | sidebar 5 路由、RESTful API docs、轴 1.6 observability-tab | 现 push：内容稳定、影响范围局限于 workbench 仓本身 |
| **Batch 2** | 2 | feat(control-plane): observability-logging / axilog-go 集成 | services/control-plane、services/identity-adapter | 独立 push：observability-logging 仓可能在 npm 上有发布等待 |
| **Batch 3** | 4 | fix(workbench) + refactor(styles) | 修复 + 样式重构 | 等 Batch 1 / 2 CI 通过后再 push |
| **Batch 4** | 15 | docs(handoff) + chore(git-hooks) + checkpoint | docs/logs/submit、.githooks、archive 清理 | **可以 squash**：纯文档/日志类，合并成 2-3 个 commit |

### 备选方案

- **A：** 全部 squash 成 1-3 个 commit 一次性 push
  - 优：快、CI 单次跑
  - 缺：丢失中间 commit 信息，影响审计
- **B：** 25 commits 完全保留、一次性 push
  - 优：保留完整历史
  - 缺：单批大、CI 失败回滚成本高（推荐 ❌）

**owner 决策**：选分批（默认）、squash、还是一次性。

## 四、1050 Uncommitted 文件分类与提交顺序

### 4.1 分类总览

按 `git status --porcelain | awk '{print $2}'` 汇总（directory 级别 top-20）：

| 目录 | 修改文件数 | 类型 | 是否建议 commit |
|---|---:|---|---|
| `docs/logs/submit/` | **316** | submit 日志（自动生成） | 是（commit hook 后续需要） |
| `apps/axi-docs/docs/logs/submit/` | **28** | axi-docs submit 日志 | 是 |
| `apps/axi-docs/docs/axi-workspace-governance/` | **14** | governance 镜像文档 | 是（与源同步） |
| `apps/axi-docs/docs/content/{zh,en}/projects/axi-*` | ~120 | 项目 PRD 镜像（双语） | 是（自动同步产物） |
| `apps/axi-coder/*` | ~11 | 主应用的文档+ lockfile | **分两组：先代码、后 lock** |
| `apps/axi-artboard/*` | ~3 | 画板应用文档 | 是 |
| `services/control-plane/*` | 2 个 untracked + lock | control-plane 新增源文件 + lock | 是（业务代码） |
| `services/identity-adapter/*` | 1 个 untracked + lock | axilog-go 集成 + lock | 是 |
| `apps/workbench/src/pages/admin/*` | ~9 | 工作台 admin 页面代码 | 是（业务代码） |
| `apps/workbench-desktop/scripts/restart-local.mjs` | 1 untracked | 工作台桌面脚本 | 是 |
| `apps/axi-docs/docs/axi-workspace-governance/adr/` | 1 D + 2 ?? | ADR 重写（005 删除，009/010 新增） | 是 |
| 根目录文件（`AGENTS.md`、`CHANGELOG.md`、`CHANGE.md`、`README*.md`、`.github/workflows/*`、`.claude/clog-run/*`、`.githooks/*`） | 多个 | doc + workflow + hook | **必须先 commit**（其它 commit 引用这些 hook） |

### 4.2 推荐的提交顺序（5 步骤）

按"先基建 → 再业务 → 最后产物"原则，分 5 批 commit（每批独立 message）：

```bash
cd /Volumes/code/workspace/workbench/axi-workbench

# ========== 步骤 1：基础设施层（最优先） ==========
# 提交 git-hooks、github workflows、CL 报告、.zcodeignore、env.bak 删除
# 理由：后续所有 commit 都受 post-commit hook 校验，必须先把 hook 自身冻结
git add .githooks/ .github/ .claude/clog-run/ .zcodeignore
git rm --cached .env.bak.1790260864 2>/dev/null || true
git commit -m "chore(workbench): sync infrastructure hooks and CL reports (2026-09-25)

- .githooks/preflight and post-commit synced with workspace standard
- .github/workflows/axi-rules-hooks.yml brought current
- .claude/clog-run/ manifest phase 1/2 + report 1/2/4/5 captured
- .zcodeignore registered locally

Generated by audit-remediation-2026-09-25 / sub-agent #5."

# ========== 步骤 2：根级文档 ==========
git add AGENTS.md AGENTS.en.md CHANGELOG.md CHANGE.md \
  README.md README.zh-CN.md CLAUDE.md 2>/dev/null
git commit -m "docs(workbench): snapshot root governance docs (2026-09-25)

Covers AGENTS / CLAUDE / CHANGELOG / CHANGE / README updates accumulated
during the ahead batch. Referenced by workspace:docs:sync."

# ========== 步骤 3：业务代码（高价值、低噪声） ==========
# services/control-plane 新增 fs-watcher / repos-loader + identity-adapter go.work.sum
# apps/workbench admin 页面新文件
# scripts/ 新增的 check-* 脚本
git add services/control-plane/src/commit-ledger/fs-watcher.mjs \
  services/control-plane/src/commit-ledger/repos-loader.mjs \
  services/identity-adapter/go.work.sum \
  apps/workbench/src/pages/admin/Observability.tsx \
  apps/workbench-desktop/scripts/restart-local.mjs \
  eslint.config.mjs \
  scripts/check-axi-ui-adoption.mjs \
  scripts/check-contracts.mjs \
  scripts/check-dependency-policy.mjs \
  scripts/check-ui-imports.mjs
git commit -m "feat(workbench): add control-plane observability + UI contract linters

- fs-watcher + repos-loader for the live commit-ledger
- Observability.tsx admin page (PRD-07 phase 2 surface)
- restart-local.mjs desktop shortcut
- 4 check-* contract/adoption linters for the three-surface policy

Refs: docs(state)/workbench-push-strategy-2026-09-25.md."

# ========== 步骤 4：axi-docs 镜像（双语 PRD + governance 镜像） ==========
git add apps/axi-docs/docs/axi-workspace-governance/ \
  apps/axi-docs/docs/content/ \
  apps/axi-docs/docs/logs/submit/
git commit -m "docs(axi-docs): refresh project + governance mirrors (2026-09-25)

Snapshot mirrors for workspace:docs:sync. Two ADRs (009/010) added,
one retired (005). Bilingual project entries brought current.

Generated. Source of truth remains /Volumes/code/workspace/foundation/axi-rules/."

# ========== 步骤 5：应用级文档 + lockfile + 残留 ==========
# 每个 app 一个 commit，避免 lock 湮没 CHANGELOG/TODO 等业务变更
for app in axi-coder axi-artboard axi-docs; do
  git add apps/$app/
  git commit -m "chore($app): snapshot app docs and lockfile drift (2026-09-25)"
done

# docs/logs/submit 的 316 个 submit 日志（一个 commit 即可，纯日志）
git add docs/logs/submit/
git commit -m "docs(logs): batch-submit deferred submit-log backlog (2026-09-25)

Generated by workbench preflight catch-up; 316 entries."
```

### 4.3 不建议 commit 的内容（owner review 后丢弃）

- `.env.bak.1790260864`：明显为备份文件，确认无敏感信息后**仅 `rm`** 不进 git
- 其他明显临时文件 / `node_modules` 碎片：先验证 `.gitignore` 覆盖

## 五、Owner 决策项（high-risk 任意一项需 owner 明确点头）

| # | 决策 | 默认建议 |
|---:|---|---|
| ① | push 25 ahead commits 的策略：分 4 批 / squash / 一次性 | **分 4 批**（最稳） |
| ② | 1050 uncommitted 是否全部 commit + push？ | 全部（5 步骤顺序） |
| ③ | 是否先单独 push 单仓分支（不在 root 工作区推送）？ | 是，按本仓单独 push |
| ④ | workbench/axi-workbench 是否允许 squash 历史？ | **否**（保持 25 个原始 commit） |
| ⑤ | 推送时是否合并到 main（一次性合入）？ | **否**：保持 dev，由 owner 复核后 merge |
| ⑥ | 是否允许临时 `.env.bak` 物理删除（不仅是 untrack）？ | 仅在脱敏确认后 |

## 六、撤销 / 回滚预案

如已 push 后发现问题：

```bash
# 软回滚（推荐）：revert 而非 reset，不重写历史
git revert <commit-sha>..<commit-sha>
git push origin dev

# 紧急回滚（慎重）：仅当上述提交未到 origin 时
git reset --soft origin/dev
git restore --staged .
# 然后按 4.2 重提
```

## 七、引用与上下游

- **上游总 runbook**：`docs/state/audit-remediation-push-and-cleanup-2026-09-25.md`
- **workspace 治理规则**：`foundation/axi-rules/AGENTS.md` (AR-WORKBENCH-* if any)
- **README**：`workbench/axi-workbench/AGENTS.md` 是变更行为最大约束
- **下游消费者**：`axi-coder` (apps/axi-coder/) 必须先有 dev 最新才能联调；本仓 push 完成是 axi-coder 联调的前提。
- **其它 ahead 项目**：`docs/state/git-ahead-summary-2026-09-25.md`（同次整改生成）

## 八、本文档所属 owner 决策

```
owner: 请在 §五 中圈定 ① ~ ⑥ 选项后回复。
默认（按推荐）：①4 批 / ②全部 / ③是 / ④否 / ⑤否 / ⑥是-脱敏后
```

**本文档本身在 `docs/state/` 治理下生成，无需独立 commit。**
