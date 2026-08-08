import React, { useMemo } from 'react';
import { Alert, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import {
  getProjectCollaborationLinks,
  getProjectConsumerSummary,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
} from '../workspaceRegistry';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import './Team.css';

type CollaborationRow = {
  id: string;
  label: string;
  relationship: string;
};

/** 团队页只呈现已登记项目协作关系；成员目录尚未接入时不伪造成员列表。 */
const Team: React.FC = () => {
  const navigate = useNavigate();
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
  const errorMessage = '控制面暂时不可用，请稍后刷新。';
  const columns: AxiTableColumn<CollaborationRow>[] = [
    { dataIndex: 'label', title: '项目', width: 320 },
    { dataIndex: 'relationship', title: '协作关系' },
    {
      align: 'right',
      key: 'action',
      render: (_, row) => <Button size="small" type="link" onClick={() => navigate(`/admin/project/${encodeURIComponent(row.id)}`)}>查看项目</Button>,
      title: '操作',
      width: 110,
    },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="团队"
      className="team-crud"
      toolbar={(
        <Space size={6}>
          <Button size="small" onClick={() => navigate('/admin/project')}>项目目录</Button>
          <Button disabled={isFetching} size="small" onClick={() => void refetch()}>{isFetching ? '同步中…' : '刷新状态'}</Button>
        </Space>
      )}
    >
      {error ? <Alert message={errorMessage} showIcon type="warning" /> : null}
      <AxiTableGroup
        description={isLoading
          ? '正在同步控制面快照…'
          : rows.length > 0
            ? `已登记 ${rows.length} 个项目协作关系`
            : '成员目录尚未接入控制面，当前没有可呈现的协作关系。'}
        title="项目协作"
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
    </DesktopCrudFrame>
  );
};

export default Team;
