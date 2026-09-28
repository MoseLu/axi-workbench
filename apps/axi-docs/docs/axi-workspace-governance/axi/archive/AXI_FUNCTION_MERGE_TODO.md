# Axi 功能合并 TODO

生成时间：2026-05-25  
范围：`/Volumes/code/workspace`

2026-05-27 更新：Axi-owned active roots have been physically consolidated into
three monorepos: `workbench/axi-workbench`, `agent-cluster/axi-agent`, and
`foundation/axi-notify`. Historical repo ids below remain as source-provenance
labels unless a row explicitly names a current canonical path.

## 原则

- 归档只表示不再作为 active 项目入口，不表示功能价值被放弃。
- 即使两个项目功能重复，也不能只删除其中一个；必须先判断重复功能的 owner，并把仍有价值的实现、交互、配置、数据模型或经验合并到对应 Axi 产品线。
- 已归档目录作为可恢复证据保留；后续合并时必须从 archive 中读取源码和 manifest，而不是凭记忆重写。
- 活跃项目之间如果功能重叠，先定义共享合同，再迁移代码；不要用“合仓”代替产品边界设计。

## 工作站整合强约束

- “功能相似但各自保留”不是终态。同一产品线必须落到统一 Axi owner，必要时采用 monorepo 中的独立 `apps/`、`services/`、`packages/` 保持部署和安全边界。
- 合同是迁移手段，不是停在多个重复项目之间的最终交付。只有有明确业务闭环的垂直产品，才能作为独立产品接入工作站控制面。
- 原 `enterprise-project-automation-platform` 中已有的六层控制面、Communication Gateway、Control Plane 与 `AgentTask` contract，已在本地收束到 `axi-workstation` 作为 **Axi Workstation / Axi Control Plane** 核心 owner；其原有 Automation 定位降为控制面内部能力域。
- 拼图完成标准改为跨层闭环：用户入口 -> 通信/网关 -> Control Plane -> Agent/Docs/Ops/Assets -> Audit/Artifact -> 通知或原入口回传。

## 本轮执行范围

- 当前执行窗口：`P0 + 明确 P1`。
- 命名规则：所有 Axi 体系正式应用名必须以 `Axi` 开头；历史 repo id/path 只在 archive 证据中保留。
- Dashboard 收归规则：`axi-devsvc-dashboard` 是唯一 Axi Dashboard host；所有可托管 Axi 应用登记到 `config/axi-apps.json`，不可托管 owner 登记到 `config/axi-resources.json` 与 `/axi-resources`，并统一显示在「Axi 应用」分组下，不再新建第二个 dashboard shell。
- 本轮锁定：Axi Workstation (`axi-workstation`)、Axi Agent Platform (`axi-agent`)、Axi Agent MCP (`axi-agent-mcp`)、Axi Agent Transport (`axi-agent-transport`)、Axi Accounts Contract（workspace docs，占位合同，不绑定 `cockpit-tools`）、Axi Verification Inbox (`imap`)、Axi Coder (`axi-coder`)、Axi DevSvc Dashboard (`devsvc-dashboard`)、Axi Fleet Console (`fleet-console`)、Axi Docs Search (`app-search-system`)、Axi Notify / Axi Mobile (`mosscoder`)、Axi Todo (`axi-todo`)、Axi UI (`foundation/axi-ui`)、Axi Local Registry (`foundation/axi-registry`)。
- 明确排除：`cockpit-tools` 是外部/reference 项目，不算 Axi 应用或 Axi owner；可作为账号/运行时 UI 经验参考，但不重命名、不承接 Axi Accounts owner。
- 不纳入：`ielts-vocab`、`sports-management-app` 的产品/源码迁移；`tools/axi-video-downloader`、`tools/axi-proxy-companion` 作为 Axi-prefixed local tools 保留；archive 继续保留为证据库，不做物理删除。
- 本轮优先补齐：治理索引、控制面只读资源视图、Axi Agent/Accounts/Model/Ops/Docs/Mobile/Todo 的 owner 边界说明。

## P0 工作站主拼图整合 TODO

| 能力域 | 必须整合的当前资产 | 最终 owner / 形态 | 完成判定 |
| --- | --- | --- | --- |
| Workstation Control Plane | `axi-workstation`（原 `enterprise-project-automation-platform`）、workspace graph、Dev Services | `axi-workstation` / `axi-control-plane` 核心 monorepo | Control Plane 可测试运行；统一读取项目、服务、能力、资源合同并产出 audit/artifact |
| Coder / Development Workbench | `axi-coder`、`agent-desktop` archive 的交互参考、`ollama-menu-assistant` 的本地工具/自动化经验、Axi Agent/Model Gateway/Notify contracts | `axi-coder`，同时包含 Mac desktop 与 mobile companion surfaces | Axi Coder 承载完整开发能力：项目上下文、CLI 编排、AgentTask、终端、artifact review、模型路由；不得被降级为账号台账、provider 目录或运维看板 |
| Agent | `axi-agent`、`axi-agent-mcp`、`axi-agent-transport` | `axi-agent` monorepo 内 runtime/MCP/transport services | Control Plane 以 `AgentTask` 调用 agent 执行并回收可审计结果 |
| Mobile / Notify / Todo | `mosscoder`、`android-workspace-app`、`feiyu-agentflow` | `axi-mobile` app + `axi-notify` service + todo/assistant packages | 移动端真实接收 Control Plane/Agent 事件，donor 业务功能迁完后退出 active |
| Accounts / Assets | Axi Accounts contract docs、`imap`、`local-credentials` metadata；`cockpit-tools` reference only | `axi-accounts` contract placeholder + Axi Verification Inbox + asset/secret-ref contract | 账号、OAuth/OTP、配额、secret ref 先由合同唯一化；`cockpit-tools` 不作为 Axi owner，真实凭据不泄露 |
| Model Gateway | `axi-coder` provider adapter、cc-connect AI capability、Ollama、Sub2API adapter | `axi-model-gateway` contract/runtime，被 Axi Coder / Agent / Workstation 消费 | provider/model/quota/secret ref/routing 有唯一事实源；但 `axi-coder` 的产品边界仍是完整开发工作台，不是 Model Gateway 看板 |
| Ops / Fleet | `devsvc-dashboard`、`fleet-console`、proxy tooling | `axi-ops` console + executors | 一个控制台可查看/调度本地服务、部署目标、服务器与脱敏凭据元数据 |
| Docs / Knowledge | `app-search-system`、EPAP docs/RAG、Axi CLI docs templates | `axi-docs` / knowledge service | SOP、TODO、MILESTONE、PRD、TDD 与检索索引进入统一文档资产 contract |

本轮已完成的 P0 基线：

- `btc-shopflow-monorepo` 已退出 active registry，并以完整 dirty worktree、manifest 与 diff 形式归档为 skeleton reference。
- `axi-workstation` 本地 owner、`@axi/workstation-control-plane`、`@axi/workstation-communication-gateway`、`@axi/workstation-contracts` 已落地；`@epap/schemas` 保留兼容转发。
- workspace graph 已登记八个标准 Axi owner/resource ID；真实 snapshot 已能显示六层资源。
- Axi Mobile relay -> Workstation registered health command -> `AgentTask` -> audit/artifact -> Axi Notify event 的只读 smoke 已通过。
- Axi Agent 首条受管质量门禁链路已接入：Workstation `runtime=axi_agent` -> Axi Agent Platform `/api/v1/workstation/agent-tasks/quality-gate` -> Axi Agent MCP `swarm_validate_with_gates` -> Workstation audit/artifact -> Axi Notify event。
- Axi Agent 第二条安全任务链已接入：Workstation `tool_result_artifact` -> Axi Agent Platform `/api/v1/workstation/agent-tasks/tool-result` -> Axi Agent MCP `swarm_git_status` -> Workstation audit/artifact -> Axi Notify terminal event。
- Axi Mobile / Notify 真机 P0 已通过：`make adb-goal70-e2e` 在设备 `m7lru45xu4mjcq7x` 产出 notification shade、chat/todo/workbench UI dump、截图、logcat、dumpsys artifact。
- Axi Accounts / Model Gateway P0 合同已落地：Axi Accounts contract docs、`imap` OAuth/IMAP/OTP 等价测试、`axi-coder` ProviderProfile/CredentialRef bridge 均有测试；`cockpit-tools` 仅保留为 reference，不算 Axi owner。
- Axi Ops / Docs 只读接入已落地：workspace graph 注册 `axi-ops`/`axi-docs` health/action，DevSvc build、Fleet validate、Axi Docs manifest/search fixture 均通过。
- Axi Dashboard 收归已落地：`axi-devsvc-dashboard/config/axi-apps.json` 统一登记 `axi-fleet-console`、`axi-coder`、`axi-verification-inbox`；`config/axi-resources.json` 登记 Workstation、Agent、Docs、Accounts、Notify、Mobile、Todo、Axi UI/Registry/App CLI 和本地原生工具等不可 iframe 托管资源。
- Axi Coder 产品边界已锁定：新增 ProductSurface contract，声明 `full_development_workbench`，平台包含 `mac_desktop` 与 `mobile_companion`，排除 account ledger / ops dashboard / credential vault 误归类。
- Axi Coder 桌面端 E2E 已通过：ProductSurface/Workspace/ProviderProfile tests `6/6`、typecheck、frontend build、Rust `16/16` tests、Tauri debug `.app/.dmg`、launch smoke、codesign 和 DMG verify 均有证据；详见 `AXI_CODER_E2E_VERIFICATION.md`。

## 合并完成标准

每个功能合并任务完成时至少满足：

1. 明确目标 owner：Axi Workstation / Control Plane、Axi Model Gateway、Axi Accounts / Assets、Axi Local Assistant、Axi Agent、Axi Mobile / Notify、Axi Ops、Axi Docs / Knowledge、Axi UI 或垂直业务线。
2. 写明被合并来源：原路径、归档路径、关键文件、保留/放弃的功能点。
3. 形成可验证交付：代码迁移、接口合同、设计文档、ADR、测试或明确的“不迁移原因”。
4. 更新治理索引：`WORKSPACE_INDEX.md`、`PROJECTS_RECURSIVE_INVENTORY.md`、enterprise `workspace.json` / docs。
5. 不再需要的 archive 只能在合并完成并经过观察期后考虑物理删除。

## P0 已归档但仍需合并评估

| 来源 | 当前状态 | 目标 owner | 必须评估/合并的功能 |
|---|---|---|---|
| `glass-style` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | Axi UI | wallpaper/gallery、filter toolbar、hover/detail、bottom docking、dark glass metrics；已沉淀初版视觉说明，后续需决定是否进入 Axi UI gallery 或 component examples |
| `enterprise-workspace/shared/design-system` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | Axi UI | 对比旧 `Button`、`Topbar`、tokens、theme hooks 与 `foundation/axi-ui`，确认是否有缺失组件或 token 映射需要迁入 |
| `enterprise-workspace/projects/quasar-mobile-app` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | Axi Mobile / Notify | 仅评估 Quasar/Capacitor 模板经验、移动构建配置和插件设置；无业务逻辑可直接迁移 |
| `enterprise-workspace/projects/agent-desktop` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | Axi Agent、Axi Coder、Axi Local Assistant | 复核聊天 UI、工具调用展示、任务/调度页面、MiniMax/Qwen/Anthropic proxy 处理；有价值的交互进入 Axi Local Assistant 或 Axi Agent，provider/proxy 经验进入 Axi Coder 合同 |
| `enterprise-workspace/agent/termagent` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | Axi Agent / Axi Agent Transport tooling | 复核 Windows named-pipe 注册发现、心跳、任务消息协议；如仍有价值，合入 `axi-agent-transport` 或记录为 terminal transport ADR |
| `enterprise-workspace/agent/scripts` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | Axi Agent / Axi Agent Transport tooling | 复核 Cursor `agent` 非交互管道、PowerShell 一键启动、echo 测试；如仍有价值，合入 `axi-agent-transport` 的 Windows launcher/test 文档 |
| `btc-shopflow-monorepo` | 临时归档已删除，见 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | 无 active 产品 owner；未来可选 Vue 微前端 preset reference | 不迁 BTC 业务、品牌或 Vue 包；仅保留 qiankun 装配、Vite factories、workspace/turbo、shared package 与 docs 组织证据，待未来明确选择 Vue 微前端产品时复用 |

## P1 活跃项目之间的功能合并 TODO

| 功能域 | 来源项目 | 目标 owner | 下一步 |
|---|---|---|---|
| Axi Coder full development surface | `axi-coder`、`agent-desktop` archive、`ollama-menu-assistant`、Axi Agent、Axi Notify/Mobile contracts | Axi Coder | 桌面端 E2E 基线已通过；下一步把 mobile companion 从合同/通知回流推进到真实 Axi Coder 移动开发伴随体验：项目上下文、AgentTask、artifact review、通知回流；不要把它收窄成台账/看板 |
| Provider / model routing | `axi-coder` provider adapter、cc-connect AI capability、`sub2api`、Axi Accounts contract docs、`ollama-menu-assistant`、`agent-desktop` archive；`cockpit-tools` reference only | Axi Model Gateway contract + Axi Coder development workbench | 定义并实现唯一 provider/model/quota/secret-ref/routing contract；重复 runtime 必须迁移或移除，但不能削弱 Axi Coder 的完整开发能力 owner 地位 |
| 账号、凭据、配额、实例 | Axi Accounts contract docs、`imap`、`local-credentials` metadata；`cockpit-tools` reference only | Axi Accounts / Assets contract + Axi Verification Inbox | 建立账号/凭据引用/OAuth/OTP/配额/实例生命周期唯一数据模型；`imap` 收码迁为 Accounts 子模块；`cockpit-tools` 不作为 Axi owner |
| 本地 Agent 工具权限 | `ollama-menu-assistant`、`agent-desktop` archive、`axi-agent` | Axi Local Assistant + Axi Agent | 对比工作区边界、shell/write/delete 权限、工具注册和审计；保留安全边界最完整的实现作为 owner |
| Agent runtime / swarm | `axi-agent`、`axi-agent-mcp`、`axi-agent-transport`、`termagent` archive、`agent-scripts` archive | Axi Agent | 在同一产品线 owner/monorepo 中保留 runtime/MCP/transport 分层，由 Axi Control Plane 统一调用 |
| Mobile / Notify | `android-workspace-app`、`mosscoder`、`feiyu-agentflow`、`quasar-mobile-app` archive | Axi Mobile / Notify | 选择移动宿主；把 FCM/relay、todo/agent workflow、移动模板经验变成模块，不再多项目散落 |
| Ops / SOP / display | `devsvc-dashboard`、`fleet-console`、`app-search-system` | Axi Ops + Axi Docs / Knowledge | server/service/device 看板进入 Ops；SOP/PDF/Chroma 与项目 docs 进入 Docs/Knowledge，不保留重复控制台 |
| Vertical sports | `sports-management-app` | Axi Sports / vertical candidate | 先提交或备份未提交 Go/Vue/UniApp 资产，再决定是否继续产品化；不能按模板仓清理 |
| Local utility | `tools/axi-video-downloader` | Axi Tools / local utility | 保留 ADB/mitmproxy/Flask/SQLite 抓取闭环；已删除可重建 `.venv312`，后续若归一只迁移工具索引和启动方式 |

## 已细化的合并设计

| 产品线 | 设计文件 | 当前状态 |
|---|---|---|
| Axi Agent | `/Volumes/code/workspace/docs/axi/AXI_AGENT_MERGE_PLAN.md` | 已完成 runtime、MCP service、terminal transport、archive-derived reference 的 owner 划分；`axi-agent` 已落 worktree guard、runtime API smoke、MCP stdio client、Judge/TaskScheduler quality gate、Workstation quality-gate API 与 `tool-result` API；`axi-workstation` 已能创建 quality-gate 与 read-only tool-result artifact 两类 `AgentTask`；`axi-agent-mcp` `40/40` tests + build 通过；`axi-agent-transport` heartbeat/correlation telemetry contract 已测试。下一步把更多真实执行任务、transport 运行时与长期 artifact 存储纳入同一服务树 |
| Axi Accounts | `/Volumes/code/workspace/docs/axi/AXI_ACCOUNTS_MERGE_PLAN.md`、`/Volumes/code/workspace/docs/axi/AXI_ACCOUNTS_SHARED_SCHEMA.md` | 已完成 Accounts、Verification Inbox、Axi Coder 所消费的 provider credential contract 的 owner 划分和 shared schema 草案；`imap` OAuth/IMAP/OTP 等价测试通过；`cockpit-tools` 修正为 reference，不作为 Axi Accounts owner；下一步把 fixture/test 落到真正 Axi-owned Accounts host 并收缩 standalone `imap` |
| Axi Mobile / Notify | 历史规划证据已移至 `../inventory/ENTERPRISE_WORKSPACE_ARCHIVE_EVALUATION_2026-05-27.md` 与 `../inventory/ARCHIVES_PRUNE_2026-05-27.md` | 已完成 `android-workspace-app`、`mosscoder`、`feiyu-agentflow`、Quasar archive 的真实功能边界复核；`mosscoder` 暂定 Axi Notify canonical owner 和近期移动工作台宿主，已落 Header alias、事件持久化、`GET /v1/events`、设备 targeting、full envelope fixture、Android fetch smoke、Axi deep link parser/manifest/PendingIntent 与 Axi Mobile 命名资产；本轮新增 `make adb-goal70-e2e`，真机验证 workflow/job、agent.message、todo.reminder、notification shade、chat/todo/workbench UI artifact。下一步继续迁 AI Todo/Conversation/Reminder 源码模块与生产 FCM/IM 凭据路径 |

## 下一轮推荐顺序

1. 把已通过的 P0 合同迁成正式 owner 代码：Agent service tree、Accounts verification-inbox、Model Gateway provider registry、Ops dashboard resource view、Docs search service。
2. 把 Axi Coder 作为完整开发工作台推进：Mac desktop 当前 Tauri 面继续承载 CLI/terminal/provider/proxy，mobile companion 通过 Workstation/Notify 合同接入项目、AgentTask、artifact 与通知回流。
3. 将 Axi Mobile / Notify 的本地 relay + ADB 证据推进到生产 FCM/IM 路径，并继续迁 Todo/Assistant 模块。
4. 在 Workstation 中增加统一资产视图：project、server、service、credential_ref、provider、doc/source、agent artifact 需要同一个可查询 snapshot。
5. 处理垂直产品接入，并完成剩余 `@epap/*`、容器名和后端 distribution 名的兼容审查后再收口命名。
