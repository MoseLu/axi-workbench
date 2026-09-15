# Axi Workbench 远程 HTTPS + Windows Server 部署 TODO

状态：待 Claude agent 执行

目标：让 macOS Axi 工作台.app 像 Codex / Bilibili 客户端一样只访问远程 HTTPS，不在用户 Mac 上启动 Node、Go、Docker、PostgreSQL、Redis 或本机 HTTPS。远程服务由 Windows 主机 DESKTOP-519U63K 提供。

## 0. 给 Claude agent 的执行约束

- 始终使用中文报告；所有命令、验证结果和未完成项必须写回本 TODO 的勾选状态或交付报告。
- 先读项目根 AGENTS.md、apps/AGENTS.md、services/AGENTS.md、docs/04-backend.md、docs/planning/PUB-01-public-ingress-planning.md 和 docs/specs/PUB-09-release-closure/RELEASE-PLAN.md。
- Windows 连接必须使用本地技能入口：

    /Users/mose/.codex/skills/local-windows-connect/scripts/connect.sh status
    /Users/mose/.codex/skills/local-windows-connect/scripts/connect.sh ps '<PowerShell command>'

- SSH 合约：alias fleet-windows-host，主机 DESKTOP-519U63K / 192.168.101.6，用户 feiyu。不要询问或打印明文密码。
- 不使用 rm -rf、docker compose down -v、数据库删卷、强制覆盖证书或强制推送。
- 不把 .env、JWT、SMTP 密码、数据库密码、API key、TLS 私钥、SSH 私钥提交 Git 或写入日志。
- 所有公网 HTTPS 验收禁止使用 curl -k 或关闭证书验证。
- 不要把 Windows 上现有的其他项目当成 Workbench：已知 axi-gallery-api 使用 17920，MySQL 使用 3306，不得占用或停止它们。
- 每个阶段先做只读检查；确认目标后再做有边界的变更；所有外部状态变化都记录回滚方法。

## 1. 当前事实与未完成边界

### 1.1 客户端代码现状

- [x] 正式桌面构建默认目标已切为 https://workbench.axiomaticworld.com。
- [x] 正式远程包不启用 AXI_DESKTOP_LOCAL，不调用本机 supervisor。
- [x] 本机项目模式保留为显式开发用途：pnpm build:desktop:local。
- [x] Rust Gateway 代理保留精确 HTTPS 主机白名单和 TLS 校验。
- [x] 登录页只在本机模式显示本机运行时门禁；远程模式不启动本地后端。

### 1.2 Windows 主机已知状态（2026-09-16）

- [x] SSH 可连接，身份为 desktop-519u63k\feiyu。
- [x] 工作区根目录为 D:\enterprise-workspace，不是当前 Axi Workbench 仓库。
- [x] 未发现 Workbench 的 443、8443、8088、8092、8081、8082 监听。
- [x] Docker CLI 已安装，但 Docker Desktop Linux engine 当时未运行。
- [x] 未发现可直接复用的 Workbench Node/Go 服务。
- [x] 已知端口 17920 为 axi-gallery-api，3306 为 MySQL；不得改动。
- [ ] Workbench 源码或发布包部署到 Windows。
- [ ] PostgreSQL、Redis、Workbench 服务在 Windows 服务器端启动。
- [ ] workbench.axiomaticworld.com 的公网 DNS/NAT/防火墙指向并允许 Windows HTTPS。
- [ ] Windows 上安装或配置覆盖 workbench.axiomaticworld.com 的证书。
- [ ] 远程 /health、/ready、登录、验证码和会话恢复验收。

## 2. 目标架构

    Mac Axi 工作台.app
      └─ Rust native gateway proxy
           └─ HTTPS + SNI: workbench.axiomaticworld.com:443
                └─ Windows Server reverse proxy
                     ├─ /api/*  -> Workbench API Gateway
                     └─ /health -> Gateway health

    Windows Server only
      ├─ reverse proxy + TLS
      ├─ API Gateway
      ├─ Identity Adapter
      ├─ Platform Core
      ├─ Control Plane
      ├─ Workflow / Notification / File services as required by routes
      ├─ PostgreSQL
      └─ Redis

Mac 端不得再出现以下启动链路：

    ensure-local-runtime.mjs
    docker compose
    go run
    node services/control-plane
    serve-local-https.mjs

服务器端可以使用 Docker Desktop；“不依赖 Docker”仅针对 Mac 客户端，不是要求服务器禁止容器化。

## 3. 阶段 A：服务器盘点与网络确认

- [ ] 用 connect.sh status 保存主机、身份、当前目录和 Windows 版本证据。
- [ ] 盘点 D:\enterprise-workspace 下的项目、服务、Compose、证书目录；不要递归读取无关用户目录。
- [ ] 确认服务器磁盘、内存、CPU、Docker Desktop 版本和 Linux engine 状态。
- [ ] 确认现有端口并建立保留表：

  | 端口 | 归属 | 操作 |
  | --- | --- | --- |
  | 3306 | 现有 MySQL | 保留，不停止 |
  | 17920 | axi-gallery-api | 保留，不停止 |
  | 443 | 目标 Workbench HTTPS | 待配置 |
  | 80 | HTTP -> HTTPS 重定向或 ACME | 待确认 |
  | 内部服务端口 | 仅 Docker 网络或 127.0.0.1 | 不公网暴露 |

- [ ] 从 Windows 主机检查 workbench.axiomaticworld.com DNS 解析。
- [ ] 从局域网 Mac 检查 192.168.101.6:443 是否可达。
- [ ] 从公网网络检查域名 443 是否通过路由器/NAT 到达 192.168.101.6；如果公网 A 记录仍指向其他机器，先暂停切流。
- [ ] 检查 Windows 防火墙：只开放必要的 80/443，不开放 8081/8082/8088/8092、数据库或 Redis。
- [ ] 记录 DNS A/AAAA、NAT、Windows 防火墙规则和反向代理监听证据。

完成条件：公网请求确实能到 Windows 服务器，且不会影响 3306/17920 既有服务。

## 4. 阶段 B：获取 Workbench 发布源

优先使用已审核的 Git commit/tag，不直接复制 Mac 工作区的未提交状态。

- [ ] 确认发布 commit 至少包含：
  - 远程桌面模式提交 e7320a63；
  - 本机视觉资源修复提交 8171102c；
  - 普通构建视觉资源保护提交 da3f4f0f；
  - 运行期依赖门禁提交 06ed6909；
  - 当前需要部署的后续提交。
- [ ] 若 GitHub origin/dev 尚未包含这些提交，使用正式分支或受审计 artifact；不得把 .env 或证书打包进 artifact。
- [ ] 在 Windows 使用固定目录，建议：

    D:\enterprise-workspace\products\axi-workbench

- [ ] 目录必须经过 git status --short --branch、commit hash 和文件校验确认。
- [ ] 不要把 node_modules、dist、Docker volume、日志和私钥提交到 Git。
- [ ] 在服务器建立独立运行用户/目录权限；反向代理只读证书，服务进程只读必要配置。

## 5. 阶段 C：服务器端配置文件与密钥

### 5.1 必须配置的环境变量

由 Claude agent 根据当前生产合同整理实际值，以下只允许写占位符：

    ENVIRONMENT=production
    GATEWAY_PORT=8080
    GATEWAY_REDIS_URL=redis://redis:6379/0
    GATEWAY_REQUIRE_DURABLE_SESSION_STORE=true
    IDENTITY_ADAPTER_URL=http://identity-adapter:8081
    PLATFORM_CORE_URL=http://platform-core:8082
    WORKFLOW_SERVICE_URL=http://workflow-engine:8083
    NOTIFICATION_SERVICE_URL=http://notification-service:8084
    FILE_SERVICE_URL=http://file-service:8085
    CONTROL_PLANE_URL=http://control-plane:8092
    GATEWAY_PUBLIC_BASE_URL=https://workbench.axiomaticworld.com
    CORS_ALLOWED_ORIGINS=https://workbench.axiomaticworld.com

- [ ] 生产环境禁止使用 axi-development-internal-token、开发数据库密码、Mailpit、内存会话或 IDENTITY_EMAIL_DELIVERY=log。
- [ ] 生成并注入 Gateway、Identity、Platform、Control Plane、Workflow、Notification、File 的独立内部 token。
- [ ] 配置生产 PostgreSQL 用户、密码、数据库和迁移权限；运行时账号不得拥有迁移权限。
- [ ] 配置真实 SMTP/邮件服务，验证发信域、From 地址和退信策略。
- [ ] 配置真实身份服务/OIDC，核对 issuer、audience、scope 和 callback URL。
- [ ] 配置文件存储、病毒扫描和对象存储；生产不能沿用本地文件后端和 disabled scanner。
- [ ] 生产密钥只放 Windows 受限目录、Docker secrets 或服务器密钥存储，不放仓库。

### 5.2 TLS 证书

- [ ] 确认 workbench.axiomaticworld.com 证书 SAN 覆盖精确主机名，证书链完整，未过期。
- [ ] 推荐在 Windows 服务器上使用 ACME 自动续期；备选是将现有证书安全导入服务器证书目录。
- [ ] TLS 私钥不得进入 Git、.app、DMG、Docker image 或日志。
- [ ] 证书目录只授予反向代理服务账号读取权限。
- [ ] HTTP 80 仅用于 ACME 或 301/308 跳转到 HTTPS；不要提供业务 API over HTTP。

## 6. 阶段 D：服务器端容器与服务编排

当前仓库已有：

- docker-compose.yml：基础设施 PostgreSQL、Redis 等；
- docker-compose.backend.yml：backend profile、迁移、Identity、Platform、Workflow、Notification、File、API Gateway；
- services/*/Dockerfile：各服务镜像构建入口。

注意：现有 backend Compose 文档把 Control Plane 作为宿主机 8092 进程，并让 Gateway 通过 host.docker.internal 访问。Windows 服务器没有 Node/Workbench 服务时，必须选定一种方案并写入 ADR。

### 方案 1：Windows Node 服务

- [ ] 在 Windows 安装受支持的 Node LTS。
- [ ] 以 Windows 服务或受控任务启动 services/control-plane/src/server.mjs。
- [ ] 配置 CONTROL_PLANE_PORT=8092、生产环境和内部 token。
- [ ] 将 Control Plane 日志写入受限日志目录，禁止写用户桌面。
- [ ] 确认 Docker Gateway 到 host.docker.internal:8092 的访问合同。

### 方案 2：Control Plane 容器化（更推荐）

- [ ] 为 services/control-plane 增加生产 Dockerfile，固定 Node 基础镜像和依赖锁文件。
- [ ] 在 backend Compose 中增加 control-plane service，使用 Compose DNS http://control-plane:8092。
- [ ] 将 Gateway 的 CONTROL_PLANE_URL 改成 http://control-plane:8092。
- [ ] 为 Control Plane 增加 healthcheck、restart policy、日志限制和资源限制。
- [ ] 运行 Control Plane 测试，确认不把它错误地打进 API Gateway 镜像。

### 编排执行顺序

- [ ] 先启动 Docker Desktop Linux engine。
- [ ] 先启动 PostgreSQL/Redis，并等待健康状态，不只检查容器为 Up。
- [ ] 执行所有数据库迁移并保存输出。
- [ ] 启动 Control Plane、Identity、Platform、Workflow、Notification、File、API Gateway。
- [ ] 反向代理最后启动或最后切流，确保上游已 ready。
- [ ] 使用 docker compose ps、容器 healthcheck、服务 /health 和 /ready 同时验收。
- [ ] 所有业务容器只加入内部网络；API Gateway 只绑定 127.0.0.1 的宿主机端口，反向代理通过本机连接。
- [ ] 不使用 docker compose down -v 作为普通重启命令。

## 7. 阶段 E：Windows HTTPS 反向代理

推荐单一入口：

    https://workbench.axiomaticworld.com/
      /api/*   -> http://127.0.0.1:18088/api/*
      /health  -> http://127.0.0.1:18088/health
      /ready   -> http://127.0.0.1:18088/ready

- [ ] 反向代理监听 0.0.0.0:443，证书使用 workbench.axiomaticworld.com。
- [ ] /api 不改路径、不去掉必要前缀、不把请求转发到 axi-gallery-api。
- [ ] 设置 Host、X-Forwarded-Proto=https、X-Forwarded-For，WebSocket/长轮询按 Gateway 合同配置。
- [ ] 设置合理的 body、header、read timeout；不要无上限代理请求体。
- [ ] 关闭目录浏览和调试错误页。
- [ ] /api、/health、/ready 不允许错误暴露不应公开的内部接口。
- [ ] 443 证书链从 Mac、Windows 和公网第三方网络均能验证。
- [ ] 记录反向代理配置文件路径、运行用户、证书路径、reload 命令和回滚配置。
- [ ] 配置变更前运行语法检查并保存输出。
- [ ] 先 reload，再做端到端探针；失败则恢复上一份配置。

## 8. 阶段 F：远程 API 合同验收

### 8.1 TLS/DNS

- [ ] 从 Windows 本机执行：

    curl.exe --fail-with-body https://workbench.axiomaticworld.com/health

- [ ] 从 Mac 执行：

    curl --noproxy '*' --silent --show-error \
      https://workbench.axiomaticworld.com/health \
      -w '\nhttp=%{http_code}\n'

- [ ] 不使用 -k。
- [ ] 用 openssl s_client -connect workbench.axiomaticworld.com:443 -servername workbench.axiomaticworld.com 验证 SAN、链和 Verify return code。
- [ ] HTTP 访问自动 301/308 到 HTTPS。

### 8.2 Gateway/依赖

- [ ] /health 返回 Workbench Gateway 健康合同。
- [ ] /ready 只有依赖全部 ready 时返回成功。
- [ ] Redis 不可用时 Gateway 明确失败或 not-ready，不允许静默回退内存限流/会话。
- [ ] PostgreSQL 重启后迁移/连接恢复符合服务合同。
- [ ] 内部端口从公网不可达。
- [ ] API 响应头不泄露开发路径、token、堆栈或 Docker 信息。

### 8.3 认证/会话

- [ ] GET /api/v1/auth/session 未登录时返回 401 和未认证结构，而不是 404/503。
- [ ] 发送验证码前先确认真实 SMTP 配置、频控、审计和收件人范围。
- [ ] 使用测试邮箱完成一次验证码登录；测试凭据不得写入文档。
- [ ] 登录后刷新 App/重新打开 App，会话 cookie 仍符合 Secure/HttpOnly/SameSite 合同。
- [ ] 登出后 cookie 清除，旧会话不可继续访问。
- [ ] 测试错误验证码、过期验证码、频率限制和 Redis 重启恢复。

## 9. 阶段 G：Mac 远程包切换

- [ ] 确认 apps/workbench-desktop 当前源码为远程模式提交。
- [ ] 使用远程构建入口：

    pnpm build:desktop:remote

- [ ] 构建环境显式没有 AXI_DESKTOP_LOCAL=true。
- [ ] 检查 Tauri 编译 marker 为远程模式，不能因为残留 .build-profile 误编译为 local。
- [ ] 检查 .app 内容不包含 Node、Go、Docker、.env、.pem、.key、PostgreSQL 数据或 Redis 数据。
- [ ] 检查 VITE_API_BASE_URL=https://workbench.axiomaticworld.com 已注入。
- [ ] 检查构建不会改写 favicon、桌面图标和登录窗口资源。
- [ ] codesign --verify --deep --strict 通过。
- [ ] 替换 /Applications/Axi 工作台.app 前关闭旧 App；保留旧包的可恢复备份。
- [ ] Finder 双击远程包后，Mac 不出现本机 8081/8082/8088/8092/8443 新进程。
- [ ] App 的 /api 请求通过 Rust native proxy 访问远程 HTTPS，不直接绕过白名单。

## 10. 阶段 H：Mac 端到端验收

- [ ] Docker Desktop 在 Mac 关闭时，远程包仍能打开登录页并访问远程 /health。
- [ ] Mac 没有 Node/Go/pnpm 依赖时，远程包仍能启动 UI。
- [ ] lsof 证明远程包没有启动本机后端。
- [ ] 登录页不会出现“正在启动本机服务”或本机 Docker 错误。
- [ ] 真实远程 HTTPS 登录成功。
- [ ] 二维码、轮询、HttpOnly cookie、刷新、登出流程通过。
- [ ] 断开 Windows 服务时，登录页显示远程连接失败，不能伪装成验证码发送失败。
- [ ] 恢复 Windows 服务后，重试或重新打开 App 可以恢复。
- [ ] 从 Mac、Windows、至少一个公网网络分别验证 DNS/TLS/API。

## 11. 阶段 I：发布、监控、备份与回滚

- [ ] 建立 Windows 服务启动顺序和自动重启策略。
- [ ] Docker Desktop/Windows 重启后，数据库、Redis、Control Plane、业务服务和反向代理自动恢复。
- [ ] 监控：HTTPS 探针、Gateway /health、/ready、认证 401 合同、Redis/PostgreSQL、证书到期日。
- [ ] 日志集中保存但脱敏；设置保留周期和磁盘上限。
- [ ] PostgreSQL 备份、恢复演练和 Redis AOF/数据保留策略完成。
- [ ] 保存上一版本镜像、Compose 配置、反向代理配置和 Mac .app。
- [ ] 回滚顺序：停止切流 -> 恢复反向代理配置 -> 恢复上一版本镜像 -> 必要时恢复数据库迁移 -> 验证 /health /ready -> 再切流。
- [ ] 不回滚数据库数据卷，不删除卷；破坏性恢复必须另行确认。

## 12. 交付证据包

Claude agent 完成后必须交付：

- [ ] Windows 主机身份、部署目录、发布 commit。
- [ ] Docker/服务/反向代理状态和端口表。
- [ ] DNS、NAT、防火墙和证书 SAN/有效期证据。
- [ ] health、ready、auth/session、TLS 链验证输出。
- [ ] 数据库迁移和服务启动日志摘要，已脱敏。
- [ ] Mac 远程 .app 构建命令、签名验证、包内容检查。
- [ ] Mac 无本机后端进程的 ps/lsof 证据。
- [ ] 登录、刷新、登出、Redis/PostgreSQL 重启恢复结果。
- [ ] 未完成项、风险、回滚点和下一步。

## 13. 当前明确阻塞项

- [ ] Windows DESKTOP-519U63K 尚未部署 Axi Workbench 后端。
- [ ] Windows 没有当前可用的 Workbench 443/8443 HTTPS 入口。
- [ ] Windows Docker Desktop Linux engine 当前需要启动和配置。
- [ ] Windows 未发现 Node/Go Workbench 运行时；若采用宿主机 Control Plane 方案，需要安装 Node，或采用容器化方案。
- [ ] 当前公网 DNS workbench.axiomaticworld.com 的实际 A 记录、NAT 和 Windows 端口转发必须重新核对，不能仅凭域名备案证明服务已上线。
- [ ] TLS 私钥尚未授权或传输到 Windows 服务器；在没有明确授权前不得复制私钥。
- [ ] 远程服务未完成前，不得把 Mac 本机版 .app 当成远程生产包交付。

