import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AxiCrud, AxiPagination, AxiTable, AxiTableButton, useAxiClientPagination } from "@axi/crud";
import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { api, requestErrorMessage } from "../../lib/api";
import { StatusChip } from "../status/status";

type AlertChannelRow = {
  id: string;
  name: string;
  description: string;
  provider: string;
  configuredStatus: string;
  runtimeStatus: string;
  renderFormat: string;
  templateStatus: string;
  profiles: string;
  interval: string;
  failureRule: string;
  recovery: string;
  canSendTest: boolean;
};

export function useAlertsData() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAlerts(await api("/api/alerts"));
    } catch (error) {
      console.error(requestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
	      await api("/api/notify-test", {
	        method: "POST",
	        body: JSON.stringify({ content: t("DevSvc 飞书告警通道自检：本地服务面板已经接入通知入口。") })
	      });
      await load();
    } catch (error) {
      console.error(requestErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return { alerts, loading, sendTest, testing };
}

export function AlertsPage() {
  const { t } = useTranslation();
  const tableToolbarContainer = useTableToolbarSlot();
  const { alerts, loading, sendTest, testing } = useAlertsData();
  const notification = alerts?.notification;
  const policy = alerts?.alerts || {};
  const profiles = policy.monitorProfiles || [];
  const configured = Boolean(notification);
  const rows: AlertChannelRow[] = [
    {
      id: "feishu",
      name: "Feishu",
	      description: notification?.channel || t("飞书告警"),
      provider: notification?.provider || "-",
      configuredStatus: loading ? "launching" : configured ? "configured" : "unconfigured",
      runtimeStatus: loading ? "launching" : notification?.daemonRunning ? "online" : configured ? "stopped" : "unconfigured",
	      renderFormat: notification?.renderFormat === "text-fallback" ? t("文本降级") : notification?.renderFormat || "-",
	      templateStatus: notification?.cardConfigured ? t("卡片启用") : configured ? t("未启用") : "-",
	      profiles: configured ? profiles.join(", ") || "-" : "-",
	      interval: configured ? t("{{seconds}} 秒", { seconds: Math.round((policy.intervalMs || 0) / 1000) }) : "-",
	      failureRule: configured ? t("连续 {{count}} 次", { count: policy.failureThreshold || 3 }) : "-",
	      recovery: configured ? policy.notifyOnRecovery === false ? t("关闭状态") : t("开启") : "-",
      canSendTest: configured
    },
    {
      id: "wecom",
	      name: t("企业微信"),
	      description: t("企业微信告警"),
      provider: "-",
      configuredStatus: "unconfigured",
      runtimeStatus: "unconfigured",
      renderFormat: "-",
      templateStatus: "-",
      profiles: "-",
      interval: "-",
      failureRule: "-",
      recovery: "-",
      canSendTest: false
    },
    {
      id: "email",
	      name: t("邮箱告警"),
	      description: t("邮件通知"),
      provider: "-",
      configuredStatus: "unconfigured",
      runtimeStatus: "unconfigured",
      renderFormat: "-",
      templateStatus: "-",
      profiles: "-",
      interval: "-",
      failureRule: "-",
      recovery: "-",
      canSendTest: false
    }
  ];
  const alertPagination = useAxiClientPagination(rows, { pageSize: 10 });
  const columns: any[] = [
    {
	      title: t("通知通道"),
      children: [
        {
	          title: t("名称"),
          dataIndex: "name",
          width: 150,
          render: (_: string, row: AlertChannelRow) => (
            <div className="service-cell">
              <div className="service-name">{row.name}</div>
              <div className="service-desc">{row.description}</div>
            </div>
          )
        },
        {
	          title: t("发送器"),
          dataIndex: "provider",
          width: 110,
          render: (value: string) => <span className="component-name" aria-label={value}>{value}</span>
        }
      ]
    },
    {
	      title: t("通道状态"),
      children: [
        {
	          title: t("接入"),
          dataIndex: "configuredStatus",
          width: 92,
          render: (value: string) => <StatusChip value={value} />
        },
        {
	          title: t("运行"),
          dataIndex: "runtimeStatus",
          width: 92,
          render: (value: string) => <StatusChip value={value} />
        }
      ]
    },
    {
	      title: t("配置"),
      children: [
        {
	          title: t("格式/模板"),
          width: 150,
          render: (_: unknown, row: AlertChannelRow) => row.renderFormat === "-" && row.templateStatus === "-"
            ? <span className="service-desc">-</span>
            : (
              <div className="check-target-stack">
                <span className="check-target" aria-label={row.renderFormat}>{row.renderFormat}</span>
                <span className="check-target" aria-label={row.templateStatus}>{row.templateStatus}</span>
              </div>
            )
        }
      ]
    },
    {
	      title: t("告警策略"),
      children: [
        {
	          title: t("策略摘要"),
          width: 260,
          render: (_: unknown, row: AlertChannelRow) => row.profiles === "-"
            ? <span className="service-desc">-</span>
            : (
              <div className="check-target-stack">
                <span className="check-target" aria-label={row.profiles}>{row.profiles}</span>
	                <span className="check-target" aria-label={`${row.interval} / ${row.failureRule} / ${t("恢复通知{{status}}", { status: row.recovery })}`}>
	                  {row.interval} / {row.failureRule} / {t("恢复通知{{status}}", { status: row.recovery })}
                </span>
              </div>
            )
        }
      ]
    },
    {
	      title: t("操作"),
      fixed: "end",
      children: [
        {
	          title: t("命令"),
          fixed: "end",
          width: 136,
          render: (_: unknown, row: AlertChannelRow) => row.canSendTest ? (
            <AxiTableButton
              label={t("发送测试通知")}
              loading={testing}
              title={t("发送测试通知")}
              tone="primary"
              onClick={() => void sendTest()}
            />
          ) : <span className="service-desc">-</span>
        }
      ]
    }
  ];

  return (
    <AxiCrud dataSource={alertPagination.rows} className="services-panel alerts-panel">
      <AxiTable<AlertChannelRow>
        bordered
        className="services-table alerts-table"
        columns={columns}
        dataSource={alertPagination.rows}
        loading={loading}
        pagination={false}
        rowKey="id"
        scroll={{ x: 990, y: "calc(100vh - var(--topbar-height) - var(--toolbar-height) - var(--breadcrumb-height) - 20px)" }}
        size="small"
        tableLayout="fixed"
        toolbarContainer={tableToolbarContainer}
        toolbar={{ storageKey: "alerts-table" }}
      />
      <div className="services-pagination">
        <AxiPagination
          current={alertPagination.current}
          pageSize={alertPagination.pageSize}
          total={alertPagination.total}
	          totalText={(total) => t("共 {{total}} 个通道", { total })}
          onChange={alertPagination.onChange}
        />
      </div>
    </AxiCrud>
  );
}
