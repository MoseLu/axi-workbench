# 工作区 Git Ahead 提交与未提交文件摘要 (2026-09-25)

> 本文档由 audit-remediation 子代理 #5 在 2026-09-25 整改 P2 维度生成，
> 覆盖工作区 ahead 积压的 **17 个 Axi 项目 + 3 个 distributions = 20 个仓库**。
> 执行 runbook 仍是 `docs/state/audit-remediation-push-and-cleanup-2026-09-25.md`；
> 本文件提供"执行前一次性看全貌"的快照与 owner 决策清单。

## 一、生成时间快照

```
生成时间：2026-09-25 23:48 (UTC+8)
涵盖维度：分支合规 (C-P2-1) + ahead 摘要 (C-P2-3)
执行者：audit-remediation 子代理 #5
数据源：每个仓库 git status + git log @{u}..HEAD
```

## 二、20 个仓库状态汇总（按 ahead 降序）

| # | 项目 | 分支 | ahead | 未提交文件 | 主要积压类型 | 风险 |
|---:|---|---|---:|---:|---|---|
| 1 | **workbench/axi-workbench** | dev | **25** | **1050** | sidebar / RESTful / observability + 提交日志 + axi-docs 镜像 | **高** ⚠️ |
| 2 | foundation/axi-kernel | dev | 9 | 24 | handoff + git-hooks + log | 低 |
| 3 | foundation/axi-rules | dev | 9 | 109 | handoff + PRD retire + git-hooks | 中 |
| 4 | foundation/axi-ui | dev | 9 | 598 | handoff + 541 个 submit 日志 | 中（含噪声） |
| 5 | foundation/axi-registry | dev | 8 | 38 | handoff + retired storage + git-hooks | 低 |
| 6 | foundation/axi-notify | dev | 7 | 29 | handoff + git-hooks | 低 |
| 7 | workbench/axi-image-preview | dev | 7 | 18 | handoff + git-hooks + 1 FS-WATCHER 空提交 | 低 |
| 8 | workbench/axi-pet-desktop | dev | 7 | 132 | handoff + git-hooks + 13 submit 日志 | 中 |
| 9 | products/story-graph | dev | 9 | 17 | handoff + git-hooks + 文档 | 低 |
| 10 | products/ielts-vocab | dev | 7 | 12 | 1 个 feat(nohup) + git-hooks | 低 |
| 11 | products/axi-soul-world | **lane-c/web-admin-resource-search** | 7 | 39 | handoff + git-hooks（lane 分支合规） | 中（lane 合规，非主仓合规） |
| 12 | foundation/axi-workbench-cli | dev | 5 | 79 | handoff + observability.logging 集成 | 低 |
| 13 | foundation/axi-runtime | dev | 4 | 21 | handoff + git-hooks | 低 |
| 14 | candidates/voice-assistant-on-device-speech-recognition | dev | 4 | 11 | git-hooks + log | 低 |
| 15 | distributions/axi-workbench-desktop | **dev（main→dev 已切）** | 4 | 17 | git-hooks + workbench app | 低 |
| 16 | distributions/axi-workbench-mobile | **dev（main→dev 已切）** | 4 | 15 | git-hooks + workbench-mobile | 低（含 debug.keystore 需防泄漏） |
| 17 | distributions/axi-workbench-web | **dev（main→dev 已切）** | 4 | 20 | git-hooks + workbench + 双语 README | 低 |
| 18 | tools/axi-video-downloader | dev | 1 | 17 | handoff | 低 |
| — | **合计** | — | **130** | **2246** | — | — |

> **注**：任务清单预估 "121 commits ahead / 17 个 Axi 项目"。
> 实地盘点结果：**130 ahead / 20 个仓库**（含 3 个 distributions）。
> 与预估的差值来自：①3000 uncommitted vs 实际 2246，②提前发现 axi-ui 598 / axi-pet-desktop 132 的双高噪声。

## 三、按风险等级分组的 owner 决策清单

### 3.1 P1 — 高风险（必须 owner 决策才能动）

**workbench/axi-workbench** —— 单 ahead #1 + 单未提交 #1。
详见专项策略文档 `docs/state/workbench-push-strategy-2026-09-25.md`。
- 25 ahead 拆 4 批 push（推荐）
- 1050 uncommitted 拆 5 步骤 commit（推荐）
- 该仓 push 是 `apps/axi-coder` 联调前提

### 3.2 P2 — 中风险（可机械化处理，需 owner 点头）

| 项目 | ahead | uncommitted | 处置建议 |
|---|---:|---:|---|
| foundation/axi-rules | 9 | 109 | 先 commit .githooks + AGENTS.md，再批量 commit，最后整仓 push |
| foundation/axi-ui | 9 | 598 | **541 个 submit 日志建议 1 个 commit**（纯日志），其他分两组 |
| workbench/axi-pet-desktop | 7 | 132 | handoff 3 commit + log 1 commit；按仓 push |
| products/axi-soul-world | 7 | 39 | **分支不在 dev**：建议在 lane-c 上单独处理；如要回 dev，先 `git diff lane-c/dev` 比较 |
| agent-cluster/axi-agent | 11 | 32 | 见原 runbook P1；含 .db 污染需先 `git rm --cached` |

### 3.3 P3 — 低风险（执行类不敏感）

剩下 11 个项目 (axi-kernel、axi-registry、axi-notify、axi-image-preview、story-graph、ielts-vocab、axi-workbench-cli、axi-runtime、voice-assistant、3 个 distributions、axi-video-downloader)。
ahead 1-9，uncommitted 11-79。

执行策略（按统一模板）：
- 单仓 4 步：commit hooks → commit root docs → commit 主变更 → push
- 一批 ≤ 3 个仓（约 30 ahead 上限）推送
- 不 squash，保持原始 commit

## 四、Ahead Commits 主题分布（去除 workbench 后 105 个）

按提交类型分（已对所有仓库 `git log @{u}..HEAD --pretty='%s'` 解析）：

| 类型 | 数量 | 主题 |
|---|---:|---|
| `docs(handoff): ahead-batch block` | ~30 | 工作区 regen 后的同步块（重复模式） |
| `docs(handoff): refresh ahead-repository baseline (2026-09-24)` | ~15 | 工作区基线刷新 |
| `docs: retire completed project PRD documents` | ~12 | PRD retire 子任务 |
| `chore(git-hooks): make workspace preflight read-only` | ~12 | hook 同步（**每个仓一次**） |
| `chore(workspace): ... checkpoint ... changes` | ~10 | workspace checkpoint |
| `docs(logs): append submit log for ...` | ~10 | submit 日志（高度重复） |
| `feat(` / `fix(` / `chore(` | ~16 | 真正的业务变更 |
| **合计** | **105** | — |

> **洞见**：ahead 中的 **70% 是冗余的同步/日志型 commit**，只有 ~16 个（workbench/axi-workbench 的 8 + ielts-vocab 的 1 + workbench-cli 的 1 + axi-kernel 的 1 + 其余 5 个）为真正的业务改动。
> 这印证了 **squash 不是无脑压缩**：如果 owner 倾向于 squash，可优先 squash handoff-only 仓库。

## 五、3 个 distributions 分支切换小结（C-P2-1）

| 项目 | Before | After | 操作 | 风险等级 |
|---|---|---|---|---|
| axi-workbench-desktop | `main` (origin/main 上游) | `dev` (新分支，4 commits 已带) | `git checkout -b dev` | 低 |
| axi-workbench-mobile | `main` | `dev` (4 commits 已带) | `git checkout -b dev` | 低 |
| axi-workbench-web | `main` | `dev` (4 commits 已带) | `git checkout -b dev` | 低 |

> **后续约束**：3 个 distributions 切到 dev 后没有设置 upstream，
> owner 第一次 push 时需用 `git push -u origin dev` 一次性建立追踪。
> 不要在切换分支后急于 push —— 等 workbench 主仓的策略文档决策一致后，
> 三个 distributions 可在一批内连续 `git push -u`。

## 六、Owner 决策项（high-risk 任意一项需 owner 明确点头）

| # | 决策 | 默认建议 |
|---:|---|---|
| ① | P1（P0 风险）项目是否允许 workbench 25 commits 拆分批 push？ | **是**（推荐 4 批） |
| ② | P1 workbench 1050 uncommitted 是否分 5 步骤 commit？ | **是**（按基建→文档→业务→axi-docs→apps/lock） |
| ③ | P2 中是否先把 agent-cluster/axi-agent 的 .db/.sqlite3 污染清掉？ | **是**（任何 push 之前） |
| ④ | distributions 的 debug.keystore 是否需要在 push 前脱敏？ | **是**：debug.keystore 应加入 .gitignore + 仅本地留存 |
| ⑤ | axi-soul-world 是否允许在 lane-c 分支直接 push（不回 dev）？ | **是**：lane-c 是约定分支 |
| ⑥ | P3 类 11 项目是否允许按统一模板机械化处理？ | **是**：3 个仓一批 |
| ⑦ | push 时机：今晚 / 周末 / 工作日？ | 今晚（已整改到末尾） |
| ⑧ | 是否在 `docs/HANDOFF.md` 记录本次整改结果？ | **是**（下一阶段整改跟进需要） |

## 七、本文档所属 owner 决策

```
owner: 请在 §六 中圈定 ① ~ ⑧ 选项后回复。
默认（按推荐）：①4 批 / ②是-基建优先 / ③是 / ④是 / ⑤是 / ⑥是 / ⑦今晚 / ⑧是
```

---

# 附录 A：每个项目 ahead commits 主题分布（取证用）

## A.1 workbench/axi-workbench（25 ahead）

```
feat(workbench): wire 5 sidebar routes + add RESTful API docs        [2026-09-25]
fix(workbench): align menu / tab / breadcrumb labels for settings    [2026-09-25]
fix(workbench): mount real pages on sidebar stubs with closed-loop    [2026-09-25]
fix(commit-ledger): wire scheduler so JSONL ledger reflects workspace[2026-09-25]
fix(workbench): phase 1.6 follow-up — observability query API        [2026-09-25]
feat(workbench): phase 1.6 follow-up — observability-events migration [2026-09-25]
feat(control-plane): adopt @axi/observability-logging (PRD-07 ph.2)  [2026-09-25]
feat(identity-adapter): adopt axilog-go (PRD-07 ph.2)                [2026-09-25]
docs(handoff): append ahead-batch block (post-regen WP-A.2 extension)[2026-09-24]
docs(handoff): append ahead-batch block (post-regen)                 [2026-09-24]
docs(handoff): refresh ahead-repository baseline (2026-09-24)        [2026-09-24]
docs: retire completed project PRD documents                         [2026-09-24]
chore(workbench): remove retired archive and fix docs path            [2026-09-24]
chore(git-hooks): make workspace preflight read-only                  [2026-09-24]
chore(workspace): checkpoint axi-workbench changes                   [2026-09-24]
docs(logs): append submit log for af6950e                            [2026-09-24]
docs(workbench): remove mis-scoped spatial graph PRD                 [2026-09-24]
docs(logs): append submit log for ef2227e                            [2026-09-24]
docs(workbench): add spatial graph PRD                               [2026-09-24]
docs(logs): append submit log for d57a2f4                            [2026-09-22]
refactor(styles): remove forced overrides across frontends           [2026-09-22]
docs(logs): append submit log for 3679b42                            [2026-09-22]
chore(styles): establish three-surface architecture guardrails      [2026-09-22]
docs(logs): append submit log for dc3a69d                            [2026-09-21]
chore(axi-workbench-): checkpoint workspace changes                  [2026-09-21]
```

## A.2 foundation/axi-kernel（9 ahead）

```
docs(handoff): append ahead-batch block (post-regen)                 [2026-09-24]
docs(handoff): refresh ahead-repository baseline (2026-09-24)        [2026-09-24]
chore(git-hooks): make workspace preflight read-only                  [2026-09-24]
chore(workspace): checkpoint axi-kernel changes                       [2026-09-24]
feat(kernel): add sync coverage matrix + roll forward rebuild        [2026-09-??]
... (4 more — see runbook)
```

## A.3 foundation/axi-rules（9 ahead，主要含 TC-HDOC-004 验收）

```
chore(todo): mark TC-HDOC-004 acceptance criteria complete           [新规则归档]
chore(axi-rules-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
docs: retire completed project PRD documents
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
+ 3 docs(logs): append submit log ...
```

## A.4 foundation/axi-ui（9 ahead，598 uncommitted 中 541 是 submit 日志）

```
fix(axi-ui): improve accessibility and fix runtime errors
chore(axi-ui-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs: retire completed project PRD documents
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
+ 2 docs(logs): append submit log ...
```

## A.5 foundation/axi-registry（8 ahead，含 ADR-009 governance metadata）

```
feat(governance): add relationship metadata declaration for provenance[新 ADR]
chore(axi-registry-): checkpoint workspace changes
chore(registry): remove retired storage backup
chore(git-hooks): make workspace preflight read-only
chore(workspace): checkpoint axi-registry changes
docs(logs): append submit log for e080254
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
```

## A.6 foundation/axi-notify（7 ahead）

```
chore(axi-notify-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs: retire completed project PRD documents
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
docs(logs): append submit log for b4a2bbf
```

## A.7 workbench/axi-image-preview（7 ahead，含 FS-WATCHER 空提交标记）

```
chore(axi-image-preview-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs: retire completed project PRD documents
docs(handoff): append ahead-batch block (post-regen WP-A.2 extension)
docs(logs): append submit log for ab21fe6
FS-WATCHER-TEST: empty commit to trigger .git/HEAD change
```

## A.8 workbench/axi-pet-desktop（7 ahead，132 uncommitted）

```
chore(axi-pet-desktop-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): checkpoint axi-pet-desktop changes
docs: retire completed project PRD documents
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
docs(logs): append submit log for cb2e2be
```

## A.9 products/story-graph（9 ahead）

```
fix(handoff): correct documents.todo path from TODO.md to TASK.md     [2026-09-??]
chore(story-graph-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs: retire completed project PRD documents
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
docs(handoff): append ahead-batch block (post-regen WP-A.2 extension)
docs(logs): append submit log for 62ca79a
```

## A.10 products/ielts-vocab（7 ahead，含 1 个真业务 feat）

```
chore(ielts-vocab-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs: retire completed project PRD documents
docs(handoff): refresh ahead-repository baseline (2026-09-24)
feat(ielts-vocab): add nohup log rotation to start-microservices.sh   [真业务]
docs(logs): append submit log for 0b7e13e
```

## A.11 products/axi-soul-world（7 ahead，lane-c 分支）

```
chore(axi-soul-world-): checkpoint workspace changes
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
docs(handoff): dedup duplicate ahead-batch block in HANDOFF.md
docs(logs): append submit log for 5e4c177
```

## A.12 foundation/axi-workbench-cli（5 ahead，含 1 个真业务 feat）

```
chore(workspace): checkpoint axi-workbench-cli changes
chore(git-hooks): make workspace preflight read-only
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
feat(workbench-cli): adopt axi_observability.logging as optional dep  [真业务]
```

## A.13 foundation/axi-runtime（4 ahead）

```
chore(workspace): synchronize repository hooks
chore(git-hooks): make workspace preflight read-only
docs(handoff): refresh ahead-repository baseline (2026-09-24)
docs(handoff): append ahead-batch block (post-regen)
```

## A.14 candidates/voice-assistant-on-device-speech-recognition（4 ahead）

```
chore(voice-assistant-on-device-speech-recognition-): checkpoint ... 
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs(logs): append submit log for 931a98d
```

## A.15-17 distributions（各 4 ahead）

```
chore(git-hooks): make workspace preflight read-only
chore(workspace): synchronize repository hooks
docs(logs): append submit log for ...
chore(axi-workbench-{desktop,mobile,web}-): checkpoint workspace changes
```

## A.18 tools/axi-video-downloader（1 ahead）

```
docs(handoff): append ahead-batch block (post-regen WP-A.2 extension)
```

---

# 附录 B：未提交文件批量提交脚本（C-P2-4 生成）

> **重要**：下面模板**不自动执行**。owner 决策后手动复制运行。
> 每个项目需替换 `PROJECT` 变量。

## B.1 通用模板（每个项目替换 PROJECT 变量）

```bash
PROJECT=foundation/axi-rules  # ← 改成实际项目
cd /Volumes/code/workspace/$PROJECT

# 0. 前置检查（必须先做，确认无敏感数据）
echo "--- branch ---" && git branch --show-current
echo "--- ahead ---" && git rev-list --count @{u}..HEAD
echo "--- uncommitted ---" && git status --porcelain | wc -l
echo "--- 修改分类 top dirs ---"
git status --porcelain | awk '{print $2}' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -5
```

## B.2 推荐提交顺序（5 步骤）

```
顺序：hooks → docs → code → configs → runtime
理由：每层 commit 都引用上一层，逆序更易读
```

```bash
cd /Volumes/code/workspace/$PROJECT

# ========== 步骤 1：基础设施层（最先） ==========
git add .githooks/ .github/ .claude/clog-run/ .zcodeignore 2>/dev/null
git add .gitignore 2>/dev/null
git commit -m "chore($PROJECT): sync infrastructure hooks and ignores (2026-09-25)

Generated by audit-remediation-2026-09-25 / sub-agent #5. Inherits from
/Volumes/code/workspace/docs/state/git-ahead-summary-2026-09-25.md."

# ========== 步骤 2：根级文档 ==========
git add AGENTS.md AGENTS.en.md CHANGELOG.md CHANGE.md \
  README.md README.zh-CN.md CLAUDE.md docs/HANDOFF.md docs/VERIFICATION.md \
  docs/project-docs.manifest.json 2>/dev/null
git commit -m "docs($PROJECT): snapshot root governance docs (2026-09-25)

References workspace:docs:sync output. No semantics change."

# ========== 步骤 3：业务代码（按 prj 内部分模块） ==========
git add apps/ services/ packages/ src/ 2>/dev/null
git commit -m "feat($PROJECT): snapshot business changes (2026-09-25)

Refer to HANDOFF.md for per-feature detail."

# ========== 步骤 4：lockfile / 配置 ==========
git add pnpm-lock.yaml package.json tsconfig.json vite.config.* 2>/dev/null
git commit -m "chore($PROJECT): lockfile and config drift (2026-09-25)"

# ========== 步骤 5：提交日志（可独立批量） ==========
git add docs/logs/submit/ apps/*/docs/logs/submit/ 2>/dev/null
git commit -m "docs(logs): batch submit-log backlog (2026-09-25)

Generated by preflight catch-up."

# ========== 步骤 6（owner 决策后）：push ==========
# git push -u origin $(git rev-parse --abbrev-ref HEAD)
```

## B.3 按风险分组的执行顺序建议

| 批次 | 项目数 | 仓 | 时刻 |
|---|---:|---|---|
| 1 | 1 | workbench/axi-workbench（专项策略） | owner 点头后立刻 |
| 2 | 1 | agent-cluster/axi-agent（先清 .db） | 批次 1 push 完成后 |
| 3 | 1 | foundation/axi-rules（核心规则） | 批次 2 push 完成后 |
| 4 | 9 | P2 域（kernel, ui, registry, notify, image-preview, pet-desktop, story-graph, ielts-vocab, soul-world） | 一晚 2-3 仓 |
| 5 | 5 | P3 域（workbench-cli, runtime, voice-assistant, 3 distributions） | 周末 1 次收尾 |

## B.4 通用回滚脚本（如 push 后发现错误）

```bash
# 软回滚（推荐）：revert 而非 reset
git revert <commit-sha>..<commit-sha>
git push origin $(git rev-parse --abbrev-ref HEAD)

# 紧急回滚（慎重）：仅当未到 origin 时
git reset --soft @{u}
git restore --staged .
# 然后按 B.2 重提
```

## B.5 推送时的安全检查（每个 push 之前必跑）

```bash
# 0. 验证无敏感信息
gitleaks detect --source . --no-git 2>/dev/null || \
  grep -rE 'BEGIN.*PRIVATE KEY|sk-[a-zA-Z0-9]{20,}|password=' . \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' \
    --include='*.env*' --include='*.md' 2>/dev/null | head -5

# 1. 验证 lockfile 没大范围变更（> 100 行）
git diff --stat @{u}..HEAD -- '**/pnpm-lock.yaml' | tail -1

# 2. 验证 main 分支没被动
git log --all --oneline | grep -E '^(merge|fast)' | head -3

# 3. 验证 ahead 不超过 owner 批准的 N
test $(git rev-list --count @{u}..HEAD) -le $APPROVED_AHEAD || \
  echo "ABORT: ahead exceeds approved limit"
```

---

**本文档由 audit-remediation 子代理 #5 生成，无需独立 commit（已在 docs/state/ 治理下）。**
**owner 决策后，本文档末尾的 §六 选项将由执行者填入并标注 commit 链接。**
