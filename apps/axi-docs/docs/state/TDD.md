# Axi Docs TDD

## 验证策略

本文档定义 Axi Docs 项目根文档套件的测试驱动开发方法。

### REQ 验证矩阵

| REQ ID | 要求 | 验证方式 |
|--------|------|----------|
| REQ-DOC-001 | 维护完整的根文档套件 | 文档存在性检查 + 内部引用一致性 |
| REQ-VERIFY-001 | 记录可运行的验证 | TDD.md 包含可执行命令 |
| REQ-BOUNDARY-001 | 保留所有权边界 | AGENTS.md 边界验证 |
| REQ-MILESTONE-001 | 跟踪交付状态 | MILESTONE.md 状态检查 |
| REQ-PLAN-001 | 计划与执行分离 | plans/ 目录结构 + Todo 链接验证 |

## 验证命令

### 文档验证

```bash
pnpm --dir app docs:check
```

验证根文档套件的存在性和基本结构。

### 构建验证

```bash
pnpm --dir app verify
```

验证应用构建和类型检查通过。

### 完整检查（开发前）

```bash
pnpm --dir app docs:check && pnpm --dir app verify
```

### 最小检查（文档变更）

```bash
for f in AGENTS.md README.md INDEX.md docs/state/CHANGELOG.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/PRD.md docs/state/TDD.md; do
  test -f "/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/$f" || exit 1
done
```

### 跨文档引用检查

```bash
rg -n "PRD|TDD|Milestone" "/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/state/PRD.md" \
  "/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/state/TDD.md" \
  "/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/state/TODO.md" \
  "/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/state/MILESTONE.md" \
  "/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/INDEX.md"
```

## 架构假设

- Root path: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs`
- Application package: `app/` (pnpm + Vite + React + TypeScript)
- Project-state documents: `docs/state/`
- Product-content sources: `docs/content/{en,zh}/`
- Governance documents: `docs/governance/`

## 风险案例

1. **文档漂移**: 文档与包清单或源码布局不一致
2. **边界突破**: Agent 在未明确范围的情况下编辑 `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs` 之外的区域
3. **引用混淆**: 引用检出不等于 Axi 自有产品面
4. **命令过期**: 依赖或布局变更后验证命令失效
5. **源锁漂移**: 外部源快照可独立推进；失败的 `source:check` 是源锁维护阻塞，非应用依赖升级失败

## 测试策略

- 将必需文档视为契约文件
- 实现变更时优先使用项目现有测试/构建命令
- 仅文档变更时运行最小检查并检查占位符语言
