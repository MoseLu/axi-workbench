# Axi Workbench TDD

## Architecture Assumptions

- Root path: `/Volumes/code/workspace/projects/axi-workbench`.
- Canonical user-app entrypoints: `apps/workbench/src/main.tsx` for the Web admin and `apps/workbench-mobile/src/main.tsx` for the mobile application. They are separate Vite applications, not two viewport branches of one SPA.
- Stack signals: Node ≥ 18, pnpm ≥ 8, TypeScript, Vite, Turborepo, Go, Java Spring Boot, Python FastAPI, LangChain, Qdrant, RAG.
- Six-layer control plane is enforced by `docs/rules/epap-six-layer-sop.md`. The TDD treats those boundaries as load-bearing and writes tests around them.
- Top-level layout:
  - `apps/`: 混合产品表面 — `workbench`（Web 后台主端）、`workbench-mobile`（移动辅助端）、`devsvc-dashboard`（Host/运维壳）以及若干 Hosted / 垂直工具；目录数量不等于用户门户数量。
  - `services/`: 8 services — `api-gateway`, `auth-service`, `core-service`, `file-service`, `notification-service`, `communication-gateway`, `control-plane`, `workflow-engine`.
  - `packages/`: `api-client`, `axi-rag`, `schemas`, `epap-schemas-compat` (`@epap/schemas` migration shim), `types`, `ui` (legacy), `utils`, `workbench-foundation` (shared session / locale only).
  - `tools/axi-app-cli/`: independent sub-monorepo, governed by its own `AGENTS.md`.
  - `ai/`, `backend/`, `infra/fleet-console/`, `prompts/`, `docs/`.
- Root scripts (`package.json`): `pnpm install`, `pnpm dev`, `pnpm dev:workbench`, `pnpm dev:mobile`, `pnpm dev:dashboard`, `pnpm dev:coder`, `pnpm build`, `pnpm build:workbench`, `pnpm build:mobile`, `pnpm build:schemas`, `pnpm test`, `pnpm test:mobile`, `pnpm test:workstation`, `pnpm type-check`, `pnpm lint`, `pnpm check:boundaries`, `pnpm clean`, `pnpm clean:cache`.

## Technical Design

The root docs form a single source of truth plus a runtime-enforced test plan:

1. `AGENTS.md` defines agent-safe boundaries, project boundaries, six-layer SOP, and cross-project ground rules.
2. `PRD.md` defines requirements, non-goals, and success metrics.
3. `TDD.md` (this file) defines the verification strategy and concrete commands per surface.
4. `docs/state/TODO.md` maps requirements (`REQ-*`) to tasks and tests.
5. `docs/state/MILESTONE.md` records delivery evidence and exit criteria.
6. `INDEX.md` maps documents and source-of-truth ownership.
7. `docs/state/CHANGELOG.md` + `docs/logs/submit/<batch-id>.md` form the immutable change trail.
8. `docs/project-docs.manifest.json` (v2) is the zero-context onboarding contract regenerated from the above.

### Test Surface Map

| Surface | Owner | Verification entry |
| --- | --- | --- |
| Web admin UI | `apps/workbench` | `pnpm --filter @axi/workbench type-check`, `pnpm --filter @axi/workbench test`, `pnpm --filter @axi/workbench build`, `node apps/workbench/scripts/verify-ui-contracts.mjs` |
| Mobile application UI | `apps/workbench-mobile` | 微信式居中顶栏、加号菜单、四个常驻导航项（Home / Projects / Workspace / Me）、角标和顶部扫码动作；`pnpm --filter @axi/workbench-mobile type-check`, `pnpm --filter @axi/workbench-mobile test`, `pnpm --filter @axi/workbench-mobile build`, `pnpm --filter @axi/workbench-mobile verify:contracts` |
| Shared app foundation | `packages/workbench-foundation` | `pnpm --filter @axi/workbench-foundation type-check` |
| Go API Gateway | `services/api-gateway` | `cd services/api-gateway && go test -race ./...`；验证 JWKS/OIDC state、Bearer audience/scope、HttpOnly session、精确 CORS、安全头剥离、Redis 限流和 OTLP trace continuation |
| Axi Identity adapter | `services/identity-adapter` | `cd services/identity-adapter && go test -race ./...`；验证 Redis QR 一次性 resume、轮询无 token 泄露、邮箱令牌单次消费，以及 `make verify-identity-mailpit` SMTP smoke |
| Platform Core | `services/platform-core` | `cd services/platform-core && go test -race ./...`；验证成员边界、Owner 保护、字典版本、偏好和具租约/幂等头的 Outbox |
| PostgreSQL tenant RLS | `services/platform-core/internal/store` | `PLATFORM_TEST_MIGRATION_DATABASE_URL=... PLATFORM_TEST_DATABASE_URL=... go test -tags=integration ./internal/store -run TestPostgresRLSDeniesCrossTenantAccess` |
| Helm API plane | `infra/helm/axi-workbench-platform` | `go run helm.sh/helm/v3/cmd/helm@v3.18.6 lint infra/helm/axi-workbench-platform --strict` 与 `helm template` |
| Web / mobile contract verifiers | `apps/workbench/scripts/verify-ui-contracts.mjs`, `apps/workbench-mobile/scripts/verify-mobile-contracts.mjs` | Same as above |
| Workstation control plane | `services/control-plane` | `pnpm --filter @axi/workstation-control-plane test`, `pnpm --filter @axi/workstation-control-plane smoke` |
| Communication gateway | `services/communication-gateway` | `pnpm --filter @axi/workstation-communication-gateway test` |
| Workstation contracts | `packages/schemas` | `pnpm --filter @axi/workstation-contracts test` |
| Desktop host | `apps/devsvc-dashboard` | `pnpm --dir apps/devsvc-dashboard typecheck` |
| Axi Coder | `apps/axi-coder` | `pnpm --dir apps/axi-coder typecheck` |
| Verification Inbox | `apps/verification-inbox` | `npm --prefix apps/verification-inbox run typecheck` |
| Fleet Console (Python) | `infra/fleet-console` | `python3 infra/fleet-console/scripts/fleetctl.py validate` |
| Boundary SOP | `scripts/check-workbench-boundaries.mjs` | `pnpm check:boundaries` |
| Workspace graph | workspace governance | `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate` |

## 多端产品定位验证

本节验证 `docs/state/PRD.md` 的产品边界，不把未来功能误报为已实现。涉及应用源码时，仍按各自的 UI 合同、单元测试、构建和浏览器验收执行。

| PRD requirement | 静态/自动验证 | 产品验收（实施对应阶段时） |
| --- | --- | --- |
| REQ-POSITION-001 / REQ-SURFACE-001 | 运行文档追溯检查；核对 PRD、source catalog、apps guidance 与 Host 注册表的产品角色一致。 | 管理员能从产品说明区分 Web、Mobile、Host 与垂直工具，不把 Host 当用户后台。 |
| REQ-WEB-001 / REQ-WEB-002 | `node apps/workbench/scripts/verify-ui-contracts.mjs`；Web type-check/test/build。 | 在桌面宽度审查全局导航、筛选/批量/审计等管理任务；不得出现移动底栏或移动壳替代后台结构。 |
| REQ-MOBILE-001 / REQ-MOBILE-002 | `pnpm --filter @axi/workbench-mobile verify:contracts`；Mobile type-check/test/build。 | 在 390px 审查 Home / Projects / Workspace / Me 四个常驻导航项与顶部 Scan 动作；不出现组织级管理表单，敏感操作只允许已预授权单对象确认且在线复核服务端状态。 |
| REQ-CROSS-001 | 共享 foundation 改动时运行 `pnpm --filter @axi/workbench-foundation type-check` 与双端验证；合同/边界改动运行 `pnpm check:boundaries`。 | 每个双端工作流确认服务端权威状态、授权/审计事件、Web 交接上下文，以及贯穿源端、目标端和最终动作的 `handoff correlation id`。 |
| REQ-SCAN-001 | 为 Web 通用识别与移动审批确认分别保留合同/单元/E2E 用例；禁止共用模糊断言。 | 验证 Web 扫码可读取与处理结果，移动顶部 Scan 只在已授权审批交易中提交确认；身份/配对流程有独立入口，且两个失败提示可区分。 |
| REQ-DELIVERY-001 | 评审每项新能力的台账是否按 `CAPABILITY-OWNERSHIP.md` 记录端归属、用户任务、允许动作、数据授权、审计/交接关联、验收和复核。 | 未完成并复核台账的能力不得进入开发验收。 |

## Verification Commands

### Default zero-context path

```bash
# 1) Bootstrap
pnpm install

# 2) Workspace graph + boundaries
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate
pnpm check:boundaries

# 3) Whole-repo default checks
pnpm type-check
pnpm test
pnpm test:workstation

# 4) Web admin end-to-end (UI contracts + type-check + tests + build)
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench build
node apps/workbench/scripts/verify-ui-contracts.mjs

# 5) Independent mobile app
pnpm --filter @axi/workbench-foundation type-check
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile test
pnpm --filter @axi/workbench-mobile build
pnpm --filter @axi/workbench-mobile verify:contracts

# 6) Control-plane smoke + Fleet Console validate
pnpm --filter @axi/workstation-control-plane smoke
python3 infra/fleet-console/scripts/fleetctl.py validate

# 7) Go production API plane
(cd services/api-gateway && go test -race ./...)
(cd services/identity-adapter && go test -race ./...)
(cd services/platform-core && go test -race ./...)
go run helm.sh/helm/v3/cmd/helm@v3.18.6 lint infra/helm/axi-workbench-platform --strict
```

### Surface-specific commands

```bash
# Dashboard host
pnpm --dir apps/devsvc-dashboard typecheck

# Axi Coder
pnpm --dir apps/axi-coder typecheck

# Verification Inbox (npm prefix by design)
npm --prefix apps/verification-inbox run typecheck
```

### Documentation minimum check

```bash
for f in README.md README.zh-CN.md AGENTS.md INDEX.md CHANGE.md \
         docs/state/CHANGELOG.md docs/state/TODO.md docs/state/MILESTONE.md \
         docs/state/PRD.md docs/state/TDD.md docs/state/VERIFICATION.md; do
  test -f "/Volumes/code/workspace/projects/axi-workbench/$f" || { echo "MISSING $f"; exit 1; }
done
rg -n "REQ-(POSITION|SURFACE|WEB|MOBILE|CROSS|SCAN|DELIVERY|DOC|VERIFY|BOUNDARY|CONTROLPLANE|COMMUNICATION|WORKBENCH|MILESTONE|LOG|AXI-CODER)" \
  docs/state/PRD.md docs/state/TDD.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/CHANGELOG.md
```

## Risk Cases

- Documentation drifts from package manifests or the current source layout.
- Agents edit outside `/Volumes/code/workspace/projects/axi-workbench` without explicit scope and accidentally mutate governance or neighbor projects.
- Reference checkouts (`references/*`, `infra/axi-workspace-governance/references/*`) are mistaken for Axi Workbench-owned product surfaces.
- Verification commands become stale after dependency or layout changes (e.g. a deprecated package.json script stays in TDD).
- Workbench starts importing neighboring project implementations instead of consuming `@axi/workstation-*` package / API / config contracts.
- The desktop host (`devsvc-dashboard`) becomes a second user portal instead of a host shell.
- `apps/web-portal` is reintroduced as a third duplicate portal, defeating `REQ-WORKBENCH-001`.
- Axi Coder regresses to hard-coded Axi Notify artifact paths, breaking `REQ-AXI-CODER-001`.
- Six-layer SOP is bypassed: control-plane direct file IO, communication-gateway calling Codex, IM adapter reading project tree.
- A route or layout from one app is imported into the other, reintroducing a responsive single-SPA architecture through the back door.
- 文档将 Mobile 的 4 个常驻导航项 + Scan 动作误写为“五项底栏”，使旧术语重新驱动实现。
- Web 通用识别扫码与移动审批扫码被使用同一名称、权限或测试断言，造成越权或误操作。
- React Router v7 future-flag warnings hide genuine console errors; tests must distinguish them.

## Test Strategy

- Treat `PRD.md` requirements as test contracts; every `REQ-*` must appear in `TDD.md` or `TODO.md` with at least one command/check.
- Prefer existing project test/build commands; never invent a parallel test runner.
- Run `pnpm check:boundaries` for any control-plane, dashboard-hosting, cross-project, or package dependency change.
- For doc-only changes, run the minimum documentation check above and inspect diffs for placeholder language or stale REQ IDs.
- Run the Web admin verifier, tests, and build for `apps/workbench/**`; run the mobile verifier, tests, and build for `apps/workbench-mobile/**`; run foundation type-check plus both affected app checks for `packages/workbench-foundation/**` changes.
- Capture every batch in `docs/logs/submit/<batch-id>.md` and link it from `docs/state/CHANGELOG.md`.
- Keep `pnpm --filter @axi/workstation-control-plane smoke` exit-code 0 and ≥ 35 resources across six layers; treat smoke regression as a P0 incident.
- Web and mobile browser smoke must be regenerated whenever either application shell, its mobile navigation, shared foundation, or shared Axi tokens change.
- 产品定位文档变更必须运行文档追溯检查、JSON/链接检查，并由独立读者按“谁在什么端完成什么任务”“扫码有什么差异”“Mobile 有几个常驻导航项”三个问题复核。
- A failing boundary SOP or six-layer SOP is treated as P0 and blocks merge regardless of green tests.
