# Axi Workbench PRD

> This root file is a **builder-friendly stub**. The canonical PRD lives at
> [`docs/state/PRD.md`](./docs/state/PRD.md). This stub exists so that the
> Axi Docs `build-projects-index.mjs` script can discover the PRD at the
> project root via `project.path + piece` resolution.
> See `scripts/build-projects-index.mjs` in `axi-docs` and `WORKSPACE_INDEX.md`
> for the source-of-truth governance.

The current PRD carries 14 `REQ-*` rows covering documentation suite,
verification commands, boundary SOP, the six-layer control plane, the
**two-app workbench entrance** (`apps/workbench` for Web + `apps/workbench-mobile` for
mobile), milestone/log governance, Axi Coder contract cleanup, and the
mobile shell as an independent application.

- Canonical source: [`docs/state/PRD.md`](./docs/state/PRD.md)
- Last refreshed: 2026-09-17
- Owner: Axi Core Projects

## Quick Reference

### 项目定位
Axi Workbench（中文：Axi 工作台）是 AxiomaticWorld 产品线的本地工作站控制面，提供：
- Web 管理控制中心（`apps/workbench`）
- 移动端角色执行端（`apps/workbench-mobile`）
- 本地服务 Host（`apps/devsvc-dashboard`）
- 六层控制面架构

### 核心模块
| 模块 | 路径 | 说明 |
|------|------|------|
| Web 管理端 | `apps/workbench` | 唯一 Web 管理控制中心 |
| 移动端 | `apps/workbench-mobile` | Web + 原生 Android |
| API Gateway | `services/api-gateway` | Go/Gin 唯一业务 API 入口 |
| Control Plane | `services/control-plane` | 控制平面编排 |

### 技术栈
- Frontend: React 18 + TypeScript + Vite + Turborepo
- Backend: Go/Gin + ZITADEL OIDC
- AI: LangChain, Qdrant, RAG
- Infrastructure: PostgreSQL, Redis, Kafka, MinIO

### 验证命令
```bash
pnpm type-check          # 整库类型检查
pnpm build              # 整库构建
pnpm test:workstation    # 控制面合同测试
pnpm check:boundaries   # 包边界检查
/Volumes/code/workspace/scripts/workspace-project validate  # 跨项目契约
```
