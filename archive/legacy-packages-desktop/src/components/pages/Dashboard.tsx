import { useMemo } from 'react'
import { Card, Row, Col, Statistic, Progress, Typography } from 'antd'
import {
  RocketOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { mockTasks, calculateTaskStats } from '@/data/mockTasks'
import './Dashboard.css'

const { Text } = Typography

export function DashboardPage() {
  const stats = useMemo(() => calculateTaskStats(mockTasks), [])

  return (
    <div className="dashboard-page">
      {/* Overall progress */}
      <Card size="small" className="dashboard-page__main-card">
        <Row align="middle" gutter={24}>
          <Col xs={24} md={12}>
            <div className="dashboard-page__progress-info">
              <div className="dashboard-page__progress-header">
                <TrophyOutlined style={{ color: '#faad14', fontSize: 20 }} />
                <span className="dashboard-page__progress-title">项目整体进度</span>
              </div>
              <div className="dashboard-page__progress-value">{stats.completionRate}%</div>
              <Text type="secondary" style={{ fontSize: 12 }}>已完成 {stats.completed} / 共 {stats.total} 个任务</Text>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Progress
              percent={stats.completionRate}
              strokeColor={{ '0%': '#4165d7', '100%': '#52c41a' }}
              strokeWidth={14}
              showInfo={false}
              style={{ marginTop: 8 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Stat cards */}
      <Row gutter={10}>
        <Col xs={12} sm={6}>
          <Card size="small" className="dashboard-page__stat" hoverable>
            <Statistic title="总任务" value={stats.total} prefix={<ProjectOutlined />} valueStyle={{ fontSize: 28, color: '#4165d7' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="dashboard-page__stat" hoverable>
            <Statistic title="已完成" value={stats.completed} prefix={<CheckCircleOutlined />} valueStyle={{ fontSize: 28, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="dashboard-page__stat" hoverable>
            <Statistic title="进行中" value={stats.inProgress} prefix={<SyncOutlined spin />} valueStyle={{ fontSize: 28, color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="dashboard-page__stat" hoverable>
            <Statistic title="阻塞" value={stats.blocked} prefix={<WarningOutlined />} valueStyle={{ fontSize: 28, color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* Recent activity */}
      <Card size="small" className="dashboard-page__card" title="最近活动">
        <div className="dashboard-page__activity-list">
          {mockTasks.slice(0, 6).map(task => (
            <div key={task.id} className="dashboard-page__activity-item">
              <div className="dashboard-page__activity-dot" style={{
                background: task.status === 'completed' ? '#52c41a' :
                  task.status === 'in_progress' ? '#1890ff' :
                  task.status === 'blocked' ? '#faad14' : '#8c8c8c'
              }} />
              <div className="dashboard-page__activity-content">
                <Text style={{ fontSize: 13 }}>{task.title}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{task.module} - {task.updatedAt}</Text>
              </div>
              <div className="dashboard-page__activity-status">
                {task.status === 'completed' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                {task.status === 'in_progress' && <SyncOutlined spin style={{ color: '#1890ff' }} />}
                {task.status === 'blocked' && <WarningOutlined style={{ color: '#faad14' }} />}
                {task.status === 'todo' && <ClockCircleOutlined style={{ color: '#8c8c8c' }} />}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
