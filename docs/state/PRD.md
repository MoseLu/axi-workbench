# Axi Workbench PRD

## Problem

`Axi Workbench` 是 AxiomaticWorld（公理世界）产品线的本地工作站控制面，也是 Axi 工作台大项目的权威 owner。它由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成，承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。远端仓库名称与少量 `EPAP_*`/`@epap/*` 兼容入口在迁移验证完成前保留。

工作台必须以单一可验证的产品形态向用户、Agent 和下游项目交付：

- 两个独立的用户工作台应用：Web 管理端 `apps/workbench` 与移动端 `apps/workbench-mobile`。
- 本地运维 Host（`apps/devsvc-dashboard`，运维壳而非第二门户）。
- 六层控制面（IM / Communication / Software / Base Service / Physical Service / External Capability）。
- 共享合同包（`@axi/workstation-control-plane`、`@axi/workstation-communication-gateway`、`@axi/workstation-contracts` 等）。
- 工作台手册化的端到端验证与反向链接体系。

## Users

- **维护者**：在 `/Volumes/code/workspace/projects/axi-workbench` 内直接修改源代码、合同或文档的工程师。
- **Agent**：首次进入仓库的 Codex / Cursor / 自动化扫描器 / 编排器，需要稳定的 read order、ownership、跨项目边界与验证命令。
- **下游项目 / Dashboard Apps**：通过 `@axi/workstation-*` 合同、`IMEnvelope` / `AgentTask` 协议、共享类型与 DevSvc Dashboard 接入 Axi Workbench 的能力。
- **远程协作方（远端 agent、AI 平台、外部设备）**：通过 IM 层和 External Capability 层的合同接口访问工作台。
- **本机运维**：通过 DevSvc Dashboard 管理本地服务、健康检查与桌面 host 挂载。

## Goals

1. 把六层控制面落地为可运行的代码、合同与文档，并在两个端上可被验证：Web 管理端使用 Axi Dashboard Chrome，移动端使用独立的微信式应用壳。
2. 让 Web 与移动端保持独立的入口、路由、页面组合与布局实现；只通过明确的基础包和 API 合同共享能力。
3. 让 root AGENTS、PRD、TDD、TODO、Milestone、INDEX、CHANGELOG、README（含 zh-CN）始终互链且反映实现现状。
4. 让 `pnpm check:boundaries` 与 `scripts/check-workbench-boundaries.mjs` 真正阻断跨项目硬耦合（import 邻居实现、绕过合同、绕过控制面）。
5. 让 zero-context agent 30 秒内决定「读哪个 AGENTS、跑哪条验证、申请哪个合同」。

## Non-Goals

- 不替代实现源码；本仓库不创造第二份业务代码。
- 不在本仓库内 vendoring 其他 Axi 项目（`axi-notify`、`axi-pet`、`axi-agent-platform`、`axi-docs`、`axi-image-preview`、`shared/axi-ui` 等）的实现树，只能消费合同。
- 不把 hook 当成 Axi Workbench 的运行时旁路；hook 仅用于工程治理与本仓库 docs/HANDOFF 同步。
- 不保留第三个重复用户门户；`apps/web-portal` 已归档，但 `apps/workbench` 与 `apps/workbench-mobile` 是一对正式、多端但独立的产品应用。
- 不为生成 AGENTS / PRD / TDD 终止会话或覆盖用户原话。
- 不在 docs 中宣扬「下一阶段才会实现」的能力作为现状承诺。

## Requirements

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| REQ-DOC-001 | Maintain the full root documentation suite. | `README.md`、`README.zh-CN.md`、`AGENTS.md`、`CHANGE.md`、`docs/state/CHANGELOG.md`、`docs/state/TODO.md`、`docs/state/MILESTONE.md`、`docs/state/PRD.md`、`docs/state/TDD.md`、`docs/state/VERIFICATION.md`、`INDEX.md`、`docs/project-docs.manifest.json` 全部存在且互链。 |
| REQ-DOC-002 | Keep the v2 zero-context manifest current. | `docs/project-docs.manifest.json` 的 `readOrder`、`entrypoints`、`commands`、`environment`、`contracts`、`currentWork`、`verification` 与实现同步；fresh smoke 成功后才标记 `verified`。 |
| REQ-VERIFY-001 | 文档运行验证命令。 | `TDD.md` 列出 workbench / control-plane / dashboard / inbox / fleet-console 的可运行验证命令或精确 blocker；`docs/HANDOFF.md` 给出默认零上下文 90 秒路径。 |
| REQ-VERIFY-002 | 双端 UI 合同可自动验证。 | Web 的 `node apps/workbench/scripts/verify-ui-contracts.mjs` 与移动端的 `pnpm --filter @axi/workbench-mobile verify:contracts` 通过；两个应用各自的严格 TypeScript、测试和生产构建均通过。 |
| REQ-BOUNDARY-001 | Preserve ownership boundaries. | `pnpm check:boundaries` 阻断来自邻居项目实现的 import、阻断绕过六层控制面的 control flow、阻断绕过合同直接走 `services/api-gateway`。`AGENTS.md` 与 `docs/rules/axi-workbench-boundary-sop.md` 描述规则来源。 |
| REQ-BOUNDARY-002 | 服务合同接入。 | 新增/修改服务必须声明「入口层 / 权威事实源 / 允许访问的下游层 / 输出渲染器 / 审计产物 / 验证路径」，否则不应进入软件层。 |
| REQ-CONTROLPLANE-001 | 软件层以 AgentTask 形式承载 Agent 执行。 | `services/control-plane` 暴露 `AgentTask` 协议；IM / 通信层不直读项目目录；外部平台调用走 `AXI_AGENT_PLATFORM_URL` 合同入口。 |
| REQ-COMMUNICATION-001 | 通信层只做 envelope 路由。 | `services/communication-gateway` 仅做 route 绑定、配对、审批、附件引用、幂等、回执、渠道渲染；不读取工作区索引、不查询记忆表、不拥有项目状态。 |
| REQ-WORKBENCH-001 | 双应用入口收敛。 | `apps/workbench` 是 Web 管理端，`apps/workbench-mobile` 是移动端；`apps/web-portal` 保持归档，不能再创建第三个重复门户。 |
| REQ-WORKBENCH-002 | Web / 移动端渲染边界。 | Web 端独占 sidebar / topbar plugins / tabs / breadcrumbs / theme / settings；移动端独占微信式绝对居中 header、搜索/加号菜单、概览/项目/工作区/扫一扫/我的五项底栏、角标与扫码页。两个端不得依赖 viewport 条件在同一 React 路由树内互相渲染。 |
| REQ-MILESTONE-001 | 跟踪交付状态。 | `docs/state/MILESTONE.md` 记录 current status、delivery checkpoints 与 exit criteria；每次 deliver 后产生新 evidence。 |
| REQ-LOG-001 | 记录变更与提交。 | `docs/state/CHANGELOG.md` 记录用户/Operator/Downstream-Agent 可见变更；批量提交对应 `docs/logs/submit/<batch-id>.md`。 |
| REQ-AXI-CODER-001 | Axi Coder 不再写死外部资源路径。 | Axi Coder 的 workspace 项目快照用 `workspace://` 合同引用 + 环境变量解析；移除对 Axi Notify artifact 路径的硬编码。 |
| REQ-MOBILE-001 | 移动端是独立的微信式工作台应用。 | `@axi/workbench-mobile` 以自己的入口、路由、页面和微信式 UI 交付；只共享 `@axi/workbench-foundation` 认证 / locale、API 合同和 Axi design tokens。跨 origin SSO 由 auth-service 合同负责，前端不跨 origin 读取 localStorage。 |

## Success Metrics

- 必需文档全部存在且 cross-link 完整，`REQg -DOC-001` 单元测试 100% 通过。
- Web 1440px 与移动应用 390px 浏览器 smoke 均无运行时报错，仅可接受 React Router v7 future-flag warnings。
- Web 与移动端各自的 `type-check` / `test` / `build` 和 UI 合同校验均通过；移动端的导航边界有独立单元测试。
- `pnpm test:workstation`（control-plane + communication-gateway + workstation-contracts）通过；`pnpm --filter @axi/workstation-control-plane smoke` 输出 ≥ 35 资源、六层快照完整。
- `pnpm check:boundaries` 退出码 0；任意新增跨项目 import 都会立即被拦截。
- Verifier / QA agent 进入项目后能在 90 秒内确认入口 + 跑出第一条最小验证。
- 跨项目接入：`workspace-project consumers axi-workbench` 报告下游消费者无 breaking 改动。

## Out-of-Scope (current milestone)

- 不在本 PRD 内承诺「迁移所有 `@epap/*` 出口」（保留到 `epap-schemas-compat`）。
- 不在本 PRD 内承诺 A2A / MCP 远端桥接的统一租户。
- 不在本 PRD 内承诺把 `axi-pet` / `axi-notify` 的渲染迁入工作台 chrome。
- 不在本 PRD 内把 `references/*` 翻译进 docs（治理仓库负责）。
