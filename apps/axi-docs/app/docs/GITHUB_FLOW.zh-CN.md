# GitHub Flow

## 分支模型

Axi Docs 使用以 Pull Request 为中心的 GitHub Flow 配置文件：

- `dev`：默认集成分支
- `main`：受保护的生产发布分支

## 允许的短生命周期分支

- `feature/<slug>`
- `fix/<slug>`
- `hotfix/<slug>`
- `docs/<slug>`
- `refactor/<slug>`
- `perf/<slug>`
- `test/<slug>`
- `ci/<slug>`
- `build/<slug>`
- `chore/<slug>`

## 标准流程

1. 从 `dev` 同步。
2. 创建一个短生命周期分支。
3. 随变更更新测试和文档。
4. 运行 `pnpm quality:check` 和 `pnpm verify`。
5. 向 `dev` 发起 Pull Request。
6. 评审通过且 CI 绿灯后合入。
7. 将可发布的内容从 `dev` 晋升到 `main`。

## 热修复流程

1. 用 `hotfix/<slug>` 从 `main` 拉出分支。
2. 变更范围限定在生产问题上。
3. 向 `main` 发起 Pull Request。
4. 合入或 cherry-pick 同一修复回到 `dev`。

## 本地引导

- 克隆后或 `git init` 后运行 `pnpm git:bootstrap`
- 不要直接在 `main` 上开发
