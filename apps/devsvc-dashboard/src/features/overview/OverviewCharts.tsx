import React from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

const chartColors = ["var(--green)", "var(--amber)", "var(--red)", "var(--primary)"];
const resourceChartGradientId = "resource-memory-gradient";

type OverviewMetrics = {
  total: number;
  healthy: number;
  online: number;
  idle: number;
};

type OverviewChartsProps = {
  metrics: OverviewMetrics;
  projects: any[];
};

function formatChartValue(value: unknown, suffix = "") {
  if (typeof value !== "number") return `${value ?? "-"}${suffix}`;
  return `${value.toLocaleString()}${suffix}`;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = ""
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; color?: string; payload?: { name?: string; displayValue?: unknown } }>;
  label?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label ? <div className="chart-tooltip-title">{label}</div> : null}
      <div className="chart-tooltip-items">
        {payload.map((entry, index) => {
          const entryName = entry.payload?.name || entry.name;
          const entryValue = entry.payload?.displayValue ?? entry.value;
          const entryColor = entry.color || chartColors[index % chartColors.length];
          return (
            <div className="chart-tooltip-row" key={`${entryName || "item"}-${index}`} style={{ "--chart-color": entryColor } as React.CSSProperties}>
              <span className="chart-tooltip-dot" />
              <span className="chart-tooltip-name">{entryName}</span>
              <strong>{formatChartValue(entryValue, valueSuffix)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function OverviewCharts({ metrics, projects }: OverviewChartsProps) {
  const { t } = useTranslation();
  const abnormalCount = Math.max(0, metrics.total - metrics.healthy - metrics.idle);
  const healthData = [
    { name: t("健康"), value: metrics.healthy, color: chartColors[0] },
    { name: t("未启动"), value: metrics.idle, color: chartColors[1] },
    { name: t("异常"), value: abnormalCount, color: chartColors[2] }
  ];
  const displayedHealthData = metrics.total
    ? healthData
    : [{ name: t("暂无项目"), value: 1, displayValue: 0, color: "var(--line)" }];
  const healthRate = metrics.total ? Math.round((metrics.healthy / metrics.total) * 100) : 0;
  const resourceData = projects
    .filter((project) => project.pm2.status === "online")
    .map((project) => ({
      name: project.title || project.id,
      memory: Math.round((project.pm2.memoryBytes || 0) / 1024 / 1024),
      cpu: project.pm2.cpu || 0
    }));
  const totalMemory = resourceData.reduce((sum, item) => sum + item.memory, 0);
  const peakMemory = resourceData.reduce((max, item) => Math.max(max, item.memory), 0);

  return (
    <section className="graph-grid">
      <Panel title={t("健康分布")} subtitle={t("按当前 PM2 与健康检查聚合")}>
        <div className="chart-panel-body donut-layout">
          <div className="chart-canvas donut-chart-shell">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                <Pie
                  data={displayedHealthData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={4}
                  cornerRadius={7}
                  stroke="var(--panel)"
                  strokeWidth={3}
                >
                  {displayedHealthData.map((entry, index) => <Cell key={entry.name} fill={entry.color || chartColors[index]} />)}
                </Pie>
                <RechartsTooltip content={<ChartTooltip />} cursor={false} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center" aria-hidden="true">
              <span>{t("健康率")}</span>
              <strong>{healthRate}%</strong>
              <em>{metrics.healthy}/{metrics.total}</em>
            </div>
          </div>
          <div className="chart-legend" aria-label={t("健康分布")}>
            {healthData.map((item) => (
              <div className="chart-legend-row" key={item.name} style={{ "--chart-color": item.color } as React.CSSProperties}>
                <span className="chart-legend-swatch" />
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title={t("资源概览")} subtitle={t("当前在线项目的内存占用")}>
        <div className="chart-panel-body resource-chart-body">
          <div className="chart-summary" aria-label={t("资源概览")}>
            <span>{t("在线项目")} <strong>{resourceData.length}</strong></span>
            <span>{t("总内存")} <strong>{formatChartValue(totalMemory, " MB")}</strong></span>
            <span>{t("峰值")} <strong>{formatChartValue(peakMemory, " MB")}</strong></span>
          </div>
          {resourceData.length ? (
            <div className="chart-canvas resource-chart-shell">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resourceData} margin={{ top: 12, right: 8, bottom: 8, left: 0 }} barCategoryGap="34%">
                  <defs>
                    <linearGradient id={resourceChartGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.96} />
                      <stop offset="100%" stopColor="var(--color-cyan-main)" stopOpacity={0.34} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    interval={0}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => (String(value).length > 10 ? `${String(value).slice(0, 10)}...` : value)}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={42} />
                  <RechartsTooltip content={<ChartTooltip valueSuffix=" MB" />} cursor={{ fill: "var(--primary-softer)" }} />
                  <Bar dataKey="memory" name={t("内存 MB")} fill={`url(#${resourceChartGradientId})`} radius={[7, 7, 2, 2]} maxBarSize={34} minPointSize={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">{t("暂无在线项目")}</div>
          )}
        </div>
      </Panel>
    </section>
  );
}
