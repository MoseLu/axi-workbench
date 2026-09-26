import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { AxiIconButton } from '@axi/core';
import { AxiRow } from '@axi/widgets';
import { useControlSnapshot } from '@axi/api-client';
import { useI18n } from '../../i18n';
import {
  getProjectCollaborationLinks,
  getProjectConsumerSummary,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
} from '../workspaceRegistry';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';
import './Team.css';

type CollaborationRow = {
  id: string;
  label: string;
  relationship: string;
};

/** 团队页只呈现已登记项目协作关系；成员目录尚未接入时不伪造成员列表。 */
const Team: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const rows = useMemo<CollaborationRow[]>(
    () => getProjectCollaborationLinks(projects).map((link) => ({
      id: getProjectResourceId(link.project),
      label: getProjectResourceLabel(link.project),
      relationship: getProjectConsumerSummary(link.consumers.length),
    })),
    [projects],
  );
  const columns: AxiTableColumn<CollaborationRow>[] = [
    { dataIndex: 'label', title: t('projects.column.label'), width: 320 },
    { dataIndex: 'relationship', title: t('team.column.relationship') },
    {
      align: 'right',
      key: 'action',
      render: (_, row) => (
        <AxiIconButton
          aria-label={t('team.viewProject')}
          label={t('team.viewProject')}
          size="small"
          variant="primary"
          onClick={() => navigate(`/admin/project/${encodeURIComponent(row.id)}`)}
        />
      ),
      title: t('projects.column.actionHeader'),
      width: 110,
    },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel={t('team.title')}
      className="team-crud"
      toolbar={(
        <AxiRow className="team-crud__toolbar" style={{ gap: 6 }}>
          <AxiIconButton
            aria-label={t('team.projectsLink')}
            label={t('team.projectsLink')}
            size="small"
            onClick={() => navigate('/admin/project')}
          />
          <AxiIconButton
            aria-label={t('team.refresh')}
            disabled={isFetching}
            label={isFetching ? t('team.refreshing') : t('team.refresh')}
            loading={isFetching}
            size="small"
            onClick={() => void refetch()}
          />
        </AxiRow>
      )}
    >
      {error ? (
        <ControlPlaneState
          description={t('team.error.description')}
          title={t('team.error.title')}
        />
      ) : isLoading ? (
        <ControlPlaneState description={t('team.loading.description')} loading title={t('team.loading.title')} />
      ) : (
        <AxiTableGroup
          description={rows.length > 0
            ? t('team.count', `${rows.length}`)
            : t('team.empty')}
          title={t('team.collaboration.title')}
        >
          <AxiTable
            columns={columns}
            data={rows}
            pagination={false}
            rowKey="id"
            onRow={(row) => ({
              onClick: () => navigate(`/admin/project/${encodeURIComponent(row.id)}`),
              style: { cursor: 'pointer' },
            })}
          />
        </AxiTableGroup>
      )}
    </DesktopCrudFrame>
  );
};

export default Team;