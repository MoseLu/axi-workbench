# Testing Guide / 测试指南

**Last Updated**: 2026-08-22

## Overview / 概述

Axi Workbench 是一个 Turborepo monorepo，包含多个应用程序和共享包。测试策略采用 Vitest（单元测试）和 Playwright（E2E 测试）相结合的方式。

## Test Types / 测试类型

- **Unit Tests / 单元测试**: Vitest (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`)
- **Integration Tests / 集成测试**: Vitest 配置在各子包中
- **E2E Tests / 端到端测试**: Playwright (`.spec.ts`)

## Running Tests / 运行测试

```bash
# 运行所有测试 (通过 turbo)
pnpm test

# 运行特定应用测试
pnpm test:workstation   # 测试 workstation 相关包
pnpm test:mobile        # 测试移动端应用

# 在特定包中运行测试
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench-mobile test
```

### 各子包测试命令

```bash
# Apps
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench-mobile test

# Packages
pnpm --filter @epap/ui test
```

## Test Configuration / 测试配置

- **Vitest 配置**: `vitest.config.ts` (在各个子包中)
- **Playwright 配置**: `playwright.config.ts` (在各个子包中)

主要配置文件位置:
- `/apps/workbench/vitest.config.ts`
- `/apps/workbench/playwright.config.ts`
- `/apps/workbench-mobile/vitest.config.ts`
- `/apps/workbench-mobile/playwright.config.ts`
- `/packages/ui/vitest.config.ts`

## Writing Tests / 编写测试

### Naming Conventions / 命名规范

- 测试文件: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Playwright 测试: `*.spec.ts`
- E2E 测试目录: `e2e/`

### Best Practices / 最佳实践

- 为每个功能编写单元测试
- E2E 测试覆盖关键用户流程
- 使用 Vitest 的 `vi.mock()` 进行模块 mock
- 测试文件与源文件放在同一目录

## Coverage Targets / 覆盖率目标

- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

## CI Integration / CI 集成

测试在每次 PR 和 push 时通过 Turbo 自动运行。

## Related / 相关

- [AGENTS.md](AGENTS.md) - 项目总览
- [turbo.json](../turbo.json) - Turbo 构建配置
