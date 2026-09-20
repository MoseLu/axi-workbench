# 质量门禁 (Quality Gate)

## 本地命令

- `pnpm branch:check`
- `pnpm docs:check`
- `pnpm commit:check:last`
- `pnpm commit:lint:range -- --from <sha> --to <sha>`
- `pnpm lint`
- `pnpm test:coverage`
- `pnpm quality:check`
- `pnpm verify`

## Git Hooks

- `commit-msg` 运行 `commitlint`
- `pre-commit` 运行 branch 和 docs 检查
- `pre-push` 运行 governance、lint、测试和构建验证

## CI

- CI 校验 branch、PR 标题和提交区间
- CI 在 `dev` 和 `main` 上都运行 lint、测试和构建
- GitHub 分支保护应要求 `governance` 和 `quality`

## 当前基线

- 覆盖率上报必须通过 `pnpm test:coverage`
- 在当前知识图谱和接入工作稳定后，可再上调数值化的覆盖率门槛
