import { CopyOutlined, DatabaseOutlined, KeyOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Panel, StatCard } from "../components/fleet-widgets";
import { copyText, credentialStatusIsReady, credentialStatusText, lifecycleColor, lifecycleText, providerText } from "../lib/fleet-model";
import type { CredentialReference, CredentialRow, FleetModel, Lifecycle } from "../lib/fleet-types";

function credentialText(status: string) {
  return credentialStatusText[status] ?? status;
}

function riskColor(risk?: string) {
  if (risk === "critical") return "red";
  if (risk === "high") return "orange";
  if (risk === "medium") return "gold";
  return "default";
}

function typeText(type: CredentialReference["type"]) {
  return type === "server" ? "服务器" : "凭据";
}

function storageKindText(kind: CredentialRow["storage_kind"]) {
  if (kind === "secret_ref") return "Bitwarden";
  if (kind === "path") return "本地路径";
  return "未配置";
}

export function CredentialsPage() {
  const { credentialRefs, credentialVault, credentials, summary } = useOutletContext<FleetModel>();
  const [query, setQuery] = useState("");

  const filteredCredentialRefs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return credentialRefs;

    return credentialRefs.filter((row) =>
      [
        row.title,
        row.type,
        row.service,
        row.environment,
        row.secret_ref,
        row.source_location,
        row.path,
        row.risk,
        row.migration_status,
        ...(row.aliases ?? []),
        ...(row.related ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [credentialRefs, query]);

  const systemColumns: ColumnsType<CredentialReference> = [
    {
      title: "名称",
      dataIndex: "title",
      key: "title",
      width: 240,
      align: "center",
      render: (title: string, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Space size={8} wrap={false} className="table-cell-inline">
            {row.type === "server" ? <SafetyCertificateOutlined className="row-icon" /> : <KeyOutlined className="row-icon" />}
            <Typography.Text strong>{title}</Typography.Text>
          </Space>
          <Typography.Text className="mono subtext">{row.path}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 110,
      align: "center",
      render: (type: CredentialReference["type"]) => <Tag color={type === "server" ? "cyan" : "blue"}>{typeText(type)}</Tag>,
    },
    {
      title: "服务",
      key: "service",
      width: 185,
      align: "center",
      render: (_, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Typography.Text>{row.service ?? "-"}</Typography.Text>
          <Typography.Text className="mono subtext">{row.environment ?? "-"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "风险",
      dataIndex: "risk",
      key: "risk",
      width: 110,
      align: "center",
      render: (risk: string | undefined) => <Tag color={riskColor(risk)}>{risk ?? "unknown"}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "migration_status",
      key: "migration_status",
      width: 125,
      align: "center",
      render: (status: string | undefined) => <Tag color={credentialStatusIsReady(status) ? "success" : "warning"}>{status ?? "unknown"}</Tag>,
    },
    {
      title: "Secret Ref",
      dataIndex: "secret_ref",
      key: "secret_ref",
      align: "center",
      render: (secretRef: string | undefined) =>
        secretRef ? <Typography.Text className="mono credential-path">{secretRef}</Typography.Text> : <Tag color="warning">missing</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      width: 96,
      align: "center",
      render: (_, row) => <Button size="small" icon={<CopyOutlined />} disabled={!row.secret_ref} onClick={() => row.secret_ref && copyText(row.secret_ref)} />,
    },
  ];

  const machineColumns: ColumnsType<CredentialRow> = [
    {
      title: "服务器",
      dataIndex: "machine_name",
      key: "machine_name",
      width: 220,
      align: "center",
      render: (name: string, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Space size={8} wrap={false} className="table-cell-inline">
            <SafetyCertificateOutlined className="row-icon" />
            <Typography.Text strong>{name}</Typography.Text>
          </Space>
          <Typography.Text className="mono subtext">{row.machine_id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "云厂商",
      dataIndex: "provider",
      key: "provider",
      width: 130,
      align: "center",
      render: (provider: string) => <Tag>{providerText[provider] ?? provider}</Tag>,
    },
    {
      title: "SSH 用户",
      dataIndex: "ssh_user",
      key: "ssh_user",
      width: 120,
      align: "center",
      render: (sshUser: string) => <Typography.Text className="mono">{sshUser}</Typography.Text>,
    },
    {
      title: "凭证状态",
      dataIndex: "credential_status",
      key: "credential_status",
      width: 140,
      align: "center",
      render: (status: string) => <Tag color={credentialStatusIsReady(status) ? "success" : "warning"}>{credentialText(status)}</Tag>,
    },
    {
      title: "生命周期",
      dataIndex: "lifecycle",
      key: "lifecycle",
      width: 120,
      align: "center",
      render: (value: Lifecycle) => <Tag color={lifecycleColor[value]}>{lifecycleText[value]}</Tag>,
    },
    {
      title: "存储",
      dataIndex: "storage_kind",
      key: "storage_kind",
      width: 115,
      align: "center",
      render: (kind: CredentialRow["storage_kind"]) => <Tag color={kind === "missing" ? "warning" : "processing"}>{storageKindText(kind)}</Tag>,
    },
    {
      title: "引用 / 路径",
      dataIndex: "storage_path",
      key: "storage_path",
      align: "center",
      render: (path: string | null) =>
        path ? <Typography.Text className="mono credential-path">{path}</Typography.Text> : <Tag color="warning">未配置</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      width: 96,
      align: "center",
      render: (_, row) => (
        <Button size="small" icon={<CopyOutlined />} disabled={!row.storage_path} onClick={() => row.storage_path && copyText(row.storage_path)} />
      ),
    },
  ];

  return (
    <div className="page-stack">
      <section className="stat-strip">
        <StatCard label="凭据条目" value={summary.credentialRefCount} hint="metadata refs" tone="cyan" />
        <StatCard label="Critical" value={summary.criticalCredentialRefs} hint="high impact" tone="amber" />
        <StatCard label="服务器绑定" value={credentials.length} hint="machine refs" tone="blue" />
        <StatCard label="待补充" value={summary.missingCredentials} hint="missing refs" tone="amber" />
        <StatCard label="Vault" value={credentialVault?.loaded ? "OK" : "MISS"} hint="knowledge base" tone={credentialVault?.loaded ? "violet" : "amber"} />
      </section>

      <Panel
        title="凭据系统"
        icon={<DatabaseOutlined />}
        extra={
          <Input
            className="search"
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索凭据、服务、引用"
          />
        }
      >
        <Table
          rowKey="path"
          size="middle"
          columns={systemColumns}
          dataSource={filteredCredentialRefs}
          pagination={false}
          scroll={{ x: 1280 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有凭据元数据" /> }}
        />
      </Panel>

      <Panel title="服务器凭据绑定" icon={<KeyOutlined />} extra={<Typography.Text className="panel-count">{credentials.length} machines</Typography.Text>}>
        <Table
          rowKey="machine_id"
          size="middle"
          columns={machineColumns}
          dataSource={credentials}
          pagination={false}
          scroll={{ x: 1180 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有服务器凭据记录" /> }}
        />
      </Panel>
    </div>
  );
}
