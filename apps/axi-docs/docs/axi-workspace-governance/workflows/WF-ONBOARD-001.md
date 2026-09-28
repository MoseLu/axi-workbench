# WF-ONBOARD-001:开发者首次接手 / 零上下文接管

> 工作流共同契约:必须从入口执行到闭环验收,中间态不得单独报告完成;每阶段必须记录事实源、动作、结果、下一阶段条件;先查授权会话再向用户索要信息;只有用户独占信息才暂停;多通道场景按实际协议能力使用。

## 入口
- 触发条件:任何 session 第一次进入 `/Volumes/code/workspace` 或刚切换到一个新项目分支,需要确认"我能不能开始改东西"。
- 用户意图:典型话术包括"接手"、"zero-context takeover"、"检查当前状态"、"是否可以开始后续开发"、"新项目交接"。
- 起始应用或路由或 CLI 子命令:`foundation/workspace-governance` 项目根目录;CLI 子命令 `workspace-project validate | whereami | onboard | handoff-check`(`foundation/workspace-governance/scripts/workspace-project-cli.mjs:83-110, 139-147`)。

## 事实源
1. `/Volumes/code/workspace/AGENTS.md:120-156` — 项目登记 5 步交接链硬编码说明。
2. `/Volumes/code/workspace/AGENTS.md:184-204` — 接手 / 零上下文接管任务的执行细则与禁止项。
3. `/Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs` — CLI 权威源;命令定义见 `workspace-project-cli.mjs:64-110, 132-147`,`onboard` 实现见 `workspace-project-cli.mjs:205`。
4. 目标项目根目录的 `AGENTS.md`、`CLAUDE.md`、`README.md`、`docs/HANDOFF.md`、`CHANGE.md` —— 必须逐个读一次。
5. `/Volumes/code/workspace/foundation/axi-rules/rules/workflow/AR-WORKFLOW-001.md` — 工作流风险等级与必要证据。

## 执行阶段
### 阶段 1:workspace-project validate
- 输入:空的本地工作树 + 用户给出的项目 ID 或路径(无则视为容器级接手)。
- 动作:`node foundation/workspace-governance/scripts/workspace-project-cli.mjs validate`,记录 baseline。
- 输出:`workspace graph and handoff registry ok` 或 `errors: N`。
- 继续条件:必须 `ok`;若 errors,先回到治理仓库修复,**不得**进入阶段 2。

### 阶段 2:workspace-project whereami(用 canonical absolute path)
- 输入:**项目根的绝对路径**,例如 `/Volumes/code/workspace/foundation/axi-rules`,**不是** `/Volumes/code/workspace`(`AGENTS.md:198-200`)。
- 动作:`node foundation/workspace-governance/scripts/workspace-project-cli.mjs whereami <absolute-path>`,得到 `{ project_id, partition, status }`。
- 输出:返回的项目 ID 与 partition。
- 继续条件:路径命中具体项目;容器路径只用于核对 workspace 本身,不替代项目级 whereami。

### 阶段 3:workspace-project onboard --json
- 输入:阶段 2 拿到的 `<project_id>`。
- 动作:`node foundation/workspace-governance/scripts/workspace-project-cli.mjs onboard <project_id> --json`,读懂返回的 `provides` / `consumes` / `verify` / `handoff` 字段。
- 输出:两分钟接管简报(写入本次会话上下文,不持久化到仓库)。
- 继续条件:`onboard` 返回非空,且不包含 `requires_handoff_fix` 之类的硬阻塞。

### 阶段 4:workspace-project handoff-check
- 输入:阶段 3 的 onboard 结果。
- 动作:`node foundation/workspace-governance/scripts/workspace-project-cli.mjs handoff-check <project_id>`,记录 `errors` 与 `warnings`。
- 输出:handoff 健康度报告。
- 继续条件:`errors: 0`;`warnings` 可继续但要在最终报告里点名。

### 阶段 5:读项目 AGENTS.md
- 输入:目标项目根 `AGENTS.md`。
- 动作:`Read` 该文件至少一次,记下 Scope / Read Order / Boundaries / Request Defaults / Verification 五段;同时 `git status --short --branch` 看工作树状态。
- 输出:确认本次任务是否落在该项目 `AGENTS.md` 允许的边界内。
- 继续条件:`AGENTS.md` 已读 + `git status` 干净或 diff 在预期内。

## 失败处理
- `whereami` 报错"path is workspace root":检查阶段 2 输入是不是项目绝对路径而不是 `/Volumes/code/workspace`;参考 `AGENTS.md:198-200` 的反例。
- `handoff-check` 失败:回到阶段 1 重跑 validate → whereami → onboard,定位是注册表缺项还是项目本地 `AGENTS.md` / `docs/HANDOFF.md` 缺失;**禁止**用 `test-claude-noninteractive.py --prepare-only` 凑数(`AGENTS.md:204-206`)。
- 项目 `AGENTS.md` 缺失:补齐 `AR-BOOTSTRAP-002` 要求的 5 个最小文件后回到阶段 1;不要直接动手改代码。
- 用户给出项目 ID 但 `whereami` 找不到:运行 `workspace-project list` 对照 `WORKSPACE_INDEX.md:29-87` 校对 ID,而不是新增项目;**新增项目必须走 `WF-INDEX-001`**,不在本工作流范围。

## 闭环验收
- 必须同时满足:1. `workspace-project validate` 返回 `ok` 2. `whereami <absolute-path>` 返回目标项目而非 workspace 根 3. `handoff-check` 报告完整无 `errors` 4. 项目根 `AGENTS.md` 已被 `Read` 至少一次

## 安全边界
- 敏感数据:`onboard --json` 输出可能含 secret 路径引用,只保留 `provider / consumer / verify` 字段,贴回主会话时去掉 token / 密钥字段。
- 外部动作:本工作流**纯只读**,不执行任何写操作、不提交、不推送。
- 日志脱敏:粘贴 `handoff-check` 输出时截断 `Authorization` / `Bearer` 前缀。

## 验证命令
```bash
# 结构(注册表 / handoff 健康)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate

# 服务(项目身份解析)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs whereami /Volumes/code/workspace/<partition>/<project-id>

# 行为(接管简报 + 健康检查)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs onboard <project-id> --json
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs handoff-check <project-id>

# 安装包(无需;只读流程)
```