---
stale-doc: true
stale-reason: 历史文档含 axiom-* 用法，未同步更新到 axi-* 命名约定
last-synced: 2026-09-25
synced-by: audit-remediation-2026-09-25
---

# Axi 工作区提交日志体系现状报告

> 生成时间: 2026-09-17

## 一、日志类型分布

| 类型 | 分布 | 用途 | 大小 |
|------|------|------|------|
| `docs/logs/submit/*.md` | 39 个项目 | 提交记录（batch-submit / auto-submit） | 约 4.8MB（不含 axiom-ui） |
| `docs/logs/submit/*.md` | axiom-ui 独占 | 大量提交记录 | 2.1MB |
| `docs/logs/handoff/*.md` | axiom-workbench | 交接日志 | 小型 |
| `.omx/logs/*.jsonl` | 多项目 | OMX 会话/turns/tmux-hook 日志 | 约 1.1MB |
| `docs/logs/*.log` | ai-resource-orchestration, ielts-vocab | 构建/发布/性能日志 | <100KB |
| `docs/logs/*.json` | ai-resource-orchestration, ielts-vocab | 结构化运行记录 | <100KB |

**总计**: 1986 个文件，约 7MB

## 二、各项目日志规模

### 2.1 大型项目 (>500KB)

| 项目 | docs/logs | submit 子目录 | 其他 |
|------|-----------|---------------|------|
| axiom-ui | 2.1MB | 507 文件 | - |
| axiom-workbench | 1.2MB | 302 文件 | handoff/ |
| ai-resource-orchestration | 960KB | 197 文件 | release/*.log |
| ai-resource-orchestration-lane-a | 948KB | 194 文件 | release/*.log |
| axiom-soul-world | 652KB | 139 文件 | - |
| axiom-soul-world-lane-b/d/f | 各 ~220KB | 各 ~50 文件 | - |

### 2.2 中型项目 (50-500KB)

| 项目 | docs/logs | submit | 其他 |
|------|-----------|--------|------|
| axiom-workspace-governance | 296KB | 66+60 文件 | - |
| axiom-skills (shared) | - | 58 文件 | - |
| axiom-taiuri-starter (shared) | - | 16 文件 | - |
| axiom-rules | 104KB | 24 文件 | .omx/ 6 文件 |
| axiom-agent-platform | 116KB | 29 文件 | .omx/ 9 文件 |
| axiom-notify | 64KB | 15 文件 | .omx/ 14 文件 |
| axiom-pet | 56KB | 14 文件 | .omx/ 13 文件 |
| axiom-pet-desktop | 56KB | 13 文件 | .omx/ 4 文件 |
| axiom-sports-management-app | 44KB | 11 文件 | worktree 残留 |
| axiom-image-preview | 20KB | 5 文件 | .omx/ 15 文件 |
| axiom-docs | 144KB | 29 文件 | .omx/ 15 文件 |
| ielts-vocab | 184KB | 13 文件 | .omx/ 69 文件 |
| story-graph | 160KB | 37 文件 | - |
| axiom-artboard | 28KB | 7 文件 | - |

### 2.3 .omx/logs 分布（独立于 docs/logs）

| 项目 | 文件数 | 类型 |
|------|--------|------|
| ielts-vocab | 69 | omx/turns/tmux-hook |
| axiom-docs | 15 | omx/turns/tmux-hook |
| axiom-image-preview | 15 | omx/turns/tmux-hook |
| axiom-notify | 14 | omx/turns/tmux-hook |
| axiom-pet | 13 | omx/turns/tmux-hook |
| axiom-workspace-governance | 1 | omx |
| axiom-registry | 1 | omx |
| axiom-workbench (apps) | 约 30 | 各子项目 |
| axiom-proxy-companion | 6 | omx/turns/tmux-hook |
| axiom-feishu-codex-bridge | 3 | omx/turns/tmux-hook |

## 三、问题

| 问题 | 影响 | 建议 |
|------|------|------|
| axiom-ui logs 膨胀 (2.1MB, 507 文件) | 单项目占用空间过大 | 归档 2026-06 前的旧提交记录 |
| axiom-workbench submit 堆积 (302 文件) | 历史过长 | 按月归档，仅保留近 3 个月 |
| .omx/logs 散落 10+ 项目 | 清理不统一 | 统一 30 天自动过期策略 |
| axiom-soul-world 多 lane 重复 | 不必要冗余 | 合并到主分支后清理 lane |
| worktree 残留 logs | 孤立文件 | 删除已合并 worktree 的 logs |
| ielts-vocab .omx/logs 最大 (69 文件) | 历史会话堆积 | 定期归档 30 天前会话 |

## 四、归档清单

### 4.1 已归档

- `/Volumes/code/workspace/.omx/migrated/projects-omx-20260526/logs/` (旧迁移目录)

### 4.2 待归档

#### 高优先级 (>100KB)
- [ ] `axiom-ui/docs/logs/submit/` — 507 个文件，约 1.8MB (2026-06 前)
- [ ] `axiom-workbench/docs/logs/submit/` — 302 个文件，约 1MB (2026-05 前)
- [ ] `ai-resource-orchestration/docs/logs/submit/` — 197 个文件 (2026-06 前)
- [ ] `ai-resource-orchestration-lane-a/docs/logs/submit/` — 194 个文件 (2026-06 前)

#### 中优先级 (50-100KB)
- [ ] `axiom-soul-world/docs/logs/submit/` — 139 个文件
- [ ] `axiom-soul-world-lane-*/docs/logs/submit/` — 各 ~50 文件
- [ ] `axiom-workspace-governance*/docs/logs/submit/` — 66+60 文件

#### 低优先级 (.omx 散落)
- [ ] `ielts-vocab/.omx/logs/` — 69 个文件，2026-05~06
- [ ] `axiom-docs/.omx/logs/` — 15 个文件
- [ ] `axiom-image-preview/.omx/logs/` — 15 个文件
- [ ] 其他项目 .omx/logs/ — 各 1~15 文件

## 五、建议行动

1. **[P0]** 清理 axiom-workbench worktree 残留
   ```bash
   rm -rf /Volumes/code/workspace/archive/axi-sports-management-app/.claude/worktrees/frontend-react-migration/docs/logs
   ```

2. **[P1]** 归档 axiom-ui 2026-06 前 submit 记录到 `docs/logs/archive/2026-Q1-Q2/`

3. **[P1]** 归档 axiom-workbench 2026-05 前 submit 记录到 `docs/logs/archive/2026-Q1/`

4. **[P2]** 为所有 .omx/logs 设置 30 天自动过期（删除 2026-08-17 前的文件）

5. **[P2]** 统一所有项目的 `docs/logs` 目录结构：
   - `submit/` — 提交记录
   - `release/` — 发布日志（仅需要时）
   - `archive/` — 归档（按年月）

6. **[P3]** 合并 axiom-soul-world 多 lane 后清理冗余 submit 记录

7. **[P3]** 创建 `docs/logs/README.md` 说明各子目录用途和保留策略
