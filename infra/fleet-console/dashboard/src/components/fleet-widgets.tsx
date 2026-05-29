import { CloudServerOutlined, ClusterOutlined } from "@ant-design/icons";
import { Badge, Progress, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import type { MachineRow } from "../lib/fleet-types";
import { lifecycleColor, lifecycleText, providerText } from "../lib/fleet-model";

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "cyan" | "violet" | "blue" | "amber";
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-corner" />
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint}</em>
    </div>
  );
}

export function Panel({
  title,
  icon,
  extra,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`cyber-panel ${className}`}>
      <div className="panel-title">
        <Space size={8}>
          <span className="panel-signal" />
          {icon}
          <Typography.Title level={4}>{title}</Typography.Title>
        </Space>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function TopologyCore({ rows, probeCount }: { rows: MachineRow[]; probeCount: number }) {
  return (
    <Panel
      title="节点拓扑"
      icon={<ClusterOutlined />}
      extra={<Tag color="cyan">{probeCount} probes</Tag>}
      className="topology-panel"
    >
      <div className="admin-topology">
        {rows.map((row) => (
          <div className="admin-node-card" key={row.id}>
            <div className="admin-node-head">
              <Space size={8}>
                <CloudServerOutlined />
                <Typography.Text strong>{row.display_name}</Typography.Text>
              </Space>
              <Badge status={lifecycleColor[row.lifecycle] as never} text={lifecycleText[row.lifecycle]} />
            </div>
            <div className="admin-node-meta">
              <span>{providerText[row.provider] ?? row.provider}</span>
              <span>{row.role}</span>
              <span>{row.live_probe_count} probes</span>
            </div>
            <Progress
              percent={row.live_probe_count > 0 ? 100 : 0}
              showInfo={false}
              strokeColor={row.lifecycle === "staging" ? "#faad14" : "#1677ff"}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
