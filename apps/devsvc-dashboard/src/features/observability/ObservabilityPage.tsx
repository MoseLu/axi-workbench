// src/features/observability/ObservabilityPage.tsx
//
// Phase 1.6: Observability tab. Renders the devsvc-dashboard's
// existing observability surfaces via the
// `@axi/observability-react-hooks` package. The
// `dashboardObservabilityClient` adapter maps the hooks' path
// scheme onto the dashboard's existing `/api/observability/*`
// backend routes so the page does not duplicate backend code.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Empty, Segmented, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

import { useObservabilityLogs, useObservabilityMetrics, useObservabilityOverview, useObservabilityTraces } from "@axi/observability-react-hooks";
import { dashboardObservabilityClient } from "./observabilityClient";

interface LogRow {
  ts: number;
  service: string;
  level: string;
  project: string;
  line: string;
}

interface TraceRow {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  durationMs?: number;
}

const tagsFor = (severity: string) => {
  const lower = severity.toLowerCase();
  if (lower === "error" || lower === "critical") return <Tag color="red">{severity}</Tag>;
  if (lower === "warning" || lower === "warn") return <Tag color="orange">{severity}</Tag>;
  if (lower === "info") return <Tag color="blue">{severity}</Tag>;
  return <Tag>{severity}</Tag>;
};

const metricSummary = (result: unknown): string => {
  if (!Array.isArray(result)) return "no data";
  if (result.length === 0) return "empty";
  const first = result[0] as { metric?: Record<string, string>; value?: [number, string] };
  const labels = Object.entries(first.metric || {}).map(([k, v]) => `${k}=${v}`).join(" • ");
  return labels || `${result.length} series`;
};

export function ObservabilityPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("overview");

  const overview = useObservabilityOverview({ client: dashboardObservabilityClient, refreshIntervalMs: 30_000 });
  const logs = useObservabilityLogs({ limit: 50, sinceMinutes: 60, client: dashboardObservabilityClient, refreshIntervalMs: 30_000 });
  const metrics = useObservabilityMetrics({ expr: "up", client: dashboardObservabilityClient, refreshIntervalMs: 60_000 });
  const tracesQuery = useObservabilityTraces({ limit: 20, client: dashboardObservabilityClient, refreshIntervalMs: 60_000 });

  const logRows = useMemo<LogRow[]>(() => {
    const streams = logs.data?.data?.result || [];
    return streams.flatMap((stream) =>
      (stream.values || []).map(([ts, line]) => {
        const labels = stream.stream || {};
        return {
          ts: Number(BigInt(ts) / 1_000n) / 1000,
          service: labels.service || labels.job || "unknown",
          level: labels.level || "info",
          project: labels.project || "-",
          line,
        };
      })
    );
  }, [logs.data]);

  const traceRows = useMemo<TraceRow[]>(() => {
    const list = tracesQuery.data?.traces || [];
    return list.map((trace) => ({
      traceID: (trace as TraceRow).traceID,
      rootServiceName: (trace as TraceRow).rootServiceName,
      rootTraceName: (trace as TraceRow).rootTraceName,
      durationMs: (trace as TraceRow).durationMs,
    }));
  }, [tracesQuery.data]);

  const logColumns: ColumnsType<LogRow> = [
    { title: t("Time"), dataIndex: "ts", width: 180, render: (value: number) => new Date(value).toISOString() },
    { title: t("Service"), dataIndex: "service", width: 140 },
    { title: t("Level"), dataIndex: "level", width: 100, render: (value: string) => tagsFor(value) },
    { title: t("Project"), dataIndex: "project", width: 160 },
    { title: t("Message"), dataIndex: "line" },
  ];

  const traceColumns: ColumnsType<TraceRow> = [
    { title: "traceID", dataIndex: "traceID", width: 240 },
    { title: t("Service"), dataIndex: "rootServiceName", width: 180, render: (value?: string) => value || "-" },
    { title: t("Name"), dataIndex: "rootTraceName", width: 200, render: (value?: string) => value || "-" },
    { title: t("Duration (ms)"), dataIndex: "durationMs", width: 140, render: (value?: number) => (typeof value === "number" ? value.toFixed(2) : "-") },
  ];

  return (
    <section style={{ padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("Observability")}
        </Typography.Title>
        <Segmented
          options={[
            { label: t("Overview"), value: "overview" },
            { label: t("Logs"), value: "logs" },
            { label: t("Metrics"), value: "metrics" },
            { label: t("Traces"), value: "traces" },
          ]}
          value={activeTab}
          onChange={(value) => setActiveTab(String(value))}
        />
      </header>

      {activeTab === "overview" ? (
        <OverviewPanel overview={overview} traces={tracesQuery} metrics={metrics} />
      ) : null}
      {activeTab === "logs" ? (
        <Spin spinning={logs.isLoading} tip={t("Loading")}>
          {logRows.length === 0 ? <Empty description={t("No log records")} /> : (
            <Table<LogRow>
              size="small"
              dataSource={logRows}
              columns={logColumns}
              rowKey={(row) => `${row.ts}:${row.service}:${row.line.slice(0, 16)}`}
              pagination={{ pageSize: 25 }}
              scroll={{ y: 480 }}
            />
          )}
        </Spin>
      ) : null}
      {activeTab === "metrics" ? (
        <Spin spinning={metrics.isLoading} tip={t("Loading")}>
          <Typography.Paragraph>
            {t("Query")}: <code>{metrics.data?.data?.resultType ?? "vector"}</code>
          </Typography.Paragraph>
          <Typography.Paragraph>
            {t("Result summary")}: {metricSummary(metrics.data?.data?.result)}
          </Typography.Paragraph>
          {metrics.data?.degraded ? (
            <Typography.Text type="warning">{t("Backend unavailable; showing degraded view.")}</Typography.Text>
          ) : null}
        </Spin>
      ) : null}
      {activeTab === "traces" ? (
        <Spin spinning={tracesQuery.isLoading} tip={t("Loading")}>
          {traceRows.length === 0 ? <Empty description={t("No traces")} /> : (
            <Table<TraceRow>
              size="small"
              dataSource={traceRows}
              columns={traceColumns}
              rowKey="traceID"
              pagination={{ pageSize: 20 }}
            />
          )}
        </Spin>
      ) : null}
    </section>
  );
}

interface OverviewPanelProps {
  overview: ReturnType<typeof useObservabilityOverview>;
  metrics: ReturnType<typeof useObservabilityMetrics>;
  traces: ReturnType<typeof useObservabilityTraces>;
}

function OverviewPanel({ overview, metrics, traces }: OverviewPanelProps) {
  const { t } = useTranslation();
  if (overview.isLoading) return <Spin tip={t("Loading")} />;
  if (overview.error) return <Empty description={String(overview.error)} />;
  const data = overview.data;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
      <Card label={t("Services")} value={data?.services ?? 0} />
      <Card label={t("Projects")} value={data?.projects ?? 0} />
      <Card label={t("Events")} value={data?.totalEvents ?? 0} />
      <Card label={t("Open warnings")} value={data?.warnings.open ?? 0} />
      <Card label={t("Metrics series")} value={Array.isArray(metrics.data?.data?.result) ? metrics.data?.data?.result.length : 0} />
      <Card label={t("Traces")} value={traces.data?.traces?.length ?? 0} />
      {data?.chain.valid === false ? (
        <Typography.Text type="warning">{t("Event chain integrity check failed.")}</Typography.Text>
      ) : null}
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid rgba(127,127,127,0.18)", borderRadius: 8, padding: 16 }}>
      <div style={{ opacity: 0.7, fontSize: 12, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}