import React from 'react';
import { Alert, Button } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useControlSnapshot } from '@epap/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import './RoleList.css';

type AuthorityFact = {
  key: string;
  source: string;
  status: string;
};

const RoleList: React.FC = () => {
  const { user } = useAuth();
  const { error, isFetching, refetch } = useControlSnapshot();
  const facts: AuthorityFact[] = [
    { key: 'session', source: '当前会话', status: user ? '已通过身份登录验证' : '尚未取得会话' },
    { key: 'approval', source: '命令审批', status: '由控制面审批快照提供' },
    { key: 'project', source: '项目命令', status: '仅由控制面调度，不在本页直接执行' },
  ];
  const columns: AxiTableColumn<AuthorityFact>[] = [
    { align: 'left', dataIndex: 'source', title: '权限来源', width: 180 },
    { align: 'left', dataIndex: 'status', title: '当前状态' },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="角色权限"
      className="authority-status"
      toolbar={<Button disabled={isFetching} size="small" onClick={() => void refetch()}>{isFetching ? '同步中…' : '刷新'}</Button>}
      top={<span className="wb-crud-page__context">角色权限</span>}
    >
      {error ? <Alert className="authority-status__alert" message="权限状态暂时无法同步。" showIcon type="warning" /> : null}
      <AxiTableGroup
        description="成员、角色和权限策略尚未接入权威身份源，页面不会显示样例角色。"
        title="权限事实源"
      >
        <AxiTable columns={columns} data={facts} pagination={false} rowKey="key" />
      </AxiTableGroup>
    </DesktopCrudFrame>
  );
};

export default RoleList;
