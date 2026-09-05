import { useMemo } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Dropdown,
  Typography,
  Progress,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  PlusOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  MoreOutlined,
  SearchOutlined,
  ProjectOutlined,
  RocketOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { Task } from '@/types/task'
import { mockTasks, calculateTaskStats } from '@/data/mockTasks'
import './TaskPage.css'

const { Text } = Typography

const priorityColors: Record<string, string> = {
  P0: '#f5222d', P1: '#fa8c16', P2: '#1890ff', P3: '#52c41a',
}

const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  completed: { color: '#52c41a', text: '已完成', icon: <CheckCircleOutlined /> },
  in_progress: { color: '#1890ff', text: '进行中', icon: <SyncOutlined spin /> },
  todo: { color: '#8c8c8c', text: '待开始', icon: <ClockCircleOutlined /> },
  blocked: { color: '#faad14', text: '已阻塞', icon: <WarningOutlined /> },
  failed: { color: '#f5222d', text: '失败', icon: <WarningOutlined /> },
}

export function TaskPage() {
  const stats = useMemo(() => calculateTaskStats(mockTasks), [])

  const columns: TableColumnsType<Task> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 130,
      render: (id: string) => <Text code style={{ fontSize: 12 }}>{id}</Text>,
    },
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: Task) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status as keyof typeof statusConfig]
        return <Tag color={config?.color} icon={config?.icon}>{config?.text}</Tag>
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => <Tag color={priorityColors[priority]}>{priority}</Tag>,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (assignee: string) => assignee || <Text type="secondary">待分配</Text>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress: number | undefined, record: Task) => (
        record.status === 'in_progress' && progress !== undefined ? (
          <Progress percent={progress} size="small" strokeColor="#1890ff" />
        ) : record.status === 'completed' ? (
          <Progress percent={100} size="small" strokeColor="#52c41a" />
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => <Text type="secondary" style={{ fontSize: 12 }}>{date}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      fixed: 'right',
      render: () => (
        <Dropdown menu={{ items: [
          { key: 'edit', label: '编辑' },
          { key: 'view', label: '查看详情' },
          { type: 'divider' },
          { key: 'delete', label: '删除', danger: true },
        ]}}>
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ]

  return (
    <div className="task-page">
      {/* Stats row */}
      <Row gutter={10} className="task-page__stats">
        <Col xs={12} sm={6}>
          <Card size="small" className="task-page__stat-card" hoverable>
            <Statistic
              title="项目进度"
              value={stats.completionRate}
              suffix="%"
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#4165d7', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="task-page__stat-card" hoverable>
            <Statistic
              title="总任务"
              value={stats.total}
              prefix={<ProjectOutlined />}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="task-page__stat-card" hoverable>
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="task-page__stat-card" hoverable>
            <Statistic
              title="进行中"
              value={stats.inProgress}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* In-progress tasks */}
      <Card
        size="small"
        className="task-page__card"
        title={<Space size={6}><SyncOutlined spin style={{ color: '#1890ff' }} /><span>当前进行中</span></Space>}
        extra={<Tag color="blue">{stats.inProgress} 个任务</Tag>}
      >
        <Row gutter={10}>
          {mockTasks.filter(t => t.status === 'in_progress').map(task => (
            <Col xs={24} sm={8} key={task.id}>
              <Card size="small" hoverable className="task-page__progress-card">
                <Tag color={priorityColors[task.priority]} style={{ marginBottom: 6 }}>{task.priority}</Tag>
                <div className="task-page__progress-title">{task.title}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{task.module}</Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={4} style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    <UserOutlined /> {task.assignee}
                  </Space>
                </div>
                <Progress percent={task.progress} size="small" strokeColor="#1890ff" style={{ marginTop: 6 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Task table */}
      <Card
        size="small"
        className="task-page__card"
        title={<Space size={6}><ProjectOutlined /><span>任务列表</span></Space>}
        extra={
          <Space size={8}>
            <Input placeholder="搜索..." prefix={<SearchOutlined />} size="small" style={{ width: 160 }} allowClear />
            <Select placeholder="状态" size="small" style={{ width: 90 }} allowClear
              options={[
                { value: 'completed', label: '已完成' },
                { value: 'in_progress', label: '进行中' },
                { value: 'todo', label: '待开始' },
                { value: 'blocked', label: '已阻塞' },
              ]}
            />
            <Button type="primary" size="small" icon={<PlusOutlined />}>新建</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={mockTasks}
          rowKey="id"
          size="small"
          pagination={{
            total: mockTasks.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            size: 'small',
          }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  )
}
