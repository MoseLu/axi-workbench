import React from 'react';
import { Card, Row, Col, Progress } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { TaskStats as TaskStatsType } from '../../types/task';

interface TaskStatsProps {
  stats: TaskStatsType;
}

const TaskStatsPanel: React.FC<TaskStatsProps> = ({ stats }) => {
  const {
    total,
    completed,
    inProgress,
    todo,
    blocked,
    failed,
    completionRate,
  } = stats;

  return (
    <div className="task-stats-panel">
      {/* 主统计卡片 - 居中大卡片 */}
      <Card className="main-stat-card" bordered={false}>
        <div className="main-stat-content">
          <div className="main-stat-left">
            <div className="main-title">
              <TrophyOutlined className="title-icon" />
              项目整体进度
            </div>
            <div className="main-value">{completionRate}%</div>
            <div className="progress-detail">
              <span>已完成 {completed} 个任务 / 共 {total} 个任务</span>
            </div>
            <Progress
              percent={completionRate}
              showInfo={false}
              strokeColor={{
                '0%': '#108ee9',
                '50%': '#52c41a',
                '100%': '#52c41a',
              }}
              trailColor="#f0f0f0"
              strokeWidth={12}
              style={{ marginTop: 16 }}
            />
          </div>
        </div>
      </Card>

      {/* 快捷统计卡片 */}
      <Row gutter={[16, 16]} className="quick-stats">
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-completed" hoverable>
            <div className="stat-content">
              <div className="stat-icon">
                <CheckCircleOutlined />
              </div>
              <div className="stat-info">
                <div className="stat-value">{completed}</div>
                <div className="stat-label">已完成</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-progress" hoverable>
            <div className="stat-content">
              <div className="stat-icon">
                <SyncOutlined spin />
              </div>
              <div className="stat-info">
                <div className="stat-value">{inProgress}</div>
                <div className="stat-label">进行中</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-pending" hoverable>
            <div className="stat-content">
              <div className="stat-icon">
                <ClockCircleOutlined />
              </div>
              <div className="stat-info">
                <div className="stat-value">{todo}</div>
                <div className="stat-label">待开始</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-blocked" hoverable>
            <div className="stat-content">
              <div className="stat-icon">
                <WarningOutlined />
              </div>
              <div className="stat-info">
                <div className="stat-value">{blocked + failed}</div>
                <div className="stat-label">阻塞/失败</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TaskStatsPanel;
