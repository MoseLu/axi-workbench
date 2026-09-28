# WF-AUDIT-001:workspace 治理审计 + 整改

> 工作流共同契约:必须从入口执行到闭环验收,中间态不得单独报告完成;每阶段必须记录事实源、动作、结果、下一阶段条件;先查授权会话再向用户索要信息;只有用户独占信息才暂停;多通道场景按实际协议能力使用。

## 入口
- 触发条件:用户明确说出 "audit / 审计 / 整改工作区 / 检查工作区治理 / cleanup workspace / govern workspace" 之一。
- 用户意图:对 `/Volumes/code/workspace` 整体或指定分区做治理体检;或在 audit 之后做有限范围的整改。
- 起始应用或路由或 CLI 子命令:`foundation/workspace-governance` 项目根目录;CLI `workspace-audit.mjs`、`workspace-project validate`、`pnpm workspace:docs:sync`(`foundation/workspace-governance/scripts/workspace-project-cli.mjs:96-99, 132-147`)。

## 事实源
1. `/Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs` —— audit 脚本权威源。
2. `/Volumes/code/workspace/foundation/workspace-governance/templates/workspace-audit-remediation-trigger.md:3-10` —— audit / remediation 的语义边界(read-only vs 改动)。
3. `/Volumes/code/workspace/AGENTS.md:358-369` 的"Explicit Workspace Audit/Remediation Trigger"段 —— 触发路由与"registry facts / code facts / inference / command evidence"四段式报告格式。
4. `/Volumes/code/workspace/foundation/axi-rules/rules/workflow/AR-WORKFLOW-001.md:18-31` —— L3 风险等级与必需证据。
5. `/Volumes/code/workspace/foundation/workspace-governance/workspace.json` + `workspace.graph.json` + `WORKSPACE_INDEX.md` —— 整改只改这些权威源(`AGENTS.md:357-368` 明令)。

## 执行阶段
### 阶段 1:触发路由确认
- 输入:用户原话 + 工作区路径。
- 动作:核对是否真属于本工作流触发集(关键词匹配);**纯 status / 列项目 / 单仓库 bug 不进本工作流**,改走 `WF-ONBOARD-001` 或该项目本地流程。
- 输出:确认进入"audit"或"remediation"分支。
- 继续条件:确认 audit / remediation 之一;不模棱两可。

### 阶段 2:audit 跑完记录 errors
- 输入:阶段 1 决定的 audit 范围(整库 / 指定分区)。
- 动作:`node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs`,捕获完整 stdout / stderr,**不删行不改输出**;同时 `node foundation/workspace-governance/scripts/workspace-project-cli.mjs validate` 做并行的注册表检查。
- 输出:audit 报告(errors + warnings 计数);validate 报告。
- 继续条件:报告已落盘;若用户只要 audit 不整改,跳到阶段 5 收尾。

### 阶段 3:四段式分类
- 输入:阶段 2 的 audit + validate 输出。
- 动作:把发现分成四段报告 —— `registry facts`(直接来自 `workspace.json` / `workspace.graph.json` 字段)、`code or document facts`(来自代码 / 文档读取)、`inference`(从事实推断出的现象,需标 confidence)、`command evidence`(来自命令真实输出);严格按 `AGENTS.md:362-368` 的格式。
- 输出:四段式中间报告;每条事实附 `file:line` 或 `cmd:exit`。
- 继续条件:四段都至少有一条;`inference` 段必须标 confidence(高 / 中 / 低)。

### 阶段 4:整改(仅 audit 触发用户)
- 输入:阶段 3 的四段报告 + 用户授权的整改范围。
- 动作:**只改权威源**:`workspace.json` / `workspace.graph.json` / `WORKSPACE_INDEX.md` / `foundation/axi-rules/rules/`(`AGENTS.md:357-368`);生成文件(`docs/workflows/index/*.json` 等)改源 + 跑 `pnpm workspace:docs:sync`,**不手改**;`.venv` 越界软链 / legacy `shared/` / `voice-assistant` 等已知遗留路径**标 paused**,不直接删除。
- 输出:diff 清单(每个 diff 对应一个权威源)+ 风险分级(高 / 中 / 低)+ 高风险项的 owner 触发开关。
- 继续条件:所有 diff 都对应到权威源;高风险项必须标 owner。

### 阶段 5:三件套验证 + 闭环报告
- 输入:阶段 4 的 diff(若做了整改)。
- 动作(顺序固定):
  1. `node foundation/workspace-governance/scripts/workspace-project-cli.mjs validate` —— 必须 `ok`。
  2. `node foundation/workspace-governance/scripts/workspace-audit.mjs` —— 必须 `errors: 0`。
  3. `cd foundation/workspace-governance && pnpm workspace:docs:sync` —— 刷新 catalog / registry / handoff / completion。
- 输出:三件套 ok 输出 + 最终四段式报告(沿用阶段 3 模板)。
- 继续条件:三件套全部 `0 error / ok`;否则回到阶段 4。

## 失败处理
- `audit` 报 `.venv` 越界软链:不删,标 `paused`,记入"已知遗留"清单;参考 `AGENTS.md:357-368` 的"preserve unrelated dirty work"。
- `audit` 报 legacy `shared/` / `tools/codex-plus-app` / `references/archives`:同样标 `paused`,把它们从"正常开发入口"列表中移除,但保留物理路径直到 owner 显式同意清理。
- `audit` 0 error 但 validate 报错:回到 `WF-INDEX-001` 修注册表,不要在 audit 报告里"既不算错也不算对"。
- `pnpm workspace:docs:sync` 失败但前两步 ok:通常是缺依赖,按 `foundation/workspace-governance/package.json` 装回后再跑。
- 用户授权整改但范围超出本工作流 L3 范围(例如删整个 git 仓库):**暂停**,按"高风险集"规则向用户明确 owner 取向(`AGENTS.md:286-294` 的 USER-CONFIRMATION LOCKDOWN)。

## 闭环验收
- 必须同时满足:1. `workspace-audit.mjs` 返回 `errors: 0` 2. `workspace-project validate` 返回 `ok` 3. `pnpm workspace:docs:sync` 已执行且产物落盘 4. 最终报告含风险分级(高 / 中 / 低)且高风险项标注 owner 触发开关

## 安全边界
- 敏感数据:`workspace.json` / `workspace.graph.json` 中 secret 字段引用只做存在性 + 长度检查,不回显。
- 外部动作:本工作流**不推送** / 不发版 / 不删 git 仓库;`.venv` / `references/archives` 等遗留路径只标 `paused`,不物理删除。
- 日志脱敏:audit 输出里若含 token / 私钥 / 数据库连接串,只截前 8 字节再贴。

## 验证命令
```bash
# 结构(注册表 / handoff 一致性)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate

# 服务(治理审计)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs

# 行为(生成面刷新,audit 后必跑)
cd /Volumes/code/workspace/foundation/workspace-governance && pnpm workspace:docs:sync

# 安装包(仅在 docs:sync 缺工具时)
cd /Volumes/code/workspace/foundation/workspace-governance && pnpm install --frozen-lockfile
```