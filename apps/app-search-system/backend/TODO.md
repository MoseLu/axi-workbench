<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# TODO - backend (Python FastAPI 后端)

> 层级: L3 (Module: backend)
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

- [x] **[安全]** `DONE` `P1` 管理员密码安全增强
  - 描述: 随机生成16位密码替代硬编码默认值，首次登录强制修改
  - 关联文件: `backend/models.py`
  - 里程碑: 里程碑 1.4: 安全与部署

- [x] **[功能]** `DONE` `P1` 离线测试设备清理 API
  - 描述: 提供 `cleanup-test` 和 `cleanup-old` API，守护线程每2分钟标记离线设备
  - 关联文件: `backend/device_manager.py`, `backend/models.py`
  - 里程碑: 里程碑 1.4: 安全与部署

---

## P2 - 中优先级

- [ ] **[功能]** `TODO` `P2` v1.1.0 功能规划
  - 描述: 用户账户管理(RBAC)、监控告警系统、日志集中管理
  - 关联文件: `backend/api.py`, `backend/models.py`, `backend/auth.py`
  - 里程碑: v1.1.0 - 功能增强

- [ ] **[安全]** `TODO` `P2` HTTPS 安全传输
  - 描述: 生产环境部署 HTTPS 证书，配置 SSL/TLS 加密
  - 关联文件: `backend/server.py`
  - 里程碑: v1.1.0 - 功能增强

- [ ] **[运维]** `TODO` `P2` 数据库备份策略
  - 描述: SQLite 定时备份任务（每日/每周），异地存储
  - 关联文件: `backend/data/sop.db`
  - 里程碑: v1.1.0 - 功能增强

---

## P3 - 低优先级

- [ ] **[运维]** `TODO` `P3` 日志集中管理
  - 描述: 接入 ELK/Loki/Splunk，实现日志分级存储和轮转
  - 关联文件: `backend/server.py`, `backend/logs/`
  - 里程碑: v1.1.0 - 功能增强

- [ ] **[运维]** `TODO` `P3` 监控告警系统
  - 描述: Prometheus + Grafana 监控，配置异常告警（邮件/钉钉）
  - 关联文件: `backend/api.py`
  - 里程碑: v1.1.0 - 功能增强

---

## 已完成任务

- [x] 管理员密码安全增强 (2026-03-23)
- [x] 离线测试设备清理 (2026-03-23)

---

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| TODO.md (this) | `./TODO.md` | 后端模块任务（当前） |
| TODO.md (parent) | `../TODO.md` | 全项目任务 |
| MILESTONES.md | `./MILESTONES.md` | 后端模块里程碑 |
| AGENTS.md | `./AGENTS.md` | 后端目录 AI 文档 |

### Quick Commands
```bash
# 查看后端任务
grep -n "P0\|P1\|P2\|P3" ./TODO.md
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
