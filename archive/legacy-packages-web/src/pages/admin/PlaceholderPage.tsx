import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <Card
      style={{ borderRadius: 8, textAlign: 'center', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Empty
        image={<ToolOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.15)' }} />}
        description={
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>{title}</Title>
            <Text type="secondary">{description || '该功能正在开发中，敬请期待...'}</Text>
          </div>
        }
      />
    </Card>
  );
};

export default PlaceholderPage;
