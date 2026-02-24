import React from 'react';
import RightSidebarIcon from '../atoms/layout-specific/right-sidebar-icon';
import './style.css';

export interface RightSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Icon buttons rendered in the sidebar */
  children?: React.ReactNode;
  /** Collapse button icon */
  collapseIcon?: React.ReactNode;
  /** FAB expand icon (shown when collapsed) */
  expandIcon?: React.ReactNode;
}

/**
 * Right sidebar component - uses layout-specific RightSidebarIcon atoms.
 * Right sidebar with collapsible icons panel for secondary tools.
 */
const RightSidebar: React.FC<RightSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  children,
  collapseIcon,
  expandIcon,
}) => {
  return (
    <>
      <aside className={`mpms-right-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="mpms-right-sidebar__icons">
          {children}
          <RightSidebarIcon
            icon={collapseIcon || <span style={{ fontSize: 14 }}>›</span>}
            tooltip="折叠"
            active={!collapsed}
            onClick={onToggleCollapse}
          />
        </div>
      </aside>

      <div className={`mpms-right-sidebar-fab ${collapsed ? 'is-visible' : ''}`}>
        <button
          className="mpms-right-sidebar-fab__btn"
          onClick={onToggleCollapse}
          title="显示侧边栏"
          type="button"
        >
          {expandIcon || <span style={{ fontSize: 14 }}>‹</span>}
        </button>
      </div>
    </>
  );
};

export default RightSidebar;

/** Placeholder icon button for right sidebar - now uses layout-specific RightSidebarIcon */
export interface RightSidebarIconProps {
  icon: React.ReactNode;
  tooltip?: string;
  size?: number;
  active?: boolean;
  onClick?: () => void;
}

export { RightSidebarIcon };
