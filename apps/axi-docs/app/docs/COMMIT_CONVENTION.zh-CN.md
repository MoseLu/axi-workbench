# 提交规范

## 格式

```text
<type>[optional scope]: <subject>
```

## 允许的 Type

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`
- `revert`

## 规则

- 使用祈使语气
- 标题保持在 72 字符以内
- 当作用域清晰时使用 scope，例如 `graph`、`search`、`mcp`、`sync` 或 `styles`
- 保持 PR 标题使用相同格式

## 工具链

- `commit-msg` 运行 `commitlint`
- `pnpm commit` 启动 `cz-git` 流程
- `pnpm commit:check:last` 校验最近一次提交
- `pnpm commit:lint:range -- --from <sha> --to <sha>` 校验一段提交区间
