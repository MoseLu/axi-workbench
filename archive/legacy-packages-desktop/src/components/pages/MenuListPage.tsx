import { Card, Table, Tag, Button, Space, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import './MenuListPage.css'

const { Text } = Typography

interface MenuItem {
  key: string
  name: string
  sort: number
  type: 'menu' | 'directory'
  icon: string
  path: string
  children?: MenuItem[]
}

const menuData: MenuItem[] = [
  { key: '1', name: '首页', sort: 0, type: 'menu', icon: 'DashboardOutlined', path: '/admin/dashboard' },
  { key: '2', name: '系统管理', sort: 1, type: 'directory', icon: 'SettingOutlined', path: '/admin/settings', children: [
    { key: '2-1', name: '用户列表', sort: 0, type: 'menu', icon: 'UserOutlined', path: '/admin/settings/user' },
    { key: '2-2', name: '菜单列表', sort: 1, type: 'menu', icon: 'MenuOutlined', path: '/admin/settings/menu' },
    { key: '2-3', name: '角色列表', sort: 2, type: 'menu', icon: 'UnorderedListOutlined', path: '/admin/settings/role' },
  ]},
  { key: '3', name: '任务管理', sort: 2, type: 'menu', icon: 'FileTextOutlined', path: '/admin/task' },
  { key: '4', name: '项目管理', sort: 3, type: 'menu', icon: 'ProjectOutlined', path: '/admin/project' },
  { key: '5', name: '团队管理', sort: 4, type: 'menu', icon: 'TeamOutlined', path: '/admin/team' },
  { key: '6', name: 'AI 聊天', sort: 5, type: 'menu', icon: 'MessageOutlined', path: '/chat' },
  { key: '7', name: '代码编辑器', sort: 6, type: 'menu', icon: 'CodeOutlined', path: '/editor' },
  { key: '8', name: '终端', sort: 7, type: 'menu', icon: 'TerminalOutlined', path: '/terminal' },
  { key: '9', name: 'MCP 服务器', sort: 8, type: 'menu', icon: 'CloudServerOutlined', path: '/mcp' },
]

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    title: '排序号',
    dataIndex: 'sort',
    key: 'sort',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (type: string) => (
      <Tag color={type === 'directory' ? 'blue' : 'green'}>
        {type === 'directory' ? '目录' : '菜单'}
      </Tag>
    ),
  },
  {
    title: '图标',
    dataIndex: 'icon',
    key: 'icon',
    width: 160,
    render: (icon: string) => <Text type="secondary" code style={{ fontSize: 11 }}>{icon}</Text>,
  },
  {
    title: '路由',
    dataIndex: 'path',
    key: 'path',
    width: 200,
    render: (path: string) => <Text type="secondary" style={{ fontSize: 12 }}>{path}</Text>,
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    render: () => (
      <Space size={6}>
        <Button type="primary" size="small" style={{ background: '#52c41a', borderColor: '#52c41a' }}>新增</Button>
        <Button size="small" type="primary">编辑</Button>
        <Button size="small" danger>删除</Button>
      </Space>
    ),
  },
]

export function MenuListPage() {
  return (
    <div className="menu-list-page">
      <Card size="small" className="menu-list-page__card">
        <div className="menu-list-page__toolbar">
          <Space size={8}>
            <Button size="small" icon={<ReloadOutlined />}>刷新</Button>
            <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<PlusOutlined />}>新增</Button>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Space>
          <Space size={8}>
            <Button size="small">导入</Button>
            <Button size="small">导出</Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={menuData}
          rowKey="key"
          size="small"
          pagination={false}
          expandable={{ defaultExpandAllRows: true }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  )
}
