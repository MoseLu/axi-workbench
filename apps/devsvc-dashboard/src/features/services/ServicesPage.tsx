import { useEffect, useMemo, useState } from "react";
import { Button as AntButton } from "antd";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AxiCrud, AxiDialog, AxiPagination, AxiTable, AxiTableButton, AxiTableActions, useAxiClientPagination } from "@axi/crud";
import { AxiTag } from "@axi/core";
import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { loadLogText, requestErrorMessage } from "../../lib/api";
import { formatBytes, formatUptime } from "../../lib/format";
import { cpuMetricTagType, restartMetricTagType, runtimeCountTagType, serviceHealthLabel, serviceRoleLabel, StatusChip } from "../status/status";
import { ServicesToolbar, type ServiceHealthFilter, type ServiceManagedFilter } from "./ServicesToolbar";

export function ServicesPage({ data }: { data: any }) {
  const { t } = useTranslation();
  const tableToolbarContainer = useTableToolbarSlot();
  const servicePageSizeOptions = [1, 2, 3, 4, 5];
  const projects = data.overview?.projects || [];
  const [managedFilter, setManagedFilter] = useState<ServiceManagedFilter>("managed");
  const [healthFilter, setHealthFilter] = useState<ServiceHealthFilter>("normal");
  const [logProject, setLogProject] = useState<any>(null);
  const [logText, setLogText] = useState(() => t("请选择一个项目查看日志。"));
  const [logLoading, setLogLoading] = useState(false);
  const resetServiceFilters = () => {
    setManagedFilter("managed");
    setHealthFilter("normal");
  };

  const pageToolbar = useMemo(() => (
    <ServicesToolbar
      healthFilter={healthFilter}
      managedFilter={managedFilter}
      onHealthFilterChange={setHealthFilter}
      onManagedFilterChange={setManagedFilter}
      onReset={resetServiceFilters}
    />
  ), [healthFilter, managedFilter]);

  useEffect(() => {
    if (!logProject) setLogText(t("请选择一个项目查看日志。"));
  }, [logProject, t]);

  const filteredProjects = projects.filter((project) => {
    const isManaged = project.pm2.status !== "missing";
    const isHealthy = serviceHealthLabel(project) === "ok";
    const managedMatches =
      managedFilter === "all" ||
      (managedFilter === "managed" && isManaged) ||
      (managedFilter === "unmanaged" && !isManaged);
    const healthMatches =
      healthFilter === "all" ||
      (healthFilter === "normal" && isHealthy) ||
      (healthFilter === "abnormal" && !isHealthy);
    return managedMatches && healthMatches;
  });
  const servicePagination = useAxiClientPagination<any>(filteredProjects, { pageSize: 5, resetKey: `${managedFilter}:${healthFilter}` });
  const pageProjects = servicePagination.rows;
  const rows = pageProjects.flatMap((project) => {
    const services = project.services?.length ? project.services : [];
    return services.map((service, serviceIndex) => ({
      id: `${project.id}:${service.id}`,
      project,
      service,
      serviceIndex,
      serviceCount: services.length
    }));
  });
  function projectRowCell(row: any) {
    return {
      rowSpan: row.serviceIndex === 0 ? row.serviceCount : 0
    };
  }
  function projectCheckTargets(project: any) {
    return (project.services || []).flatMap((service: any) =>
      (service.health?.checks || []).map((check: any, index: number) => ({
        key: `${service.id}:${index}`,
        target: check.url || check.command || check.detail || "-"
      }))
    );
  }
  async function loadProjectLogs(project = logProject) {
    if (!project) return;
    setLogLoading(true);
    try {
      setLogText(await loadLogText(project.id));
    } catch (error) {
      setLogText(requestErrorMessage(error));
    } finally {
      setLogLoading(false);
    }
  }
	  function openProjectLogs(project: any) {
	    setLogProject(project);
	    setLogText(t("日志加载中..."));
	    void loadProjectLogs(project);
	  }

  const columns: any[] = [
    {
	      title: t("项目"),
      fixed: "start",
      children: [
        {
		          title: t("名称"),
          align: "center",
          dataIndex: "id",
          fixed: "start",
          width: 220,
          onCell: (row) => projectRowCell(row),
          sorter: (a, b) => a.project.id.localeCompare(b.project.id),
          render: (_, row) => (
            <div className="service-cell">
              <div className="service-name">{row.project.title || row.project.id}</div>
              <div className="service-desc">{row.project.description}</div>
            </div>
          )
        }
      ]
    },
    {
	      title: t("整体状态"),
      children: [
        {
		          title: t("托管"),
          align: "center",
          width: 92,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <StatusChip value={row.project.pm2.status} />
        },
        {
		          title: t("健康"),
          align: "center",
          width: 88,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <StatusChip value={serviceHealthLabel(row.project)} />
        },
        {
		          title: t("检查"),
          align: "center",
          width: 76,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => (
            <div className="check-status-stack">
              {row.project.health.checks.length ? row.project.health.checks.map((check, index) => {
                return (
                  <div className="check-line check-line-center" key={index}>
	                    <AxiTag className="check-badge" effect="light" type={check.ok ? "success" : "danger"}>{check.ok ? t("正常") : t("异常")}</AxiTag>
                  </div>
                );
	              }) : <AxiTag className="check-badge" effect="light" type="warning">{t("未配置")}</AxiTag>}
            </div>
          )
        }
      ]
    },
    {
	      title: t("组件"),
      children: [
        {
		          title: t("类型"),
          align: "center",
          width: 64,
          render: (_, row) => <span className="component-role">{serviceRoleLabel(row.service.id, row.project.id)}</span>
        },
        {
		          title: t("名称"),
          align: "center",
          width: 180,
          render: (_, row) => <span className="component-name" aria-label={row.service.id}>{row.service.id}</span>
        },
        {
		          title: t("进程"),
          align: "center",
          width: 92,
          render: (_, row) => <StatusChip value={row.service.pm2.status} />
        },
        {
		          title: t("健康"),
          align: "center",
          width: 88,
          render: (_, row) => <StatusChip value={serviceHealthLabel(row.service)} />
        }
      ]
    },
    {
	      title: t("资源"),
      children: [
        {
		          title: t("运行"),
          align: "center",
          width: 80,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <AxiTag className="metric-tag" effect="light" round type={runtimeCountTagType(row.project.pm2)}>{row.project.pm2.online}/{row.project.pm2.total}</AxiTag>
        },
        {
		          title: t("内存"),
          align: "center",
          width: 104,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <AxiTag className="metric-tag" effect="light" round type="geekblue">{formatBytes(row.project.pm2.memoryBytes)}</AxiTag>
        },
        {
          title: "CPU",
          align: "center",
          width: 76,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <AxiTag className="metric-tag" effect="light" round type={cpuMetricTagType(row.project.pm2.cpu)}>{row.project.pm2.cpu}%</AxiTag>
        },
        {
		          title: t("时长"),
          align: "center",
          width: 116,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <AxiTag className="metric-tag" effect="light" round type="purple">{formatUptime(row.project.pm2.uptimeMs)}</AxiTag>
        },
        {
		          title: t("重启次数"),
          align: "center",
          width: 80,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => <AxiTag className="metric-tag" effect="light" round type={restartMetricTagType(row.project.pm2.restarts)}>{row.project.pm2.restarts}</AxiTag>
        }
      ]
    },
    {
	      title: t("操作"),
      fixed: "end",
      children: [
        {
		          title: t("目标"),
          align: "center",
          fixed: "end",
          width: 240,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => {
            const targets = projectCheckTargets(row.project);
            return (
              <div className="check-target-stack">
                {targets.length ? targets.map(({ key, target }) => (
                  <span className="check-target" aria-label={target} key={key}>{target}</span>
                )) : <span className="service-desc">-</span>}
              </div>
            );
          }
        },
        {
          title: t("命令"),
          align: "center",
          fixed: "end",
          width: 260,
          onCell: (row) => projectRowCell(row),
          render: (_, row) => (
            <AxiTableActions>
              <AxiTableButton label={t("启动")} title={t("启动")} tone="success" onClick={() => data.action("start", row.project.id)} />
              <AxiTableButton label={t("重启")} title={t("重启")} tone="primary" onClick={() => data.action("restart", row.project.id)} />
              <AxiTableButton label={t("停止")} title={t("停止")} tone="danger" onClick={() => data.action("stop", row.project.id)} />
              <AxiTableButton label={t("日志")} title={t("日志")} onClick={() => openProjectLogs(row.project)} />
            </AxiTableActions>
          )
        }
      ]
    }
  ];

  return (
    <AxiCrud className="services-panel" dataSource={rows} pageToolbar={pageToolbar}>
      <AxiTable<any>
        bordered
        className="services-table"
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowKey="id"
        rowClassName={(row) => `service-row service-row-${serviceHealthLabel(row.project)}`}
        scroll={{ x: 1828 }}
        size="small"
        tableLayout="fixed"
        toolbarContainer={tableToolbarContainer}
        toolbar={{ storageKey: "services-table" }}
      />
      <div className="services-pagination">
        <AxiPagination
          current={servicePagination.current}
          pageSize={servicePagination.pageSize}
          pageSizeOptions={servicePageSizeOptions}
          total={servicePagination.total}
	          totalText={(total) => t("共 {{total}} 个服务", { total })}
          onChange={servicePagination.onChange}
        />
      </div>
      <AxiDialog
        closeLabel={t("关闭")}
        open={Boolean(logProject)}
        title={logProject ? t("{{name}} 日志", { name: logProject.title || logProject.id }) : t("日志")}
        width={920}
        fullscreenLabel={t("切换全屏")}
        footer={(
          <>
            <AntButton icon={<RefreshCw size={14} />} loading={logLoading} onClick={() => void loadProjectLogs()}>
              {t("刷新日志")}
            </AntButton>
            <AntButton type="primary" onClick={() => setLogProject(null)}>
              {t("关闭")}
            </AntButton>
          </>
        )}
        onClose={() => setLogProject(null)}
      >
        <pre className="logs service-log-dialog-logs">{logText}</pre>
      </AxiDialog>
    </AxiCrud>
  );
}
