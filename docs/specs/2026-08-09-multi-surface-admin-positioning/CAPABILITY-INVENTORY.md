# 当前能力全量台账

> 机器可检查的权威记录在 `CAPABILITY-INVENTORY.json`。本页用于评审阅读；每条记录必须说明真实数据来源、动作等级、Owner、服务端政策、重验、幂等、审计、交接和不支持端。

| 范围 | 当前事实 | 动作等级 / Owner | 关键边界 |
| --- | --- | --- | --- |
| Web 登录与会话 | Gateway 转发 Identity 邮箱验证码与 HttpOnly 会话 | B / Identity + Workbench Web | 未配置的 OIDC 不能作为可用入口 |
| Web 概览、运行状态、项目组合、工作项、团队 | 读取 Control Plane 投影；不可用时只显示明确不可用状态 | A / Workbench Web | 跨项目观察、筛选和续办；不伪造零值统计、样例项目或空表 |
| Web 账号与设置 | 通过 Gateway 调用 Identity、Notification、Platform Core | C / Workbench Web | 服务端重新鉴权；Mobile 不复制组织配置、批量和全量审计 |
| Web 运行状态 | 跨项目查看项目健康、运行环境与需要处理事项 | A / Workbench Web | 不提供通用摄像头扫码；登录确认和领域审批仍各自留在受控移动/身份流程 |
| Web 搜索与交接续办 | 注册路由搜索；Gateway 读取/最终化服务端交接 | A/C / Workbench Web + Control Plane | 交接关联标识贯穿 Mobile、Web 与最终动作 |
| Mobile 登录、概览、项目、工作区、搜索 | Identity 会话与 Gateway 转发的已配对设备工作区投影 | A/B / Workbench Mobile | 显示更新时间、刷新、配对/权限/服务错误；搜索不再使用静态结果 |
| Mobile 已登记项目核验 | Control Plane 从当前注册表解析动作后执行 | B / Mobile + Control Plane | 客户端不能提交命令、cwd 或自报项目动作；幂等与审计必需 |
| Mobile 顶部 Scan | 受控审批二维码预览与明确确认 | B / Mobile + Control Plane | 二维码不含业务凭据；登录确认与审批扫码完全分离 |
| Mobile 确认网页登录 | Identity 一次性 QR transaction | B / Identity + Mobile | 仅在登录流程入口，不占用顶部 Scan |
| Mobile 个人中心与通知 | 偏好、配对、短期会话和个人通知 API | B / Mobile + Identity + Notification | 设备凭据仅在内存；组织级设置与审计转 Web |
| Fleet / Coder / Verification Inbox | Host 发现，专业工具执行 | D / 专业工具 | Web/Mobile 只提供受控入口与交接，不复制 D 级按钮 |

历史上 `/home`、`/projects`、`/workspace` 的硬编码项目、统计和本地勾选只是原型，已标记为 `retired`；它们不是业务数据、写操作或验收证据。

## 开发准入

任何新增用户能力必须先更新 JSON 台账并通过：

```bash
pnpm check:capabilities
pnpm check:boundaries
```

检查会拒绝缺少允许动作、Owner、动作政策、审计、交接、复核日期的能力，也会拒绝仍可执行 B/C/D 级动作的 `prototype` 记录。
