import { useEffect, useState } from "react";
import { Button as AntButton, Space } from "antd";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AxiCrud, AxiDialog, AxiPagination, AxiTable, AxiTableButton, useAxiClientPagination } from "@axi/crud";
import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { api, requestErrorMessage } from "../../lib/api";
import { MetricTag, statusText, StatusChip } from "../status/status";

export function ServersPage() {
  const { t } = useTranslation();
  const tableToolbarContainer = useTableToolbarSlot();
  const [data, setData] = useState<any>(null);
  const [checkServer, setCheckServer] = useState<any>(null);
  const [checkText, setCheckText] = useState(() => t("选择服务器后可以执行只读巡检。"));
  const [checkResults, setCheckResults] = useState<Record<string, { status: string; text: string; checkedAt?: string }>>({});
  const [loading, setLoading] = useState(false);
	  const servers = data?.remoteServers?.servers || [];
	  const serverPagination = useAxiClientPagination(servers, { pageSize: 5 });

  useEffect(() => {
    if (!checkServer) setCheckText(t("选择服务器后可以执行只读巡检。"));
  }, [checkServer, t]);

  function displayCheckTime(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString();
  }

  function seedCheckResults(rows: any[]) {
    const seeded = Object.fromEntries(
      rows
        .filter((server) => server.checkResult)
        .map((server) => [
          server.id,
          {
            status: server.checkResult.status,
            text: server.checkResult.text,
            checkedAt: displayCheckTime(server.checkResult.checkedAt)
          }
        ])
    );
    setCheckResults((current) => ({
      ...seeded,
      ...current
    }));
  }

  async function load() {
    const body = await api("/api/alerts");
    const rows = body?.remoteServers?.servers || [];
    setData(body);
    seedCheckResults(rows);
    if (rows.some((server) => !server.checkResult)) {
      void runChecks(rows);
    }
  }

  async function runCheck(serverId = checkServer?.id, showDialog = true) {
    if (!serverId) return;
	    const checkingText = t("正在执行只读巡检...");
    setCheckResults((current) => ({
      ...current,
      [serverId]: { status: "checking", text: checkingText }
    }));
    if (showDialog) {
      setLoading(true);
      setCheckText(checkingText);
    }
    try {
      const result = await api(`/api/server-check?server=${encodeURIComponent(serverId)}`);
	      const text = [result.stdout, result.stderr].filter(Boolean).join("\n") || t("暂无输出。");
      setCheckResults((current) => ({
        ...current,
        [serverId]: {
          status: result.checkResult?.status || (result.ok ? "available" : "unavailable"),
          text: result.checkResult?.text || text,
          checkedAt: displayCheckTime(result.checkResult?.checkedAt || result.checkedAt)
        }
      }));
      if (showDialog) setCheckText(text);
    } catch (error) {
      const text = requestErrorMessage(error);
      setCheckResults((current) => ({
        ...current,
        [serverId]: {
          status: "unavailable",
          text,
          checkedAt: new Date().toLocaleTimeString()
        }
      }));
      if (showDialog) setCheckText(text);
    } finally {
      if (showDialog) setLoading(false);
    }
  }

  async function runChecks(rows: any[]) {
    if (!rows.length) return;
    for (const server of rows) {
      await runCheck(server.id, false);
    }
  }

  function openCheck(server: any) {
    setCheckServer(server);
    void runCheck(server.id);
  }

  useEffect(() => {
    void load();
  }, []);

  function serverCheckSummary(server: any) {
    const result = checkResults[server.id];
    if (!result) {
      return {
        status: "unchecked",
	        title: t("未执行巡检"),
        detail: `${server.checkMode || "ssh-direct"} / ${server.connectTimeoutSeconds || 6}s`
      };
    }
	    const firstLine = result.text.split("\n").find(Boolean) || t("暂无输出。");
	    return {
	      status: result.status,
	      title: result.checkedAt ? t("最近巡检 {{time}}", { time: result.checkedAt }) : statusText(result.status, t),
      detail: firstLine
    };
  }

  function serverEndpointText(server: any) {
    if (!server.endpoint?.host) return "";
    return `${server.endpoint.host}:${server.endpoint.port || 22}`;
  }

  const columns: any[] = [
    {
	      title: t("服务器"),
      children: [
        {
	          title: t("名称"),
          align: "center",
          dataIndex: "id",
          width: 280,
          sorter: (a, b) => a.id.localeCompare(b.id),
          render: (_, server) => {
            const endpointText = serverEndpointText(server);
            const detail = [
              server.description,
	              server.region ? t("地域：{{region}}", { region: server.region }) : "",
	              endpointText ? t("入口：{{endpoint}}", { endpoint: endpointText }) : "",
	              server.spec ? t("规格：{{spec}}", { spec: server.spec }) : "",
              server.sshAlias ? `SSH：${server.sshAlias}` : "",
              server.aliases?.join(", ")
            ].filter(Boolean).join(" · ");
            return (
              <div className="service-cell">
                <div className="service-name">{server.title || server.id}</div>
                <div className="service-desc" title={detail}>{detail}</div>
              </div>
            );
          }
        }
      ]
    },
    {
	      title: t("接入信息"),
      children: [
        {
	          title: t("可用性"),
          align: "center",
          width: 88,
          render: (_, server) => <StatusChip value={serverCheckSummary(server).status} />
        },
        {
	          title: t("巡检结果"),
          align: "center",
          width: 220,
          render: (_, server) => {
            const summary = serverCheckSummary(server);
            return (
              <div className="service-cell">
                <div className="service-name">{summary.title}</div>
                <div className="service-desc" title={summary.detail}>{summary.detail}</div>
              </div>
            );
          }
        },
        {
	          title: t("环境"),
          align: "center",
          width: 82,
          render: (_, server) => <MetricTag>{server.environment || "-"}</MetricTag>
        },
        {
	          title: t("接入"),
          align: "center",
          width: 200,
          render: (_, server) => (
            <div className="service-cell">
	              <div className="service-name">{server.hasSecretRef ? t("已接入 Bitwarden 引用") : t("未接入")}</div>
              <div className="service-desc">
	                {[server.source || "-", server.checkMode || "ssh-direct", serverEndpointText(server), server.lastVerified ? t("验证 {{time}}", { time: server.lastVerified }) : ""].filter(Boolean).join(" / ")}
              </div>
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
          align: "center",
          fixed: "end",
          width: 100,
          render: (_, server) => (
            <AxiTableButton label={t("只读巡检")} title={t("只读巡检")} tone="primary" onClick={() => openCheck(server)} />
          )
        }
      ]
    }
  ];

  return (
    <AxiCrud dataSource={serverPagination.rows} className="page-stack">
      <section className="panel server-panel">
        <div className="server-table-wrap">
          <AxiTable<any>
            bordered
            className="services-table server-ant-table"
            columns={columns}
            dataSource={serverPagination.rows}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1280 }}
            size="small"
            tableLayout="fixed"
            toolbarContainer={tableToolbarContainer}
            toolbar={{ storageKey: "servers-table" }}
          />
        </div>
        <div className="services-pagination">
          <AxiPagination
            current={serverPagination.current}
            pageSize={serverPagination.pageSize}
            total={serverPagination.total}
	            totalText={(total) => t("共 {{total}} 台服务器", { total })}
            onChange={serverPagination.onChange}
          />
        </div>
      </section>
      <AxiDialog
        closeLabel={t("关闭")}
        open={Boolean(checkServer)}
	        title={checkServer ? t("{{name}} 只读巡检", { name: checkServer.title || checkServer.id }) : t("只读巡检")}
        width={920}
        fullscreenLabel={t("切换全屏")}
        footer={(
          <Space>
            <AntButton icon={<RefreshCw size={14} />} loading={loading} onClick={() => void runCheck()}>
	              {t("重新巡检")}
            </AntButton>
            <AntButton type="primary" onClick={() => setCheckServer(null)}>
	              {t("关闭")}
            </AntButton>
          </Space>
        )}
        onClose={() => setCheckServer(null)}
      >
        <pre className="logs service-log-dialog-logs">{checkText}</pre>
      </AxiDialog>
    </AxiCrud>
  );
}
