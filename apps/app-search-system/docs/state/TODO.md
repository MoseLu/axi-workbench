# SOP 系统待办事项

> 创建时间：2026-03-23
> 最后更新：2026-03-23

## 紧急事项

### 1. 修改管理员默认密码 🔴 安全风险

**修复方案**：
1. 首次登录后强制修改密码（已有 `must_change_password` 字段）
2. 默认密码改为随机生成（16位字母数字），不再是固定值
3. 通过API修改：
```bash
curl -X POST http://10.80.8.198:8765/api/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"old_password":"当前密码","new_password":"新密码"}'
```

**代码改动**：
- `backend/models.py`：新增 `generate_random_password()` 函数
- 首次启动时随机生成16位密码而非硬编码 `admin123`
- 密码生成使用 `secrets` 模块（密码学安全随机数）

**优先级**：高
**负责人**：已完成
**状态**：✅ 已完成（2026-03-23）

---

## 重要事项

### 2. 构建前端Web版本 ⚠️ 功能缺失

**问题描述**：
- `frontend/dist` 目录不存在
- React前端Web版本没有构建产物
- 影响直接通过浏览器访问前端

**修复方案**：
```bash
cd E:\app\sop\frontend
pnpm build
# 产物输出到 frontend/build 目录（不是dist）
```

**优先级**：中
**负责人**：待定
**状态**：✅ 已完成（2026-03-23 构建成功，产物在 `frontend/build` 目录）

### 3. 清理离线测试设备 📊 数据维护

**修复方案**：
1. 删除测试UUID设备（随机UUID格式）：`POST /api/devices/cleanup-test`
2. 清理长期离线设备（默认30天）：`POST /api/devices/cleanup-old`
3. 自动清理：服务已有守护线程，每2分钟将超时设备标记为offline

**API使用示例**：
```bash
# 清理测试设备（需认证）
curl -X POST http://10.80.8.198:8765/api/devices/cleanup-test \
  -H "Authorization: Bearer <token>"

# 清理超过30天未上线的设备（需认证）
curl -X POST http://10.80.8.198:8765/api/devices/cleanup-old \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'
```

**代码改动**：
- `backend/models.py`：新增 `delete_test_devices()` 和 `cleanup_old_devices()` 函数
- `backend/device_manager.py`：新增两个API端点

**优先级**：中
**负责人**：已完成
**状态**：✅ 已完成（2026-03-23）

---

## 改进建议

### 4. 用户账户管理

**当前状态**：
- 目前仅有1个管理员账户

**改进方案**：
- 添加更多用户账户，支持不同角色（管理员、操作员、查看者）
- 实现基于角色的权限控制（RBAC）

**优先级**：低
**状态**：建议

### 5. 配置HTTPS安全传输

**当前状态**：
- 当前使用HTTP协议

**改进方案**：
- 生产环境部署HTTPS证书
- 配置SSL/TLS加密传输
- 使用Let's Encrypt免费证书或商业证书

**优先级**：中
**状态**：建议

### 6. 日志集中管理

**当前状态**：
- 服务日志存储在本地文件

**改进方案**：
- 考虑接入日志服务（如ELK、 Loki、Splunk）
- 实现日志分级存储
- 配置日志轮转策略

**优先级**：低
**状态**：建议

### 7. 监控告警系统

**当前状态**：
- 无监控告警机制

**改进方案**：
- 添加服务监控（如Prometheus + Grafana）
- 配置异常告警（邮件/钉钉/企业微信）
- 监控指标：CPU、内存、API响应时间、错误率

**优先级**：低
**状态**：建议

### 8. 数据库备份策略

**当前状态**：
- SQLite数据库 `sop.db` 无自动备份

**改进方案**：
- 配置定时备份任务（每日/每周）
- 异地存储备份文件
- 测试恢复流程

**优先级**：中
**状态**：建议

---

## 已完成事项

### 2026-03-23 完成项

- [x] 后端服务健康检查 - 服务运行正常
- [x] 后端统计接口验证 - 3031份文档，2345个作业
- [x] 登录认证接口验证 - JWT认证正常
- [x] 搜索建议接口验证 - 语义搜索正常
- [x] 设备管理接口验证 - 18台设备管理正常
- [x] ChromaDB数据库验证 - 向量数据库正常
- [x] SQLite数据库验证 - 数据库文件正常
- [x] 后端打包产物验证 - `sop_server.exe` 已生成
- [x] Electron桌面端验证 - 安装包已生成

---

## 备注

- 后端服务地址：`http://10.80.8.198:8765`
- ChromaDB集合数：2个
- 最新在线设备：c3dfc91dc89aa028（华为平板）

---

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `./AGENTS.md` | 目录级 AI 文档 |
| MILESTONE.md | `./MILESTONE.md` | 版本级路线图 |
| TODO.md | `./TODO.md` | 当前文档 |
