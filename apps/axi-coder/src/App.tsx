import "@xterm/xterm/css/xterm.css";
import { AxiThemeProvider } from "@axi/core";
import { useEffect, useState } from "react";
import { AppShell } from "./app/AppShell";
import { getRouteKey, type AppRouteKey } from "./app/appRegistry";
import { cliLabel, errorMessage, orderRoutes } from "./app/format";
import { AgentPage } from "./features/agent/AgentPage";
import { LogsPage, type LogFilter } from "./features/logs/LogsPage";
import { MobilePage } from "./features/mobile/MobilePage";
import type { AxiSuiteSnapshot } from "./features/mobile/axiSuiteSnapshot";
import type { WorkbenchTarget } from "./features/product/axiCoderWorkbench";
import type { ProjectCompletionSnapshot } from "./features/workbench/projectCompletion";
import {
  ProvidersPage,
  type ProviderCardModel,
  type ProviderPageState,
} from "./features/providers/ProvidersPage";
import { initialProviderForm } from "./features/providers/providerDefaults";
import type {
  AutoParameterResult,
  CliRoute,
  HealthCheckResult,
  OllamaScanResult,
  Provider,
  ProviderInput,
  RequestLog,
} from "./features/providers/types";
import { TerminalPage } from "./features/terminal/TerminalPage";
import { useTerminalWorkbench } from "./features/terminal/useTerminalWorkbench";
import { OverviewPage } from "./features/workbench/OverviewPage";
import { api } from "./lib/api";
import { isHostedApp, stripHostedBase, toHostedPath } from "./lib/hosted";

export function App() {
  const [activeRoute, setActiveRoute] = useState<AppRouteKey>(() => getRouteKey(stripHostedBase(window.location.pathname)));
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routes, setRoutes] = useState<CliRoute[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [providerForm, setProviderForm] = useState<ProviderInput>(initialProviderForm);
  const [providerPage, setProviderPage] = useState<ProviderPageState>({ kind: "list" });
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [ollama, setOllama] = useState<OllamaScanResult | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [autoPrompt, setAutoPrompt] = useState("调试一个 TypeScript CLI 代理路由，场景是 429 响应失败");
  const [autoParams, setAutoParams] = useState<AutoParameterResult | null>(null);
  const [suiteSnapshot, setSuiteSnapshot] = useState<AxiSuiteSnapshot | null>(null);
  const [projectCompletion, setProjectCompletion] = useState<ProjectCompletionSnapshot | null>(null);
  const [notice, setNotice] = useState("");

  const terminal = useTerminalWorkbench({
    activeRoute,
    busy,
    onBusyChange: setBusy,
    onNavigate: navigateTo,
    onNotice: setNotice,
  });

  useEffect(() => {
    void refreshAll();
    void refreshSuiteSnapshot();
    void refreshProjectCompletion();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveRoute(getRouteKey(stripHostedBase(window.location.pathname)));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (activeRoute !== "/providers") {
      setProviderPage({ kind: "list" });
    }
  }, [activeRoute]);

  function navigateTo(route: AppRouteKey) {
    setActiveRoute(route);
    const nextPath = toHostedPath(route);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  async function refreshAll() {
    setBusy("refresh");
    try {
      const [nextProviders, nextRoutes, nextLogs] = await Promise.all([
        api.listProviders(),
        api.listCliRoutes(),
        api.listRequestLogs(),
      ]);
      setProviders(nextProviders);
      setRoutes(orderRoutes(nextRoutes));
      setLogs(nextLogs);
    } finally {
      setBusy(null);
    }
  }

  async function refreshSuiteSnapshot() {
    setBusy((current) => current ?? "suite-snapshot");
    try {
      setSuiteSnapshot(await api.getAxiSuiteSnapshot());
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy((current) => (current === "suite-snapshot" ? null : current));
    }
  }

  async function refreshProjectCompletion() {
    setBusy((current) => current ?? "completion-snapshot");
    try {
      setProjectCompletion(await api.getProjectCompletionSnapshot());
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy((current) => (current === "completion-snapshot" ? null : current));
    }
  }

  async function saveProvider() {
    setBusy("save-provider");
    setNotice("");
    try {
      const provider = await api.saveProvider(providerForm);
      setProviders((current) => [provider, ...current.filter((item) => item.id !== provider.id)]);
      setProviderForm((current) => ({ ...current, id: provider.id, apiKey: "" }));
      setProviderPage({ kind: "list" });
      setNotice(`已保存 ${provider.name}`);
      return provider;
    } catch (error) {
      setNotice(errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function testSelectedProvider(providerId: string) {
    setBusy(`test-${providerId}`);
    setNotice("");
    try {
      const result = await api.testProvider(providerId);
      setHealth(result);
      setLogs(await api.listRequestLogs());
      setNotice(result.ok ? `${result.providerName} 状态正常` : result.reason);
      return result;
    } catch (error) {
      setNotice(errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function scanOllama() {
    setBusy("ollama");
    setNotice("");
    try {
      const result = await api.scanOllama();
      setOllama(result);
      setProviders(await api.listProviders());
      setNotice(result.message);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function refreshDocs() {
    setBusy("docs");
    setNotice("");
    try {
      const docs = await api.refreshDiagnosticsDocs();
      setNotice(`已刷新 ${docs.length} 个诊断来源`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function deriveParams() {
    setBusy("params");
    try {
      setAutoParams(await api.deriveAutoParameters(autoPrompt));
    } finally {
      setBusy(null);
    }
  }

  function openWorkbenchAction(target: WorkbenchTarget | "mobile" | "agent") {
    if (target === "routes") {
      terminal.openTerminalView("codex");
      return;
    }
    if (target === "providers") {
      navigateTo("/providers");
      return;
    }
    if (target === "logs") {
      navigateTo("/logs");
      return;
    }
    navigateTo(target === "mobile" ? "/mobile" : "/agent");
  }

  function openAddProvider() {
    navigateTo("/providers");
    setProviderForm(initialProviderForm);
    setHealth(null);
    setOllama(null);
    setProviderPage({ kind: "edit", title: "添加供应商" });
  }

  function openProviderEdit(provider: ProviderCardModel) {
    setProviderForm(
      provider.draft
        ? initialProviderForm
        : {
            id: provider.id,
            name: provider.name,
            baseUrl: provider.baseUrl,
            apiKey: "",
            defaultModel: provider.defaultModel ?? "",
          },
    );
    setHealth(null);
    setOllama(null);
    setProviderPage({ kind: "edit", title: provider.draft ? "添加供应商" : "编辑供应商" });
  }

  async function openProviderTest(provider: ProviderCardModel) {
    if (provider.draft) {
      setNotice("请先保存供应商，再测试模型");
      openProviderEdit(provider);
      return;
    }

    setProviderPage({ kind: "test", providerId: provider.id });
    await testSelectedProvider(provider.id);
  }

  async function copyProvider(provider: ProviderCardModel) {
    try {
      await navigator.clipboard.writeText(provider.baseUrl);
      setNotice(`已复制 ${provider.name} 请求地址`);
    } catch {
      setNotice("复制失败，请手动复制请求地址");
    }
  }

  async function useProvider(provider: ProviderCardModel) {
    if (provider.draft) {
      setNotice("请先保存供应商，再设为使用中");
      openProviderEdit(provider);
      return;
    }

    setBusy(`use-${provider.id}`);
    setNotice("");
    try {
      const nextRoutes = await Promise.all(
        routes.map((route) =>
          api.setCliRoute({
            ...route,
            providerId: provider.id,
            model: provider.defaultModel ?? route.model,
          }),
        ),
      );
      setRoutes(orderRoutes(nextRoutes));
      setNotice(`${provider.name} 已设为所有 CLI 的默认供应商`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function toggleAllProxy(enabled: boolean) {
    setBusy("toggle-all");
    setNotice("");
    try {
      setRoutes(orderRoutes(await api.toggleAllProxy(enabled)));
      setNotice(enabled ? "全部 CLI 代理已开启" : "全部 CLI 代理已关闭");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function toggleCliProxy(cli: CliRoute["cli"], enabled: boolean) {
    setBusy(`toggle-${cli}`);
    setNotice("");
    try {
      const route = await api.toggleCliProxy(cli, enabled);
      setRoutes((current) => orderRoutes(current.map((item) => (item.cli === cli ? route : item))));
      setNotice(`${cliLabel(cli)} 代理已${enabled ? "开启" : "关闭"}`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function restoreCliConfigs() {
    setBusy("restore-cli");
    setNotice("");
    try {
      setRoutes(orderRoutes(await api.restoreCliConfigs()));
      setNotice("已恢复 Claude / Codex / Gemini 配置");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function renderActivePage() {
    switch (activeRoute) {
      case "/overview":
        return (
          <OverviewPage
            completionSnapshot={projectCompletion}
            logs={logs}
            providers={providers}
            routes={routes}
            suiteSnapshot={suiteSnapshot}
            onAction={openWorkbenchAction}
          />
        );
      case "/terminal":
        return (
          <TerminalPage
            activeTerminal={terminal.activeTerminal}
            busy={busy}
            terminalCommands={terminal.terminalCommands}
            terminalDraftCommand={terminal.terminalDraftCommand}
            terminalElementRef={terminal.terminalElementRef}
            terminalRunning={terminal.terminalRunning}
            terminalSettingsOpen={terminal.terminalSettingsOpen}
            onCloseSettings={() => terminal.setTerminalSettingsOpen(false)}
            onFocusTerminal={terminal.focusTerminal}
            onSaveSettings={terminal.saveTerminalSettings}
            onSetDraftCommand={terminal.setTerminalDraftCommand}
            onSetTerminal={terminal.setActiveTerminal}
            onShowSettings={terminal.openTerminalSettings}
          />
        );
      case "/providers":
        return (
          <ProvidersPage
            busy={busy}
            health={health}
            logs={logs}
            ollama={ollama}
            page={providerPage}
            providerForm={providerForm}
            providers={providers}
            routes={routes}
            onCopyProvider={(provider) => void copyProvider(provider)}
            onDeleteProvider={() => setNotice("删除供应商功能还未接入后端")}
            onOpenAddProvider={openAddProvider}
            onOpenProviderEdit={openProviderEdit}
            onOpenProviderTest={(provider) => void openProviderTest(provider)}
            onOpenTerminal={terminal.openTerminalView}
            onRefreshDocs={() => void refreshDocs()}
            onRestoreRoutes={() => void restoreCliConfigs()}
            onSaveProvider={() => void saveProvider()}
            onScanOllama={() => void scanOllama()}
            onSetPage={setProviderPage}
            onSetProviderForm={setProviderForm}
            onToggleAllProxy={(enabled) => void toggleAllProxy(enabled)}
            onToggleCliProxy={(cli, enabled) => void toggleCliProxy(cli, enabled)}
            onUseProvider={(provider) => void useProvider(provider)}
          />
        );
      case "/mobile":
        return <MobilePage snapshot={suiteSnapshot} loading={busy === "suite-snapshot"} onRefresh={() => void refreshSuiteSnapshot()} />;
      case "/agent":
        return (
          <AgentPage
            autoParams={autoParams}
            autoPrompt={autoPrompt}
            busy={busy}
            suiteSnapshot={suiteSnapshot}
            onDeriveParams={() => void deriveParams()}
            onPromptChange={setAutoPrompt}
          />
        );
      case "/logs":
        return <LogsPage busy={busy} filter={logFilter} logs={logs} onFilterChange={setLogFilter} onRefreshDocs={() => void refreshDocs()} />;
    }
  }

  const activePage = renderActivePage();

  return (
    <AxiThemeProvider defaultPreference="dark" storageNamespace="axi-coder-dashboard">
      {isHostedApp ? (
        <main className="axi-coder-hosted-scope">
          {activePage}
          {notice ? <div className="notice">{notice}</div> : null}
        </main>
      ) : (
        <AppShell
          activeRoute={activeRoute}
          busy={busy}
          notice={notice}
          onNavigate={navigateTo}
          onNotice={setNotice}
          onRefresh={() => {
            void refreshAll();
            void refreshSuiteSnapshot();
          }}
          onSettings={() => setNotice("设置入口已保留，后续接入产品级偏好。")}
        >
          {activePage}
        </AppShell>
      )}
    </AxiThemeProvider>
  );
}
