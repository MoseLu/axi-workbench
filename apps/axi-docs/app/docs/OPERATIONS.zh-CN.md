# 运维 (Operations)

## 用途

本文件是仓库运维的入口。

## 核心 Runbook

- `docs/GITHUB_FLOW.md`
- `docs/BRANCH_PROTECTION.md`
- `docs/COMMIT_CONVENTION.md`
- `docs/RELEASE_OPERATIONS.md`
- `docs/QUALITY_GATE.md`
- `TESTING.md`

## 标准流程

### 日常交付

1. 从 `dev` 拉出分支
2. 更新测试和文档
3. 运行 `pnpm quality:check`
4. 运行 `pnpm verify`
5. 向 `dev` 发起 Pull Request

### 发布晋升

1. 确认 `dev` 为绿灯
2. 查阅 `docs/RELEASE_OPERATIONS.md`
3. 从 `dev` 向 `main` 发起 Pull Request

### 生产热修复

1. 用 `hotfix/<slug>` 从 `main` 拉出分支
2. 保持变更最小
3. 合入 `main`，然后回灌到 `dev`

## 最小命令集

```bash
pnpm install
pnpm git:bootstrap
pnpm commit
pnpm quality:check
pnpm verify
```
