import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import { useI18n } from '../i18n';
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
  const { locale, t } = useI18n();
  const projectId = decodeURIComponent(id || '');
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const project = projects.find((item) => getProjectResourceId(item) === projectId);

  return (
    <DesktopCrudFrame
      ariaLabel={t('projectDetail.title')}
      className="project-detail-crud"
      toolbar={(
        <Space size={6}>
          <Button size="small" onClick={() => navigate('/admin/project')}>{t('projectDetail.back')}</Button>
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>{isFetching ? t('projectDetail.refreshing') : t('projectDetail.refresh')}</Button>
        </Space>
      )}
    >
      {error ? (
        <ControlPlaneState
          description={t('projectDetail.error.description')}
          title={t('projectDetail.error.title')}
        />
      ) : isLoading ? (
        <ControlPlaneState description={t('projectDetail.loading.description')} loading title={t('projectDetail.loading.title')} />
      ) : !project ? (
        <AxiTableGroup description={t('projectDetail.notFound.description')} title={t('projectDetail.notFound.title')}>
          <Empty description={t('projectDetail.notFound.empty')} />
        </AxiTableGroup>
      ) : (
        <ProjectDetailContent locale={locale} project={project} projects={projects} snapshot={snapshot} />
      )}
    </DesktopCrudFrame>
  );
};

const ProjectDetailContent: React.FC<{
  locale: string;
  project: ProjectResource;
  projects: ProjectResource[];
  snapshot: ReturnType<typeof useControlSnapshot>['data'];
}> = ({ locale, project, projects, snapshot }) => {
  const { t } = useI18n();
  const projectId = getProjectResourceId(project);
  const git = getProjectGitStatus(project);
  const labelById = useMemo(
    () => new Map(projects.map((item) => [getProjectResourceId(item), getProjectResourceLabel(item)])),
    [projects],
  );
  const availableState = t('projects.state.available');
  const unknownState = t('projects.state.unknown');
  const unregisteredBranch = t('projects.branch.unregistered');
  const workspaceChanges = t('projects.workspace.changes');
  const workspacePending = t('projects.workspace.pending');
  const workspaceClean = t('projects.workspace.clean');
  const relationships = useMemo<RelationshipRow[]>(
    () => [
      ...project.consumes.map((value) => ({ direction: t('projectDetail.relationship.consume'), key: `consume:${value}`, label: labelById.get(value) || value })),
      ...getProjectConsumers(project).map((value) => ({ direction: t('projectDetail.relationship.consumer'), key: `consumer:${value}`, label: labelById.get(value) || value })),
      ...project.contracts.map((value) => ({ direction: t('projectDetail.relationship.contract'), key: `contract:${value}`, label: value })),
    ],
    [labelById, project, t],
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
        summary: task.summary || task.prompt || t('operations.attention.fallbackSummary'),
      })),
    [projectId, snapshot?.agentTasks, t],
  );
  const relationshipColumns: AxiTableColumn<RelationshipRow>[] = [
    { dataIndex: 'direction', title: t('projectDetail.column.relationship'), width: 130 },
    { dataIndex: 'label', title: t('projectDetail.column.peer') },
  ];
  const capabilityColumns: AxiTableColumn<CapabilityRow>[] = [{ dataIndex: 'label', title: t('projectDetail.column.capability') }];
  const taskColumns: AxiTableColumn<TaskRow>[] = [
    { dataIndex: 'summary', title: t('workspace.column.task') },
    { dataIndex: 'status', title: t('operations.column.status'), width: 110 },
    { dataIndex: 'runtime', title: t('workspace.column.runtime'), width: 150 },
    { dataIndex: 'createdAt', render: (value) => formatTime(value, locale, t('workspace.time.unknown')), title: t('workspace.column.createdAt'), width: 150 },
  ];
  const workspaceState = git.changedEntries > 0
    ? workspaceChanges.replace('{value}', `${git.changedEntries}`)
    : git.clean === false
      ? workspacePending
      : workspaceClean;
  const commandsCount = `${project.commands.length}${t('projectDetail.commandsUnit')}`;

  return (
    <>
      <AxiTableGroup description={getProjectResourceSummary(project)} title={getProjectResourceLabel(project)}>
        <Descriptions column={2} colon={false} size="small">
          <Descriptions.Item label={t('projectDetail.descriptions.state')}>{project.status === 'available' ? availableState : project.status || unknownState}</Descriptions.Item>
          <Descriptions.Item label={t('projectDetail.descriptions.workspace')}>{workspaceState}</Descriptions.Item>
          <Descriptions.Item label={t('projectDetail.descriptions.branch')}>{git.branch || unregisteredBranch}</Descriptions.Item>
          <Descriptions.Item label={t('projectDetail.descriptions.commands')}>{commandsCount}</Descriptions.Item>
        </Descriptions>
      </AxiTableGroup>

      <div className="project-detail-crud__grid">
        <AxiTableGroup
          description={relationships.length ? `${relationships.length}${t('projectDetail.relationships.count')}` : t('projectDetail.relationships.empty')}
          title={t('projectDetail.relationships.title')}
        >
          <AxiTable columns={relationshipColumns} data={relationships} pagination={false} rowKey="key" />
        </AxiTableGroup>
        <AxiTableGroup
          description={capabilities.length ? `${capabilities.length}${t('projectDetail.capabilities.count')}` : t('projectDetail.capabilities.empty')}
          title={t('projectDetail.capabilities.title')}
        >
          <AxiTable columns={capabilityColumns} data={capabilities} pagination={false} rowKey="key" />
        </AxiTableGroup>
      </div>

      <AxiTableGroup
        description={tasks.length ? `${tasks.length}${t('projectDetail.tasks.count')}` : t('projectDetail.tasks.empty')}
        title={t('projectDetail.tasks.title')}
      >
        <AxiTable columns={taskColumns} data={tasks} pagination={false} rowKey="id" />
      </AxiTableGroup>
    </>
  );
};

function formatTime(value: Date | string | undefined, locale: string, unknownText: string): string {
  if (!value) return unknownText;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return unknownText;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}

export default ProjectDetail;
