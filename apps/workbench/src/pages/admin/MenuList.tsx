import React from 'react';
import { Card, Table, Tag, Space, Button, Switch } from 'antd';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';

const MenuList: React.FC = () => {
  const dataSource = [
    { key: '1', name: '仪表盘', path: '/admin/dashboard', icon: 'DashboardOutlined', type: 'menu', order: 1, status: true },
    { key: '2', name: '项目管理', path: '/admin/project', icon: 'ProjectOutlined', type: 'menu', order: 2, status: true },
    { key: '3', name: '任务管理', path: '/admin/task', icon: 'FileTextOutlined', type: 'menu', order: 3, status: true },
    { key: '4', name: '团队管理', path: '/admin/team', icon: 'TeamOutlined', type: 'menu', order: 4, status: true },
    { key: '5', name: '菜单列表', path: '/admin/settings/menu', icon: 'MenuOutlined', type: 'submenu', order: 1, status: true },
    { key: '6', name: '用户列表', path: '/admin/settings/user', icon: 'UserOutlined', type: 'submenu', order: 2, status: false },
    { key: '7', name: '角色列表', path: '/admin/settings/role', icon: 'UnorderedListOutlined', type: 'submenu', order: 3, status: true },
  ];

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'path', key: 'path' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color={type === 'menu' ? 'blue' : 'purple'}>{type === 'menu' ? '菜单' : '子菜单'}</Tag>,
    },
    { title: '排序', dataIndex: 'order', key: 'order', sorter: (a: any, b: any) => a.order - b.order },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: boolean) => <Switch defaultChecked={status} size="small" />,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="菜单列表"
        extra={
          <Space>
            <Button type="primary" icon={<WorkbenchIcon name="add" />} size="small">新增菜单</Button>
          </Space>
        }
      >
        <Table dataSource={dataSource} columns={columns} pagination={{ pageSize: 10 }} size="middle" />
      </Card>
    </div>
  );
};

export default MenuList;
