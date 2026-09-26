# Axi Workbench 工作流目录

这里是 Workbench 专属工作流的唯一入口。每个工作流都必须是可闭环执行的操作契约，不应只是零散命令或经验描述。

## 工作流清单

| ID | 文档 | 范围 | 完成条件 |
|---|---|---|---|
| `WB-AUTH-001` | [`axi-workbench.md`](./axi-workbench.md) | 自动登录、邮件验证码、SMTP/IMAP、桌面验收 | 已登录主窗口，且有真实 UI/API 证据 |
| `WB-DESKTOP-001` | [`axi-workbench.md`](./axi-workbench.md) | Tauri 构建、安装、启动、视觉验收 | `/Applications/Axi 工作台.app` 与构建产物一致 |
| `WB-SMTP-001` | [`axi-workbench.md`](./axi-workbench.md) | 身份服务与邮件投递排查 | 明确定位到配置、服务、握手、认证或收件阶段 |

## 跨项目工作流

Axi Workbench 的具体工作流见上表。跨多个 Axi 项目的统一工作流（如工作区注册表变更、开发者 onboarding、共享包提交、治理审计）由 workspace 级索引统一登记：

- 主索引：[`/Volumes/code/workspace/docs/workflows/README.md`](/Volumes/code/workspace/docs/workflows/README.md)
- 工作流 ID 空间：`WF-*`（workspace 级）、`WB-*`（本项目专用）

## 工作流规范

新增工作流时必须声明：

1. `入口`：触发条件、用户意图、起始应用/路由。
2. `事实源`：配置、服务、UI 状态或 API 的权威来源。
3. `执行阶段`：按顺序写清输入、动作、输出和继续条件。
4. `失败处理`：每个阶段的可恢复动作、不可假设的结论和停止条件。
5. `闭环验收`：最终用户可见结果，以及必须保留的证据。
6. `安全边界`：敏感数据、外部动作、凭据和日志脱敏要求。
7. `验证命令`：结构、服务、行为、安装包等分层验证。

工作流必须由主 agent 负责推进到闭环；只有缺少用户独占信息（例如邮箱验证码）或遇到明确高风险动作时才能暂停。中间步骤成功不等于工作流完成。

## 新工作流模板

```markdown
# WB-XXX-001：名称

## 入口
## 事实源
## 执行阶段
### 阶段 1：...
### 阶段 2：...
## 失败处理
## 闭环验收
## 安全边界
## 验证命令
```
