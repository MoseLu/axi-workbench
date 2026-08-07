import React from 'react';
import { WorkbenchIcon } from '../WorkbenchIcon';
import './RightSidebar.css';

interface RightSidebarProps {
  visible: boolean;
  onClose: () => void;
}

const themes = [
  { key: 'dark', label: '暗黑', color: 'var(--color-content-dark)' },
  { key: 'light', label: '亮色', color: 'var(--color-bg-card)' },
  { key: 'blue', label: '深蓝', color: 'var(--color-navy)' },
];

const primaryColors = [
  'var(--color-chart-1)',
  'var(--color-info-antd)',
  'var(--palette-purple-500)',
  'var(--color-chart-5)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-danger)',
  'var(--color-chart-6)',
];

const RightSidebar: React.FC<RightSidebarProps> = ({ visible, onClose }) => {
  const [currentTheme, setCurrentTheme] = React.useState('dark');
  const [currentColor, setCurrentColor] = React.useState('var(--color-chart-1)');

  return (
    <>
      {/* Overlay */}
      {visible && <div className="right-sidebar__overlay" onClick={onClose} />}

      {/* Panel */}
      <div className={`right-sidebar ${visible ? 'is-visible' : ''}`}>
        <div className="right-sidebar__header">
          <span className="right-sidebar__title">系统设置</span>
          <button className="right-sidebar__close" onClick={onClose}>
            <WorkbenchIcon name="close" />
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
                    {currentTheme === theme.key && <WorkbenchIcon name="check" style={{ color: theme.key === 'light' ? 'var(--palette-gray-333)' : 'var(--color-bg-card)', fontSize: 14 }} />}
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
                  {currentColor === color && <WorkbenchIcon name="check" style={{ color: 'var(--color-bg-card)', fontSize: 12 }} />}
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
