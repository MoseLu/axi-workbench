# 桌面工作台功能调研与信息架构校正

调研日期：2026-08-09。此文档只记录产品形态的外部证据和对 Axi Workbench 的有限推导；它不把外部平台的功能、数据或内部实现宣称为本项目事实。

## CRUD 组件实现参考

Web 管理端的列表、筛选、行操作和编辑弹窗，采用 Cool Admin Vue 8.x 的**交互编排**作为实现参考，而不是复制其领域模型、Vue 源码或菜单结构：

| Cool Admin 参考 | Axi Workbench 对应实现 | 本次边界 |
| --- | --- | --- |
| [`cl-crud` + `cl-table` 的角色列表](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/views/role.vue) | `AxiCrud` + `AxiCrudTable` 负责数据、刷新、行操作和表格偏好 | Web 只接入有权威数据源的管理对象。 |
| [`cl-upsert` 的新增/编辑流程](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/views/menu/index.vue) | `AxiUpsert`（当前由 `@axi/crud` 直接导出）负责新增/编辑表单 | 只有真实服务端写入接口才显示编辑入口；不为只读投影伪造弹窗。 |
| toolbar + search + row operations 的组合 | `DesktopCrudFrame` 承载工具栏，领域页通过 `AxiCrud` 绑定真实 API | 不复制 Cool Admin 的领域服务、权限命名或批量删除能力。 |

可写落地面是 `/admin/settings/role`：它以 `GET /api/v1/tenants/:tenantID/members` 读取当前主体可管理的组织成员，并通过 `PUT /api/v1/tenants/:tenantID/members/:memberSubject` 新增或更新角色。Gateway 注入已验证主体，Platform Core 重新做成员授权并记录 `tenant.member.changed` 审计；服务不可用时只显示明确状态，不保留静态“权限事实”行。`/admin/settings/menu` 同样使用 `AxiCrud` 与 `AxiCrudTable` 渲染已登记导航，但没有权威菜单写接口，所以明确保持为只读，不能为了视觉完整度添加假 Upsert。

## 公开证据

| 官方来源 | 可观察到的产品形态 | 对 Workbench 的有限设计输入 | 不作的推导 |
| --- | --- | --- | --- |
| [携程 eBooking 登录页](https://ebooking.ctrip.com/login?targetPath=%2F) | 面向商家的桌面后台覆盖信息维护、订单/库存、营销、经营分析和收益结算。 | 桌面端适合承载跨对象的经营/控制工作，而不是复刻一条移动端信息流。 | 不复制其酒店、库存或结算领域模型。 |
| [Jira Dashboard](https://support.atlassian.com/jira-software-cloud/docs/what-is-a-jira-dashboard/) | 仪表板聚合跨项目的实时信息，组件受权限约束。 | Web 概览应聚合真实项目、任务、审批和运行状态，并由服务端投影决定可见内容。 | 不把卡片数量或图表本身当作工作台必需功能。 |
| [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects) | 同一组真实工作项可在表格、看板、路线图中筛选、分组、排序，并以字段和访问控制组织。 | Web 的“工作项”应是可筛选的受管任务/审批队列，聚焦对象、状态、关联项目和时间。 | 不新增没有事实源的看板、路线图或统计。 |
| [GitLab Operations Dashboard](https://docs.gitlab.com/user/operations_dashboard/) | 跨项目汇总告警、流水线、部署和提交健康状态。 | 新增 Web“运行状态”用于项目健康、受管运行环境和需要处理事项的跨项目观察。 | 不虚构部署、告警或流水线数据。 |
| [GitLab Alerts](https://docs.gitlab.com/operations/incident_management/alerts/) | 告警队列按状态、严重度、时间与详情进行分流。 | 待处理审批和失败任务应作为同一桌面工作面中的可追溯队列，而非首页统计数字。 | 不把全部任务自动视为事故或告警。 |
| [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home) | 管理首页围绕当日任务、下一步、近期活动和可下钻的真实指标。 | 概览只显示当前服务端投影中的项目、任务和运行环境；无数据或服务不可用时明确说明。 | 不以营销式欢迎语、无意义小卡片或样例数字填充界面。 |

## 决策

Web 的职责是“跨项目控制和治理”，而不是 Mobile 的放大版。落地信息架构为：

| Web 工作面 | 真实对象 | 允许的用户意图 |
| --- | --- | --- |
| 工作台概览 | 项目、受管任务、运行环境 | 了解当前全局投影并进入具体对象 |
| 运行状态 | 需处理事项、项目健康、运行环境 | 跨项目观察、筛选、分流和打开关联项目 |
| 项目组合 | 已登记项目 | 检索、比较、查看项目详情与关联交接 |
| 工作项 | 受管任务、待处理审批 | 按状态/文本筛选，并转入真实项目或服务端交接 |
| 组织与访问、账号与设置 | 身份、偏好、权限事实源 | 执行经授权的 C 级管理操作 |

Mobile 仍只承接个人上下文下的 A/B 级行动；设备配对、一次性网页登录确认和领域审批扫码使用独立入口、接口和审计语义。Fleet、Coder、Verification Inbox 等 D 级工具继续由 Host 受控发现，不复制为 Web 或 Mobile 的通用按钮。

## 明确排除

- 不在 Web 导航或路由中保留“通用识别/通用扫码”产品入口，也不调用浏览器摄像头或 `BarcodeDetector`。
- 不将美团、携程等多端存在本身推导为“桌面端应该有通用扫码”。它们的公开页面不能提供这个结论。
- 不新增没有 Control Plane 或领域 API 事实源的自动化、资源、审计菜单、零值统计或空表。
- 历史 `/admin/scan` URL 仅安全重定向到工作台概览，以免旧链接启动一个无业务语义的工具。

## 验收契约

`apps/workbench/scripts/verify-ui-contracts.mjs` 同时检查：桌面导航必须包含 `/admin/operations`，不得公开 `/admin/scan`，源码不得包含浏览器通用扫码实现，且旧 URL 只能重定向到桌面控制中心。
