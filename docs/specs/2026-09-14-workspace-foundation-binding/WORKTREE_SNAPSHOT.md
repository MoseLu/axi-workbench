# Worktree Snapshot

**快照时间**: 2026-09-14
**记录人**: P0-8 工作树快照建立任务

## 快照概览

| 项目 | 分支 | Ahead | 未提交文件 | Staged Changes |
|------|------|-------|-----------|----------------|
| axi-workbench | dev | 2 | 6 (5M + 1??) | 无 |
| axi-agent | feature/unified-personal-todo | 1 | 26 (6M + 1A + 19??) | 有 |
| axi-docs | codex/sync-axi-soul-world-dossier-20260824 | 2 | 10 (7M + 3A) | 有 |
| axi-ui | dev | 25 | ~130 (大量M + 2??) | 有 |
| axi-rules | dev | 4 | 8 (7M + 1A) | 有 |
| axi-skills | dev | 22 | 2 (1M + 1A) | 有 |
| axi-registry | dev | 1 | 2 (1M + 1A) | 有 |
| axi-workspace-governance | agent/workspace-incubator | 10 | ~18 (6M + ~12A) | 有 |

---

## 1. axi-workbench

**路径**: `/Volumes/code/workspace/projects/axi-workbench`
**分支**: `dev`
**远程**: `origin/dev`
**状态**: `[ahead 2]`

### 未暂存修改 (M)
- `apps/devsvc-dashboard/config/axi-apps.json`
- `apps/devsvc-dashboard/config/axi-resources.json`
- `apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs`
- `apps/devsvc-dashboard/src/features/axi-resources/axiResources.ts`
- `apps/devsvc-dashboard/src/features/theme/useThemeState.ts`
- `docs/specs/2026-09-14-workspace-foundation-binding/TODO.md`

### 未跟踪文件 (??)
- `docs/specs/2026-09-14-workspace-foundation-binding/OWNER_INVENTORY.md`

### Staged Changes
无

---

## 2. axi-agent

**路径**: `/Volumes/code/workspace/projects/axi-agent`
**分支**: `feature/unified-personal-todo`
**远程**: `origin/feature/unified-personal-todo`
**状态**: `[ahead 1]`

### 修改文件 (M)
- `README.md`
- `README.zh-CN.md`
- `backend/requirements.txt`
- `docker-compose.yml`
- `infra/axi-agent-mcp/package.json`
- `infra/axi-agent-transport/package.json`
- `tools/axi-todo/package.json`

### Staged Changes (A)
- `docs/logs/submit/20260914-095905-auto-submit.md`

### 未跟踪文件 (??)
- `.github/workflows/frontend-ci.yml`
- `docs/logs/submit/20260530-115211-batch-submit.md`
- `docs/logs/submit/20260604-154624-batch-submit.md`
- `docs/logs/submit/20260611-124509-batch-submit.md`
- `docs/logs/submit/20260611-133229-batch-submit.md`
- `docs/logs/submit/20260611-185655-batch-submit.md`
- `docs/logs/submit/20260613-230444-auto-submit.md`
- `docs/logs/submit/20260613-234602-auto-submit.md`
- `docs/logs/submit/20260614-001740-auto-submit.md`
- `docs/logs/submit/20260614-002341-auto-submit.md`
- `docs/logs/submit/20260722-173106-auto-submit.md`
- `docs/logs/submit/20260810-200342-auto-submit.md`
- `docs/logs/submit/20260823-100841-auto-submit.md`
- `docs/logs/submit/20260823-100848-auto-submit.md`
- `docs/logs/submit/20260823-100900-auto-submit.md`
- `docs/logs/submit/20260823-151208-auto-submit.md`
- `docs/logs/submit/20260823-194817-auto-submit.md`
- `docs/logs/submit/20260908-143734-auto-submit.md`
- `docs/logs/submit/20260908-144502-auto-submit.md`

---

## 3. axi-docs

**路径**: `/Volumes/code/workspace/projects/axi-docs`
**分支**: `codex/sync-axi-soul-world-dossier-20260824`
**远程**: `origin/codex/sync-axi-soul-world-dossier-20260824`
**状态**: `[ahead 2]`

### 修改文件 (M)
- `app/public/workspace-project-handoff.json`
- `docs/axi-workspace-governance/README.md`
- `docs/axi-workspace-governance/adr/README.md`
- `docs/axi-workspace-governance/integration-map.md`
- `docs/axi-workspace-governance/ownership-matrix.md`
- `docs/axi-workspace-governance/project-catalog.md`
- `docs/axi-workspace-governance/project-completion.md`
- `docs/axi-workspace-governance/project-handoff.md`
- `docs/axi-workspace-governance/repo-topology.md`

### Staged Changes (A)
- `docs/logs/submit/20260824-045023-auto-submit.md`
- `docs/logs/submit/20260824-045320-auto-submit.md`
- `docs/logs/submit/20260914-095904-auto-submit.md`

---

## 4. axi-ui

**路径**: `/Volumes/code/workspace/shared/axi-ui`
**分支**: `dev`
**远程**: `origin/dev`
**状态**: `[ahead 25]`

### 修改文件 (M) - 约120个文件
主要包括：
- `docs/architecture/css-ownership.json`
- `docs/axi-ui/COMPONENTS.md`
- `docs/axi-ui/component-inventory.snapshot.json`
- `gallery/package.json`
- `gallery/src/features/component-visualizer/adapters/` 下大量adapter文件
- `gallery/src/features/component-visualizer/` 下其他文件
- `packages/settings/src/features/settings/index.ts`
- `packages/settings/src/index.ts`
- `pnpm-lock.yaml`
- `scripts/check-css-architecture.mjs`
- `scripts/check-design-tokens.mjs`

### 未跟踪文件 (??)
- `gallery/remotion.config.tsx`
- `gallery/src/features/component-visualizer/utils.js`

### Staged Changes (A)
- `docs/logs/submit/20260914-095920-auto-submit.md`

---

## 5. axi-rules

**路径**: `/Volumes/code/workspace/projects/axi-rules`
**分支**: `dev`
**远程**: `origin/dev`
**状态**: `[ahead 4]`

### 修改文件 (M)
- `frontend/package.json`
- `index/docs-source.json`
- `index/projects.json`
- `index/projects.md`
- `index/rules.json`
- `index/sources.json`
- `index/task-execution-routing.v1.json`

### Staged Changes (A)
- `docs/logs/submit/20260914-095900-auto-submit.md`

---

## 6. axi-skills

**路径**: `/Volumes/code/workspace/shared/axi-skills`
**分支**: `dev`
**远程**: `origin/dev`
**状态**: `[ahead 22]`

### 修改文件 (M)
- `docs/logs/submit/20260914-095921-auto-submit.md`

### 未跟踪文件 (??)
- 无

### Staged Changes (A)
- `docs/logs/submit/20260914-095921-auto-submit.md`

---

## 7. axi-registry

**路径**: `/Volumes/code/workspace/infra/axi-registry`
**分支**: `dev`
**远程**: `origin/dev`
**状态**: `[ahead 1]`

### 修改文件 (M)
无

### Staged Changes (A)
- `docs/logs/submit/20260914-095921-auto-submit.md`

---

## 8. axi-workspace-governance

**路径**: `/Volumes/code/workspace/infra/axi-workspace-governance`
**分支**: `agent/workspace-incubator`
**远程**: `axi/agent/workspace-incubator`
**状态**: `[ahead 10]`

### 修改文件 (M)
- `docs/README.md`
- `docs/adr/README.md`
- `docs/integration-map.md`
- `docs/ownership-matrix.md`
- `docs/project-catalog.md`
- `docs/project-completion.md`
- `docs/project-handoff.md`
- `docs/repo-topology.md`
- `package.json`

### Staged Changes (A)
- `docs/logs/submit/20260831-195437-auto-submit.md`
- `docs/logs/submit/20260831-195444-auto-submit.md`
- `docs/logs/submit/20260914-001603-auto-submit.md`
- `docs/logs/submit/20260914-084722-auto-submit.md`
- `docs/logs/submit/20260914-090429-auto-submit.md`
- `docs/logs/submit/20260914-095915-auto-submit.md`

---

## 后续操作建议

1. **axi-agent**: 积压19个未跟踪的submit日志文件，建议清理或提交
2. **axi-ui**: 有大量未提交更改(约130个文件)，ahead 25个提交，建议尽快push
3. **axi-workspace-governance**: 分支与默认分支分离(ahead 10)，需确认工作流
4. 所有项目的auto-submit日志文件格式一致，可考虑归档策略
