# Axi 工作台（`@axi/workbench`）

Web 管理端应用。它拥有 Axi Dashboard Chrome、侧栏、顶栏、标签栏、面包屑和设置面板；不再按 viewport 渲染移动端壳。

| 项 | 值 |
|----|-----|
| 目录 | `apps/workbench` |
| 包名 | `@axi/workbench` |
| 启动 | 仓库根：`pnpm dev:workbench` |
| 本地 URL | http://127.0.0.1:5173 |
| 登录 | `/login`（邮箱密码 + 扫码同页） |
| 移动端 | 独立应用 `apps/workbench-mobile`，开发 URL 为 http://127.0.0.1:5174 |

## 启动

```bash
cd /Volumes/code/workspace/projects/axi-workbench
pnpm install   # 首次
pnpm dev:workbench
```

开发服务器仅绑定 IPv4 HTTP `http://127.0.0.1:5173`，并从本目录的 `.env*` 文件
加载 Vite 环境变量。`/api` 代理目标优先使用去首尾空白后非空的
`VITE_API_PROXY_TARGET`（必须是 HTTP(S) URL；无效值会使 Vite 启动失败）；空或全
空白时才依次取精确 loopback（`localhost`、`127.0.0.1`、`::1`）的
`VITE_API_BASE_URL` 与默认 `http://127.0.0.1:8088`。因此
`VITE_API_BASE_URL=http://127.0.0.1:9090` 会让同源
`/api` 请求代理到 9090；远端 `VITE_API_BASE_URL` 时，只有经 `resolveGatewayURL`
构建的 Gateway/auth 请求会继续由浏览器直接访问，不会被相对化。这里识别 `::1` 仅
用于 Gateway 配置选择，不会让 Vite 监听 IPv6 或 HTTPS。邮箱登录依赖
identity-adapter；概览页还依赖 platform-core 与 control-plane。

本地完整登录与概览链路需要同时运行以下服务（各开一个终端）：

```bash
make dev-identity       # 邮箱验证码与会话身份适配器（8081）
make dev-platform       # 偏好、租户与项目数据（8082；无数据库时使用内存存储）
make dev-control-plane  # 工作区快照与调度控制面（8092）
make dev-gateway        # 浏览器 API 入口（8088；从 .env 的 SMTP_USERNAME 识别本地 owner）
pnpm dev:workbench      # Web（5173）
```

`make dev-gateway` 会静默读取仓库根 `.env`。邮箱验证码登录是个人工作台的
owner-only 能力：`EMAIL_LOGIN_OWNER_EMAIL` 为空时在本地开发脚本中回退到
`SMTP_USERNAME`，并使用 `EMAIL_LOGIN_SUBJECT`（默认 `audit-user`）作为稳定主体；
生产环境仍必须显式注入这两个变量。

## 公网域名

Workbench 的公网入口使用 `https://workbench.axiomaticworld.com`，与其他 Axi
产品通过不同子域名共享父域 `axiomaticworld.com`。生产 Web 构建应将
`VITE_API_BASE_URL` 注入为该同源地址；本机开发保持默认的回环 Gateway，不要把
公网地址写入本地 `.env`。

## 与其它 apps 的关系

| App | 是否用户工作台 |
|-----|----------------|
| **workbench** | **是** — 本应用 |
| **workbench-mobile** | **是** — 独立移动端应用；仅共享认证 / API / 契约 / locale / tokens |
| devsvc-dashboard | 否 — 本地 PM2 / 子应用 **Host**（运维壳） |
| axi-coder | 否 — 开发工具（可被 Host 挂载） |
| verification-inbox 等 | 否 — 垂直工具 |

Android 原生通知客户端在仓库 **`projects/axi-notify`**，属于通知通道，不是第二份工作台产品。
