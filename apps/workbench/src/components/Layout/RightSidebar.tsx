import React from 'react';
import { useI18n } from '../../i18n';
import { WorkbenchIcon } from '../WorkbenchIcon';
import './RightSidebar.css';

interface RightSidebarProps {
  visible: boolean;
  onClose: () => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ visible, onClose }) => {
  const { t } = useI18n();
  const [currentTheme, setCurrentTheme] = React.useState('dark');
  const [currentColor, setCurrentColor] = React.useState('var(--color-chart-1)');

  const themes = [
    { key: 'dark', label: t('common.theme.dark'), color: 'var(--color-content-dark)' },
    { key: 'light', label: t('common.theme.light'), color: 'var(--color-bg-card)' },
    { key: 'blue', label: t('common.theme.blue'), color: 'var(--color-navy)' },
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

  return (
    <>
      {/* Overlay */}
      {visible && <div className="right-sidebar__overlay" onClick={onClose} />}

      {/* Panel */}
      <div className={`right-sidebar ${visible ? 'is-visible' : ''}`}>
        <div className="right-sidebar__header">
          <span className="right-sidebar__title">{t('common.settings.title')}</span>
          <button className="right-sidebar__close" onClick={onClose} aria-label={t('common.settings.close')}>
            <WorkbenchIcon name="close" />
          </button>
        </div>

        <div className="right-sidebar__body">
          {/* Theme */}
          <div className="right-sidebar__section">
            <div className="right-sidebar__section-title">{t('common.theme.mode')}</div>
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
            <div className="right-sidebar__section-title">{t('common.theme.color')}</div>
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
            <div className="right-sidebar__section-title">{t('common.layout.settings')}</div>
            <div className="right-sidebar__setting-row">
              <span>{t('common.sidebar.width')}</span>
              <span className="right-sidebar__setting-value">220px</span>
            </div>
            <div className="right-sidebar__setting-row">
              <span>{t('common.tabbar')}</span>
              <span className="right-sidebar__setting-value">{t('common.show')}</span>
            </div>
            <div className="right-sidebar__setting-row">
              <span>{t('common.breadcrumb')}</span>
              <span className="right-sidebar__setting-value">{t('common.show')}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;
