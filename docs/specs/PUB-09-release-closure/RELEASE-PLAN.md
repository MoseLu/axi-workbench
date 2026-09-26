# PUB-09 发布收口规划

> 状态：**规划阶段**
>
> 创建日期：2026-09-14
>
> 规划内容：发布文档收口、回滚方案、runbook 清单

---

## 1. 发布收口概览

### 1.1 本次发布范围

本次发布 `axi-workbench/vX.Y.Z` 涵盖 2026-09-14 批次的核心功能：

| 功能域 | 变更摘要 | 对应 CHANGELOG 条目 |
|--------|----------|---------------------|
| 工作区基础项目绑定 | AxiResource 6态生命周期、audience 权限过滤、menuGroup 动态分组、drift-check 脚本 | 2026-09-14 第1条 |
| 容器化 API 平面 | `docker-compose.backend.yml`、`make docker-backend` | 2026-09-14 第2条 |
| 本地后端 Profile | `make dev-backend` 完整本地后端 profile | 2026-09-14 第3条 |
| 本地基础设施端口收敛 | PostgreSQL/Redis/Kafka 专用端口，避免冲突 | 2026-09-14 第4条 |

### 1.2 需要更新的文档

| 文档 | 更新内容 | 优先级 |
|------|----------|--------|
| `docs/state/CHANGELOG.md` | 补录本次发布的所有变更条目 | P0 |
| `docs/HANDOFF.md` | 刷新 `Last verified` 日期和 `Evidence` | P0 |
| `docs/state/MILESTONE.md` | 补录 Milestone 5 最新证据 | P1 |
| `docs/state/TODO.md` | 确认 P0/P1 完成状态，P2 `REQ-LOG-001` 保持开放 | P1 |
| `infra/fleet-console/docs/runbook.md` | 新增发布相关 runbook | P2 |

---

## 2. CHANGELOG 收口

### 2.1 当前 CHANGELOG 状态

`docs/state/CHANGELOG.md` 已包含本次发布的核心条目：

```markdown
## [Unreleased]

### Changed

- 2026-09-14：完成工作区基础项目与 Axi Workbench 绑定整改核心功能：...
- 2026-09-14：新增 `docker-compose.backend.yml` 与 `make docker-backend` 容器化生产形态 API 平面：...
- 2026-09-14：新增 `make dev-backend` 完整本地后端 profile：...
- 2026-09-14：收敛本地后端运行基线：...
```

### 2.2 发布前检查清单

- [ ] 确认所有 2026-09-14 条目的 `commit` hash 已标注
- [ ] 确认 `Unreleased` 改为正式版本号 `[X.Y.Z]`
- [ ] 确认变更条目格式符合 Conventional Commits 规范
- [ ] 运行 `pnpm audit:submit-logs -- --since HEAD~N --strict` 验证提交记录覆盖

### 2.3 发布后动作

```bash
# 1. 更新版本标签
git tag -a axi-workbench/vX.Y.Z -m "axi-workbench vX.Y.Z"
git push origin axi-workbench/vX.Y.Z

# 2. 触发 GitHub Release
gh release create axi-workbench/vX.Y.Z --title "axi-workbench vX.Y.Z" --notes-file release-notes.md

# 3. 更新 CHANGELOG 日期
# 将 [Unreleased] 改为 [X.Y.Z] - YYYY-MM-DD
```

---

## 3. HANDOFF 收口

### 3.1 当前 HANDOFF 状态

`docs/HANDOFF.md` 最后验证日期为 `2026-09-13`，需要刷新到 `2026-09-14`。

### 3.2 更新字段

| 字段 | 当前值 | 更新为 |
|------|--------|--------|
| `Last verified` | `2026-09-13` | `2026-09-14` |
| `Evidence` | 2026-09-13 批次证据 | 2026-09-14 批次证据 |

### 3.3 Evidence 刷新要求

```
- Web browser smoke renders the Axi Dashboard shell...
- Web tests 184/184, UI contract verifier, type-check and production build passed on 2026-09-14
- Mobile tests 34/34, UI contract verifier, type-check and production build passed on 2026-09-14
- Workbench Foundation type-check passed
- Control Plane tests 196/196...
- Go API plane Docker integration passed
- drift-check.mjs automated check passed
```

---

## 4. 回滚方案

### 4.1 回滚触发条件

| 场景 | 触发条件 | 回滚方式 |
|------|----------|----------|
| 生产部署后 API 平面故障 | Gateway /health 或 /ready 失败 | 容器回滚到上一版本 |
| 数据库迁移失败 | migration job 退出码非0 | 重新执行迁移或回滚数据 |
| Control Plane 不可用 | /health 失败或六层快照为空 | 重启进程或回滚镜像 |
| 资源绑定功能异常 | drift-check 检测到 graph 漂移 | 重新运行绑定脚本 |

### 4.2 容器化 API 平面回滚

```bash
# 查看当前运行的容器
docker compose -f docker-compose.backend.yml ps

# 回滚到上一版本
docker compose -f docker-compose.backend.yml down
docker pull axiom/axi-workbench-gateway:<previous-tag>
docker compose -f docker-compose.backend.yml up -d

# 验证健康状态
curl -s http://127.0.0.1:18088/health
curl -s http://127.0.0.1:18088/ready
```

### 4.3 宿主机 Control Plane 回滚

```bash
# 停止当前进程
pkill -f "node.*control-plane"

# 回滚代码
git checkout <previous-commit-hash>
pnpm --filter @axi/workstation-control-plane install
pnpm --filter @axi/workstation-control-plane start

# 验证
pnpm --filter @axi/workstation-control-plane smoke
```

### 4.4 资源绑定回滚

```bash
# 重新运行绑定脚本
node apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs

# 运行 drift 检查
node apps/devsvc-dashboard/scripts/drift-check.mjs
```

### 4.5 GitHub Release 回滚

```bash
# 删除当前 release（不影响代码）
gh release delete axi-workbench/vX.Y.Z --yes

# 如果需要回滚代码
git revert <commit-hash>
git push origin dev
```

---

## 5. Runbook 清单

### 5.1 新增 Runbook 章节

在 `infra/fleet-console/docs/runbook.md` 新增以下章节：

#### 5.1.1 发布操作

```markdown
## API 平面发布

### 前提条件
- Docker 和 docker-compose 已安装
- 目标机器已通过 fleet 管理
- 数据库迁移脚本已准备

### 发布步骤

1. **构建镜像**
   ```bash
   docker build -t axiom/axi-workbench-gateway:<version> -f services/api-gateway/Dockerfile .
   docker build -t axiom/axi-workbench-identity:<version> -f services/identity-adapter/Dockerfile .
   docker build -t axiom/axi-workbench-platform:<version> -f services/platform-core/Dockerfile .
   ```

2. **更新 docker-compose.backend.yml**
   ```bash
   # 更新镜像版本
   sed -i 's/axiom\/axi-workbench-gateway:.*/axiom\/axi-workbench-gateway:<version>/g' docker-compose.backend.yml
   ```

3. **执行数据库迁移**
   ```bash
   docker compose -f docker-compose.backend.yml run --rm migration-identity
   docker compose -f docker-compose.backend.yml run --rm migration-platform
   ```

4. **滚动更新服务**
   ```bash
   docker compose -f docker-compose.backend.yml up -d
   ```

5. **验证**
   ```bash
   curl -s http://127.0.0.1:18088/health
   curl -s http://127.0.0.1:18088/ready
   docker compose -f docker-compose.backend.yml ps
   ```

### 回滚步骤

参见 §5.2 容器回滚流程。
```

#### 5.1.2 资源绑定维护

```markdown
## 资源绑定维护

### 工作区基础项目绑定

当 workspace graph 或 Resource Registry 需要更新时：

1. **更新 workspace graph**
   ```bash
   node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs onboard <project-id>
   ```

2. **重新生成资源注册**
   ```bash
   node apps/devsvc-dashboard/scripts/workspace-resource-registry.mjs
   ```

3. **验证绑定**
   ```bash
   node apps/devsvc-dashboard/scripts/drift-check.mjs
   pnpm check:boundaries
   ```

4. **更新文档**
   - 更新 `OWNER_INVENTORY.md`
   - 更新 `docs/state/CHANGELOG.md`
   - 刷新 `docs/HANDOFF.md` evidence
```

#### 5.1.3 健康检查命令

```markdown
## 健康检查命令

### API 平面健康检查

```bash
# Gateway 健康
curl -s http://127.0.0.1:18088/health | jq

# Gateway 就绪
curl -s http://127.0.0.1:18088/ready | jq

# Control Plane 健康
curl -s http://localhost:8092/health | jq

# 六层快照
curl -s http://localhost:8092/api/v1/snapshot | jq '.resources | length'

# drift-check
node apps/devsvc-dashboard/scripts/drift-check.mjs
```

### 工作区验证

```bash
# workspace validate
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate

# handoff check
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs handoff-check axi-workbench

# boundary check
pnpm check:boundaries
```
```

---

## 6. 发布检查清单

### 6.1 发布前检查

- [ ] `pnpm type-check` 通过
- [ ] `pnpm test` 通过（26/26 tasks）
- [ ] Web tests 184/184 通过
- [ ] Mobile tests 34/34 通过
- [ ] Control Plane tests 196/196 通过
- [ ] `pnpm check:boundaries` 通过
- [ ] `workspace-project validate` 通过
- [ ] drift-check.mjs 通过
- [ ] CHANGELOG 条目完整且格式正确
- [ ] HANDOFF evidence 已刷新
- [ ] Runbook 已更新

### 6.2 发布后检查

- [ ] Git tag 已推送
- [ ] GitHub Release 已创建
- [ ] 容器镜像已推送（如果使用容器发布）
- [ ] 生产环境 health check 通过
- [ ] drift-check 在生产环境通过

### 6.3 回滚准备检查

- [ ] 上一版本镜像已标记/保存
- [ ] 数据库备份已完成
- [ ] 回滚命令已验证
- [ ] 通知渠道已准备（如果需要回滚）

---

## 7. 文档维护规则

1. **CHANGELOG**：每个合并到 `dev` 的变更必须包含对应的 CHANGELOG 条目，格式为 `YYYY-MM-DD：变更摘要`
2. **HANDOFF**：每次发布后刷新 `Last verified` 和 `Evidence` 字段
3. **Runbook**：新增操作流程必须同步更新到 `infra/fleet-console/docs/runbook.md`
4. **TODO**：已完成项使用 `[x]`，未完成项保持 `[ ]`，禁止删除未完成的 P0/P1 项

---

## 8. 附录

### 8.1 相关文件路径

| 文件 | 路径 |
|------|------|
| CHANGELOG | `/Volumes/code/workspace/projects/axi-workbench/docs/state/CHANGELOG.md` |
| HANDOFF | `/Volumes/code/workspace/projects/axi-workbench/docs/HANDOFF.md` |
| TODO | `/Volumes/code/workspace/projects/axi-workbench/docs/state/TODO.md` |
| MILESTONE | `/Volumes/code/workspace/projects/axi-workbench/docs/state/MILESTONE.md` |
| Runbook | `/Volumes/code/workspace/projects/axi-workbench/infra/fleet-console/docs/runbook.md` |
| Release Workflow | `/Volumes/code/workspace/projects/axi-workbench/.github/workflows/axi-release.yml` |

### 8.2 验证命令速查

```bash
# 整库验证
pnpm type-check && pnpm test

# 应用验证
pnpm --filter @axi/workbench type-check && test && build
pnpm --filter @axi/workbench-mobile type-check && test && build

# 控制面验证
pnpm --filter @axi/workstation-control-plane test && smoke
pnpm --filter @axi/workstation-communication-gateway test

# 边界验证
pnpm check:boundaries
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate

# drift 检查
node apps/devsvc-dashboard/scripts/drift-check.mjs
```
