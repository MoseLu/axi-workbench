import React from 'react';
import { Card, Table, Tag, Space, Button } from 'antd';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';

const RoleList: React.FC = () => {
  const dataSource = [
    { key: '1', name: '管理员', code: 'admin', users: 1, permissions: 32, status: true },
    { key: '2', name: '编辑', code: 'editor', users: 2, permissions: 18, status: true },
    { key: '3', name: '访客', code: 'guest', users: 5, permissions: 4, status: true },
  ];

  const columns = [
    { title: '角色名', dataIndex: 'name', key: 'name' },
    { title: '代码', dataIndex: 'code', key: 'code', render: (code: string) => <Tag>{code}</Tag> },
    { title: '用户数', dataIndex: 'users', key: 'users' },
    { title: '权限数', dataIndex: 'permissions', key: 'permissions' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: boolean) => <Tag color={status ? 'green' : 'default'}>{status ? '启用' : '禁用'}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="角色列表"
        extra={<Button type="primary" icon={<WorkbenchIcon name="add" />} size="small">新增角色</Button>}
      >
        <Table dataSource={dataSource} columns={columns} pagination={{ pageSize: 10 }} size="middle" />
      </Card>
    </div>
  );
};

export default RoleList;
