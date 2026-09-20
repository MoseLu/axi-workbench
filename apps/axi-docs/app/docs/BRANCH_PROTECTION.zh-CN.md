# 分支保护

## 受保护分支

### dev

- 保护 `dev`
- 合并前需要 Pull Request
- 至少需要 1 个审批
- 弃用过时的审批
- 需要解决所有讨论
- 需要状态检查通过：
  - `governance`
  - `quality`
- 禁止强制推送
- 禁止删除分支

### main

- 保护 `main`
- 合并前需要 Pull Request
- 至少需要 1 个审批
- 需要解决所有讨论
- 需要状态检查通过：
  - `governance`
  - `quality`
- 要求分支在合并前保持最新
- 禁止强制推送
- 禁止删除分支
- 仅允许 release owner 直接推送

## 合并策略

- 常规工作合入 `dev`
- 发布 PR 从 `dev` 合入 `main`
- 生产热修复 PR 从 `hotfix/<slug>` 合入 `main`
- 合入 `main` 的每个热修复都必须合并或 cherry-pick 回 `dev`
