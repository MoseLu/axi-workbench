# API Gateway（Go + Rust 双实现）— 子项目 AGENTS

> 本文件管辖 `/Volumes/code/workspace/workbench/axi-workbench/services/api-gateway`。
> 父级 [`services/AGENTS.md`](../AGENTS.md) 与仓库根 [`AGENTS.md`](../../AGENTS.md) 仍然适用。
> **本目录是双语言包：Go（生产默认）+ Rust（ADR-017 迁移目标）**；两者边界见下，不要混改、不要只改一侧。

## 双包边界
| 实现 | 路径 | 状态 | 约束 |
|---|---|---|---|
| Go (Gin) | `cmd/` `handlers/` `middleware/` `config/` `identity/` `discovery/` `circuitbreaker/` `ratelimit/` `observability/` | **生产默认** | 唯一对外 HTTP 入口；容器 8080 → host 18088 |
| Rust (axum 0.7) | `src-rs/api-gateway-rs/` | 迁移目标（ADR-017 Stage 2） | 路由表 1:1 镜像 `config/routes.yaml`；429 / 401 / 503 等错误 envelope 与 Prometheus 指标名必须与 Go 一致；并行部署 opt-in |

**硬约束**：改 Go 路由 / 中间件语义时，若 Rust 侧已实现同名能力，必须同步 `src-rs` 镜像测试；反向亦然。不要只改一侧就宣称迁移对齐。

## 入口
- Go：`cmd/gateway/main.go`（+ `control_plane_routes.go`）。
- Rust：`src-rs/api-gateway-rs/src/bin/api-gateway.rs`（库根 `src/lib.rs`）。
- 路由声明：`config/routes.yaml`（Spring Cloud Gateway 风格 `id / path / predicates / filters / handler`）+ `config/config.go` 的 `ServicesConfig`；必须与 `services/AGENTS.md` 端口表对齐。
- 迁移文档：[`docs/HANDOFF.md`](docs/HANDOFF.md)、[`docs/adr/ADR-017-api-gateway-rust-migration.md`](docs/adr/ADR-017-api-gateway-rust-migration.md)。

## 关键命令
```bash
pnpm --filter @epap/api-gateway dev     # bash scripts/dev-run.sh（本地 dev；容器内 routes.yaml 热加载）
pnpm --filter @epap/api-gateway build   # go build -o bin/gateway ./cmd/gateway
pnpm --filter @epap/api-gateway test    # go test ./... && bash scripts/dev-run_test.sh
cd src-rs/api-gateway-rs && cargo check && cargo test   # Rust 侧（stage 2 状态：52/52 passing）
```

## 依赖与边界
- `go.work` 引用 `foundation/axi-observability/go/axilog`（跨仓）；业务上游为 `identity-adapter` (8081) 等六个业务服务。
- 控制面（`control-plane` / `communication-gateway`）**绕过**本网关；不要在 `routes.yaml` 给它们加代理。
- 改业务服务端口必须三处同步：`docker-compose.backend.yml` 的 `*_PORT`、`config/config.go` `ServicesConfig`、`config/routes.yaml`。
- 本包**不是** Java Spring 网关；`core-service` 的 `pom.xml` 是历史遗留，与网关无关。

## 已知违规（2026-10-15 实测，>600 行）
- Go：`identity/service_test.go` 1361、`cmd/gateway/main_test.go` 841、`identity/service.go` 816、`middleware/filter_test.go` 638。
- Rust：无 >600 行文件（`src-rs` 共 3031 行，`target/` 为构建产物不计）。

## 验证
- 最小：`pnpm --filter @epap/api-gateway test`；仅 Rust 改动跑 `cargo test`。
- 路由表改动：本地 `make dev-gateway` 冒烟 + 对齐 `services/AGENTS.md` 端口表。
