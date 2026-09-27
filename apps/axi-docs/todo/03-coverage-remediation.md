# 文档覆盖补齐计划（2026-06-10 审计）

> 完整审计报告：[`docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md`](docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md)
> 触发问题：用户问"axi-docs 文档仓库对于整个工作区来说，文档齐全吗？" → 经全工作区目录树 vs 镜像目录对比，发现 3 类缺口（缺失项目、7 件套不全、governance 根级未镜像）。
> 状态：已完成。ZC-DOCS-001 的 handoff-first 改造覆盖了原 25 → 27 → 26 个 dossier 的过渡（axi-registry 新增、ielts-vocab 短 id 替换 ielts-vocabulary、9 个 supplementary 补全 references + 虚拟 workspace 项目）。本节作归档跟踪。

---

## 缺口摘要

| 维度 | 现状 | 目标 |
|---|---|---|
| 工作区真实 Axi 项目数 | 19 + 7 reference + 2 虚拟 = 28 | 28 全覆盖 |
| 镜像覆盖率（2026-06-11 状态） | 26/28（harness 已收 axi-registry） | 27/28 |
| 镜像 7 件套 → 11 件套 | 7 件套 | 11 件套（含 CHANGELOG/SECURITY/CHANGE/CLAUDE/README.zh-CN/AGENTS.zh-CN）|
| governance 根级门面 | 5 报告 + ADR（**漏 9 个根级门面**）| 9 个根级门面补齐 |
| 三合一 → 四合一声明 | 文档枢纽/知识图谱/MCP 三合一 | 加"工作区项目门面镜像"第 4 项职责 |

---

## P0：补 2 个缺失项目镜像（dbskill + codex-plus-app）

- [x] 创建 `docs/content/{en,zh}/projects/dbskill/` 镜像目录：7 件套 + 实际存在的 `README.zh-CN.md`（共 8 件）
- [x] 创建 `docs/content/{en,zh}/projects/codex-plus-app/` 镜像目录：README + AGENTS + INDEX 3 件最小目录（README 标注"项目待填充"）
- [x] 更新 `docs/projects.index.json` 加 2 条记录（绕开 build 脚本，手工补） + 新增 `preservedAddenda` 字段防 build 冲掉
- [x] 改 `app/scripts/build-projects-index.mjs` 保留 hand-curated addenda（status 含 'hand-curated' 的条目不被覆盖）
- [x] 注：这两个项目不在 `WORKSPACE_INDEX.md` 表格里，build 脚本不会自动接管；ZC-DOCS-001 后 handoff-first 主路径接管，markdown 兜底继续保留

---

## P1：把 7 件套扩展为 11 件套镜像

- [x] 修改 `app/scripts/build-projects-index.mjs` 的 `PIECES` 列表，加 `OPTIONAL_PIECES = ['CHANGELOG.md', 'SECURITY.md', 'README.zh-CN.md', 'AGENTS.zh-CN.md']`
- [x] 加 `PASSTHROUGH_FILES = ['CHANGE.md', 'CLAUDE.md']`（verbatim 复制 + frontmatter 注入）
- [x] 加源文件存在检测：源文件不存在时跳过该 piece、不报缺
- [x] 重新跑 `pnpm --dir app projects:build` 生成新件套
- [x] 更新 `pnpm --dir app projects:check` 校验逻辑（必选件 7 件硬错、optional/passthrough 软警告）
- [x] 验证 `pnpm --dir app projects:check` 通过

---

## P1：补 governance 根级门面镜像

- [x] 在 `docs/axi-workspace-governance/` 下补 9 个根级门面（AGENTS / CHANGELOG / INDEX / MILESTONE / PRD / README.zh-CN / SECURITY / TDD / TODO）—— 从 `infra/axi-workspace-governance/` 复制
- [x] 镜像 `README.md` 追加说明"包含 governance 根级门面（10 件）" + 引用新加的 9 个文件
- [x] 注：build 脚本对 governance 显式 skip 保持不变，governance 走镜像目录

---

## P1：根级 AGENTS.md 加第 4 项职责

- [x] 改 `AGENTS.md` 第 19-23 行："三合一" → "四合一"，加"工作区项目门面镜像（Project Dossier Mirror）"作为第 4 项职责
- [x] 指向 `app/scripts/build-projects-index.mjs` 与本次 audit 报告
- [x] 更新文件尾"最后更新"日期

---

## 验证

- [x] `pnpm --dir app projects:check` 通过（ZC-DOCS-001 后通过 — 26 项目 × 2 locales × 7 必选件 = 364 必选；现 25 项目 × 2 × 7 = 350 必选件；详情见 build 输出）
- [x] `pnpm --dir app docs:check` 通过
- [x] `pnpm --dir app verify` 通过（tsc + vite build，~50s）
- [ ] `pnpm --dir app source:check` 通过 — **preexisting, owner action**：axi-skills 上游漂移，与本次改动无关
- [x] `pnpm --dir app typecheck` — **N/A**：无独立 typecheck 脚本；`verify` 包含 `tsc`

---

## P2 收尾

- [x] 写 `docs/content/{en,zh}/guide/project-dossiers.md` 11 件套使用指南
- [x] 起草 dbskill 收编到 WORKSPACE_INDEX.md 提案：`docs/axi-workspace-governance/audits/proposal-add-dbskill-to-workspace-index-2026-06-10.md`
- [x] 起草 codex-plus-app 处置建议：`docs/axi-workspace-governance/audits/proposal-dispose-codex-plus-app-2026-06-10.md`
- [x] 评估 PIECE_TEMPLATES 重构（结论：不做，详见 `docs/axi-workspace-governance/audits/eval-piecetemplates-refactor-2026-06-10.md`）

---

## ZC-DOCS-001 后续覆盖更新

ZC-DOCS-001 把 `WORKSPACE_INDEX.md` 切换为 handoff snapshot 后，下列覆盖变化已自动应用：

- **axi-registry 新增**：handoff 把它列为 `kind: infra, lifecycle: active-infra`，build 脚本从 markdown 兜底里漏的它现在进 dossier。
- **ielts-vocab 短 id 替换 ielts-vocabulary**：handoff id 是 owner-curated 短 slug，build 脚本按 path 去重避免双条目。
- **9 个 supplementary**：handoff 只覆盖 15 个活跃 Axi 项目，markdown 兜底仍补 references（7）+ workspace 虚拟项目（2），保留 `supplementary: true` 标记。
- **preservedAddenda 维持**：dbskill / codex-plus-app 仍由 `status: 'hand-curated...'` 标记保留。

---

*归档于 2026-06-11 — 由 ZC-DOCS-005 拆分 TODO.md 时迁移。*
