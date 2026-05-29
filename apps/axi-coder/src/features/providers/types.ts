export type ProviderKind =
  | "open_ai_chat"
  | "open_ai_responses"
  | "anthropic"
  | "gemini_native"
  | "ollama"
  | "unknown";

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  providerType: ProviderKind;
  defaultModel?: string | null;
  secretRef: string;
  createdAt: string;
  updatedAt: string;
};

export type ProviderInput = {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
};

export type CliRoute = {
  cli: "claude" | "codex" | "gemini";
  providerId?: string | null;
  model?: string | null;
  enabled: boolean;
  updatedAt: string;
};

export type TerminalCommandConfig = {
  cli: CliRoute["cli"];
  command: string;
  updatedAt: string;
};

export type TerminalSessionResult = {
  cli: CliRoute["cli"];
  sessionId: string;
  command: string;
  started: boolean;
};

export type TerminalTranscriptResult = {
  cli: CliRoute["cli"];
  sessionId?: string | null;
  data: string;
};

export type HealthCheckResult = {
  ok: boolean;
  providerId: string;
  providerName: string;
  providerType: ProviderKind;
  testedModel?: string | null;
  latencyMs: number;
  httpStatus?: number | null;
  category: string;
  reason: string;
  suggestion: string;
};

export type OllamaScanResult = {
  ok: boolean;
  provider?: Provider | null;
  models: Array<{ modelId: string }>;
  message: string;
};

export type RequestLog = {
  id: string;
  cli: string;
  providerId?: string | null;
  providerName?: string | null;
  model?: string | null;
  status: "success" | "failure" | string;
  httpStatus?: number | null;
  errorCategory?: string | null;
  errorReason?: string | null;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  createdAt: string;
  dataSource: string;
};

export type AutoParameterResult = {
  temperature: number;
  maxContextTokens: number;
  reasoningEffort: string;
  thinking: boolean;
  profile: string;
};
