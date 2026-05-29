import { invoke } from "@tauri-apps/api/core";
import type {
  AutoParameterResult,
  CliRoute,
  HealthCheckResult,
  OllamaScanResult,
  Provider,
  ProviderInput,
  RequestLog,
  TerminalCommandConfig,
  TerminalSessionResult,
  TerminalTranscriptResult,
} from "../features/providers/types";
import { buildMockAxiSuiteSnapshot, type AxiSuiteSnapshot } from "../features/mobile/axiSuiteSnapshot";
import { isHostedApp } from "./hosted";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = Boolean(window.__TAURI_INTERNALS__) && !isHostedApp;

const defaultTerminalCommands: Record<TerminalCommandConfig["cli"], string> = {
  claude: "claude --dangerously-skip-permissions",
  codex: "codex",
  gemini: "gemini",
};

let mockProviders: Provider[] = [
  {
    id: "deepseek-demo",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    providerType: "open_ai_chat",
    defaultModel: "deepseek-chat",
    secretRef: "provider:deepseek-demo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let mockRoutes: CliRoute[] = [
  { cli: "claude", providerId: "deepseek-demo", model: "deepseek-chat", enabled: false, updatedAt: new Date().toISOString() },
  { cli: "codex", providerId: "deepseek-demo", model: "deepseek-chat", enabled: false, updatedAt: new Date().toISOString() },
  { cli: "gemini", providerId: "deepseek-demo", model: "deepseek-chat", enabled: false, updatedAt: new Date().toISOString() },
];

let mockLogs: RequestLog[] = [];
let mockTerminalCommands: TerminalCommandConfig[] = Object.entries(defaultTerminalCommands).map(([cli, command]) => ({
  cli: cli as TerminalCommandConfig["cli"],
  command,
  updatedAt: new Date().toISOString(),
}));

async function call<T>(command: string, args: Record<string, unknown>, fallback: () => T): Promise<T> {
  if (!isTauri) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return fallback();
  }
  return invoke<T>(command, args);
}

export const api = {
  saveProvider(input: ProviderInput) {
    return call<Provider>("save_provider", { input }, () => {
      const now = new Date().toISOString();
      const provider: Provider = {
        id: input.id ?? crypto.randomUUID(),
        name: input.name,
        baseUrl: input.baseUrl,
        providerType: input.baseUrl.includes("11434") ? "ollama" : "open_ai_chat",
        defaultModel: input.defaultModel || null,
        secretRef: `provider:${input.id ?? "mock"}`,
        createdAt: now,
        updatedAt: now,
      };
      mockProviders = [provider, ...mockProviders.filter((item) => item.id !== provider.id)];
      return provider;
    });
  },
  listProviders() {
    return call<Provider[]>("list_providers", {}, () => mockProviders);
  },
  testProvider(providerId: string) {
    return call<HealthCheckResult>("test_provider", { providerId }, () => {
      const provider = mockProviders.find((item) => item.id === providerId) ?? mockProviders[0];
      const result: HealthCheckResult = {
        ok: true,
        providerId,
        providerName: provider.name,
        providerType: provider.providerType,
        testedModel: provider.defaultModel,
        latencyMs: 212,
        httpStatus: 200,
        category: "ok",
        reason: "提供方已接受最小模型请求。",
        suggestion: "当前提供方已可用于 CLI 路由。",
      };
      mockLogs = [mockLog(provider, "success", 200), ...mockLogs];
      return result;
    });
  },
  scanOllama() {
    return call<OllamaScanResult>("scan_ollama", {}, () => ({
      ok: false,
      provider: null,
      models: [],
      message: "Ollama 无法访问：http://127.0.0.1:11434/api/tags",
    }));
  },
  setCliRoute(input: CliRoute) {
    return call<CliRoute>("set_cli_route", { input }, () => {
      mockRoutes = mockRoutes.map((route) => (route.cli === input.cli ? { ...input, updatedAt: new Date().toISOString() } : route));
      return mockRoutes.find((route) => route.cli === input.cli)!;
    });
  },
  listCliRoutes() {
    return call<CliRoute[]>("list_cli_routes", {}, () => mockRoutes);
  },
  toggleAllProxy(enabled: boolean) {
    return call<CliRoute[]>("toggle_all_proxy", { enabled }, () => {
      mockRoutes = mockRoutes.map((route) => ({ ...route, enabled }));
      return mockRoutes;
    });
  },
  toggleCliProxy(cli: CliRoute["cli"], enabled: boolean) {
    return call<CliRoute>("toggle_cli_proxy", { cli, enabled }, () => {
      mockRoutes = mockRoutes.map((route) => (route.cli === cli ? { ...route, enabled } : route));
      return mockRoutes.find((route) => route.cli === cli)!;
    });
  },
  restoreCliConfigs() {
    return call<CliRoute[]>("restore_cli_configs", {}, () => {
      mockRoutes = mockRoutes.map((route) => ({ ...route, enabled: false }));
      return mockRoutes;
    });
  },
  listRequestLogs(limit = 200) {
    return call<RequestLog[]>("list_request_logs", { limit }, () => mockLogs);
  },
  refreshDiagnosticsDocs() {
    return call<Array<{ title: string; url: string }>>("refresh_diagnostics_docs", {}, () => [
      { title: "DeepSeek API 文档", url: "https://api-docs.deepseek.com/" },
    ]);
  },
  deriveAutoParameters(prompt: string) {
    return call<AutoParameterResult>(
      "derive_auto_parameters",
      { input: { prompt } },
      () => ({
        temperature: prompt.includes("story") ? 0.9 : 0.3,
        maxContextTokens: prompt.length > 8000 ? 192000 : 64000,
        reasoningEffort: prompt.includes("debug") ? "high" : "medium",
        thinking: prompt.includes("debug"),
        profile: prompt.includes("story") ? "creative" : "balanced",
      }),
    );
  },
  listTerminalCommands() {
    return call<TerminalCommandConfig[]>("list_terminal_commands", {}, () => mockTerminalCommands);
  },
  setTerminalCommand(cli: CliRoute["cli"], command: string) {
    return call<TerminalCommandConfig>("set_terminal_command", { input: { cli, command } }, () => {
      const next = { cli, command, updatedAt: new Date().toISOString() };
      mockTerminalCommands = mockTerminalCommands.map((item) => (item.cli === cli ? next : item));
      return next;
    });
  },
  startTerminalSession(cli: CliRoute["cli"], sessionId: string, rows: number, cols: number) {
    return call<TerminalSessionResult>("start_terminal_session", { input: { cli, sessionId, rows, cols } }, () => {
      const command = mockTerminalCommands.find((item) => item.cli === cli)?.command ?? defaultTerminalCommands[cli];
      return { cli, sessionId, command, started: true };
    });
  },
  writeTerminalInput(cli: CliRoute["cli"], data: string) {
    return call<void>("write_terminal_input", { cli, data }, () => {
      if (!isTauri) {
        // Mock echo in browser
        window.dispatchEvent(
          new CustomEvent("tauri://terminal-output", {
            detail: { payload: { cli, sessionId: mockTerminalCommands[0]?.cli || "mock", data } }
          })
        );
      }
      return undefined;
    });
  },
  readTerminalTranscript(cli: CliRoute["cli"]) {
    return call<TerminalTranscriptResult>("read_terminal_transcript", { cli }, () => ({
      cli,
      sessionId: null,
      data: "",
    }));
  },
  resizeTerminalSession(cli: CliRoute["cli"], rows: number, cols: number) {
    return call<void>("resize_terminal_session", { cli, rows, cols }, () => undefined);
  },
  stopTerminalSession(cli: CliRoute["cli"]) {
    return call<void>("stop_terminal_session", { cli }, () => undefined);
  },
  getAxiSuiteSnapshot() {
    return call<AxiSuiteSnapshot>("get_axi_suite_snapshot", {}, buildMockAxiSuiteSnapshot);
  },
};

function mockLog(provider: Provider, status: "success" | "failure", httpStatus: number): RequestLog {
  return {
    id: crypto.randomUUID(),
    cli: "health",
    providerId: provider.id,
    providerName: provider.name,
    model: provider.defaultModel,
    status,
    httpStatus,
    latencyMs: 212,
    createdAt: new Date().toISOString(),
    dataSource: "mock",
  };
}
