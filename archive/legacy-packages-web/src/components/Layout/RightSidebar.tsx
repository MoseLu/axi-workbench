import React from 'react';
import { CloseOutlined, CheckOutlined } from '@ant-design/icons';
import './RightSidebar.css';

interface RightSidebarProps {
  visible: boolean;
  onClose: () => void;
}

const themes = [
  { key: 'dark', label: '暗黑', color: '#141414' },
  { key: 'light', label: '亮色', color: '#ffffff' },
  { key: 'blue', label: '深蓝', color: '#001529' },
];

const primaryColors = [
  '#4165d7',
  '#1890ff',
  '#722ed1',
  '#13c2c2',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#eb2f96',
];

const RightSidebar: React.FC<RightSidebarProps> = ({ visible, onClose }) => {
  const [currentTheme, setCurrentTheme] = React.useState('dark');
  const [currentColor, setCurrentColor] = React.useState('#4165d7');

  return (
    <>
      {/* Overlay */}
      {visible && <div className="right-sidebar__overlay" onClick={onClose} />}

      {/* Panel */}
      <div className={`right-sidebar ${visible ? 'is-visible' : ''}`}>
        <div className="right-sidebar__header">
          <span className="right-sidebar__title">系统设置</span>
          <button className="right-sidebar__close" onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>

        <div className="right-sidebar__body">
          {/* Theme */}
          <div className="right-sidebar__section">
            <div className="right-sidebar__section-title">主题模式</div>
            <div className="right-sidebar__themes">
              {themes.map(theme => (
                <div
                  key={theme.key}
                  className={`right-sidebar__theme-item ${currentTheme === theme.key ? 'is-active' : ''}`}
                  onClick={() => setCurrentTheme(theme.key)}
                >
                  <div
                    className="right-sidebar__theme-preview"
                    style={{ background: theme.color, border: theme.key === 'light' ? '1px solid rgba(255,255,255,0.15)' : 'none' }}
                  >
                    {currentTheme === theme.key && <CheckOutlined style={{ color: theme.key === 'light' ? '#333' : '#fff', fontSize: 14 }} />}
                  </div>
                  <span className="right-sidebar__theme-label">{theme.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Color */}
          <div className="right-sidebar__section">
            <div className="right-sidebar__section-title">主题颜色</div>
            <div className="right-sidebar__colors">
              {primaryColors.map(color => (
                <div
                  key={color}
                  className={`right-sidebar__color-item ${currentColor === color ? 'is-active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setCurrentColor(color)}
                >
                  {currentColor === color && <CheckOutlined style={{ color: '#fff', fontSize: 12 }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="right-sidebar__section">
            <div className="right-sidebar__section-title">界面设置</div>
            <div className="right-sidebar__setting-row">
              <span>侧边栏宽度</span>
              <span className="right-sidebar__setting-value">220px</span>
            </div>
            <div className="right-sidebar__setting-row">
              <span>标签栏</span>
              <span className="right-sidebar__setting-value">显示</span>
            </div>
            <div className="right-sidebar__setting-row">
              <span>面包屑</span>
              <span className="right-sidebar__setting-value">显示</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;
