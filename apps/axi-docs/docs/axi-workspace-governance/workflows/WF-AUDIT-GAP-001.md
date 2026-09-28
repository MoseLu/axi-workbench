# WF-AUDIT-GAP-001:补登记 governance executions/ 历史 commit 缺口

## 入口

- 触发条件:发现 git 历史里有 commit,但 `foundation/workspace-governance/docs/workflows/executions/` 目录里**没有对应的 `wf-<timestamp>-<sha>.json`** 记录——典型场景:post-commit hook 静默失败(`|| true` 吞错)/ `workspace-change-propagation.mjs` 在 Node ≥ v22 crash(`workspace-project-cli.mjs:617` 的 `process.exit(promise)` 不兼容)/ `preflight` 调用未带 `--record` 标志(因为 `writeRecord` 只在显式 `--record` 才被调用)。
- 用户意图:把"已经发生但没被审计系统登记"的 commit 补登记,让 workspace governance 的 `executions/` 视图与 git 历史保持一致。
- 起始应用或路由:从 `git log --since="<since>"` 拿到候选 commit hash 列表,在 governance 仓根目录运行 `node scripts/backfill-execution-records.mjs --repo <repo> --commits <sha1,sha2,...>` 一次或多次。

## 事实源

1. `foundation/workspace-governance/.githooks/post-commit:23-32` —— post-commit 钩子两行 `|| true` 静默吞错的事实
2. `foundation/workspace-governance/scripts/git-hooks/axi-submit-log-post-commit.mjs` —— 实际写 `executions/` 的脚本
3. `foundation/workspace-governance/scripts/workspace-change-propagation.mjs` —— 跨仓传播与 contract 匹配
4. `foundation/workspace-governance/scripts/workspace-project-cli.mjs:617` —— `process.exit(promise)` 在 Node ≥ v22 上会触发 `ERR_INVALID_ARG_TYPE: code must be number`;这是 workspace-change-propagation.mjs 调 validate 时 crash 的根因（LM Studio 自带 v25.5.0 复现）
5. `foundation/workspace-governance/scripts/workflow-audit.mjs` —— 静态契约审计,与 `executions/` 解耦,扫不到最近的 commit
6. `WF-SYNC-2026-09-26.md` "已知未完成项"段 —— 本次 9 commit 的 audit gap 来源

## 执行阶段

### 阶段 1:枚举未登记 commit
- 输入:`git log --since="<since>" --pretty="%H %s" --no-merges <repo-path>`;`<since>` 取自"上次 audit 通过的时间戳"或手动指定(如 `2026-09-26T09:00:00+08:00`)
- 动作:对每个相关项目跑 git log,产出 commit hash 列表
- 输出:`commits.json` 或 markdown 表格,每行包含 hash + subject + author + date
- 继续条件:列表完整覆盖本次待补登记的所有 commit

### 阶段 2:写 execution 记录
- 输入:阶段 1 的 commit 列表 + execution record schema(参见 `docs/workflows/executions/wf-20260924032314-2e4ce83d.json`)
- 动作:为每个 commit 生成一份 `wf-<ISO-timestamp>-<short-sha>.json`,写入 `docs/workflows/executions/`
  - `schemaVersion: 1`
  - `workflowId`: `wf-<commit-date>-<short-sha>`
  - `createdAt`: commit 的 author date ISO 格式
  - `riskLevel`: 与 pre-commit 输出一致(本次 9 commit 均为 L1 / L2)
  - `changedPaths`: commit 的 `git show --stat` 解析
  - `contractPaths`: 若涉及 AGENTS.md / WORKSPACE_INDEX.md / workspace.graph.json 等 contract 文件,记录
  - `workspaceImpact`: 是否触发跨项目变更
  - `decision`: "allow"(已 commit)
  - `repository`: 仓库绝对路径
  - `operation`: "commit"
  - `verification`: 引用当时 pre-commit 输出里 ok=true 的 command + stdout 摘要
- 输出:`executions/` 目录新增 N 个 JSON
- 继续条件:每个 commit 都对应一份 record;JSON 字段校验通过(`schemaVersion: 1` 必有;`workflowId` 唯一)

### 阶段 3:验证 executions/ 完整
- 输入:阶段 2 的新增记录 + git log
- 动作:跑 `node scripts/workflow-audit.mjs` 看是否新错误;`node scripts/workspace-project-cli.mjs validate` 看 graph 完整性
- 输出:audit + validate 双绿(或遗留预存错误未新增)
- 继续条件:`executions/` 与 `git log` 在指定 `<since>` 区间内一一对应

### 阶段 4:Lore Commit Protocol 提交
- 输入:阶段 2 写的 N 个 JSON + 阶段 3 的 validate 输出
- 动作:`git add docs/workflows/executions/`;提交含完整 lore trailer;`Scope-risk` 应为 L2(跨项目审计补登记)
- 输出:1 个 commit hash
- 继续条件:hook 通过;commit 出现在 governance 仓 history

## 失败处理

- **execution record 字段格式未知**:查 `docs/workflows/executions/wf-20260924032314-2e4ce83d.json` 现存样本;schemaVersion=1 的字段顺序固定
- **`workflowId` 重复**:执行记录用 commit 的 author date + short sha,正常情况下不会撞;若撞上,在 `createdAt` 加 `-<seq>` 后缀
- **`workspace-project-cli.mjs:617` Node ≥ v22 crash**:已知 incompat。`process.exit(promise)` 在新 Node 上 reject 了,导致 `validate` 子进程退出码异常。修法:把 `process.exit(promise)` 拆成 `await promise; process.exit(code)`
- **`pnpm` 仍不在 PATH**:本工作流**不依赖** pnpm(只写 JSON + git 操作 + 已有 node 工具);如某些 verification 命令需要 pnpm,在 `Directive` 段标注"在正常环境复跑"

## 闭环验收

必须**同时**满足 4 项:

1. 阶段 1 列举的所有 commit 都在 `executions/` 有一一对应的 `wf-*.json`
2. 每份 record 字段符合 schema(用 `jq . schemaVersion` 或类似校验)
3. `node scripts/workspace-project-cli.mjs validate` 仍然 ok(补登记不改 graph)
4. 提交后 git log 显示新 commit 含完整 lore trailer

## 安全边界

- **execution record 是审计产物,不可篡改**:任何补登记必须忠实反映 commit 的真实 author / date / paths;不得为了"看起来通过"而伪造 verification 字段
- **不补登已 revert 的 commit**:若 commit 已被 revert,应在 `changedPaths` 加 `Reverted-By: <hash>`,而非删除 record
- **不补登跨隐私 boundary 的信息**:execution record 不包含 commit message 之外的敏感数据(密码 / 授权码 / 个人邮箱)
- **Lore trailer 必须含 5 段**:与本次同步一致;任何缺段视为草稿,不进入主会话评审

## 验证命令

```bash
# 阶段 1:枚举
cd /Volumes/code/workspace/foundation/workspace-governance
git log --since="2026-09-26T09:00:00+08:00" --pretty="%H %s" --no-merges

# 阶段 3:验证(在 Owner 的正常 node + pnpm 环境)
node scripts/workspace-project-cli.mjs validate
node scripts/workflow-audit.mjs  # 仅看是否新增错误

# 阶段 4:补登记 commit 后
git log -1 --pretty="%h  %s"  # 期望: docs(workflows): backfill executions/ ...
ls docs/workflows/executions/ | wc -l  # 期望: 5(原) + N(新增)
```

## 与 `WF-SYNC-2026-09-26.md` 的关系

本次 8 子代理 + 4 轮的同步批次产出 16 commit(9 项目 + 2 governance follow-up + 5 originals 因 pre-commit 未带 `--record` 参数,**所以即使 L1 也只跑 check-contracts 不写 execution record**;后 commit `a58f790` / `3f0c897` 也未触发 `--record`)。**真实根因是 `workspace-flow.mjs preflight` 默认不带 `--record`** + post-commit `|| true` 静默失败 + `workspace-project-cli.mjs:617` 在 Node ≥ v22 crash。本工作流 (`WF-AUDIT-GAP-001`) 是该 gap 的标准修复路径:

- `WF-SYNC-2026-09-26.md` §"已知未完成项"段**应当**引用本工作流 ID
- 阶段 1 的 commit 列表**应当**包括本次 9 commit 的全部 hash
- 阶段 2 写的 execution record 应当忠实记录 pre-commit 输出里 `pnpm workspace:audit` 的 `ok=false` 状态(放进 `verification` 数组,作为 `noted-but-allowed` 的证据)

## 后续维护指引

- **预防**:Owner 在主项目装 pnpm 后,所有 post-commit 自动生成 execution,本工作流退化为"应对历史 gap 的低频工具";不再日常使用
- **回归**:若 `executions/` 数量与 90 天内 git commit 数差距 > 20%,重跑本工作流
- **改进方向**:未来可考虑把 pre-commit hook 的"non-blocking for docs-only"策略改为"在 commit message 里强制嵌入 audit_status: skipped-by-lore-trailer"标记,避免依赖 hook 内部策略
