import React from 'react';
import { useI18n } from '../../i18n';
import { WorkbenchIcon } from '../WorkbenchIcon';
import './HeaderBar.css';

interface HeaderBarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleRightSidebar: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  collapsed,
  onToggleCollapse,
  onToggleRightSidebar,
}) => {
  const { t } = useI18n();
  return (
    <header className="app-topbar">
      {/* Left: collapse button */}
      <div className="app-topbar__left">
        <button className="app-topbar__icon-btn" onClick={onToggleCollapse} title={t('layout.topbar.toggleCollapse')}>
          <WorkbenchIcon name={collapsed ? 'expand' : 'collapse'} />
        </button>
      </div>

      {/* Right: tool icons + user */}
      <div className="app-topbar__tools">
        <button className="app-topbar__icon-btn" title="GitHub">
          <WorkbenchIcon name="github" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title={t('layout.topbar.language')}>
          <WorkbenchIcon name="language" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title={t('layout.topbar.notifications')}>
          <WorkbenchIcon name="notification" size={16} />
          <span className="app-topbar__badge">3</span>
        </button>
        <button className="app-topbar__icon-btn" title={t('layout.topbar.messages')}>
          <WorkbenchIcon name="message" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title={t('layout.topbar.preferences')} onClick={onToggleRightSidebar}>
          <WorkbenchIcon name="settings" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title={t('layout.topbar.theme')}>
          <WorkbenchIcon name="moon" size={16} />
        </button>

        <div className="app-topbar__user">
          <div className="app-topbar__avatar">
            <WorkbenchIcon name="account" />
          </div>
          <span className="app-topbar__username">{t('common.user.admin')}</span>
          <WorkbenchIcon name="down" className="app-topbar__user-arrow" />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
