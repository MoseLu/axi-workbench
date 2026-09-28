# Audit Report — batch-snapshot-dirty.py Non-Compliance — 2026-09-26

> 治理级审计结论：`batch-snapshot-dirty.py` 在 2026-09-25/26 audit-remediation
> 清理轮次产出的 21 个 commit，**形式上**满足 AR-GIT-005（Lore trailer 五段
> 齐全 + hook 触发），但**实质上**违反 AR-GIT-001 与 AR-GIT-002 的语义约束。
> 本报告固化证据、记录根因、给出修复动作与 owner 决策项。

## 1. 范围

- 审计对象：`foundation/workspace-governance/scripts/batch-snapshot-dirty.py`
- 影响 commit：2026-09-25 23:59 ~ 2026-09-26 00:20 之间的 21 个
  `chore(audit-remediation) / snapshot ... / chore(githooks)` 系列 commit
- 影响项目：11 个 axiom-owned 仓库 + 跨项目治理根目录
  （`foundation/axi-observability`、`foundation/axi-ui`、`foundation/axi-kernel`、
  `workbench/axi-pet-desktop`、`foundation/axi-rules`、`foundation/axi-sync`
  等）

## 3. 审计定性

| 维度 | 结论 |
|---|---|
| `--no-verify` 绕过 | **无证据**。脚本全程调用 `git commit -F <msg>`，未设 `git commit --no-verify`，未设 `AXI_LORE_TRAILER_BYPASS=1`。 |
| Lore trailer 格式绕过 | **无**。`commit-msg` hook 仍触发；5 段 trailer（Tested / Not-tested / Confidence / Scope-risk / Directive）在每个 commit 中齐全。 |
| Lore trailer 语义真实性 | **存在实质问题**。`Scope-risk` 文案与实际 diff 内容不符：`low - governance files only, no production logic changed` 多次出现，但同 commit 实际包含 9/17 个业务/测试源码路径。 |
| AR-GIT-001（auto-commit only verified task boundaries） | **已实质违反**。脚本对 dirty tree 的处理只按路径黑名单过滤 `is_business_code`，未检查任务边界、其它 agent/owner 未完成改动、混合 unrelated edits。 |
| AR-GIT-002（group commits by feature intent） | **已实质违反**。脚本对每个项目只产出 1 个 "snapshot" commit；混合了 docs、scripts、TODO、index、configuration、auto-generated submit logs、githooks 同步等至少 6 类不同 feature intent 的变更。 |
| AR-GIT-003（submit log） | **未满足**。脚本未生成 `docs/logs/submit/<timestamp>-batch-submit.md`；commit message 内的"Includes N files (skipped X business code)"不构成 AR-GIT-003 要求的 6 项 submit log。 |
| AR-GIT-004（push conditional, never automatic to main） | 脚本本身不自动 push，但批量 commit 时未检查分支保护（main / master / release）。 |
| AR-GIT-005（mandatory trailer + workspace hook sync） | 形式满足（5 trailer 齐全）。实质：hook 漂移未修复（见 §6）。 |
| AR-GIT-006（trailer set data-driven） | 形式满足（使用 fallback 列表）。无违规。 |

**最终定性**：这 21 个 commit **不能作为合规 Lore 提交接受**，也 **不能作为
批量提交先例**。`pnpm workspace:audit` 0 errors **不能**推翻本结论，因为
audit 只审计 registry/path contract，不审计 commit 内容、提交分组与 trailer
语义真实性。

## 4. 证据：axi-observability@180c103 是典型样本

commit `180c103 chore(audit-remediation): snapshot dirty governance files`：

```
control-plane/Dockerfile                           |   8 +
control-plane/package.json                         |  14 ++
control-plane/src/auth.mjs                         |  53 +++++
control-plane/src/backend-facade.mjs               |  31 +++
control-plane/src/event-schema.mjs                 |  74 ++++++
control-plane/src/event-store.mjs                  | 101 +++++++++
control-plane/src/server.mjs                       | 126 +++++++++++
control-plane/test/control-plane.test.mjs          |  83 +++++++
docker-compose.yml                                 |  26 ++-
go/axilog/context.go                               |  19 +-
go/axilog/go.mod                                   |  34 ++-
go/axilog/go.sum                                   |  85 +++++--
go/axilog/tracing.go                               | 222 ++++++++++++++++++
go/axilog/tracing_test.go                          |  159 +++++++++++++
package.json                                       |   6 +-
schemas/workspace-event.v1.schema.json             |  30 +++
...an-sess_1956d85d-5bdd-49f1-9668-688580be9679.md | 251 +++++++++++++++++++++
17 files changed, 1293 insertions(+), 29 deletions(-)
```

trailer 原文：

```
Tested: git status + file content review
Not-tested: full CI pipeline + consumer integration
Confidence: medium
Scope-risk: low - governance files only, no production logic changed
Directive: proceed
```

**事实核对**：

- 9/17 文件是业务源码或测试源码（`control-plane/src/*.mjs` × 5 +
  `control-plane/test/control-plane.test.mjs` × 1 +
  `go/axilog/context.go` × 1 + `go/axilog/tracing.go` × 1 +
  `go/axilog/tracing_test.go` × 1）。
- 新增 1293 行 / 删除 29 行。
- `Scope-risk: low - governance files only, no production logic changed` 与
  实际 diff 不符。

## 5. 根因：`batch-snapshot-dirty.py:96` 的设计缺陷

```python
# 仅按路径黑名单过滤；不验证 task boundary / feature grouping / 业务源码
# / 其它 agent/owner 未完成改动。
for f in files:
    if is_business_code(f):
        skipped.append(f)
    elif is_gitignored(f, project_path):
        skipped.append(f)
    else:
        committable.append(f)
```

具体缺陷：

1. **黑名单覆盖不全**：`SKIP_PATTERNS` 只列出 axi-coder / axi-artboard /
   workbench / frontend / backend/axi_agent 等少数目录；不 cover
   `control-plane/src/`、`go/axilog/`、`apps/*/src/*`（实际存在）
   `packages/*/src/*`、`services/*/src/*` 等常见业务源码目录。
3. **缺失 AR-GIT-001 检查**：脚本不询问 task intent、不验证 diff 在 task
   write boundary 内、不检查 HANDOFF/CHANGE.md 更新、不询问是否含其它 agent
   / owner 未完成改动。
4. **缺失 AR-GIT-002 分组**：每个项目 1 个 commit 即可接受，混合 docs +
   scripts + TODO + index + submit logs + githooks 等 ≥6 类 intent。
5. **缺失 AR-GIT-003 submit log**：脚本不生成 `<timestamp>-batch-submit.md`。
6. **模板化 trailer**：所有 commit 共享同一段 trailer 文本（含写死的
   `Scope-risk: low - governance files only, no production logic changed`），
   不根据实际 diff 计算。
7. **缺失 AR-GIT-004 分支保护**：批量 commit 时未拒绝 `main` / `master` /
   release 分支。
8. **`is_gitignored` 分支为死代码**：`git status --porcelain` 默认不输出
   ignored 文件，未加 `--ignored` 时此分支永远不被命中。
9. **临时文件 `/tmp/commit-msg-<...>.txt` 不可移植**：`/tmp` 在 macOS 是
   `/private/tmp` 符号链接；在 Linux 行为不同；脚本未做平台适配。

## 6. 顺带发现：`workspace-git-hooks verify` 漂移

`pnpm workspace:git:hooks:verify` 当前失败（4 个项目）：

```
- candidates/pelagic: core.hooksPath=.git/hooks
- candidates/pelagic: .githooks/post-commit is missing
- candidates/pelagic: .githooks/commit-msg is missing
- docs/axi: core.hooksPath=.git/hooks
- docs/axi: .githooks/post-commit is missing
- docs/axi: .githooks/commit-msg is missing
- foundation/axi-observability: core.hooksPath=.git/hooks
- workbench/axi-workbench: .githooks/post-commit is not-executable
- workbench/axi-workbench: .githooks/commit-msg is not-executable
```

这与 `batch-snapshot-dirty.py` 的执行路径相关——脚本直接 `git add` + `git
commit`，未先调用 `workspace-git-hooks.mjs install`。在 hook 未安装或
executable 缺失的仓库中，"Lore trailer 形式齐全"的唯一保证来自
`axi-commit-msg-lore-trailer.mjs` 的兜底 fallback（AR-GIT-006 §Fallback
list），不构成实质合规。

## 7. 修复动作

| # | 动作 | 责任 | 状态 |
|---|---|---|---|
| 1 | 重写 `batch-snapshot-dirty.py` 为 `grouped-feature-commit.py`：AR-GIT-001/002/003/004/005/006 全量预检 + Scope-risk 自动从 diff 计算 + 拒绝主路径业务源码混入 + 显式 task intent 必填 + submit log 自动生成 | agent | 进行中 |
| 2 | 原 `batch-snapshot-dirty.py` 重命名为 `batch-snapshot-dirty.py.deprecated`，文件头加 `DEPRECATED 2026-09-26` 注释指向本报告 | agent | 进行中 |
| 3 | `node scripts/workspace-git-hooks.mjs install` 修复 §6 列出的 4 个项目 hook 漂移 | agent | 进行中 |
| 4 | 复跑 `workspace-git-hooks verify` 确认 0 failures；`workspace-audit` 确认 0 errors | agent | 进行中 |
| 5 | 加固 AR-GIT-001 / AR-GIT-002：增加"严禁批量 dirty snapshot 模式"与 "Scope-risk 必须由工具按 diff 计算，禁止模板化" 条款 | agent | 进行中 |
| 6 | `axi-rules make rules` 重新生成 `index/rules.json`，验证新条款生效 | agent | 进行中 |
| 7 | 写入 memory `axi-prd06-batch-snapshot-dirty-non-compliance.md` 防止回归 | agent | 进行中 |

## 8. Owner 决策项（agent 不可单方面推进）

| 决策 | 选项 | 默认建议 |
|---|---|---|
| **D1. 21 个 commit 是否 revert** | (a) 全部 `git reset --soft HEAD~21` 重新按 feature intent 分组提交；(b) 逐 commit 检查后保留合规者、revert 不合规者；(c) 保留全部但写 `commit-amendment` 提交承认 trailer 失真 | **(a)** — 21 commit 中至少 4 个（axi-observability@180c103、axi-ui、axi-kernel、axi-pet-desktop）确认含业务源码混入，逐个 review 成本高于 reset-and-redo |
| **D2. 是否在 axiom 治理脚本仓库的 `package.json` 增加 `scripts.disallow-batch-snapshot-dirty`** | 是 / 否 | **是** — 在 `batch-snapshot-dirty.py` 删除后留 lint 入口防回归 |
| **D3. AR-GIT-001/002 加固条款是否引入新编号 AR-GIT-010** | 是 / 否 | **是** — 单设 AR-GIT-010 "Batch-snapshot tools must be AR-GIT-001/002-aware"，与已有 5 trailer 规则解耦 |

## 9. 时间线

- **2026-09-25 23:59 ~ 2026-09-26 00:20**：`batch-snapshot-dirty.py` 产出 21 commit。
- **2026-09-26 上午**：owner 看到 trailer 模式异常，发起本审计。
- **2026-09-26 下午**：本报告写入；修复脚本与 hook 漂移推进；owner 决策 D1/D2/D3 后回填到本报告 §10。
- **2026-09-26 EOD**：`pnpm workspace:audit` 0 errors + `workspace-git-hooks verify` 0 failures。

## 9.1 Revert Dry-Run（2026-09-26 04:14）

执行 `python3 scripts/revert-batch-snapshot.py scan` 所得数据：

| 维度 | 值 |
|---|---|
| 受影响 repo 数 | **21**（含 `foundation/workspace-governance`） |
| 待 reset commit 总数 | **81** |
| 待 reset 文件总数 | **1,442** |
| 待 reset 行总数 | **17,475** |

注意：audit 报告 §3 中"21 commit"特指 `batch-snapshot-dirty.py` 主输出的 21 个
`chore(audit-remediation): snapshot dirty governance files`；其余 60 个是同期
配套脚本产出（`chore(githooks): sync/bootstrap workspace hooks`、`docs(logs):
snapshot auto-generated submit logs`、`docs(audit-remediation): snapshot ...
docs`、`snapshot X for ...` 系列），它们同样不满足 AR-GIT-001/002/003/004 的
约束——故一并纳入 reset 候选。

每 repo 的 reset 指令（由脚本生成 `git reset --soft <oldest>~1`）：

| Repo | Branch | Commits | Files | Lines | Reset 起点 |
|---|---|---|---|---|---|
| foundation/axi-rules | dev | 8 | 116 | 2319 | `b77368e~1` |
| foundation/axi-kernel | dev | 6 | 28 | 763 | `ce471a2~1` |
| foundation/axi-workbench-cli | dev | 5 | 25 | 879 | `cf771d5~1` |
| foundation/axi-notify | dev | 5 | 32 | 500 | `b7fbb88~1` |
| foundation/axi-observability | dev | 5 | 28 | 1910 | `d326d46~1` |
| foundation/axi-registry | dev | 5 | 43 | 475 | `9a8477d~1` |
| foundation/axi-runtime | dev | 5 | 23 | 688 | `59c461a~1` |
| foundation/axi-skills | dev | 3 | 185 | 723 | `0170b59b~1` |
| foundation/axi-sync | dev | 5 | 20 | 634 | `8fa4b98~1` |
| foundation/axi-ui | dev | 4 | 601 | 1645 | `255b11a~1` |
| foundation/workspace-governance | fix/adr-009-... | 2 | 25 | 1974 | `5c4bb95~1` |
| foundation/axi-apps | dev | 1 | 11 | 473 | `4fe409e~1` |
| foundation/axi-inbox | dev | 1 | 11 | 500 | `d2e4876~1` |
| workbench/axi-image-preview | dev | 4 | 21 | 414 | `57cbb32~1` |
| workbench/axi-pet-desktop | dev | 4 | 135 | 895 | `6d01b6da~1` |
| products/ielts-vocab | dev | 4 | 16 | 507 | `1964fe17~1` |
| products/story-graph | dev | 4 | 19 | 560 | `bd7cd28~1` |
| products/axi-soul-world | lane-c/web-admin-resource-search | 1 | 39 | 422 | `5946b08~1` |
| agent-cluster/axi-agent | dev | 4 | 32 | 420 | `890a44c~1` |
| tools/axi-video-downloader | dev | 4 | 20 | 354 | `f6d9f1b~1` |
| candidates/voice-assistant-... | dev | 1 | 12 | 420 | `ae36695~1` |

**安全网要点**：

- `foundation/workspace-governance` 当前在 `fix/adr-009-renumber-and-index-drift`
  分支，但 `git reflog` 显示 batch-snapshot 期间（23:00~02:00）未切换分支，
  两个 snapshot commit 是叠加在 owner 的 `fix(governance): close-loop audit
  remediation batch (A2+A4+C2)` (`16566d6`) 之上。reset 起点 `5c4bb95~1`
  即停在 `16566d6`，**保留** close-loop 工作。
- `products/axi-soul-world` 当前在 `lane-c/web-admin-resource-search` 分支。
  batch-snapshot commit `5946b08` 是单一叠加 commit，reset 起点 `5946b08~1`
  保留 `lane-c` 上的 owner 工作（`docs(handoff)` 系列）。
- 其它 19 个 repo 均在 `dev` 分支，且 batch-snapshot commit 连续叠在合法
  `fix(gitignore): cover *.db / *.sqlite3 / chroma` commit 之上，reset
  后所有变更进入 staged dirty tree，可用 `grouped-feature-commit.py`
  按 feature intent 重新分组提交。

**Apply 入口**（owner 一键触发，按 repo 单仓执行）：

```bash
# 1. 在每个 repo 上执行 reset --mixed（保留 working tree、清除 staged index；
#    这样所有 batch-snapshot 期间的变更回到 unstaged dirty 状态，
#    可以用 grouped-feature-commit.py 按 feature intent 重新分组）
for repo in foundation/axi-rules foundation/axi-kernel foundation/axi-workbench-cli \
            foundation/axi-notify foundation/axi-observability foundation/axi-registry \
            foundation/axi-runtime foundation/axi-skills foundation/axi-sync \
            foundation/axi-ui foundation/workspace-governance foundation/axi-apps \
            foundation/axi-inbox workbench/axi-image-preview workbench/axi-pet-desktop \
            products/ielts-vocab products/story-graph products/axi-soul-world \
            agent-cluster/axi-agent tools/axi-video-downloader \
            candidates/voice-assistant-on-device-speech-recognition; do
  python3 foundation/workspace-governance/scripts/revert-batch-snapshot.py \
    apply --target-repo "$repo" --yes
done

# 2. 重新按 feature intent 用 grouped-feature-commit.py 分组提交
# （每个 repo 的具体分组由 agent 按 staged dirty tree 自行决定）
```

## 10. Owner 决策回填（待填）

```
D1: <pending>
D2: <pending>
D3: <pending>
回填时间: <pending>
回填人: <pending>
```

---

**审计责任人**：governance-agent session（2026-09-26）
**对应 agent-cluster 任务**：`foundation/workspace-governance/scripts/batch-snapshot-dirty.py` 退役与替换