# Axi Verification Inbox

本地 Outlook/IMAP/OTP 验证码读取工具，工作目录为 `/Volumes/code/workspace/projects/axi-workbench/apps/verification-inbox`。

## 当前架构

- 主 UI：Tauri 2 + React + Vite + TypeScript。
- 视觉目标：对齐 `cockpit-tools` 首屏，尤其左侧悬浮胶囊菜单。
- 后端桥接：Tauri command 调用 `backend/imap_service.py`，复用现有 IMAP/OAuth/OTP 逻辑。
- 旧入口：`imap_code_app.py` 和 `imap_code_web.py` 暂时保留为迁移参考，不再作为新主入口。
- Dashboard 托管：可通过 Axi DevSvc Dashboard 打开 `/apps/axi-verification-inbox/`；该模式只承载统一入口和只读壳层，真实收码/授权仍需要桌面 Tauri 后端。

## 常用命令

```bash
# 如果使用 Codex bundled Node runtime，可先放到 PATH 前面
export PATH=/Users/mose/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH

pnpm typecheck
pnpm build
CARGO_NET_OFFLINE=true cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri dev
```

## 本地数据

- `11个outlook_整理表格.md`、`11个邮箱_整理表格.md`：本地凭据表。
- `otp_accounts.json`：OTP 账号覆盖配置。
- `imap_accounts.json`：额外 IMAP 账号覆盖配置，用来把账号池里的 Gmail、mail.com 系列、Outlook OAuth 或自定义 IMAP 账号变成可接码账号。参考 `imap_accounts.example.json`，真实文件已被 `.gitignore` 排除。
- `~/.antigravity_cockpit/codex_accounts.json`：用于对齐账号池顺序。

这些文件包含账号或 token 信息，已在 `.gitignore` 中默认排除。

## 额外 IMAP 配置

`imap_accounts.json` 的 `accounts` 按邮箱匹配账号池。匹配到的账号会显示为 `IMAP`，并复用同一套验证码读取逻辑。

```json
{
  "accounts": [
    {
      "email": "name@gmail.com",
      "password": "gmail-app-password",
      "provider": "gmail"
    },
    {
      "email": "name@engineer.com",
      "password": "mailbox-password",
      "provider": "mail.com"
    },
    {
      "email": "name@outlook.com",
      "auth_type": "oauth2",
      "provider": "outlook",
      "client_id": "microsoft-oauth-client-id",
      "refresh_token": "microsoft-refresh-token"
    }
  ]
}
```

- Gmail 需要开启 IMAP，并使用 Google app password 或 OAuth 后的可用凭据。
- `mail.com`、`europe.com`、`engineer.com`、`politician.com` 默认使用 `imap.mail.com:993`。这些邮箱通常需要在网页设置里开启 POP3/IMAP，部分账号可能需要 Premium。
- Outlook/Hotmail 普通密码通常不能直接 IMAP 登录；这里继续使用 OAuth2 refresh token。

### 获取 Outlook refresh token

不需要手工知道 refresh token。桌面应用里，账号池中的 Outlook/Hotmail 行会在操作列显示“授权”。点击后会自动打开 Microsoft 登录页，状态列显示一次性 code；用对应邮箱登录完成后，应用会自动写入 `imap_accounts.json` 并刷新为可接码的 IMAP 账号。

也可以用本地设备码脚本登录一次对应邮箱，脚本会把 token 写入 `imap_accounts.json`：

```bash
python3 outlook_oauth_device_login.py jessicastokes5281@outlook.com
```

脚本会打印 Microsoft 登录网址和一次性 code，并尝试打开浏览器。用目标邮箱完成授权后，脚本会更新本地配置文件；refresh token 不会打印到终端。
