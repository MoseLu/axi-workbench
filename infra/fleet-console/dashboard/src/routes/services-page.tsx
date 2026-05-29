import { ApiOutlined, CopyOutlined, GlobalOutlined } from "@ant-design/icons";
import { AxiTable, type AxiTableColumn } from "@axi/crud";
import { Button, Empty, Space, Tag, Typography } from "antd";
import { useOutletContext } from "react-router-dom";
import { Panel, StatCard } from "../components/fleet-widgets";
import { copyText, lifecycleColor, lifecycleText, providerText } from "../lib/fleet-model";
import type { FleetModel, Lifecycle, MonitorRow } from "../lib/fleet-types";

export function ServicesPage() {
  const { services, summary } = useOutletContext<FleetModel>();

  const serviceColumns: AxiTableColumn<MonitorRow>[] = [
    {
      title: "服务",
      dataIndex: "display_name",
      key: "display_name",
      width: 220,
      align: "center",
      render: (name: string, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Space size={8} wrap={false} className="table-cell-inline">
            <ApiOutlined className="row-icon" />
            <Typography.Text strong>{name}</Typography.Text>
          </Space>
          <Typography.Text className="mono subtext">{row.name}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "所属服务器",
      dataIndex: "machine_name",
      key: "machine_name",
      width: 190,
      align: "center",
      render: (machineName: string, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Typography.Text strong>{machineName}</Typography.Text>
          <Typography.Text className="mono subtext">{row.machine_id}</Typography.Text>
        </Space>
      ),
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
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 90,
      align: "center",
      render: () => <Tag color="blue">HTTP</Tag>,
    },
    {
      title: "目标地址",
      dataIndex: "target",
      key: "target",
      align: "center",
      render: (target: string) => <Typography.Text className="mono">{target}</Typography.Text>,
    },
    {
      title: "状态",
      dataIndex: "lifecycle",
      key: "lifecycle",
      width: 120,
      align: "center",
      render: (value: Lifecycle) => <Tag color={lifecycleColor[value]}>{lifecycleText[value]}</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      width: 96,
      align: "center",
      render: (_, row) => <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(row.target)} />,
    },
  ];

  return (
    <div className="page-stack">
      <section className="stat-strip">
        <StatCard label="服务总数" value={summary.serviceCount} hint="http targets" tone="cyan" />
        <StatCard label="活跃服务" value={services.filter((service) => service.lifecycle === "active").length} hint="reachable targets" tone="blue" />
        <StatCard label="所属服务器" value={new Set(services.map((service) => service.machine_id)).size} hint="service hosts" tone="violet" />
      </section>

      <Panel title="服务清单" icon={<GlobalOutlined />} extra={<Typography.Text className="panel-count">{services.length} services</Typography.Text>}>
        <AxiTable
          rowKey="id"
          size="middle"
          columns={serviceColumns}
          dataSource={services}
          pagination={false}
          scroll={{ x: 1040 }}
          toolbar={{
            storageKey: "fleet-console-services-table",
            visible: true,
          }}
          labels={{
            bordered: "显示边框",
            columns: "显示列",
            density: "表格密度",
            large: "宽松",
            middle: "默认",
            small: "紧凑",
            striped: "斑马纹",
            style: "表格样式",
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有服务目标" /> }}
        />
      </Panel>
    </div>
  );
}
