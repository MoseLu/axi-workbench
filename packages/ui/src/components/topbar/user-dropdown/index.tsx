import React, { useState, useRef, useEffect } from 'react';
import { DownOutlined } from '@ant-design/icons';
import type { UserInfo, UserMenuItem } from '../../../types';
import './style.css';

export interface UserDropdownProps {
  user: UserInfo;
  menuItems?: UserMenuItem[];
  avatarIcon?: React.ReactNode;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
  user,
  menuItems = [],
  avatarIcon,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="mpms-user-dropdown" ref={ref}>
      <div className="mpms-user-dropdown__trigger" onClick={() => setOpen(!open)}>
        <span className="mpms-user-dropdown__name">{user.name}</span>
        <div className="mpms-user-dropdown__avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="mpms-user-dropdown__avatar-img" />
          ) : (
            avatarIcon || <span>{user.name[0]}</span>
          )}
        </div>
        <DownOutlined className="mpms-user-dropdown__arrow" />
      </div>
      {open && menuItems.length > 0 && (
        <div className="mpms-user-dropdown__menu">
          {menuItems.map(item =>
            item.divider ? (
              <div key={item.key} className="mpms-user-dropdown__divider" />
            ) : (
              <div
                key={item.key}
                className={`mpms-user-dropdown__menu-item ${item.danger ? 'is-danger' : ''}`}
                onClick={() => { item.onClick?.(); setOpen(false); }}
              >
                {item.icon && <span className="mpms-user-dropdown__menu-icon">{item.icon}</span>}
                <span>{item.label}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
