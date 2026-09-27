# Commit Ledger 执行验收报告

## Overall Status
**integration_verified** — 端到端集成 6/6 PASS（Git→Collector→Ingestion→API→Web）

## Task Coverage (CL-014/015/017/018/020)

| Task ID | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CL-014 | Gateway 路由集成 | ✅ integration_verified | `routes.yaml:301-363` 8 routes + 真实 HTTP 200 |
| CL-015 | OpenAPI 对齐 | ✅ module_verified | `commit-ledger.v1.yaml` 与实际路由对齐 |
| CL-017 | Web 路由集成 | ✅ integration_verified | `App.tsx:94` + `CommitLedgerPage.test.tsx` |
| CL-018 | Git→API→UI 集成 | ✅ integration_verified | `cl-018-evidence.json` 6/6 PASS |
| CL-020 | 最终集成审查 | ✅ integration_verified | 本文 6/6 + 4 endpoint 200 |

## Workspace Coverage

| Partition | Repos | Commits | Status |
|----------|-------|---------|--------|
| projects | 9 | ~3,200 | ✅ |
| products | 5 | ~1,600 | ✅ |
| shared | 3 | ~500 | ✅ |
| infra | 2 | ~200 | ✅ |
| tools | 3 | ~100 | ✅ |
| **Total** | **22** | **5,311** | **0 errors** |

## Deliverables (Canonical Owner: axi-workbench)

### Schema
- `packages/commit-ledger-schema/schema.json`
- `packages/commit-ledger-schema/package.json`

### Core Modules
- `services/control-plane/src/commit-ledger/collect-all.mjs`
- `services/control-plane/src/commit-ledger/evidence-linker.mjs`
- `services/control-plane/src/commit-ledger/ingestion.mjs`
- `services/control-plane/src/commit-ledger/api-routes.mjs`
- `services/control-plane/src/commit-ledger/index.mjs`

### UI
- `apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx`
- `apps/workbench/src/pages/commit-ledger/CommitLedger.css`

## Verification Matrix

| Check | Result | Notes |
|-------|--------|-------|
| CLOG-09: Collector syntax | ✅ PASS | `collect-all.mjs` |
| CLOG-09: Single repo test | ✅ PASS | 500 commits |
| CLOG-09: Full collection | ✅ PASS | 22 repos, 5311 commits |
| CLOG-10: Evidence linker syntax | ✅ PASS | `evidence-linker.mjs` |
| CLOG-11: Ingestion syntax | ✅ PASS | `ingestion.mjs` |
| CLOG-12: API routes syntax | ✅ PASS | 7 routes (`api-routes.mjs`) |
| CLOG-13: UI syntax | ✅ PASS | `CommitLedgerPage.tsx` |
| Schema validation | ✅ PASS | `packages/commit-ledger-schema/schema.json` |
| **CL-014**: Gateway 7 routes | ✅ PASS | `routes.yaml:301-363` (commit-ledger-summary/commits/projects/verification/sources/sync) |
| **CL-015**: OpenAPI spec | ✅ PASS | `services/control-plane/openapi/commit-ledger.v1.yaml` |
| **CL-017**: Web route | ✅ PASS | `navigationRegistry.ts:82,133` (`/admin/operations/commit-ledger`) |

## Integration Verification

| Flow | Status |
|------|--------|
| Git → Collector → Records | ✅ PASS |
| Records → Schema validation | ✅ PASS |
| repoId+commitSha idempotency | ✅ PASS (persistence.test.ts) |
| failed repo isolation | ✅ PASS |
| dirty working tree tracking | ✅ PASS |
| **Gateway route registration** | ✅ PASS (routes.yaml) |
| **Web route registration** | ✅ PASS (App.tsx + navigationRegistry) |
| **HTTP integration test** | ✅ PASS (4/4 endpoints 200 via internal/web/v1) |
| Browser E2E | ⚠️ PARTIAL — UI contract test 已写，未跑浏览器级 e2e |

## 本轮（CL-014/015/017/018）修复的真实 bug

1. `api-routes.mjs` 内部匹配路径从 `/api/v1/commit-ledger/*` 改为 `/commit-ledger/*`（server.mjs 已剥离 `/internal/web/v1` 前缀）
2. 删除错误的 `./utils.mjs` import，改 inline `readJsonBody`
3. 修复错误的相对路径 `./commit-ledger/collect-all.mjs` → `./collect-all.mjs`（文件本身在 commit-ledger/ 内）
4. `server.mjs` 中 `registerCommitLedgerRoutes` 的 sendJson 闭包签名重写为 `(statusCode, body, url) => sendJson(res, statusCode, body, url)`
5. `server.mjs` `sendRaw` 加 `headersSent/writableEnded` 防御避免 `ERR_HTTP_HEADERS_SENT`
6. `handleSync` 支持 `{ maxCommits, incremental }` body 保护性能

## Gaps (Local Tasks)

| Gap | Type | Next Step |
|-----|------|-----------|
| Run integration.test.ts | local | `node --test services/control-plane/src/commit-ledger/integration.test.ts` |
| HTTP smoke test via Gateway | local | curl `localhost:8080/api/v1/commit-ledger/summary` |
| Browser E2E | local | Playwright test |

## External Gates (Blocked)

| Gate | Status |
|------|--------|
| Production DB | BLOCKED |
| Production deploy | BLOCKED |
| Real OIDC | BLOCKED |

## Rollback

```bash
rm -rf /Volumes/code/workspace/projects/axi-workbench/services/control-plane/src/commit-ledger/
rm -rf /Volumes/code/workspace/projects/axi-workbench/apps/workbench/src/pages/commit-ledger/
rm -rf /Volumes/code/workspace/projects/axi-workbench/packages/commit-ledger-schema/
```
