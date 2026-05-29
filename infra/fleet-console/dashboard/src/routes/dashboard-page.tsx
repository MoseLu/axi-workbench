import {
  ApiOutlined,
  CloudServerOutlined,
  LinkOutlined,
  MonitorOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Badge, Button, Empty, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useOutletContext } from "react-router-dom";
import { Panel, StatCard, TopologyCore } from "../components/fleet-widgets";
import { copyText, credentialStatusIsReady, credentialStatusText, lifecycleColor, lifecycleText, providerText } from "../lib/fleet-model";
import type { FleetModel, MachineRow, MonitorRow } from "../lib/fleet-types";

export function DashboardPage() {
  const { rows, summary, serverProbes, services } = useOutletContext<FleetModel>();

  const machineColumns: ColumnsType<MachineRow> = [
    {
      title: "服务器",
      dataIndex: "display_name",
      key: "display_name",
      width: 240,
      align: "center",
      render: (_, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Space size={8} wrap={false} className="table-cell-inline">
            <CloudServerOutlined className="row-icon" />
            <Typography.Text strong copyable={{ text: row.id }}>
              {row.display_name}
            </Typography.Text>
          </Space>
          <Typography.Text className="mono subtext">{row.id}</Typography.Text>
          <Typography.Text className="mono subtext">{row.selected_host || row.public_ip || row.tailscale_name || "-"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "lifecycle",
      key: "lifecycle",
      width: 120,
      align: "center",
      render: (value: MachineRow["lifecycle"]) => <Badge status={lifecycleColor[value] as never} text={lifecycleText[value]} />,
    },
    {
      title: "归属",
      key: "provider",
      width: 150,
      align: "center",
      render: (_, row) => (
        <Space size={6} wrap className="table-cell-inline">
          <Tag>{providerText[row.provider] ?? row.provider}</Tag>
          <Tag color={row.role === "app" ? "blue" : "geekblue"}>{row.role}</Tag>
        </Space>
      ),
    },
    {
      title: "能力标签",
      dataIndex: "tags",
      key: "tags",
      align: "center",
      render: (tags: string[]) => (
        <Space size={[4, 4]} wrap className="table-cell-inline">
          {tags.map((tag) => (
            <Tag key={tag} className="tag-tight">
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "探针",
      key: "monitor_count",
      width: 86,
      align: "center",
      render: (_, row) => <Tag color={row.live_probe_count > 0 ? "cyan" : "red"}>{row.live_probe_count}</Tag>,
    },
    {
      title: "服务",
      key: "service_count",
      width: 86,
      align: "center",
      render: (_, row) => <Tag color={row.service_count > 0 ? "blue" : "default"}>{row.service_count}</Tag>,
    },
    {
      title: "凭证",
      key: "credential_status",
      width: 134,
      align: "center",
      render: (_, row) => {
        const ok = credentialStatusIsReady(row.credential_status);
        return (
          <Tag icon={<ToolOutlined />} color={ok ? "success" : "warning"}>
            {credentialStatusText[row.credential_status || "ok"] ?? row.credential_status}
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 104,
      align: "center",
      render: (_, row) => (
        <Space size={4} className="table-cell-inline">
          <Button size="small" icon={<LinkOutlined />} onClick={() => copyText(`ssh -F generated/ssh_config fleet-${row.id}`)} />
          <Button size="small" icon={<ToolOutlined />} onClick={() => copyText(`cockpit ${row.id}:9090`)} />
        </Space>
      ),
    },
  ];

  const monitorColumns: ColumnsType<MonitorRow> = [
    {
      title: "监控项",
      dataIndex: "display_name",
      key: "display_name",
      width: 220,
      align: "center",
      render: (name: string, row) => (
        <Space size={8} className="table-cell-inline">
          {row.type === "http" ? <ApiOutlined className="row-icon" /> : <SafetyCertificateOutlined className="row-icon" />}
          <Typography.Text strong>{name}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "服务器",
      dataIndex: "machine_name",
      key: "machine_name",
      width: 190,
      align: "center",
      render: (machineName: string) => <Typography.Text>{machineName}</Typography.Text>,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 92,
      align: "center",
      render: (type: MonitorRow["type"]) => <Tag color={type === "http" ? "blue" : "cyan"}>{type.toUpperCase()}</Tag>,
    },
    {
      title: "目标",
      dataIndex: "target",
      key: "target",
      align: "center",
      render: (target: string) => <Typography.Text className="mono">{target}</Typography.Text>,
    },
    {
      title: "生命周期",
      dataIndex: "lifecycle",
      key: "lifecycle",
      width: 122,
      align: "center",
      render: (value: MachineRow["lifecycle"]) => <Tag color={lifecycleColor[value]}>{lifecycleText[value]}</Tag>,
    },
  ];

  return (
    <div className="page-stack">
      <section className="stat-strip" aria-label="fleet summary">
        <StatCard label="服务器总数" value={summary.machines} hint={`${summary.activeCount} active`} tone="cyan" />
        <StatCard label="服务器探针" value={summary.serverProbeCount} hint="ssh tcp probes" tone="blue" />
        <StatCard label="服务入口" value={summary.serviceCount} hint="http services" tone="violet" />
        <StatCard label="项目数" value={summary.projectCount} hint="route based" tone="cyan" />
        <StatCard label="凭证缺口" value={summary.missingCredentials} hint="action required" tone="amber" />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          <TopologyCore rows={rows} probeCount={summary.probeCount} />

          <Panel
            title="服务器资产概览"
            icon={<MonitorOutlined />}
            extra={<Typography.Text className="panel-count">{rows.length} nodes</Typography.Text>}
          >
            <Table
              rowKey="id"
              size="middle"
              columns={machineColumns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 1080 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有资产" /> }}
            />
          </Panel>

          <Panel
            title="服务器探针"
            icon={<MonitorOutlined />}
            extra={<Typography.Text className="panel-count">{summary.serverProbeCount} probes</Typography.Text>}
          >
            <Table
              rowKey="id"
              size="middle"
              columns={monitorColumns}
              dataSource={serverProbes}
              pagination={false}
              scroll={{ x: 820 }}
            />
          </Panel>

          <Panel
            title="服务监控"
            icon={<ApiOutlined />}
            extra={<Typography.Text className="panel-count">{summary.serviceCount} services</Typography.Text>}
          >
            <Table
              rowKey="id"
              size="middle"
              columns={monitorColumns}
              dataSource={services}
              pagination={false}
              scroll={{ x: 820 }}
            />
          </Panel>
        </div>

        <aside className="dashboard-side">
          <Panel title="服务器管理" icon={<CloudServerOutlined />}>
            <div className="donut-card">
              <div className="donut">
                <strong>{rows.length}</strong>
                <span>nodes</span>
              </div>
              <div className="donut-legend">
                <span>
                  <i className="cyan" />
                  Active {summary.activeCount}
                </span>
                <span>
                  <i className="violet" />
                  Staging {summary.stagingCount}
                </span>
                <span>
                  <i className="amber" />
                  Credential {summary.missingCredentials}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="风险分析" icon={<WarningOutlined />}>
            <div className="risk-list">
              <div>
                <span>Aliyun SSH Key</span>
                <Tag color="warning">missing</Tag>
              </div>
              <div>
                <span>Netdata / OpenCloudOS</span>
                <Tag color="processing">tracked</Tag>
              </div>
              <div>
                <span>Public SSH</span>
                <Tag color="cyan">observed</Tag>
              </div>
            </div>
          </Panel>

          <Panel title="快捷操作" icon={<ToolOutlined />}>
            <div className="ops-grid">
              {["巡检", "变更", "隧道", "回收"].map((label) => (
                <Button key={label} type="primary" ghost>
                  {label}
                </Button>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}
