import React, { useState, useMemo } from 'react';
import {
  Card,
  Timeline,
  Tag,
  Progress,
  Typography,
  Row,
  Col,
  Divider,
  Space,
} from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  RightOutlined,
  UserOutlined,
  BookOutlined,
  FieldTimeOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import type { Task } from '../../types/task';

const { Text, Title } = Typography;

// 状态配置
const statusConfig: Record<string, { color: string; dot: string }> = {
  completed: {
    color: '#52c41a',
    dot: '#52c41a',
  },
  in_progress: {
    color: '#1890ff',
    dot: '#1890ff',
  },
  blocked: {
    color: '#faad14',
    dot: '#faad14',
  },
  todo: {
    color: '#8c8c8c',
    dot: '#d9d9d9',
  },
  failed: {
    color: '#f5222d',
    dot: '#f5222d',
  },
};

// 优先级颜色
const priorityColors: Record<string, string> = {
  P0: '#f5222d',
  P1: '#fa8c16',
  P2: '#1890ff',
  P3: '#52c41a',
  P4: '#8c8c8c',
  P5: '#d9d9d9',
};

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 按ID排序（模拟任务依赖顺序）
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => a.id.localeCompare(b.id));
  }, [tasks]);

  // 获取当前正在进行的任务
  const currentTask = useMemo(() => {
    return sortedTasks.find(t => t.status === 'in_progress');
  }, [sortedTasks]);

  // 获取已完成的任务（倒序展示）
  const completedTasks = useMemo(() => {
    return sortedTasks.filter(t => t.status === 'completed').reverse();
  }, [sortedTasks]);

  // 获取即将执行的任务
  const upcomingTasks = useMemo(() => {
    return sortedTasks.filter(t => t.status === 'todo').slice(0, 3);
  }, [sortedTasks]);

  // 获取阻塞的任务
  const blockedTasks = useMemo(() => {
    return sortedTasks.filter(t => t.status === 'blocked' || t.status === 'failed');
  }, [sortedTasks]);

  // 构建时间线项目
  const buildTimelineItems = () => {
    const items: { color?: string; dot?: React.ReactNode; children: React.ReactNode }[] = [];

    // 阻塞任务
    blockedTasks.forEach(task => {
      items.push({
        color: statusConfig[task.status]?.color || '#faad14',
        children: (
          <div className="timeline-item timeline-blocked" onClick={() => setSelectedTask(task)}>
            <Tag color="error">阻塞</Tag>
            <Text delete>{task.title}</Text>
            <div className="timeline-meta">
              <Text type="secondary">{task.id}</Text>
            </div>
          </div>
        ),
      });
    });

    // 当前进行中的任务
    if (currentTask) {
      items.push({
        color: '#1890ff',
        dot: <SyncOutlined spin style={{ fontSize: 20 }} />,
        children: (
          <div className="timeline-item timeline-current" onClick={() => setSelectedTask(currentTask)}>
            <div className="current-badge">当前任务</div>
            <Text strong style={{ fontSize: 16 }}>{currentTask.title}</Text>
            <div className="timeline-meta">
              <Tag color={priorityColors[currentTask.priority]}>{currentTask.priority}</Tag>
              <Text type="secondary">{currentTask.module}</Text>
              {currentTask.assignee && <Text type="secondary"> | {currentTask.assignee}</Text>}
            </div>
            <div className="current-progress">
              <Progress percent={currentTask.progress || 0} size="small" strokeColor="#1890ff" />
            </div>
          </div>
        ),
      });
    }

    // 已完成的任务
    completedTasks.slice(0, 5).forEach(task => {
      items.push({
        color: '#52c41a',
        children: (
          <div className="timeline-item timeline-completed" onClick={() => setSelectedTask(task)}>
            <Text type="secondary">{task.title}</Text>
            <div className="timeline-meta">
              <Text type="secondary">{task.id}</Text>
              {task.completedAt && <Text type="secondary"> | {task.completedAt}</Text>}
            </div>
          </div>
        ),
      });
    });

    // 待开始的任务
    upcomingTasks.forEach((task, index) => {
      items.push({
        color: '#d9d9d9',
        children: (
          <div className="timeline-item timeline-upcoming" onClick={() => setSelectedTask(task)}>
            <div className="upcoming-badge">第 {index + 1} 步</div>
            <Text>{task.title}</Text>
            <div className="timeline-meta">
              <Text type="secondary">{task.id}</Text>
              <Tag color={priorityColors[task.priority]}>{task.priority}</Tag>
            </div>
          </div>
        ),
      });
    });

    // 如果还有更多待开始任务
    if (sortedTasks.filter(t => t.status === 'todo').length > 3) {
      items.push({
        color: '#d9d9d9',
        dot: <ClockCircleOutlined />,
        children: (
          <Text type="secondary">
            还有 {sortedTasks.filter(t => t.status === 'todo').length - 3} 个任务待开始...
          </Text>
        ),
      });
    }

    return items;
  };

  // 渲染任务详情
  const renderTaskDetail = (task: Task) => {
    return (
      <Card className="task-detail-card" size="small">
        <div className="task-detail-header">
          <div className="task-id">{task.id}</div>
          <Tag color={priorityColors[task.priority]}>{task.priority}</Tag>
        </div>
        <Title level={5} style={{ margin: '8px 0' }}>{task.title}</Title>
        <Text type="secondary">{task.description}</Text>

        <Divider style={{ margin: '12px 0' }} />

        <Row gutter={16}>
          <Col span={12}>
            <div className="detail-item">
              <UserOutlined /> {task.assignee || '待分配'}
            </div>
          </Col>
          <Col span={12}>
            <div className="detail-item">
              <BookOutlined /> {task.module}
            </div>
          </Col>
        </Row>

        {task.progress !== undefined && task.status === 'in_progress' && (
          <div className="detail-progress" style={{ marginTop: 12 }}>
            <div className="progress-label">
              <FieldTimeOutlined /> 进度: {task.progress}%
            </div>
            <Progress percent={task.progress} size="small" strokeColor="#1890ff" />
          </div>
        )}

        {task.status === 'completed' && task.completedAt && (
          <div className="detail-item" style={{ marginTop: 8 }}>
            <CheckCircleOutlined /> 完成于: {task.completedAt}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="task-list-container">
      <Row gutter={[24, 24]}>
        {/* 左侧: 时间线视图 */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <FieldTimeOutlined />
                任务进度时间线
              </Space>
            }
            className="timeline-card"
          >
            <Timeline
              mode="left"
              items={buildTimelineItems()}
            />
          </Card>
        </Col>

        {/* 右侧: 任务详情 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <FlagOutlined />
                任务详情
              </Space>
            }
            className="detail-card"
          >
            {selectedTask ? (
              renderTaskDetail(selectedTask)
            ) : currentTask ? (
              <div className="no-selection">
                <SyncOutlined spin style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                <Title level={5}>当前进行中</Title>
                <Text type="secondary">点击查看详情</Text>
                {renderTaskDetail(currentTask)}
              </div>
            ) : (
              <div className="no-selection">
                <ClockCircleOutlined style={{ fontSize: 48, color: '#8c8c8c', marginBottom: 16 }} />
                <Text type="secondary">暂无进行中的任务</Text>
              </div>
            )}
          </Card>

          {/* 下一步预告 */}
          <Card
            title={
              <Space>
                <RightOutlined />
                下一步预告
              </Space>
            }
            className="upcoming-card"
            style={{ marginTop: 16 }}
          >
            {upcomingTasks.length > 0 ? (
              <Timeline
                items={upcomingTasks.map((task) => ({
                  color: '#d9d9d9',
                  children: (
                    <div className="upcoming-item">
                      <Text>{task.title}</Text>
                      <div className="upcoming-meta">
                        <Tag color={priorityColors[task.priority]} style={{ fontSize: 10 }}>{task.priority}</Tag>
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Text type="secondary">暂无预告任务</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TaskList;
