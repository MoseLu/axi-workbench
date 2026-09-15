import { Card, Row, Col, Avatar, Tag, Button, Space, Progress } from 'antd'
import { PlusOutlined, UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import './TeamPage.css'

interface TeamMember {
  key: string
  id: number
  name: string
  email: string
  phone: string
  role: string
  department: string
  status: string
  tasks: number
}

const teamData: TeamMember[] = [
  { key: '1', id: 1, name: '张三', email: 'zhangsan@example.com', phone: '13800138000', role: '技术负责人', department: '研发部', status: 'online', tasks: 5 },
  { key: '2', id: 2, name: '李四', email: 'lisi@example.com', phone: '13800138001', role: '后端开发', department: '研发部', status: 'online', tasks: 3 },
  { key: '3', id: 3, name: '王五', email: 'wangwu@example.com', phone: '13800138002', role: '后端开发', department: '研发部', status: 'away', tasks: 2 },
  { key: '4', id: 4, name: '赵六', email: 'zhaoliu@example.com', phone: '13800138003', role: '前端开发', department: '研发部', status: 'offline', tasks: 4 },
  { key: '5', id: 5, name: '孙七', email: 'sunqi@example.com', phone: '13800138004', role: '产品经理', department: '产品部', status: 'online', tasks: 2 },
  { key: '6', id: 6, name: '周八', email: 'zhouba@example.com', phone: '13800138005', role: '测试工程师', department: '测试部', status: 'online', tasks: 3 },
]

const roleColors: Record<string, string> = {
  '技术负责人': 'red',
  '后端开发': 'blue',
  '前端开发': 'cyan',
  '产品经理': 'purple',
  '测试工程师': 'green',
}

export function TeamPage() {
  return (
    <div className="team-page">
      <div className="team-page__header">
        <h2>团队管理</h2>
        <Button type="primary" icon={<PlusOutlined />}>添加成员</Button>
      </div>
      <Row gutter={[16, 16]}>
        {teamData.map(member => (
          <Col xs={24} sm={12} lg={8} xl={6} key={member.key}>
            <Card size="small" className="team-page__card" hoverable>
              <div className="team-page__avatar-wrapper">
                <Avatar size={64} style={{ backgroundColor: '#4165d7' }}>{member.name[0]}</Avatar>
                <div className={`team-page__status team-page__status--${member.status}`} />
              </div>
              <div className="team-page__name">{member.name}</div>
              <Tag color={roleColors[member.role]}>{member.role}</Tag>
              <div className="team-page__department}>{member.department}</div>
              <div className="team-page__contact">
                <div><MailOutlined /> {member.email}</div>
                <div><PhoneOutlined /> {member.phone}</div>
              </div>
              <div className="team-page__tasks">
                <div className="team-page__tasks-label">
                  <span>进行中任务</span>
                  <span>{member.tasks}</span>
                </div>
                <Progress percent={member.tasks * 20} size="small" strokeColor="#1890ff" />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
