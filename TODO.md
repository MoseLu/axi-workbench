# Axi Workbench TODO

> This root file is a **builder-friendly stub**. The canonical TODO lives at
> [`docs/state/TODO.md`](./docs/state/TODO.md). Every P0/P1 row there is
> anchored to a `REQ-*` row from the PRD and lists the concrete verification
> command or test case.

At a glance (see canonical TODO for the full list and evidence links):

- P0: documentation suite complete, workbench UI contract verifier green,
  control-plane smoke green, boundary SOP green, no second Web portal.
- P1: verify commands accurate, six-layer paths declared per service,
  communication-gateway stays above business logic, mobile shell persisted
  tokens auditable, manifest current, milestone/log discipline.

- Canonical source: [`docs/state/TODO.md`](./docs/state/TODO.md)
- Last refreshed: 2026-09-15

### Current verification evidence (2026-09-15)

- 采集时间：`2026-09-15T09:27:36+0800`
- 触发：`WFB-EVID-001` 原子任务
- 详细快照：[`docs/specs/2026-09-14-workspace-foundation-binding/WORKTREE_SNAPSHOT_2026-09-15.md`](./docs/specs/2026-09-14-workspace-foundation-binding/WORKTREE_SNAPSHOT_2026-09-15.md)
- 当前分支：`dev`（远程 `origin/dev`，ahead 1）
- 最近 commit：`bf77988b docs(workbench): split binding follow-ups into atomic tasks`
- 未提交改动归类：
  - `commit-ledger` / `gateway` 改动属于 Commit Ledger 专项 CL-014..CL-020，**不属于 WFB 专项**。
  - `devsvc-dashboard` 资源注册器、导航、搜索与认证链路改动属于 WFB 专项（对应 `WFB-REL-001`、`WFB-NAV-001`、`WFB-REG-001/002/003`、`WFB-DRIFT-001`）。
  - `.claude/` 与 `target/` 等运行时/构建产物目录不属于 WFB 专项。
- 历史 2026-09-14 快照仅作参考，禁止作为当前证据。

### Current verification evidence (2026-09-14)

| Surface | Command | Status |
|---------|---------|--------|
| Dashboard typecheck | `pnpm --filter @axi/workbench type-check` | ✅ PASS |
| Dashboard tests | `pnpm --filter @axi/workbench test` | ✅ 184/184 PASS |
| Control plane smoke | `pnpm --filter @axi/workstation-control-plane smoke` | ✅ PASS (35 resources) |
| Axi Coder smoke | `pnpm --filter @axi/workstation-control-plane smoke -F @axi/workstation-axi-coder` | ✅ PASS |
| Axi Skills verify | `cd .../axi-skills && python3 scripts/verify.py` | ✅ PASS (errors=0, 9 warnings) |
| Axi Skills i18n | `cd .../axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` | ✅ PASS |
| Boundary check | `pnpm check:boundaries` | ✅ PASS |
| Workspace validate | `workspace-project validate` | ✅ PASS |
| Axi UI typecheck | `pnpm --filter @axi/ui type-check` | ✅ PASS |
| Axi Registry health | `pnpm --filter @axi/registry health` | ✅ PASS |

See [`docs/state/TODO.md`](./docs/state/TODO.md) for P0/P1/P2 requirement traceability.
