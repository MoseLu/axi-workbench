import {
  CloudServerOutlined,
  CopyOutlined,
  LinkOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Badge, Button, Empty, Input, Segmented, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Panel } from "../components/fleet-widgets";
import { copyText, credentialStatusIsReady, credentialStatusText, lifecycleColor, lifecycleText, providerText } from "../lib/fleet-model";
import type { FleetModel, Lifecycle, MachineRow, MonitorRow } from "../lib/fleet-types";

const lifecycleOptions: Array<Lifecycle | "all"> = ["all", "active", "staging", "maintenance"];

export function DevicesPage() {
  const { rows, serverProbes } = useOutletContext<FleetModel>();
  const [filter, setFilter] = useState<Lifecycle | "all">("all");
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesLifecycle = filter === "all" || row.lifecycle === filter;
      const searchable = [row.display_name, row.id, row.provider, row.role, row.public_ip, row.tailscale_name, ...row.tags]
        .join(" ")
        .toLowerCase();
      return matchesLifecycle && searchable.includes(normalized);
    });
  }, [filter, query, rows]);

  const machineColumns: ColumnsType<MachineRow> = [
    {
      title: "服务器",
      dataIndex: "display_name",
      key: "display_name",
      width: 245,
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
      width: 125,
      align: "center",
      render: (value: Lifecycle) => <Badge status={lifecycleColor[value] as never} text={lifecycleText[value]} />,
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
      width: 120,
      align: "center",
      render: (_, row) => (
        <Space size={4} className="table-cell-inline">
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(`ssh -F generated/ssh_config fleet-${row.id}`)} />
          <Button size="small" icon={<LinkOutlined />} onClick={() => copyText(`cockpit ${row.id}:9090`)} />
        </Space>
      ),
    },
  ];

  const probeColumns: ColumnsType<MonitorRow> = [
    {
      title: "探针",
      dataIndex: "display_name",
      key: "display_name",
      width: 210,
      align: "center",
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: "服务器",
      dataIndex: "machine_name",
      key: "machine_name",
      width: 190,
      align: "center",
      render: (machineName: string, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Typography.Text>{machineName}</Typography.Text>
          <Typography.Text className="mono subtext">{row.machine_id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 92,
      align: "center",
      render: () => <Tag color="cyan">TCP</Tag>,
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
      render: (value: Lifecycle) => <Tag color={lifecycleColor[value]}>{lifecycleText[value]}</Tag>,
    },
  ];

  return (
    <div className="page-stack">
      <Panel
        title="服务器资产"
        icon={<CloudServerOutlined />}
        extra={<Typography.Text className="panel-count">{filteredRows.length} / {rows.length}</Typography.Text>}
      >
        <div className="toolbar">
          <Segmented
            value={filter}
            onChange={(value) => setFilter(value as Lifecycle | "all")}
            options={lifecycleOptions.map((value) => ({
              label:
                value === "all"
                  ? "全部"
                  : value === "active"
                    ? "Active"
                    : value === "staging"
                      ? "Staging"
                      : "维护",
              value,
            }))}
          />
          <Input
            allowClear
            className="search"
            prefix={<SearchOutlined />}
            placeholder="搜索服务器中文名、云厂商、标签、IP"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <Table
          rowKey="id"
          size="middle"
          columns={machineColumns}
          dataSource={filteredRows}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1120 }}
          expandable={{
            expandedRowRender: (row) => (
              <div className="expand-row">
                <div>
                  <span>SSH</span>
                  <strong>{row.ssh_user}</strong>
                </div>
                <div>
                  <span>Tailscale</span>
                  <strong>{row.tailscale_name || "-"}</strong>
                </div>
                <div>
                  <span>探针数</span>
                  <strong>{row.live_probe_count}</strong>
                </div>
              </div>
            ),
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配服务器" /> }}
        />
      </Panel>

      <Panel title="服务器探针" icon={<SafetyCertificateOutlined />} extra={<Typography.Text className="panel-count">{serverProbes.length} probes</Typography.Text>}>
        <Table
          rowKey="id"
          size="middle"
          columns={probeColumns}
          dataSource={serverProbes}
          pagination={false}
          scroll={{ x: 820 }}
        />
      </Panel>
    </div>
  );
}
