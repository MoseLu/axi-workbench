import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AppTFunction } from "../../app-registry";
import { AxiTag, type AxiTagType } from "@axi/core";
import i18n from "../../i18n";

export const statusLabelKeys: Record<string, string> = {
  online: "运行中",
  missing: "未托管",
  stopped: "已停止",
  stopping: "停止中",
  launching: "启动中",
  errored: "异常",
  ok: "正常",
  fail: "异常",
  idle: "未启动",
  partial: "部分运行",
  ready: "就绪",
  discovered: "已登记",
  degraded: "降级",
  active: "已生效",
  configured: "已接入",
  unconfigured: "未配置",
  available: "可用",
  unavailable: "不可用",
  unchecked: "未巡检",
  checking: "巡检中"
};

const statusColor: Record<string, string> = {
  ok: "var(--green)",
  online: "var(--green)",
  idle: "var(--amber)",
  missing: "var(--amber)",
  stopped: "var(--amber)",
  fail: "var(--red)",
  errored: "var(--red)",
  partial: "var(--primary)",
  ready: "var(--green)",
  discovered: "var(--primary)",
  degraded: "var(--amber)",
  active: "var(--green)",
  configured: "var(--green)",
  unconfigured: "var(--amber)",
  available: "var(--green)",
  unavailable: "var(--red)",
  unchecked: "var(--amber)",
  checking: "var(--primary)",
  launching: "var(--primary)"
};

export function serviceHealthLabel(service: any) {
  if (service.health?.status) return service.health.status;
  if (service.pm2.status === "missing") return "idle";
  return service.health.ok ? "ok" : "fail";
}

export function serviceRoleLabel(serviceId: string, projectId?: string) {
  if (serviceId.endsWith("-backend")) return i18n.t("后端");
  if (serviceId.endsWith("-web")) return i18n.t("前端");
  if (serviceId.endsWith("-relay")) return i18n.t("中继");
  if (serviceId.endsWith("-proxy")) return i18n.t("入口");
  if (serviceId.endsWith("-alert-watch")) return i18n.t("告警");
  if (projectId && serviceId === projectId) return i18n.t("服务");
  return i18n.t("组件");
}

export function statusText(value: string, t: AppTFunction) {
  const labelKey = statusLabelKeys[value];
  return labelKey ? t(labelKey) : value;
}

export function statusTagType(value: string): AxiTagType {
  if (["ok", "online", "ready", "active", "configured", "available"].includes(value)) return "success";
  if (["fail", "errored", "unavailable"].includes(value)) return "danger";
  if (["idle", "missing", "stopped", "degraded", "unconfigured", "unchecked"].includes(value)) return "warning";
  return "primary";
}

/**
 * @deprecated StatusChip is a thin presentation wrapper around `<AxiTag>`
 * that adds a status-dot prefix. Prefer `<AxiTag>` directly when you do not
 * need the dot decoration; otherwise keep this wrapper for visual parity.
 */
export function StatusChip({ label, value }: { label?: string; value: string }) {
  const { t } = useTranslation();
  return (
    <AxiTag className={`status-chip status-chip-${value}`} color={statusColor[value] || "var(--muted)"} effect="light" round type={statusTagType(value)}>
      {label ? <span className="status-chip-label">{label}</span> : null}
      <span className="status-dot" />
      <span className="status-chip-value">{statusText(value, t)}</span>
    </AxiTag>
  );
}

const metricTagTypes: Record<string, AxiTagType> = {
  mac: "blue",
  vm: "purple",
  linux: "green",
  local: "cyan",
  ssh: "geekblue",
  "direct-ssh": "geekblue",
  "tcp-ssh": "geekblue",
  "direct-ethernet": "cyan",
  lan: "cyan",
  staging: "gold",
  production: "red",
  prod: "red",
  development: "blue",
  dev: "blue"
};

export function metricTagType(value: ReactNode): AxiTagType {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim().toLowerCase() : "";
  return metricTagTypes[text] || "info";
}

/**
 * @deprecated MetricTag is a thin wrapper around `<AxiTag>`. Use `<AxiTag>`
 * directly with the inferred `type` value to avoid the extra import.
 */
export function MetricTag({ children, color, type }: { children: ReactNode; color?: string; type?: AxiTagType }) {
  return <AxiTag className="metric-tag" color={color} effect="light" round type={type || metricTagType(children)}>{children}</AxiTag>;
}

export type RuntimePm2Metrics = {
  online?: number;
  total?: number;
  cpu?: number;
  restarts?: number;
};

export function runtimeCountTagType(pm2: RuntimePm2Metrics): AxiTagType {
  const online = pm2.online || 0;
  const total = pm2.total || 0;
  if (!total) return "warning";
  if (online === total) return "success";
  if (online > 0) return "warning";
  return "danger";
}

export function cpuMetricTagType(cpu?: number): AxiTagType {
  const value = cpu || 0;
  if (value >= 80) return "danger";
  if (value >= 50) return "warning";
  if (value > 0) return "cyan";
  return "blue";
}

export function restartMetricTagType(restarts?: number): AxiTagType {
  const value = restarts || 0;
  if (value >= 10) return "danger";
  if (value > 0) return "warning";
  return "success";
}
