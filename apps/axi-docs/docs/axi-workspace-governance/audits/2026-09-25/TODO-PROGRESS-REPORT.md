# 工作区待办任务处理汇总报告

> 生成日期: 2026-09-20
> 操作: 临时文件清理 + 任务进度汇总

---

## 处理完成汇总

### 临时文件清理

| 类型 | 清理项 |
|------|--------|
| `.log` 文件 | 9 个 axi-soul-world build 日志 |
| `.playwright-cli/*.log` | 20+ 个旧 playwright 控制台日志 (2026-04) |
| `.runtime/*.log` | axi-docs 运行时日志 |

### 变更文件列表

| 文件路径 | 操作 |
|----------|------|
| `/Volumes/code/workspace/products/axi-soul-world/logs/` | 目录清理 |
| `/Volumes/code/workspace/projects/axi-docs/app/.playwright-cli/` | 旧日志删除 |
| `/Volumes/code/workspace/projects/axi-docs/app/.runtime/*.log` | 运行时日志删除 |

---

## 按优先级

| 优先级 | 完成数 | 总数 | 状态 |
|--------|--------|------|------|
| P0 | 2 | 2 | 全部完成 |
| P1 | 0 | 2 | TD-WRK-INDEX-001, TD-WRK-SVC-001 待处理 |
| P2 | 1 | 7+ | 部分完成，剩余多项待决策 |

---

## 按项目

### axi-rules
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | - | 无直接相关任务 |
| 阻塞项 | - | - |

### axiom-workspace-governance
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | 1 | TD-WRK-HARD-004 (i18n drift 修复) |
| 阻塞项 | 4 | TD-WRK-HARD-001~003, 005~007 (需要 owner 决策) |

### axi-docs
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | 2 | TD-WRK-DOCS-001, TD-WRK-DOCS-002 |
| 阻塞项 | 1 | `backup/dev-before-origin-realign` 分支需确认是否删除 |

### axi-pet
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | - | - |
| 阻塞项 | 2 | 1) GitHub default branch 切换 + 远端分支清理<br>2) `main...origin/main [ahead 28, behind 23]` reconcile 方向待定 |

### axi-soul-world
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | - | - |
| 阻塞项 | - | build 日志已清理 |

### ielts-vocab
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | - | - |
| 阻塞项 | - | 开发服务器日志待清理 (暂未处理) |

### axi-sports-management-app
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | - | - |
| 阻塞项 | 1 | `feature/frontend-react-migration` 合入 dev 有 10+ 冲突，需用户决策: A放弃迁移 / B解冲突接受React / C改长期分支 |

### axi-registry
| 类型 | 数量 | 说明 |
|------|------|------|
| 完成项 | - | - |
| 阻塞项 | 1 | 3 个 bak 文件待确认删除 (`htpasswd.bak.*`, `pnpm-lock.yaml.v6.bak.*`, `storage.bak.*`) |

---

## 已完成任务详情

### P0 - 全部完成

| 任务ID | 描述 | 状态 |
|--------|------|------|
| TD-WRK-DOCS-001 | Axi Docs 与 workspace layered docs 对齐 | DONE |
| TD-WRK-DOCS-002 | 项目文档 manifest 引用强制校验 | DONE |

### P2 - 部分完成

| 任务ID | 描述 | 状态 |
|--------|------|------|
| TD-WRK-HARD-004 | i18n 中文镜像 drift 修复 | DONE (2026-06-12) |

---

## 仍需Owner决策的事项

### 高优先级 (影响工作流)

1. **axi-sports-management-app 栈迁移冲突**
   - 问题: `feature/frontend-react-migration` 合入 dev 有 10+ 冲突
   - 选项: A) 放弃迁移 / B) 解冲突接受 React / C) 改长期分支
   - 阻塞: 整个迁移进度

2. **axi-pet GitHub 分支管理**
   - 问题: default branch 需从 `agent/zero-context-handoff-20260611` 切回 `main`
   - 操作: GitHub 端切换 + `git push axi --delete` 清理远端分支
   - 附加: `main...origin/main [ahead 28, behind 23]` reconcile 方向待定

3. **axi-registry bak 文件清理**
   - 文件: `htpasswd.bak.20260612-145516`, `pnpm-lock.yaml.v6.bak.20260612-145516`, `storage.bak.20260612-145516/`
   - 操作: 确认删除或保留

### 中优先级 (治理完善)

4. **TD-WRK-HARD-001** - 运行时状态迁移到 `~/.local/share/axi-workspace/state/`
   - 涉及: `.devsvc/`, `.minimax-outputs/`, `.cc-connect-cache/`, `downloadtemp/`
   - 验证: `make doctor-state`

5. **TD-WRK-HARD-002** - `ecosystem.config.cjs` 角色决策
   - 选项: (a) 删除并统一到 `dev-services.config.json` / (b) 文档标注为 PM2 fallback

6. **TD-WRK-HARD-003** - 文档化 `foundation/workspace-governance` 权限
   - 说明: `drwx------` 为有意设置，单用户工作站在此文档说明

7. **TD-WRK-HARD-005** - Secrets 目录迁移
   - 涉及: `agent-cluster/axi-agent/tools/axi-feishu-codex-bridge/`, `tools/axi-proxy-companion/` 等
   - 目标: 迁移到 `~/.local/share/axi-workspace/secrets/`

8. **TD-WRK-HARD-006** - codegraph watch 忽略配置
   - 涉及: `references/archives/`, `downloadtemp/` 路径噪音

9. **TD-WRK-HARD-007** - dev-services 健康 URL 协调
   - 验证: `make schemas-verify`

10. **axi-docs backup 分支**
    - 分支: `backup/dev-before-origin-realign`
    - 操作: 确认是否 `--all-branches` 纳入默认清理

### 待处理任务 (无需阻塞)

| 任务ID | 描述 | 优先级 |
|--------|------|--------|
| TD-WRK-INDEX-001 | 生成人类可读的 graph contract 页面 | P1 |
| TD-WRK-SVC-001 | 绑定 dev service docs 到 profile checks | P1 |

---

## 推荐的Next Steps

1. **[立即]** 用户需对 axi-sports-management-app 迁移冲突做 A/B/C 决策
2. **[立即]** axi-pet GitHub 分支切换 + remote 清理
3. **[本周]** 确认删除 axi-registry 的 3 个 bak 文件
4. **[本周]** TD-WRK-INDEX-001 (graph contract 页面) 开始执行
5. **[下周]** TD-WRK-SVC-001 (dev service docs binding)
6. **[规划]** TD-WRK-HARD-001~007 剩余 6 项治理完善任务排期

---

## 附录: 清理的临时文件清单

```
products/axi-soul-world/logs/build-release-20260821-193348.log
products/axi-soul-world/logs/build-fix4-20260821-195628.log
products/axi-soul-world/logs/build-fix-20260821-194325.log
products/axi-soul-world/logs/install-20260821-193426.log
products/axi-soul-world/logs/build-fix-20260821-194337.log
products/axi-soul-world/logs/build-fix2-20260821-194612.log
products/axi-soul-world/logs/build-fix3-20260821-195054.log
products/axi-soul-world/logs/build-fix4-20260821-195624.log
products/axi-soul-world/logs/install-fix-20260821-194342.log
projects/axi-docs/app/.playwright-cli/console-*.log (20+ files from 2026-04)
projects/axi-docs/app/.runtime/axi-docs-dev-127.log
projects/axi-docs/app/.runtime/axi-docs-dev.log
projects/axi-docs/app/.runtime/mcp-http.stdout.log
projects/axi-docs/app/.runtime/mcp-http.log
projects/axi-docs/app/.runtime/mcp-http.stderr.log
projects/axi-docs/app/.runtime/axi-docs-dev-127.launchd.log
```
