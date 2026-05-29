import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AxiCrud, AxiPagination, AxiTable, AxiTableButton, useAxiClientPagination } from "@axi/crud";
import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { api } from "../../lib/api";
import { MetricTag, StatusChip } from "../status/status";

export function DeployPage() {
  const { t } = useTranslation();
  const tableToolbarContainer = useTableToolbarSlot();
  const [topology, setTopology] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [deployingRowId, setDeployingRowId] = useState("");
  const services = topology?.services || {};
  const targets = topology?.targets || [];
  const serviceRows = Object.entries(services) as Array<[string, any]>;
  const current = topology?.current;
  const deployRows = serviceRows.flatMap(([serviceId, service]) => {
    return targets.map((target) => ({
      id: `${serviceId}:${target.id}`,
      serviceId,
      service,
      targetId: target.id,
      target,
      active: current?.serviceId === serviceId && current?.targetId === target.id
    }));
  });
  const deployPagination = useAxiClientPagination(deployRows, { pageSize: 5 });

  async function load() {
    const body = await api("/api/topology");
    setTopology(body);
  }

  async function selectRoute(nextService: string, nextTarget: string) {
    const rowId = `${nextService}:${nextTarget}`;
    setDeployingRowId(rowId);
    try {
      const body = await api("/api/ingress/select", {
        method: "POST",
        body: JSON.stringify({ serviceId: nextService, targetId: nextTarget })
      });
      setResult(body);
      await load();
    } finally {
      setDeployingRowId("");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const columns: any[] = [
    {
	      title: t("服务"),
      fixed: "start",
      children: [
        {
	          title: t("名称"),
          align: "center",
          fixed: "start",
          width: 220,
          sorter: (a, b) => a.serviceId.localeCompare(b.serviceId),
          render: (_, row) => (
            <div className="service-cell">
              <div className="service-name">{row.service.title || row.serviceId}</div>
              <div className="service-desc">{row.serviceId}</div>
            </div>
          )
        }
      ]
    },
    {
	      title: t("入口"),
      children: [
        {
	          title: t("本地入口"),
          align: "center",
          width: 230,
          render: (_, row) => <span className="check-target" aria-label={row.service.localUrl || "-"}>{row.service.localUrl || "-"}</span>
        }
      ]
    },
    {
	      title: t("对应服务器"),
      children: [
        {
	          title: t("名称"),
          align: "center",
          width: 220,
          render: (_, row) => (
            <div className="service-cell">
              <div className="service-name">{row.target.title || row.targetId}</div>
              <div className="service-desc" title={row.target.note || row.target.strategy || ""}>
                {row.target.note || row.target.strategy || "-"}
              </div>
            </div>
          )
        },
        {
	          title: t("类型"),
          align: "center",
          width: 88,
          render: (_, row) => <MetricTag>{row.target.kind || "-"}</MetricTag>
        },
        {
	          title: t("接入"),
          align: "center",
          width: 156,
          render: (_, row) => <MetricTag>{row.target.access || "-"}</MetricTag>
        },
        {
	          title: t("策略"),
          align: "center",
          width: 160,
          render: (_, row) => <span className="component-name" aria-label={row.target.strategy || "-"}>{row.target.strategy || "-"}</span>
        }
      ]
    },
    {
	      title: t("当前绑定"),
      children: [
        {
	          title: t("状态"),
          align: "center",
          width: 92,
          filters: [
	            { text: t("已生效"), value: true },
	            { text: t("未绑定"), value: false }
          ],
          onFilter: (value, row) => row.active === value,
          render: (_, row) => row.active ? <StatusChip value={current?.status || "active"} /> : <MetricTag>-</MetricTag>
        },
        {
	          title: t("上游入口"),
          align: "center",
          width: 240,
          render: (_, row) => (
            <span className="check-target" aria-label={row.active ? current?.upstream || "-" : "-"}>
              {row.active ? current?.upstream || "-" : "-"}
            </span>
          )
        }
      ]
    },
    {
	      title: t("操作"),
      fixed: "end",
      children: [
        {
	          title: t("状态"),
          align: "center",
          fixed: "end",
          width: 92,
          filters: [
	            { text: t("就绪"), value: "ready" },
	            { text: t("已登记"), value: "discovered" },
	            { text: t("降级"), value: "degraded" }
          ],
          onFilter: (value, row) => row.target.status === value,
          render: (_, row) => <StatusChip value={row.target.status || "idle"} />
        },
        {
          title: t("命令"),
          align: "center",
          fixed: "end",
          width: 108,
          render: (_, row) => (
            <AxiTableButton
              active={row.active}
              label={t("重新部署")}
              loading={deployingRowId === row.id}
              title={t("重新部署")}
              tone="primary"
              onClick={() => void selectRoute(row.serviceId, row.targetId)}
            />
          )
        }
      ]
    }
  ];

  return (
    <AxiCrud dataSource={deployPagination.rows} className="page-stack">
      <section className="panel deploy-panel">
        <div className="deploy-table-wrap">
          <AxiTable<any>
            bordered
            className="services-table deploy-table"
            columns={columns}
            dataSource={deployPagination.rows}
            pagination={false}
            rowKey="id"
            rowClassName={(row) => row.active ? "deploy-row-active" : ""}
            scroll={{ x: 1666 }}
            size="small"
            tableLayout="fixed"
            toolbarContainer={tableToolbarContainer}
            toolbar={{ storageKey: "deploy-table" }}
          />
        </div>
        <div className="services-pagination">
          <AxiPagination
            current={deployPagination.current}
            pageSize={deployPagination.pageSize}
            total={deployPagination.total}
	            totalText={(total) => t("共 {{total}} 个上线目标", { total })}
            onChange={deployPagination.onChange}
          />
        </div>
        {result ? (
          <div className={`result-box ${result.ok ? "ok" : "warn"}`}>
	            <strong>{result.ok ? t("已切换") : result.error}</strong>
            {result.plan ? <ul>{result.plan.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </div>
        ) : null}
      </section>
    </AxiCrud>
  );
}
