---
id: axi-docs-zh-projects-axi-soul-world-tdd
title: "Axi Soul World — TDD"
type: project
status: published
tags: [Axi Docs, Projects, products, tdd]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Axi Soul World 产品的行为测试计划。
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
---

# Axi Soul World — TDD

> 指向项目验证入口
> [`/Volumes/code/workspace/products/axi-soul-world/AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md)
> 与
> [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md)
> 的镜像。

## 验证命令（项目根标准命令）

```bash
git diff --check
test -f docs/architecture/three-surface-bff.md
test -f axi-soul-api/README.md && test -f apps/web-admin/index.html
cd apps/android && ./gradlew :app:checkDesignTokens
cd apps/android && ./gradlew :app:testDebugUnitTest
cd axi-soul-api && cmake --preset mac-arm64-clang-debug
cd axi-soul-api && cmake --build --preset mac-arm64-clang-debug
cd axi-soul-api && ctest --preset mac-arm64-clang-debug --output-on-failure
cargo test --manifest-path axi-auth-helper/Cargo.toml
```

## 行为测试

- [x] Android 模块在模拟器/真机启动。证据：真机 `m7lru45xu4mjcq7x`
      上 Todo Today/Active/Done、二级编辑器、Material 日期/时间选择器
      的安装与 UI 烟雾测试。
- [x] `BACKEND_CONTRACT.md` 边界被 `axi-soul-api` 骨架遵守。证据：
      契约测试 + `/healthz` + `/readyz` 回环通过。
- [ ] 管理 Web QR 登录 + Android 扫码批准端到端。
- [ ] PostgreSQL migration 升降级（从空库）。
- [ ] 打卡领域历史：重复点击、漏打、改时区、归档场景下的连续天数。
- [ ] 显式同步：Android → `axi-soul-api` → 另一客户端闭环；同步关闭
      时抓包确认无内容外发。