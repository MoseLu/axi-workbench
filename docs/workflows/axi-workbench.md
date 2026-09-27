# Axi Workbench 专属工作流

本文件承载 `WB-AUTH-001`、`WB-DESKTOP-001` 和 `WB-SMTP-001`。工作流目录、字段规范和新增模板见 [`README.md`](./README.md)。它补充根级 `AGENTS.md`，不替代应用、服务和工作区治理规则。

## 工作流共同契约

- 每个工作流都必须从入口执行到闭环验收；不能把“已发送验证码”“服务健康”或“构建成功”单独报告为完成。
- 每个阶段必须记录事实源、动作、结果和下一阶段条件；遇到失败先按该阶段的失败处理继续排查。
- 已有账号、SMTP/IMAP、浏览器会话和本地服务都应先检查再向用户索要信息。
- 只有验证码、一次性批准等用户独占信息确实无法从授权会话取得时，才暂停请求用户提供。
- 涉及邮件时，SMTP 是发信通道，IMAP/POP3 是收信通道；若授权码支持多协议，应按实际协议能力使用，不能只检查 SMTP。

## 1. 进入与边界

- 项目根：`/Volumes/code/workspace/workbench/axi-workbench`
- Web：`apps/workbench`，默认开发端口 5173
- Desktop：`apps/workbench-desktop`，Tauri 2；验收目标是安装到 `/Applications/Axi 工作台.app` 的应用
- 身份服务：`services/identity-adapter`，本地监听 8081
- API Gateway：`services/api-gateway`，本地监听 8088
- 本地环境变量来自项目根 `.env`；该文件已被 gitignore，禁止把其中的密码、验证码、Cookie 或 token 写入代码、日志和文档。

## 2. 常规开发与桌面交付

```bash
pnpm dev:workbench
pnpm dev:desktop
pnpm build:desktop:local
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench-desktop verify:contracts
```

桌面交付必须按“构建 → 替换 `/Applications/Axi 工作台.app` → 启动 → 用 CUA 检查实际窗口和路由”完成。开发服务器页面或构建产物存在，不等于已交付安装包。

## WB-AUTH-001：自动登录闭环

### 入口

用户要求“帮我登录”，且目标是当前安装的 Axi Workbench Desktop。起始页面通常是 `tauri://localhost/login?next=%2F`。

### 权威事实源

- 已保存账号：应用/浏览器本地存储中的最近账号记录，以及登录页当前表单。
- 发信状态：身份服务日志和 SMTP greeting/投递结果。
- 收信状态：已授权的 IMAP/POP3 会话或已登录邮箱网页。
- 最终状态：CUA accessibility tree 中的主窗口和 `/admin/dashboard` 路由。

### 执行阶段

1. **启动会话探测**：桌面端先显示独立登录窗口内的 `SessionLoading`；在首次 `/api/v1/sessions/current` 探测结束前，不渲染登录表单。若已保存会话有效，探测完成后直接切主窗口；若无效，再显示登录表单。后续发送验证码/密码提交的 loading 不得替换已经打开的登录表单。
2. **解析账号**：先读取已保存邮箱；如果表单未回填，主动回填，不要立即要求用户重复提供邮箱。注意 `lastAccount` 目前主要用于快捷会话探测，不代表验证码表单会自动回填。
3. **检查登录前提**：确认协议勾选、身份服务 8081、API Gateway 8088 和本地应用窗口可用。
4. **发送验证码**：通过 UI 点击验证码登录，确认界面从“验证码登录”变为“发送中”，随后进入验证码输入状态。若失败，进入 `WB-SMTP-001`，不要直接归因于邮箱或授权码。
5. **读取验证码**：优先使用已授权的 IMAP/POP3 收件能力读取最新 Axi 验证邮件；若只有网页会话，打开已登录邮箱读取。SMTP 密钥本身不能读取收件箱，但支持 IMAP/POP3 时应使用同一授权码建立收件会话。
6. **回填并提交**：回填六位验证码，提交登录，等待窗口切换，不要在“验证码已发送”阶段停下。
7. **闭环验证**：确认登录窗口消失、主窗口标题为 `Axi 工作台`、路由为 `/admin/dashboard`，并检查主导航和用户账号标识。

### 失败处理

- 找不到邮箱：先检查本地存储和已登录浏览器资料，再向用户询问。
- SMTP greeting 前 EOF：检查网络出口/代理/防火墙；这不是授权码认证失败。
- SMTP greeting 成功但认证失败：检查授权码、账号和 PM2 是否加载最新 `.env`。
- 验证码已发送但 IMAP/POP3 取不到：检查收信协议、文件夹、邮件延迟和授权码权限；不要要求用户手工转发，除非所有已授权收信路径都不可用。
- 验证码提交失败：重新读取最新邮件，避免使用旧码；检查挑战是否过期。
- 主窗口未出现：检查 Tauri shell 登录成功事件、窗口切换和 `next` 路由。

### 完成条件

必须同时满足：真实邮件已发送、验证码已从收件通道取得、验证码提交成功、安装应用已进入 `/admin/dashboard`。只满足其中一项都不能报告“已登录”。

## WB-DESKTOP-001：构建、安装与验收

1. 启动本地身份服务、API Gateway 和 Web/桌面应用。
2. 在登录页使用已保存的邮箱账号；邮箱回填和快捷会话是两条独立链路，`lastAccount` 记录不会自动把邮箱写入验证码输入框。
3. 勾选服务条款后发送验证码。
4. 验证码必须来自实际邮箱；不得从日志、数据库 token hash 或源码推断验证码。
5. 登录成功后检查窗口是否从固定尺寸登录窗切换到主窗口，并确认路由为 `/admin/dashboard`。

## WB-SMTP-001：身份服务与邮件通道排查

先检查配置是否存在，再检查进程是否加载，最后检查 SMTP 首行握手。禁止打印密码值：

```bash
# 只检查非敏感字段和密码是否存在/长度，不输出密码
awk -F= '/^(SMTP_HOST|SMTP_PORT|SMTP_USERNAME|SMTP_PASSWORD|SMTP_FROM|IDENTITY_EMAIL_DELIVERY)=/ {
  if ($1 == "SMTP_PASSWORD") print $1 "=<present length=" length($2) ">"
  else print $1 "=" $2
}' .env

ps eww "$(pgrep -f 'go run ./cmd/identity-adapter' | head -1)" \
  | tr ' ' '\n' | rg '^(SMTP_|IDENTITY_EMAIL_DELIVERY)=' \
  | sed -E 's/(PASSWORD|PASS|SECRET|TOKEN)=.*/\1=<REDACTED>/'

curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8088/health

# SMTP 必须先返回服务器 greeting；只建立 TCP 但收到空响应仍算失败。
python3 - <<'PY'
import socket
for host, port in (("smtp.qq.com", 587), ("smtp.qq.com", 465)):
    try:
        sock = socket.create_connection((host, port), 5)
        sock.settimeout(5)
        print(host, port, repr(sock.recv(128)))
        sock.close()
    except Exception as exc:
        print(host, port, type(exc).__name__, str(exc))
PY
```

错误定位规则：

- `health` 失败：先重启 `pnpm devsvc restart axi-workbench-identity-adapter`，等待 Go 依赖编译完成后再检查 8081。
- 能连 TCP 但首行是 `b''` / 日志为 `create smtp client: EOF`：失败发生在 SMTP 认证前，优先检查网络出口、代理、运营商/防火墙对 587/465 的限制；此时不能通过更换验证码逻辑修复。
- 能收到 greeting 后出现 `authenticate smtp client`：再检查 QQ 邮箱 SMTP 授权码是否过期、账号是否开启 SMTP、`.env` 是否被 PM2 重新加载。
- `finalize smtp body` / `550`：SMTP 已认证，问题在收件地址或 QQ 投递策略。

历史故障记录（2026-09-26）：`.env` 与 PM2 均加载了 `smtp.qq.com:587`、账号和非空密码；当时本机直连 QQ SMTP 的 587/465 在 greeting 前返回 EOF。网络调整后 587 返回正常 greeting，验证码发送恢复。该案例证明“配置存在”不能替代“网络握手可达”证据。

### 收信通道检查

当授权码声明支持 POP3/IMAP 时，验证码工作流应继续检查收信能力。QQ 邮箱通常使用 `imap.qq.com:993`（SSL）或 `pop.qq.com:995`（SSL）；只记录连接/认证成功和邮件主题、时间等非敏感证据，不把授权码或完整邮件正文写入日志。

## 分层验证

```bash
pnpm devsvc health axi-workbench-identity-adapter
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test -- src/components/Auth/SessionLoading.test.tsx
```

登录验证需要真实收到邮件并完成一次验证码确认；仅有服务健康、编译通过或 API 返回 2xx，不足以宣称登录成功。
