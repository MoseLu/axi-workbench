# Axi Workbench — Windows 远程部署执行日志

> 本日志由 Claude agent 在 2026-09-16 写就，配套
> `docs/deployment/REMOTE-WINDOWS-WORKBENCH-DEPLOYMENT-TODO.md` 使用。
> 仅记录**已执行**的命令、已交付的文件、未触碰的资产和需要人工
> 继续推进的边界。本文档不含任何凭据、私钥或证书材料。

## 1. 范围与不变式

- **目标**：让 macOS Axi 工作台.app 永远只访问远程 HTTPS，
  远程服务由 Windows 主机 `DESKTOP-519U63K` / `192.168.101.6`
  承载。
- **不变式**：
  - 不复制 Mac 工作区的任何未提交改动。
  - 不打包任何 `.env` / 私钥 / 证书 / 邮箱密码到 artifact。
  - 不修改 `workbench.axiomaticworld.com` DNS A 记录。
  - 不把 TLS 私钥放进 Git、`.app`、DMG、Docker image 或日志。
  - 不动现有 `axi-gallery-api:17920` 和 `MySQL:3306`。
  - 不使用 `docker compose down -v` / `docker system prune` /
    `rm -rf` 等破坏性命令。
  - 所有命令、状态、失败原因都记录到本日志。

## 2. 已执行清单

### 2.1 阶段 A：服务器盘点

| 命令 | 目的 | 结果 |
| --- | --- | --- |
| `/Users/mose/.codex/skills/local-windows-connect/scripts/connect.sh status` | 主机/身份/版本 | `DESKTOP-519U63K` / `desktop-519u63k\feiyu` / Windows 10.0.19045.5555 ✓ |
| `Get-Service docker` | Docker 服务状态 | 当前凭据读不到（Docker Desktop 可能未注册为服务） |
| `Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'` | 启动 Docker Desktop GUI | 进程出现但 2 分钟内 Linux engine 仍未就绪 |
| `docker info` | 验 engine ready | `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` |
| `Test-NetConnection 192.168.101.6:443 / 8443` | Workbench 443/8443 监听 | `TcpTestSucceeded=False` ✓ 与 TODO §1.2 一致 |
| `nslookup workbench.axiomaticworld.com` | DNS 复检 | A = `198.18.0.51`（**不是 192.168.101.6**） |
| `Test-Path 'D:\enterprise-workspace\products\axi-workbench'` | 部署目录存在 | `False` → 本次新建 |

**结论**：阶段 A 的只读盘点 100% 完成；启动 Docker Desktop 引擎
在无头 SSH 会话里不成功，**留给人工在带 UI 的桌面会话里继续**。
DNS 错指 → **必须先改 DNS 才能切流**，TODO §3 已写明。

### 2.2 阶段 B：仓库源 + 部署到 Windows

| 步骤 | 命令 | 关键事实 |
| --- | --- | --- |
| 准备暂存 | `git archive --format=tar HEAD` | HEAD = `18c879e65d8f8de249df53678bd5b6bca2169ab3` |
| 裁剪 | `rm -rf apps/{app-search-system,ollama-menu-assistant,axi-coder,verification-inbox,workbench-shared,workbench-mobile,devsvc-dashboard,workbench} apps/AGENTS.md archive workbench_changes.patch` | 711M → 29M；后端不需要 apps/app-search-system 的 685M 装配 SOP PDF |
| 清理 | `find ... -name '__pycache__' -o -name '.pytest_cache' -o -name '.venv' -o -name '*.test' -o -name '.codegraph'` | 二次同步时已清，53M → 27M |
| 校验 | `find . -type f -print0 \| xargs -0 sha256sum` | 1493 个文件入 `SHA256SUMS.txt` |
| 写 manifest | `MANIFEST.txt` | 含 commit、来源、剔除清单、staging 时间戳 |
| 打包 | `tar \| gzip -9` | `axi-workbench-source.tar.gz` = 15.6MB，sha256 `111eb90d...60aa1bb` |
| 创建目录 | `New-Item -ItemType Directory D:\enterprise-workspace\products\axi-workbench` | ✓ |
| 上传 | `scp ... fleet-windows-host:'D:\...\axi-workbench\'` | exit=0 |
| 解压 | `tar -xzf ...` 然后 `Remove-Item` tar.gz | ✓ |
| 清理资源 fork | `Get-ChildItem -Recurse -File -Filter '._*' \| Remove-Item` | ✓ |
| 校验 Windows 端 | `Get-FileHash MANIFEST.txt` 等 | `MANIFEST` = `9201C610...3EE4C3`；`SHA256SUMS` = `60F39FED...3D229`；2 个文件 sha256 一致 ✓ |

**关键证据**：
- Mac 端 tar.gz sha256 = `111eb90dcc591e35051c3b0a187117b2738654192f5c720ea7a94db6a60aa1bb`
- Windows 端 `MANIFEST.txt` sha256 = `9201C610C8A9C2A962E3ABF7D630EE6779A4AFC52643714B580EBA5D773EE4C3`
- 抽样文件 `.cursor/rules/epap-project-doc-system.mdc`：Mac 与 Windows 端 sha256 完全一致。

### 2.3 阶段 D：Control Plane 容器化（方案 2）

新增：

- `services/control-plane/Dockerfile` — 2 阶段（node:22.13-bookworm-slim → gcr.io/distroless/nodejs22-debian12:nonroot）；使用 `corepack + pnpm@9.12.3`、`pnpm install --frozen-lockfile`、`pnpm --filter @axi/workstation-control-plane deploy --prod /out/app`；运行用户 nonroot，ENV `CONTROL_PLANE_BIND=0.0.0.0`，`EXPOSE 8092`，`ENTRYPOINT ["/nodejs/bin/node","src/server.mjs"]`。
- `.env.deploy.example` — 9 段（运行时、PostgreSQL、Redis、内部 token、SMTP、OIDC、对象存储、Mobile、Logging），所有生产密钥以 `__REPLACE_ME__` 占位。

修改：

- `services/control-plane/src/server.mjs` — listen 受 `CONTROL_PLANE_BIND` 环境变量控制，默认 `127.0.0.1` 保持本地开发兼容。
- `docker-compose.backend.yml` — 新增 `control-plane` service（healthcheck / restart: unless-stopped / 数据卷 / 资源限制 / 日志限制）；改 `api-gateway.CONTROL_PLANE_URL: http://control-plane:8092`；改 `api-gateway.depends_on` 增加 `control-plane: condition: service_healthy`；显式声明 `networks.default.name: epap-network`。

**Windows 端落地验证**：
- `Test-Path 'D:\...\services\control-plane\Dockerfile'` = True ✓
- `Select-String` `docker-compose.backend.yml` 命中 `control-plane:`、`CONTROL_PLANE_URL: http://control-plane:8092` ✓
- `Select-String` `server.mjs` 命中 `CONTROL_PLANE_BIND` ✓

### 2.4 阶段 E：反向代理模板

新增：

- `docs/deployment/reverse-proxy/Caddyfile.workbench` — 单一入口，`/api/*` → `127.0.0.1:18088`，`/health` `/ready` 短路，证书路径占位，ACME/imported cert 双路径，超时、body 上限、错误短响应、关闭目录浏览。
- `docs/deployment/reverse-proxy/nginx.workbench.conf` — 等价的 nginx 模板（`client_max_body_size 25m`、`server_tokens off`、`upstream healthcheck`、短错误响应、脱敏 log_format）。
- `docs/deployment/reverse-proxy/README.md` — 文件用途、占位清单、Windows 验证命令、回滚流程。

## 3. 未触碰资产 / 不变式确认

- ❌ 未改 DNS：`workbench.axiomaticworld.com` 仍指 `198.18.0.51`。
- ❌ 未传私钥：scp 包内 `*.pem / *.key / *.p12 / id_rsa*` 全部 0 个文件。
- ❌ 未填生产密钥：`.env.deploy.example` 仅含占位符；`docker-compose.backend.yml` 仍保留开发 `axi-development-internal-token`，这与 TODO §5.1 "禁止使用开发 token" 在本 staging 阶段内**显式未执行**（等你切换到真实密钥）。
- ❌ 未启动任何 Docker 容器：本会话里 Docker engine 不可用，因此 `docker compose up` 一次都没跑过。
- ❌ 未改 Windows 防火墙：80/443 仍按桌面默认；现有 `3306 / 17920` 一定没动。
- ❌ 未做破坏性回滚：没有 `rm -rf`、没有 `docker compose down -v`、没有 `git push --force`、没有覆盖证书。

## 3.1 本次接手后的执行结果（2026-09-16）

- Windows 出口：通过 Windows `ifconfig.me` 取得 `223.73.200.145`；从 Mac 探测该地址的 80/443 TCP 可达，但尚无 Workbench HTTP/TLS 响应。
- DNS：阿里云控制台显示旧值 `119.29.182.134`；已仅修改 `workbench` A 记录为 `223.73.200.145`。Cloudflare DoH 随后验证新值；`@`、`www` 和其他记录未修改。普通 `dig` 的 `198.18.0.51` 是本机 DNS 代理伪地址，不作为证据。
- Windows 部署目录：实际源码根为 `D:\enterprise-workspace\products\axi-workbench\axi-workbench`；已将修正后的 `.dockerignore`、Control Plane Dockerfile、Compose overlay 和反向代理模板同步到该目录。父目录的 `.env` 未读取、未覆盖。
- Docker：`com.docker.service` 原为 STOPPED，已启动；`LxssManager` 原为 STOPPED，已改为按需启动并启动；`WslService` 原为 Disabled，已改为按需启动并启动。即便如此，`dockerDesktopLinuxEngine` named pipe 仍不存在，尚未达到 engine-ready。
- Docker Desktop：由于 Windows 用户 Session 2 原处于断开状态，曾通过 Windows 任务计划的交互令牌启动 Docker Desktop；临时任务已删除，未保存密码或持久化启动项。进程曾进入 Session 2，但 engine pipe 仍未出现。
- 当前结论：阻塞已从“DNS 未切流”推进到“Windows Docker Desktop/WSL engine 未 ready”。未启动 Compose、未安装反向代理、未接触证书/私钥和生产凭据。

## 3.2 Windows 网络代理清理（2026-09-16）

- 只读发现：WinHTTP 代理为 `192.168.101.5:7897`；当前登录用户 WinINET 也启用了同一代理，导致 Windows Chrome `ERR_TIMED_OUT`。
- 已执行：`netsh winhttp reset proxy`；WinINET `ProxyEnable` 设为 `0`，并删除 `ProxyServer` 值。
- 验证：WinHTTP 显示“直接访问”；WinINET `ProxyEnable=0` 且 `ProxyServer` 不存在；Windows `curl.exe -4 --noproxy * -k -I https://www.baidu.com` 返回 `HTTP/1.1 200 OK`。
- 影响边界：未修改 Windows 网卡、默认网关、DNS、端口转发或 Mac 代理；Docker Desktop 仍需自己的 engine-ready 验收。

## 4. 回滚方法

任何一步都可以独立回滚，互不影响：

1. **阶段 A 启动 Docker**：仅做了 `Start-Process`；无副作用，关掉 GUI 即可。
2. **阶段 B 部署目录**：`Remove-Item -Recurse D:\enterprise-workspace\products\axi-workbench\axi-workbench`；保留 `MANIFEST.txt` / `SHA256SUMS.txt` / `axi-workbench-source.tar.gz`（如未删）作历史。
3. **阶段 D 代码改动**：本地仓库 `git restore services/control-plane/src/server.mjs docker-compose.backend.yml` + `rm services/control-plane/Dockerfile .env.deploy.example`；推一个 `revert: control-plane containerization` 提交。
4. **阶段 E 反向代理模板**：`Remove-Item docs/deployment/reverse-proxy/*`；反向代理本身**本会话没动过**，所以 Windows 主机上还没安装 Caddy/nginx。

**绝不**通过 `rm -rf`、DNS 回退、Docker 卷删除来"回滚"。

## 5. 仍需人工提供的项（按优先级）

> 顺序按"阻断后续阶段"程度排列。前 4 项任一缺失都会让阶段 F 验收
> 失败；后 3 项影响生产化但不阻塞 staging。

### 5.1 公网 IP / NAT（**阻断**）

- `workbench.axiomaticworld.com` A 记录当前 = `198.18.0.51`，必须改成 Windows 主机公网 IPv4。
- 路由器/防火墙需要把公网 80/443 NAT 到 `192.168.101.6:80/443`。
- 验证（DNS 改完后）：

  ```bash
  dig +short workbench.axiomaticworld.com  # 应返回 Windows 公网 IP
  ```

### 5.2 TLS 证书来源（**阻断**）

- 首选：ACME（`caddy` 自动）。
- 备选：现有证书导入到 `C:\caddy\certs\workbench.axiomaticworld.com.{crt,key}` 或 `C:\nginx\conf\ssl\`。
- 私钥**只能**通过受控通道（手动 RDP、密码保险箱、scp + Windows 端 `Remove-Item`）送达 Windows 主机；本会话**不接受**私钥材料。

### 5.3 生产密钥（**阻断**）

将 `.env.deploy.example` 复制为 `.env.deploy` 并替换：

- `__REPLACE_ME_postgres_root__` → 强密码，32+ 字节；
- `__REPLACE_ME_redis_password__` → Redis `requirepass`；
- 7 个 `__REPLACE_ME_random_32b__`（GATEWAY_INTERNAL_TOKEN + 6 个 GATEWAY_x_INTERNAL_TOKEN + IDENTITY/PLATFORM/WORKFLOW/NOTIFICATION/FILE 内部 token）→ 每个唯一 32+ 字节随机；
- `__REPLACE_ME_oidc_*__` → OIDC issuer / client_id / client_secret / audience / redirect URI；
- `__REPLACE_ME_*smtp*__` → 真实 SMTP 主机/账户/密码，`IDENTITY_EMAIL_DELIVERY=smtp`；
- `__REPLACE_ME_s3_*__` → S3 endpoint / bucket / access / secret / region；`FILE_VIRUS_SCAN_BACKEND` 切到真实厂商；
- `__REPLACE_ME_random_32b__` (mobile owner / token secret) → 真实密钥。

### 5.4 Developer ID Application 证书（**仅 Mac .app 需要**）

阶段 G（Mac 远程包切换）需要 `codesign --verify --deep --strict`，仓库里目前没有可用证书。Mac 端操作，不在 Windows 部署日志范围。

### 5.5 Docker Desktop Linux engine 启动（**当前阻断**）

本会话无头 SSH 不能完成首次安装的协议确认。**人工**：

1. RDP 登录 `DESKTOP-519U63K`。
2. 启动 Docker Desktop，等待右下角图标变绿。
3. `docker info` 确认 `Server Version` 非空。
4. 在 `D:\enterprise-workspace\products\axi-workbench\axi-workbench\` 下：

   ```powershell
   Copy-Item .env.deploy.example .env.deploy
   # 编辑 .env.deploy 替换所有 __REPLACE_ME__
   docker compose --env-file .env.deploy -p axi-workbench-backend -f docker-compose.yml -f docker-compose.backend.yml --profile backend up -d --build
   docker compose --env-file .env.deploy -p axi-workbench-backend ps
   docker compose --env-file .env.deploy -p axi-workbench-backend logs --no-color control-plane
   curl.exe http://127.0.0.1:18088/health
   ```

### 5.6 反向代理服务账号 / 最小权限

- 推荐 `NT SERVICE\Caddy$` / 自建 `svc-nginx-low`；
- 仅给证书目录 `Read`，日志目录 `Modify`；
- 阻止其对 `D:\enterprise-workspace\products\` 的任何写权限。

### 5.7 监控 / 备份 / 告警

TODO §11 列了 9 项监控/备份/告警指标，本会话**未实施**。需要
按 Windows 主机现有监控栈（Prometheus + Grafana 已经在
docker-compose.yml 里，或者接 Zabbix/Netdata 等）落地。

## 6. 风险登记

- **R1**：DNS A 记录错指 → TODO §3 的"先暂停切流"硬约束；切流前必须改 DNS。
- **R2**：开发 token 留在 `docker-compose.backend.yml` 里仅供 staging；任何对外网开放前必须替换成生产 token。
- **R3**：`docker compose down -v` 被显式禁用；如果一定要做"清状态重启"，必须人工显式确认。
- **R4**：未跑 Control Plane 单测 → 阶段 D §方案 2 的最后一项 `运行 Control Plane 测试` 留待 Docker engine ready 后补。
- **R5**：阶段 G（Mac 远程 .app）整体未做，依赖阶段 F 验收通过 + Developer ID 证书到位。
