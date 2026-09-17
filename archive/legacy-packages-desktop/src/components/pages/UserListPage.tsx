import { Card, Table, Tag, Button, Space, Input, Select, Avatar } from 'antd'
import { PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import './UserListPage.css'

interface User {
  key: string
  id: number
  name: string
  username: string
  email: string
  role: string
  status: string
  createdAt: string
}

const userData: User[] = [
  { key: '1', id: 1, name: '张三', username: 'zhangsan', email: 'zhangsan@example.com', role: '管理员', status: 'active', createdAt: '2025-01-15' },
  { key: '2', id: 2, name: '李四', username: 'lisi', email: 'lisi@example.com', role: '开发者', status: 'active', createdAt: '2025-01-20' },
  { key: '3', id: 3, name: '王五', username: 'wangwu', email: 'wangwu@example.com', role: '测试', status: 'active', createdAt: '2025-02-01' },
  { key: '4', id: 4, name: '赵六', username: 'zhaoliu', email: 'zhaoliu@example.com', role: '开发者', status: 'inactive', createdAt: '2025-02-05' },
  { key: '5', id: 5, name: '孙七', username: 'sunqi', email: 'sunqi@example.com', role: '产品', status: 'active', createdAt: '2025-02-10' },
]

const columns = [
  {
    title: '用户',
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record: User) => (
      <Space>
        <Avatar size="small" icon={<UserOutlined />} />
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.username}</div>
        </div>
      </Space>
    ),
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: '角色',
    dataIndex: 'role',
    key: 'role',
    render: (role: string) => {
      const colorMap: Record<string, string> = {
        '管理员': 'red',
        '开发者': 'blue',
        '测试': 'green',
        '产品': 'purple',
      }
      return <Tag color={colorMap[role] || 'default'}>{role}</Tag>
    },
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
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
  },
  {
    title: '操作',
    key: 'action',
    width: 150,
    render: () => (
      <Space size={4}>
        <Button type="link" size="small">编辑</Button>
        <Button type="link" size="small" danger>删除</Button>
      </Space>
    ),
  },
]

export function UserListPage() {
  return (
    <div className="user-list-page">
      <Card size="small">
        <div className="user-list-page__toolbar">
          <Space size={8}>
            <Input placeholder="搜索用户..." prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />
            <Select placeholder="角色" style={{ width: 100 }} allowClear
              options={[
                { value: 'admin', label: '管理员' },
                { value: 'developer', label: '开发者' },
                { value: 'tester', label: '测试' },
                { value: 'product', label: '产品' },
              ]}
            />
            <Select placeholder="状态" style={{ width: 80 }} allowClear
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '禁用' },
              ]}
            />
          </Space>
          <Space size={8}>
            <Button type="primary" icon={<PlusOutlined />}>新增用户</Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={userData}
          rowKey="key"
          size="small"
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>
    </div>
  )
}
