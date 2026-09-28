# WF-INDEX-001:workspace 注册表 / 关系图 / 索引文件变更

> 工作流共同契约:必须从入口执行到闭环验收,中间态不得单独报告完成;每阶段必须记录事实源、动作、结果、下一阶段条件;先查授权会话再向用户索要信息;只有用户独占信息才暂停;多通道场景按实际协议能力使用。

## 入口
- 触发条件:workspace 任何 L2 级别注册表 / graph / 索引文件需要新增、删除或修改(添加项目、调整 `consumers` / `providers`、改 `dev_services.config.json`、生成文档重写)。
- 用户意图:典型话术包括"登记新项目"、"在 graph 里补一条契约"、"刷新 WORKSPACE_INDEX"、"调整 consumers 列表"。
- 起始应用或路由或 CLI 子命令:`foundation/workspace-governance` 项目根目录;CLI 子命令 `workspace-project validate | onboard | deps | consumers | route-intent`(`foundation/workspace-governance/scripts/workspace-project-cli.mjs:64-110, 132-147`)。

## 事实源
1. `/Volumes/code/workspace/foundation/workspace-governance/workspace.json` — 项目清单与生成面;`projects` 字段位于 `workspace.json:274`,`localServices` / `grants` 等契约字段见 `workspace.json:675-677`
2. `/Volumes/code/workspace/workspace.graph.json` — 项目关系图;`projects` 字段起始于 `workspace.graph.json:18`,`contracts` / `consumers` / `providers` 见 `workspace.graph.json:28,59,138,270,318,491`
3. `/Volumes/code/workspace/WORKSPACE_INDEX.md` — 人类可读的项目级权威目录;关键项目列表见 `WORKSPACE_INDEX.md:29-87`
4. `/Volumes/code/workspace/AGENTS.md` 的"After Project Admission"与 "Entry Read Order"段(`AGENTS.md:120-156, 184-204`);审计触发段见 `AGENTS.md:358`
5. `/Volumes/code/workspace/foundation/axi-rules/rules/workflow/AR-WORKFLOW-001.md:18-31` — L0–L3 风险等级与必需证据

## 执行阶段
### 阶段 1:validate 现状
- 输入:目标文件的当前版本 + 用户口述的变更意图。
- 动作:运行 `node foundation/workspace-governance/scripts/workspace-project-cli.mjs validate` 与 `node foundation/workspace-governance/scripts/workspace-audit.mjs`,记录 baseline。
- 输出:`ok / errors: N` 行;若已有 errors,**先停手并报告**,不要叠加新变更。
- 继续条件:`validate` 返回 `workspace graph and handoff registry ok`,且 audit `errors: 0`。

### 阶段 2:edit 源文件
- 输入:阶段 1 的 baseline + 用户给出的变更边界。
- 动作:**只编辑权威源**:`workspace.json`、`workspace.graph.json`、`WORKSPACE_INDEX.md`;**禁止**手改 `docs/workflows/index/*.json` 等生成文件。
- 输出:三个文件 diff;每个新项目节点必须满足 `AGENTS.md:120-156` 的 5 步登记链与 `AR-BOOTSTRAP-002` 最小文件集。
- 继续条件:每个改动都能对应到现有 schema 字段;无悬挂引用、无未注册 `targetRef`。

### 阶段 3:workspace-project validate
- 输入:阶段 2 的 diff。
- 动作:`node foundation/workspace-governance/scripts/workspace-project-cli.mjs validate`;如有 graph 变化,补跑一次 JSON cycle 检查(`docs/audits/` 下最近的 graph audit 报告作为对照)。
- 输出:再次 `ok` 行;若有错误,回到阶段 2。
- 继续条件:`validate` 仍返回 `ok`,且 graph 无 cycle、无 dangling reference。

### 阶段 4:audit + docs:sync 三件套
- 输入:阶段 3 的 `ok` 输出。
- 动作(顺序不可调换):
  1. `node foundation/workspace-governance/scripts/workspace-audit.mjs` — 必须 `errors: 0`。
  2. `cd foundation/workspace-governance && pnpm workspace:docs:sync` — 刷新 catalog / registry / handoff / completion。
  3. `node foundation/workspace-governance/scripts/workspace-project-cli.mjs validate` — 确认 sync 没破坏注册表。
- 输出:audit 输出、`docs:sync` 修改的文件清单、第二份 `validate` 输出。
- 继续条件:三件套全部 `0 error / ok`,否则回到阶段 2 修正源文件。

## 失败处理
- `validate` 报 cycle 或 dangling targetRef:回到 `workspace.graph.json` 的 `consumers` / `providers` 字段,定位缺失项目节点 → 补齐或在 graph 中改为 `targetRef: <existing project id>`。
- `audit` 报 `.venv` 越界软链 / legacy `shared/` 路径:`AGENTS.md` 与 `docs/registry/` 不允许把这类路径列为正常开发入口,标 `paused` 并在整改报告登记;不要直接删。
- `docs:sync` 失败但 validate 通过:通常是生成脚本缺依赖,按 `foundation/workspace-governance/package.json` 重装后重跑,**不要**手改 `docs/workflows/index/*.json`。
- 用户只给了"加项目"一句话但缺 ID / 路径 / capability:按 `AGENTS.md:120-156` 走 `route-intent`,而不是直接猜字段。

## 闭环验收
- 必须同时满足:1. `workspace-project validate` 返回 `ok` 2. `workspace-audit.mjs` 返回 `errors: 0` 3. `pnpm workspace:docs:sync` 已执行且产物文件落盘 4. `workspace.graph.json` 无 cycle 且所有 `targetRef` 解析到注册项目

## 安全边界
- 敏感数据:`workspace.json` 中可能含 `tokens` / `secrets` 字段引用;只检查存在性 + 长度,不回显。
- 外部动作:本工作流**仅**在本地 git 工作树中执行;不推送、不打 tag、不发版。
- 日志脱敏:任何错误输出里出现的 `Authorization: Bearer ...` / 私钥 / 数据库连接串必须截断前 8 字节再粘贴。

## 验证命令
```bash
# 结构(注册表 / graph 一致性)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate

# 服务(生成面刷新)
cd /Volumes/code/workspace/foundation/workspace-governance && pnpm workspace:docs:sync

# 行为(治理审计)
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs

# 安装包(仅在 docs:sync 缺工具时执行)
cd /Volumes/code/workspace/foundation/workspace-governance && pnpm install --frozen-lockfile
```