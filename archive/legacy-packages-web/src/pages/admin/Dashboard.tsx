import React, { useState, useMemo } from 'react';
import {
  Layout,
  Menu,
  Breadcrumb,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Dropdown,
  Avatar,
  Typography,
  Row,
  Col,
  Card,
  Progress,
  Statistic,
  Badge,
} from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  RocketOutlined,
  BellOutlined,
  SearchOutlined,
  PlusOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  MoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import type { Task } from '../../types/task';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

// 模拟任务数据
const mockTasks: Task[] = [
  { id: 'P0.1.1.001', title: '设计K8s集群架构方案', description: '设计Kubernetes集群的整体架构方案', status: 'completed', priority: 'P0', assignee: '张三', module: 'K8s集群搭建', category: '基础设施', estimatedHours: 15, actualHours: 12, progress: 100, createdAt: '2025-02-01', updatedAt: '2025-02-10', completedAt: '2025-02-10' },
  { id: 'P0.1.1.002', title: '搭建Master节点集群', description: '部署3节点Master集群', status: 'completed', priority: 'P0', assignee: '李四', module: 'K8s集群搭建', category: '基础设施', estimatedHours: 8, actualHours: 10, progress: 100, createdAt: '2025-02-05', updatedAt: '2025-02-12', completedAt: '2025-02-12' },
  { id: 'P0.1.1.003', title: '配置Worker节点池', description: '配置工作节点池和自动伸缩', status: 'completed', priority: 'P0', assignee: '王五', module: 'K8s集群搭建', category: '基础设施', estimatedHours: 6, actualHours: 5, progress: 100, createdAt: '2025-02-08', updatedAt: '2025-02-13', completedAt: '2025-02-13' },
  { id: 'P0.1.1.004', title: '部署GPU节点池', description: '配置GPU工作节点', status: 'completed', priority: 'P0', assignee: '张三', module: 'K8s集群搭建', category: '基础设施', estimatedHours: 10, actualHours: 8, progress: 100, createdAt: '2025-02-09', updatedAt: '2025-02-14', completedAt: '2025-02-14' },
  { id: 'P0.1.1.005', title: '配置K8s网络插件', description: '部署CNI网络插件', status: 'completed', priority: 'P0', assignee: '李四', module: 'K8s集群搭建', category: '基础设施', estimatedHours: 4, actualHours: 3, progress: 100, createdAt: '2025-02-10', updatedAt: '2025-02-14', completedAt: '2025-02-14' },
  { id: 'P1.1.1.010', title: 'Agent运行时服务开发', description: '实现单Agent运行时引擎', status: 'in_progress', priority: 'P0', assignee: '张三', module: 'Agent运行时', category: '核心服务', estimatedHours: 40, actualHours: 25, progress: 65, createdAt: '2025-02-14', updatedAt: '2025-02-14', startedAt: '2025-02-14' },
  { id: 'P1.1.2.005', title: '工作流引擎API开发', description: '实现工作流定义的REST API', status: 'in_progress', priority: 'P1', assignee: '李四', module: '工作流引擎', category: '核心服务', estimatedHours: 20, actualHours: 8, progress: 40, createdAt: '2025-02-15', updatedAt: '2025-02-14', startedAt: '2025-02-15' },
  { id: 'P1.2.1.015', title: '租户管理CRUD开发', description: '实现租户的增删改查', status: 'in_progress', priority: 'P1', assignee: '王五', module: '租户管理', category: '平台服务', estimatedHours: 16, actualHours: 6, progress: 35, createdAt: '2025-02-16', updatedAt: '2025-02-14', startedAt: '2025-02-16' },
  { id: 'P2.1.1.001', title: '权限服务开发', description: '实现RBAC权限服务', status: 'todo', priority: 'P1', assignee: undefined, module: '权限服务', category: '关键功能', estimatedHours: 20, createdAt: '2025-02-20', updatedAt: '2025-02-20' },
  { id: 'P2.1.2.001', title: '角色服务开发', description: '实现角色管理服务', status: 'todo', priority: 'P1', assignee: undefined, module: '角色服务', category: '关键功能', estimatedHours: 15, createdAt: '2025-02-20', updatedAt: '2025-02-20' },
  { id: 'P2.1.3.001', title: '用户服务开发', description: '实现用户管理服务', status: 'todo', priority: 'P1', assignee: undefined, module: '用户服务', category: '关键功能', estimatedHours: 18, createdAt: '2025-02-20', updatedAt: '2025-02-20' },
  { id: 'P1.1.3.003', title: '任务调度算法实现', description: '实现优先级调度算法', status: 'blocked', priority: 'P1', assignee: '赵六', module: '任务调度', category: '核心服务', estimatedHours: 24, actualHours: 4, progress: 15, createdAt: '2025-02-12', updatedAt: '2025-02-14', startedAt: '2025-02-12' },
  { id: 'P1.1.3.004', title: '分布式任务队列开发', description: '实现分布式任务队列', status: 'blocked', priority: 'P1', assignee: '赵六', module: '任务调度', category: '核心服务', estimatedHours: 30, actualHours: 2, progress: 5, createdAt: '2025-02-13', updatedAt: '2025-02-14', startedAt: '2025-02-13' },
];

// 计算统计
const calculateStats = () => {
  const total = mockTasks.length;
  const completed = mockTasks.filter(t => t.status === 'completed').length;
  const inProgress = mockTasks.filter(t => t.status === 'in_progress').length;
  const todo = mockTasks.filter(t => t.status === 'todo').length;
  const blocked = mockTasks.filter(t => t.status === 'blocked' || t.status === 'failed').length;
  return { total, completed, inProgress, todo, blocked, completionRate: Math.round((completed / total) * 100) };
};

// 优先级颜色
const priorityColors: Record<string, string> = {
  P0: '#f5222d',
  P1: '#fa8c16',
  P2: '#1890ff',
  P3: '#52c41a',
};

// 状态配置
const statusConfig = {
  completed: { color: '#52c41a', text: '已完成', icon: <CheckCircleOutlined /> },
  in_progress: { color: '#1890ff', text: '进行中', icon: <SyncOutlined spin /> },
  todo: { color: '#8c8c8c', text: '待开始', icon: <ClockCircleOutlined /> },
  blocked: { color: '#faad14', text: '已阻塞', icon: <WarningOutlined /> },
  failed: { color: '#f5222d', text: '失败', icon: <WarningOutlined /> },
};

// 菜单项
const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: 'project', icon: <ProjectOutlined />, label: '项目管理' },
  { key: 'task', icon: <FileTextOutlined />, label: '任务管理' },
  { key: 'team', icon: <TeamOutlined />, label: '团队管理' },
  { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
];

const AdminDashboard: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const stats = useMemo(() => calculateStats(), []);

  // 表格列定义
  const columns: TableColumnsType<Task> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text code>{id}</Text>,
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
        const config = statusConfig[status as keyof typeof statusConfig];
        return (
          <Tag color={config?.color} icon={config?.icon}>
            {config?.text}
          </Tag>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={priorityColors[priority]}>{priority}</Tag>
      ),
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
      width: 120,
      render: (date: string) => <Text type="secondary">{date}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: () => (
        <Dropdown menu={{ items: [
          { key: 'edit', label: '编辑' },
          { key: 'view', label: '查看详情' },
          { type: 'divider' },
          { key: 'delete', label: '删除', danger: true },
        ]}}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧导航 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          background: '#001529',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}>
          <RocketOutlined style={{ fontSize: 28, color: '#1890ff', marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && <Title level={4} style={{ color: '#fff', margin: 0 }}>MPMS</Title>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['task']}
          items={menuItems}
          style={{ background: '#001529', marginTop: 8 }}
        />
      </Sider>

      {/* 右侧内容 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        {/* 顶部Header */}
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}>
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <Breadcrumb items={[
              { title: '首页' },
              { title: '任务管理' },
              { title: '任务列表' },
            ]} />
          </Space>

          <Space size={24}>
            <Input
              placeholder="搜索任务..."
              prefix={<SearchOutlined />}
              style={{ width: 240, borderRadius: 8 }}
            />
            <Badge count={5} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
            </Badge>
            <Dropdown menu={{ items: [
              { key: 'profile', label: '个人中心' },
              { key: 'settings', label: '设置' },
              { type: 'divider' },
              { key: 'logout', label: '退出登录', danger: true },
            ]}}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#1890ff' }}>A</Avatar>
                <Text>管理员</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* 主内容区 */}
        <Content style={{ padding: 24, background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="项目进度"
                  value={stats.completionRate}
                  suffix="%"
                  prefix={<RocketOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <Progress percent={stats.completionRate} showInfo={false} strokeColor="#1890ff" />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="总任务数"
                  value={stats.total}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="已完成"
                  value={stats.completed}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="进行中"
                  value={stats.inProgress}
                  prefix={<SyncOutlined spin />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 当前任务 - 时间线样式 */}
          <Card
            title={
              <Space>
                <SyncOutlined spin style={{ color: '#1890ff' }} />
                当前进行中
              </Space>
            }
            style={{ marginBottom: 24 }}
            extra={<Tag color="blue">共 {stats.inProgress} 个任务进行中</Tag>}
          >
            <Row gutter={16}>
              {mockTasks.filter(t => t.status === 'in_progress').map(task => (
                <Col xs={24} sm={8} key={task.id}>
                  <Card size="small" hoverable className="current-task-card">
                    <Tag color={priorityColors[task.priority]} style={{ marginBottom: 8 }}>{task.priority}</Tag>
                    <Title level={5} style={{ margin: '4px 0' }}>{task.title}</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>{task.module}</Text>
                    <div style={{ marginTop: 12 }}>
                      <Space>
                        <UserOutlined /> {task.assignee}
                      </Space>
                    </div>
                    <Progress percent={task.progress} size="small" strokeColor="#1890ff" style={{ marginTop: 8 }} />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 任务列表表格 */}
          <Card
            title={
              <Space>
                <FileTextOutlined />
                任务列表
              </Space>
            }
            extra={
              <Space>
                <Select
                  placeholder="全部状态"
                  style={{ width: 120 }}
                  allowClear
                  options={[
                    { value: 'completed', label: '已完成' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'todo', label: '待开始' },
                    { value: 'blocked', label: '已阻塞' },
                  ]}
                />
                <Select
                  placeholder="全部优先级"
                  style={{ width: 100 }}
                  allowClear
                  options={[
                    { value: 'P0', label: 'P0' },
                    { value: 'P1', label: 'P1' },
                    { value: 'P2', label: 'P2' },
                    { value: 'P3', label: 'P3' },
                  ]}
                />
                <Button type="primary" icon={<PlusOutlined />}>新建任务</Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={mockTasks}
              rowKey="id"
              pagination={{
                total: mockTasks.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;
