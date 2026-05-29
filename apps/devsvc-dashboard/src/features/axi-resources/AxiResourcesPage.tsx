import { useEffect, useMemo, useState } from "react";
import { Button as AntButton } from "antd";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { AxiTable } from "@axi/crud";
import { api, requestErrorMessage } from "../../lib/api";
import { MetricTag, StatusChip } from "../status/status";
import type { AxiResource, AxiResourcesPayload } from "./axiResources";

const surfaceLabels: Record<string, string> = {
  "dashboard-host": "应用宿主",
  "hosted-app": "托管应用",
  "hosted-subroute": "托管子路由",
  "resource-index": "资源索引"
};

export function AxiResourcesPage() {
  const { t } = useTranslation();
  const { resourceId } = useParams();
  const tableToolbarContainer = useTableToolbarSlot();
  const [data, setData] = useState<AxiResourcesPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resources = data?.resources || [];
  const visibleResources = resourceId ? resources.filter((resource) => resource.id === resourceId) : resources;

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api("/api/axi/resources") as AxiResourcesPayload);
    } catch (reason) {
      setError(requestErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<any[]>(() => [
    {
      title: t("Axi 资源"),
      children: [
        {
          title: t("名称"),
          dataIndex: "title",
          width: 260,
          render: (_: string, resource: AxiResource) => (
            <div className="service-cell">
              <div className="service-name">{t(resource.title)}</div>
              <div className="service-desc" title={resource.id}>{resource.id}</div>
            </div>
          )
        },
        {
          title: t("类型"),
          dataIndex: "kind",
          width: 150,
          render: (value: string) => <MetricTag>{t(value)}</MetricTag>
        }
      ]
    },
    {
      title: t("Axi 应用收归"),
      children: [
        {
          title: t("状态"),
          dataIndex: "status",
          align: "center" as const,
          width: 100,
          render: (value: string) => <StatusChip value={value} />
        },
        {
          title: t("收归方式"),
          dataIndex: "surface",
          align: "center" as const,
          width: 130,
          render: (value: string) => <MetricTag>{t(surfaceLabels[value] || value)}</MetricTag>
        },
        {
          title: t("Axi 入口"),
          dataIndex: "dashboardRoute",
          align: "center" as const,
          width: 150,
          render: (value?: string) => value ? (
            <AntButton href={value} size="small" type="link">
              {t("打开")}
            </AntButton>
          ) : (
            <MetricTag>{t("资源索引")}</MetricTag>
          )
        }
      ]
    },
    {
      title: t("Owner"),
      children: [
        {
          title: t("Owner 路径"),
          dataIndex: "ownerPath",
          width: 360,
          render: (value: string, resource: AxiResource) => (
            <div className="service-cell">
              <div className="service-name">{resource.ownerPathExists ? t("已登记") : t("未配置")}</div>
              <div className="service-desc" title={value}>{value}</div>
            </div>
          )
        },
        {
          title: t("能力"),
          dataIndex: "capabilities",
          width: 260,
          render: (values?: string[]) => (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {(values || []).slice(0, 4).map((value) => <MetricTag key={value}>{t(value)}</MetricTag>)}
            </div>
          )
        },
        {
          title: t("说明"),
          dataIndex: "notes",
          render: (value?: string) => <span className="service-desc" title={value}>{value ? t(value) : "-"}</span>
        }
      ]
    }
  ], [t]);

  return (
    <section className="panel services-panel">
      {error ? <div className="hosted-app-state is-error">{error}</div> : null}
      <AxiTable<AxiResource>
        bordered
        className="services-table server-ant-table"
        columns={columns}
        dataSource={visibleResources}
        loading={loading}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1380 }}
        size="small"
        tableLayout="fixed"
        toolbarContainer={tableToolbarContainer}
        toolbar={{ storageKey: "axi-resources-table" }}
      />
    </section>
  );
}
