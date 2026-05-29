import React from "react";
import { useTranslation } from "react-i18next";
import { Activity, CircleDot, Layers3, Square } from "lucide-react";

const OverviewCharts = React.lazy(() => import("./OverviewCharts"));

export function OverviewPage({ data, metrics }) {
  const { t } = useTranslation();
  const projects = data.overview?.projects || [];

  return (
    <div className="page-stack">
      <section className="metric-grid">
        <Metric title={t("注册项目")} value={metrics.total} icon={Layers3} />
        <Metric title={t("运行中")} value={metrics.online} icon={Activity} tone="green" />
        <Metric title={t("健康")} value={metrics.healthy} icon={CircleDot} tone="green" />
        <Metric title={t("未启动")} value={metrics.idle} icon={Square} tone="amber" />
      </section>

      <React.Suspense fallback={<div className="chart-empty chart-empty-loading">{t("图表加载中...")}</div>}>
        <OverviewCharts metrics={metrics} projects={projects} />
      </React.Suspense>

    </div>
  );
}

function Metric({ title, value, icon: Icon, tone = "blue" }) {
  return (
    <section className={`metric ${tone}`}>
      <Icon size={20} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </section>
  );
}
