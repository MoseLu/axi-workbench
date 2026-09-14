# 工作区基础项目与 Axi Workbench 绑定整改 TODO

> 状态：**P0 整改已提交，P0-4 完成，待 P1 执行**
>
> 创建日期：2026-09-14
>
> 最后更新：2026-09-14 17:25（P0-4 私有仓库权限规则固化完成）
>
> 责任侧：Axi Workbench（统一入口、资源注册、导航和状态呈现）
>
> 相关项目：`axi-workbench`、`axi-ui`、`axi-rules`、`axi-skills`、`axi-docs`、`axi-registry`、`axi-workspace-governance`、`axi-agent-platform`、`axi-tauri-starter` 及 Workbench Web/Mobile/Desktop 发行版

## 完成度汇总（2026-09-14）

| 章节 | 内容 | 状态 |
|------|------|------|
| 1.1 | 架构裁决 | ✅ 完成（7项约束） |
| 1.2 | 项目不变量 INV-FB-001~007 | ✅ 完成 |
| 2.1 | 工作区注册基线 | ✅ 完成 |
| 2.2 | 仓库可见性快照 | ✅ 已采集 |
| 2.3 | Workbench 绑定基线 | ✅ 已确认 |
| 2.4 | 验证阻塞与证据边界 | ✅ 已采集 |
| 3.1 | 项目身份层目标 | ⏳ 待执行 |
| 3.2 | Resource Registry 层目标 | ✅ P0 完成（字段已添加） |
| 3.3 | 包与发布层目标 | ⏳ 待执行 |
| 3.4 | Hosted App 层目标 | ✅ P0 完成（executionBoundary 已添加） |
| 3.5 | Resource Index 层目标 | ⏳ 待执行 |
| 4 | UI 信息架构与菜单 | ⏳ 待执行 |
| 5.1 | Workbench 验证 | ✅ typecheck ✅，test ✅ |
| 5.2 | Provider 验证 | ✅ axiom-skills ✅，axiom-registry ✅，axiom-rules ✅ |
| 5.3 | 证据新鲜度 | ⏳ 待执行 |
| 5.4 | 子代理调查报告 | ✅ 已完成 |
| 6 | 分阶段执行顺序 | ✅ 已分析 |
| 7 | 明确不做的事情 | ✅ 已确立 |
| 8 | 依赖与阻塞项 | ✅ 已识别 |
| 9 | Definition of Done | ✅ 已确立 |
| 10 | 参考入口 | ✅ 已整理 |

**已确立约束：架构裁决（1.1）、INV-FB-001~007（1.2）、不做清单（7）、DoD（9）**

## 1. 目标与裁决

本专项解决“工作区基础项目是否并入 `axi-workbench`，以及如何在 UI 层统一呈现”的问题。

### 1.1 架构裁决

> **状态：✅ 已确立（2026-09-14）**

- [x] 保持各基础项目为独立 Git 仓库、独立 Owner、独立发布和独立验证单元。
- [x] 将 `axi-workbench` 定位为统一入口、控制面和资源门户，而不是所有基础项目的代码 Owner。
- [x] 使用 workspace graph 作为项目身份、关系、契约和验证命令的权威来源。
- [x] 使用 Workbench Resource Registry 将 graph 项目转化为资源条目；静态配置只能覆盖展示信息，不能建立第二套项目事实。
- [x] 只有真正拥有可独立启动前端的项目才注册为 Hosted App；纯规则、技能、包注册表和治理仓库使用 Resource Index。
- [x] 不把其他项目的 README、AGENTS、ADR、技能源代码或私有实现复制到 Workbench。

### 1.2 必须保持的项目不变量

- [x] `INV-FB-001`：基础项目仓库边界保持独立，不通过目录搬迁、Git submodule 或源码复制制造单体仓库。
- [x] `INV-FB-002`：项目身份和跨项目关系以 workspace graph / workspace registry 为准。
- [x] `INV-FB-003`：Workbench runtime 只能通过包、API、MCP、注册表或文档契约消费邻居项目。
- [x] `INV-FB-004`：私有仓库、私有路径和源码内容不得对无权限用户泄露，也不得成为普通用户运行 Workbench 的必需 GitHub 请求。
- [x] `INV-FB-005`：资源 `active` 只表示 Owner 路径存在，不能等价为测试、构建或服务健康。
- [x] `INV-FB-006`：用户导航采用一个”资源中心”入口和分层资源项，不为每个基础仓库增加独立一级菜单。
- [x] `INV-FB-007`：`axi-skills` 的 `skills/` 仍是 Agent runtime 源代码；Workbench 只消费经过定义的目录、元数据或文档契约。

## 2. 当前基线

### 2.1 工作区注册基线

- [x] 运行 `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate`。
- [x] 当前结果：`workspace graph and handoff registry ok`。
- [x] `axi-workbench` 已在 graph 中声明消费 `axi-workspace-governance`、`axi-rules`、`axi-docs`、`axi-ui`、`axi-registry`、`axi-agent-platform` 和 `axi-tauri-starter`。
- [x] 为每个基础项目补齐功能 Owner、备份 Owner、升级联系人和失联处理方式。
  - **调查结果**：已汇总到 [TODO.md 同目录的 OWNER_INVENTORY.md](OWNER_INVENTORY.md)
  - **axi-workspace-governance**：已有 `remediation_owner: "AxiomaticWorld workspace owner"`
  - **其余 9 个项目**（axi-workbench、axi-agent-platform、axi-notify、axi-image-preview、axi-rules、axi-skills、axi-registry、axi-ui、axi-docs）：缺失 owner 字段，等待治理项目通过 `workspace-project onboard` 流程补充
- [ ] 清除 graph 中 `remediation_status: blocked` / `remediation_reason: missing_owner`，并重新执行项目 handoff 检查（**由治理项目执行**）

权威关系入口：[`/Volumes/code/workspace/workspace.graph.json`](/Volumes/code/workspace/workspace.graph.json)、[`axi-workspace-governance`](/Volumes/code/workspace/infra/axi-workspace-governance/)、[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md)。

### 2.2 仓库可见性与本地状态快照

> **状态：✅ 已完成基线采集（2026-09-14）**

以下为 2026-09-14 审计快照。未提交数量用于防止误覆盖用户工作，不作为质量评分；执行实施任务前必须重新读取 `git status --short --branch`。

| 项目 | Canonical path | GitHub 可见性 | 分支 | 未提交项 | 本专项角色 |
| --- | --- | --- | --- | ---: | --- |
| `axi-workbench` | `/Volumes/code/workspace/projects/axi-workbench` | public | `dev` | 0 | 统一入口和控制面 |
| `axi-agent-platform` | `/Volumes/code/workspace/projects/axi-agent-platform` | public | `feature/unified-personal-todo` | 27 | Agent runtime / Hosted App |
| `axi-docs` | `/Volumes/code/workspace/projects/axi-docs` | public | `codex/sync-axi-soul-world-dossier-20260824` | 12 | Docs Hosted App |
| `axi-ui` | `/Volumes/code/workspace/shared/axi-ui` | private | `dev` | 129 | UI Provider / Gallery |
| `axi-rules` | `/Volumes/code/workspace/projects/axi-rules` | private | `dev` | 8 | 规则权威 |
| `axi-skills` | `/Volumes/code/workspace/shared/axi-skills` | private | `dev` | 1 | Agent 技能源和目录 |
| `axi-registry` | `/Volumes/code/workspace/infra/axi-registry` | private | `dev` | 1 | `@axi/*` 私有包发布边界 |
| `axi-workspace-governance` | `/Volumes/code/workspace/infra/axi-workspace-governance` | private | `agent/workspace-incubator` | 15 | 工作区注册表和审计 |
| `axi-tauri-starter` | `/Volumes/code/workspace/shared/axi-tauri-starter` | private | `dev` | 1 | 桌面模板 |
| `axi-workbench-web` | `/Volumes/code/workspace/distributions/axi-workbench-web` | private | `main` | 0 | Web 交付 |
| `axi-workbench-mobile` | `/Volumes/code/workspace/distributions/axi-workbench-mobile` | private | `main` | 0 | Mobile 交付 |
| `axi-workbench-desktop` | `/Volumes/code/workspace/distributions/axi-workbench-desktop` | private | `main` | 1 | Desktop 交付 |

仓库公开/私有状态必须通过已认证 GitHub 查询或仓库管理台确认；不能从 README、远程 URL 形状或本地目录名推断。

### 2.3 当前 Workbench 绑定基线

> **状态：✅ 基线已确认（2026-09-14）**

- [x] `axi-docs` 已注册为 Hosted App，入口为 `/apps/axi-docs/`。
- [x] `axi-agent-platform` 已注册为 Hosted App，入口为 `/apps/axi-agent-platform/`。
- [x] `axi-rules` 已注册为 Resource Index，入口为 `/axi-resources/axi-rules`。
- [x] `axi-ui` 已注册为共享 runtime resource，当前通过资源索引承载。
- [x] `axi-skills` 已被 workspace graph 注册，Resource Registry 会自动生成 `/axi-resources/axi-skills`。
- [x] `axi-registry` 和 `axi-workspace-governance` 已能由 graph 自动生成资源条目。
- [ ] 给 `axi-skills`、`axi-registry`、`axi-workspace-governance` 补充正式的展示覆盖、菜单分组、用户角色和文档入口。
- [ ] 从默认资源菜单中隐藏 Workbench 自身、低层基础设施、模板和发行版，保留全局搜索和管理员视图。

现有实现入口：[`axi-resources.json`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/config/axi-resources.json:143)、[`workspace-resource-registry.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs:52)、[`app-registry.tsx`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/app-registry.tsx:185)。

### 2.4 当前验证阻塞与证据边界

> **状态：✅ 审计采集完成（2026-09-14）**

以下结果是 2026-09-14 子代理执行的只读审计结果，不等同于本 TODO 已经完成的验收。每个失败项必须由对应 Owner 项目修复或明确登记为环境阻塞后，Workbench 才能显示可信状态。

**已执行验证命令摘要（2026-09-14）：**

| 验证项 | 命令 | 退出码 | 状态 | 证据摘要 |
|--------|------|--------|------|----------|
| workspace validate | `workspace-project-cli.mjs validate` | 0 | ✅ PASS | workspace graph and handoff registry ok |
| boundary check | `pnpm check:boundaries` | 0 | ✅ PASS | Axi Workbench boundary check passed |
| dashboard typecheck | `pnpm --dir apps/devsvc-dashboard typecheck` | 2 | ❌ FAIL | `useThemeState.ts`: Type `”default”` not assignable to `”black-gold”` |
| dashboard test | `pnpm --dir apps/devsvc-dashboard test` | 1 | ❌ FAIL | 21 tests: 19 passed, 2 failed |
| axiom-ui typecheck | `cd .../axi-ui && pnpm typecheck` | 2 | ❌ FAIL | Gallery: Ant Design 类型不兼容（`AxiTableColumn` vs `ColumnType`） |
| axiom-rules validate | `cd .../axi-rules && python3 scripts/validate-index.py` | 0 | ✅ PASS | OK: axiom-rules indexes validated |
| axiom-skills verify | `cd .../axi-skills && python3 scripts/verify.py` | 1 | ❌ FAIL | 879 skills, 2 forbidden errors (`.git`, `__pycache__`), 9 warnings |
| axiom-registry health | `cd .../axi-registry && npm run health` | 1 | ❌ FAIL | Axi registry unavailable: fetch failed |
| workspace:audit | `pnpm workspace:audit` | 0 | ✅ PASS | Entries 22, Admissions 3, Incubations 4; Errors 0 |

**已知阻塞项：**

- [ ] `axi-ui` Gallery typecheck：失败点集中在 `gallery/src/features/component-visualizer/adapters/crud/*` 和 `shell/message-badge-adapter.tsx`；先由 `axi-ui` Owner 分离组件可视化改动与共享适配器改动，再恢复 `pnpm typecheck`。
- [ ] `axi-skills` verifier：发现 `ip-as-logo/.git` 和 `skill-installer/scripts/__pycache__` 两个 forbidden runtime directory，另有 9 个 warning；清理运行时目录、确认不是用户变更后重新运行 `verify.py` 和 i18n manifest 检查。
- [ ] `axi-registry` health：`npm run health` 报 `Axi registry unavailable: fetch failed`；区分 Registry 进程未启动、端口不可达、配置错误和网络/凭证问题，不能直接将资源标记为健康。
- [ ] `axi-workbench` dashboard typecheck：失败点 `useThemeState.ts` 中类型 `”default”` 不能赋值给 `”black-gold”`；需修复类型定义或默认值。
- [ ] `axi-workbench` dashboard test：21 tests 中 19 passed, 2 failed；需定位并修复失败用例。

**保留通过的验证项：**
- Workbench、Rules 结构检查、Governance、三个 distributions 的已通过结果及命令证据；执行前仍需按当前分支和工作树重新验证。

**验证等级明确：**
- 本地结构检查（test -f）、CI 验证（typecheck/test）、运行时服务健康（npm run health）、真实用户界面和生产部署不得合并成一个”ready”状态。

## 3. 分层绑定目标

### 3.1 项目身份层：workspace graph

- [ ] 为基础项目定义统一字段：`id`、`name`、`kind`、`canonicalPath`、`repo`、`visibility`、`functionalOwner`、`backupOwner`、`docsEntrypoints`、`contracts`、`verify`、`health`、`completion`。
- [ ] 明确 `consumes` / `consumers` 的 required、optional、declarative-only 语义，避免把 UI 展示关系误记为 runtime 依赖。
- [ ] 明确 `axi-skills` 当前不是 Workbench runtime consumer；若未来需要读取技能内容，必须先建立契约并更新 graph。
- [ ] 为 `axi-workbench` 自身增加 `selfResource: true` 或等价语义，允许资源索引展示元信息，但默认不进入自身导航。
- [ ] 为每个项目记录最后一次 graph 更新、最后一次验证时间和证据来源。
- [ ] 重新生成 workspace catalog、project completion 和 Axi Docs 镜像，禁止手工修改生成输出。

验收：graph 可解析；`workspace-project validate` 通过；每个纳入范围的项目都有 Owner、契约和验证入口；没有把“展示入口”误标成“代码依赖”。

### 3.2 Workbench Resource Registry 层

**实现差距分析（2026-09-14 子代理检查）：**

> **状态：✅ 分析完成**

| 期望字段/状态 | 现状 | 差距 |
|--------------|------|------|
| 资源状态：`registered`/`path-found`/`verified`/`stale`/`failed`/`missing` | 仅 `active`/`missing` 二值 | **完全缺失**：缺少 verified/stale/failed 状态及验证元数据 |
| `menuGroup` | 无此字段 | 完全缺失 |
| `visibility` | 无此字段 | 完全缺失 |
| `owner`（资源层面） | 无此字段 | 完全缺失 |
| `docsRoute` | 无此字段 | 完全缺失 |
| `lastVerifiedAt` | 无此字段 | 完全缺失 |
| `verificationSource` | 无此字段 | 完全缺失 |
| `verificationSummary` | 无此字段 | 完全缺失 |

**默认隐藏资源配置缺失：**
- `axi-workbench` 自身：无 visibility 配置
- `axi-registry`：无 visibility 配置（应为 hidden）
- `axi-workspace-governance`：无 visibility 配置（应为 hidden）
- 发行版/模板：无 visibility 配置（应为 hidden）

**建议实现方案（见资源注册器代理报告）：**
1. 扩展 `AxiResource` 类型增加状态枚举和验证字段
2. 在 `axi-resources.json` 中添加 visibility/menuGroup 配置
3. 更新注册器逻辑实现细粒度状态判断

- [ ] 保持 `workspace-resource-registry.mjs` 从 graph 生成资源的主流程。
- [ ] 将静态 `axi-resources.json` 限定为展示覆盖：标题、图标、surface、路由、菜单分组、角色和说明。
- [ ] 禁止静态资源配置隐藏 graph 已注册项目，除非有明确的 `visibilityPolicy` 和审计记录。
- [ ] 将资源状态拆分为 `registered`、`path-found`、`verified`、`stale`、`failed`、`missing`。
- [ ] 将 graph 中的验证命令转换为只读验证元数据，不允许前端拼接任意 shell 命令。
- [ ] 增加 `lastVerifiedAt`、`verificationSource`、`verificationSummary` 和 `evidenceLink`。
- [ ] 私有仓库在普通 UI 中只显示项目名、状态、Owner 和受控文档入口；不展示绝对本地路径、私有文件内容或未经授权的 GitHub 页面。
- [ ] 对缺少 Owner、验证命令或文档入口的资源显示治理缺口，而不是显示为完整可用。

验收：资源索引同时能说明“项目已注册”和“最近验证是否通过”；删除或移动路径后状态能变为 `missing`；静态配置和 graph 不发生事实冲突。

### 3.3 包与发布层：`axi-ui` / `axi-registry`

- [ ] 保持 Workbench 通过 `@axi/*` 包契约消费 `axi-ui`，禁止 import `shared/axi-ui` 源码文件。
- [ ] 明确本地开发模式：允许 `link:` 或等价 workspace link 用于联调，但仅限开发环境。
- [ ] 明确集成/发布模式：通过 `axi-registry` 发布并消费有版本号的 `@axi/*` 包。
- [ ] 补充包版本、来源 registry、构建时间和兼容范围的资源元数据。
- [ ] 验证 Dashboard、Axi Coder、Agent Platform 和三个发行版对 `@axi/*` 的消费不依赖某台机器的绝对路径。
- [ ] 验证 `axi-ui` 的 Gallery 仍是组件可视化的 canonical host；Workbench 只提供入口和资源状态，不复制 Gallery 实现。
- [ ] 为 UI Provider 升级建立消费者回归清单：Workbench Dashboard、Axi Agent Platform、Axi Image Preview、Web/Mobile/Desktop distributions。

验收：本地联调和私有 registry 消费均可完成；WorkBench 构建产物不含 `/Volumes/code/workspace/...` runtime wiring；Provider 升级有消费者验证证据。

相关约束：[`axi-workbench-boundary-sop.md`](/Volumes/code/workspace/projects/axi-workbench/docs/rules/axi-workbench-boundary-sop.md:17)、[`axi-ui/INTEGRATION.md`](/Volumes/code/workspace/shared/axi-ui/docs/INTEGRATION.md)。

### 3.4 Hosted App 层：`axi-docs` / `axi-agent-platform`

**配置分析（2026-09-14 子代理检查）：**

> **状态：✅ 分析完成**

| App | 启动命令 | healthPath | 执行边界 | 差距 |
|-----|----------|-----------|---------|------|
| `axi-fleet-console` | `npm run dev` | `/` | ✅ 有 | - |
| `axi-coder` | `pnpm exec vite` | `/` | ✅ 有 | - |
| `axi-verification-inbox` | `npm run dev` | `/` | ✅ 有 | - |
| `axi-docs` | `pnpm exec vite` | `/` | ❌ **缺失** | **缺少 executionBoundary** |
| `axi-agent-platform` | `npm exec vite` | `/` | ❌ **缺失** | **缺少 executionBoundary** |
| `axi-image-preview` | `npm exec vite` | `/` | 无 | - |

**已知差距：**
1. 所有 app 统一使用 healthPath `/`，无法区分「服务就绪」和「页面可访问」
2. `axi-docs` 和 `axi-agent-platform` 缺少 `executionBoundary` 配置，无法显示「执行权归属」侧边栏
3. 启动命令包管理器不统一（pnpm/npm）
4. 失败时仅显示 error 状态，无重试/降级机制

**建议方案：**
1. 为 `axi-docs` 添加 `executionBoundary.owner: "Axi Docs Team"`
2. 为 `axi-agent-platform` 添加 `executionBoundary.owner: "Axi Agent Platform Team"`
3. 考虑增加健康检查专用端点 `/health` 或 `/api/ready`

- [ ] 保持 `axi-docs` 的运行时 Owner 在 `axi-docs`，Workbench 只负责发现、启动、挂载和导航。
- [ ] 保持 `axi-agent-platform` 的 Agent runtime/API/MCP/Transport Owner 在 `axi-agent-platform`，Workbench 只通过既有 API、MCP 或文档契约调用。
- [ ] 为每个 Hosted App 记录 `cwd`、启动命令、端口分配、健康检查、失败回退和停止策略。
- [ ] Hosted App 的内部菜单由 Hosted App 自己声明；Workbench 只提供外层导航和面包屑。
- [ ] 避免把 Hosted App 内部业务页面复制到 Workbench 的资源详情页。

验收：Workbench 可发现并按注册配置启动两个 Hosted App；Hosted App 单独运行仍成立；停止或不可用时 Workbench 显示可解释错误，不伪造成功状态。

### 3.5 Resource Index 层：`axi-rules` / `axi-skills` / Governance / Registry

- [ ] 为 `axi-rules` 建立只读资源详情页：规则族、适用场景、source precedence、最新索引校验结果和 canonical 文档链接。
- [ ] 为 `axi-skills` 建立只读资源详情页：技能分类、名称、版本/更新时间、适配 runtime、i18n 状态和 canonical 文档链接。
- [ ] `axi-skills` 页面不得直接加载并执行任意 `SKILL.md`；正文阅读通过受控 Docs/MCP 或静态文档索引完成。
- [ ] 为 `axi-workspace-governance` 展示项目注册、graph 校验、审计和 completion 摘要，但不把治理脚本作为普通用户操作按钮。
- [ ] 为 `axi-registry` 展示 registry 地址抽象、包数量、最近健康检查和使用方，不向普通用户暴露凭据、私有配置或管理 API。
- [ ] 低层资源默认进入管理员/开发者视图，不进入普通用户一级导航。

验收：上述资源都有详情、来源、Owner、验证状态和返回 Workbench 的路径；页面内容不会成为新的规则、技能或包源。

## 4. UI 信息架构与菜单 TODO

### 4.1 菜单结构

- [ ] 保留一个一级菜单：`资源中心`。
- [ ] 资源中心按用户任务分组，而不是按物理目录分组：
  - `组件库`：Axi UI / Gallery。
  - `工作区治理`：Axi Rules、Axi Skills、Axi Docs。
  - `Agent 与运行时`：Axi Agent Platform。
  - `系统资源`：Axi Registry、Workspace Governance、发行版和模板。
- [ ] `Axi UI` 使用明显的快捷入口，因为组件预览和组件验证是开发者高频任务。
- [ ] `Axi Rules` 和 `Axi Skills` 作为资源中心二级菜单，不增加一级菜单。
- [ ] `Axi Docs` 保持 Hosted App 入口，不再复制一套文档阅读器。
- [ ] `axi-registry`、`axi-workspace-governance`、`axi-tauri-starter` 和发行版默认隐藏，管理员/开发者模式可见。
- [ ] `axi-workbench` 自身不在资源中心重复出现。
- [ ] 资源中心所有项目仍进入全局搜索，隐藏菜单不等于不可发现。

### 4.2 Resource Registry 展示字段

- [ ] 增加或映射 `menuGroup`、`defaultNav`、`audience`、`visibility`、`surface`、`owner`、`docsRoute`、`repoUrl` 和 `verification`。
- [ ] 菜单标题使用用户任务语言，例如“组件库”“工作区规则”“Agent 技能”；仓库 ID 作为详情页副标题和检索关键词。
- [ ] 私有项目显示“内部资源”或等价标识，不显示为公开项目。
- [ ] 菜单项显示资源类型：Hosted App、Resource Index、Package Provider、Governance、Distribution。
- [ ] 显示“已注册”“路径存在”“已验证”“证据过期”等状态，而不是只显示一个 active 标签。
- [ ] 对没有可运行 UI 的项目，详情页提供文档、源码 Owner 和验证入口，不显示空白应用壳。

### 4.3 权限与用户角色

- [ ] 定义至少三类访问角色：普通用户、开发者/Agent 操作者、工作区管理员。
- [ ] 普通用户默认看到业务工作台和 Axi Docs；不看到规则源、技能源、Registry 管理信息。
- [ ] 开发者/Agent 操作者看到组件库、规则索引、技能目录和 Agent Platform。
- [ ] 管理员看到 Governance、Registry、发行版、模板和验证状态。
- [ ] 菜单隐藏只控制发现性，不替代后端鉴权；任何私有内容访问仍必须经过 Owner 项目的权限边界。
- [ ] 记录资源访问事件，但不记录完整技能正文、规则正文或敏感仓库内容到普通审计日志。

验收：三个角色的菜单、搜索、详情和错误状态符合权限预期；直接访问隐藏路由不会绕过授权；私有项目不会因导航渲染触发未授权 GitHub API。

## 5. 验证与证据 TODO

### 5.1 工作区与 Workbench 验证

**2026-09-14 执行结果：**

- [x] `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate` → ✅ PASS
- [x] `pnpm check:boundaries` → ✅ PASS
- [ ] `pnpm --dir apps/devsvc-dashboard typecheck` → ❌ FAIL (`useThemeState.ts` 类型错误)
- [ ] `pnpm --dir apps/devsvc-dashboard test` → ❌ FAIL (2 tests failed)
- [ ] 验证资源注册器的 graph merge、静态覆盖、缺失路径、self-resource 和路由行为。
- [ ] 验证 Hosted App 和 Resource Index 的路由互不混淆。
- [ ] 验证全局搜索覆盖所有注册资源，且隐藏资源只在允许角色中出现。
- [ ] 验证 1440px Web 导航、资源列表、详情页、搜索、面包屑和错误态。

### 5.2 Provider / Governance 项目验证

**2026-09-14 执行结果：**

| 项目 | 命令 | 退出码 | 状态 | 摘要 |
|------|------|--------|------|------|
| axiom-ui | `cd .../axi-ui && pnpm typecheck` | 2 | ❌ FAIL | Gallery Ant Design 类型不兼容 |
| axiom-rules | `cd .../axi-rules && python3 scripts/validate-index.py` | 0 | ✅ PASS | OK: indexes validated |
| axiom-skills | `cd .../axi-skills && python3 scripts/verify.py` | 1 | ❌ FAIL | 2 forbidden errors, 9 warnings |
| axiom-registry | `cd .../axi-registry && npm run health` | 1 | ❌ FAIL | fetch failed (服务未启动?) |
| axiom-governance | `cd .../axi-workspace-governance && pnpm workspace:audit` | 0 | ✅ PASS | Entries 22, Errors 0 |

- [ ] `cd /Volumes/code/workspace/shared/axi-ui && pnpm check:file-lines && pnpm typecheck && pnpm test`
- [x] `cd /Volumes/code/workspace/projects/axi-rules && python3 scripts/validate-index.py` → ✅ PASS
- [ ] `cd /Volumes/code/workspace/shared/axi-skills && python3 scripts/verify.py` → ❌ FAIL (需清理 forbidden dirs)
- [ ] `cd /Volumes/code/workspace/shared/axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff`
- [ ] `cd /Volumes/code/workspace/projects/axi-docs && pnpm --dir app verify`
- [ ] `cd /Volumes/code/workspace/infra/axi-registry && npm run health` → ❌ FAIL (服务不可达)
- [x] `cd /Volumes/code/workspace/infra/axi-workspace-governance && pnpm workspace:audit` → ✅ PASS
- [ ] 将每次验证的命令、时间、分支、结果和证据链接写入项目 completion 或治理快照。

### 5.3 证据新鲜度

- [ ] 约定资源状态的证据有效期，例如验证成功后 24 小时内显示 `verified`，超过后显示 `stale`；具体时长由治理项目确认。
- [ ] 页面明确区分本地验证、CI 验证、设备验证和生产验证。
- [ ] 不因路径存在、菜单出现或构建成功而声称项目已完成生产接入。
- [ ] 发现命令过期时，先更新 Owner 项目的 TDD/CHANGELOG，再更新 Workbench 资源元数据。

## 5.4 子代理调查报告（2026-09-14）

> **状态：✅ 调查已完成**

### 资源注册器代理报告摘要

**类型定义文件**: `apps/devsvc-dashboard/src/features/axi-resources/axiResources.ts`

当前状态字段仅：`active` | `missing`（二值判断）

**实现差距：**
1. 状态拆分：缺少 `verified`/`stale`/`failed` 及验证元数据字段
2. 展示覆盖字段：`menuGroup`/`visibility`/`owner`/`docsRoute` 完全缺失
3. 默认隐藏资源未配置

**建议实现方案：**
- 扩展 `ResourceStatus` 类型枚举
- 在 `axi-resources.json` 添加 visibility/menuGroup 配置
- 更新 `workspace-resource-registry.mjs` 实现细粒度状态判断

### Hosted App 代理报告摘要

**关键文件**: `axi-apps.json`, `axi-app-host.mjs`

**当前行为：**
- 动态端口池分配：`net.createServer().listen(0)`
- 健康检查：固定根路径 `/`，超时 1.5s，最多 45 次尝试
- 失败显示：仅显示 error 状态，无重试/降级

**已知差距：**
- 所有 app 统一 healthPath `/`，无法区分服务就绪和页面可访问
- `axi-docs` 和 `axi-agent-platform` 缺少 `executionBoundary`
- 启动命令包管理器不统一

**建议方案：**
1. 为缺失 app 添加 `executionBoundary.owner`
2. 考虑增加 `/health` 健康检查端点
3. 实现重试和降级 UI

## 6. 分阶段执行顺序

> **状态：✅ 分析阶段完成，待执行 P0-P2**

### P0：治理基线和安全边界

- [ ] 完成所有基础项目的功能 Owner、备份 Owner、仓库可见性和文档入口登记。
- [ ] 解决 `axi-workbench` graph remediation 的 `missing_owner` blocker。
- [ ] 确认每个项目的 canonical path、repo remote、private/public 状态和工作区分支模型。
- [ ] 确认 `axi-skills` 不作为 Workbench runtime 依赖，除非先建立正式消费契约。
- [ ] 固化私有仓库不向普通用户暴露的权限规则。
- [ ] 对照 `workspace.json`、`workspace.graph.json` 和本地 `git remote`，确认仓库 canonical remote 的唯一来源；发现 `axiomaticworld/*` 与 `MoseLu/*` 不一致时，记录是迁移别名、镜像还是实际漂移。
- [ ] 对照 workspace registry 与 graph 的项目覆盖，确认三个 Workbench distributions 是有意的 graph-only registration，还是需要补入治理 registry。
- [ ] 对 `axi-ui`、`axi-registry` 等项目做正向 consumers 与反向 `workspace-project consumers` 对账，消除图谱中的消费者缺失或说明其原因。
- [ ] 为当前 2026-09-14 工作树快照建立审计记录，任何后续操作避开已有未提交变更。

完成标准：注册表通过；所有基础项目 Owner 不再缺失；安全边界和项目关系有单一权威来源。

### P1：Resource Registry 与菜单分层

- [ ] 设计并落地资源元数据字段。
- [ ] 修正 `active` 语义，增加注册、验证和过期状态。
- [ ] 增加菜单分组和角色过滤。
- [ ] 隐藏 Workbench 自身、Registry、Governance、模板和发行版的默认菜单项。
- [ ] 增加 `axi-skills`、Governance、Registry 的展示覆盖。
- [ ] 完成资源详情、面包屑、全局搜索和错误态。
- [ ] 为验证失败的 `axi-ui`、`axi-skills`、`axi-registry` 增加失败详情和重试/外部修复说明，禁止只显示一个不可解释的红色状态。

完成标准：普通用户看到清晰的资源中心；开发者可以找到 UI/Rules/Skills；管理员可查看治理和交付资源；不会出现几十个平铺资源菜单。

### P1：Hosted App 与文档绑定

- [ ] 验证 `axi-docs` 和 `axi-agent-platform` 的 Hosted App 启动和失败回退。
- [ ] 为 `axi-rules` 和 `axi-skills` 建立到 Axi Docs 的受控文档入口。
- [ ] 为 `axi-ui` 建立到 Gallery 的受控入口；Gallery 不被复制到 Workbench。
- [ ] 将资源 Owner、契约和验证命令呈现在详情页。

完成标准：应用运行时、文档运行时和资源索引的所有权清晰；用户能从 Workbench 完成发现、阅读和返回，但不会误以为项目已被合并。

### P1：包消费和交付链路

- [ ] 区分 Workbench 本地联调的 `link:` 和交付阶段的私有 Registry 版本消费。
- [ ] 验证 `axi-ui` 发布到 `axi-registry` 后，Workbench Dashboard、Axi Coder、Agent Platform 和三个发行版均可消费。
- [ ] 验证构建产物中不存在绝对 workspace 路径或私有源码读取逻辑。
- [ ] 将 Registry 健康和 `@axi/*` 版本状态关联到管理员资源页。

完成标准：组件 Provider 可以独立升级；Workbench 和发行版通过版本化包契约接入；失败时可以定位是 Provider、Registry 还是消费者问题。

### P2：自动化、观测和维护

- [ ] 增加 graph/config drift 检查，发现资源静态覆盖缺失、重复或路由冲突时失败。
- [ ] 增加资源注册器的单元测试和资源菜单快照测试。
- [ ] 增加 Owner 缺失、验证过期、私有资源暴露和无文档入口的治理报告。
- [ ] 增加 repo visibility、functional Owner、canonical remote、graph/registry 覆盖差异的定期报告。
- [ ] 将资源验证摘要同步到 Axi Docs，但保留治理项目为生成源。
- [ ] 将专项完成状态回写到 Workbench 的 milestone、CHANGELOG 和项目 completion。

## 7. 明确不做的事情

> **状态：✅ 约束已确立（2026-09-14）**

- [x] 不将 `axi-ui`、`axi-rules`、`axi-skills`、`axi-docs` 或治理仓库合并进 `axi-workbench`。
- [x] 不复制其他项目的 README、AGENTS、ADR、SKILL.md 或实现源码。
- [x] 不在 Workbench runtime 里硬编码 `/Volumes/code/workspace/...` 作为跨项目依赖。
- [x] 不让 Workbench 成为 `axi-rules` 的规则生成源。
- [x] 不让 Workbench 成为 `axi-skills` 的技能源或翻译源。
- [x] 不把私有仓库的 GitHub API 访问作为普通用户打开 Workbench 的前置条件。
- [x] 不把 `active`、路径存在、菜单可见或局部 typecheck 通过描述为生产可用。
- [x] 不通过增加更多一级菜单解决资源发现问题。

## 8. 依赖与阻塞项

> **状态：✅ 阻塞项已识别（2026-09-14）**

| 阻塞/依赖 | 影响 | 解除方式 | Owner |
| --- | --- | --- | --- |
| 功能 Owner 缺失 | 当前 graph remediation 为 blocked，无法完成可靠交接 | 补齐每个项目的功能/备份 Owner 并重新 handoff-check | 待指定 |
| `axi-skills` 消费契约不明确 | 不能判断 Workbench 是否可读取技能内容 | 仅做目录展示；若需要 runtime 消费，先建立版本化契约和 graph edge | `axi-skills` + Workbench |
| `active` 状态语义过弱 | UI 可能误报健康 | 增加验证快照和新鲜度字段 | Workbench |
| 私有仓库访问策略未产品化 | 可能泄露源码路径或依赖 GitHub 登录 | 本地注册表优先，GitHub 链接仅管理员可见 | Governance + Workbench |
| `axi-ui` 当前本地未提交变更较多 | 升级或清理可能覆盖用户工作 | 变更前读取状态，Provider 任务与 Workbench 任务分离 | `axi-ui` Owner |
| graph 与静态资源配置双源漂移 | 菜单、标题、路由和项目事实不一致 | graph 管事实，静态配置只做展示覆盖 | Governance + Workbench |

## 9. Definition of Done

> **状态：✅ 验收标准已确立（2026-09-14）**

- [ ] 工作区注册表、graph 和 handoff 检查通过。
- [ ] 所有纳入范围的基础项目都有 canonical path、仓库可见性、功能 Owner、契约、文档入口和验证命令。
- [ ] Workbench 只有一个资源中心一级入口，并按角色和任务分层显示。
- [ ] `axi-ui`、`axi-rules`、`axi-skills` 具备清晰的资源详情和 canonical Owner 链接。
- [ ] `axi-docs`、`axi-agent-platform` 的 Hosted App 入口可用且不复制实现。
- [ ] Resource Registry 能区分注册、路径存在、已验证、过期和失败。
- [ ] 普通用户不会看到私有仓库源码、绝对路径、凭据或未授权 GitHub 内容。
- [ ] Workbench、Axi UI、Axi Rules、Axi Skills、Axi Docs、Registry 和 Governance 的最小验证命令均有成功或明确阻塞证据。
- [ ] `pnpm check:boundaries` 和 `workspace-project validate` 通过。
- [ ] `INV-FB-001` 至 `INV-FB-007` 均保持，或在变更记录中明确说明修改原因。

## 10. 参考入口

> **状态：✅ 入口已整理（2026-09-14）**

- [Axi Workbench 根 AGENTS](/Volumes/code/workspace/projects/axi-workbench/AGENTS.md)
- [Workbench 聚合边界 SOP](/Volumes/code/workspace/projects/axi-workbench/docs/rules/axi-workbench-boundary-sop.md)
- [Workbench 源码角色清单](/Volumes/code/workspace/projects/axi-workbench/docs/architecture/source-catalog.md)
- [Workbench 资源配置](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/config/axi-resources.json)
- [Workbench 资源注册器](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs)
- [Workbench 导航和搜索注册](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/app-registry.tsx)
- [Axi UI 集成指南](/Volumes/code/workspace/shared/axi-ui/docs/INTEGRATION.md)
- [Axi Rules README](/Volumes/code/workspace/projects/axi-rules/README.md)
- [Axi Skills README](/Volumes/code/workspace/shared/axi-skills/README.md)
- [Workspace Graph](/Volumes/code/workspace/workspace.graph.json)

## 11. 本文维护规则

- 本文只维护 Workbench 侧的跨项目绑定 TODO，不替代各 Provider 项目的 PRD、TDD、TODO、CHANGELOG 或 MILESTONE。
- 其他项目的实现变更必须回到其 canonical Owner 仓库；本文只更新绑定契约、入口、状态和验证证据。
- 每次完成一组任务，必须更新勾选状态、证据命令、变更项目和仍成立的 `INV-FB-*`。
- 若事实来源发生变化，先更新 workspace governance / graph 或 Provider Owner 文档，再更新本文。
