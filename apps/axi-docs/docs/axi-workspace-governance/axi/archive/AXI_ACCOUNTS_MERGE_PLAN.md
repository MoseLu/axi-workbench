# Axi Accounts 功能合并方案

生成时间：2026-05-25  
范围：`axi-coder`、`imap`、Axi Accounts contract docs，以及 `cockpit-tools` reference 中可借鉴的账号/运行时 UI 经验

## 目标

本方案解决账号、收码和 provider 三类能力之间最容易误合并的边界：

- Axi Accounts Contract：账号、凭据引用、配额、多实例、切号、唤醒任务的 schema/contract 占位；当前不绑定具体 runtime repo。
- `imap`：邮箱验证码、OTP、Outlook OAuth device flow owner，后续应降级为 Axi Accounts 的 Verification Inbox 子模块。
- `axi-coder`：模型 provider、CLI route、本地代理、CLI 配置接管/恢复 owner，候选产品线为 Axi Coder。
- `cockpit-tools`：外部/reference 项目，不算 Axi 应用或 Axi owner；只作为账号/运行时 UI 经验参考，不 fork/rebrand 为 Axi Accounts。

结论不是把 `imap` 或 `cockpit-tools` 直接塞进 `axi-coder`。三者有协作点，但 owner 不同；过早合仓会把账号生命周期、邮箱授权和 provider routing 混成一个不可维护的桌面杂糅。`cockpit-tools` 只保留 reference 身份。

## 关键结论

| 结论 | 判断 |
|---|---|
| `cockpit-tools` 不应因为与 `axi-coder` 都涉及 Codex/provider 就删除或改名 | 它是外部/reference 项目；主体能力可作为账号/实例/配额/切号设计参考，但不承接 Axi Accounts owner |
| `imap` 不应按“小工具”直接归档 | 它实现了账号池对齐、IMAP/OTP 收码、Outlook device code 授权和 token 写回，是 Axi Accounts 缺失的 verification inbox 能力 |
| `axi-coder` 不应接管账号池生命周期 | 它的实现核心是 provider 保存、模型发现、route、proxy、CLI takeover/restore 和请求诊断；账号、配额、实例不是它的 owner |
| provider 能力需要共享合同 | `cockpit-tools` reference 中有 Codex `openai_base_url` / `model_provider` / 自定义 provider 推断经验；`axi-coder` 已有 provider kind、secret ref、model route、proxy request log。应抽成合同，而不是复制实现 |

## 证据摘要

| 项目 | 直接证据 | 结论 |
|---|---|---|
| `axi-coder` | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/README.md:3` 定义为 AI coding CLI control surface；`:7-12` 范围是 provider setup、本地 proxy、CLI takeover/restore、diagnostics、request log、route controls、Ollama scan | Axi Coder owner：provider/model routing、local proxy、CLI managed config |
| `axi-coder` | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/src-tauri/src/cli_config.rs:24-30` 只支持 Claude/Codex/Gemini takeover；`:65-85` 写 Codex `config.toml` 和 `auth.json` 占位 token；`:177-203` 写入 `[model_providers.axi_coder]`、`base_url`、`env_key` | 它是在改 CLI 指向本地代理，不是在管理多账号池 |
| `axi-coder` | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/src-tauri/src/proxy/mod.rs:18-19` 固定本地代理 `127.0.0.1:15721`；`:84-154` 按 path/CLI 解析 route、provider、secret、model 并转发；`:197-238` 处理 Anthropic/OpenAI Responses/Gemini/OpenAI Chat/Ollama request shape | Provider/proxy 合同应以这里为 canonical 起点 |
| `cockpit-tools` | `/Volumes/code/workspace/references/cockpit-tools/README.md:10` 定义为通用 AI IDE 账号管理工具；`:18-20` 明确一键切号、多账号、多实例、配额监控、唤醒任务、设备指纹、插件联动；`:64-80` 明确 Codex 账号和 Codex 多实例 | 只作为 reference evidence；不重命名、不纳入 Axi owner |
| `cockpit-tools` | `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/commands/codex.rs:16-31` 列出账号、当前账号和 Codex 配置路径；`:98-168` 切换账号并同步默认实例绑定；`:170-203` 切号后修复会话可见性；`:205-274` 同步 OpenCode/OpenClaw/Codex 启动策略 | 可参考账号切换后的周边状态和实例联动，但 Axi 侧只沉淀合同/fixture |
| `cockpit-tools` | `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/modules/codex_account.rs:21-35` 定义 Codex account check、API key mode、`openai_base_url`、`model_provider`、context window 等常量；`:156-192` 解析 builtin/custom provider；`:226-248` 校验 API key/base URL；`:259-283` 把 API key/provider 写入账号字段 | Axi Accounts contract 可参考 account-scoped provider config；provider runtime 仍由 `axi-coder` 负责 |
| `imap` | `/Volumes/code/workspace/workbench/axi-workbench/apps/verification-inbox/README.md:1-10` 定义为本地 Outlook/IMAP/OTP 验证码读取工具，Tauri UI 调 Python bridge；`:24-31` 说明本地凭据与 `~/.antigravity_cockpit/codex_accounts.json` 对齐；`:65-75` 描述 Outlook refresh token device flow | Axi Accounts 的 Verification Inbox 子模块，而不是独立长期产品 |
| `imap` | `/Volumes/code/workspace/workbench/axi-workbench/apps/verification-inbox/src-tauri/src/lib.rs:7-20` UI account view 包含 `can_authorize`、password、`is_cockpit`；`:129-166` 暴露 `list_accounts`、`receive_code`、`begin_outlook_authorization`、`complete_outlook_authorization` | 前端接口已形成可迁移的最小 command contract |
| `imap` | `/Volumes/code/workspace/workbench/axi-workbench/apps/verification-inbox/backend/imap_service.py:41-69` 把账号转为可授权/可接码 view；`:135-197` 轮询 OTP/IMAP 新验证码；`:200-241` 开始 Microsoft device code；`:264-321` 完成授权、校验 token 与 IMAP、写回配置 | 应迁移为 Accounts 的 inbox credential + OAuth session 能力 |

## Owner 划分

| 能力 | Owner | 来源 | 边界 |
|---|---|---|---|
| Account profile | Axi Accounts Contract / future Axi Accounts host | Contract docs + `cockpit-tools` reference | 平台账号、邮箱、plan、组织、标签、状态、导入来源 |
| Credential reference | Axi Accounts Contract / future Axi Accounts host | Contract docs + `imap` | 统一只存 credential ref / secret ref；真实 token/password 不进入普通项目文档或 registry |
| Quota snapshot | Axi Accounts Contract / future Axi Accounts host | Contract docs + `cockpit-tools` reference | Hourly/weekly/model quota、reset time、last error、alert cooldown |
| Instance binding | Axi Accounts Contract / future Axi Accounts host | Contract docs + `cockpit-tools` reference | 每个 IDE/CLI/App instance 绑定账号、用户数据目录、启动参数和运行状态 |
| Account switch event | Axi Accounts Contract / future Axi Accounts host | Contract docs + `cockpit-tools` reference | 切号前后状态、auth 文件 mtime、session visibility repair、跨工具 auth sync |
| Wakeup task | Axi Accounts Contract + Axi Notify | Contract docs + `cockpit-tools` reference | 配额唤醒、自动切号、auto resume；通知只传事件和 ref |
| Verification inbox | Axi Verification Inbox / Axi Accounts 子模块 | `imap` | 邮箱/OTP 源、IMAP provider、Outlook OAuth、收码任务、授权状态 |
| Provider profile | Axi Coder + shared contract | `axi-coder` + account-scoped provider reference | provider kind、base URL、wire API、default model、secret ref、model list |
| Model route | Axi Coder | `axi-coder` | CLI -> provider/model route、请求 shape 转换、本地 proxy request log |
| CLI managed config backup | Axi Coder | `axi-coder` | Claude/Codex/Gemini 配置接管、恢复、受管 block |

## 目标架构

```text
Axi Accounts
├── Accounts domain
│   ├── account profile / plan / organization / tags
│   ├── credential ref / OAuth token lifecycle
│   ├── quota snapshots / wakeup / auto switch
│   └── IDE or CLI instance binding
├── Verification Inbox
│   ├── IMAP and OTP account sources
│   ├── Outlook device-code authorization
│   ├── receive-code polling and freshness rules
│   └── account-pool alignment by contract
└── Provider adapter
    ├── account-scoped base_url / provider_id / provider_name
    └── shared ProviderProfile exported to Axi Coder

Axi Coder
├── Provider runtime
│   ├── provider kind inference / model discovery / keychain secret ref
│   ├── CLI route controls
│   └── request diagnostics and logs
└── Local proxy
    ├── Claude Messages
    ├── OpenAI Chat / Responses
    ├── Gemini native
    └── Ollama
```

## 合并任务

| 优先级 | 功能 | 来源 | Owner | 合并方式 | 验证 |
|---|---|---|---|---|---|
| P0 | Accounts domain schema | Axi Accounts docs + `cockpit-tools` reference patterns | Axi Accounts Contract | 已起草 `/Volumes/code/workspace/docs/axi/AXI_ACCOUNTS_SHARED_SCHEMA.md`：`AccountProfile`、`CredentialRef`、`QuotaSnapshot`、`InstanceBinding`、`AccountSwitchEvent`、`WakeupTask`；不要先搬 dirty 代码 | 下一步用 Codex/Gemini/Cursor/Windsurf 至少 4 类账号做字段覆盖验证 |
| P0 | Provider/Profile shared contract | `axi-coder` provider/proxy + account-scoped provider reference patterns | Axi Coder + Axi Accounts Contract | 设计 `ProviderProfile` / `ProviderCredentialRef` / `ProviderWireApi`；Accounts 只保存 account-scoped provider config，Coder 负责 runtime proxy | 映射 base URL、provider id/name、custom provider 到 Axi Coder provider 字段 |
| P0 | Verification Inbox contract | `imap` Tauri commands + Python bridge | Axi Verification Inbox / Axi Accounts Contract | 把 `list_accounts`、`receive_code`、Outlook begin/complete auth 变成 Accounts 子模块 API；保留 freshness、identity mismatch、IMAP validation 规则 | 迁移前后能列账号、授权 Outlook、轮询新验证码；保留 `backend/test_imap_service.py` / `test_outlook_oauth_device_login.py` 等价测试 |
| P0 | Credential safety | 三个项目 | Axi Accounts + Axi Coder | 明确 token/password/API key 只能进入 keychain、secret store 或 gitignored local config；docs/registry 只保存 ref | `rg` 检查新增治理文档不含真实 token；schema 不要求明文 secret |
| P1 | Codex switch + instance binding | Contract docs + `cockpit-tools` reference patterns | Future Axi Accounts host | 先写 adapter/fixture 需求，不改 Cockpit runtime；保留切号状态、默认实例绑定、session visibility repair、OpenCode/OpenClaw sync 的合同字段 | Codex account switch fixture；默认实例绑定同步 fixture；失败状态可追踪 |
| P1 | Quota / wakeup / auto resume | Contract docs + `cockpit-tools` reference patterns | Axi Accounts Contract + Axi Notify | 保留 quota snapshot、reset time、alert cooldown、auto-switch/wakeup 的事件合同；通知只接事件，不接账号明文 | quota refresh mock + wakeup task list/trigger fixture |
| P1 | UI 收敛 | `imap` + `cockpit-tools` reference patterns | Future Axi Accounts host | 不立即合仓；先把 `imap` 的“授权/接码”视图变成 Accounts 页面或插件面板设计；Cockpit 只作交互参考 | UI checklist：账号列表能显示 `canAuthorize`、source、available、收码结果 |
| P2 | Axi Accounts host selection | New/future Axi-owned module | Axi Accounts | 在合同稳定后选择或创建真正 Axi-owned host；不得把 `cockpit-tools` fork/rebrand 为 Axi Accounts | host repo/path 明确；Cockpit 仍保持 reference |

## 不迁移/不合并项

| 来源 | 不迁移项 | 原因 |
|---|---|---|
| `axi-coder` | 账号池、配额、邮箱验证码、账号切换 lifecycle | 与现有 provider/proxy/control-plane 边界不同；放进去会扩大安全面和数据面 |
| `cockpit-tools` | 整体产品、名称、runtime owner、发布链路 | 外部/reference 项目，不算 Axi 应用；不得重命名或作为 Axi Accounts owner |
| `cockpit-tools` | 本地 CLI proxy runtime 和请求 shape 转换 | 应由 Axi Coder 统一处理；Cockpit 的 account-scoped provider config 只作为参考输入 |
| `imap` | 独立长期桌面产品形态 | 功能应进入 Axi Accounts 的 Verification Inbox；保留项目直到迁移完成 |
| 三个项目 | 明文凭据进入共享文档、workspace registry 或 Axi catalog | 本轮只做合同和迁移计划，凭据必须继续留在 keychain/gitignored local config |

## 下一步实施顺序

1. 基于 `/Volumes/code/workspace/docs/axi/AXI_ACCOUNTS_SHARED_SCHEMA.md` 做字段覆盖验证：Codex OAuth 账号、Codex API key 账号、自定义 provider 账号。
2. 扩展到 Gemini/Cursor/Windsurf，确认 `AccountProfile` / `InstanceBinding` / `QuotaSnapshot` 不被 Codex 特例绑死。
3. 把 `imap` 的 Verification Inbox API 草案落到 owner backlog：`listInboxAccounts`、`beginAuthorization`、`completeAuthorization`、`receiveCode`。
4. 把 `axi-coder` Provider Runtime API 草案落到 owner backlog：`saveProvider`、`discoverModels`、`setCliRoute`、`proxyRequestLog`。
5. 等合同稳定后选择或创建真正 Axi-owned Accounts host；`cockpit-tools` 继续保持 reference，迁移完成前不归档 `imap`。

## 验证清单

- 不删除 `cockpit-tools`、`imap`、`axi-coder` 任一 active worktree。
- 不把 `cockpit-tools` 改名为 Axi，也不把它登记为 Axi owner。
- 后续任何迁移前都先保存三个仓库的 `git status --short --branch`、HEAD、remote。
- `imap` 迁移完成前必须保留 Outlook OAuth device flow、token identity mismatch 检查、IMAP validation、freshness polling。
- 若未来从 `cockpit-tools` reference 派生 Axi-owned 实现，必须保留 Codex 切号状态、默认实例绑定、session visibility repair、quota snapshot、wakeup/auto resume 的合同能力。
- `axi-coder` 迁移完成前必须保留 CLI takeover/restore、本地 proxy、provider diagnostics、request log。
