<!-- Layer: 3 | Agents | Module: scripts -->
<!-- Parent Architecture: ../.claude/ARCHITECTURE.md -->
<!-- Updated: 2026-06-10 -->

# 工作区脚本 Agent 指引（中文镜像）

> 英文源: 本目录同名的英文版（layer 3 agents）；当本镜像与英文源不一致时，以英文源为准。
> 本镜像逐行保留所有路径、命令、文件名与全大写下划线常量。

## 职责

`scripts/` 持有工作区级的命令行工具与封装器，覆盖项目查询、服务管理、告警、拓扑与 Node 运行时选择。脚本必须保持小型、可检视，并可从工作区根安全运行。

工作区根不是 git 仓库或代码所有权单元。把本目录视作启动器面：持久的实现改动应放在对应项目自己的仓库或 `foundation/workspace-governance` 内，根级垫片应保持最小。

## 布局（2026-06-10 重构后）

| 子目录 | 职责 | 不变量 |
| --- | --- | --- |
| `runtime/` | Node 22 封装器与运行时配置（`run-node22-command.sh`、`setup-node22-runtime.sh`） | 不在内部互相 import；由 shell 引用。 |
| `service/devsvc/` | PM2 支撑的开发服务集群（`devsvc`、`devsvc-lib.mjs`、`devsvc-runner.mjs`、`devsvc-dashboard.mjs`、`devsvc-proxy.mjs`、`devsvc-domain-gateway.mjs`、`devsvc-domain-runner.mjs`、`devsvc-alert-lib.mjs`、`devsvc-alert-watch.mjs`、`devsvc-topology-lib.mjs`） | 所有跨文件 import 保持相对本目录内；不要回引到 `scripts/governance`。 |
| `governance/` | 工作区图谱与项目目录查询（`workspace-project`、`workspace-project-mcp`） | 通过相对路径 `../../infra/...` 读取 `workspace.graph.json` 与 `foundation/workspace-governance/scripts/workspace-completion.mjs`。 |
| `utility/` | 预留的临时辅助工具；当前为空（`.keep`）。 | 在此添加独立工具；**不**从 `service/devsvc/` 方向 import（依赖单向）。 |

## 跨层依赖方向

```
service/devsvc/*    ──depends on──>  ./devsvc-lib.mjs (内部)
governance/workspace-project   ──depends on──>  ../../foundation/workspace-governance/...
runtime/*.sh        ──no JS dependencies
utility/*           ──must not import from service/ or governance/
```

## 本地规则

- 脚本中不得硬编码任何凭据。
- 在执行改变状态的服务命令前，优先做只读诊断。
- 把破坏性行为放在显式命令名与清晰输出之后。
- 用 `workspace.graph.json` 与 `dev-services.config.json` 作为数据源；不要把它们的 state 分叉进脚本。
- 对 Node 脚本，依赖应限制在已有运行时模块内，除非有意引入 package 级依赖。
- 新增脚本时**先**确定层（runtime / service / governance / utility），再放入对应子目录。**禁止**直接平铺到 `scripts/`。

## 验证

- 用 `node --check <script>` 对编辑过的 Node 脚本做语法检查。
- 改 graph 相关代码后用 `node /Volumes/code/workspace/scripts/governance/workspace-project validate` 校验。
- 改服务相关代码后用 `node /Volumes/code/workspace/scripts/service/devsvc/devsvc doctor core` 校验。
- 结构变更后重跑根 `make doctor`。

<!-- MANUAL: scripts-specific instructions preserved across updates -->
