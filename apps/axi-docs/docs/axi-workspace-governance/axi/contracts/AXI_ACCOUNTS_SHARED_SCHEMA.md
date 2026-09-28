# Axi Accounts Shared Schema 草案

生成时间：2026-05-25  
状态：v0 草案，先用于迁移评审，不直接作为运行时代码

## 设计目标

这个 schema 用来把 Axi Accounts contract、`imap`、`axi-coder` 与 `cockpit-tools` reference 中的重叠能力分开：

- Axi Accounts Contract 定义账号、凭据引用、配额、实例、切号、唤醒，不绑定 `cockpit-tools` runtime。
- Axi Verification Inbox 管邮箱验证码、OTP、Outlook OAuth device flow。
- Axi Coder 管 provider runtime、本地 proxy、CLI route、request diagnostics。
- `cockpit-tools` 是外部/reference 项目，只提供字段和交互经验，不算 Axi owner。

所有 secret 字段只允许出现引用，不允许在 schema、registry、catalog 或治理文档中保存明文 token/password/API key。

## 来源字段

| 来源 | 关键字段 |
|---|---|
| `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/models/codex.rs:42-78` | Reference `CodexAccount`：id、email、auth_mode、api_base_url、api_provider_id/name、tokens、quota、quota_error、tags、created_at、last_used |
| `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/models/account.rs:5-40` | Reference 通用 `Account`：name、tags、notes、fingerprint_id、quota、disabled、protected_models、usage_updated_at |
| `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/models/instance.rs:16-32` | Reference `InstanceProfile`：user_data_dir、working_dir、extra_args、bind_account_id、launch_mode、last_pid |
| `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/modules/codex_account_switch_status.rs:9-24` | Reference `CodexAccountSwitchStatus`：trigger、from/to account、threshold、auth file mtime、error |
| `/Volumes/code/workspace/references/cockpit-tools/src-tauri/src/modules/codex_wakeup.rs:79-140` | Reference `CodexWakeupTask`：account_ids、prompt、model、reasoning_effort、schedule、last run |
| `/Volumes/code/workspace/workbench/axi-workbench/apps/verification-inbox/src/types.ts:3-66` | `CodeAccount`、`ReceiveCodeResult`、Outlook begin/complete auth result |
| `/Volumes/code/workspace/workbench/axi-workbench/apps/verification-inbox/src/services/imap.ts:9-29` | Tauri command contract：list、receive、begin auth、complete auth |
| `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/src-tauri/src/models.rs:16-95` | `ProviderKind`、`Provider`、`ProviderModel`、`CliRoute` |
| `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/src-tauri/src/models.rs:147-180` | `RequestLog` / `NewRequestLog` diagnostics |

## 命名约定

- 持久化字段默认 camelCase；从 reference 派生 Axi-owned 实现时保留字段映射，不要求一次性改历史文件。
- 时间字段统一 Unix milliseconds，历史 seconds 字段迁移时记录 `sourceTimeUnit`。
- secret 统一为 `CredentialRef`，不在上层对象内嵌明文。
- `platform` 是账号平台，例如 `codex`、`gemini_cli`、`cursor`、`windsurf`。
- `provider` 是模型服务提供方，例如 `openai`、`deepseek`、`ollama`、`anthropic`、自定义 OpenAI-compatible endpoint。

## Core Types

```ts
export type AxiAccountPlatform =
  | "codex"
  | "antigravity"
  | "github_copilot"
  | "windsurf"
  | "kiro"
  | "cursor"
  | "gemini_cli"
  | "codebuddy"
  | "codebuddy_cn"
  | "qoder"
  | "trae"
  | "zed";

export type AxiCredentialKind =
  | "oauth_tokens"
  | "api_key"
  | "refresh_token"
  | "github_token"
  | "copilot_token"
  | "windsurf_api_key"
  | "windsurf_auth_token"
  | "imap_password"
  | "imap_oauth2"
  | "otp_site"
  | "bridge_token";

export interface CredentialRef {
  id: string;
  kind: AxiCredentialKind;
  storage: "keychain" | "local_gitignored_file" | "platform_native_store";
  service: string;
  account?: string;
  localPath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AccountProfile {
  id: string;
  platform: AxiAccountPlatform;
  email: string;
  displayName?: string;
  labels: string[];
  notes?: string;
  authMode: "oauth" | "apikey" | "token_json" | "native_import" | "unknown";
  primaryCredentialRef?: CredentialRef;
  credentialRefs: CredentialRef[];
  externalIds?: AccountExternalIds;
  providerProfileId?: string;
  plan?: AccountPlan;
  quota?: QuotaSnapshot;
  disabled: boolean;
  disabledReason?: string;
  disabledAt?: number;
  fingerprintId?: string;
  protectedModels: string[];
  usageUpdatedAt?: number;
  createdAt: number;
  lastUsedAt: number;
  source: {
    project: "cockpit-tools" | "imap" | "manual" | "imported";
    path?: string;
    sourceTimeUnit?: "seconds" | "milliseconds";
  };
}

export interface AccountPlan {
  type?: string;
  status?: string;
  tierId?: string;
  projectId?: string;
  accountId?: string;
  userId?: string;
  organizationId?: string;
  accountName?: string;
  accountStructure?: string;
  subscriptionActiveUntil?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AccountExternalIds {
  authId?: string;
  githubId?: string;
  userId?: string;
  accountId?: string;
  organizationId?: string;
  projectId?: string;
  tierId?: string;
  nativeUserId?: string;
  [key: string]: string | number | undefined;
}

export interface QuotaSnapshot {
  platform: AxiAccountPlatform;
  accountId: string;
  metrics: QuotaMetric[];
  lastError?: QuotaErrorInfo;
  rawDataRef?: string;
  updatedAt: number;
}

export interface QuotaMetric {
  id: string;
  label: string;
  percentage?: number;
  remaining?: number;
  limit?: number;
  resetAt?: number;
  windowMinutes?: number;
  windowPresent?: boolean;
}

export interface QuotaErrorInfo {
  code?: string;
  message: string;
  timestamp: number;
}
```

## Instance / Switch / Wakeup

```ts
export interface InstanceBinding {
  id: string;
  platform: AxiAccountPlatform;
  name: string;
  userDataDir: string;
  workingDir?: string;
  extraArgs: string;
  bindAccountId?: string;
  launchMode: "app" | "cli";
  followLocalAccount: boolean;
  createdAt: number;
  lastLaunchedAt?: number;
  lastPid?: number;
  running: boolean;
  initialized: boolean;
  isDefault: boolean;
}

export interface AccountSwitchEvent {
  id: string;
  platform: AxiAccountPlatform;
  state: "switching" | "succeeded" | "failed";
  trigger: "manual" | "auto_quota" | "wakeup" | "import" | "repair";
  fromAccountId?: string;
  toAccountId: string;
  reason?: string;
  thresholds?: {
    primary?: number;
    secondary?: number;
  };
  evidence?: {
    authFilePath?: string;
    beforeMtimeMs?: number;
    afterMtimeMs?: number;
    visibilityRepairSummaryId?: string;
  };
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface WakeupTask {
  id: string;
  name: string;
  enabled: boolean;
  platform: AxiAccountPlatform;
  accountIds: string[];
  prompt?: string;
  model?: string;
  modelDisplayName?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
  schedule: WakeupSchedule;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastStatus?: string;
  lastMessage?: string;
  lastSuccessCount?: number;
  lastFailureCount?: number;
  lastDurationMs?: number;
  nextRunAt?: number;
}

export type WakeupSchedule =
  | { kind: "daily"; dailyTime: string }
  | { kind: "weekly"; weeklyDays: number[]; weeklyTime: string }
  | { kind: "interval"; intervalHours: number }
  | { kind: "quota_reset"; quotaResetWindow: "either" | "primary_window" | "secondary_window" }
  | { kind: "startup"; startupDelayMinutes: number };
```

## Verification Inbox

```ts
export type InboxSource = "pool" | "imap" | "otp";
export type InboxProvider = "gmail" | "mail_com" | "outlook" | "custom";

export interface InboxAccount {
  id: string;
  index: string;
  label: string;
  email: string;
  source: InboxSource;
  sourceLabel: string;
  provider?: InboxProvider;
  note?: string;
  available: boolean;
  canAuthorize: boolean;
  credentialRef?: CredentialRef;
  linkedAccountId?: string;
  isCockpitPoolAccount: boolean;
}

export interface InboxAccountStats {
  total: number;
  imap: number;
  otp: number;
  pool: number;
  available: number;
}

export interface ReceiveCodeResult {
  status: "done" | "waiting" | "timeout" | "error";
  statusLabel: string;
  statusKind: "info" | "ok" | "warn" | "bad";
  code: string;
  message?: InboxMessage;
  stale: boolean;
  error?: string;
}

export interface InboxMessage {
  mailbox: string;
  from: string;
  subject: string;
  date: string;
}

export interface OutlookAuthorizationSession {
  status: "pending" | "done" | "error";
  statusLabel: string;
  statusKind: "info" | "ok" | "warn" | "bad";
  email: string;
  clientId: string;
  deviceCode?: string;
  userCode?: string;
  verificationUri?: string;
  interval?: number;
  expiresIn?: number;
  account?: InboxAccount;
  error?: string;
}
```

## Provider Runtime Contract

```ts
export type ProviderWireApi =
  | "openai_chat"
  | "openai_responses"
  | "anthropic"
  | "gemini_native"
  | "ollama"
  | "unknown";

export interface ProviderProfile {
  id: string;
  name: string;
  baseUrl: string;
  wireApi: ProviderWireApi;
  defaultModel?: string;
  credentialRef: CredentialRef;
  models: ProviderModel[];
  owner: "axi-coder";
  createdAt: string;
  updatedAt: string;
}

export interface ProviderModel {
  id: string;
  providerId: string;
  modelId: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsThinking: boolean;
  supportsTools: boolean;
  supportsJson: boolean;
}

export interface AccountScopedProviderConfig {
  accountId: string;
  platform: AxiAccountPlatform;
  mode: "openai_builtin" | "custom";
  baseUrl?: string;
  providerId?: string;
  providerName?: string;
  exportedProviderProfileId?: string;
}

export interface CliRoute {
  cli: "claude" | "codex" | "gemini";
  providerProfileId?: string;
  model?: string;
  enabled: boolean;
  updatedAt: string;
}

export interface ProxyRequestLog {
  id: string;
  cli: string;
  providerProfileId?: string;
  providerName?: string;
  model?: string;
  status: "success" | "failure";
  httpStatus?: number;
  errorCategory?: string;
  errorReason?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  dataSource: "proxy" | "health_check" | "manual";
  createdAt: string;
}
```

## Codex 字段映射

| Cockpit reference Codex 字段 | Axi 字段 | 处理 |
|---|---|---|
| `id` | `AccountProfile.id` | 原样迁移，必要时加 `codex:` namespace |
| `email` | `AccountProfile.email` | 原样迁移 |
| `auth_mode` | `AccountProfile.authMode` | `oauth` / `apikey` |
| `openai_api_key` | `credentialRefs[]` | 不迁明文；生成 `kind=api_key` 的引用 |
| `tokens` | `credentialRefs[]` | 不迁明文；生成 `kind=oauth_tokens` 的引用 |
| `api_base_url` | `AccountScopedProviderConfig.baseUrl` | 只作为 account-scoped provider config，不直接变 proxy |
| `api_provider_mode` | `AccountScopedProviderConfig.mode` | `openai_builtin` / `custom` |
| `api_provider_id` | `AccountScopedProviderConfig.providerId` | 映射到 exported provider id 候选 |
| `api_provider_name` | `AccountScopedProviderConfig.providerName` | 显示名 |
| `plan_type` | `AccountPlan.type` | 原样迁移 |
| `account_id` | `AccountPlan.accountId` + `AccountExternalIds.accountId` | 原样迁移 |
| `organization_id` | `AccountPlan.organizationId` + `AccountExternalIds.organizationId` | 原样迁移 |
| `account_structure` | `AccountPlan.accountStructure` | 原样迁移 |
| `quota` | `QuotaSnapshot.metrics` | hourly/weekly 转为两个 metric |
| `quota_error` | `QuotaSnapshot.lastError` | code/message/timestamp |
| `tags` | `AccountProfile.labels` | 原样迁移 |
| `created_at` / `last_used` | `createdAt` / `lastUsedAt` | 记录 `sourceTimeUnit=seconds` |

## IMAP 字段映射

| IMAP 字段 | Axi 字段 | 处理 |
|---|---|---|
| `CodeAccount.id/index` | `InboxAccount.id/index` | 原样迁移 |
| `label` | `InboxAccount.label` | 原样迁移 |
| `email` | `InboxAccount.email` | 原样迁移 |
| `source` | `InboxAccount.source` | `pool` / `imap` / `otp` |
| `sourceLabel` | `InboxAccount.sourceLabel` | UI 显示 |
| `available` | `InboxAccount.available` | 原样迁移 |
| `canAuthorize` | `InboxAccount.canAuthorize` | 决定是否显示授权动作 |
| `accountPassword` / `emailPassword` | `credentialRefs[]` | 不迁明文；生成本地 secret ref 或继续使用 gitignored config |
| `isCockpit` | `InboxAccount.isCockpitPoolAccount` | 原样迁移 |
| `deviceCode` / `userCode` | `OutlookAuthorizationSession` | 只作为短期会话状态，不持久化到 registry |
| `refresh_token` | `credentialRefs[](kind=imap_oauth2)` | 不迁明文 |

## Axi Coder 字段映射

| Axi Coder 字段 | Axi 字段 | 处理 |
|---|---|---|
| `Provider.id` | `ProviderProfile.id` | 原样迁移 |
| `Provider.name` | `ProviderProfile.name` | 原样迁移 |
| `Provider.base_url` | `ProviderProfile.baseUrl` | 原样迁移 |
| `Provider.provider_type` | `ProviderProfile.wireApi` | enum 名称对齐 |
| `Provider.default_model` | `ProviderProfile.defaultModel` | 原样迁移 |
| `Provider.secret_ref` | `ProviderProfile.credentialRef` | 保留引用，不读 secret |
| `ProviderModel` | `ProviderProfile.models[]` | 原样迁移 |
| `CliRoute` | `CliRoute` | provider id 改为 provider profile id |
| `RequestLog` | `ProxyRequestLog` | 原样迁移，`provider_id` 改为 provider profile id |

## API 草案

```ts
export interface AxiAccountsApi {
  listAccounts(platform?: AxiAccountPlatform): Promise<AccountProfile[]>;
  getAccount(accountId: string): Promise<AccountProfile | null>;
  listInstances(platform?: AxiAccountPlatform): Promise<InstanceBinding[]>;
  switchAccount(input: { platform: AxiAccountPlatform; accountId: string; instanceId?: string }): Promise<AccountSwitchEvent>;
  listQuotaSnapshots(platform?: AxiAccountPlatform): Promise<QuotaSnapshot[]>;
  listWakeupTasks(platform?: AxiAccountPlatform): Promise<WakeupTask[]>;
}

export interface AxiVerificationInboxApi {
  listInboxAccounts(): Promise<{ accounts: InboxAccount[]; stats: InboxAccountStats }>;
  receiveCode(accountId: string): Promise<ReceiveCodeResult>;
  beginAuthorization(accountId: string): Promise<OutlookAuthorizationSession>;
  completeAuthorization(input: {
    email: string;
    clientId: string;
    deviceCode: string;
    interval: number;
    expiresIn: number;
  }): Promise<OutlookAuthorizationSession>;
}

export interface AxiProviderRuntimeApi {
  saveProvider(input: Omit<ProviderProfile, "createdAt" | "updatedAt" | "models" | "owner">): Promise<ProviderProfile>;
  discoverModels(providerProfileId: string): Promise<ProviderModel[]>;
  setCliRoute(route: CliRoute): Promise<CliRoute>;
  listProxyRequestLogs(input?: { cli?: string; providerProfileId?: string }): Promise<ProxyRequestLog[]>;
}
```

## 迁移规则

1. `cockpit-tools` 保持 reference/source 名称和源码边界不动，只从 Codex 账号模型做字段映射验证。
2. `imap` 迁移前必须保留 device flow、identity mismatch、IMAP validation、freshness polling 规则。
3. `axi-coder` 不接收账号池和邮箱凭据；只接收 provider profile 或 account-scoped provider export。
4. `CredentialRef.storage=local_gitignored_file` 的记录必须带 `localPath`，并确认该路径不进入 git。
5. 任何 archive 或 active project 删除前，必须在 `AXI_FUNCTION_MERGE_TODO.md` 标明对应 schema/API 已落地或明确不迁移。

## 字段覆盖验证

Codex、Gemini、Cursor、Windsurf 四个平台的字段覆盖验证应落到后续 Axi-owned fixture/test；当前 schema 已预留多凭据 `credentialRefs[]` 和 `AccountExternalIds`，不得把真实 secret 写入 fixture、registry 或治理文档。
