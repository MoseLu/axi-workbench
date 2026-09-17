import { Card, Table, Tag, Button, Space, Input, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import './RoleListPage.css'

interface Role {
  key: string
  id: number
  name: string
  code: string
  status: string
  userCount: number
  description: string
  createdAt: string
}

const roleData: Role[] = [
  { key: '1', id: 1, name: '超级管理员', code: 'admin', status: 'active', userCount: 1, description: '拥有系统所有权限', createdAt: '2025-01-01' },
  { key: '2', id: 2, name: '开发者', code: 'developer', status: 'active', userCount: 5, description: '开发权限', createdAt: '2025-01-10' },
  { key: '3', id: 3, name: '测试', code: 'tester', status: 'active', userCount: 3, description: '测试权限', createdAt: '2025-01-15' },
  { key: '4', id: 4, name: '产品经理', code: 'product', status: 'active', userCount: 2, description: '产品权限', createdAt: '2025-01-20' },
  { key: '5', id: 5, name: '访客', code: 'guest', status: 'inactive', userCount: 0, description: '只读权限', createdAt: '2025-02-01' },
]

const columns = [
  {
    title: '角色名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '角色编码',
    dataIndex: 'code',
    key: 'code',
    render: (code: string) => <code style={{ fontSize: 12 }}>{code}</code>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={status === 'active' ? 'success' : 'default'}>
        {status === 'active' ? '启用' : '禁用'}
      </Tag>
    ),
  },
  {
    title: '用户数',
    dataIndex: 'userCount',
    key: 'userCount',
    align: 'center' as const,
    width: 80,
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 120,
  },
  {
    title: '操作',
    key: 'action',
    width: 150,
    render: () => (
      <Space size={4}>
        <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
        <Popconfirm title="确定删除此角色?">
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    ),
  },
]

export function RoleListPage() {
  return (
    <div className="role-list-page">
      <Card size="small">
        <div className="role-list-page__toolbar">
          <Space size={8}>
            <Input placeholder="搜索角色..." prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />
          </Space>
          <Space size={8}>
            <Button type="primary" icon={<PlusOutlined />}>新增角色</Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={roleData}
          rowKey="key"
          size="small"
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>
    </div>
  )
}
