import React from 'react';
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
  return (
    <header className="app-topbar">
      {/* Left: collapse button */}
      <div className="app-topbar__left">
        <button className="app-topbar__icon-btn" onClick={onToggleCollapse} title="折叠菜单">
          <WorkbenchIcon name={collapsed ? 'expand' : 'collapse'} />
        </button>
      </div>

      {/* Right: tool icons + user */}
      <div className="app-topbar__tools">
        <button className="app-topbar__icon-btn" title="GitHub">
          <WorkbenchIcon name="github" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="国际化">
          <WorkbenchIcon name="language" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="通知">
          <WorkbenchIcon name="notification" size={16} />
          <span className="app-topbar__badge">3</span>
        </button>
        <button className="app-topbar__icon-btn" title="消息">
          <WorkbenchIcon name="message" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="偏好设置" onClick={onToggleRightSidebar}>
          <WorkbenchIcon name="settings" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="主题切换">
          <WorkbenchIcon name="moon" size={16} />
        </button>

        <div className="app-topbar__user">
          <div className="app-topbar__avatar">
            <WorkbenchIcon name="account" />
          </div>
          <span className="app-topbar__username">管理员</span>
          <WorkbenchIcon name="down" className="app-topbar__user-arrow" />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
