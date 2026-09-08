import React from 'react';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  DownOutlined,
} from '@ant-design/icons';
import Icon from '@/components/Icon';
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
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      {/* Right: tool icons + user */}
      <div className="app-topbar__tools">
        <button className="app-topbar__icon-btn" title="GitHub">
          <Icon name="system-github" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="国际化">
          <Icon name="system-lang" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="通知">
          <Icon name="status-notice" size={16} />
          <span className="app-topbar__badge">3</span>
        </button>
        <button className="app-topbar__icon-btn" title="消息">
          <Icon name="status-msg" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="偏好设置" onClick={onToggleRightSidebar}>
          <Icon name="system-theme" size={16} />
        </button>
        <button className="app-topbar__icon-btn" title="主题切换">
          <Icon name="system-dark" size={16} />
        </button>

        <div className="app-topbar__user">
          <div className="app-topbar__avatar">
            <UserOutlined />
          </div>
          <span className="app-topbar__username">管理员</span>
          <DownOutlined className="app-topbar__user-arrow" />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
