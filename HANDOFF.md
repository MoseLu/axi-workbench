# Axi Workbench HANDOFF

> 当前接力文档。记录当前活跃工作区状态、命令、契约、故障排查与时效。

最后更新: 2026-09-15 (CL-019)

---

## Commit Ledger state

### 状态
- **整体**: partial — 本地集成完成 (CL-014/015/017), CL-018 执行与 CL-020 最终验收待运行
- **最后验证**: 2026-09-15 (CL-019 docs sync)

### 已交付 (canonical paths)
- Schema: `packages/commit-ledger-schema/schema.json`
- Core modules: `services/control-plane/src/commit-ledger/{collect-all,evidence-linker,ingestion,persistence,api-routes,api-handlers}.{mjs,ts}`
- Gateway routes: `services/api-gateway/config/routes.yaml:301-363` (7 routes with RequireIdentity)
- OpenAPI: `services/control-plane/openapi/commit-ledger.v1.yaml`
- Web UI: `apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx` + `useCommitLedger.ts`
- Web route: `apps/workbench/src/lib/navigationRegistry.ts:82,133`

### 待执行
- CL-018: `node --test services/control-plane/src/commit-ledger/integration.test.ts` (694 lines)
- CL-020: 最终集成审查 (依赖 CL-018)

### External gates (BLOCKED)
- 生产数据库迁移
- 生产部署
- 公网 OIDC

### Rollback
```bash
rm -rf services/control-plane/src/commit-ledger/
rm -rf apps/workbench/src/pages/commit-ledger/
rm -rf packages/commit-ledger-schema/
rm docs/commit-ledger-*.md
```

### 详细文档
- `docs/commit-ledger-status.md` — 任务状态分级
- `docs/commit-ledger-verification.md` — 验收矩阵
- `docs/commit-ledger-final-report.md` — 最终验收报告
- `docs/commit-ledger-architecture.md` — 架构决策

---

## 活跃工作区 (待补充)

参见 `docs/state/CHANGELOG.md` 获取完整历史变更。
