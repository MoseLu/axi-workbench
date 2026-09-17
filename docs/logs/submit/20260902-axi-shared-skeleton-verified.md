# M14-18 多端架构整理 — 验证战报

- 时间：2026-09-02
- 分支：`agent/workbench-multi-surface-architecture`
- 范围：跨端架构 doc + `@axi/workbench-shared` 占位包 + 共享契约 CI

## 验证矩阵

| 项 | 结果 |
| --- | --- |
| `pnpm --filter @axi/workbench-shared type-check` | ✅ tsc --noEmit |
| `pnpm --filter @axi/workbench-shared test` | ✅ **5 passed** (format.test.ts) |
| `pnpm check:boundaries` | ✅ Axi Workbench boundary check passed |
| `pnpm --filter @axi/workbench type-check` | ✅ tsc --noEmit |
| `pnpm --filter @axi/workbench test` | ✅ **133 passed** (27 files) |
| `pnpm install --frozen-lockfile=false` | ✅ 8.9s |
| `git status --short` (本分支) | ✅ dirty 文件 untouched |

## commit 记录（4 个）

```
fdff8ed feat(workbench-shared): skeleton + shared-contracts CI + ARCHITECTURE §9
443f4ed chore(repo): gitignore mobile native builds + sync ARCHITECTURE followups
c1da352 docs(workbench): multi-surface architecture overview
+ 503f4ed (这条之前)  之前的提交
```

## 新增文件

```
apps/workbench-shared/
  package.json        ← workspace 占位包
  tsconfig.json
  vitest.config.ts
  README.md
  src/
    index.ts          ← package 元数据 + 三模块入口
    format/index.ts   ← formatUnreadCount / formatTimestamp 占位
    hooks/index.ts    ← useDebouncedValue 占位
    types/index.ts    ← Surface / NavBadge 占位
    format/format.test.ts  ← 5 个 vitest 用例

.github/workflows/axi-shared-contracts.yml   ← shared 包 build/test + 三端契约一致性检查

docs/specs/2026-09-02-workbench-multi-surface-architecture/
  ARCHITECTURE.md     ← 三端矩阵 + 决策树 + 共享契约 + §9 实战案例

.gitignore            ← +apps/workbench-mobile/{android,ios,dist}/
```

## 没碰的（属于 agent/workbench-desktop 工作树）

20 个脏文件：README / package.json / icons / .app 等，**全部 untouched**。

## 下一步（继续推）

1. **M19** shared 包加 `useInterval` / `useThrottle` / `useLocalStorage` 通用 hooks
2. **M20** shared 包加 `cn` className 合并工具（三端 antd/web 全用）
3. **M21** 把 web 端的 `MainLayout` 里的 `formatUnreadCount`（如有）抽到 shared
4. **M22** 把 mobile 端的 `Layout` 里的同类工具也抽到 shared
5. **M23** shared 包发 beta tag 看 pnpm 解析

要继续推哪一个？还是先停在 M14 这里——5 测试 + 133 回归 + boundary 全绿？