<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# TODO - frontend (React 多端前端)

> 层级: L3 (Module: frontend)
> 更新时间: 2026-03-23
> 继承自: ../TODO.md (L2 全项目)

---

## 状态说明

| 状态标记 | 含义 |
|---------|------|
| `TODO` | 待处理 |
| `IN_PROGRESS` | 进行中 |
| `DONE` | 已完成 |
| `BLOCKED` | 被阻塞 |

## 优先级

| 标记 | 优先级 |
|-----|-------|
| `P0` | 紧急 — 必须立即处理 |
| `P1` | 高 — 本版本必须完成 |
| `P2` | 中 — 计划内完成 |
| `P3` | 低 — 有余力再处理 |

---

## P1 - 高优先级

- [x] **[功能]** `DONE` `P1` 前端 Web 版本构建
  - 描述: React 前端 Web 构建，`pnpm build` 产物在 `frontend/build`
  - 关联文件: `frontend/package.json`, `frontend/vite.config.ts`
  - 里程碑: 里程碑 1.3: 前端与多端适配

- [ ] **[修复]** `IN_PROGRESS` `P1` Display 展示端修复
  - 描述: 修复 Display 客户端展示问题，当前分支 `display-fix`
  - 关联文件: `frontend/src/display/`
  - 里程碑: 里程碑 1.3: 前端与多端适配

- [ ] **[功能]** `IN_PROGRESS` `P1` Capacitor Android 端构建
  - 描述: 完成 Android APK 构建和测试
  - 关联文件: `frontend/capacitor.config.ts`, `frontend/android/`
  - 里程碑: 里程碑 1.3: 前端与多端适配

---

## P2 - 中优先级

- [ ] **[功能]** `TODO` `P2` Electron 桌面端增强
  - 描述: 完善 Electron 桌面端功能和稳定性
  - 关联文件: `frontend/electron/`
  - 里程碑: 里程碑 1.3: 前端与多端适配

---

## P3 - 低优先级

- [ ] **[优化]** `TODO` `P3` 前端性能优化
  - 描述: 包体积优化、懒加载、图片压缩
  - 关联文件: `frontend/vite.config.ts`, `frontend/src/`
  - 里程碑: v1.1.0 - 功能增强

---

## 已完成任务

- [x] 前端 Web 版本构建 (2026-03-23)

---

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| TODO.md (this) | `./TODO.md` | 前端模块任务（当前） |
| TODO.md (parent) | `../TODO.md` | 全项目任务 |
| MILESTONE.md | `./MILESTONE.md` | 前端模块里程碑 |
| AGENTS.md | `./AGENTS.md` | 前端目录 AI 文档 |

### Quick Commands
```bash
# 查看前端任务
grep -n "P0\|P1\|P2\|P3" ./TODO.md

# 查看进行中的前端任务
grep "🔄\|IN_PROGRESS" ./TODO.md
```

---

## 任务模板

```markdown
- [ ] **[类型]** `TODO` `P{优先级}` 任务标题
  - 描述: 任务详细描述
  - 关联文件: `path/to/file`
  - 里程碑: {milestone name}
```

<!-- 模板注释: -->
<!-- 类型: 功能|修复|优化|重构|文档|测试|安全|运维 -->
<!-- 状态: TODO|IN_PROGRESS|DONE|BLOCKED|CANCELLED -->
