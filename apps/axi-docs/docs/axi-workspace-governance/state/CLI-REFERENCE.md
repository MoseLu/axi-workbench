# Axi Workspace CLI Reference

工作区常用 CLI 命令参考指南。

---

## workspace-project

工作区项目治理 CLI，入口为 `/Volumes/code/workspace/scripts/workspace-project`。

### 用法

```
workspace-project <command> [args]
```

### 命令

#### list

列出 workspace.graph.json 中注册的所有项目。

```bash
workspace-project list
```

#### show \<project\>

显示指定项目的完整信息。

```bash
workspace-project show <project-id>
```

#### deps \<project\>

显示项目依赖的 providers。

```bash
workspace-project deps <project-id>
```

#### consumers \<project\>

显示依赖该 provider 的消费者项目。

```bash
workspace-project consumers <provider-id>
```

#### profile \<name\>

显示服务的启动/健康 profile。

```bash
workspace-project profile <profile-name>
workspace-project profile <project-id> --commands-only   # 仅输出命令列表
```

#### health \<project|profile\>

运行声明的健康检查命令。

```bash
workspace-project health <project-id>
workspace-project health <profile-name>
```

#### verify \<project|profile\>

运行声明的验证命令。

```bash
workspace-project verify <project-id>
```

#### completion [project]

显示项目完成度快照。

```bash
workspace-project completion
workspace-project completion <project-id>
```

#### handoff [project]

显示零上下文交接状态。

```bash
workspace-project handoff
workspace-project handoff <project-id>
```

#### onboard \<project\>

显示两分钟接管简报。

```bash
workspace-project onboard <project-id>
workspace-project onboard <project-id> --json
```

#### handoff-check \<project\> [--smoke]

验证 handoff 状态，可选执行 smoke 命令。

```bash
workspace-project handoff-check <project-id>
workspace-project handoff-check <project-id> --smoke   # 执行 smoke 命令
```

#### route-intent

在创建项目前路由项目创建意图（项目引导流程）。

```bash
workspace-project route-intent --intent <intent> --domain <domain>
workspace-project route-intent --intent <intent> --domain <domain> --capability <name>
workspace-project route-intent --intent <intent> --domain <domain> --boundary <boundaries>
```

#### admission-check \<proposal.json\>

验证独立项目 admission 提案。

```bash
workspace-project admission-check <path/to/proposal.json>
```

#### admission-show \<project\>

显示项目的 admission 记录。

```bash
workspace-project admission-show <project-id>
```

#### incubation-check \<directory\>

验证非项目的 incubation 目录。

```bash
workspace-project incubation-check <directory-path>
```

#### validate

验证 workspace.graph.json 与 registry/index 的一致性。

```bash
workspace-project validate
workspace-project validate --json
```

#### whereami [path]

将路径匹配到最近的项目。

```bash
workspace-project whereami
workspace-project whereami /some/path
```

---

## devsvc

服务进程管理 CLI，入口为 `/Volumes/code/workspace/scripts/service/devsvc/devsvc`。
（旧版 `/Volumes/code/workspace/scripts/devsvc` 已删除，请使用 `/Volumes/code/workspace/scripts/workspace-services`。）

### 用法

```
devsvc <command> [profile|service]
```

### 命令

#### list [target]

列出所有 profiles 和 services。

```bash
devsvc list
devsvc list core
```

#### doctor [target]

检查 profile/service 的本地前置条件。

```bash
devsvc doctor core
devsvc doctor <service-id>
```

#### start [target]

通过 PM2 启动 profile/service。

```bash
devsvc start core
devsvc start <service-id>
```

#### restart [target]

重启 profile/service。

```bash
devsvc restart core
devsvc restart <service-id>
```

#### stop [target]

停止 profile/service 并运行清理钩子。

```bash
devsvc stop core
devsvc stop <service-id>
```

#### delete [target]

从 PM2 删除 profile/service。

```bash
devsvc delete core
devsvc delete <service-id>
```

#### status [target]

显示 PM2 状态及健康检查结果。

```bash
devsvc status
devsvc status core
```

#### health [target]

仅运行健康检查。

```bash
devsvc health core
```

#### logs \<service\>

查看指定服务的 PM2 日志。

```bash
devsvc logs <service-id>
```

#### domain status

显示当前公共域名路由和动态服务。

```bash
devsvc domain status
```

#### domain reserve \<id\>

从入口池预留稳定本地端口。

```bash
devsvc domain reserve <service-id>
```

#### domain register \<id\> \<url\> [title]

注册并发布已有的本地服务 URL。

```bash
devsvc domain register my-service http://localhost:3000 "My Service"
```

#### domain unregister \<id\>

移除动态服务注册和端口预留。

```bash
devsvc domain unregister <service-id>
```

#### domain select \<id\> [target]

切换公共域名路由到已注册的服务。

```bash
devsvc domain select my-service
devsvc domain select my-service core
```

#### domain start \<id\> -- \<command...\>

在预留域名端口下通过 PM2 运行命令。

```bash
devsvc domain start my-service -- node server.js
```

#### save

持久化当前 PM2 进程列表。

```bash
devsvc save
```

#### startup

让 PM2 安装 launchd 启动项。

```bash
devsvc startup
```

---

## git-hooks

位于 `/Volumes/code/workspace/foundation/workspace-governance/scripts/git-hooks/`。

### axi-commit-msg-lore-trailer

Git commit-msg hook：检查 commit message 是否包含必需的 Lore trailer。

- 默认要求的 trailers：`Tested`, `Not-tested`, `Confidence`, `Scope-risk`, `Directive`
- 支持通过 `AXI_RULES_INDEX_PATH` 环境变量指定规则文件

```bash
# 手动触发检查
AXI_RULES_INDEX_PATH=/path/to/rules.json node axi-commit-msg-lore-trailer.mjs --verify < commit-msg-file
```

### axi-submit-log-post-commit

Git post-commit hook：提交后记录事件到运行时账本。

- 写入 `docs/logs/submit/` 目录
- 记录分支、trailer 信息、变更路径等

---

## make

工作区根目录 Makefile，位于 `/Volumes/code/workspace/Makefile`。

### 用法

```bash
make <target>
```

### 常用命令

#### doctor

运行所有 workspace doctor 检查。

```bash
make doctor
```

#### doctor-docs

验证必需的治理文档是否存在。

```bash
make doctor-docs
```

#### doctor-graph

验证 workspace.graph.json 内部一致性。

```bash
make doctor-graph
```

#### doctor-state

检测不应被追踪的运行时/状态文件。

```bash
make doctor-state
```

#### doctor-codegraph

检查 CodeGraph 索引是否已初始化且为最新。

```bash
make doctor-codegraph
```

#### doctor-devsvc

运行 devsvc doctor 检查核心服务集。

```bash
make doctor-devsvc
```

#### audit

运行完整审计（governance、graph、workspace-audit）。

```bash
make audit
```

#### ci

在所有活跃项目上运行快速验证（默认仅 typecheck）。

```bash
make ci
```

#### sync-agent-guidance

重新生成 4 个 CLI 工作区发现/硬约束落地文件。

```bash
make sync-agent-guidance
```

#### doctor-agent-guidance-sync

只读：检查 4 个 CLI 落地文件是否与 AGENTS.md 漂移。

```bash
make doctor-agent-guidance-sync
```

#### i18n-render

生成 EN→ZH 镜像对的清单（只读）。

```bash
make i18n-render
```

#### i18n-verify

验证每个 EN→ZH 镜像对。

```bash
make i18n-verify
```

#### schemas / schemas-verify

验证 dev-services.config.json 和运行时状态文件。

```bash
make schemas-verify
```

#### codegraph-status

显示 CodeGraph 索引状态。

```bash
make codegraph-status
```

#### codegraph-init

在工作区根目录初始化 CodeGraph 索引。

```bash
make codegraph-init
```

#### codegraph-sync

增量重新索引。

```bash
make codegraph-sync
```

#### clean-tmp

显示应手动清理的临时目录（不会自动删除）。

```bash
make clean-tmp
```

#### help

显示所有可用的 make targets。

```bash
make help
```

---

## 快速索引

| 分类 | 命令 | 说明 |
|------|------|------|
| **workspace-project** | `workspace-project list` | 列出所有项目 |
| | `workspace-project onboard <id>` | 项目接管简报 |
| | `workspace-project handoff-check <id>` | 验证 handoff 状态 |
| | `workspace-project validate` | 验证图一致性 |
| | `workspace-project route-intent` | 项目创建路由 |
| **devsvc** | `devsvc status` | 服务状态 |
| | `devsvc start <profile>` | 启动服务 |
| | `devsvc stop <profile>` | 停止服务 |
| | `devsvc domain status` | 域名路由状态 |
| **make** | `make doctor` | 全套检查 |
| | `make audit` | 完整审计 |
| | `make ci` | 快速验证 |
| | `make sync-agent-guidance` | 同步 agent 指南 |
