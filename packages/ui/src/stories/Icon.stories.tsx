import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../components/atoms/universal/icon';

const meta: Meta = {
  title: 'Atoms/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'number', min: 12, max: 64, step: 4 },
    color: { control: 'color' },
    name: { control: 'select', options: ['legacy-edit', 'legacy-delete', 'legacy-search', 'legacy-settings', 'status-success', 'status-fail'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 默认图标
 */
export const Default: Story = {
  args: {
    name: 'legacy-edit',
    size: 24,
    color: 'currentColor',
  },
};

/**
 * 不同尺寸
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Icon name="legacy-edit" size={12} />
      <Icon name="legacy-edit" size={16} />
      <Icon name="legacy-edit" size={20} />
      <Icon name="legacy-edit" size={24} />
      <Icon name="legacy-edit" size={32} />
      <Icon name="legacy-edit" size={48} />
    </div>
  ),
};

/**
 * 不同颜色
 */
export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Icon name="legacy-edit" size={24} color="#4165d7" />
      <Icon name="legacy-edit" size={24} color="#52c41a" />
      <Icon name="legacy-edit" size={24} color="#faad14" />
      <Icon name="legacy-edit" size={24} color="#f5222d" />
      <Icon name="legacy-edit" size={24} color="#1890ff" />
    </div>
  ),
};

/**
 * 状态图标
 */
export const StatusIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Icon name="status-success" size={32} color="#52c41a" />
        <span>Success</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Icon name="status-fail" size={32} color="#f5222d" />
        <span>Fail</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Icon name="status-warn" size={32} color="#faad14" />
        <span>Warning</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Icon name="status-info" size={32} color="#1890ff" />
        <span>Info</span>
      </div>
    </div>
  ),
};

/**
 * 带点击事件
 */
export const WithClick: Story = {
  args: {
    name: 'legacy-settings',
    size: 24,
    onClick: () => alert('Icon clicked!'),
  },
};
