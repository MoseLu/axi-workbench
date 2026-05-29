import {
  Activity,
  ArrowLeft,
  BarChart3,
  Copy,
  Database,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SquarePen,
  Terminal,
  Trash2,
} from "lucide-react";
import { IconAction, Metric } from "../../components/ui";
import { cliLabel, healthCategoryLabel, relativeTime } from "../../app/format";
import type {
  CliRoute,
  HealthCheckResult,
  OllamaScanResult,
  Provider,
  ProviderInput,
  RequestLog,
} from "./types";
import { initialProviderForm } from "./providerDefaults";

type ProviderCardModel = Provider & { draft?: boolean };

type ProviderPageState =
  | { kind: "list" }
  | { kind: "edit"; title: string }
  | { kind: "usage"; providerId: string }
  | { kind: "test"; providerId: string };

export type ProvidersPageProps = {
  busy: string | null;
  health: HealthCheckResult | null;
  logs: RequestLog[];
  ollama: OllamaScanResult | null;
  page: ProviderPageState;
  providerForm: ProviderInput;
  providers: Provider[];
  routes: CliRoute[];
  onCopyProvider: (provider: ProviderCardModel) => void;
  onOpenAddProvider: () => void;
  onDeleteProvider: () => void;
  onOpenTerminal: (cli?: CliRoute["cli"]) => void;
  onOpenProviderEdit: (provider: ProviderCardModel) => void;
  onOpenProviderTest: (provider: ProviderCardModel) => void;
  onRefreshDocs: () => void;
  onRestoreRoutes: () => void;
  onSaveProvider: () => void;
  onScanOllama: () => void;
  onSetPage: (page: ProviderPageState) => void;
  onSetProviderForm: (input: ProviderInput) => void;
  onToggleAllProxy: (enabled: boolean) => void;
  onToggleCliProxy: (cli: CliRoute["cli"], enabled: boolean) => void;
  onUseProvider: (provider: ProviderCardModel) => void;
};

export function ProvidersPage({
  busy,
  health,
  logs,
  ollama,
  page,
  providerForm,
  providers,
  routes,
  onCopyProvider,
  onDeleteProvider,
  onOpenAddProvider,
  onOpenTerminal,
  onOpenProviderEdit,
  onOpenProviderTest,
  onRefreshDocs,
  onRestoreRoutes,
  onSaveProvider,
  onScanOllama,
  onSetPage,
  onSetProviderForm,
  onToggleAllProxy,
  onToggleCliProxy,
  onUseProvider,
}: ProvidersPageProps) {
  const visibleProviders = buildVisibleProviders(providers, providerForm);
  const allEnabled = routes.length > 0 && routes.every((route) => route.enabled);

  if (page.kind === "edit") {
    return (
      <section className="page-stack">
        <DetailHeading title={page.title} onBack={() => onSetPage({ kind: "list" })} />
        <div className="provider-edit-card">
          <button className="provider-avatar-large" type="button" title="点击更换图标">
            {providerForm.name.slice(0, 1).toUpperCase() || "A"}
          </button>
          <div className="form-grid two-columns">
            <label>
              供应商名称
              <input value={providerForm.name} onChange={(event) => onSetProviderForm({ ...providerForm, name: event.target.value })} />
            </label>
            <label>
              默认模型
              <input
                value={providerForm.defaultModel ?? ""}
                onChange={(event) => onSetProviderForm({ ...providerForm, defaultModel: event.target.value })}
              />
            </label>
            <label className="wide-field">
              请求地址
              <input value={providerForm.baseUrl} onChange={(event) => onSetProviderForm({ ...providerForm, baseUrl: event.target.value })} />
            </label>
            <label className="wide-field">
              API Key
              <input
                autoComplete="off"
                placeholder="只需要填这里，密钥会保存到系统 Keychain"
                type="password"
                value={providerForm.apiKey ?? ""}
                onChange={(event) => onSetProviderForm({ ...providerForm, apiKey: event.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="detail-footer">
          <button className="primary" onClick={onSaveProvider} disabled={busy === "save-provider"} type="button">
            <Save size={17} />
            保存
          </button>
        </div>
      </section>
    );
  }

  if (page.kind === "usage") {
    const provider = visibleProviders.find((item) => item.id === page.providerId);
    const usage = provider ? providerUsage(provider, logs) : null;
    return (
      <section className="page-stack">
        <DetailHeading title="用量查询" onBack={() => onSetPage({ kind: "list" })} />
        <div className="detail-card">
          <div>
            <p className="eyebrow">供应商</p>
            <h2>{provider?.name ?? "未知供应商"}</h2>
          </div>
          {usage ? (
            <div className="usage-grid">
              <Metric label="请求数" value={`${usage.total}`} />
              <Metric label="成功率" value={`${usage.successRate}%`} />
              <Metric label="失败数" value={`${usage.failures}`} />
              <Metric label="最近记录" value={usage.lastSeen} />
            </div>
          ) : null}
          {ollama ? <OllamaPanel result={ollama} /> : null}
          <div className="secondary-actions">
            <button onClick={onScanOllama} disabled={busy === "ollama"} type="button">
              <Database size={17} />
              扫描 Ollama
            </button>
            <button onClick={onRefreshDocs} disabled={busy === "docs"} type="button">
              <ShieldCheck size={17} />
              刷新诊断规则
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (page.kind === "test") {
    const provider = visibleProviders.find((item) => item.id === page.providerId);
    return (
      <section className="page-stack">
        <DetailHeading title="模型测试" onBack={() => onSetPage({ kind: "list" })} />
        <div className="detail-card">
          <div>
            <p className="eyebrow">供应商</p>
            <h2>{provider?.name ?? "未知供应商"}</h2>
          </div>
          {health ? <HealthPanel result={health} /> : <div className="empty-state">点击下方按钮运行一次可用性测试</div>}
          <div className="secondary-actions">
            <button
              className="primary"
              onClick={() => provider && onOpenProviderTest(provider)}
              disabled={!provider || provider.draft || busy === `test-${provider?.id}`}
              type="button"
            >
              <Activity size={17} />
              测试模型
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="content-toolbar">
        <button onClick={() => onToggleAllProxy(!allEnabled)} disabled={routes.length === 0} type="button">
          <PlayCircle size={16} />
          {allEnabled ? "关闭全部代理" : "开启全部代理"}
        </button>
        <button onClick={onRestoreRoutes} type="button">
          <RotateCcw size={16} />
          恢复 CLI 配置
        </button>
        <button className="primary" onClick={onOpenAddProvider} type="button">
          <Activity size={16} />
          添加供应商
        </button>
      </div>

      <div className="provider-stack">
        {visibleProviders.map((provider) => {
          const usage = providerUsage(provider, logs);
          const active = routes.some((route) => route.providerId === provider.id);
          return (
            <article className={active ? "provider-card active" : "provider-card"} key={provider.id}>
              <button className="provider-identity" onClick={() => onOpenProviderEdit(provider)} type="button">
                <div className="provider-avatar">{provider.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h3>{provider.name}</h3>
                  <span>{provider.baseUrl}</span>
                </div>
              </button>
              <div className="usage-summary">
                <div>
                  <RefreshCw size={15} />
                  <span>{provider.draft ? "未保存" : relativeTime(provider.updatedAt)}</span>
                  <button className="ghost-icon" onClick={() => onSetPage({ kind: "usage", providerId: provider.id })} title="刷新用量" type="button">
                    <RefreshCw size={15} />
                  </button>
                </div>
                <strong>
                  请求：<span>{usage.successRate}%</span> <small>{usage.total} 次</small>
                </strong>
              </div>
              <div className="provider-actions">
                <button className={active ? "using-button active" : "using-button"} onClick={() => onUseProvider(provider)} disabled={busy === `use-${provider.id}`} type="button">
                  {active ? "使用中" : "使用"}
                </button>
                <IconAction label="编辑" onClick={() => onOpenProviderEdit(provider)} icon={<SquarePen size={19} />} />
                <IconAction label="复制" onClick={() => onCopyProvider(provider)} icon={<Copy size={19} />} />
                <IconAction label="测试模型" onClick={() => onOpenProviderTest(provider)} icon={<Activity size={19} />} />
                <IconAction label="配置用量查询" onClick={() => onSetPage({ kind: "usage", providerId: provider.id })} icon={<BarChart3 size={19} />} />
                <IconAction label="打开终端" onClick={() => onOpenTerminal("codex")} icon={<Terminal size={19} />} />
                <IconAction label="删除" onClick={onDeleteProvider} icon={<Trash2 size={19} />} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="routes-list">
        {routes.map((route) => (
          <article className="route-row" key={route.cli}>
            <div className="route-title">
              <span className={route.enabled ? "dot on" : "dot"} />
              <strong>{cliLabel(route.cli)}</strong>
            </div>
            <span>{providerName(route, providers)}</span>
            <code>{route.model || "未指定模型"}</code>
            <div className="route-actions">
              <button onClick={() => onToggleCliProxy(route.cli, !route.enabled)} disabled={!route.providerId} type="button">
                {route.enabled ? "关闭代理" : "开启代理"}
              </button>
              <button onClick={() => onOpenTerminal(route.cli)} type="button">
                <Terminal size={16} />
                终端
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { ProviderCardModel, ProviderPageState };

function DetailHeading({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="detail-heading">
      <button className="back-button" onClick={onBack} type="button">
        <ArrowLeft size={20} />
      </button>
      <h2>{title}</h2>
    </div>
  );
}

function HealthPanel({ result }: { result: HealthCheckResult }) {
  return (
    <div className={result.ok ? "result ok" : "result fail"}>
      <strong>{healthCategoryLabel(result.category)}</strong>
      <span>
        {result.providerName} / {result.testedModel || "模型未设置"} / {result.latencyMs} 毫秒
      </span>
      <p>{result.reason}</p>
      <p>{result.suggestion}</p>
    </div>
  );
}

function OllamaPanel({ result }: { result: OllamaScanResult }) {
  return (
    <div className={result.ok ? "result ok" : "result fail"}>
      <strong>{result.ok ? "Ollama 已就绪" : "Ollama 不可用"}</strong>
      <span>{result.models.length} 个模型</span>
      <p>{result.message}</p>
    </div>
  );
}

function buildVisibleProviders(providers: Provider[], providerForm: ProviderInput): ProviderCardModel[] {
  if (providers.length > 0) {
    return providers;
  }

  const now = new Date().toISOString();
  return [
    {
      id: "draft-deepseek",
      name: providerForm.name || initialProviderForm.name,
      baseUrl: providerForm.baseUrl || initialProviderForm.baseUrl,
      providerType: "open_ai_chat",
      defaultModel: providerForm.defaultModel || initialProviderForm.defaultModel,
      secretRef: "draft",
      createdAt: now,
      updatedAt: now,
      draft: true,
    },
  ];
}

function providerUsage(provider: ProviderCardModel, logs: RequestLog[]) {
  if (provider.draft) {
    return { total: 0, failures: 0, successRate: 0, lastSeen: "未保存" };
  }

  const providerLogs = logs.filter((log) => log.providerId === provider.id || log.providerName === provider.name);
  const total = providerLogs.length;
  const failures = providerLogs.filter((log) => log.status === "failure").length;
  const successes = total - failures;
  return {
    total,
    failures,
    successRate: total === 0 ? 0 : Math.round((successes / total) * 100),
    lastSeen: total > 0 ? relativeTime(providerLogs[0].createdAt) : "无记录",
  };
}

function providerName(route: CliRoute, providers: Provider[]) {
  const provider = providers.find((item) => item.id === route.providerId);
  if (provider) {
    return provider.name;
  }
  return route.providerId ? route.providerId : "未绑定 ProviderProfile";
}
