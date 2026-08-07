# 第四章 后端服务层详细设计

## 4.0 当前生产实现（2026-08）

以 [`ADR-0001`](./adr/0001-zitadel-gin-platform-core.md) 为准，当前后端不是重写成另一套 Gin，而是将已有 Go 网关演进为身份、平台核心和专职能力三类明确边界：

| 边界 | 当前实现 | 生产职责 |
|---|---|---|
| API Gateway | `services/api-gateway`（Go + Gin） | 唯一 `/api/v1` 入口、ZITADEL JWKS 校验、授权码 + PKCE、HttpOnly 会话、Redis 限流、请求/追踪/审计关联、安全转发 |
| Axi Identity | `services/identity-adapter`（Go + Gin） + ZITADEL | 邮箱验证、短期 Redis 扫码事务、ZITADEL custom-login 续接、EPS 外部主体映射；不手写 JWT Issuer |
| Platform Core | `services/platform-core`（Go + Gin） | 租户、成员/RBAC、偏好、字典、项目、任务、Outbox；PostgreSQL schema、`tenant_id` 与强制 RLS |
| Workflow Engine | `services/workflow-engine`（Python + FastAPI） | 仅接受 gateway 可信请求；工作流定义、执行认领、Outbox event inbox、租约派发与执行结果进入 PostgreSQL；worker 支持并发领取、退避重试和重启恢复 |
| Notification Service | `services/notification-service`（Go + Gin） | 仅接受 gateway 可信请求；通知收件箱、delivery jobs 与 event inbox 进入 PostgreSQL；SMTP 适配器、重启可恢复 worker 和 Outbox 幂等消费已接入 |
| File Service | `services/file-service`（Python + FastAPI） | 仅接受 gateway 可信请求；生产使用 S3/MinIO 对象 + PostgreSQL 元数据并按 subject 隔离，上传流计算 SHA-256，写对象前可经 ClamAV INSTREAM 扫描，图片生成受尺寸约束的 WebP 缩略图；开发保留本地存储降级 |

关键约束：

- Web 和移动端是独立应用，当前浏览器交付共享 gateway BFF 的 Authorization Code + PKCE 身份合同，而不共享 UI 壳。生产构建必须显式指向同一 HTTPS VITE_API_BASE_URL；EPS 使用独立 PKCE client。
- Bearer token 必须通过 ZITADEL JWKS、配置的 API audience 与全部所需 scope 校验；浏览器 ID Token 不能替代业务 API access token。
- QR 轮询只返回状态，审批后由一次性 resume 事务进入 ZITADEL；任何 QR 接口不返回 JWT 或 OIDC code。
- ZITADEL 的 QR completion 仅经 gateway 的 /api/v1/internal/zitadel/... 反向代理进入 ClusterIP identity-adapter，并额外校验 webhook secret。
- Outbox 采用至少一次投递；五分钟租约、指数退避、第十次失败死信标记和 X-Axi-Event-ID 共同构成消费者幂等契约。
- Platform Core 的 Outbox 只配置一个 Gateway 内部投递 URL；Gateway 用独立的 `GATEWAY_PLATFORM_OUTBOX_TOKEN` 校验平台 worker，再用各专职服务凭据扇出到 notification/workflow。两个消费者都把事件 ID 写入自己的 `event_inbox` 后才返回成功。
- 运行时 `axi_platform_app` 是 `NOBYPASSRLS`；只有 pre-install/pre-upgrade migration Job 的专用账号拥有 `BYPASSRLS`，从而让 `SECURITY DEFINER` 的 RLS helper 可工作而不泄露运行时权限。
- `auth-service` 和 Spring/H2 `core-service` 是迁移兼容来源；网关只会在显式配置时向它们开放只读旧路径，生产 Chart 不部署它们。
- 三个专职服务已经进入 gateway/Helm 拓扑：workflow 与 notification 已具备 PostgreSQL schema、独立 migration Job、运行时账号、重启恢复和 Outbox event inbox 幂等边界；workflow 已具备匹配事件持久化、租约领取、指数退避、执行结果原子收敛、重启恢复、安全结构化条件表达式、步骤超时和有限并行编排，外部任务/审批适配器和 Kafka 适配仍待补；notification 已具备核心、工作流、文件与安全事件的代码模板 registry、收件箱、已读状态和 delivery worker。file 已具备 S3/MinIO 对象适配、PostgreSQL 元数据、SHA-256 完整性校验、迁移 Job、subject 隔离、短时预签名下载 URL、写入前 ClamAV INSTREAM 扫描适配和图片 WebP 缩略图派生对象；生产仍需在集群中接入 ClamAV、验证 Pillow 处理资源边界并完成故障演练后才可称为最终生产完成。

Go 单测、可选 PostgreSQL RLS 集成测试和 Helm Chart 位于各服务与 [`infra/helm`](../infra/helm/README.md)。以下内容为早期 EPAP 设计记录，不覆盖本节的当前边界。

## 4.1 api-gateway — Go + Gin

> **职责**：统一入口、流量路由、JWT 验证（调用 auth-service gRPC）、请求限流、链路追踪注入、响应日志。

### 目录结构

```
services/api-gateway/
├── cmd/gateway/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go           # viper 配置加载（支持 env 和 yaml）
│   ├── router/
│   │   ├── routes.go           # Gin 路由注册
│   │   └── groups.go           # 路由分组（/api/v1/...）
│   ├── middleware/
│   │   ├── auth.go             # JWT 验证（调用 auth-service gRPC）
│   │   ├── ratelimit.go        # Redis Token Bucket 限流
│   │   ├── cors.go             # CORS 配置
│   │   ├── logger.go           # zap 结构化请求日志
│   │   ├── tracing.go          # OpenTelemetry 链路追踪注入
│   │   └── recovery.go         # panic 恢复中间件
│   ├── proxy/
│   │   └── reverse_proxy.go    # 反向代理（含 Header 注入）
│   ├── grpc/
│   │   └── auth_client.go      # auth-service gRPC 客户端（连接池）
│   ├── health/
│   │   └── handler.go          # /health 和 /ready 端点
│   └── metrics/
│       └── prometheus.go       # /metrics 端点
├── pkg/
│   ├── response/               # 统一响应格式 { code, message, data }
│   └── errors/                 # 错误码定义（业务错误码）
├── go.mod
├── go.sum
└── Dockerfile
```

### 路由规划

| 路径前缀 | 代理目标 | 认证 |
|---------|---------|------|
| `/api/v1/auth/**` | auth-service:8081 | 部分需要 |
| `/api/v1/projects/**` | core-service:8082 | ✅ 必须 |
| `/api/v1/tasks/**` | core-service:8082 | ✅ 必须 |
| `/api/v1/workflows/**` | workflow-engine:8083 | ✅ 必须 |
| `/api/v1/notifications/**` | notification-service:8084 | ✅ 必须 |
| `/api/v1/files/**` | file-service:8085 | ✅ 必须 |
| `/api/v1/kb/**` | knowledge-base:8090 | ✅ 必须 |
| `/api/v1/agents/**` | agent-platform:8091 | ✅ 必须 |
| `/health` | 本地处理 | ❌ 不需要 |
| `/metrics` | 本地处理 | IP 白名单 |

### 中间件链

```
请求进入
  └── recovery (panic 保护)
      └── tracing (注入 trace-id)
          └── logger (记录请求日志)
              └── cors (跨域头)
                  └── ratelimit (限流检查)
                      └── auth (JWT 验证)
                          └── reverse_proxy (代理到后端)
```

---

## 4.2 auth-service — Go + JWT + OAuth2

> **职责**：用户注册/登录、JWT 签发与刷新、OAuth2（GitHub/Google）、RBAC 权限检查、Token 黑名单（Redis）、gRPC 接口供 api-gateway 调用。

### 目录结构

```
services/auth-service/
├── cmd/authserver/
│   └── main.go               # HTTP (8081) + gRPC (9081) 双服务启动
├── internal/
│   ├── config/
│   ├── domain/
│   │   ├── user.go           # User 领域模型（含业务方法）
│   │   └── token.go          # Token 值对象
│   ├── service/
│   │   ├── auth_service.go   # 注册/登录/登出核心逻辑
│   │   ├── jwt_service.go    # JWT 签发/验证/刷新
│   │   └── oauth_service.go  # GitHub / Google OAuth2 对接
│   ├── repository/
│   │   └── user_repo.go      # PostgreSQL CRUD（pgx 驱动）
│   ├── cache/
│   │   └── token_cache.go    # Redis Token 黑名单（SET with TTL）
│   ├── handler/
│   │   ├── http/
│   │   │   └── auth_handler.go   # REST 接口（注册/登录/刷新/登出）
│   │   └── grpc/
│   │       └── auth_servicer.go  # gRPC ValidateToken / GetPermissions
│   └── proto/                # 生成的 protobuf Go 代码
├── proto/
│   └── auth.proto            # 服务定义
├── migrations/               # Goose 数据库迁移脚本
├── go.mod
└── Dockerfile
```

### proto/auth.proto

```protobuf
syntax = "proto3";
package auth.v1;

service AuthService {
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc GetUserPermissions(GetPermissionsRequest) returns (GetPermissionsResponse);
}

message ValidateTokenRequest {
  string token = 1;
}

message ValidateTokenResponse {
  bool valid = 1;
  string user_id = 2;
  repeated string roles = 3;
  repeated string permissions = 4;
}
```

### Token 设计

| Token 类型 | 设计方案 |
|-----------|---------|
| Access Token | JWT，有效期 15 分钟，载荷含 user_id / roles / permissions |
| Refresh Token | UUID，存入 PostgreSQL，有效期 7 天，可主动撤销 |
| 黑名单 | 已登出的 Access Token 写入 Redis，TTL = 剩余有效期 |
| 密码哈希 | bcrypt，cost = 12 |

### REST 接口

| Method | 路径 | 说明 |
|--------|------|------|
| POST | `/auth/register` | 用户注册 |
| POST | `/auth/login` | 账密登录，返回 AT + RT |
| POST | `/auth/refresh` | 刷新 Access Token |
| POST | `/auth/logout` | 登出（Token 加入黑名单） |
| GET | `/auth/oauth/github` | GitHub OAuth2 重定向 |
| GET | `/auth/oauth/callback` | OAuth2 Callback 处理 |
| GET | `/auth/me` | 获取当前用户信息 |

---

## 4.3 core-service — Java 21 + Spring Boot 3

> **职责**：核心业务领域逻辑。项目管理、任务管理、团队成员、评论、标签。采用 DDD 分层架构，通过 Kafka 发布领域事件。

### 目录结构

```
services/core-service/
├── src/main/java/com/eap/core/
│   ├── domain/                           # 领域层（纯 Java，无框架依赖）
│   │   ├── project/
│   │   │   ├── Project.java              # 聚合根（含业务方法）
│   │   │   ├── ProjectId.java            # 值对象
│   │   │   ├── ProjectStatus.java        # 枚举
│   │   │   └── ProjectRepository.java    # 仓储接口（非 Spring Data）
│   │   ├── task/
│   │   │   ├── Task.java                 # 聚合根
│   │   │   ├── TaskId.java
│   │   │   ├── TaskStatus.java
│   │   │   ├── TaskPriority.java
│   │   │   └── TaskRepository.java
│   │   └── user/
│   │       └── UserRef.java              # 用户引用值对象（非用户聚合）
│   │
│   ├── application/                      # 应用层（用例编排，无领域逻辑）
│   │   ├── project/
│   │   │   ├── ProjectApplicationService.java
│   │   │   ├── commands/
│   │   │   │   ├── CreateProjectCommand.java
│   │   │   │   ├── UpdateProjectCommand.java
│   │   │   │   └── DeleteProjectCommand.java
│   │   │   └── queries/
│   │   │       ├── GetProjectQuery.java
│   │   │       └── ListProjectsQuery.java
│   │   └── task/
│   │       ├── TaskApplicationService.java
│   │       └── commands/...
│   │
│   ├── infrastructure/                   # 基础设施层
│   │   ├── persistence/
│   │   │   ├── ProjectJpaRepository.java # Spring Data JPA
│   │   │   ├── TaskJpaRepository.java
│   │   │   └── entity/
│   │   │       ├── ProjectEntity.java    # JPA @Entity（与领域模型分离）
│   │   │       └── TaskEntity.java
│   │   ├── mapper/                       # 领域对象 <-> JPA Entity 转换
│   │   ├── kafka/
│   │   │   └── DomainEventPublisher.java # 领域事件发布
│   │   └── cache/
│   │       └── ProjectCacheService.java  # Redis 缓存
│   │
│   └── interfaces/                       # 接口层
│       ├── rest/
│       │   ├── ProjectController.java    # @RestController
│       │   ├── TaskController.java
│       │   ├── dto/                      # Request/Response DTO（与领域模型解耦）
│       │   └── GlobalExceptionHandler.java  # @ControllerAdvice
│       └── events/
│           └── ExternalEventConsumer.java   # Kafka 消费者（接收外部事件）
│
├── src/main/resources/
│   ├── application.yml              # 基础配置
│   ├── application-local.yml
│   ├── application-prod.yml
│   └── db/migration/                # Flyway 迁移脚本
│       ├── V1__create_projects.sql
│       ├── V2__create_tasks.sql
│       └── V3__create_indexes.sql
│
├── build.gradle.kts
└── Dockerfile
```

### 主要 API

| Method | 路径 | 说明 |
|--------|------|------|
| GET | `/projects` | 分页查询项目列表（支持 status/name/owner 过滤） |
| POST | `/projects` | 创建项目 |
| GET | `/projects/{id}` | 查询项目详情 |
| PUT | `/projects/{id}` | 更新项目 |
| DELETE | `/projects/{id}` | 软删除项目 |
| GET | `/projects/{id}/tasks` | 查询项目下任务（支持看板/列表视图参数） |
| POST | `/projects/{id}/tasks` | 创建任务 |
| PUT | `/tasks/{id}` | 更新任务（状态/描述/优先级） |
| POST | `/tasks/{id}/assign` | 分配任务给成员 |
| GET | `/users/me/tasks` | 我的任务列表 |
| GET | `/projects/{id}/members` | 项目成员列表 |
| POST | `/projects/{id}/members` | 添加成员 |

### 领域事件

| 事件 | Kafka Topic | 触发时机 |
|------|------------|---------|
| `ProjectCreatedEvent` | `project.created` | 项目创建成功 |
| `ProjectStatusChangedEvent` | `project.updated` | 项目状态变更 |
| `TaskAssignedEvent` | `task.assigned` | 任务分配 |
| `TaskCompletedEvent` | `task.completed` | 任务完成 |
| `TaskStatusChangedEvent` | `task.updated` | 任务状态变更 |

---

## 4.4 workflow-engine — Python + FastAPI + Celery

> **职责**：工作流定义、实例管理与执行调度。支持 DAG 型工作流，步骤类型包括 HTTP 调用、脚本执行、人工审批、AI Agent 任务等。

### 目录结构

```
services/workflow-engine/
├── src/
│   ├── api/
│   │   ├── main.py                     # FastAPI 应用入口
│   │   ├── routers/
│   │   │   ├── workflows.py            # 工作流 CRUD
│   │   │   └── instances.py            # 实例管理（触发/状态/日志）
│   │   └── deps.py                     # 依赖注入（DB Session, JWT 验证）
│   │
│   ├── engine/
│   │   ├── dag.py                      # DAG 解析、拓扑排序、循环检测
│   │   ├── executor.py                 # 工作流主执行循环
│   │   ├── step_runner.py              # 步骤调度与结果处理
│   │   └── state_machine.py            # 实例状态转换（transitions 库）
│   │
│   ├── steps/                          # 步骤类型实现
│   │   ├── base.py                     # 步骤抽象基类（含 retry 逻辑）
│   │   ├── http_step.py                # HTTP 调用（含超时/重试/认证）
│   │   ├── script_step.py              # Python 脚本沙箱执行（restrictedpython）
│   │   ├── approval_step.py            # 人工审批（支持超时自动拒绝）
│   │   ├── agent_step.py               # 调用 agent-platform
│   │   ├── condition_step.py           # 条件分支（基于 JSONPath 表达式）
│   │   └── parallel_step.py            # 并行执行步骤组（asyncio.gather）
│   │
│   ├── tasks/                          # Celery 异步任务
│   │   ├── celery_app.py               # Celery 配置（Redis Broker + Backend）
│   │   └── workflow_tasks.py           # 步骤执行 Celery Task
│   │
│   ├── models/                         # SQLAlchemy 2 ORM 模型
│   │   ├── workflow_def.py             # WorkflowDefinition
│   │   └── workflow_instance.py        # WorkflowInstance, StepExecution
│   │
│   └── events/
│       └── kafka_consumer.py           # 消费 core-service 事件（触发工作流）
│
├── alembic/                            # 数据库迁移
│   └── versions/
├── pyproject.toml                      # uv 管理依赖
└── Dockerfile
```

### 工作流 DAG JSON 格式

```json
{
  "id": "deploy-pipeline",
  "name": "代码部署流水线",
  "steps": [
    {
      "id": "code-review",
      "type": "agent",
      "name": "AI Code Review",
      "config": { "agent_type": "review_agent" },
      "next": ["security-scan"]
    },
    {
      "id": "security-scan",
      "type": "http",
      "name": "安全扫描",
      "config": { "url": "http://scanner/scan", "method": "POST" },
      "next": ["approval"]
    },
    {
      "id": "approval",
      "type": "approval",
      "name": "上线审批",
      "config": { "approvers": ["@tech-lead"], "timeout_hours": 24 },
      "next": ["deploy"]
    },
    {
      "id": "deploy",
      "type": "http",
      "name": "触发部署",
      "config": { "url": "http://deploy-service/deploy", "method": "POST" }
    }
  ]
}
```

### 实例状态机

```
PENDING → PLANNING → RUNNING → COMPLETED
              │           │
              │           └──→ FAILED
              │
              └──→ CANCELLED
```

---

## 4.5 notification-service — Go + Kafka

> **职责**：消费 Kafka 领域事件，将通知分发到邮件、站内信、Webhook 等多个渠道。

### 目录结构

```
services/notification-service/
├── cmd/notifyserver/
│   └── main.go
├── internal/
│   ├── consumer/
│   │   └── event_handler.go    # Kafka Consumer（各 Topic 事件路由）
│   ├── dispatcher/
│   │   └── dispatcher.go       # 根据用户偏好选择通知渠道
│   ├── channel/
│   │   ├── email.go            # SMTP / SendGrid 邮件发送
│   │   ├── inapp.go            # 站内信（SSE 长连接管理器）
│   │   └── webhook.go          # 外部 Webhook 推送
│   ├── template/
│   │   └── renderer.go         # Go template 渲染通知内容
│   └── repository/
│       └── notification_repo.go # 通知记录持久化（PostgreSQL）
├── go.mod
└── Dockerfile
```

---

## 4.6 file-service — Python + S3

> **职责**：文件上传（分片/断点续传）、预签名 URL 下载、文件元数据管理、图片处理、PDF 文本提取。

### 目录结构

```
services/file-service/
├── src/
│   ├── api/
│   │   ├── main.py
│   │   └── routers/
│   │       ├── upload.py         # 分片上传 API（Multipart）
│   │       ├── download.py       # 预签名 URL 生成（TTL 15min）
│   │       └── metadata.py       # 文件元数据 CRUD
│   ├── storage/
│   │   └── s3_client.py          # boto3 封装（兼容 MinIO 和 AWS S3）
│   ├── processors/
│   │   ├── image_processor.py    # Pillow：压缩/缩略图/EXIF 清理
│   │   ├── pdf_processor.py      # PyMuPDF：文本提取，触发 KB 索引
│   │   └── virus_scanner.py      # ClamAV 接口封装
│   └── models/
│       └── file.py               # SQLAlchemy File 模型
├── pyproject.toml
└── Dockerfile
```

### 存储路径规范

```
S3 Bucket: eap-files
  /{tenant_id}/
    /projects/{project_id}/           # 项目文件
    /users/{user_id}/avatars/         # 用户头像
    /knowledge/{kb_id}/               # 知识库源文件
    /tmp/{upload_id}/                 # 分片上传临时文件
```

---

[← 上一章](./03-frontend.md) · [下一章：AI 能力层详细设计 →](./05-ai-layer.md)
