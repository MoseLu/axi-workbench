import React from 'react';
import './style.css';

export interface PreferencesDrawerProps {
  visible: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  tooltip?: string;
  title?: string;
  children?: React.ReactNode;
  onOpen?: () => void;
}

const PreferencesDrawer: React.FC<PreferencesDrawerProps> = ({
  visible,
  onClose,
  icon,
  tooltip = '偏好设置',
  title = '偏好设置',
  children,
  onOpen,
}) => {
  return (
    <>
      <button
        className="mpms-icon-btn mpms-icon-btn--md"
        title={tooltip}
        onClick={onOpen}
        type="button"
      >
        {icon}
      </button>
      {visible && (
        <>
          <div className="mpms-drawer-mask" onClick={onClose} />
          <div className="mpms-drawer">
            <div className="mpms-drawer__header">
              <span className="mpms-drawer__title">{title}</span>
              <button className="mpms-drawer__close" onClick={onClose} type="button">×</button>
            </div>
            <div className="mpms-drawer__body">
              {children}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default PreferencesDrawer;
