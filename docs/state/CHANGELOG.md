# Changelog

All notable local changes to Axi Workbench are tracked here.

## [Unreleased]

### Changed

- 2026-09-14：新增 `docker-compose.backend.yml` 与 `make docker-backend` 容器化生产形态 API 平面：复用 Identity、Platform、Workflow、Notification、File、Gateway 的业务镜像，五类迁移以一次性任务先行，容器网关映射 `127.0.0.1:18088`；Control Plane 仍保持宿主机 `8092` 独立进程边界。已验证所有迁移退出码 0、业务容器运行中、容器 Gateway `/health` 与 `/ready` 通过；Kubernetes、真实身份/对象存储/邮件和故障演练仍是外部生产门禁。
- 2026-09-14：新增 `make dev-backend` 完整本地后端 profile：按生产服务边界启动 Control Plane、Identity、Platform、Workflow、Notification、File 与 API Gateway，先确保 Compose PostgreSQL/Redis/Mailpit 健康，再执行五类数据库迁移和逐服务 readiness 检查；本地服务继续使用进程运行，生产 Helm/ClusterIP/Secret 边界保持不变。
- 2026-09-14：收敛本地后端运行基线：Workbench Docker Compose 的 PostgreSQL/Redis/Kafka 改用 `15432/16379/19092` 专用端口并仅绑定本机，避免与宿主机其他项目的基础设施冲突；Identity 与 Platform 的开发启动器及迁移入口默认使用持久化 PostgreSQL/Redis，不再因缺少局部 `.env` 配置静默回退到内存状态。已验证 Identity、Platform、API Gateway、Control Plane 的 `/health` 与 `/ready` 全部通过，三项 Go 后端 `go test -race ./...` 全部通过；当前生产 Kubernetes/Helm 与真实 ZITADEL、SMTP、集群故障演练仍保持外部验收边界。
- 新增 append-only audit.jsonl 到 GovernanceWaiver/Violation eventRefs 的回归验证。
- Admin/Project Governance Inspector 展示 Violation/Waiver 的 Evidence 与 Workspace Event 引用，支持合规判断追踪到事实事件。
- Admin Governance Summary 展示 Violation/Waiver 计数与合规问题；Governance Inspector 展示文档 requirement 和 owner。
- Admin Governance Summary 新增 owner coverage 与 partial identity 指标，直接呈现治理身份对账缺口。
- Admin Governance Summary 新增 PolicyDecision 只读表，展示主体、资源、动作、理由、策略版本与事件引用。
- 项目级 Governance Inspector 新增 Violation/Waiver 详情，并按 projectId 过滤治理合规对象。
- 项目级 Governance Inspector 新增 Waiver 明细（状态、owner、原因、到期时间和源 Risk）。
- 项目级 Governance Inspector 新增 PolicyDecision 详情，并按 resourceRef 过滤授权决定。
- 文档投影支持 Graph 的显式 document_requirements（required/default/optional/forbidden），并仅对 required 文档缺失生成 Violation。
- Document Requirement 现在也会对 forbidden 文档实际存在生成 Violation，optional/default 缺失仍不误报。
- Document Requirement 投影现在支持 Registry 声明作为 Graph 缺省时的事实来源，并保留来源优先级。
- Graph 与 Registry 的 Document Requirement 不一致时现在保留结构化 conflict 和 warning，同时按声明优先级解析 Graph 值。
- Document Requirement 支持 freshness interval，文件超出新鲜度窗口时标记 stale 并生成对应 Violation。
- Document freshness interval 支持受限的 s/m/h/d 字符串格式并统一归一化为秒；不支持的格式保持未配置，不做猜测。
- 过期 GovernanceWaiver 不再影响 Violation 状态，只有 active waiver 才能将对应问题标记为 waived。
- GovernanceViolation/GovernanceWaiver 新增 eventRefs，关联已有 Workspace Event 读模型以支持 actor 与策略事件追踪。
- Governance Snapshot 支持从 Graph/Registry 的显式 eventSources 读取事件，显式调用参数仍优先。
- PolicyDecision 在存在匹配 Workspace Event 时新增 eventRefs，支持授权决定反向追踪事件链。
- Admin Governance Summary 新增违规/豁免计数与合规问题表；Governance Inspector 展示文档 requirement 和 owner。
- Phase 2 关系投影现在消费 Graph/Registry 的显式 `relationships[]` 声明，校验关系类型并保留 scope、requiredness、依赖阶段、环境、版本约束和有效期；旧 `provides/consumes/contracts` 关系继续兼容。
- Phase 2 显式 `DEPENDS_ON` 关系现在拒绝自引用、sourceRef 越界和未注册目标，并以可解释 warning 保留校验结果，避免影响图出现悬空治理对象引用。
- 治理快照新增 owner 与 identity 覆盖统计，直接呈现已解析、unknown、aligned、partial 和 conflict 数量。
- 治理快照将 subjectRef 对应的持久化 Evidence 纳入 unit，并对已验证的依赖失败、退化和未知状态执行可解释健康聚合。
- GovernanceDocument 投影新增 ownerRef，使缺失、过期或冲突文档具备直接可追踪的处理归属。
- GovernanceDocument 投影新增 requirement 与 requirementSource，显式表达文档要求级别及其 Graph 声明来源，同时保留 required 兼容字段。
- GovernanceRule 投影新增 inheritance 模式，显式表达 required/default/optional/forbidden，并纳入规则冲突比较。
- 治理快照新增只读 GovernanceViolation 投影，将文档缺失/过期/冲突与声明冲突统一关联到 owner、状态、来源和证据。
- 声明冲突 Violation 现在始终携带可解析的 declaration evidenceRef；优先复用对象来源证据，缺失时生成冲突投影证据。
- 已 waived 的 Risk 现在投影为独立 GovernanceWaiver 读模型，保留 owner、批准原因、证据和源 Risk 引用。
- GovernanceWaiver 根据 Risk dueAt 自动标记 active/expired，并保留 expiresAt；撤销状态仍需明确的外部事实来源。
- active GovernanceWaiver 现在会关联同 subject 的 Violation，并将其状态投影为 waived，保留 waiverRef。
- Phase 2 关系合同开始强类型化：GovernanceRelationship 新增可选 scope、requiredness、dependencyPhase、environment、versionConstraint 和有效期字段；现有 Graph/Registry 投影明确标注 workspace scope，不伪造未声明的约束值。
- 将 Evidence Contract 的 `unknown` 类型纳入 Schema，允许不完整 legacy evidence 在降级为 unknown 时通过严格合同解析。
- Personal OS 治理投影改为显式对象合同筛选：`objectType`/`governanceUnitType`/`scope`/`lifecycle`/`external` 决定是否进入项目队列，移除 `kind` 关键词推断；13/13 回归与 Control Plane 196/196 通过。
- Evidence Contract 加固：持久化旧记录缺少 source/type/observer/subject 等字段时，Control Plane 统一补齐 fail-safe 默认值并降为 unknown/低置信度；回归更新为 196/196。
- Personal OS 治理对象筛选改为消费显式 `objectType`/`governanceUnitType`/`scope`/`lifecycle`/`external` 字段，移除基于 `kind` 文本的关键词分类；根 Graph 为 `axi-accounts` 补充 contract 类型和 workspace-resource scope，并由 13 项 Personal OS 回归覆盖。
- 补录 `822b1ca3 fix(mobile): auto-configure gateway from pairing QR` 的 Workbench 证据：Control Plane 195/195、Web 184/184、Mobile 34/34、Schema 6/6、Android 单测与配对地址信任边界验证均通过；该提交的历史同提交 CHANGELOG 缺口由本条追踪保留，不改写提交历史。
- Control Plane Phase 0 路径对齐：Axi Mobile/Notify 的可选资源路径现在优先读取 Workspace Registry、再回退到 Graph 声明；未登记时显示 `unknown`，不再猜测历史 `mosscoder` 目录。
- Control Plane 生产内部网关认证现在对缺失或开发默认 token fail closed；注入明确生产 token 的路径保留，回归测试更新为 193/193。
- 将 `REQ-CONTROLPLANE-001` 的 TODO 验收追踪补齐到生产 token fail-closed 回归与 43-resource smoke 证据，并刷新 manifest 更新时间。
- 校正 Milestone 4 的历史 submit-log 治理统计，与当前审计结果统一为 236 个覆盖缺口和 537 个同批 CHANGELOG 证据缺口。
- 补录 legacy consumer 清理后的 Web 浏览器证据：Playwright 25/25、Web type-check、184/184 单测、UI contract、生产构建和边界检查均通过。
- 完成 Web legacy UI 清理：删除不在 `AxiDashboardShell` 渲染链路中的 `Sidebar.tsx`、`TabBar.tsx` 及 CSS，移除 Web 对 `@epap/ui` 的直接依赖和锁文件入口；`@epap/api-client` 保持独立 API 兼容合同。
- 完成 Web legacy consumer validation：确认 `@epap/ui` 仅由 `Sidebar.tsx` 与 `TabBar.tsx` 直接消费，`@epap/api-client` 与 UI 迁移解耦；核对 `@axi/core`/`@axi/shell` 目标出口并保留行为级迁移门槛，详见 `docs/audit/20260913-web-legacy-consumer-validation.md`。
- 补齐本地持久化依赖验收：Compose PostgreSQL 的 RLS 集成（专用迁移/运行角色）与 API Gateway 真实 Redis 会话重启/并发集成均通过；P4 继续把集群、生产 SMTP、ZITADEL 和故障注入保留为外部门禁。
- 恢复并验证本地 Mailpit 集成：启动独立 `mailpit` 容器后，`make verify-identity-mailpit` 通过；P4 当前保留真实 ZITADEL、生产 SMTP、Kubernetes 与故障注入门禁为外部验收。
- 对齐 v2 项目文档状态：根级 `AGENTS.md` 不再把已验证的 manifest 标记为 legacy，manifest 的 active/known-failure 列表同步到当前 PRD 开放项，并重新生成 `docs/HANDOFF.md`。
- 统一关联审批与交接的过期终态：`ApprovalRequest` 超过 `expiresAt` 时，Control Plane 同步将交接记录持久化为 `expired`，再返回 409 并写入审批、交接和拒绝审计，避免历史中出现 pending 悬空记录。
- 将 `MILESTONE.md` 的 delivery-record 证据从旧批次 3/3 更新为当前提交 1/1，并保留前一交接 owner 批次 4/4 的可追溯记录。
- 补齐交接关联审批的过期重验：目标端发现 `ApprovalRequest.expiresAt` 已过时，先将审批与交接一起持久化为 `expired` 并审计，再以 409 拒绝打开/完成/拒绝；其他非 `pending` 审批仍保持交接不变；Control Plane 回归更新为 192/192。
- 补齐交接协议对关联 `ApprovalRequest` 状态重验的说明，明确非 `pending` 时的 409、状态不变和拒绝审计行为。
- 加强交接目标端的权威审批重验：打开、完成或拒绝前重新读取关联 `ApprovalRequest`，非 `pending` 状态返回 409、保持交接不变并写拒绝审计；Control Plane 回归更新为 191/191。
- 交接详情在成功重取当前项目状态后提供直接的项目详情入口，保持对象、状态和责任上下文连续，避免用户重新搜索同一对象。
- 增加 Web 交接详情的浏览器验收：Playwright 25/25 覆盖已认证详情页重新读取当前项目状态并展示服务端状态，避免仅凭交接快照渲染。
- 补齐 Web 交接详情的数据新鲜度：打开或动作完成/拒绝后，详情页依据交接对象标识重新读取当前 Control Plane 项目状态；当前状态不可用时不显示交接快照作为替代，并新增成功/失败回归覆盖。Web 单测更新为 184/184。
- 将项目 manifest 与生成的 `docs/HANDOFF.md` 最近提交审计证据从 3/3 更新为本批 roll-up 后的 4/4，并同步 `HEAD~4` 严格审计命令。
- 记录 2026-09-13 交接安全批次：owner subject 绑定、生成 handoff 指南刷新与 Changelog 追溯已由批次 roll-up 统一覆盖。
- 刷新由 `docs/project-docs.manifest.json` 生成的 `docs/HANDOFF.md`，同步当前 2026-09-13 的测试证据、交接 owner 授权状态与已知环境门禁。
- 收紧跨端交接的目标端授权：Web 发起的配对流程会将已验证 owner subject 写入 `sourceOwnerRef`，Web 历史查询按主体过滤，打开/完成/拒绝前重新校验主体，不匹配返回 403 并写入拒绝审计；未绑定旧记录在迁移期保持兼容可见。Schema、OpenAPI、PRD/协议证据与 Control Plane 190/190 回归同步更新。
- 修正交接审计事件的 Workspace Event 归属：归一化优先使用 `handoffId` 作为 `objectRef`，可按交接 ID 查询创建、打开、完成、拒绝和过期生命周期，避免被 `approvalRef` 截断为审批对象历史。
- 交接 SLA 支持实例级配置：Control Plane 新增正整数 `handoffExpiryMs` 与 `AXI_HANDOFF_EXPIRY_MS`，新交接按配置写入 `expiresAt`，代码参数优先且非法值回退 24 小时默认；业务场景的更短 SLA 仍由产品策略决定。
- 同步能力台账：Web 交接续办记录历史查询/状态筛选，Mobile 工作区记录配对设备限定的交接历史入口、数据源与 actor 边界，保持 PRD 新增用户能力与 `CAPABILITY-INVENTORY.json` 一致。
- 补齐交接生命周期审计身份链：创建、打开、完成、拒绝、过期及过期通知事件统一记录 `sourceActorRef`；打开事件同时记录已验证 Web `actorRef`，使持久化交接来源与审计事件可由同一 actor/correlation 追溯。
- 增加受认证保护的 Web 交接历史投影：Control Plane/Gateway 支持 `GET /api/v1/handoffs?status=&actor=`，Web 新增 `/admin/handoff` 历史列表、状态筛选与详情导航；`actor` 仅为源端 actor reference 过滤器，不替代 Web 授权。Schema、协议文档及 Node/Go/Web 回归测试同步更新。
- 交接历史批次验证：Control Plane 186/186、Web 183/183、API Gateway race tests 通过；Web 类型检查和生产构建仍在本批次复核。
- 增加配对设备限定的 Mobile 交接历史页 `/handoffs` 与 `/api/v1/mobile/handoffs` 投影：服务端强制使用 bearer 对应的 `user:<deviceId>` 源 actor 过滤，Profile 提供入口；OpenAPI、Mobile 导航标题和回归验证同步更新。
- 完成交接拒绝语义：Control Plane 新增 `pending/opened → rejected` 终态，拒绝必须提供非空原因并记录 Gateway 验证主体、关联标识和审计事件；Web 续办页提供带原因输入的拒绝操作，Schema/OpenAPI/协议文档和回归测试同步更新。
- 交接拒绝批次验证：Control Plane 181/181、Web 182/182、Schema 6/6；Web 类型检查、边界检查和工作区注册校验通过。
- 完成交接 SLA 基线：新建交接持久化默认 24 小时 `expiresAt`；访问、写入或显式 sweep 发现超时后转为不可完成的 `expired` 终态，并写入关联标识和过期审计；Schema/OpenAPI/Web 展示及回归测试同步更新。场景化更短 SLA 仍保留为开放项。
- 完成后台交接 expiry worker：Control Plane 默认启动可停止、`unref` 的定时 sweep，发现超时记录即持久化为 `expired` 并写审计；测试覆盖定时触发和进程不阻塞。
- 增强 `pnpm audit:submit-logs` 批次审计命令：同时识别直接 submit log 与 batch-submit 聚合记录，并按同批次 Changelog 证据计算覆盖；最新 `HEAD~3..HEAD` 已通过 3/3，历史仍有 236 个 submit-log 覆盖缺口和 537 个 Changelog 证据缺口，继续保留为治理债务。
- 对齐 PRD 开放项状态：交接拒绝已从“规划中”更新为 2026-09-13 已完成；Web→Mobile、批量交接和场景化 SLA 仍保持开放，避免把已落地的拒绝语义重复列为待开发。
- 对齐交接协议与运行合同：明确通用 draft 状态机与当前 Mobile→Web `pending/opened/completed/rejected/expired` camelCase profile 的差异，避免后续实现误用未落地的 `created/delivered/accepted` 状态。
- 增加交接过期通知边界：Control Plane 在持久化并审计 `expired` 后调用可选外部 relay enqueue 回调；通知回调失败不会回滚或阻止终态，并写入 `handoff_expiry_notification_failed` 审计。渠道投递、重试和偏好仍归外部通知能力。
- 刷新根 PRD 的实施状态：P1 Web 与 P2 Mobile 标记为 2026-09-13 本地验收完成，P3 明确 Mobile → Web 已验证而 Web → Mobile/批量交接/SLA 仍开放，P4/P5 保留真实集群、身份和生产 Grant owner 外部风险；避免继续以“实施待启动”误导零上下文接手。
- 补齐 `MILESTONE.md` 各阶段的 Objective、Status、Evidence、Exit criteria 和 Unresolved risks 字段，并将 `REQ-MILESTONE-001` 的验收改为与 PRD 一致；历史 submit-log 逐份回链仍由 `REQ-LOG-001` 单独跟踪。
- 对齐真实运行栈：移除无测试目录的 `ai/agent-platform` / `ai/knowledge-base` 空 `test` 脚本；将 `services/core-service` 的 pnpm 与 Makefile 入口从不存在的 Gradle wrapper 改为 Maven（该兼容服务无 Flyway 迁移，`migrate-core` 以 Maven 测试作为可复现校验）；修复 Verification Inbox 的 React/React DOM 版本漂移，并为 `@epap/utils` 补齐 Vitest 测试入口。
- 为 `services/control-plane` 与 `services/communication-gateway` 补充六层 ownership declaration，明确 Entry、Authority、Downstream、Renderer、Audit、Verification；TDD 同步记录浏览器 E2E、兼容服务和 Mailpit 的依赖边界。
- 2026-09-13 验证批次：全仓 `pnpm type-check` 与 `pnpm test` 通过（26/26 tasks），Web/Mobile Playwright 通过 24/24 与 1/1，`make verify-go`、`make verify-helm`、Fleet Console、DevSvc、utils、Verification Inbox、Maven 兼容服务测试通过。`make verify-identity-mailpit` 因当前环境没有 `127.0.0.1:1025` Mailpit listener 失败，作为外部环境阻塞保留，不冒充已通过。

- 登录页增加网易云式一键登录：同设备票根 10 天有效，底部保留上次账号，现有邮箱/密码/扫码收敛到「以其它方式登录」。
- Mac 登录成功后只打开工作台主窗；未登录时托盘/二次启动不再把登录页撑进 1280×800 主窗。
- 登录页密码框右侧补上网易云式小眼睛：点击显示/隐藏明文，不打断输入焦点。
- 登录页连续 Enter 按网易云式分步：空字段只聚焦并反复空校验；邮箱/密码或验证码合法后先提示勾选协议，再 Enter 自动勾选，再 Enter 才提交。鼠标点击仍只提示、不自动勾选。
- macOS 桌面包 Dock / 菜单栏显示名改为跟 Web i18n 一致：中文 `公理工作台`，英文 `Axi Workbench`。`.app` 产物路径同步为 `公理工作台.app`。

### Added

- Added the first read-only Workspace Control Plane governance projection:
  `GET /snapshot` now keeps workspace registry and graph declarations separate,
  exposes stable object identity/type/owner/lifecycle, typed relationships,
  evidence provenance and freshness, and preserves unresolved conflicts. Legacy
  external runtime paths now report `unknown` until explicitly configured or
  proven by a compatibility path.
- Added conservative explainable health to each governance unit: status, reason
  code, evidence and affected-object references, resolved owner, and recommended
  action. Missing runtime/behavioral evidence remains `unknown`; stale,
  conflicting, or structurally missing evidence is surfaced instead of being
  reported as healthy.
- Added a read-only governance posture summary to the Workbench Dashboard:
  workspace-level unit counts, health/conflict counts, source references, and
  typed identity/freshness rows are visible before entering project detail;
  project rows continue to open the evidence Inspector.
- Added the first Phase 2 relationship read model: capability consumers now
  receive derived `DEPENDS_ON` edges to matching providers, while the snapshot
  exposes direct/transitive upstream and downstream impact without changing
  registry or graph ownership.
- The relationship adapter also recognizes the current graph contract where a
  `consumes` entry directly names another registered unit, preserving that
  dependency as a provenance-marked edge instead of requiring a capability-name
  collision.
- Added the first Phase 3 document-coverage projection: graph-declared
  `docs_entrypoints` become required document objects with project-relative
  paths, structural evidence, explicit present/missing/unknown status, and
  missing-document health guidance.
- Added read-only workspace rule declarations from graph rules and the
  registry admission-policy reference, preserving scope, priority, owner
  resolution, source provenance, and structural status without claiming that
  a declaration has been executed.
- Added the first Phase 4 Workspace Event read model: existing append-only
  audit records are normalized with actor/object/correlation/result metadata,
  bounded filters, immutable retention class, snapshot exposure and an
  authenticated `/events` endpoint; raw audit payloads remain private.
- Added per-event audit detail lookup and SHA-256 hash segments with explicit
  `verified`/`invalid`/`unverified` integrity status; legacy records remain
  clearly unverified and never get retroactively treated as tamper-proof.
- Approval decisions now emit a server-attributed `policy_decision` event
  linking the actor, governed object, approval reference, before/after state,
  correlation id and decision result.
- API Gateway now explicitly proxies the authenticated workspace event list and
  detail routes, and the shared API client exposes the bounded event query
  hook without allowing direct browser access to the control-plane port.
- Explicitly configured Service/Deployment event ledgers can now join the
  normalized stream through `AXI_WORKSPACE_EVENT_SOURCES`; source provenance
  and per-ledger integrity status are preserved without filesystem discovery.
- Restored the Web login client chrome and shared six-slot email verification
  input, while keeping the Tauri native window controls and fixed feedback
  layout; the Workbench UI contract verifier is green again.
- Added Phase 5 RBAC readiness contracts and a read-only policy kernel with
  typed Subject/Role/Grant/PolicyDecision records, explicit scope inheritance,
  deny precedence, validity windows, approval/evidence escalation and secure
  default deny; real Grant ownership remains outside Workbench.
- Exposed the policy kernel through an authenticated `/authorization/decision`
  read endpoint that loads grants only from the registry-declared path; absent
  RBAC configuration is returned as an explicit secure default deny.
- Policy decision evaluations are now appended to the Workspace Event ledger as
  server-attributed `policy_decision.evaluated` records linking caller, object,
  action, decision reference and result.
- Core controlled HTTP writes now run that policy gate before job creation,
  AgentTask cancellation, approval decisions, or registered command execution;
  absent RBAC configuration therefore fails closed and leaves an auditable
  decision.
- Natural-language execution via `/query` and `/communication/messages` now
  evaluates the same policy after intent resolution and before starting a
  registered command or AgentTask; read-only and `dryRun` paths remain
  non-executing.
- Mobile project jobs, cancellations, approval decisions and approval-scan
  decisions now use server-derived device subjects with the same registry-backed
  Grant gate; pending approvals and dispatched Jobs retain the originating
  `policyDecisionRef`.
- Synchronized the mobile `actionLevel` A/B/C/D field across the runtime
  response contract, OpenAPI schema and mobile TypeScript model; fixed the
  response-schema test server lifecycle and aligned its diagnosis fixture.
- Added an authenticated `/internal/communication/v1` Control Plane boundary;
  the communication gateway now carries its internal token and derived subject
  for both job submission and progress-event polling.
- Added RBAC authorization-source readiness to the governance snapshot and Web
  governance posture: configured/unconfigured/missing/unresolved/invalid state,
  owner, policy version, grant count and warnings are visible without exposing
  grant records.

- 将 WorkBench 原生 Android 客户端收敛到 `apps/workbench-mobile/android`，纳入同一 monorepo 的 Kotlin/Compose 源码、Gradle 工程、测试、API 会话、扫码流程和统一六瓣十二色启动图标；Debug 构建固定对应 `com.workbench.mobile.debug`、版本 `1.0.8 (9)`。

- Added the Personal OS v0.1 Project Queue surface inside Workbench: a
  control-plane SQLite overlay, versioned queue/focus/project contracts,
  Today and Workbench routes, Inspector editing, explicit runtime/warning
  states, and a `personal-os-local` workspace profile. The first slice keeps
  resource-search, Agent dispatch, Flow and Library outside the active scope.

- Added the workflow-first `task-execution-routing/v1` execution boundary:
  typed `BOUNDED_AGENT` and `APPROVED_EFFECT` steps, durable digest-bound
  approvals, cancellation, route decisions and authenticated Agent lifecycle
  events. Generic HTTP steps and legacy Agent routes cannot bypass it.

- Added the machine-checked multi-surface capability inventory and `pnpm check:capabilities` admission gate. It requires every current/new user capability to state its allowed actions, data source/status, A/B/C/D level, Owner, server authorization/revalidation, idempotency, audit, handoff and unsupported surface.
- Added server-resolved domain approval scan contracts (`ApprovalScanPreview`, `MobileApprovalDecision`, `HandoffContext`), API-Gateway-only Mobile ingress, correlation-bound Web handoff continuation, schema/OpenAPI coverage, and audit/idempotency/revocation test coverage.
- Added DevSvc Hosted App execution-boundary metadata for Fleet, Coder and Verification Inbox so Host discovery exposes Owner, authorization, audit and fallback without duplicating D-level execution.

- Added ADR-0001 and the Go production API plane: ZITADEL-oriented Gin `api-gateway`, `identity-adapter`, modular `platform-core`, Dockerfiles, local role bootstrap, Helm chart, migration jobs, NetworkPolicy, PDB and ZITADEL values example.
- Added server-side Authorization Code + PKCE session handling, JWKS validation, Redis rate limiting, Redis-backed one-time QR transactions, SMTP verification adapters, EPS identity-link records, tenant/RBAC/preferences/dictionaries/projects/tasks/outbox modules and PostgreSQL RLS integration coverage.
- Added OTLP/HTTP trace export in gateway, identity-adapter and platform-core; an empty endpoint remains offline/no-op for local development while W3C trace context continues across services.
- Added tenant-scoped platform API client contracts; legacy Spring/H2 project endpoints are explicitly read-only compatibility hooks.

- Added a formal independent mobile application at `apps/workbench-mobile` with its own Vite entry, routes, header, tab bar, mobile pages, login surface, unit test, and UI boundary verifier.
- Added `@axi/workbench-foundation` to share only authentication session behavior and locale preference between the Web and mobile applications.
- Added the root documentation suite placeholders and governance entrypoints for README, AGENTS, INDEX, PRD, TDD, TODO, and milestone alignment.
- Added `docs/rules/axi-workbench-boundary-sop.md` and `pnpm check:boundaries` to block direct runtime coupling to neighboring project implementations.
- Added the read-only Axi Mobile project-intelligence projection: workspace health totals, attention items, project progress, capabilities, and allowlisted configuration groups.
- Expanded `docs/state/PRD.md` and `docs/state/TDD.md` with the v2 requirement set (`REQ-DOC-001/002`, `REQ-VERIFY-001/002`, `REQ-BOUNDARY-001/002`, `REQ-CONTROLPLANE-001`, `REQ-COMMUNICATION-001`, `REQ-WORKBENCH-001/002`, `REQ-MILESTONE-001`, `REQ-LOG-001`, `REQ-AXI-CODER-001`, `REQ-MOBILE-001`) and the matching TDD verification matrix.
- Linked every `REQ-*` row to the corresponding commands and tests captured in `docs/state/TODO.md` and `docs/state/TDD.md`.

### Changed

- 登录验证码提示 banner 允许换行完整显示「QQ 邮箱可能在垃圾邮件中」，不再单行截断。
- 登录 banner 固定在提交按钮下方，不再随文案长短贴底或上移；身份服务英文错误映射为「身份服务暂时不可用，请稍后重试」。

- Web、Mobile 与共享客户端改走 REST 资源路径：会话用 `/sessions/current`、`/sessions`、`/sessions/email`、`/sessions/device-qr/:id`；通知用 `PATCH /notifications/:id` 与 `POST /notifications/read-receipts`；控制面/工作流/配对的 cancel、decision、run、confirm、nonce、token 改名词路径。旧 RPC 路径仍由 Gateway 兼容。

- Gateway 第二轮 REST：拆掉 `/control-plane/*` 与 `/mobile/*` 的 `Any` catch-all，改成显式方法/路径 allowlist；登录 `confirm`/`consume` 以及 QR `resume`、邮件校验 `confirm` 增加名词资源别名（`/sessions/email`、`/sessions/device-qr/:id`、`/email-verifications/:id/redemptions`、`/qr/transactions/:id/resumptions`），旧 RPC 路径保留。CONNECT/TRACE 与未登记路径返回 404，不再穿透到 Control Plane。

- 将 Web/Tauri 登录面板邮箱后缀改成 Element 风格的复合输入 append：灰色选择器、内容宽度、可开合菜单，以及打开时旋转的小箭头。前缀仍限制为常见邮箱 local-part 格式，拒绝特殊字符、非法点边界和超长值，非法输入不会触发验证码或密码登录。

- 修正 macOS 桌面包的 Gateway 目标：正式打包默认注入 `https://workbench.axiomaticworld.com`，并在产物校验中确认公网地址已生效，避免可分发 App 运行时使用 `127.0.0.1:8088`；本地 Gateway 仅能通过显式调试开关使用。
- 增强桌面 Gateway 默认值：生产 Web 构建即使未显式注入环境变量也优先使用公网地址，开发构建仍保留本地回环地址。
- 进一步对齐登录二维码容器：保留二维码本体四周约 8px 的均匀白边，并恢复 8px 圆角外框，避免在去除重复边框时把客户端需要的安全边距一并移除。
- 收紧登录二维码容器：移除 Ant Design QRCode 的嵌套边框和外层二次内缩，只保留单层细边界，避免二维码周围出现多余留白。
- 统一 macOS 桌面包的产品名为 `Axi 工作台`，同步 Dock/应用列表元数据、`.app`/`.dmg` 产物路径、CI 上传和公证脚本，避免旧的 `Workbench` 名称继续出现在系统中。
- Routed packaged macOS Tauri `/api/*` traffic through the native Rust Gateway transport, including `tauri://` / `tauri.localhost` origins, HttpOnly session-cookie retention, HTTPS support, and a local/shared-domain allowlist; the desktop release build now targets `workbench.axiomaticworld.com` without weakening WebView ATS policy.
- Separated Workbench mobile Gateway defaults by build type: Debug remains configurable for emulator/LAN development, while Android Release defaults to `https://workbench.axiomaticworld.com/api/v1/`.
- 修正 Android 启动 Logo 的缩放跳变：系统 Splash 与原生品牌 Loading 统一使用 `ic_splash_icon` 的 288dp 画布和同一中心点，使两层可见花瓣边界一致。
- 优化原生 Android 冷启动交接：新增不依赖 Compose 的 `BrandLoadingView`，系统 Splash 结束后立即绘制六瓣十二色 Logo、提示文案和动态 loading；Compose 工作区在其下方挂载并等待首轮状态与完整绘制帧后移除唯一覆盖层，避免应用内重复 Loading 或业务中间态闪帧。
- 修正原生 Android 的启动链：移除旧的 Compose 蓝色方块 Loading，改用 `WorkBenchStartupGate` 统一绘制六瓣十二色 Logo、提示文案和 loading 动画；准备完成后移除不透明覆盖层进入已完成首帧的工作区。
- Android 12+ 系统 Splash 作为平台首帧预览，与 Compose Loading 的中心 Logo 对齐并无缝衔接；网关地址在 Compose Loading 内初始化，避免系统 Splash 停留过久或出现位置跳帧。

- `packages/ui` 的 Vitest 浏览器测试链统一到 `vitest` / `@vitest/browser-playwright` / `@vitest/coverage-v8` `4.1.11`，并将 Vite 更新到 `7.3.1`；移除失效的空 `eslint.config.js` 垫片，恢复 legacy ESLint 配置的可执行 lint 入口。`packages/ui` build、4 个测试文件共 13 个测试、lint 均通过；工作区 critical audit 为 0，仍有 10 个 `any` warnings。
- Replaced Mobile Home, Projects, Workspace and search showcase data with authenticated Control Plane projections. Unpaired, unauthorized and unavailable states now stay explicit rather than rendering static substitutes; Mobile keeps four persistent navigation items and the top Scan action.
- Revalidated the desktop workbench against official Ctrip eBooking, Jira, GitHub Projects, GitLab Operations and Shopify admin documentation. Removed the incorrectly added Web generic scanner from navigation, search and implementation; the legacy URL now safely returns to the dashboard. Web now exposes an actual Control Plane-backed “运行状态” work surface and a filterable “工作项” queue instead of a mobile-shaped scanner tool or fabricated metrics.
- Moved one-time OIDC QR confirmation to the separately named Mobile login-flow entry “确认网页登录”. The top Scan accepts only opaque `axi://approval/scan_*` domain approvals and sends only a decision, idempotency key and bound handoff correlation id.

- Reframed the multi-surface product contract from a simple Web/Mobile split into a role-oriented “control center / role-execution mobile / professional tool” architecture, grounded in bounded official public-product-shape research for 千牛、美团商家版、携程 eBooking and 飞猪商家中心. Added `REQ-ARCH-001`, `REQ-ACTION-001` and `REQ-REFERENCE-001`; all new user capabilities now require an A/B/C/D action policy, a target surface, service-side authorization/revalidation, audit and a fallback handoff. The research explicitly records observations, links and non-inferences rather than treating competitor features or internal architecture as Workbench facts.
- Set the product contract for Axi Workbench as a multi-surface admin system: Web is the complete backend-management primary surface; Mobile is the auxiliary management surface for personal context, alerts and constrained confirmations. The PRD records the actual four persistent Mobile navigation items plus top-level Scan action, keeps Identity login confirmation separate from Mobile approval scan, excludes generic Web scanning, and excludes the Host and vertical tools from the user-backend information architecture. Added `REQ-POSITION-001`, `REQ-SURFACE-001`, `REQ-WEB-001`, `REQ-WEB-002`, `REQ-MOBILE-001`, `REQ-MOBILE-002`, `REQ-CROSS-001`, `REQ-SCAN-001` and `REQ-DELIVERY-001` with a capability-ownership template and product-specific verification path.
- Added the canonical source catalog at `docs/architecture/source-catalog.md`, separating the two user workbench clients from the Host, hosted tools, vertical runtimes, nested CLI monorepo, and root pnpm workspace membership; root navigation now points to that catalog.
- Replaced browser local token/refresh handling with HttpOnly gateway sessions; apps use relative API paths in development and an explicit HTTPS gateway origin in production, while shared locale preference synchronizes with platform-core after authentication and retains a local offline cache.
- Reclassified `auth-service` and Spring/H2 `core-service` as migration compatibility only; the production Helm chart exposes only the Go gateway and its internal Go services.
- Hardened the Go API plane after independent review: access-token audience/scope checks, exact credentialed CORS origins, QR completion through the single gateway ingress, graceful server shutdown, SMTP TLS protection, migration-only configuration, protected Owner transitions, and leased/idempotent Outbox delivery.

- Restored the independent mobile application to the prior WeChat-inspired interaction system: centered title, search and plus menu, overview/project/workspace/scan/me navigation, green active state, badges, and a scan page. Web Axi Dashboard Chrome remains Web-only.
- Converted `apps/workbench` into the Web-admin-only application: the viewport-driven `MobileTopBar` / `MobileBottomNav` branch was removed, and the Web UI verifier now blocks its reintroduction.
- Replaced the previous single-SPA documentation policy with an explicit two-app policy: independent Web and mobile composition, shared foundation/API/contracts/tokens only.
- Documentation ownership is now explicit for `/Volumes/code/workspace/projects/axi-workbench`.
- Upgraded `docs/project-docs.manifest.json` to the verified v2 zero-context onboarding contract and added freshness governance to `TODO.md`.
- Replaced hard-coded Axi Notify mobile artifact paths in Axi Coder snapshots with environment-driven resolution and `workspace://` contract references.
- Mobile access-token issuance now requires a signed, single-use device nonce; pairing paths remain under `/mobile/v1` and existing response fields remain backward compatible.
- `docs/state/PRD.md` and `docs/state/TDD.md` updated on 2026-08-07 to reflect the current six-layer monorepo: workbench as the only user entrance, desktop host shell responsibilities, communication/control-plane contracts, and per-surface verification commands.

### Notes

- Product or implementation changes should add entries here when they affect users, operators, or downstream agents.
- The root `AGENTS.md` still describes the pre-v2 manifest as legacy; an authorized follow-up will reconcile that wording once the manifest refresh stabilizes.
- Persisted the originating `policyDecisionRef` across core and mobile job
  submission, cancellation, approval, registered-command, and approval-scan
  audit paths so an evaluated decision can be traced to the controlled result.
- Added an enforced Control Plane execution mode: direct surface calls without
  a valid policy decision reference fail closed, while direct natural-language
  execution evaluates and audits the configured policy before any executor.
- Added typed Risk and Incident projections for execution failures. Failed
  AgentTasks, registered commands, and workflow jobs now create durable,
  correlated records with owner/evidence/policy-reference fields, and the
  governance summary surfaces open risk and incident counts.
- Added a policy-gated Risk lifecycle endpoint for listing and transitioning
  open, acknowledged, resolved, and waived records; closure/waiver requires a
  reason and updates the paired Incident plus immutable audit events.
- Risk and Incident creation now resolves `ownerRef` from the authoritative
  workspace registry first, then graph metadata, and records `ownerSource`;
  unresolved ownership remains explicit as `unknown`.
- Governance Summary now renders read-only Risk details including target,
  severity, lifecycle status, owner, reason, and PolicyDecision reference.
- Governance Summary now routes Risk acknowledge/resolve/waive actions through
  the authenticated control-plane client; resolve and waive require a user
  reason before the snapshot is refreshed.
- Hardened registered command execution: only a parsed single executable from
  the allowlist runs with `shell: false`; chained commands, pipes, redirects,
  substitutions, and environment assignments remain visible but blocked.
- Registered command records now carry explicit `ownerRef`, `source`, and
  `executorRef` provenance instead of requiring consumers to infer ownership
  from command identifiers.
- Execution failures now persist a typed behavioral Evidence record and link it
  from the Risk, Incident, and creation-audit projections; the governance
  snapshot reloads these evidence records after restart and Governance Summary
  renders the Risk evidence references.
- Added registered `run_remediation` command support. Remediation contracts are
  never auto-executable, are routed through a high-risk approval Job, and only
  the internal approval bridge may authorize replay; forged request-body
  approval markers remain pending and direct query/API execution fails closed.
- Risk projections now preserve the PRD's nullable `impactSnapshotRef` field;
  execution failures explicitly record that no impact snapshot was assessed
  instead of silently omitting the distinction.
- Successful registered command executions now also persist behavioral Evidence
  and link it from AgentTask and AuditReport records; failed registered jobs
  reuse their generated Risk evidence, so both outcomes remain traceable.
- Control action results now carry the same execution evidence references,
  including direct health/verify responses, so the Run surface does not lose
  the Evidence Contract link even when no Job is created.
- Policy evaluations now persist immutable PolicyDecision records with a
  correlation ID under the control-plane cache; the governance snapshot and
  authenticated GET-by-ID route reload the same decision after restart.
- Added a policy-gated registered automation projection and trigger route.
  Automations may reference only owner-matching, registered health/verify
  commands; paused, blocked, unregistered, remediation, and raw-shell
  references cannot execute, and successful runs retain the existing Evidence
  and audit links.
- Added an opt-in interval automation worker. Each tick evaluates a dedicated
  automation subject through the persisted PolicyDecision gate, skips denied
  or invalid declarations, and records the successful run timestamp without
  keeping the process alive through an unref'ed timer.
- Governance Summary now renders real registered automation declarations only
  when present, including owner, trigger, command, status and last-run evidence;
  enabled rows use the authenticated Gateway trigger hook and non-enabled rows
  remain disabled.
- Behavioral execution evidence now has a 15-minute TTL and its freshness is
  recalculated when snapshots are built, so old successful or failed checks
  become stale instead of remaining permanently configured as current.
- Governance Evidence now carries an explicit `observationKey`, with stable
  defaults for graph/document/automation declarations and execution facts;
  persisted evidence reloads retain that key for historical observation
  grouping rather than relying on record IDs alone.
- Configured policy evaluations now persist a process Evidence record for every
  allow, deny, approval, or additional-evidence result and attach it to the
  immutable PolicyDecision and evaluated-event projection.
- Controlled surface references now fail closed unless the PolicyDecision ID
  exists in the immutable store, is an unexpired `allow`; the mobile approval
  creation path is the only explicit `require_approval` exception and still
  creates a pending ApprovalRequest.
- PolicyDecision references are now bound to the expected resource and action
  at each controlled surface, preventing a valid allow decision for one object
  from being replayed against another object or operation.
- Controlled surfaces now also require and compare the authenticated Subject
  against the persisted PolicyDecision, including Core/Mobile HTTP, approval
  replay, and interval automation paths; missing or cross-subject references
  fail closed.
- Approval requests now carry a five-minute `expiresAt`; expired pending
  approvals transition durably to `expired`, emit an audit event, and cannot
  dispatch a Job, while legacy records receive a bounded expiry during reload.
- Core `/jobs` now honors a persisted `require_approval` PolicyDecision by
  creating a desktop ApprovalRequest instead of enqueueing work; approval
  replay carries the originating decision and subject through the controlled
  dispatch bridge, with regression coverage for the pending path.
- Refreshed the two user-application verification baseline: Web tests pass
  181/181 and its UI contract verifier, type-check, and production build pass;
  Mobile tests pass 33/33 and its contract verifier, type-check, and production
  build pass; Workbench Foundation type-check also passes.
- Removed Axi Coder's remaining workspace-root convention fallback for the
  mobile companion snapshot. Native resolution now accepts only explicit
  environment paths and otherwise emits the `workspace://` contract reference;
  Rust coverage proves a workspace root cannot resolve a neighbor by naming
  convention.
- Reconciled the delivery tracker with current evidence: root documentation,
  Control Plane smoke, communication-gateway boundary, v2 manifest, and
  Axi Coder snapshot boundary requirements are now checked off after their
  targeted validations and the `axi-workbench` handoff-check passed 10/10.
- Completed the current browser acceptance pass: Web Playwright login and
  legal-route coverage passes 24/24, Mobile Playwright login coverage passes
  1/1, and the independent Mobile contract verifier remains green. The pass
  covers the desktop shell geometry, responsive boundary, QR states and the
  six-slot OTP interaction.
