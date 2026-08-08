import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import {
  getProjectConsumers,
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResourceSummary,
  getProjectResources,
  type ProjectResource,
} from './workspaceRegistry';
import { ControlPlaneState } from './admin/ControlPlaneState';
import { DesktopCrudFrame } from './admin/DesktopCrudFrame';
import './ProjectDetail.css';

type RelationshipRow = {
  direction: string;
  key: string;
  label: string;
};

type CapabilityRow = {
  key: string;
  label: string;
};

type TaskRow = {
  createdAt?: Date | string;
  id: string;
  runtime: string;
  status: string;
  summary: string;
};

/** 项目详情保留事实和关联数据，移除移动端 Hero、状态卡和裸露资源路径。 */
const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = decodeURIComponent(id || '');
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const project = projects.find((item) => getProjectResourceId(item) === projectId);

  return (
    <DesktopCrudFrame
      ariaLabel="项目详情"
      className="project-detail-crud"
      toolbar={(
        <Space size={6}>
          <Button size="small" onClick={() => navigate('/admin/project')}>返回项目</Button>
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>{isFetching ? '同步中…' : '刷新状态'}</Button>
        </Space>
      )}
    >
      {error ? (
        <ControlPlaneState
          description="当前无法连接控制面；项目详情会在连接恢复后显示。"
          title="项目详情暂不可用"
        />
      ) : isLoading ? (
        <ControlPlaneState description="正在从控制面读取项目详情。" loading title="正在同步项目详情" />
      ) : !project ? (
        <AxiTableGroup description="该项目未出现在最新控制面快照中。" title="未找到项目">
          <Empty description="没有可呈现的项目数据" />
        </AxiTableGroup>
      ) : (
        <ProjectDetailContent project={project} projects={projects} snapshot={snapshot} />
      )}
    </DesktopCrudFrame>
  );
};

const ProjectDetailContent: React.FC<{
  project: ProjectResource;
  projects: ProjectResource[];
  snapshot: ReturnType<typeof useControlSnapshot>['data'];
}> = ({ project, projects, snapshot }) => {
  const projectId = getProjectResourceId(project);
  const git = getProjectGitStatus(project);
  const labelById = useMemo(
    () => new Map(projects.map((item) => [getProjectResourceId(item), getProjectResourceLabel(item)])),
    [projects],
  );
  const relationships = useMemo<RelationshipRow[]>(
    () => [
      ...project.consumes.map((value) => ({ direction: '依赖项目', key: `consume:${value}`, label: labelById.get(value) || value })),
      ...getProjectConsumers(project).map((value) => ({ direction: '消费项目', key: `consumer:${value}`, label: labelById.get(value) || value })),
      ...project.contracts.map((value) => ({ direction: '关联契约', key: `contract:${value}`, label: value })),
    ],
    [labelById, project],
  );
  const capabilities = useMemo<CapabilityRow[]>(
    () => project.provides.map((value) => ({ key: value, label: value })),
    [project.provides],
  );
  const tasks = useMemo<TaskRow[]>(
    () => (snapshot?.agentTasks ?? [])
      .filter((task) => task.targetId === projectId)
      .map((task) => ({
        createdAt: task.createdAt,
        id: task.id,
        runtime: task.runtime,
        status: task.status,
        summary: task.summary || task.prompt || '受管任务（暂无摘要）',
      })),
    [projectId, snapshot?.agentTasks],
  );
  const relationshipColumns: AxiTableColumn<RelationshipRow>[] = [
    { dataIndex: 'direction', title: '关系', width: 130 },
    { dataIndex: 'label', title: '项目或契约' },
  ];
  const capabilityColumns: AxiTableColumn<CapabilityRow>[] = [{ dataIndex: 'label', title: '已提供能力' }];
  const taskColumns: AxiTableColumn<TaskRow>[] = [
    { dataIndex: 'summary', title: '任务' },
    { dataIndex: 'status', title: '状态', width: 110 },
    { dataIndex: 'runtime', title: '运行环境', width: 150 },
    { dataIndex: 'createdAt', render: (value) => formatTime(value), title: '创建时间', width: 150 },
  ];
  const workspaceState = git.changedEntries > 0
    ? `有 ${git.changedEntries} 项改动`
    : git.clean === false
      ? '待检查'
      : '正常';

  return (
    <>
      <AxiTableGroup description={getProjectResourceSummary(project)} title={getProjectResourceLabel(project)}>
        <Descriptions column={2} colon={false} size="small">
          <Descriptions.Item label="项目状态">{project.status === 'available' ? '可用' : project.status || '待校验'}</Descriptions.Item>
          <Descriptions.Item label="工作区状态">{workspaceState}</Descriptions.Item>
          <Descriptions.Item label="当前分支">{git.branch || '未登记'}</Descriptions.Item>
          <Descriptions.Item label="受管命令">{project.commands.length} 项</Descriptions.Item>
        </Descriptions>
      </AxiTableGroup>

      <div className="project-detail-crud__grid">
        <AxiTableGroup description={relationships.length ? `共 ${relationships.length} 条已登记关系` : '暂无已登记关系'} title="依赖与协作">
          <AxiTable columns={relationshipColumns} data={relationships} pagination={false} rowKey="key" />
        </AxiTableGroup>
        <AxiTableGroup description={capabilities.length ? `共 ${capabilities.length} 项已提供能力` : '暂无已登记能力'} title="已提供能力">
          <AxiTable columns={capabilityColumns} data={capabilities} pagination={false} rowKey="key" />
        </AxiTableGroup>
      </div>

      <AxiTableGroup description={tasks.length ? `共 ${tasks.length} 项关联任务` : '当前没有关联任务'} title="关联任务">
        <AxiTable columns={taskColumns} data={tasks} pagination={false} rowKey="id" />
      </AxiTableGroup>
    </>
  );
};

function formatTime(value: Date | string | undefined): string {
  if (!value) return '时间未知';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}

export default ProjectDetail;
