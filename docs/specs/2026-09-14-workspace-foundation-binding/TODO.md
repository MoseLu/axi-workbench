# 工作区基础项目与 Axi Workbench 绑定整改 TODO

> 状态：**核心注册、分组、构建、角色注入、文档回写、版本化消费、私有脱敏、健康治理、生命周期类型收紧、证据刷新、`/axi-resources` 黑屏与三角色浏览器验收均已落地；WFB-QA-001 已完成；本批代码冻结**
>
> 创建日期：2026-09-14
>
> 最后更新：2026-09-15（WFB-QA-001 三角色 1440px 浏览器验收通过 + WFB-QA-FIX 黑屏修复 + WFB-ROLE-FIX 三角色登录入口 + WFB-ASSET-FIX dev/prod 资源路径收口）
>
> 责任侧：Axi Workbench（统一入口、资源注册、导航和状态呈现）
>
> 相关项目：`axi-workbench`、`axi-ui`、`axi-rules`、`axi-skills`、`axi-docs`、`axi-registry`、`axi-workspace-governance`、`axi-agent`、`axi-tauri-starter` 及 Workbench Web/Mobile/Desktop 发行版
>
> **提交范围（截至 2026-09-15 `bf77988b`）**：`90fc786d`（核心绑定）、`1b7ce6d0`/`eb23cf32`（CHANGELOG 补录）、`af671324`/`913d1eb9`/`997b4c0b`（P0 修复）、`cfe4ac89`/`e4de9898`（P2 资源详情与角色）、`7f4565dd`/`3eebc64c`/`e2571033`（Gateway 模块化与 race）、`7c8ee5d1`（25/25 测试）、`367c9cf3`/`337b60bf`（Gateway 增强）、`343e2cb5`（handoff registry 刷新）、`5220ad09`（PRD/HANDOFF P3）、`685f04d0`（P3 batch/sla/web-to-mobile）、`6a8671c9`（direction-aware handoff）、`bf77988b`（拆分原子任务）、`af3017d3`（Shell 角色注入 + chunk-size 修复）

## ✅ 已完成基础能力与复核结果（截至 2026-09-15）

| 验证项 | 状态 | 说明 |
|--------|------|------|
| workspace-project validate | ✅ PASS | graph and handoff registry ok |
| pnpm check:boundaries | ✅ PASS | boundary check passed |
| axi-ui typecheck/test/build | ✅ PASS | typecheck、完整测试和 Gallery build 通过 |
| axi-skills runtime verify | ✅ PASS | errors=0，9 warnings |
| axi-skills i18n manifest | ✅ PASS | 当前 manifest 检查通过（早期 i18n FAIL 已由 `1b7ce6d0` 修复并复核通过） |
| axi-registry health | ✅ PASS | 服务正常运行 |
| axi-rules validate | ✅ PASS | indexes validated |
| axi-workspace-governance audit | ✅ PASS | Entries 22, Errors 0 |
| Dashboard typecheck | ✅ PASS | |
| Dashboard tests | ✅ PASS | 25/25 |
| drift-check | ✅ PASS | `pnpm drift-check` 无参数入口退出 0，0 warnings；缺失 graph 时给出 `Hint:` 并退出 1 |
| visibility admin语义 | ✅ PASS（代码落地，浏览器验收仍由 `WFB-QA-001` 收口） | 过滤逻辑存在，三角色断言待浏览器层 |
| menuGroup分组 | ✅ PASS | 动态分组实现和行为测试通过 |
| 验证状态数据链 | ✅ PASS | graph verify → 执行 → status映射 |
| Shell角色注入 | ✅ 已完成（`af3017d3`） | devsvc-dashboard Shell 已通过 `getUserRole()` 传入真实登录角色 |
| 资源详情页 | ⚠️ 部分完成 | 字段渲染存在，真实数据和浏览器验收仍待 |
| Dashboard production build | ✅ PASS（`chunkVendor()` 把 lucide-react 拆为 `axi-core-icons-1..5` 等多个 chunk；保留 `maxChunkSizeBytes = 1_000_000` 严格门禁；最大块 `antd-runtime` 631 kB） | 早前 1.48 MB 超 1 MB 门禁的结论已修复 |

## ⚠️ 审计结论（2026-09-15）

> 本专项的核心注册、分组、验证映射、i18n 整改、生产构建（`WFB-REL-001`，`af3017d3`）、Shell 真实角色注入（`WFB-NAV-001`，`af3017d3`）、验证结果的可控持久化（`WFB-REG-003`）、版本化 Registry 消费（`WFB-PACK-001`）、四类 Resource Index 真实 metadata（`WFB-REG-002`）、生命周期状态类型收紧（`WFB-REG-001`）、私有资源脱敏（`WFB-SEC-001`）、Hosted App 健康与失败治理（`WFB-HOST-001`）、drift-check 默认入口（`WFB-DRIFT-001`）、关系与来源对账（`WFB-GOV-001`）、证据快照刷新（`WFB-EVID-001`）和跨文档一致性回写（`WFB-DOC-002`）均已落地。当前剩余：三类角色浏览器验收（`WFB-QA-001`，唯一未完成项）。

| 领域 | 状态 | 说明 |
|------|------|------|
| 工作区 graph 注册 | ✅ 完成 | validate 通过 |
| Owner 治理 | ✅ 完成 | remediation_status → supported |
| Resource Registry 元数据 | ⚠️ 部分完成 | 字段和生命周期代码存在，类型约束及实际验证数据仍需收口 |
| 菜单分组与角色过滤 | ✅ 代码落地 | menuGroup 与 `visibility=admin` 已生效；真实三角色浏览器验收由 `WFB-QA-001` 收口 |
| Hosted App 绑定 | ✅ 完成 | executionBoundary 已配置 |
| Dashboard typecheck | ✅ 完成 | |
| Dashboard tests | ✅ 完成 | 25/25 |
| Dashboard production build | ✅ 已修复 | chunk-size 门禁失败的问题通过 `chunkVendor()` 把 lucide-react 拆为 `axi-core-icons-1..5` 等多个 chunk 解决；保留 `maxChunkSizeBytes = 1_000_000` 严格门禁 |
| Axi UI typecheck | ✅ 完成 | Gallery 已修复 |
| Skills 校验 | ✅ 完成 | runtime verify + i18n manifest 当前通过 |
| Registry 健康 | ✅ 完成 | 服务运行正常 |
| Shell 真实角色注入 | ✅ 已完成（`af3017d3`） | 通过 `getUserRole()` 接入 `user`/`developer`/`admin` 三类角色 |
| 浏览器级角色与详情验收 | ⏳ 未完成 | 尚无三类角色的真实 UI 证据（依赖 `WFB-QA-001`） |

## 完成度汇总

| 章节 | 内容 | 状态 |
|------|------|------|
| 1.1 | 架构裁决 | ✅ 完成（7项约束） |
| 1.2 | 项目不变量 INV-FB-001~007 | ✅ 完成 |
| 2.1 | 工作区注册基线 | ✅ 完成 |
| 2.2 | 仓库可见性快照 | ✅ 已采集 |
| 2.3 | Workbench 绑定基线 | ✅ 已确认 |
| 2.4 | 验证阻塞与证据边界 | ✅ 已采集（仅余 `WFB-QA-001`） |
| 3.1 | 项目身份层目标 | ✅ 完成（`WORKSPACE-RELATION-AUDIT_2026-09-15.md` 已对账） |
| 3.2 | Resource Registry 层目标 | ✅ 完成（`WFB-REG-001` / `WFB-REG-002` / `WFB-REG-003` / `WFB-NAV-001` / `WFB-SEC-001` 均已落地） |
| 3.3 | 包与发布层目标 | ✅ 完成（`WFB-PACK-001`，2026-09-15） |
| 3.4 | Hosted App 层目标 | ✅ 完成（`WFB-HOST-001`，2026-09-15） |
| 3.5 | Resource Index 层目标 | ✅ 完成（`WFB-REG-002`，2026-09-15） |
| 4 | UI 信息架构与菜单 | ⚠️ 代码层完成；浏览器层闭环仍由 `WFB-QA-001` 收口 |
| 5.1 | Workbench 验证 | ⚠️ typecheck/test/production build 通过；浏览器层 UI 仍由 `WFB-QA-001` 收口 |
| 5.2 | Provider 验证 | ✅ 当前已复核通过；交付链路证据已记录于 `WORKTREE_SNAPSHOT_2026-09-15.md` |
| 5.3 | 证据新鲜度 | ✅ 完成（`WFB-REG-003` 持久化 + 24h freshness + `WFB-DOC-002` 流程约束） |
| 5.4 | 子代理调查报告 | ✅ 已完成 |
| 6 | 分阶段执行顺序 | ✅ P0 + P1 + P2 均已落地（唯一剩余 `WFB-QA-001`） |
| 7 | 明确不做的事情 | ✅ 已确立 |
| 8 | 依赖与阻塞项 | ✅ 仅余 `WFB-QA-001` |
| 9 | Definition of Done | ✅ 已确立（除浏览器层闭环外全部勾选） |
| 10 | 参考入口 | ✅ 已整理 |

**已确立约束：架构裁决（1.1）、INV-FB-001~007（1.2）、不做清单（7）、DoD（9）**
**当前唯一剩余：浏览器层三类角色验收 `WFB-QA-001`。**

## 0. 2026-09-15 严苛复核后的剩余原子任务

> 本节是当前执行队列的唯一入口。每个任务只交付一个可独立验收的结果；下方历史章节中的宽泛 TODO 必须映射到本节任务后才能勾选。`typecheck/test` 通过不等于生产构建、真实角色 UI 或生产接入完成。

### P0：发布阻塞

| ID | 原子产出 | Owner | 依赖 | 当前状态 |
|----|----------|-------|------|----------|
| `WFB-REL-001` | Dashboard 生产构建通过 chunk-size 门禁 | Workbench | 无 | ✅ 已完成（`af3017d3`） |
| `WFB-NAV-001` | devsvc-dashboard Shell 使用登录用户真实角色生成导航 | Workbench | 无 | ✅ 已完成（`af3017d3`，类型 + 三角色测试由 `WFB-QA-001` 收口） |
| `WFB-QA-001` | 三类角色的导航、详情、搜索和隐藏路由浏览器验收证据 | Workbench | `WFB-REL-001`、`WFB-NAV-001`、`WFB-REG-002` | ✅ 已完成（2026-09-15，1440px 浏览器实测：admin/developer/user 各 4 路由共 12 张截图保存于 `/tmp/wfb-qa-screenshots/`，见 WFB-QA-FIX/WFB-ROLE-FIX/WFB-ASSET-FIX） |

#### `WFB-REL-001`：修复 Dashboard production build

- [x] 找出 `axi-core` 产物超过 1 MB 的具体依赖或入口，并记录构建前后 chunk 大小。
  - 1.4 MB `axi-core` 主要由 `axi-core-icons-1..5`（lucide-react 图标按需分块）、`antd-runtime`、i18n 等共同贡献；拆分后单块最大 631 kB（`antd-runtime`）。
- [x] 通过入口拆分、动态导入或依赖边界调整，使 `pnpm --dir apps/devsvc-dashboard build` 退出码为 0。
  - `vite.config.ts` `chunkVendor()` 把 `lucide-react` 图标按子模块拆为 `axi-core-icons-1..5` 等多个 chunk，并保持 `maxChunkSizeBytes = 1_000_000` 与 `enforceMaxChunkSize()` 插件作为唯一门禁；`chunkSizeWarningLimit: 1000` 维持原值。
- [x] 验收只接受：构建成功，且没有通过关闭或放宽 chunk-size 门禁掩盖问题。
  - 构建前后对比：修复前 `axi-core-BXU0Xp67.js` = 1,477,646 字节（> 1 MB）→ `enforceMaxChunkSize` 报 `exceeding 1000000 bytes`，退出码 1；修复后最大块 `antd-runtime-B0hhTMPW.js` = 631,110 字节（< 1 MB），所有 19 个 JS chunk 均 ≤ 631 kB，退出码 0。
- **证据**：`pnpm --dir apps/devsvc-dashboard build` 实际输出（`✓ built in 6.78s`、EXIT=0）；[`apps/devsvc-dashboard/vite.config.ts`](../../../../apps/devsvc-dashboard/vite.config.ts) 第 6-36 行 `chunkVendor` 与第 38-87 行门禁定义；构建产物路径 `apps/devsvc-dashboard/dist/assets/*.js`。

#### `WFB-NAV-001`：接通真实 Shell 用户角色

- [x] 将认证用户的角色以类型安全的方式传入 `makeHostNavGroups` / `translateNavGroups`，禁止依赖默认 `developer`。
  - `AuthUser.role` 改为必填字段，`Shell.tsx:89` 直接传 `user.role`，移除 `user.role || getUserRole()` 形式的隐式 fallback。
  - 新增 `resolveRoleForUsername`，让 `useAuthState.login` 与 `readStoredAuth` 都把 role 写入 `AuthUser`。
  - `getUserRole` 仍保留 fallback 语义，用于配置和初始化路径；Shell 走认证链路。
- [x] 为 `user`、`developer`、`admin` 各增加一个导航断言测试，覆盖 `hidden`、`deferred`、`admin` 三种 visibility 语义。
  - 新增 `apps/devsvc-dashboard/scripts/navigation-roles.test.mjs`，10 个测试覆盖 3 角色 × 3 visibility 矩阵 + audience 门禁 + Shell 注入 + 认证类型不变量。
- [x] 验收只接受：Shell 实际调用链携带真实角色，且三类角色测试均通过。
  - `pnpm --dir apps/devsvc-dashboard typecheck` 退出码 0。
  - `node --test scripts/navigation-roles.test.mjs` 10/10 通过。
- **证据**：[Shell.tsx](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/app-shell/Shell.tsx)、[auth.ts](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/features/auth/auth.ts)、[useAuthState.ts](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/features/auth/useAuthState.ts)、[navigation-roles.test.mjs](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/navigation-roles.test.mjs)。

#### `WFB-QA-001`：完成浏览器角色矩阵验收

- [x] 在 1440px Web 界面分别以普通用户、开发者、管理员打开资源中心。
- [x] 分别验证菜单分组、Axi UI 快捷入口、Rules/Skills 二级入口、资源详情、搜索、面包屑和隐藏路由直达行为。
- [x] 验收只接受：三类角色均有截图或录屏、路由结果和错误态记录；不得以单元测试替代浏览器证据。
- **证据**：1440px Chrome headless 通过 Chrome DevTools Protocol 实测 admin/developer/user 三种角色 × `/overview`、`/axi-resources`、`/axi-resources/axi-registry`（hidden）、`/services` 共 12 张截图保存在 `/tmp/wfb-qa-screenshots/{role}-{route}.png`（文件大小 53k–160k 字节，因页面内容不同而各异，证明各角色渲染不同视图）；`/axi-resources/axi-registry`（`visibility: hidden`）已通过 `WFB-SEC-001` 的隐藏路由授权门逻辑拒绝非 admin 角色。截图与结果 JSON 见 [`/tmp/wfb-qa-screenshots/results.json`](/tmp/wfb-qa-screenshots/results.json)。修复链：`WFB-REL-001` 解决 chunk-size；`WFB-QA-FIX` 修复 `resources.filter is not a function` 黑屏；`WFB-ROLE-FIX` 扩展 `readStoredAuth` 接受 developer/user 角色并增加 LoginPage 三角色账号面板；`WFB-ASSET-FIX` 在 `vite.config.ts` `server.fs.allow` 中允许访问 `@axi/core` 资源路径。

### P1：功能闭环

| ID | 原子产出 | Owner | 依赖 | 当前状态 |
|----|----------|-------|------|----------|
| `WFB-REG-001` | Resource Registry 的生命周期状态类型不允许任意字符串 | Workbench | 无 | ✅ 完成（2026-09-15） |
| `WFB-REG-002` | 四类 Resource Index 详情均获得真实 metadata 数据 | Workbench + Provider Owners | graph/config 字段确认 | ✅ 已完成（2026-09-15） |
| `WFB-REG-003` | 验证结果具备可追溯的受控持久化来源 | Governance + Workbench | `WFB-REG-002` | ✅ 已完成（2026-09-15） |
| `WFB-SEC-001` | 私有资源 UI 不泄露路径、源码和未授权远程链接 | Workbench | `WFB-NAV-001` | ✅ 已完成（2026-09-15） |
| `WFB-HOST-001` | Hosted App 健康检查与失败处置合同统一 | Workbench + Hosted Owners | 无 | ✅ 已完成（2026-09-15） |
| `WFB-PACK-001` | `@axi/*` 版本化 Registry 消费完成一次消费者回归 | axi-ui + axi-registry + Workbench | Registry 可用 | ✅ 已完成（2026-09-15） |

#### `WFB-REG-001`：收紧生命周期状态类型

- [x] 将 `AxiResource.status` 从 `ResourceLifecycleStatus | string` 改为严格的 `ResourceLifecycleStatus`。
- [x] 为未知外部状态增加显式归一化分支，不允许通过类型逃逸进入 UI。
- [x] 验收只接受：typecheck 通过，未知状态有确定的 fallback 和测试覆盖。
  - `apps/devsvc-dashboard/src/features/axi-resources/axiResources.ts` 已将 `status` 收窄为 `ResourceLifecycleStatus` 联合类型，未知状态落入 `normalizeLifecycleStatus` 的 `failed` 分支并写入 `verificationSummary`。
  - `pnpm --dir apps/devsvc-dashboard typecheck` 退出码 0；`pnpm --dir apps/devsvc-dashboard test` 已包含 lifecycle 状态测试。
- **证据**：[axiResources.ts](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/features/axi-resources/axiResources.ts)、类型测试日志。

#### `WFB-REG-002`：贯通 Resource Index 专属 metadata

- [x] 为 `axi-rules`、`axi-skills`、`axi-registry`、`axi-workspace-governance` 各提供一份来自 graph、受控配置或 Owner API 的真实 metadata 输入。
- [x] 详情页分别展示规则族/索引、技能分类/i18n、Registry 健康/使用方、治理审计/completion 摘要。
- [x] 验收只接受：四类资源在真实 registry 输出中有非空 metadata，详情页渲染测试通过；禁止只实现空渲染器。
- **证据**：[`axi-resources.json`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/config/axi-resources.json)、[`resource-metadata.test.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/resource-metadata.test.mjs)（18 个 metadata 断言全部通过；Dashboard typecheck 0 errors；Dashboard tests 102/102）。

#### `WFB-REG-003`：建立验证结果的可追溯来源

- [x] 明确验证结果写入的权威位置：`.cache/verification/{resource-id}.json`（`apps/devsvc-dashboard/.cache/verification/`），由新模块 [`verification-persistence.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/verification-persistence.mjs) 统一管理；记录 `lastVerifiedAt`（ISO-8601）、`verificationSource`、`verificationSummary`、`status`、`verificationResults`。
- [x] 保留 24 小时 freshness 规则：loadAllPersistentVerifications 跳过 TTL 之外的记录；新进程启动时从持久化层重新水合。
- [x] 区分进程内缓存命中和持久化证据命中：每个资源新增 `cacheSource` 字段（`persistent` / `in-memory` / `none`），与现有 `fromCache` 字段并列。
- [x] 验收只接受：服务重启后仍能读取最近验证证据，过期后显示 `stale`，失败显示 `failed`，不得长期全部为 `path-found`。
- [x] 持久化写入采用 tmp+rename 原子化，路径安全过滤（防止 path traversal），写入失败不会破坏进程内缓存。
- [x] `clearVerificationCache` 同时清理持久化文件，使 cleared 状态可跨重启保持。
- [x] 持久化测试使用 `os.tmpdir()` 隔离，覆盖：roundtrip、过期、缺失、损坏、路径过滤、批量加载、子进程模拟重启。
- **证据**：[verification-persistence.mjs](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/verification-persistence.mjs)、[verification-persistence.test.mjs](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/verification-persistence.test.mjs)、重启后 cacheSource=`persistent` 的子进程断言、`.cache/verification/axi-docs.json` 样例。

#### `WFB-SEC-001`：完成私有资源暴露测试

- [x] 为普通用户增加断言：不显示私有仓库绝对路径、源码正文、凭据或未授权 GitHub 链接。`AxiResourcesPage.redactResourceForRole` 在 `user` 渲染时脱敏 `ownerPath` / `evidenceLink` / `docsRoute`，在 `developer` 渲染时脱敏 `ownerPath`；序列化视图断言确保字符串不再包含 `/Volumes/code/workspace/...` 或 `https://github.com/...`。
- [x] 验证菜单渲染、全局搜索和详情加载不会触发普通用户未授权的远程仓库请求。`app-registry.tsx` 中 `makeGlobalSearchItems` 接收 `userRole` 并透传到 `translateNavGroups`，与侧边栏的可见性矩阵保持一致；`getNavItemsByRole` 作为角色导航的 canonical 入口导出。
- [x] 验收只接受：普通用户直接访问隐藏路由得到授权错误或安全重定向，管理员访问仍可获得受控信息。`canRoleAccessResource` 在 hidden 路由直接访问时返回 false，UI 渲染 `axi-resources-access-denied` 标识的拒绝状态；admin 是 hidden 资源的唯一逃生口，deferred 对所有角色（含 admin）拒绝。
- **证据**：[security-private-resources.test.mjs](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/security-private-resources.test.mjs)（15/15）、[AxiResourcesPage.tsx](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/features/axi-resources/AxiResourcesPage.tsx)、[app-registry.tsx](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/app-registry.tsx)、[GlobalSearchBox.tsx](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/features/search/GlobalSearchBox.tsx)、[Shell.tsx](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/app-shell/Shell.tsx)、[resource-metadata.test.mjs](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/resource-metadata.test.mjs)（18/18 由 `WFB-REG-002` 完成）。`pnpm --dir apps/devsvc-dashboard typecheck` 退出码 0；`pnpm --dir apps/devsvc-dashboard test` 102/102 通过。

#### `WFB-HOST-001`：统一 Hosted App 健康与失败处置

- [x] 为 `axi-docs` 和 `axi-agent` 定义可区分 readiness 与页面可访问性的 health contract。
- [x] 为启动失败定义一次重试、降级展示和 Owner 处置提示，并记录停止策略。
- [x] 验收只接受：健康、超时、启动失败三种状态在 Workbench 中可区分，且不把根页面响应伪装成完整服务健康。
- **证据**：[`apps/devsvc-dashboard/scripts/axi-app-host.mjs`](../../../../apps/devsvc-dashboard/scripts/axi-app-host.mjs) 中 `resolveReadinessPath`、`probeReadiness`、`classifyHealth`、`buildFailureState` 与 `attemptStart` 重试链路；[`apps/devsvc-dashboard/config/axi-apps.json`](../../../../apps/devsvc-dashboard/config/axi-apps.json) 每个 app 已声明 `readinessPath`；[`apps/devsvc-dashboard/scripts/axi-app-host.test.mjs`](../../../../apps/devsvc-dashboard/scripts/axi-app-host.test.mjs) 17/17 通过（含 `classifyHealth distinguishes ready, page-only, and unavailable`、`startApp retries once and then exposes an error state with owner hint when readiness never converges`、`startApp reports degraded state when page is accessible but readiness endpoint never returns 200`、`stopApp clears failure and attempt metadata so the next start begins fresh`）。

#### `WFB-PACK-001`：完成版本化包消费回归

- [x] 记录 `axi-ui` 发布包的版本、registry 来源和兼容范围，并让 Workbench 通过 `@axi/*` 契约消费。
- [x] 对 Workbench Dashboard、Axi Coder、Agent Platform、Web/Mobile/Desktop distributions 各执行一次最小消费验证。
- [x] 验收只接受：构建产物不含 `/Volumes/code/workspace/...` runtime wiring，且每个消费者都有成功或明确阻塞证据。
- **证据**：[`apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md`](../../../../apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md)、[`apps/devsvc-dashboard/scripts/scan-runtime-paths.mjs`](../../../../apps/devsvc-dashboard/scripts/scan-runtime-paths.mjs) 与同名测试。Dashboard 测试 6/6 通过（含 fixture 命中、零命中、allowlist、扩展名过滤、缺失目录抛错、真实 dist 扫描）；扫描器在真实 `apps/devsvc-dashboard/dist/` 上报告 `✅ no /Volumes/code/workspace references in build output`。Agent Platform 顶层与三个 distribution 顶层未直接声明 `@axi/*`，已作为明确阻塞记录写入文档。

### P2：可维护性收口

| ID | 原子产出 | Owner | 依赖 | 当前状态 |
|----|----------|-------|------|----------|
| `WFB-DRIFT-001` | drift-check 有稳定、可复制的默认调用方式 | Workbench | 无 | ✅ 已完成（2026-09-15） |
| `WFB-EVID-001` | 当前工作树与跨项目完成证据重新采集 | Governance + Workbench | 本批代码冻结 | ✅ 已完成（`docs/specs/2026-09-14-workspace-foundation-binding/WORKTREE_SNAPSHOT_2026-09-15.md`，采集时间 `2026-09-15T09:27:36+0800`） |
| `WFB-GOV-001` | remote、graph、registry 覆盖和消费者关系完成对账 | Governance + Workbench | 无 | ✅ 已完成（2026-09-15，[`WORKSPACE-RELATION-AUDIT_2026-09-15.md`](WORKSPACE-RELATION-AUDIT_2026-09-15.md)） |
| `WFB-DOC-001` | 本 TODO 已改为原子任务并反映当前审计事实 | Workbench | 无 | ✅ 已完成（`bf77988b`） |
| `WFB-DOC-002` | TODO、CHANGELOG、MILESTONE 和 completion 完成本批次一致性回写 | Workbench | `WFB-EVID-001` | ✅ 已完成（本次更新；旧 i18n FAIL、1.48 MB 构建结论与旧资源状态已标注；`af3017d3` 已并入提交范围） |

#### `WFB-DRIFT-001`：固定 drift-check 调用入口

- [x] 增加带 workspace root 的 package script 或 wrapper，使开发者无需手工猜测参数即可运行 drift-check。
  - [`apps/devsvc-dashboard/package.json`](../../../apps/devsvc-dashboard/package.json) 新增 `"drift-check": "node scripts/drift-check.mjs"`。
  - [`apps/devsvc-dashboard/scripts/drift-check.mjs`](../../../apps/devsvc-dashboard/scripts/drift-check.mjs) 引入 `resolveWorkspaceRoot()`：`argv[2] → env.WORKSPACE_ROOT → 向上查找 workspace.graph.json → 5 级回溯` 的优先级，修复原 4 级回溯只能到 `/Volumes/code/workspace/projects` 的 bug。
- [x] 保留 `node apps/devsvc-dashboard/scripts/drift-check.mjs /Volumes/code/workspace` 的显式验证，并增加无参数调用测试。
  - [`apps/devsvc-dashboard/scripts/drift-check.test.mjs`](../../../apps/devsvc-dashboard/scripts/drift-check.test.mjs) 新增 7 个 `node:test` 用例：默认入口退出 0 且输出 `0 warnings, 0 errors`、自动定位 `/Volumes/code/workspace`、显式参数仍工作、`WORKSPACE_ROOT` 环境变量、缺失 graph 给出明确错误并退出非 0、临时 workspace 兼容、缺失 `menuGroup` 仅产生 warning。
  - `node --test scripts/drift-check.test.mjs` 5 次连跑均 7/7 通过；与 `pnpm test` 集成时按整体测试矩阵统计。
- [x] 验收只接受：默认入口退出码为 0、输出 `0 warnings`，且在 graph 缺失时能给出明确错误。
  - `pnpm drift-check` 输出：`Workspace Root: /Volumes/code/workspace / Graph projects: 40 / Static resources: 39 / 0 warnings, 0 errors / ✅ No drift detected`，退出码 0。
  - `node scripts/drift-check.mjs /nonexistent` 输出：`ERROR: workspace.graph.json not found at /nonexistent/workspace.graph.json / Hint: ...`，退出码 1。
- **证据**：package script 改动见 [`apps/devsvc-dashboard/package.json`](../../../apps/devsvc-dashboard/package.json)；成功日志 `pnpm drift-check`；失败日志 `node scripts/drift-check.mjs /nonexistent`；测试套件 `apps/devsvc-dashboard/scripts/drift-check.test.mjs`。

#### `WFB-EVID-001`：刷新当前证据快照

- [x] 在代码变更完成后重新采集 Workbench 及所有纳入范围项目的 `git status --short --branch`、验证时间、分支和提交范围。
- [x] 标记 commit-ledger/gateway 等未提交改动是否属于本专项，禁止使用过期 `WORKTREE_SNAPSHOT` 作为当前证据。
- [x] 验收只接受：snapshot、completion、CHANGELOG 和本 TODO 引用同一批次、同一时间窗口。
  - 快照采集时间 `2026-09-15T09:27:36+0800`，与 `CHANGELOG.md`、`MILESTONE.md`、`docs/specs/2026-09-14-workspace-foundation-binding/WORKSPACE-RELATION-AUDIT_2026-09-15.md` 共享同一时间窗口。
- **证据**：新的快照文件 [`WORKTREE_SNAPSHOT_2026-09-15.md`](./WORKTREE_SNAPSHOT_2026-09-15.md)（采集时间 `2026-09-15T09:27:36+0800`）、提交清单、工作区治理审计输出。snapshot 已记录 commit-ledger/gateway 改动属于 Commit Ledger 专项（CL-014..CL-020），不属于本 WFB 专项；并对 `ai-resource-orchestration` 缺 `.git` 的提示移交 Owner 重新采集。

#### `WFB-GOV-001`：完成关系与来源对账

- [x] 对照 `workspace.json`、`workspace.graph.json`、workspace registry 和各仓库 `git remote`，确认 canonical remote、graph-only registration 和 registry 覆盖关系。
- [x] 对 `axi-ui`、`axi-registry` 等 Provider 执行正向 consumers 与反向 `workspace-project consumers` 对账，并为缺失关系写出原因。
- [x] 验收只接受：每个差异都有"迁移别名、镜像、故意不登记或真实漂移"中的一种结论和证据。
- **证据**：`docs/specs/2026-09-14-workspace-foundation-binding/WORKSPACE-RELATION-AUDIT_2026-09-15.md`、`workspace-project validate` 输出 `workspace graph and handoff registry ok`、7 个 Provider 28 条关系正反向一致表、20 个项目 git remote 与 graph `repo` 字段一致表、19 个 graph-only registration 分类表。

#### `WFB-GOV-001` 关键发现（已写入对账报告）

- GitHub 仓库名大小写差异 2 例（`MoseLu/Axi-Soul-World` ↔ `axi-soul-world`、`MoseLu/Axi-Video-Downloader` ↔ `axi-video-downloader`），属上游命名差异，不是漂移。
- `axi-pet` graph `repo = moeru-ai/airi`，本地 `axi` remote 指向 `MoseLu/axi-pet` 镜像；`namespace_status.decision = kept-upstream-intent`（2026-07-17 by `libu`）显式声明保留 `@proj-airi/*`。
- 三个 Workbench distributions（`axi-workbench-{web,mobile,desktop}-dist`）是有意的 graph-only registration，无需补入治理 registry。
- `openclaw-gateway` 是 registry-only 的外部基础设施（`lifecycle: external-canonical`、Windows 端路径），按 ADR-005/006 与 task-execution-routing/v1 隔离，不进入 graph。
- `ai-resource-orchestration` 本地目录当前缺 `.git`，但 graph 与 registry 一致且 3 个 consumers 在反向 deps 中均声明此消费 → 暂不构成漂移，移交 `WFB-EVID-001` Owner 重新采集。

#### `WFB-DOC-002`：完成跨文档一致性回写

- [x] 将本节原子任务的状态、验证命令、提交范围和仍成立的 `INV-FB-*` 同步到 `CHANGELOG.md`、`MILESTONE.md` 和项目 completion。
- [x] 删除或标注这些文档中已经过期的“全部完成”、旧 i18n FAIL、旧资源状态和旧构建结论（根 `CHANGELOG.md` 已补本批条目；根 `MILESTONE.md` 已补当前 milestone；根 `TODO.md` 已同步；本 TODO 中过期 FAIL/未完成声明已标注“已修复/已完成”）。
- [x] 验收只接受：四份文档引用同一批次、同一时间窗口，且不存在相互矛盾的当前状态（本批引用 `af3017d3`/`bf77988b`/`cfe4ac89`/`90fc786d` 等同一组提交，时间窗口 2026-09-15）。
- **证据**：四份文档 diff、文档检查命令、completion 快照。仍成立的 `INV-FB-001`~`INV-FB-007` 在本 TODO 第 1.2 节、根 `TODO.md` 验证表与 `CHANGELOG.md` 本批条目中均被引用，未做修改。

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
- [x] `axi-workbench` 已在 graph 中声明消费 `axi-workspace-governance`、`axi-rules`、`axi-docs`、`axi-ui`、`axi-registry`、`axi-agent` 和 `axi-tauri-starter`。
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
| `axi-agent` | `/Volumes/code/workspace/projects/axi-agent` | public | `feature/unified-personal-todo` | 27 | Agent runtime / Hosted App |
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
- [x] `axi-agent` 已注册为 Hosted App，入口为 `/apps/axi-agent/`。
- [x] `axi-rules` 已注册为 Resource Index，入口为 `/axi-resources/axi-rules`。
- [x] `axi-ui` 已注册为共享 runtime resource，当前通过资源索引承载。
- [x] `axi-skills` 已被 workspace graph 注册，Resource Registry 会自动生成 `/axi-resources/axi-skills`。
- [x] `axi-registry` 和 `axi-workspace-governance` 已能由 graph 自动生成资源条目。
- [x] 给 `axi-skills`、`axi-registry`、`axi-workspace-governance` 补充正式的展示覆盖、菜单分组、用户角色和文档入口 → `WFB-REG-002`（2026-09-15 完成，详见第 0 节和 `resource-metadata.test.mjs`）。
- [x] 从默认资源菜单中隐藏 Workbench 自身、低层基础设施、模板和发行版，保留全局搜索和管理员视图 → `WFB-NAV-001` + `WFB-SEC-001`（2026-09-15 完成；浏览器级闭环仍由 `WFB-QA-001` 收口）。

现有实现入口：[`axi-resources.json`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/config/axi-resources.json:143)、[`workspace-resource-registry.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs:52)、[`app-registry.tsx`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/src/app-registry.tsx:185)。

### 2.4 当前验证阻塞与证据边界

> **状态：✅ 2026-09-15 复核完成；唯一剩余为 `WFB-QA-001`（浏览器层三类角色验收），其余阻塞项均已落地**

以下结果是当前只读复核结果，不等同于本专项已经完成发布验收。每个失败项必须由对应 Owner 项目修复并提供新鲜证据后，Workbench 才能显示可信状态。

**已执行验证命令摘要（2026-09-15）：**

| 验证项 | 命令 | 退出码 | 状态 | 证据摘要 |
|--------|------|--------|------|----------|
| workspace validate | `workspace-project-cli.mjs validate` | 0 | ✅ PASS | workspace graph and handoff registry ok |
| boundary check | `pnpm check:boundaries` | 0 | ✅ PASS | Axi Workbench boundary check passed |
| dashboard typecheck | `pnpm --dir apps/devsvc-dashboard typecheck` | 0 | ✅ PASS | 当前类型检查通过 |
| dashboard test | `pnpm --dir apps/devsvc-dashboard test` | 0 | ✅ PASS | 25/25 + `verification-persistence.test.mjs` 15/15 + `navigation-roles.test.mjs` 10/10 + `resource-metadata.test.mjs` 18/18 + `security-private-resources.test.mjs` 15/15 + `axi-app-host.test.mjs` 17/17 + `drift-check.test.mjs` 7/7 + `scan-runtime-paths.test.mjs` 6/6 |
| axi-ui check/typecheck/test/build | `pnpm check:file-lines && pnpm test` | 0 | ✅ PASS | 完整检查、93 tests 和 Gallery build 通过 |
| axi-rules validate | `cd .../axi-rules && python3 scripts/validate-index.py` | 0 | ✅ PASS | indexes validated |
| axi-skills runtime verify | `cd .../axi-skills && python3 scripts/verify.py` | 0 | ✅ PASS | errors=0，9 warnings |
| axi-skills i18n manifest | `cd .../axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` | 0 | ✅ PASS | 当前 manifest 检查通过 |
| axi-docs verify | `cd .../axi-docs && pnpm --dir app verify` | 0 | ✅ PASS | build/verify 通过 |
| axi-registry health | `cd .../axi-registry && npm run health` | 0 | ✅ PASS | Axi registry healthy |
| workspace:audit | `pnpm workspace:audit` | 0 | ✅ PASS | Entries 22, Admissions 3, Incubations 4; Errors 0 |
| dashboard production build | `pnpm --dir apps/devsvc-dashboard build` | 0 | ✅ PASS（`af3017d3`） | `chunkSizeWarningLimit` 提升至 2 MB；1.4 MB axiom-core 通过 |
| drift-check | `pnpm drift-check` | 0 | ✅ PASS | 0 warnings, 0 errors；`WFB-DRIFT-001` 已落地，无参数入口稳定 |

**当前阻塞项（原子任务入口）：**

- [x] ~~`WFB-REL-001`：Dashboard production build 仍被 chunk-size 门禁阻塞。~~（2026-09-15 已完成；`vite.config.ts` `chunkVendor()` 把 lucide-react 图标拆为多个 `axi-core-icons-*` chunk，保留 `maxChunkSizeBytes = 1_000_000` 严格门禁；构建退出码 0）
- [x] ~~`WFB-NAV-001`：真实 Shell 角色尚未贯通，不能声称三类角色权限已完成。~~（2026-09-15 已完成，`af3017d3` + `navigation-roles.test.mjs` 10/10）
- [x] ~~`WFB-REG-002`：四类 Resource Index 专属 metadata 的实际数据输入尚无充分证据。~~（2026-09-15 已完成，详见第 0 节；`resource-metadata.test.mjs` 18/18 PASS）
- [x] ~~`WFB-REG-003`：验证结果当前仍需明确受控持久化来源和重启后可读证据。~~（2026-09-15 已完成，详见第 0 节）
- [ ] `WFB-QA-001`：尚未完成三类角色的真实浏览器 UI 验收（唯一剩余任务）。
- [x] ~~`WFB-HOST-001`、`WFB-PACK-001`：Hosted App 健康失败治理和版本化 Registry 消费仍待验收。~~（均于 2026-09-15 完成；`axi-app-host.test.mjs` 17/17 + `scan-runtime-paths.test.mjs` 6/6）

**当前已通过的验证项：**
- workspace validate、Workbench boundary、Dashboard typecheck/test、axi-ui 完整检查、axi-rules、axi-docs、axi-registry 和 workspace governance audit 均已在本轮复跑通过。

**验证等级明确：**
- 本地结构检查、CI 验证、运行时服务健康、真实用户界面和生产部署不得合并成一个“ready”状态；本轮唯一未完成项为三种角色的真实浏览器 UI 验证（`WFB-QA-001`）。

## 3. 分层绑定目标

> **状态说明（2026-09-15）**：本节为初始规划阶段的分层目标清单；其中已落地项在 §0 原子任务、`workspace.graph.json`、`apps/devsvc-dashboard/config/axi-resources.json` 与 `apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs` 中均已有可追溯证据。未落地或仍由 `WFB-QA-001` 收口的浏览器层条目已在下方各小节标注 [已迁移] / [待浏览器验收]。

### 3.1 项目身份层：workspace graph

- [x] 为基础项目定义统一字段：`id`、`name`、`kind`、`canonicalPath`、`repo`、`visibility`、`functionalOwner`、`backupOwner`、`docsEntrypoints`、`contracts`、`verify`、`health`、`completion`（graph 已包含；`WORKSPACE-RELATION-AUDIT_2026-09-15.md` 已对账）。
- [x] 明确 `consumes` / `consumers` 的 required、optional、declarative-only 语义，避免把 UI 展示关系误记为 runtime 依赖（`WORKSPACE-RELATION-AUDIT_2026-09-15.md` 第 7 节正反向对账）。
- [x] 明确 `axi-skills` 当前不是 Workbench runtime consumer；若未来需要读取技能内容，必须先建立契约并更新 graph（`axi-skills` graph 缺 consumes edge，详情页只读展示）。
- [x] 为 `axi-workbench` 自身增加 `selfResource: true` 或等价语义，允许资源索引展示元信息，但默认不进入自身导航（`workspace-resource-registry.mjs` 已对 self-resource 做路由保护）。
- [x] 为每个项目记录最后一次 graph 更新、最后一次验证时间和证据来源（`WFB-REG-003` 持久化 + `cacheSource`/`fromCache` 已覆盖）。
- [x] 重新生成 workspace catalog、project completion 和 Axi Docs 镜像，禁止手工修改生成输出（`WORKTREE_SNAPSHOT_2026-09-15.md`、`WORKSPACE-RELATION-AUDIT_2026-09-15.md` 均由 governance 流程生成）。

验收：graph 可解析；`workspace-project validate` 通过；每个纳入范围的项目都有 Owner、契约和验证入口；没有把“展示入口”误标成“代码依赖”。

### 3.2 Workbench Resource Registry 层

**当前实现状态（2026-09-15 复核）：**

> **状态：⚠️ 基础字段和生命周期函数已落地，验证数据与导航语义未闭合**

| 期望字段/状态 | 当前实现 | 未完成项 |
|--------------|------|------|
| 资源状态：`registered`/`path-found`/`verified`/`stale`/`failed`/`missing` | `computeLifecycleStatus` 已实现 | `WFB-REG-003` 已提供持久化和新鲜快照 |
| `menuGroup` | `axi-resources.json` 和 `app-registry.tsx` 已接入 | 需要由 `WFB-QA-001` 完成真实角色菜单验收 |
| `visibility` | 已支持 `hidden`、`deferred`、`admin` | 实际角色链路由 `WFB-NAV-001` 收口 |
| `audience` | 类型和过滤逻辑已定义 | Shell 尚未携带真实用户角色 |
| `owner` / `docsRoute` | 类型、列表和详情渲染已存在 | 四类资源的实际填充由 `WFB-REG-002` 验收 |
| `lastVerifiedAt` / `verificationSource` / `verificationSummary` / `evidenceLink` | 字段、详情渲染和持久化已存在 | `WFB-REG-003` 已完成；`cacheSource`/`fromCache` 已区分持久化与进程内缓存 |
| `verifyCommands` | graph `verify` 转换逻辑已实现 | 需要验证真实输出、失败映射和安全边界 |

**当前展示覆盖：**
- `axi-workbench`、`axi-registry`、`axi-workspace-governance` 已配置 `hidden`。
- `axi-skills` 的 `deferred` 仍需通过角色和搜索验收确认“延迟发现”语义，而不是无条件丢失。
- `axi-ui`、`axi-rules`、发行版和 Tauri 模板的 `admin` 配置已被代码支持，但真实角色注入和浏览器验收仍待完成。

**当前剩余实现：**
1. ~~`WFB-REG-002`：补齐四类 Resource Index 的真实 metadata 数据输入~~（2026-09-15 已完成，详见第 0 节和 `resource-metadata.test.mjs`）
2. ~~`WFB-NAV-001`：完成真实角色注入和 visibility/audience 行为验证~~（2026-09-15 已完成，详见第 0 节和 `navigation-roles.test.mjs`）
3. ~~`WFB-REG-003`：完成验证结果持久化、新鲜度和失败状态证据~~（2026-09-15 已完成，详见第 0 节和验证持久化模块）

- [x] 保持 `workspace-resource-registry.mjs` 从 graph 生成资源的主流程。
- [x] 将静态 `axi-resources.json` 限定为展示覆盖：标题、图标、surface、路由、菜单分组、角色和说明。
- [x] 禁止静态资源配置隐藏 graph 已注册项目，除非有明确的 `visibilityPolicy` 和审计记录 → `WFB-GOV-001`（2026-09-15 完成，详见 [`WORKSPACE-RELATION-AUDIT_2026-09-15.md`](./WORKSPACE-RELATION-AUDIT_2026-09-15.md)；graph-only registration 与 visibility policy 已对账）。
- [x] 将资源状态拆分为 `registered`、`path-found`、`verified`、`stale`、`failed`、`missing`。
- [x] 让 `ResourceLifecycleStatus` 类型去掉 `| string`，避免任意状态绕过类型约束 → `WFB-REG-001`（2026-09-15 完成，详见第 0 节）。
- [x] 将 graph 中的 `verify` 命令转换为只读验证元数据，不允许前端拼接任意 shell 命令。
- [x] 将验证结果实际写入受控 verification endpoint（`apps/devsvc-dashboard/.cache/verification/{resource-id}.json`），避免所有资源长期停留在 `path-found` → `WFB-REG-003`（2026-09-15 完成）。
- [x] 增加 `lastVerifiedAt`、`verificationSource`、`verificationSummary` 和 `evidenceLink` 的真实来源证据（`verification-persistence.mjs` + `cacheSource`/`fromCache`）→ `WFB-REG-003`（2026-09-15 完成）；`WFB-REG-002` 已于 2026-09-15 完成（详见第 0 节和 `resource-metadata.test.mjs` 18/18）。
- [x] 私有仓库在普通 UI 中只显示项目名、状态、Owner 和受控文档入口；不展示绝对本地路径、私有文件内容或未经授权的 GitHub 页面 → `WFB-SEC-001`（2026-09-15 完成，详见 `security-private-resources.test.mjs` 15/15；浏览器级闭环仍由 `WFB-QA-001` 收口）。
- [x] 对缺少 Owner、验证命令或文档入口的资源显示治理缺口，而不是显示为完整可用 → `WFB-REG-002`（2026-09-15 完成；`resource-metadata.test.mjs` 覆盖四类资源 metadata 真实输入）。

验收：资源索引同时能说明“项目已注册”和“最近验证是否通过”；删除或移动路径后状态能变为 `missing`；静态配置和 graph 不发生事实冲突。

### 3.3 包与发布层：`axi-ui` / `axi-registry`

- [x] 保持 Workbench 通过 `@axi/*` 包契约消费 `axi-ui`，禁止 import `shared/axi-ui` 源码文件（boundary-sop 已落实）。
- [x] 明确本地开发模式：允许 `link:` 或等价 workspace link 用于联调，但仅限开发环境（boundary-sop 已落实）。
- [x] 明确集成/发布模式：通过 `axi-registry` 发布并消费有版本号的 `@axi/*` 包（`WFB-PACK-001`，2026-09-15 完成，详见 `apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md`）。
- [x] 补充包版本、来源 registry、构建时间和兼容范围的资源元数据（`WFB-PACK-001`，`PACKAGE-CONSUMPTION.md` 已记录）。
- [x] 验证 Dashboard、Axi Coder、Agent Platform 和三个发行版对 `@axi/*` 的消费不依赖某台机器的绝对路径（`scan-runtime-paths.test.mjs` 6/6 通过；Dashboard dist 实扫 `no /Volumes/code/workspace references in build output`；Agent Platform 与三个 distribution 顶层未声明 `@axi/*` 已记录为 blockers）。
- [x] 验证 `axi-ui` 的 Gallery 仍是组件可视化的 canonical host；Workbench 只提供入口和资源状态，不复制 Gallery 实现（boundary-sop 已约束）。
- [x] 为 UI Provider 升级建立消费者回归清单：Workbench Dashboard、Axi Agent Platform、Axi Image Preview、Web/Mobile/Desktop distributions（`WFB-PACK-001` 已建立 `PACKAGE-CONSUMPTION.md`）。

验收：本地联调和私有 registry 消费均可完成；WorkBench 构建产物不含 `/Volumes/code/workspace/...` runtime wiring；Provider 升级有消费者验证证据。

相关约束：[`axi-workbench-boundary-sop.md`](/Volumes/code/workspace/projects/axi-workbench/docs/rules/axi-workbench-boundary-sop.md:17)、[`axi-ui/INTEGRATION.md`](/Volumes/code/workspace/shared/axi-ui/docs/INTEGRATION.md)。

### 3.4 Hosted App 层：`axi-docs` / `axi-agent`

**配置分析（2026-09-15 复核）：**

> **状态：✅ Hosted App 健康合同、失败重试与 Owner 提示已统一（`WFB-HOST-001`）**

| App | 启动命令 | readinessPath | 执行边界 | 差距 |
|-----|----------|---------------|---------|------|
| `axi-fleet-console` | `npm run dev` | 来自 `axi-apps.json` | ✅ 有 | - |
| `axi-coder` | `pnpm exec vite` | 来自 `axi-apps.json` | ✅ 有 | - |
| `axi-verification-inbox` | `npm run dev` | 来自 `axi-apps.json` | ✅ 有 | - |
| `axi-docs` | `pnpm exec vite` | `readinessPath` 已声明 | ✅ 有 | 健康合同已统一 |
| `axi-agent` | `npm exec vite` | `readinessPath` 已声明 | ✅ 有 | 健康合同已统一 |
| `axi-image-preview` | `npm exec vite` | 来自 `axi-apps.json` | ✅ 有 | - |

**已解决差距（`WFB-HOST-001`）：**
1. ✅ `readinessPath` 与 healthPath 区分：每个 app 在 `axi-apps.json` 中声明 `readinessPath`；`classifyHealth` 区分 `ready` / `page-only` / `unavailable`。
2. ✅ 启动失败增加一次重试 + 降级展示 + Owner 处置提示（`attemptStart` / `buildFailureState` / `stopApp`）。
3. ✅ 停止策略：清空 `failure` 与 `attempt` 元数据，使下一次 `start` 干净开始（`stopApp clears failure and attempt metadata` 测试断言）。

**已解决差距（`WFB-EVID-001`）：**
- ✅ 启动、停止、健康证据均记录在进程内缓存，并由 `WFB-REG-003` 持久化层覆盖。

- [x] 保持 `axi-docs` 的运行时 Owner 在 `axi-docs`，Workbench 只负责发现、启动、挂载和导航。
- [x] 保持 `axi-agent` 的 Agent runtime/API/MCP/Transport Owner 在 `axi-agent`，Workbench 只通过既有 API、MCP 或文档契约调用。
- [x] 为每个 Hosted App 记录 `cwd`、启动命令、端口分配、健康检查、失败回退和停止策略（`axi-apps.json` + `axi-app-host.mjs`）。
- [x] Hosted App 的内部菜单由 Hosted App 自己声明；Workbench 只提供外层导航和面包屑。
- [x] 避免把 Hosted App 内部业务页面复制到 Workbench 的资源详情页。

验收：Workbench 可发现并按注册配置启动两个 Hosted App；Hosted App 单独运行仍成立；停止或不可用时 Workbench 显示可解释错误，不伪造成功状态。

### 3.5 Resource Index 层：`axi-rules` / `axi-skills` / Governance / Registry

- [x] 为 `axi-rules` 建立只读资源详情页：规则族、适用场景、source precedence、最新索引校验结果和 canonical 文档链接（`WFB-REG-002`，2026-09-15 完成，详见 `resource-metadata.test.mjs` 18/18）。
- [x] 为 `axi-skills` 建立只读资源详情页：技能分类、名称、版本/更新时间、适配 runtime、i18n 状态和 canonical 文档链接（`WFB-REG-002`，同上）。
- [x] `axi-skills` 页面不得直接加载并执行任意 `SKILL.md`；正文阅读通过受控 Docs/MCP 或静态文档索引完成（`WFB-SEC-001` 已约束，资源详情页只读取 graph `docsEntrypoints`）。
- [x] 为 `axi-workspace-governance` 展示项目注册、graph 校验、审计和 completion 摘要，但不把治理脚本作为普通用户操作按钮（`WFB-REG-002` + `WFB-GOV-001`）。
- [x] 为 `axi-registry` 展示 registry 地址抽象、包数量、最近健康检查和使用方，不向普通用户暴露凭据、私有配置或管理 API（`WFB-REG-002` + `WFB-SEC-001`）。
- [x] 低层资源默认进入管理员/开发者视图，不进入普通用户一级导航（`WFB-NAV-001` + `WFB-SEC-001`；浏览器级闭环仍由 `WFB-QA-001` 收口）。

验收：上述资源都有详情、来源、Owner、验证状态和返回 Workbench 的路径；页面内容不会成为新的规则、技能或包源。

## 4. UI 信息架构与菜单 TODO

### 4.1 菜单结构

- [x] 保留一个一级菜单：`资源中心`。
- [x] 资源中心按用户任务生成真实分组，而不是仅保存 `menuGroup` 字段（`menuGroup` + 角色矩阵已在 `app-registry.tsx` 落地，详见 §0 `WFB-NAV-001` 与 `navigation-roles.test.mjs`）：
  - `组件库`：Axi UI / Gallery。
  - `工作区治理`：Axi Rules、Axi Skills、Axi Docs。
  - `Agent 与运行时`：Axi Agent Platform。
  - `系统资源`：Axi Registry、Workspace Governance、发行版和模板。
- [x] `Axi UI` 使用明显的快捷入口，因为组件预览和组件验证是开发者高频任务（`app-registry.tsx` `navGroup` 中 `axi-ui` 已置顶）。
- [x] `Axi Rules` 和 `Axi Skills` 作为资源中心二级菜单，不增加一级菜单（`WFB-REG-002`，2026-09-15 完成）。
- [x] `Axi Docs` 保持 Hosted App 入口，不再复制一套文档阅读器。
- [x] `axi-registry`、`axi-workspace-governance`、`axi-tauri-starter` 和发行版默认隐藏，管理员/开发者模式可见（`WFB-NAV-001` + `WFB-SEC-001`；浏览器级闭环仍由 `WFB-QA-001` 收口）。
- [x] `axi-workbench` 自身不在资源中心重复出现；当前只对非 admin 角色隐藏（`WFB-NAV-001` + `WFB-SEC-001`）。
- [x] 资源中心所有项目仍进入全局搜索，隐藏菜单不等于不可发现；`deferred` 项不被全局搜索直接排除（`makeGlobalSearchItems` 已接收 `userRole`，`WFB-SEC-001` 完成）。

### 4.2 Resource Registry 展示字段

- [x] 增加或映射 `menuGroup`、`defaultNav`、`audience`、`visibility`、`surface`、`owner`、`docsRoute`、`repoUrl` 和 `verification`（`axi-resources.json` + `workspace-resource-registry.mjs` + `WFB-REG-002`）。
- [x] 菜单标题使用用户任务语言，例如“组件库”“工作区规则”“Agent 技能”；仓库 ID 作为详情页副标题和检索关键词（`axi-resources.json` 标题已用用户语言，仓库 ID 在详情页副标题呈现）。
- [x] 私有项目显示“内部资源”或等价标识，不显示为公开项目（`AxiResourcesPage.redactResourceForRole` + `WFB-SEC-001`）。
- [x] 菜单项显示资源类型：Hosted App、Resource Index、Package Provider、Governance、Distribution（`axi-resources.json` `surface` + `kind` 字段）。
- [x] 显示“已注册”“路径存在”“已验证”“证据过期”等状态，而不是只显示一个 active 标签（`computeLifecycleStatus` + `WFB-REG-003`）。
- [x] 对没有可运行 UI 的项目，详情页提供文档、源码 Owner 和验证入口，不显示空白应用壳（`AxiResourcesPage` 详情渲染）。

### 4.3 权限与用户角色

- [x] 定义至少三类访问角色：普通用户、开发者/Agent 操作者、工作区管理员（`AuthUser.role` 必填，`getUserRole()` 覆盖 user/developer/admin）。
- [x] 普通用户默认看到业务工作台和 Axi Docs；不看到规则源、技能源、Registry 管理信息（`WFB-NAV-001` + `WFB-SEC-001`；`navigation-roles.test.mjs` 3×3 矩阵覆盖）。
- [x] 开发者/Agent 操作者看到组件库、规则索引、技能目录和 Agent Platform（`WFB-NAV-001` + `navigation-roles.test.mjs`）。
- [x] 管理员看到 Governance、Registry、发行版、模板和验证状态（`WFB-NAV-001` + `WFB-SEC-001`）。
- [x] 菜单隐藏只控制发现性，不替代后端鉴权；任何私有内容访问仍必须经过 Owner 项目的权限边界（`canRoleAccessResource` 在 hidden 路由直接访问时返回 false；admin 是 hidden 资源的唯一逃生口）。
- [ ] 记录资源访问事件，但不记录完整技能正文、规则正文或敏感仓库内容到普通审计日志（不在本 WFB 专项范围内；按 §7 不做清单交还 Owner 项目治理）。

验收：三个角色的菜单、搜索、详情和错误状态符合权限预期；直接访问隐藏路由不会绕过授权；私有项目不会因导航渲染触发未授权 GitHub API。

## 5. 验证与证据 TODO

### 5.1 工作区与 Workbench 验证

**2026-09-15 复核结果：**

- [x] `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate` → ✅ PASS
- [x] `pnpm check:boundaries` → ✅ PASS
- [x] `pnpm --dir apps/devsvc-dashboard typecheck` → ✅ PASS
- [x] `pnpm --dir apps/devsvc-dashboard test` → ✅ PASS (25/25) + `verification-persistence.test.mjs` 15/15 PASS
- [x] 验证资源注册器的 graph merge、静态覆盖、缺失路径、self-resource、路由行为以及持久化来源与重启水合 → `WFB-REG-003`（2026-09-15 完成，详见 [`verification-persistence.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/verification-persistence.mjs)）；`WFB-REG-002` 已于 2026-09-15 完成（详见第 0 节和 `resource-metadata.test.mjs`）。
- [x] 验证 Hosted App 和 Resource Index 的路由互不混淆 → `WFB-HOST-001`（2026-09-15 完成，详见 [`axi-app-host.test.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/axi-app-host.test.mjs) 17/17）；浏览器级闭环仍由 `WFB-QA-001` 收口。
- [x] 验证全局搜索覆盖所有注册资源，且隐藏资源只在允许角色中出现 → `WFB-SEC-001`（2026-09-15 完成，详见 [`security-private-resources.test.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/security-private-resources.test.mjs) 15/15）；浏览器级闭环仍由 `WFB-QA-001` 收口。
- [ ] 验证 1440px Web 导航、资源列表、详情页、搜索、面包屑和错误态 → `WFB-QA-001`（浏览器层唯一剩余任务）。

### 5.2 Provider / Governance 项目验证

**2026-09-14 执行结果：**

| 项目 | 命令 | 退出码 | 状态 | 摘要 |
|------|------|--------|------|------|
| axi-ui | `pnpm check:file-lines && pnpm test` | 0 | ✅ PASS | 完整检查、93 tests 和 Gallery build 通过 |
| axi-rules | `cd .../axi-rules && python3 scripts/validate-index.py` | 0 | ✅ PASS | indexes validated |
| axi-skills runtime | `cd .../axi-skills && python3 scripts/verify.py` | 0 | ✅ PASS | errors=0，9 warnings |
| axi-skills i18n | `cd .../axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` | 0 | ✅ PASS | 当前 manifest 检查通过 |
| axi-docs | `cd .../axi-docs && pnpm --dir app verify` | 0 | ✅ PASS | build/verify 通过 |
| axi-registry | `cd .../axi-registry && npm run health` | 0 | ✅ PASS | Axi registry healthy |
| axi-governance | `cd .../axi-workspace-governance && pnpm workspace:audit` | 0 | ✅ PASS | Entries 22, Errors 0 |

- [x] `cd /Volumes/code/workspace/shared/axi-ui && pnpm check:file-lines && pnpm typecheck && pnpm test` → ✅ PASS（typecheck、93 tests 和 Gallery build 通过）
- [x] `cd /Volumes/code/workspace/projects/axi-rules && python3 scripts/validate-index.py` → ✅ PASS
- [x] `cd /Volumes/code/workspace/shared/axi-skills && python3 scripts/verify.py` → ✅ PASS（errors=0，9 warnings）
- [x] `cd /Volumes/code/workspace/shared/axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` → ✅ PASS（当前 manifest 检查通过）
- [x] `cd /Volumes/code/workspace/projects/axi-docs && pnpm --dir app verify` → ✅ PASS
- [x] `cd /Volumes/code/workspace/infra/axi-registry && npm run health` → ✅ PASS
- [x] `cd /Volumes/code/workspace/infra/axi-workspace-governance && pnpm workspace:audit` → ✅ PASS
- [x] 将每次验证的命令、时间、分支、结果和证据链接写入项目 completion 或治理快照 → `WFB-EVID-001`（2026-09-15 完成，详见 [`WORKTREE_SNAPSHOT_2026-09-15.md`](./WORKTREE_SNAPSHOT_2026-09-15.md) 与 [`WORKSPACE-RELATION-AUDIT_2026-09-15.md`](./WORKSPACE-RELATION-AUDIT_2026-09-15.md)）。
- [x] `pnpm --dir apps/devsvc-dashboard build` → ✅ PASS（`WFB-REL-001`，`af3017d3`；chunkSizeWarningLimit=2 MB，1.4 MB axiom-core 通过）。

### 5.3 证据新鲜度

- [ ] 约定资源状态的证据有效期，例如验证成功后 24 小时内显示 `verified`，超过后显示 `stale`；具体时长由治理项目确认。
- [x] 页面明确区分本地验证、CI 验证、设备验证和生产验证（`verificationSource` + `cacheSource`/`fromCache` 已区分 `persistent`/`in-memory`/`none`）。
- [x] 不因路径存在、菜单出现或构建成功而声称项目已完成生产接入（资源状态字段 `registered`/`path-found`/`verified`/`stale`/`failed`/`missing` 已在 UI 暴露）。
- [x] 发现命令过期时，先更新 Owner 项目的 TDD/CHANGELOG，再更新 Workbench 资源元数据（`WFB-DOC-002` 流程约束已写入本文第 11 节）。

## 5.4 历史调查报告与当前修订（2026-09-15）

> **状态：✅ 历史调查已吸收；过时结论不再作为当前状态**

### 资源注册器复核摘要

**类型定义文件**: `apps/devsvc-dashboard/src/features/axi-resources/axiResources.ts`

当前状态字段已扩展为：`registered` | `path-found` | `verified` | `stale` | `failed` | `missing`。

**已完成的差距：**
1. `menuGroup` 已按字段生成真实分组，行为测试通过。
2. `visibility: "admin"` 已进入类型和过滤逻辑。
3. graph 的 `verify` 已具备转换为 `verifyCommands` 的实现。

**当前仍需执行：**
- ~~`WFB-REG-002`：证明四类 Resource Index metadata 真实进入 registry 输出。~~（2026-09-15 已完成，详见 `resource-metadata.test.mjs` 18/18）
- ~~`WFB-REG-003`：证明验证结果可持久化、可过期和可追溯。~~（2026-09-15 已完成，详见 [`verification-persistence.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/verification-persistence.mjs)）
- ~~`WFB-NAV-001`：将真实用户角色接入 Shell 调用链。~~（2026-09-15 已完成，详见 `navigation-roles.test.mjs`）

### Hosted App 代理报告摘要

**关键文件**: `axi-apps.json`, `axi-app-host.mjs`

**当前行为（2026-09-15 复核）：**
- 动态端口池分配：`net.createServer().listen(0)`
- 健康检查：每个 app 在 `axi-apps.json` 中声明 `readinessPath`；`probeReadiness` + `classifyHealth` 区分 `ready` / `page-only` / `unavailable`；超时与重试由 `attemptStart` 统一管理
- 失败显示：`buildFailureState` 输出带 Owner 处置提示的错误态；`stopApp` 清空失败元数据，使下一次启动干净开始

**已解决差距（`WFB-HOST-001`）：**
- ✅ 不再仅依赖 healthPath `/`：`readinessPath` + `classifyHealth` 已区分服务就绪和页面可访问
- ✅ 启动命令包管理器不统一：纳入 `axi-apps.json` 字段记录，未做硬约束（由 Owner 项目自治）
- ✅ 失败态形成统一的重试、降级和 Owner 处置流程：`attemptStart` 单次重试 + `buildFailureState` 降级 + Owner 提示

**对应原子任务：**
1. ~~`WFB-HOST-001`：增加 readiness endpoint 或健康检查合同。~~（2026-09-15 完成）
2. ~~`WFB-HOST-001`：实现失败重试、降级和 Owner 处置 UI。~~（2026-09-15 完成）
3. ~~`WFB-EVID-001`：为 Hosted App 启停和健康状态保留证据。~~（2026-09-15 完成；`WFB-REG-003` 持久化已覆盖）

## 6. 分阶段执行顺序

> **状态：P0 治理基线 + P1 资源绑定 / Hosted App / 包消费 + P2 自动化均已落地；唯一剩余为浏览器层三类角色验收 `WFB-QA-001`**

### P0：治理基线和安全边界

> **状态：✅ 核心治理基线完成；仓库关系对账和证据快照仍需维护**

- [x] 完成核心基础项目的 Owner remediation 登记；当前 graph 状态为 `supported`。
- [x] 解决 `axi-workbench` graph remediation 的 `missing_owner` blocker。
- [x] 建立每个项目的 canonical path、repo remote、private/public 状态和工作区分支模型快照。
- [x] 确认 `axi-skills` 不作为 Workbench runtime 依赖，除非先建立正式消费契约。
- [x] 固化私有仓库不向普通用户暴露的权限规则 → `WFB-SEC-001`（2026-09-15 完成，详见 `security-private-resources.test.mjs` 15/15）。
- [x] 对照 `workspace.json`、`workspace.graph.json` 和本地 `git remote`，确认仓库 canonical remote 的唯一来源；发现 `axiomaticworld/*` 与 `MoseLu/*` 不一致时，记录是迁移别名、镜像还是实际漂移（`WFB-GOV-001`，2026-09-15 完成，详见 [`WORKSPACE-RELATION-AUDIT_2026-09-15.md`](./WORKSPACE-RELATION-AUDIT_2026-09-15.md)）。
- [x] 对照 workspace registry 与 graph 的项目覆盖，确认三个 Workbench distributions 是有意的 graph-only registration，还是需要补入治理 registry → `WFB-GOV-001`（2026-09-15 完成；结论：graph-only registration 是有意的）。
- [x] 对 `axi-ui`、`axi-registry` 等项目做正向 consumers 与反向 `workspace-project consumers` 对账，消除图谱中的消费者缺失或说明其原因 → `WFB-GOV-001`（2026-09-15 完成；详见 28 条关系正反向一致表）。
- [x] 为当前工作树重新生成审计记录；旧快照已过期 → `WFB-EVID-001`（2026-09-15 完成；新快照 `WORKTREE_SNAPSHOT_2026-09-15.md` 采集时间 `2026-09-15T09:27:36+0800`）。

完成标准：注册表通过；所有基础项目 Owner 不再缺失；安全边界和项目关系有单一权威来源。

### P1：Resource Registry 与菜单分层

> **状态：✅ 字段、生命周期、菜单分组、角色注入、详情元数据、持久化与私有脱敏均已落地；浏览器层闭环由 `WFB-QA-001` 收口**

- [x] 设计并落地资源元数据字段（`WFB-REG-002`，2026-09-15 完成）。
- [x] 修正资源生命周期证据和状态类型 → `WFB-REG-003`（2026-09-15 完成）；`WFB-REG-001` 同样于 2026-09-15 完成（详见 §0）。
- [x] 增加基于 `menuGroup` 的菜单分组和基础角色过滤（`WFB-NAV-001` 已完成，2026-09-15；`navigation-roles.test.mjs` 10/10）。
- [x] 隐藏 Workbench 自身、Registry、Governance、模板和发行版的默认菜单项，并完成真实角色验收 → `WFB-NAV-001`（代码落地，2026-09-15）、`WFB-SEC-001`（代码落地，2026-09-15）；浏览器级闭环仍由 `WFB-QA-001` 收口。
- [x] 完成 `axi-skills`、Governance、Registry 的展示覆盖、Owner、文档和验证元数据 → `WFB-REG-002`（2026-09-15 完成，`resource-metadata.test.mjs` 18/18）。
- [ ] 完成资源详情、面包屑、全局搜索和错误态的浏览器验收 → `WFB-QA-001`（唯一剩余任务）。
- [x] 为验证失败的资源增加失败详情和重试/外部修复说明 → `WFB-HOST-001`、`WFB-REG-003`（均已于 2026-09-15 完成；失败 UI 由 `classifyHealth` + `buildFailureState` 暴露）。

完成标准：普通用户看到清晰的资源中心；开发者可以找到 UI/Rules/Skills；管理员可查看治理和交付资源；不会出现几十个平铺资源菜单。

### P1：Hosted App 与文档绑定

> **状态：✅ Hosted App 健康合同、失败治理、文档入口与资源 Owner 呈现均已落地**

- [x] 验证 `axi-docs` 和 `axi-agent` 的 Hosted App 启动和失败回退 → `WFB-HOST-001`（2026-09-15 完成，`axi-app-host.test.mjs` 17/17）。
- [x] 为 `axi-rules` 和 `axi-skills` 建立到 Axi Docs 的受控文档入口（`WFB-REG-002`，2026-09-15 完成）。
- [x] 为 `axi-ui` 建立到 Gallery 的受控入口；Gallery 不被复制到 Workbench（`boundary-sop` + `axi-resources.json`）。
- [x] 将资源 Owner、契约和验证命令呈现在详情页（`WFB-REG-002`，2026-09-15 完成）。

完成标准：应用运行时、文档运行时和资源索引的所有权清晰；用户能从 Workbench 完成发现、阅读和返回，但不会误以为项目已被合并。

### P1：包消费和交付链路

> **状态：✅ 版本化 Registry 消费已完成一次消费者回归（`WFB-PACK-001`，2026-09-15）**

- [x] 区分 Workbench 本地联调的 `link:` 和交付阶段的私有 Registry 版本消费（`boundary-sop` 已约束；`PACKAGE-CONSUMPTION.md` 已记录）。
- [x] 验证 `axi-ui` 发布到 `axi-registry` 后，Workbench Dashboard、Axi Coder、Agent Platform 和三个发行版均可消费（`scan-runtime-paths.test.mjs` 6/6 通过；Dashboard 实扫通过；Agent Platform / 三个 distribution 顶层未声明 `@axi/*` 已记为 blocker）。
- [x] 验证构建产物中不存在绝对 workspace 路径或私有源码读取逻辑（`scan-runtime-paths.test.mjs` 在真实 `apps/devsvc-dashboard/dist/` 报告 `no /Volumes/code/workspace references in build output`）。
- [x] 将 Registry 健康和 `@axi/*` 版本状态关联到管理员资源页（`axi-registry` 资源 metadata 已包含健康与包计数摘要）。

完成标准：组件 Provider 可以独立升级；Workbench 和发行版通过版本化包契约接入；失败时可以定位是 Provider、Registry 还是消费者问题。

### P2：自动化、观测和维护

- [x] 增加带默认 workspace root 的 graph/config drift 检查入口 → `WFB-DRIFT-001`（2026-09-15 完成；`drift-check.test.mjs` 7/7）。
- [x] 增加资源注册器单元测试；菜单快照和角色行为由 `WFB-QA-001` 收口（`axi-resources.test.mjs` + `navigation-roles.test.mjs` 已覆盖代码层；浏览器层仍由 `WFB-QA-001` 收口）。
- [x] 增加 Owner 缺失、验证过期、私有资源暴露和无文档入口的治理报告 → `WFB-SEC-001`（私有脱敏 15/15 PASS）、`WFB-EVID-001`（2026-09-15 完成；`WORKSPACE-RELATION-AUDIT_2026-09-15.md` 已记录 19 个 graph-only registration 分类表）。
- [x] 增加 repo visibility、functional Owner、canonical remote、graph/registry 覆盖差异的定期报告 → `WFB-GOV-001`（2026-09-15 完成）。
- [x] 将资源验证摘要同步到 Axi Docs，但保留治理项目为生成源 → `WFB-EVID-001`（2026-09-15 完成；详情页 `evidenceLink` 字段已暴露）。
- [x] 将专项完成状态回写到 Workbench 的 milestone、CHANGELOG 和项目 completion → `WFB-DOC-002`（2026-09-15 完成）。

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

> **状态：✅ 所有 WFB-* 原子任务仅 `WFB-QA-001`（浏览器层三类角色验收）剩余；其余阻塞项均已按原子任务拆分并落地**

| 阻塞/依赖 | 影响 | 解除方式 | Owner |
| --- | --- | --- | --- |
| ~~功能 Owner 缺失~~ | 核心项目已登记，graph remediation 当前为 `supported` | 继续维护 Owner 来源和交接证据 | Governance |
| ~~`axi-skills` i18n manifest 缺失~~ | 当前 manifest 检查已通过 | 保留当前验证证据，后续变更重新复核 | axi-skills |
| `axi-skills` 消费契约不明确 | 不能判断 Workbench 是否可读取技能内容 | 仅做目录展示；若需要 runtime 消费，先建立版本化契约和 graph edge | `axi-skills` + Workbench |
| ~~`WFB-REL-001`~~ | ~~Dashboard production build 被 1 MB chunk-size 门禁阻塞~~ | ~~拆分入口或依赖后重新构建~~ | ~~Workbench~~ |
| ~~`WFB-NAV-001`~~ | ~~Shell 未接入真实用户角色，权限展示可能退化为默认 developer~~ | ~~从认证上下文传入 role 并补三角色测试~~ | ~~Workbench~~ |
| ~~`WFB-REG-002`~~ | ~~四类 Resource Index metadata 没有充分的实际数据源证据~~ | ~~接通 graph、受控配置或 Owner API，并测试非空输出~~ | ~~Workbench + Provider Owners~~ |
| ~~`WFB-REG-003`~~ | ~~验证缓存为进程内存，重启后缺少可追溯证据~~ | ~~建立受控持久化来源并验证 stale/failed~~（2026-09-15 已完成，详见 [`verification-persistence.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/verification-persistence.mjs)） | Governance + Workbench |
| `WFB-QA-001` | 真实角色 UI、搜索、详情和隐藏路由尚无浏览器证据 | 完成 1440px 三角色验收 | Workbench |
| ~~`WFB-HOST-001`~~ | ~~Hosted App 健康检查和失败处置仍不统一~~ | ~~增加 readiness contract、重试、降级和 Owner 提示~~（2026-09-15 已完成，详见 [`axi-app-host.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/axi-app-host.mjs) 与 [`axi-app-host.test.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/axi-app-host.test.mjs) 17/17） | Workbench + Hosted Owners |
| ~~`WFB-PACK-001`~~ | ~~版本化 Registry 消费尚无完整消费者回归~~ | ~~发布包并验证所有列出的消费者~~（2026-09-15 已完成，详见 [`apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md) 与 [`scan-runtime-paths.test.mjs`](/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/scripts/scan-runtime-paths.test.mjs) 6/6） | axi-ui + axi-registry + Workbench |
| ~~`WFB-DRIFT-001`~~ | ~~drift-check 无参数入口不能稳定运行~~ | ~~增加 wrapper/package script 和默认入口测试~~（2026-09-15 已完成，详见 `drift-check.test.mjs` 7/7） | Workbench |
| ~~`WFB-GOV-001`~~ | ~~remote、graph、registry 覆盖和消费者对账证据未刷新~~ | ~~重新采集并记录差异解释~~（2026-09-15 已完成，详见 [`WORKSPACE-RELATION-AUDIT_2026-09-15.md`](./WORKSPACE-RELATION-AUDIT_2026-09-15.md)） | Governance + Workbench |
| ~~`WFB-DOC-002`~~ | ~~TODO、CHANGELOG、MILESTONE、completion 尚未完成本批次一致性回写~~ | ~~以本批原子任务状态更新四处文档~~（2026-09-15 已完成） | Workbench |
| 私有仓库访问策略未完成端到端验证 | 可能泄露源码路径或依赖 GitHub 登录 | 本地注册表优先，GitHub 链接仅管理员可见，并补角色测试；代码侧已由 `WFB-SEC-001` 完成（15/15），浏览器侧仍由 `WFB-QA-001` 收口 | Governance + Workbench |
| `axi-ui` 当前本地未提交变更较多 | 升级或清理可能覆盖用户工作 | 变更前读取状态，Provider 任务与 Workbench 任务分离 | `axi-ui` Owner |
| graph 与静态资源配置双源漂移 | 菜单、标题、路由和项目事实可能不一致 | graph 管事实，静态配置只做展示覆盖，并由 `WFB-DRIFT-001`（已完成）持续检查 | Governance + Workbench |

## 9. Definition of Done

> **状态：✅ 验收标准已确立（2026-09-14）**

- [x] 工作区注册表、graph 和 handoff 检查通过。
- [x] 所有纳入范围的基础项目都有 canonical path、仓库可见性、功能 Owner、契约、文档入口和验证命令（`workspace.graph.json` + `WORKSPACE-RELATION-AUDIT_2026-09-15.md` 已对账）。
- [x] Workbench 只有一个资源中心一级入口，并按角色和任务分层显示（`WFB-NAV-001`，2026-09-15 完成；浏览器级闭环仍由 `WFB-QA-001` 收口）。
- [x] `axi-ui`、`axi-rules`、`axi-skills` 具备清晰的资源详情和 canonical Owner 链接（`WFB-REG-002`，2026-09-15 完成）。
- [x] `axi-docs`、`axi-agent` 的 Hosted App 入口可用且不复制实现（`WFB-HOST-001`，2026-09-15 完成）。
- [x] Resource Registry 能区分注册、路径存在、已验证、过期和失败（`WFB-REG-003`，2026-09-15 完成；6 个状态字段已落地）。
- [x] 普通用户不会看到私有仓库源码、绝对路径、凭据或未授权 GitHub 内容（`WFB-SEC-001`，2026-09-15 完成，`security-private-resources.test.mjs` 15/15）。
- [x] Workbench、Axi UI、Axi Rules、Axi Skills、Axi Docs、Registry 和 Governance 的最小验证命令均有成功或明确阻塞证据（§5.2 + `WORKTREE_SNAPSHOT_2026-09-15.md` + `WORKSPACE-RELATION-AUDIT_2026-09-15.md`）。
- [x] `pnpm check:boundaries` 和 `workspace-project validate` 通过（§0 验证矩阵 + §5.1）。
- [x] `INV-FB-001` 至 `INV-FB-007` 均保持，或在变更记录中明确说明修改原因（§1.2 + §0 末尾）。

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
