<!-- OMX:AGENTS-INIT:MANAGED -->
<!-- Parent: ../AGENTS.md -->
# services

`services/` 是 Axi Workbench 的后端平面集合，按"业务 HTTP 流量"和"工作台控制面"两种职责切分。

浏览器与外部调用方只通过 **业务 API 网关**（`api-gateway`，host 端口 `18088`）这一个入口访问业务能力；工作台控制面（`control-plane` + `communication-gateway`）走独立端口，承担 IM / AgentTask / 审计等六层控制面职责；其余目录是迁移期残留，不再进生产路径。

This AGENTS.md scopes guidance to `services`. Parent AGENTS guidance still applies unless this file narrows it for this subtree.

## Bootstrap Guardrails

- Refresh updates the layout summary below and preserves the manual notes block.
- Keep only directory-specific guidance here; do not duplicate the root orchestration brain.
- 业务平面六个服务的端口是**事实**，不要随意调换；`api-gateway/config/routes.yaml` 与 `config/config.go` 的 `ServicesConfig` 必须与之对齐。
- 控制面两个服务（`control-plane`、`communication-gateway`）**绕过业务网关**，不要在 `api-gateway/routes.yaml` 给它们加代理。
- 迁移期残留服务（`auth-service` / `core-service` / `resource-gateway`）已不再进生产路径，**禁止新增依赖**。

## Architecture At A Glance

```
浏览器 / 移动端 / 桌面端
        │
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │  业务 API 平面（单入口 18088，类 Spring Cloud Gateway）  │
 │                                                         │
 │   api-gateway  ─►  identity-adapter   (8081)            │
 │      ▲           ─►  platform-core     (8082)            │
 │      │           ─►  workflow-engine   (8083)            │
 │   host:18088     ─►  notification-service (8084)         │
 │      │           ─►  file-service      (8085)            │
 │      │                                                 │
 └──────┼──────────────────────────────────────────────────┘
        │  (不走业务网关，直连客户端；IM / AgentTask / 审计)
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │  工作台控制面（六层控制面，独立栈）                       │
 │                                                         │
 │   control-plane          (8092) — 软件层                │
 │   communication-gateway  (8093) — 通信层                │
 │                                                         │
 └─────────────────────────────────────────────────────────┘
```

> **业务平面六个容器只在容器网络内暴露端口**；host 上只有 `api-gateway:18088` 一个出口。
> 容器编排见 [`docker-compose.backend.yml`](../docker-compose.backend.yml)；本地 dev 见 `Makefile` 的 `dev-gateway / dev-identity / dev-platform / dev-control-plane / dev-auth / dev-core / dev-workflow / dev-file / dev-notification`。
> 控制面绕过 `api-gateway` 直连客户端是六层控制面模型的有意分离 — 详见 [`docs/rules/epap-six-layer-sop.md`](../docs/rules/epap-six-layer-sop.md)。

## Current Layout

### 业务 API 平面（生产路径）

| 服务 | 语言 | 容器内端口 | 角色 | 被谁调用 |
|---|---|---|---|---|
| [`api-gateway/`](api-gateway/) | Go (Gin) | 8080 → host 18088 | **唯一对外 HTTP 入口**。模仿 Spring Cloud Gateway 的 YAML 路由声明（`id / path / predicates / filters / handler`），详见 [`config/routes.yaml`](api-gateway/config/routes.yaml)；承担认证、会话、限流、审计、CORS、灰度。 | 浏览器 / 移动端 / 桌面端 |
| [`identity-adapter/`](identity-adapter/) | Go | 8081 | 身份与会话、OIDC / 邮件登录、设备配对、移动端 pairing。 | api-gateway |
| [`platform-core/`](platform-core/) | Go | 8082 | 租户、成员、profile、commit-ledger、字典。 | api-gateway |
| [`workflow-engine/`](workflow-engine/) | Python | 8083 | 工作流定义、实例、执行。 | api-gateway |
| [`notification-service/`](notification-service/) | Go | 8084 | 邮件投递 + SMTP 出站（含 dev 用 mailpit）。 | api-gateway |
| [`file-service/`](file-service/) | Python | 8085 | 文件存储（默认 local backend）。 | api-gateway |

### 工作台控制面（六层控制面，不走业务网关）

| 服务 | 语言 | 端口 | 角色 |
|---|---|---|---|
| [`control-plane/`](control-plane/) | Node.js | 8092 | 六层控制面"软件层"：`AgentTask` 编排、`IMEnvelope` 归一化、审计、workspace graph 投影、注册动作合约。其 README 顶部有"Six-layer ownership declaration"，改动前必读。 |
| [`communication-gateway/`](communication-gateway/) | TypeScript | 8093 (`COMMUNICATION_GATEWAY_PORT`) | 六层控制面"通信层"：IM 路由、配对、审批、附件引用、幂等、回执、cc-connect / Feishu / WeChat / MossCoder 适配。**不得**读取工作区状态、调用 agent 或执行 shell。 |

### 迁移期残留（不进生产路径）

| 服务 | 语言 | 状态 | 说明 |
|---|---|---|---|
| [`auth-service/`](auth-service/) | Go | `STATUS: legacy` | 旧 Go 认证服务；`Makefile` 仍保留 `dev-auth` / `migrate-auth` 入口，但已被 `identity-adapter` 替代。**禁止新增依赖**。 |
| [`core-service/`](core-service/) | Java (Spring Boot / Maven, `pom.xml`) | `STATUS: legacy` | 旧 Java Spring 业务核心；`Makefile` 保留 `dev-core`（`./gradlew bootRun`）+ `migrate-core`（flyway）入口以便老数据查询，**不参与生产路径**。 |
| [`resource-gateway/`](resource-gateway/) | TypeScript | `STATUS: legacy` | 旧 `@axi/resource-*` 资源网关组件，依赖 `@axi/gateway-contracts` / `@axi/resource-orchestrator` 等；不在 `package.json` / `Makefile` / `docker-compose` 任何工作区引用里，纯粹孤立目录。 |

> 这三个目录保留只为兼容老数据和老脚本；它们**不是**当前 Workbench 业务后端的组成部分。
> **"Java Spring 网关中心"的疑虑来源**：`core-service` 目录名 + `pom.xml` + `target/` 让人以为它是网关 — 它其实是 Java Spring **业务服务**；当下的网关是 `api-gateway`（Go + Gin + 类 Spring Cloud Gateway 风格的 YAML 路由）。

## 修改指引

- **改 `api-gateway/routes.yaml`**：本地 dev 用 `make dev-gateway`；容器内热加载；不用改容器编排。
- **改某个业务服务的端口**：必须同步改 `docker-compose.backend.yml` 对应 `*_PORT` 环境变量 + `services/api-gateway/config/config.go` 的 `ServicesConfig` 对应 ENV 注入。
- **改控制面**：先读 [`docs/rules/epap-six-layer-sop.md`](../docs/rules/epap-six-layer-sop.md)，再读该服务 README 的"六层归属声明"；改动必须保留入口 / 权威 / 下游 / 渲染 / 审计 / 验证六项。
- **改残留服务**：建议直接删除而不是修改；若必须改，先在根 `AGENTS.md` 提一条 ADR 说明保留理由。
- **新增服务**：先在根 `AGENTS.md` 提一条 ADR，明确属于哪一层（业务平面 / 控制面 / 物理服务层 / 外接能力层）；不要直接塞进 `services/`。

## 验证入口

```bash
# 业务网关健康检查（生产路径唯一对外入口）
curl http://127.0.0.1:18088/health

# 控制面健康检查
curl http://127.0.0.1:8092/health          # control-plane
curl http://127.0.0.1:8093/health          # communication-gateway

# 业务平面六容器一键拉起（生产形态）
make docker-backend

# 业务网关本地 dev
make dev-gateway

# 业务平面六服务本地 dev（按需）
make dev-identity dev-platform dev-workflow dev-file dev-notification
```

<!-- OMX:AGENTS-INIT:MANUAL:START -->
## Local Notes

- 2026-09-26：重写脚手架为分层结构（业务平面 / 控制面 / 残留），原 OMX 自动生成内容已替换为人工维护版本；OMX 再生成时应保留本块。引入"业务平面唯一对外入口 18088"作为新人阅读锚点；显式说明 `core-service` 不是网关（消除"Java Spring 网关中心"疑虑）；标记 `auth-service` / `core-service` / `resource-gateway` 为 `STATUS: legacy`。
<!-- OMX:AGENTS-INIT:MANUAL:END -->