# Commit Convention

## Format

```text
<type>[optional scope]: <subject>
```

## Allowed Types

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

## Rules

- use imperative mood
- keep the header within 72 characters
- use scope when the area is clear, for example `graph`, `search`, `mcp`, `sync`, or `styles`
- keep PR titles in the same format

## Tooling

- `commit-msg` runs `commitlint`
- `pnpm commit` starts the `cz-git` flow
- `pnpm commit:check:last` validates the most recent commit
- `pnpm commit:lint:range -- --from <sha> --to <sha>` validates a commit range
