import { CopyOutlined, ProjectOutlined } from "@ant-design/icons";
import { Button, Progress, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useOutletContext } from "react-router-dom";
import { Panel, StatCard } from "../components/fleet-widgets";
import { copyText, lifecycleColor, lifecycleText } from "../lib/fleet-model";
import type { FleetModel, ProjectRow } from "../lib/fleet-types";

export function ProjectsPage() {
  const { projects, summary } = useOutletContext<FleetModel>();

  const projectColumns: ColumnsType<ProjectRow> = [
    {
      title: "项目",
      dataIndex: "name",
      key: "name",
      width: 220,
      align: "center",
      render: (name: string, row) => (
        <Space direction="vertical" size={2} className="table-cell-stack">
          <Typography.Text strong>{name}</Typography.Text>
          <Typography.Text className="subtext">{row.description}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "范围",
      dataIndex: "scope",
      key: "scope",
      width: 120,
      align: "center",
      render: (scope: string) => <Tag color="blue">{scope}</Tag>,
    },
    {
      title: "机器",
      key: "machines",
      width: 220,
      align: "center",
      render: (_, row) => (
        <Space size={[4, 4]} wrap className="table-cell-inline">
          {row.machine_names.map((machine) => (
            <Tag key={machine}>{machine}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "探针",
      dataIndex: "probe_count",
      key: "probe_count",
      width: 90,
      align: "center",
      render: (value: number) => <Tag color="cyan">{value}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "lifecycle",
      key: "lifecycle",
      width: 120,
      align: "center",
      render: (value: ProjectRow["lifecycle"]) => <Tag color={lifecycleColor[value]}>{lifecycleText[value]}</Tag>,
    },
    {
      title: "负责人",
      dataIndex: "owner",
      key: "owner",
      width: 120,
      align: "center",
    },
    {
      title: "标签",
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
      title: "操作",
      key: "actions",
      width: 96,
      align: "center",
      render: (_, row) => <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(row.machine_ids.join(", "))} />,
    },
  ];

  return (
    <div className="page-stack">
      <section className="stat-strip">
        <StatCard label="项目数" value={summary.projectCount} hint="route based" tone="cyan" />
        <StatCard label="活跃机器" value={summary.activeCount} hint="fleet wide" tone="blue" />
        <StatCard label="探针总数" value={summary.probeCount} hint="visibility" tone="violet" />
        <StatCard label="外网暴露" value={summary.publicCount} hint="public tag" tone="amber" />
      </section>

      <section className="project-grid">
        {projects.map((project) => (
          <Panel
            key={project.id}
            title={project.name}
            icon={<ProjectOutlined />}
            extra={<Tag color={lifecycleColor[project.lifecycle]}>{lifecycleText[project.lifecycle]}</Tag>}
          >
            <Space direction="vertical" size={10} className="project-card">
              <Typography.Text className="subtext">{project.description}</Typography.Text>
              <div className="project-progress">
                <div>
                  <span>机器</span>
                  <strong>{project.machine_ids.length}</strong>
                </div>
                <Progress
                  percent={Math.min(100, project.machine_ids.length * 30)}
                  showInfo={false}
                  strokeColor={project.lifecycle === "active" ? "#22d3ee" : "#f59e0b"}
                />
              </div>
              <div className="project-tags">
                {project.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </Space>
          </Panel>
        ))}
      </section>

      <Panel title="项目清单" icon={<ProjectOutlined />} extra={<Typography.Text className="panel-count">{projects.length} projects</Typography.Text>}>
        <Table
          rowKey="id"
          size="middle"
          columns={projectColumns}
          dataSource={projects}
          pagination={false}
          scroll={{ x: 1180 }}
          expandable={{
            expandedRowRender: (row) => (
              <div className="expand-row">
                <div>
                  <span>机器列表</span>
                  <strong>{row.machine_names.join(" · ")}</strong>
                </div>
                <div>
                  <span>职责</span>
                  <strong>{row.owner}</strong>
                </div>
                <div>
                  <span>探针</span>
                  <strong>{row.probe_count}</strong>
                </div>
              </div>
            ),
          }}
        />
      </Panel>
    </div>
  );
}
