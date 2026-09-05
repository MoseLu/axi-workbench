import React from 'react';
import './style.css';

export interface AppLayoutProps {
  /** Top header bar */
  topbar?: React.ReactNode;
  /** Left sidebar (menu) */
  sidebar?: React.ReactNode;
  /** Right function sidebar */
  rightSidebar?: React.ReactNode;
  /** Tab bar */
  tabbar?: React.ReactNode;
  /** Breadcrumb bar */
  breadcrumb?: React.ReactNode;
  /** Main content */
  children?: React.ReactNode;
  /** Left sidebar collapsed */
  sidebarCollapsed?: boolean;
  /** Content fullscreen mode */
  isFullscreen?: boolean;
  /** Additional class */
  className?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  topbar,
  sidebar,
  rightSidebar,
  tabbar,
  breadcrumb,
  children,
  sidebarCollapsed = false,
  isFullscreen = false,
  className = '',
}) => {
  return (
    <div className={`mpms-layout ${isFullscreen ? 'is-fullscreen' : ''} ${className}`}>
      {/* Left sidebar */}
      {sidebar && (
        <div className={`mpms-layout__sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          {sidebar}
        </div>
      )}

      {/* Right area */}
      <div className={`mpms-layout__right ${sidebarCollapsed ? 'is-collapsed' : ''} ${!sidebar ? 'no-sidebar' : ''}`}>
        {/* Topbar */}
        {topbar && <div className="mpms-layout__topbar">{topbar}</div>}

        {/* Body: center + right sidebar */}
        <div className="mpms-layout__body">
          {/* Center column */}
          <div className="mpms-layout__center">
            {tabbar && <div className="mpms-layout__tabbar">{tabbar}</div>}
            {breadcrumb && <div className="mpms-layout__breadcrumb">{breadcrumb}</div>}
            <div className="mpms-layout__content">{children}</div>
          </div>

          {/* Right sidebar */}
          {rightSidebar}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
