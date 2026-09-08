import { Card, Row, Col, Progress, Tag, Button, Space, Avatar } from 'antd'
import { PlusOutlined, ProjectOutlined, TeamOutlined, CalendarOutlined } from '@ant-design/icons'
import './ProjectPage.css'

interface Project {
  key: string
  id: number
  name: string
  description: string
  progress: number
  status: string
  team: string[]
  startDate: string
  endDate: string
}

const projectData: Project[] = [
  { key: '1', id: 1, name: 'K8s集群搭建', description: 'Kubernetes集群整体架构与部署', progress: 85, status: 'in_progress', team: ['张三', '李四', '王五'], startDate: '2025-01-01', endDate: '2025-03-01' },
  { key: '2', id: 2, name: 'Agent运行时', description: '单Agent运行时引擎开发', progress: 65, status: 'in_progress', team: ['张三', '赵六'], startDate: '2025-01-15', endDate: '2025-04-15' },
  { key: '3', id: 3, name: '工作流引擎', description: '工作流引擎核心功能开发', progress: 40, status: 'in_progress', team: ['李四', '孙七'], startDate: '2025-02-01', endDate: '2025-05-01' },
  { key: '4', id: 4, name: '权限服务', description: 'RBAC权限服务实现', progress: 0, status: 'planning', team: [], startDate: '2025-02-20', endDate: '2025-04-20' },
  { key: '5', id: 5, name: '用户服务', description: '用户管理服务开发', progress: 0, status: 'planning', team: [], startDate: '2025-02-25', endDate: '2025-05-25' },
]

const statusMap: Record<string, { color: string; text: string }> = {
  'in_progress': { color: 'processing', text: '进行中' },
  'completed': { color: 'success', text: '已完成' },
  'planning': { color: 'default', text: '规划中' },
  'blocked': { color: 'warning', text: '已阻塞' },
}

export function ProjectPage() {
  return (
    <div className="project-page">
      <div className="project-page__header">
        <h2>项目管理</h2>
        <Button type="primary" icon={<PlusOutlined />}>新建项目</Button>
      </div>
      <Row gutter={[16, 16]}>
        {projectData.map(project => (
          <Col xs={24} sm={12} lg={8} key={project.key}>
            <Card
              size="small"
              className="project-page__card"
              hoverable
              title={
                <Space>
                  <ProjectOutlined />
                  <span>{project.name}</span>
                </Space>
              }
              extra={<Tag color={statusMap[project.status].color}>{statusMap[project.status].text}</Tag>}
            >
              <div className="project-page__description">{project.description}</div>
              <div className="project-page__progress">
                <div className="project-page__progress-label">
                  <span>进度</span>
                  <span>{project.progress}%</span>
                </div>
                <Progress percent={project.progress} size="small" strokeColor="#1890ff" />
              </div>
              <div className="project-page__info">
                <Space>
                  <CalendarOutlined />
                  <span>{project.startDate} ~ {project.endDate}</span>
                </Space>
              </div>
              <div className="project-page__team">
                <Space>
                  <TeamOutlined />
                  {project.team.length > 0 ? (
                    <Avatar.Group maxCount={3} size="small">
                      {project.team.map((member, idx) => (
                        <Avatar key={idx} style={{ backgroundColor: '#4165d7' }}>{member[0]}</Avatar>
                      ))}
                    </Avatar.Group>
                  ) : (
                    <span style={{ color: '#8c8c8c' }}>待分配</span>
                  )}
                </Space>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
