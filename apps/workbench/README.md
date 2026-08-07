# Axi 工作台（`@axi/workbench`）

**唯一**面向用户的 Web + 移动 Web 工作台 SPA。  
不要再拆「移动端门户 / Web 门户」两个产品或两个启动目录。

| 项 | 值 |
|----|-----|
| 目录 | `apps/workbench` |
| 包名 | `@axi/workbench` |
| 启动 | 仓库根：`pnpm dev:workbench` |
| 本地 URL | http://127.0.0.1:5173 |
| 登录 | `/login`（邮箱密码 + 扫码同页；窄屏默认扫码） |
| 兼容 | `/mobile-login` → `/login?mode=qr` |

## 启动

```bash
cd /Volumes/code/workspace/projects/axi-workbench
pnpm install   # 首次
pnpm dev:workbench
```

API 代理默认指向 `localhost:8088`（见 `vite.config.ts`）。需登录时先起 api-gateway / auth-service。

## 与其它 apps 的关系

| App | 是否用户工作台 |
|-----|----------------|
| **workbench** | **是** — 本应用 |
| devsvc-dashboard | 否 — 本地 PM2 / 子应用 **Host**（运维壳） |
| axi-coder | 否 — 开发工具（可被 Host 挂载） |
| verification-inbox 等 | 否 — 垂直工具 |

Android 原生通知客户端在仓库 **`projects/axi-notify`**，属于通知通道，不是第二份工作台产品。
