# 旧审计清单 (2026-03 代码审计复核)

> 审计日期：2026-03-24
> 审计范围：前端 (React/Vite)、后端 (MCP Server)、配置、依赖、安全
> 状态复核日期：2026-06-11（仅勾选有当前代码或测试证据的完成项）
> 状态：归档 — 全部 4 级 P0/P1/P2/P3 项已迁出根 `TODO.md`；本文件保留为审计历史与 owner action 跟踪表。

---

## P0 — 紧急（仍需关注 / owner action）

### [SECURITY] 移除源码中硬编码的 JWT Token
- **文件:** `app/src/mcp/server.ts:227`, `app/vite.config.plugin.ts:75`
- **状态:** 代码已修（[x] 改为 `process.env.BLINKO_TOKEN || ''`），**owner action 仍待办**：吊销已泄露的 JWT token + 配 gitleaks pre-commit hook。

### [SECURITY] Blinko API 代理缺少认证
- **文件:** `app/src/mcp/server.ts:1104-1108`
- **状态:** 已修（auth + 速率限制已加）。

### [BUG] server.ts 中存在重复的 switch case
- **状态:** 已修。

### [PERF] 将同步文件 I/O 改为异步
- **文件:** `app/src/mcp/server.ts`
- **状态:** 仍需修 — `readFileSync` / `writeFileSync` / `readdirSync` 仍有 6 + 2 处，**owner action**：后续迭代清理。

---

## P1 — 高优先级

### [SECURITY] CORS 配置过于宽松
- **状态:** 仍需修 — `Access-Control-Allow-Origin: *` 仍在代码里；`ALLOWED_ORIGINS` 已有 env 但未在 CORS 层强制白名单。

### [SECURITY] 路径穿越防护不完整
- **状态:** 已修（`path.relative()` + 拒绝 `..` + 扩展名白名单）。

### [ARCH] 抽取 Vite 插件与 Server 的重复逻辑
- **状态:** 仍需修（~2000 行重复）。ZC-DOCS-001 的 handoff-first 抽象是简化版本，未触及 `vite.config.plugin.ts` 重复。

### [UX] 错误边界与用户反馈
- **状态:** 部分已修（`ErrorBoundary` 已建），toast / 重试按钮仍待做。

### [SECURITY] 请求体大小无限制
- **状态:** 已修（`MAX_BODY_SIZE` + 413）。

---

## P2 — 中优先级

### [BUG] 快速切换文件时的竞态条件
- **状态:** AbortController 已加；"响应对应文件路径仍为当前选中文件" 的二次检查仍待做。

### [PERF] React 组件缺少 memoization
- **状态:** 仍需修（KnowledgeGraph / DocumentView tick 函数未 memoize）。

### [BUG] SearchResults 使用数组索引作为 React key
- **状态:** 已修（`sourceId:path`）。

### [SECURITY] 搜索查询存在 ReDoS 风险
- **状态:** 大部分已修（移除动态正则频率），查询长度限制 (max 100) 仍待加。

### [TYPE] TypeScript 类型安全性不足
- **状态:** 仍需修（`as` 断言仍有残留）。

### [I18N] 硬编码中文缺少国际化支持
- **状态:** 仍需修（`react-i18next` 未引入）。ZC-DOCS-003 的 `ProjectHandoffCard` 已内建 i18n 字符表，是部分进展。

---

## P3 — 低优先级

### [DX] .env.example
- **状态:** 已修。

### [DX] 环境变量缺少启动时校验
- **状态:** 仍需修。

### [DEPS] 清理未使用的依赖
- **状态:** 部分已修（`gray-matter` 已确认使用）；`chokidar → devDependencies` 仍待迁移。

### [TEST] 测试覆盖率不足
- **状态:** 显著改善（ZC-DOCS-001/002/003/004 新增 47+ 个测试用例）。竞态 / 路径穿越 / 覆盖率门槛 CI 仍待做。

### [OPS] 缺少生产部署基础设施
- **状态:** Dockerfile / docker-compose.yml 已加；优雅关闭 / 结构化日志 / Sentry 仍待做。

### [A11Y] 辅助功能缺失
- **状态:** 仍需修。

### [STYLE] 错误消息语言不一致
- **状态:** 仍需修。

---

## 架构改进路线图

```
阶段一 (安全加固)
├── 移除硬编码 token             [代码 done, owner action pending]
├── 修复 Blinko 代理认证         [done]
├── CORS 限制                    [待做]
└── 路径穿越防护完善             [done]

阶段二 (代码健康)
├── 抽取共享模块消除重复        [部分，ZC-DOCS-001 触及 1/4]
├── 同步 I/O → 异步              [待做]
├── 错误边界 + 用户反馈          [部分]
└── 请求体大小限制              [done]

阶段三 (质量提升)
├── 竞态条件修复                [部分]
├── React 性能优化              [待做]
├── TypeScript 严格模式         [待做]
└── 测试覆盖率 ≥ 60%            [进行中，47+ 新增]

阶段四 (可扩展)
├── 国际化框架                  [待做]
├── Docker 化部署               [部分]
├── 结构化日志 + 监控           [待做]
└── 辅助功能合规                [待做]
```

---

## 审计统计（2026-03）

| 维度 | 数值 |
|------|------|
| 扫描文件数 | 40+ |
| 代码行数 | ~4,000+ |
| 安全问题 (P0) | 4 (3 done + 1 owner action) |
| 高优先级 (P1) | 6 (3 done + 3 待做) |
| 中优先级 (P2) | 6 (2 done + 4 待做) |
| 低优先级 (P3) | 8 (2 done + 6 待做) |
| 重复代码量 | ~2,000 行（待抽取） |
| 测试文件数 | 25+ (从 5 增至 25+) |
| 测试覆盖率 (估) | 从 < 30% 改善中 |

---

*归档于 2026-06-11 — 详见 `docs/axi-workspace-governance/audits/` 历史审计报告。*
