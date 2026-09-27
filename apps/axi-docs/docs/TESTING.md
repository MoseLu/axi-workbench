# Testing Guide / 测试指南

**Last Updated**: 2026-08-22

## Overview / 概述

Axi Docs 是一个文档应用项目，采用 Vitest 进行前端组件和配置的测试。

## Test Types / 测试类型

- **Unit Tests / 单元测试**: Vitest (`.test.ts`, `.test.tsx`)

## Running Tests / 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试
pnpm --filter @axi/docs test

# 带覆盖率运行
pnpm --filter @axi/docs test --coverage
```

## Test Configuration / 测试配置

- **Vitest 配置**: `/app/vitest.config.ts`

## Writing Tests / 编写测试

### Naming Conventions / 命名规范

- 测试文件: `*.test.ts`, `*.test.tsx`
- 目录约定: `src/` 下的测试文件放在同目录或 `__tests__/` 目录

### Best Practices / 最佳实践

- 为组件编写渲染测试
- 为配置逻辑编写单元测试
- 使用 `@testing-library/react` 进行 React 测试

## CI Integration / CI 集成

测试在每次 PR 和 push 时自动运行。

## Related / 相关

- [AGENTS.md](AGENTS.md) - 项目总览
