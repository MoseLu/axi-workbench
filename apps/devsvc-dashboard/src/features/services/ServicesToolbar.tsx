import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

import { AxiSelect } from "@axi/widgets";

export type ServiceManagedFilter = "all" | "managed" | "unmanaged";
export type ServiceHealthFilter = "all" | "normal" | "abnormal";

export function ServicesToolbar({
  managedFilter,
  healthFilter,
  onManagedFilterChange,
  onHealthFilterChange,
  onReset
}: {
  managedFilter: ServiceManagedFilter;
  healthFilter: ServiceHealthFilter;
  onManagedFilterChange: (value: ServiceManagedFilter) => void;
  onHealthFilterChange: (value: ServiceHealthFilter) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const hasActiveFilter = managedFilter !== "managed" || healthFilter !== "normal";
  return (
    <div className="toolbar-filter-row" aria-label={t("服务筛选")}>
      <label className="toolbar-filter-group">
        <span className="toolbar-filter-label">{t("托管")}</span>
        <AxiSelect
          aria-label={t("托管筛选")}
          className="toolbar-filter-select"
          options={[
            { label: t("全部"), value: "all" },
            { label: t("已托管"), value: "managed" },
            { label: t("未托管"), value: "unmanaged" }
          ]}
          size="small"
          value={managedFilter}
          onChange={onManagedFilterChange}
        />
      </label>
      <label className="toolbar-filter-group">
        <span className="toolbar-filter-label">{t("健康")}</span>
        <AxiSelect
          aria-label={t("健康筛选")}
          className="toolbar-filter-select"
          options={[
            { label: t("全部"), value: "all" },
            { label: t("正常"), value: "normal" },
            { label: t("异常"), value: "abnormal" }
          ]}
          size="small"
          value={healthFilter}
          onChange={onHealthFilterChange}
        />
      </label>
      {hasActiveFilter ? (
        <button className="toolbar-filter-reset" type="button" onClick={onReset}>
          <RotateCcw size={14} />
          <span>{t("重置")}</span>
        </button>
      ) : null}
    </div>
  );
}
