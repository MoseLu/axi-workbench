# Axi Coder

Axi Coder 是 Axi 开发工作台产品线。它不是账户账本、provider 目录或运维仪表板。它的职责是承载完整的开发能力：项目上下文、AI 编程 CLI 编排、终端会话、agent 任务执行、工件审查、模型路由，以及可逆的本地配置。

这条产品线有两个一等公民客户端形态：

- Mac 桌面：本仓库中当前的 Tauri 2 应用。
- 移动伴侣：移动版 Axi Coder 形态，消费同一套 Workstation、Agent、Notify、Accounts 与 Model Gateway 契约。

Axi Coder 也可以作为 Axi Dashboard 托管应用运行在 `/apps/axi-coder/overview`。
在托管模式下，dashboard 注入 `AXI_APP_BASE` 与 `AXI_APP_PORT`；React 应用使用稳定路由，原本只在 Tauri 中可用的命令在没有宿主 Tauri runtime 时回退到浏览器安全的 mock 行为。

Provider 路由与代理是 Axi Coder 的一部分，因为开发工作台需要模型、路由和 CLI 控制。它不让 Axi Coder 沦为 `axi-model-gateway` 的基础设施角色。

## 范围

- Tauri 2 桌面壳，使用 React、TypeScript、Rust、SQLite 与系统 Keychain 密钥存储。
- Provider 接入，提供一次性 base URL / API key 输入、自动 provider 类型推断、OpenAI 兼容 API 的模型发现，以及 DeepSeek 优先的默认值。
- `127.0.0.1:15721` 上的本地代理基础实现，支持 Claude Messages、OpenAI Chat/Responses 以及 Gemini 原生请求结构。
- 对 Claude、Codex 与 Gemini 配置文件做受管的 CLI 接管与恢复。
- 供 Mac 桌面与移动伴侣复用的开发工作台契约。
- 健康检查覆盖鉴权、计费、速率限制、无效请求、provider 错误、超时、DNS、TLS 失败等诊断分类。
- 请求日志表、per-CLI 路由控制、all-CLI 代理开关、自动参数派生，以及本地 Ollama 扫描。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm tauri dev
```

Rust 检查在 `src-tauri` 下：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

密钥保存在系统 keychain 中；SQLite 数据库只保存密钥引用。

## 验证说明

- `pnpm typecheck`、`pnpm test`、`pnpm build` 必须通过。
- `cargo check --manifest-path src-tauri/Cargo.toml --offline` 必须通过。
- `cargo test --manifest-path src-tauri/Cargo.toml --offline` 通过 19 个单元测试。
- Provider 烟雾测试必须使用本地凭据引用；原始 API key 不会入库或写入 SQLite 数据库。
