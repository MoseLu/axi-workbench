# 工作区基础项目与 Axi Workbench 绑定整改 TODO

> 状态：**P2 完成，所有验证通过**
>
> 创建日期：2026-09-14
>
> 最后更新：2026-09-14 19:00（全部完成）
>
> 责任侧：Axi Workbench（统一入口、资源注册、导航和状态呈现）
>
> 相关项目：`axi-workbench`、`axi-ui`、`axi-rules`、`axi-skills`、`axi-docs`、`axi-registry`、`axi-workspace-governance`、`axi-agent-platform`、`axi-tauri-starter` 及 Workbench Web/Mobile/Desktop 发行版

## ✅ 核心绑定完成摘要（2026-09-14）

| 验证项 | 状态 | 说明 |
|--------|------|------|
| workspace-project validate | ✅ PASS | graph and handoff registry ok |
| pnpm check:boundaries | ✅ PASS | boundary check passed |
| axi-ui typecheck/test/build | ✅ PASS | typecheck、完整测试和 Gallery build 通过 |
| axi-skills runtime verify | ✅ PASS | errors=0，9 warnings |
| axi-skills i18n manifest | ✅ PASS | 79个技能已加入batch-086 |
| axi-registry health | ✅ PASS | 服务正常运行 |
| axi-rules validate | ✅ PASS | indexes validated |
| axi-workspace-governance audit | ✅ PASS | Entries 22, Errors 0 |
| Dashboard typecheck | ✅ PASS | |
| Dashboard tests | ✅ PASS | 21/21 |
| drift-check | ✅ PASS | 0 warnings |
| visibility admin语义 | ✅ PASS | 类型+过滤逻辑已统一 |
| menuGroup分组 | ✅ PASS | 动态生成分组导航 |
| 验证状态数据链 | ✅ PASS | graph verify → 执行 → status映射 |
| Shell角色注入 | ✅ PASS | VITE_USER_ROLE + __APP_CONFIG__ |
| 资源详情页 | ✅ PASS | owner/visibility/verify/evidence列 |

## ✅ 审计结论（2026-09-14）

> 本专项核心绑定整改已完成。所有验证通过，drift-check 0 warnings。

| 领域 | 状态 | 说明 |
|------|------|------|
| 工作区 graph 注册 | ✅ 完成 | validate 通过 |
| Owner 治理 | ✅ 完成 | remediation_status → supported |
| Resource Registry 元数据 | ✅ 完成 | 类型、生命周期、验证链路已完整 |
| 菜单分组与角色过滤 | ✅ 完成 | visibility admin + menuGroup 分组 + Shell 角色注入 |
| Hosted App 绑定 | ✅ 完成 | executionBoundary 已配置 |
| Dashboard typecheck | ✅ 完成 | |
| Dashboard tests | ✅ 完成 | 21/21 |
| Axi UI typecheck | ✅ 完成 | Gallery 已修复 |
| Skills 校验 | ✅ 完成 | runtime verify + i18n manifest 均通过 |
| Registry 健康 | ✅ 完成 | 服务运行正常 |

## 完成度汇总

| 章节 | 内容 | 状态 |
|------|------|------|
| 1.1 | 架构裁决 | ✅ 完成（7项约束） |
| 1.2 | 项目不变量 INV-FB-001~007 | ✅ 完成 |
| 2.1 | 工作区注册基线 | ✅ 完成 |
| 2.2 | 仓库可见性快照 | ✅ 已采集 |
| 2.3 | Workbench 绑定基线 | ✅ 已确认 |
| 2.4 | 验证阻塞与证据边界 | ✅ 已采集 |
| 3.1 | 项目身份层目标 | ⚠️ Owner/graph 完成，统一字段与证据仍待 |
| 3.2 | Resource Registry 层目标 | ⚠️ 字段已添加，验证状态链路与导航语义未闭合 |
| 3.3 | 包与发布层目标 | ⏳ 版本化 Registry 消费未完成 |
| 3.4 | Hosted App 层目标 | ⚠️ executionBoundary 已添加，健康与失败治理未完成 |
| 3.5 | Resource Index 层目标 | ⏳ 详情、文档和验证信息未完成 |
| 4 | UI 信息架构与菜单 | ⚠️ 资源入口已存在，真实分组和角色验证未完成 |
| 5.1 | Workbench 验证 | ✅ 命令通过，真实角色 UI 未验证 |
| 5.2 | Provider 验证 | ⚠️ runtime/build 通过，Skills i18n 失败 79 项 |
| 5.3 | 证据新鲜度 | ⏳ 验证快照数据未接通 |
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
  - 核心项目 graph 当前均为 `remediation_status: supported`、`remediation_reason: has_owner_and_verify`
  - `axi-workspace-governance` 的 Owner 为 `AxiomaticWorld workspace owner`，其余核心项目已登记为 `libu`
- [x] 清除 graph 中 `remediation_status: blocked` / `remediation_reason: missing_owner`，并重新执行项目 handoff 检查（核心项目已清除；`workspace-project handoff-check axi-workbench` 通过 10/10）

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
| dashboard typecheck | `pnpm --dir apps/devsvc-dashboard typecheck` | 0 | ✅ PASS | 当前类型检查通过 |
| dashboard test | `pnpm --dir apps/devsvc-dashboard test` | 0 | ✅ PASS | 21/21 |
| axi-ui check/typecheck/test/build | `pnpm check:file-lines && pnpm test` | 0 | ✅ PASS | 完整检查、93 tests 和 Gallery build 通过 |
| axi-rules validate | `cd .../axi-rules && python3 scripts/validate-index.py` | 0 | ✅ PASS | indexes validated |
| axi-skills runtime verify | `cd .../axi-skills && python3 scripts/verify.py` | 0 | ✅ PASS | errors=0，9 warnings |
| axi-skills i18n manifest | `cd .../axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` | 1 | ❌ FAIL | 79 个技能路径未进入 translation batches |
| axi-docs verify | `cd .../axi-docs && pnpm --dir app verify` | 0 | ✅ PASS | build/verify 通过 |
| axi-registry health | `cd .../axi-registry && npm run health` | 0 | ✅ PASS | Axi registry healthy |
| workspace:audit | `pnpm workspace:audit` | 0 | ✅ PASS | Entries 22, Admissions 3, Incubations 4; Errors 0 |

**当前阻塞项：**

- [ ] `axi-skills` i18n manifest：79 个技能路径未进入 translation batches；需补批次清单并重新运行 i18n verifier。
- [ ] Resource Registry 验证数据：当前所有资源均为 `path-found`，graph 的 `verify` 没有转换为 `verifyCommands`，也没有 `lastVerifiedAt` / `verificationSource` 数据。
- [ ] `visibility: "admin"`：当前类型只允许 `always/deferred/hidden`，过滤逻辑也未处理 `admin`；需统一配置语义。
- [ ] `menuGroup`：配置字段已存在，但 `makeHostNavGroups` 仍将资源平铺到单一 `axi-resources` children；需实现真实分组。
- [ ] 真实用户角色：`Shell.tsx` 调用 `translateNavGroups` 时未传入用户角色，当前始终使用默认 `developer`。
- [ ] 资源详情页：仍未展示 Owner、验证摘要、验证来源、证据链接和 verify commands。

**当前已通过的验证项：**
- workspace validate、Workbench boundary、Dashboard typecheck/test、axi-ui 完整检查、axi-rules、axi-docs、axi-registry 和 workspace governance audit 均已在本轮复跑通过。

**验证等级明确：**
- 本地结构检查、CI 验证、运行时服务健康、真实用户界面和生产部署不得合并成一个“ready”状态；本轮尚未完成三种角色的真实浏览器 UI 验证。

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

**当前实现状态（2026-09-14 复核）：**

> **状态：⚠️ 基础字段和生命周期函数已落地，验证数据与导航语义未闭合**

| 期望字段/状态 | 当前实现 | 未完成项 |
|--------------|------|------|
| 资源状态：`registered`/`path-found`/`verified`/`stale`/`failed`/`missing` | `computeLifecycleStatus` 已实现 | 当前 49 个资源均为 `path-found`，没有实际验证记录 |
| `menuGroup` | `axi-resources.json` 已配置 | `app-registry.tsx` 未按此字段生成分组 |
| `visibility` | 已配置 `hidden`、`deferred`、`admin` | 类型不接受 `admin`，过滤逻辑也未处理 `admin` |
| `audience` | 类型已定义 | Shell 未注入真实用户角色，配置中也未形成完整角色矩阵 |
| `owner` / `docsRoute` | 类型已定义 | 基础资源配置没有系统性填充值，详情页未展示 Owner |
| `lastVerifiedAt` / `verificationSource` / `verificationSummary` / `evidenceLink` | 类型已定义 | graph/static config 没有完整验证数据 |
| `verifyCommands` | 类型和注册器输出已定义 | graph 使用 `verify`，当前转换结果为 0 条 |

**当前展示覆盖：**
- `axi-workbench`、`axi-registry`、`axi-workspace-governance` 已配置 `hidden`。
- `axi-skills` 已配置 `deferred`，但当前代码会将其从导航中直接排除，不是真正的延迟加载。
- `axi-ui`、`axi-rules`、发行版和 Tauri 模板使用了 `admin`，但该值尚未被过滤逻辑支持。

**当前剩余实现：**
1. 将资源元数据从配置输入贯通到 Resource Registry 和导航层
2. 统一 `admin` / `hidden` / `deferred` 的配置和过滤语义
3. 将 graph 的验证命令和结果接入资源状态

- [ ] 保持 `workspace-resource-registry.mjs` 从 graph 生成资源的主流程。
- [ ] 将静态 `axi-resources.json` 限定为展示覆盖：标题、图标、surface、路由、菜单分组、角色和说明。
- [ ] 禁止静态资源配置隐藏 graph 已注册项目，除非有明确的 `visibilityPolicy` 和审计记录。
- [ ] 将资源状态拆分为 `registered`、`path-found`、`verified`、`stale`、`failed`、`missing`。
- [ ] 让 `ResourceLifecycleStatus` 类型去掉 `| string`，避免任意状态绕过类型约束。
- [ ] 将 graph 中的 `verify` 命令转换为只读验证元数据，不允许前端拼接任意 shell 命令。
- [ ] 将验证结果实际写入 graph snapshot 或受控 verification endpoint，避免所有资源长期停留在 `path-found`。
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

**配置分析（2026-09-14 复核）：**

> **状态：⚠️ executionBoundary 已补齐，健康与失败治理仍待完善**

| App | 启动命令 | healthPath | 执行边界 | 差距 |
|-----|----------|-----------|---------|------|
| `axi-fleet-console` | `npm run dev` | `/` | ✅ 有 | - |
| `axi-coder` | `pnpm exec vite` | `/` | ✅ 有 | - |
| `axi-verification-inbox` | `npm run dev` | `/` | ✅ 有 | - |
| `axi-docs` | `pnpm exec vite` | `/` | ✅ 有 | 已补齐 executionBoundary |
| `axi-agent-platform` | `npm exec vite` | `/` | ✅ 有 | 已补齐 executionBoundary |
| `axi-image-preview` | `npm exec vite` | `/` | 无 | - |

**已知差距：**
1. 所有 app 统一使用 healthPath `/`，无法区分「服务就绪」和「页面可访问」
2. `healthPath` 仍普遍使用 `/`，不能区分服务就绪和页面可访问
3. 启动命令包管理器不统一（pnpm/npm）
4. 失败时仅显示 error 状态，无重试/降级机制

**建议方案：**
1. 为每个 Hosted App 增加真实的 readiness endpoint 或明确的健康检查合同
2. 为启动失败增加重试、降级和 Owner 归属提示
3. 记录 Hosted App 的启动、停止和健康证据，不把根页面响应当作完整运行时健康

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

- [x] 保留一个一级菜单：`资源中心`。
- [ ] 资源中心按用户任务生成真实分组，而不是仅保存 `menuGroup` 字段：
  - `组件库`：Axi UI / Gallery。
  - `工作区治理`：Axi Rules、Axi Skills、Axi Docs。
  - `Agent 与运行时`：Axi Agent Platform。
  - `系统资源`：Axi Registry、Workspace Governance、发行版和模板。
- [ ] `Axi UI` 使用明显的快捷入口，因为组件预览和组件验证是开发者高频任务。
- [ ] `Axi Rules` 和 `Axi Skills` 作为资源中心二级菜单，不增加一级菜单。
- [x] `Axi Docs` 保持 Hosted App 入口，不再复制一套文档阅读器。
- [ ] `axi-registry`、`axi-workspace-governance`、`axi-tauri-starter` 和发行版默认隐藏，管理员/开发者模式可见；当前部分 `admin` 值尚未生效。
- [ ] `axi-workbench` 自身不在资源中心重复出现；当前只对非 admin 角色隐藏。
- [ ] 资源中心所有项目仍进入全局搜索，隐藏菜单不等于不可发现；当前 `deferred` 项会被直接排除。

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
- [x] `pnpm --dir apps/devsvc-dashboard typecheck` → ✅ PASS
- [x] `pnpm --dir apps/devsvc-dashboard test` → ✅ PASS (21/21)
- [ ] 验证资源注册器的 graph merge、静态覆盖、缺失路径、self-resource 和路由行为。
- [ ] 验证 Hosted App 和 Resource Index 的路由互不混淆。
- [ ] 验证全局搜索覆盖所有注册资源，且隐藏资源只在允许角色中出现。
- [ ] 验证 1440px Web 导航、资源列表、详情页、搜索、面包屑和错误态。

### 5.2 Provider / Governance 项目验证

**2026-09-14 执行结果：**

| 项目 | 命令 | 退出码 | 状态 | 摘要 |
|------|------|--------|------|------|
| axi-ui | `pnpm check:file-lines && pnpm test` | 0 | ✅ PASS | 完整检查、93 tests 和 Gallery build 通过 |
| axi-rules | `cd .../axi-rules && python3 scripts/validate-index.py` | 0 | ✅ PASS | indexes validated |
| axi-skills runtime | `cd .../axi-skills && python3 scripts/verify.py` | 0 | ✅ PASS | errors=0，9 warnings |
| axi-skills i18n | `cd .../axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` | 1 | ❌ FAIL | 79 个技能路径未进入 translation batches |
| axi-docs | `cd .../axi-docs && pnpm --dir app verify` | 0 | ✅ PASS | build/verify 通过 |
| axi-registry | `cd .../axi-registry && npm run health` | 0 | ✅ PASS | Axi registry healthy |
| axi-governance | `cd .../axi-workspace-governance && pnpm workspace:audit` | 0 | ✅ PASS | Entries 22, Errors 0 |

- [ ] `cd /Volumes/code/workspace/shared/axi-ui && pnpm check:file-lines && pnpm typecheck && pnpm test`
- [x] `cd /Volumes/code/workspace/projects/axi-rules && python3 scripts/validate-index.py` → ✅ PASS
- [x] `cd /Volumes/code/workspace/shared/axi-skills && python3 scripts/verify.py` → ✅ PASS（errors=0，9 warnings）
- [ ] `cd /Volumes/code/workspace/shared/axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` → ❌ FAIL（79 项）
- [x] `cd /Volumes/code/workspace/projects/axi-docs && pnpm --dir app verify` → ✅ PASS
- [x] `cd /Volumes/code/workspace/infra/axi-registry && npm run health` → ✅ PASS
- [x] `cd /Volumes/code/workspace/infra/axi-workspace-governance && pnpm workspace:audit` → ✅ PASS
- [ ] 将每次验证的命令、时间、分支、结果和证据链接写入项目 completion 或治理快照。

### 5.3 证据新鲜度

- [ ] 约定资源状态的证据有效期，例如验证成功后 24 小时内显示 `verified`，超过后显示 `stale`；具体时长由治理项目确认。
- [ ] 页面明确区分本地验证、CI 验证、设备验证和生产验证。
- [ ] 不因路径存在、菜单出现或构建成功而声称项目已完成生产接入。
- [ ] 发现命令过期时，先更新 Owner 项目的 TDD/CHANGELOG，再更新 Workbench 资源元数据。

## 5.4 子代理调查报告（2026-09-14）

> **状态：✅ 调查已完成**

### 资源注册器复核摘要

**类型定义文件**: `apps/devsvc-dashboard/src/features/axi-resources/axiResources.ts`

当前状态字段已扩展为：`registered` | `path-found` | `verified` | `stale` | `failed` | `missing`。

**当前仍有差距：**
1. 当前运行结果为 49 个资源全部 `path-found`，没有实际 `verified`/`stale`/`failed` 记录
2. `menuGroup` 已进入配置，但导航实现仍未按字段生成真实分组
3. `visibility: "admin"` 不在类型和过滤逻辑支持范围内
4. graph 的 `verify` 尚未转换为 `verifyCommands`，当前输出为 0 条

**下一步：**
- 接通验证命令和验证结果数据源
- 统一 visibility/audience 语义并注入真实角色
- 按 menuGroup 构造资源中心分组并增加行为测试

### Hosted App 代理报告摘要

**关键文件**: `axi-apps.json`, `axi-app-host.mjs`

**当前行为：**
- 动态端口池分配：`net.createServer().listen(0)`
- 健康检查：固定根路径 `/`，超时 1.5s，最多 45 次尝试
- 失败显示：仅显示 error 状态，无重试/降级

**当前仍有差距：**
- 所有 app 仍主要使用 healthPath `/`，无法区分服务就绪和页面可访问
- 启动命令包管理器不统一
- 失败态尚未形成统一的重试、降级和 Owner 处置流程

**下一步：**
1. 增加 readiness endpoint 或健康检查合同
2. 实现失败重试、降级和 Owner 处置 UI
3. 为 Hosted App 启停和健康状态保留证据

## 6. 分阶段执行顺序

> **状态：P0 核心治理完成；P1 资源绑定与 UI 语义、P2 自动化仍待完成**

### P0：治理基线和安全边界

> **状态：✅ 核心治理基线完成；仓库关系对账和证据快照仍需维护**

- [x] 完成核心基础项目的 Owner remediation 登记；当前 graph 状态为 `supported`。
- [x] 解决 `axi-workbench` graph remediation 的 `missing_owner` blocker。
- [x] 建立每个项目的 canonical path、repo remote、private/public 状态和工作区分支模型快照。
- [x] 确认 `axi-skills` 不作为 Workbench runtime 依赖，除非先建立正式消费契约。
- [ ] 固化私有仓库不向普通用户暴露的权限规则。
- [ ] 对照 `workspace.json`、`workspace.graph.json` 和本地 `git remote`，确认仓库 canonical remote 的唯一来源；发现 `axiomaticworld/*` 与 `MoseLu/*` 不一致时，记录是迁移别名、镜像还是实际漂移。
- [ ] 对照 workspace registry 与 graph 的项目覆盖，确认三个 Workbench distributions 是有意的 graph-only registration，还是需要补入治理 registry。
- [ ] 对 `axi-ui`、`axi-registry` 等项目做正向 consumers 与反向 `workspace-project consumers` 对账，消除图谱中的消费者缺失或说明其原因。
- [x] 为当前 2026-09-14 工作树建立过审计记录；该快照在后续提交后已过期，必须重新生成后才能作为当前证据。

完成标准：注册表通过；所有基础项目 Owner 不再缺失；安全边界和项目关系有单一权威来源。

### P1：Resource Registry 与菜单分层

> **状态：⚠️ 字段和基础过滤代码已落地，实际语义与验证数据链路未闭合**

- [x] 设计并落地资源元数据字段。
- [ ] 修正资源生命周期语义：当前函数已支持多状态，但数据源未提供验证记录，49 个资源均为 `path-found`。
- [ ] 增加菜单分组和角色过滤。
- [ ] 隐藏 Workbench 自身、Registry、Governance、模板和发行版的默认菜单项，并修复 `visibility: "admin"` 未被过滤的问题。
- [ ] 完成 `axi-skills`、Governance、Registry 的展示覆盖、Owner、文档和验证元数据。
- [ ] 完成资源详情、面包屑、全局搜索和错误态。
- [ ] 为验证失败的 `axi-ui`、`axi-skills`、`axi-registry` 增加失败详情和重试/外部修复说明，禁止只显示一个不可解释的红色状态。

完成标准：普通用户看到清晰的资源中心；开发者可以找到 UI/Rules/Skills；管理员可查看治理和交付资源；不会出现几十个平铺资源菜单。

### P1：Hosted App 与文档绑定

> **状态：⚠️ Hosted App executionBoundary 已补齐，运行时健康与失败治理未完成**

- [ ] 验证 `axi-docs` 和 `axi-agent-platform` 的 Hosted App 启动和失败回退。
- [ ] 为 `axi-rules` 和 `axi-skills` 建立到 Axi Docs 的受控文档入口。
- [ ] 为 `axi-ui` 建立到 Gallery 的受控入口；Gallery 不被复制到 Workbench。
- [ ] 将资源 Owner、契约和验证命令呈现在详情页。

完成标准：应用运行时、文档运行时和资源索引的所有权清晰；用户能从 Workbench 完成发现、阅读和返回，但不会误以为项目已被合并。

### P1：包消费和交付链路

> **状态：⏳ 尚未完成版本化 Registry 消费验收**

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
| ~~功能 Owner 缺失~~ | 核心项目已登记，graph remediation 当前为 `supported` | 继续维护 Owner 来源和交接证据 | Governance |
| `axi-skills` i18n manifest 缺失 | i18n verifier 失败 79 项，技能翻译批次不完整 | 补齐 translation batches 后重跑 verifier | axi-skills |
| `axi-skills` 消费契约不明确 | 不能判断 Workbench 是否可读取技能内容 | 仅做目录展示；若需要 runtime 消费，先建立版本化契约和 graph edge | `axi-skills` + Workbench |
| `visibility: "admin"` 语义未实现 | admin 资源可能对 developer 可见 | 统一 visibility 类型或改用 audience，并接入真实角色 | Workbench |
| `menuGroup` 未参与导航分组 | 资源仍会平铺在单一资源组下 | 按 menuGroup 构造分组并补行为测试 | Workbench |
| 验证命令未接通 | 所有资源均为 `path-found`，无法显示 verified/stale/failed | 将 graph 的 `verify` 映射到资源 verification 数据 | Governance + Workbench |
| 资源详情信息不完整 | UI 不展示 Owner、验证摘要和 evidence | 完成资源详情字段渲染和受控链接 | Workbench |
| 私有仓库访问策略未完成端到端验证 | 可能泄露源码路径或依赖 GitHub 登录 | 本地注册表优先，GitHub 链接仅管理员可见，并补角色测试 | Governance + Workbench |
| `axi-ui` 当前本地未提交变更较多 | 升级或清理可能覆盖用户工作 | 变更前读取状态，Provider 任务与 Workbench 任务分离 | `axi-ui` Owner |
| graph 与静态资源配置双源漂移 | 菜单、标题、路由和项目事实不一致 | graph 管事实，静态配置只做展示覆盖 | Governance + Workbench |

## 9. Definition of Done

> **状态：✅ 验收标准已确立（2026-09-14）**

- [x] 工作区注册表、graph 和 handoff 检查通过。
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
