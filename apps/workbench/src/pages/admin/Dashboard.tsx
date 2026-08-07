import React from 'react';
import { Row, Col, Card, Statistic, Progress, Tag, Space, Typography } from 'antd';
import {
  ProjectOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useI18n } from '../../i18n';
import './Dashboard.css';

const { Title, Text } = Typography;

const metricCards = [
  { key: 'projects', title: '进行中项目', value: 12, icon: <ProjectOutlined />, trend: 2, color: 'var(--color-brand)' },
  { key: 'tasks', title: '今日待办', value: 5, icon: <FileTextOutlined />, trend: -1, color: 'var(--palette-orange-500)' },
  { key: 'uploads', title: '已下载资料', value: 23, icon: <CloudUploadOutlined />, trend: 8, color: 'var(--color-success-alt)' },
  { key: 'storage', title: '存储用量', value: '8.2 GB', icon: <DatabaseOutlined />, trend: 0, color: 'var(--palette-purple-500)', suffix: ' / 50 GB' },
];

const recentProjects = [
  { id: 'p1', name: '项目 A · Mobile Redesign', progress: 80, meta: '2 小时前 · 5 个成员', color: 'var(--color-brand)' },
  { id: 'p2', name: '项目 B · 文档重构', progress: 45, meta: '昨天 · 3 个成员', color: 'var(--palette-orange-500)' },
  { id: 'p3', name: '项目 C · 性能优化', progress: 25, meta: '3 天前 · 4 个成员', color: 'var(--color-success-alt)' },
];

const upcomingTasks = [
  { id: 't1', title: '完成 A 模块 review', priority: 'P0', due: '今天 18:00' },
  { id: 't2', title: '提交 8 月规划文档', priority: 'P1', due: '明天' },
  { id: 't3', title: '更新团队周报', priority: 'P2', due: '周五' },
];

const Dashboard: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="dashboard-page">
      {/* Metric cards — 无欢迎语、无左右外边距 */}
      <Row gutter={[0, 0]} style={{ marginBottom: 12 }}>
        {metricCards.map(card => (
          <Col xs={24} sm={12} md={6} key={card.key}>
            <Card size="small" bordered>
              <div className="metric-card">
                <div className="metric-card__icon" style={{ background: `${card.color}22`, color: card.color }}>
                  {card.icon}
                </div>
                <div className="metric-card__body">
                  <Text type="secondary" style={{ fontSize: 12 }}>{card.title}</Text>
                  <div className="metric-card__value">
                    <span className="metric-card__number">{card.value}</span>
                    {card.suffix && <span className="metric-card__suffix">{card.suffix}</span>}
                  </div>
                  {card.trend !== 0 && (
                    <span className={`metric-card__trend ${card.trend > 0 ? 'is-up' : 'is-down'}`}>
                      {card.trend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {Math.abs(card.trend)} 较上周
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Two-column: projects + tasks */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="最近项目" extra={<a>查看全部</a>} bordered>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {recentProjects.map(p => (
                <div key={p.id} className="project-row">
                  <div className="project-row__avatar" style={{ background: `${p.color}22`, color: p.color }}>
                    {p.name[0]}
                  </div>
                  <div className="project-row__body">
                    <div className="project-row__name">{p.name}</div>
                    <Progress
                      percent={p.progress}
                      size="small"
                      strokeColor={p.color}
                      trailColor={`${p.color}22`}
                      format={(v) => <span style={{ fontSize: 11 }}>{v}%</span>}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>{p.meta}</Text>
                  </div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="即将到期" extra={<a>查看全部</a>} bordered>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {upcomingTasks.map(tk => (
                <div key={tk.id} className="task-row">
                  <div className="task-row__main">
                    <div className="task-row__title">{tk.title}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{tk.due}</Text>
                  </div>
                  <Tag color={tk.priority === 'P0' ? 'red' : tk.priority === 'P1' ? 'orange' : 'blue'}>{tk.priority}</Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;