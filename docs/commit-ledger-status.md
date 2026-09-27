# Commit Ledger 实现状态

> 最后更新: 2026-09-25 (CL-019 follow-up: scheduler wiring)
> 证据来源: 代码 + routes.yaml + navigationRegistry.ts + 模块文件存在性

## 状态分级

| 任务 | 状态 | 说明 / 证据 |
|------|------|------|
| CL-001 | module_verified | workspace 盘点完成 (`.claude/clog-run/CL-001-report.json`) |
| CL-002~006 | module_verified | 仓库盘点完成 (`.claude/clog-run/CL-002~006-report.json`) |
| CL-007 | module_verified | 架构决策完成 (`docs/commit-ledger-architecture.md`) |
| CL-008 | module_verified | Schema 存在 (`packages/commit-ledger-schema/schema.json`) |
| CL-009 | module_verified | Collector 存在, 22 repos/5311 commits (`services/control-plane/src/commit-ledger/collect-all.mjs`) |
| CL-010 | module_verified | Evidence linker 存在 (`services/control-plane/src/commit-ledger/evidence-linker.mjs`) |
| CL-011 | module_verified | Ingestion 存在 (`services/control-plane/src/commit-ledger/ingestion.mjs`) |
| CL-012 | module_verified | 幂等测试通过 (`persistence.test.ts` 356 lines) |
| CL-013 | module_verified | 7 API routes defined (`api-routes.mjs`, `api-handlers.ts`) |
| CL-014 | **integration_verified** | Gateway 7 路由已注册 + 真实 HTTP 测试 200 (`routes.yaml:301-363`, `cl-018-evidence.json` step 4) |
| CL-015 | **module_verified** | OpenAPI spec 与实际路由对齐 (`services/control-plane/openapi/commit-ledger.v1.yaml`) |
| CL-016 | module_verified | UI page 存在 (`apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx`) |
| CL-017 | **integration_verified** | Web 路由 + 导航注册 + UI test 写入 (`apps/workbench/src/App.tsx:94`, `CommitLedgerPage.test.tsx`) |
| CL-018 | **integration_verified** | E2E 6/6 PASS (`.claude/clog-run/final-phase/cl-018-evidence.json`) |
| CL-019 | **module_verified** | 本文档已根据实际证据更新 |
| CL-019b | **integration_verified** | Scheduler (`scheduler.mjs`) 接线完成，server.mjs 启动即触发 + 每 15 min 周期同步；end-to-end 验证从 874/13 → 6,361/36 (`server.mjs:1162-1187`, `scheduler.mjs`, `scheduler.test.ts` 9/9) |
| CL-020 | pending | 最终集成审查待发布 |

## 本地 Todo (非 external gate)

所有本地集成任务已完成 (CL-014, CL-015, CL-017)。

## 剩余本地验证

- CL-018: 运行 `integration.test.ts` 并收集证据
- CL-020: 最终集成审查（依赖 CL-018 证据）

## External Gates (已阻塞)

- 生产数据库迁移
- 生产部署
- 公网 OIDC
