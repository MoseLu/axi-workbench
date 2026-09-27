# 第六章 基础设施与运维设计
## 6.0 当前可部署基线（2026-08）

当前实现不再使用本章后续示例中的泛化 `eap-*` Kubernetes 目录作为生产来源。可执行入口是 [`infra/helm/axi-workbench-platform`](../infra/helm/axi-workbench-platform)：

- NGINX Ingress + cert-manager 只把 `/api` 公开给 `api-gateway`；identity 与 platform Service 均为 ClusterIP。
- pre-install/pre-upgrade Helm Job 分别执行 identity 与 platform migration；运行时容器不自动迁移数据库。
- `axi_platform_app` 为 `NOBYPASSRLS`，迁移 Job 使用只存在于 Job Secret 的 `PLATFORM_MIGRATION_DATABASE_URL`；业务表均有 `tenant_id` 与 RLS。
- Runtime Secret 通过 External/Sealed Secret 注入 OIDC、Redis、PostgreSQL、SMTP、内部 token 和 ZITADEL webhook 密钥；真实值不进入 Chart 或前端。
- Chart 提供 PDB、非 root/read-only 容器、NetworkPolicy 和 OTLP/HTTP trace export；三项 Go 服务会继续 W3C `traceparent` 并在配置 Collector 时实际导出服务端 Span。本地 Compose 用 `scripts/init-db.sql` 创建开发数据库角色，Mailpit 用于 SMTP 集成验收。
- Web 与移动端为独立构建产物；生产分别注入同一 HTTPS VITE_API_BASE_URL，Gateway 只对精确白名单 Origin 允许带 cookie 的 CORS。ZITADEL QR 回调仍经 Gateway 转发，identity-adapter 不暴露 Ingress。
- ZITADEL 采用官方 Helm Chart，生产禁用 bundled PostgreSQL；参考 [`infra/helm/zitadel-values.example.yaml`](../infra/helm/zitadel-values.example.yaml) 与官方文档。

安装顺序、Secret 键、数据库角色和验收步骤见 [`infra/helm/README.md`](../infra/helm/README.md)。以下章节是保留的历史运维蓝图，不应覆盖本节。

## 6.1 本地开发环境 — Docker Compose

### docker-compose.yml（骨架）

```yaml
version: "3.9"

services:
  # ─── 数据库 ────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: eap
      POSTGRES_PASSWORD: eap_local
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./tools/scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U eap"]
      interval: 10s

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports: ["6379:6379"]

  qdrant:
    image: qdrant/qdrant:latest
    volumes: [qdrant_data:/qdrant/storage]
    ports: ["6333:6333", "6334:6334"]

  # ─── 消息队列 ──────────────────────────────────────
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      CLUSTER_ID: "MkU3OEVBNTcwNTJENDM2Qk"
    ports: ["9092:9092"]

  # ─── 对象存储 ──────────────────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio_data:/data]

  # ─── 监控 ──────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    volumes: [./infra/docker/prometheus.yml:/etc/prometheus/prometheus.yml]
    ports: ["9999:9090"]

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes: [./infra/docker/grafana/:/etc/grafana/provisioning/]
    ports: ["3001:3000"]

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports: ["16686:16686", "4317:4317"]

volumes:
  postgres_data:
  qdrant_data:
  minio_data:
```

### init-db.sql（多 database 初始化）

```sql
CREATE DATABASE auth_db;
CREATE DATABASE core_db;
CREATE DATABASE workflow_db;
CREATE DATABASE notification_db;
CREATE DATABASE file_db;
CREATE DATABASE knowledge_db;
CREATE DATABASE agent_db;
```

### Makefile 常用命令

```makefile
.PHONY: help dev infra-up infra-down build test clean gen-api db-reset db-seed

help:  ## 显示所有可用命令
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

infra-up:  ## 启动基础设施（不含业务服务）
	docker-compose up -d postgres redis qdrant kafka minio prometheus grafana jaeger
	./tools/scripts/wait-for-services.sh

infra-down:  ## 关闭基础设施
	docker-compose down

dev:  ## 启动所有服务（基础设施 + 前端热更新）
	$(MAKE) infra-up
	pnpm turbo dev

build:  ## 构建所有项目
	pnpm turbo build
	$(MAKE) -C services/api-gateway build
	$(MAKE) -C services/auth-service build
	./gradlew -p services/core-service build
	cd services/workflow-engine && uv run python -m pytest --co -q

test:  ## 运行全部测试
	pnpm turbo test
	$(MAKE) -C services/api-gateway test
	./gradlew -p services/core-service test
	cd services/workflow-engine && uv run pytest --cov
	cd ai/knowledge-base && uv run pytest --cov
	cd ai/agent-platform && uv run pytest --cov

gen-api:  ## 从 OpenAPI 生成 API Client
	./tools/scripts/gen-api-client.sh

db-reset:  ## 重置所有数据库
	docker-compose down -v postgres
	docker-compose up -d postgres
	sleep 3
	./tools/scripts/init-db.sh

db-seed:  ## 填充测试数据
	./tools/scripts/seed-data.sh

lint:  ## 运行全部 lint
	pnpm turbo lint
	$(MAKE) -C services/api-gateway lint
	cd services/workflow-engine && uv run ruff check .
	cd ai/knowledge-base && uv run ruff check .

clean:  ## 清理构建产物
	pnpm turbo clean
	find . -name "dist" -type d | xargs rm -rf
	find . -name "__pycache__" | xargs rm -rf
```

---

## 6.2 Kubernetes 部署架构

### Namespace 规划

| Namespace | 用途 |
|-----------|------|
| `eap-dev` | 开发环境，PR 自动部署预览 |
| `eap-staging` | 预发布，与生产同等配置 |
| `eap-prod` | 生产环境 |
| `eap-infra` | 共享基础设施（Kafka, Qdrant） |
| `eap-monitoring` | Prometheus, Grafana, Jaeger |
| `eap-ops` | ArgoCD, cert-manager, ESO |

### K8s 资源规划

```
infra/kubernetes/
├── base/
│   ├── api-gateway/
│   │   ├── deployment.yaml         # replicas: 2, resources limits
│   │   ├── service.yaml            # ClusterIP (内部) + LoadBalancer (外部)
│   │   ├── hpa.yaml                # CPU > 70% 触发扩容，max: 10
│   │   ├── pdb.yaml                # minAvailable: 1
│   │   └── kustomization.yaml
│   ├── auth-service/               # HTTP + gRPC 双 Service
│   ├── core-service/
│   ├── workflow-engine/            # API Deployment + CeleryWorker Deployment
│   ├── notification-service/
│   ├── file-service/
│   ├── knowledge-base/             # HTTP (:8090) + gRPC (:9090) 双端口
│   ├── agent-platform/
│   ├── configmaps/                 # 各服务的 ConfigMap
│   ├── ingress/
│   │   └── ingress.yaml            # nginx-ingress 路由规则
│   └── network-policies/           # 服务间通信白名单
├── overlays/
│   ├── dev/
│   │   └── kustomization.yaml      # replicas: 1, 资源 limit 更小
│   ├── staging/
│   │   └── kustomization.yaml      # replicas: 2
│   └── prod/
│       └── kustomization.yaml      # replicas: 3, PDB, 全量监控
└── charts/                         # Helm charts（第三方依赖）
    ├── postgresql/
    ├── redis/
    ├── kafka/
    └── qdrant/
```

### Deployment 模板（api-gateway 示例）

```yaml
# infra/kubernetes/base/api-gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    spec:
      containers:
        - name: api-gateway
          image: ghcr.io/your-org/eap-api-gateway:latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: api-gateway-config
            - secretRef:
                name: api-gateway-secrets
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
```

### HPA 配置

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## 6.3 CI/CD 流水线

### 前端 CI

```yaml
# .github/workflows/ci-frontend.yml
name: CI Frontend
on:
  pull_request:
    paths: ["apps/**", "packages/**"]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo type-check
      - run: pnpm turbo test -- --coverage
      - run: pnpm turbo build
      - uses: codecov/codecov-action@v4
```

### Go 服务 CI

```yaml
# .github/workflows/ci-backend-go.yml
name: CI Backend Go
on:
  pull_request:
    paths: ["services/api-gateway/**", "services/auth-service/**"]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache: true
      - name: Lint
        uses: golangci/golangci-lint-action@v6
      - name: Test
        run: |
          cd services/api-gateway && go test ./... -race -coverprofile=coverage.out
          cd services/auth-service && go test ./... -race -coverprofile=coverage.out
      - name: Build Docker
        run: |
          docker build services/api-gateway -t eap-api-gateway:ci
          docker build services/auth-service -t eap-auth-service:ci
```

### Java 服务 CI

```yaml
# .github/workflows/ci-backend-java.yml
name: CI Backend Java
on:
  pull_request:
    paths: ["services/core-service/**"]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: temurin
          cache: gradle
      - run: cd services/core-service && ./gradlew test jacocoTestReport
      - run: cd services/core-service && ./gradlew build -x test
```

### Python 服务 CI

```yaml
# .github/workflows/ci-backend-python.yml
name: CI Backend Python
on:
  pull_request:
    paths: ["services/workflow-engine/**", "services/file-service/**", "ai/**"]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - name: Lint & Type Check
        run: |
          cd services/workflow-engine
          uv run ruff check .
          uv run mypy .
      - name: Test
        run: |
          cd services/workflow-engine
          uv run pytest --cov --cov-report=xml
```

### 部署流水线

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production
on:
  workflow_dispatch:
    inputs:
      version:
        description: "版本 Tag（如 v1.2.3）"
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production          # 需要人工审批
    steps:
      - uses: actions/checkout@v4
      - name: Deploy with Kustomize
        run: |
          kustomize build infra/kubernetes/overlays/prod | kubectl apply -f -
      - name: Wait for rollout
        run: kubectl rollout status deployment/api-gateway -n eap-prod --timeout=5m
      - name: Smoke Test
        run: ./tools/scripts/smoke-test.sh
      - name: Rollback on failure
        if: failure()
        run: kubectl rollout undo deployment/api-gateway -n eap-prod
```

---

## 6.4 可观测性设计

### 三大支柱

| 支柱 | 工具 | 数据格式 | 保留策略 |
|------|------|---------|---------|
| 日志（Logs） | Loki + Grafana | JSON 结构化 | 30 天热存，90 天冷存 |
| 指标（Metrics） | Prometheus + Grafana | OpenMetrics | 15 天高精度，1 年降采样 |
| 链路追踪（Traces） | Jaeger (OTel Collector) | OpenTelemetry | 7 天 |

### 关键告警规则

```yaml
# infra/kubernetes/base/monitoring/alerts.yaml
groups:
  - name: api-gateway
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API Gateway 5xx 错误率超过 5%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 延迟超过 2s"

  - name: ai-services
    rules:
      - alert: LLMHighCost
        expr: increase(llm_token_usage_total[1h]) > 1000000
        labels:
          severity: warning
        annotations:
          summary: "过去 1 小时 Token 用量超过 100 万"

      - alert: KBSearchSlowDown
        expr: histogram_quantile(0.95, rate(kb_search_duration_seconds_bucket[5m])) > 3
        labels:
          severity: warning
```

### Prometheus Scrape 配置

```yaml
# infra/docker/prometheus.yml
scrape_configs:
  - job_name: api-gateway
    static_configs:
      - targets: ["api-gateway:8080"]
    metrics_path: /metrics

  - job_name: core-service
    static_configs:
      - targets: ["core-service:8082"]
    metrics_path: /actuator/prometheus

  - job_name: workflow-engine
    static_configs:
      - targets: ["workflow-engine:8083"]

  - job_name: knowledge-base
    static_configs:
      - targets: ["knowledge-base:8090"]

  - job_name: agent-platform
    static_configs:
      - targets: ["agent-platform:8091"]
```

---

## 6.5 安全设计

### 网络安全

```
Internet
   │
   ▼
CloudFlare WAF / AWS WAF
   │
   ▼
Kubernetes Ingress (nginx-ingress + TLS)
   │
   ▼
api-gateway (唯一对外入口)
   │
   ├── NetworkPolicy: 允许 → auth-service
   ├── NetworkPolicy: 允许 → core-service
   ├── NetworkPolicy: 允许 → workflow-engine
   ├── NetworkPolicy: 允许 → file-service
   ├── NetworkPolicy: 允许 → knowledge-base
   └── NetworkPolicy: 允许 → agent-platform

所有内部服务:
   - 拒绝来自 Internet 的直接访问
   - 只允许来自 api-gateway 的流量（NetworkPolicy）
   - 内部服务间按白名单通信
```

### 密钥管理

```
HashiCorp Vault
   │
   └── Vault Kubernetes Auth (Pod SA 自动认证)
           │
           └── External Secrets Operator
                   │
                   └── K8s Secrets（自动同步，定期轮换）
                           │
                           └── Pod 环境变量注入
```

### Secret 规范

```yaml
# 示例：ExternalSecret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-gateway-secrets
spec:
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: api-gateway-secrets
  data:
    - secretKey: JWT_SECRET
      remoteRef:
        key: secret/eap/api-gateway
        property: jwt_secret
```

### 安全 Checklist

- [x] 所有外部流量强制 HTTPS（HSTS Header）
- [x] CSP Header 防 XSS
- [x] CORS 白名单（仅允许已知域名）
- [x] JWT 有效期 15 分钟，Refresh Token 可撤销
- [x] Redis 黑名单防 Token 重放
- [x] 登录失败 5 次锁定 15 分钟（Redis 计数）
- [x] 所有输入参数化查询（禁止字符串拼接 SQL）
- [x] Pod Security Standard: Restricted
- [x] 容器以非 root 用户运行
- [x] 镜像 CI 中 Trivy 漏洞扫描
- [x] GitLeaks 防止密钥提交
- [x] 数据库连接强制 SSL
- [x] S3 桶默认私有，预签名 URL TTL 15 分钟
- [x] 敏感字段日志自动脱敏

---

## 6.6 Terraform 模块设计

```
infra/terraform/
├── main.tf                       # 入口（调用各模块）
├── variables.tf
├── outputs.tf
├── terraform.tfvars.example
├── backend.tf                    # Remote State（S3 + DynamoDB Lock）
│
└── modules/
    ├── k8s-cluster/              # EKS / GKE / AKS 集群
    │   ├── main.tf
    │   ├── node-groups.tf
    │   └── addons.tf             # cert-manager, nginx-ingress, ESO
    ├── database/                 # RDS PostgreSQL（Multi-AZ）
    ├── cache/                    # ElastiCache Redis（Cluster Mode）
    ├── storage/                  # S3 桶 + 生命周期规则
    ├── kafka/                    # MSK Kafka
    ├── qdrant/                   # EC2 自部署 Qdrant（或 Qdrant Cloud）
    └── monitoring/               # Prometheus + Grafana（托管或自建）
```

---

[← 上一章](./05-ai-layer.md) · [下一章：文档项目设计 →](./07-docs-project.md)
