# Axi Docs Milestone

## 当前状态

根文档套件已建立。核心文档框架已完成，包括 AGENTS.md、PRD.md、TDD.md、TODO.md 和 MILESTONE.md。

## 退出标准

所有 REQ 对应的文档到位：

- REQ-DOC-001: 所有必需根文档存在且内部一致
- REQ-VERIFY-001: TDD.md 包含具体可执行命令
- REQ-BOUNDARY-001: AGENTS.md 明确可写范围和跨项目限制
- REQ-MILESTONE-001: 本文件记录当前状态和退出条件
- REQ-PLAN-001: 计划库和 Axi Todo 执行队列正确分离

## REQ 完成状态

| REQ ID | 状态 | 证据文件 | 待完成 |
|--------|------|----------|--------|
| REQ-DOC-001 | 完成 | AGENTS.md, README.md, INDEX.md, docs/state/*.md | 持续维护 |
| REQ-VERIFY-001 | 完成 | docs/state/TDD.md | 命令行验证 |
| REQ-BOUNDARY-001 | 完成 | AGENTS.md | 边界文档更新 |
| REQ-MILESTONE-001 | 完成 | 本文件 | 状态追踪 |
| REQ-PLAN-001 | 进行中 | docs/content/{en,zh}/plans/, todo/ | 计划库完整性 |

## 里程碑详情

### M1: 项目文档契约
- **状态**: 完成
- **目标**: Axi Docs 拥有项目级 L1/L2/L3 文档链和仅引用真实文件的清单
- **证据**:
  - `.claude/PARADIGM.md`
  - `.claude/ARCHITECTURE.md`
  - `docs/project-docs.manifest.json`
  - `pnpm --dir app docs:check`

### M2: 工作区注册覆盖
- **状态**: 进行中
- **目标**: `workspace` 知识源暴露项目行、根操作符文档、`.claude` 契约和 `workspace.graph.json` 契约节点
- **证据**:
  - `app/src/lib/knowledgeBase.ts`
  - `app/src/lib/knowledgeBase.test.ts`
  - `pnpm --dir app test:run`

### M3: VitePress 对齐阅读体验
- **状态**: 进行中
- **目标**: 导航指南、代码块、链接样式和文档阅读布局与 VitePress 参考保持一致
- **证据**:
  - `docs/content/{en,zh}`
  - reader 组件测试
  - 浏览器桌面和移动端冒烟检查

### M4: 源治理
- **状态**: 进行中
- **目标**: 外部文档输入锁定、可检查、CI 可重现（无需 git 子模块）
- **证据**:
  - `docs/sources.lock.json`
  - `app/scripts/check-source-locks.mjs`
  - `.github/workflows/axi-ci.yml`
  - `app/.github/workflows/ci.yml`

### M5: Idea-to-Landing 计划库
- **状态**: 进行中
- **目标**: 持久的 grill-me 输出和 idea-to-landing 计划有规范位置，Axi Todo 保持执行队列
- **证据**:
  - `docs/content/{en,zh}/plans/README.md`
  - `docs/content/{en,zh}/plans/idea-to-landing.md`
  - `docs/content/{en,zh}/guide/plans.md`
  - `app/src/config/siteConfig.ts`

<!-- deep-init:layer=L3 -->
<!-- MANUAL: keep milestone statuses evidence-backed; do not mark complete without a fresh command or artifact. -->
