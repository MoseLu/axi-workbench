import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

interface PlaceholderProps {
  title: string;
  description?: string;
}

const Placeholder: React.FC<PlaceholderProps> = ({ title, description }) => {
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <Title level={3} style={{ marginTop: 24 }}>{title}</Title>
      {description && (
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          {description}
        </Paragraph>
      )}
    </div>
  );
};

export default Placeholder;