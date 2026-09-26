// src/features/observability/observabilityClient.ts
//
// Maps the foundation `@axi/observability-react-hooks` path scheme
// (`/api/v1/observability/*`) onto the devsvc-dashboard's existing
// `/api/observability/*` backend routes. The translation lets us
// consume the shared hooks package on the dashboard without changing
// the backend surface. Response shapes are adapted to the hook
// types defined in `@axi/observability-react-hooks`.

import { type ObservabilityClient } from "@axi/observability-react-hooks";
import { api } from "../../lib/api";

type DashboardServiceMatrixEntry = {
  kind: string;
  logs: string;
  metrics: string;
  traces: string;
};

type DashboardHealthSnapshot = {
  ok: boolean;
  components: { loki: { ok: boolean; error: string | null }; prometheus: { ok: boolean; error: string | null }; tempo: { ok: boolean; error: string | null } };
  endpoints: { loki: string; prometheus: string; tempo: string };
};

type DashboardQuery<T> = { ok: boolean } & T;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await api(path);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export interface DashboardObservabilityAdapters {
  services(): Promise<DashboardServiceMatrixEntry[]>;
  health(): Promise<DashboardHealthSnapshot>;
  recentLogs(query?: string, limit?: number, sinceMinutes?: number): Promise<DashboardQuery<{ query: string; results: Array<{ ts: number; labels: Record<string, string>; line: string }>; degraded: boolean; error?: string }>>;
  recentTraces(query?: string, limit?: number): Promise<DashboardQuery<{ query: string; traces: unknown[]; degraded: boolean; error?: string }>>;
  metrics(expr?: string): Promise<DashboardQuery<{ expr: string; result: unknown[]; degraded: boolean; error?: string }>>;
}

export const adapters: DashboardObservabilityAdapters = {
  async services() {
    const body = await fetchJson<{ matrix: Record<string, DashboardServiceMatrixEntry> }>("/api/observability/services");
    return Object.entries(body.matrix).map(([serviceId, entry]) => ({ serviceId, ...entry }));
  },
  async health() {
    return fetchJson<DashboardHealthSnapshot>("/api/observability/health");
  },
  async recentLogs(query, limit = 50, sinceMinutes = 60) {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    params.set("limit", String(limit));
    params.set("sinceMinutes", String(sinceMinutes));
    return fetchJson<DashboardQuery<{ query: string; results: Array<{ ts: number; labels: Record<string, string>; line: string }>; degraded: boolean; error?: string }>>(`/api/observability/recent-logs?${params}`);
  },
  async recentTraces(query, limit = 20) {
    const params = new URLSearchParams();
    params.set("query", query ?? "{}");
    params.set("limit", String(limit));
    return fetchJson<DashboardQuery<{ query: string; traces: unknown[]; degraded: boolean; error?: string }>>(`/api/observability/recent-traces?${params}`);
  },
  async metrics(expr = "up") {
    const params = new URLSearchParams();
    params.set("expr", expr);
    return fetchJson<DashboardQuery<{ expr: string; result: unknown[]; degraded: boolean; error?: string }>>(`/api/observability/metrics?${params}`);
  },
};

/**
 * `dashboardObservabilityClient` adapts the foundation hooks
 * (`/api/v1/observability/*`) to the dashboard's existing
 * `/api/observability/*` backend. The dashboard uses these hooks
 * to share the data-fetching surface with the Workbench admin UI.
 */
export const dashboardObservabilityClient: ObservabilityClient = {
  async overview() {
    const [services, health] = await Promise.all([adapters.services(), adapters.health()]);
    return {
      totalEvents: services.length,
      projects: services.filter((entry) => entry.kind === "project").length,
      services: services.length,
      recentEvents: [],
      warnings: { total: 0, open: 0 },
      chain: { valid: health.ok, count: services.length, lastHash: "" },
    };
  },
  events() {
    // The dashboard backend does not expose the workspace event
    // ledger yet. Returning an empty envelope keeps the hooks
    // happy until the Workbench gateway proxy is wired in.
    return Promise.resolve({ events: [], nextCursor: null, total: 0 });
  },
  event() {
    return Promise.reject(new Error("event detail not available on devsvc-dashboard"));
  },
  projects() {
    return Promise.resolve({ projects: [] });
  },
  project() {
    return Promise.resolve({ projectId: "axi-dashboard", events: [], nextCursor: null, total: 0 });
  },
  async logs(params?: Record<string, string | number | undefined>) {
    const sinceMinutesRaw = params?.since_minutes;
    const limitRaw = params?.limit;
    const queryRaw = params?.query;
    const sinceMinutes = typeof sinceMinutesRaw === "number" ? sinceMinutesRaw : 60;
    const limit = typeof limitRaw === "number" ? limitRaw : 50;
    const query = typeof queryRaw === "string" ? queryRaw : undefined;
    const result = await adapters.recentLogs(query, limit, sinceMinutes);
    const streams = result.results.map((entry) => ({
      stream: entry.labels,
      values: [[String(entry.ts * 1_000_000), entry.line]] as Array<[string, string]>,
    }));
    return { data: { result: streams }, degraded: result.degraded, error: result.error };
  },
  async metrics(params?: Record<string, string | number | undefined>) {
    const exprRaw = params?.expr;
    const expr = typeof exprRaw === "string" ? exprRaw : "up";
    const result = await adapters.metrics(expr);
    return { data: { resultType: "vector", result: result.result as never[] }, degraded: result.degraded, error: result.error };
  },
  async traces(params?: Record<string, string | number | undefined>) {
    const limitRaw = params?.limit;
    const queryRaw = params?.query;
    const limit = typeof limitRaw === "number" ? limitRaw : 20;
    const query = typeof queryRaw === "string" ? queryRaw : undefined;
    const result = await adapters.recentTraces(query, limit);
    return { traces: result.traces as never[], degraded: result.degraded, error: result.error };
  },
  acknowledgeWarning() {
    return Promise.reject(new Error("warning acknowledgement is not exposed via the dashboard backend"));
  },
  resolveWarning() {
    return Promise.reject(new Error("warning resolution is not exposed via the dashboard backend"));
  },
};

export function createDashboardObservabilityClient(): ObservabilityClient {
  // The dashboard adapter implements every method required by the
  // hooks package. Returning it directly keeps the page-side call
  // shape identical to a real `createObservabilityClient` instance.
  return dashboardObservabilityClient;
}