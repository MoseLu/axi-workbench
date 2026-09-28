# WF-CROSS-COMMIT-001:跨项目共享包 / 契约变更提交

> 工作流共同契约:必须从入口执行到闭环验收,中间态不得单独报告完成;每阶段必须记录事实源、动作、结果、下一阶段条件;先查授权会话再向用户索要信息;只有用户独占信息才暂停;多通道场景按实际协议能力使用。

## 入口
- 触发条件:任何对**被 ≥3 个消费者项目消费的共享包或契约**的源代码、schema、event envelope、package metadata 改动;典型目标包括 `foundation/axi-ui`、`foundation/axi-rules`、`foundation/axi-kernel`、`foundation/axi-sync`、`foundation/axi-registry`。
- 用户意图:"改 axi-ui 的 preset"、"调 axi-kernel 的对象模型"、"扩 axi-rules 的 workflow 规则"、"在 axi-sync 上加字段"。
- 起始应用或路由或 CLI 子命令:provider 项目根目录;CLI 子命令 `workspace-project consumers` / `deps`(`foundation/workspace-governance/scripts/workspace-project-cli.mjs:64-69, 132-133`);提交遵循 `Lore Commit Protocol`(`AGENTS.md:155`)。

## 事实源
1. `/Volumes/code/workspace/workspace.graph.json` 的 `consumers` / `contracts` 字段 —— `workspace.graph.json:59, 138, 270, 318, 491` 等位置有真实 consumer 列表(例如 `workspace.graph.json:82-87` 列出 `axi-ui` 的 8 个 consumer)。
2. `/Volumes/code/workspace/scripts/workspace-project` —— consumers / deps 权威 CLI(`AGENTS.md:47` 已声明);同时 `foundation/workspace-governance/scripts/workspace-project-cli.mjs` 是底层实现。
3. `/Volumes/code/workspace/foundation/axi-rules/rules/development-sop/AGENTS.md:58-63` —— 跨项目协调规则 `AR-DEVELOP-CROSS-001` / `AR-DEVELOP-CROSS-002`;`AGENTS.md:109` 列出"公共 API / schema / event envelope / contract change: scan consumers with"。
4. `/Volumes/code/workspace/foundation/axi-rules/rules/workflow/AR-WORKFLOW-001.md:18-31` —— L3 风险等级门禁。
5. 各 consumer 项目根 `AGENTS.md` / `docs/HANDOFF.md` —— consumer 侧验证命令来源。

## 执行阶段
### 阶段 1:列影响范围
- 输入:provider 项目 ID(例如 `axi-ui`、`axi-rules`)。
- 动作:`node /Volumes/code/workspace/scripts/workspace-project consumers <provider>`,拿到完整 consumer 列表与各自 `targetRef`;同步对照 `workspace.graph.json` 的 `consumers` 字段做交叉验证。
- 输出:consumer 清单(包含项目 ID、绝对路径、验证命令)。
- 继续条件:consumer 数量 ≥1 且每个 consumer 都解析到具体 git 仓库;若解析失败,先把注册表修齐(`WF-INDEX-001`)再回来。

### 阶段 2:写变更
- 输入:阶段 1 的 consumer 清单 + 用户给出的契约边界。
- 动作:在 provider 项目内按 `AR-DEVELOP-CROSS-001`(`development-sop/AGENTS.md:62`)逐个读取每个 consumer 的 `AGENTS.md`,确认变更不会破坏其最小验证命令;源码 / 契约文件落盘,**必须**更新 `provider/CHANGE.md` 的"Affected consumers"段落(`development-sop/AGENTS.md:63`)。
- 输出:provider 项目 diff + `CHANGE.md` 更新。
- 继续条件:`CHANGE.md` 的 Affected consumers 列表与阶段 1 完全一致。

### 阶段 3:在每个 consumer 跑最小验证
- 输入:provider 项目的变更 + 阶段 1 的 consumer 列表。
- 动作:对每个 consumer 项目依次执行 `AGENTS.md` / `docs/HANDOFF.md` 里登记的最小验证命令(`typecheck` / `test` / `lint` / 项目自带脚本);不允许跳过任何一个。
- 输出:每个 consumer 各自的验证日志(失败也保留原始输出)。
- 继续条件:**全部** consumer 验证 ok;**任何** consumer 失败都禁止进入阶段 4。

### 阶段 4:Lore Commit Protocol 分项目提交
- 输入:阶段 3 的全部 ok 日志。
- 动作:对每个修改过的仓库(1 个 provider + 视情况 N 个 consumer 同步提交)各做一条提交,scope tag 用 Conventional Commits 规范(`AGENTS.md:155`、`AR-WORKFLOW-001.md:30`);provider 提交消息必须包含 `Affected consumers: <consumer list>`。
- 输出:每项目一条 commit hash,branch 位于 `dev` 或 task 分支,**不在** `main`。
- 继续条件:每项目都得到一条 commit hash,且分支名符合 `AGENTS.md:148` 的"agent/<task> 或 dev"约定。

### 阶段 5:报告
- 输入:阶段 4 的 commit 列表。
- 动作:在主会话汇报时按"provider commit + consumer commits + 验证摘要 + 风险等级 L3 + 已知遗留"五段写;不要让用户追问下一步。
- 输出:结构化报告(每条 commit 占一行,带 hash / 仓库 / 影响)。
- 继续条件:报告覆盖全部 commit hash,无任何 "TBD / 待补 / later" 字段。

## 失败处理
- 任何 consumer 验证失败:**该次提交不前进**;先在 provider 改源码或回滚阶段 2,允许 provider 单方重提,**禁止**先合 provider 再回头修 consumer(`AR-WORKFLOW-001.md:31` 的"失败状态不得报告为完成")。
- `workspace-project consumers` 报告 consumer 数为 0 但代码里确有 import:优先 `WF-INDEX-001` 修复 graph,而不是把变更悄悄合掉。
- provider 提交消息缺 `Affected consumers`:`development-sop/AGENTS.md:63` 要求必备,缺则 `git commit --amend` 补全后再进阶段 5。
- consumer 验证耗时过长:每个 consumer 用 `AGENTS.md` 里**最小**验证(只跑 typecheck / 单测,不全量 build),但**不能跳过**。

## 闭环验收
- 必须同时满足:1. `workspace-project consumers <provider>` 列出的清单与 `workspace.graph.json` 一致 2. 每个 consumer 的最小验证命令全部返回 ok 3. provider 与必要 consumer 各有一条 commit hash(分支不在 `main`) 4. 最终报告列出全部 commit hash 与对应仓库

## 安全边界
- 敏感数据:consumer 验证日志里若含 token / cookie / 数据库 URL,只贴前 8 字节 + 字段名;不贴完整值。
- 外部动作:本工作流**不推送**(除非用户明确说 push);不发版、不打 tag、不触发 CI deploy。
- 日志脱敏:commit message 不写 secret;若契约文件本身包含 secret 引用,只做存在性 + 长度检查。

## 验证命令
```bash
# 结构(影响范围)
node /Volumes/code/workspace/scripts/workspace-project consumers <provider>
node /Volumes/code/workspace/scripts/workspace-project deps <provider>

# 服务(provider 本地最小验证)
cd /Volumes/code/workspace/<provider-path> && <provider AGENTS.md 列出的最小验证>

# 行为(each consumer 最小验证,顺序遍历)
for c in $(node /Volumes/code/workspace/scripts/workspace-project consumers <provider> | jq -r '.[].id'); do
  cd "/Volumes/code/workspace/$(node /Volumes/code/workspace/scripts/workspace-project whereami /Volumes/code/workspace/<consumer-path> | jq -r '.partition')/$c" \
    && <consumer AGENTS.md 列出的最小验证>
done

# 安装包(仅在 provider 或 consumer 缺依赖时)
cd /Volumes/code/workspace/<provider-path> && pnpm install --frozen-lockfile
```