# 当前路线 — Axi Knowledge Hub

> 更新日期：2026-06-04（ZC-DOCS-001~005 完成后未变更；下一轮重点已重排）

---

## 已推进

- [x] 将 Axi Docs 定位为多文档库 Knowledge Hub，而不是单一 Markdown 站点
- [x] 新增文档项目 registry 与 adapter 概念
- [x] 首批接入 workspace registry、Axi Skills、Obsidian、Blinko
- [x] 为 `axi-skills` 保留原生 `SKILL.md` 格式，通过 adapter 生成 Web/MCP 可用索引
- [x] MCP 新增 `axi_docs_*` 语义化工具
- [x] **handoff-first dossier 生成**（ZC-DOCS-001）：project dossier 从 `.workspace/project-handoff.json` 生成，`WORKSPACE_INDEX.md` 降级兜底
- [x] **axi-rules 一级源**（ZC-DOCS-002）：规则文本与 TODO 契约可直接搜索
- [x] **项目页 HANDOFF 卡片**（ZC-DOCS-003）：两分钟接手视图
- [x] **MCP 接手工具**（ZC-DOCS-004）：`axi_docs_project_onboard` / `axi_docs_handoff_check` 暴露给 Agent

---

## 下一轮重点（按当前 backlog 优先级）

### 同步 I/O 改造（owner action）
- `app/src/mcp/server.ts` 仍有 6 处 `readFileSync` + 2 处 `writeFileSync` + 多处 `readdirSync`，大型 Obsidian vault 下导致请求超时
- 阶段二（代码健康）的关键瓶颈，影响新 Agent 接手的可靠性

### CORS 白名单强制（owner action）
- `app/src/mcp/server.ts` CORS 仍用 `Access-Control-Allow-Origin: *`，`ALLOWED_ORIGINS` 已在 `.env.example` 但未在 CORS 层强制
- 阶段一（安全加固）剩余项

### Vite 插件 / Server 重复抽取
- `vite.config.plugin.ts` 与 `mcp/server.ts` 仍有 ~2000 行重复（标签提取、文件扫描、搜索、图谱构建、Blinko 代理）
- ZC-DOCS-001 的 helper 抽取是简化版本，未触及 Vite 插件层

### 旧审计 P2/P3 项
- React 性能（`KnowledgeGraph` / `DocumentView` memoization）
- TypeScript `as` 断言清理
- 测试覆盖率 ≥ 60% CI 门槛
- 国际化（`react-i18next`）
- 结构化日志 / Sentry

完整旧审计列表参见 [`todo/02-legacy-audit.md`](02-legacy-audit.md)。

---

## Web 阅读页打磨

- 左侧树、右侧 TOC 进一步打磨
- 项目页头部 HANDOFF 卡片（ZC-DOCS-003 完成后部分覆盖）
- knowledge catalog 子项折叠/展开
- mobile responsive 调优

---

## 旧审计清单复核

- [ ] 旧审计 P0/P1/P2/P3 全部项已迁到 [`todo/02-legacy-audit.md`](02-legacy-audit.md)，后续按 owner action 表执行
