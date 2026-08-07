import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxiTheme } from '@axi/core';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import avatarDefault from '../../assets/avatar-me.jpg';
import { loadProfile, type UserProfile } from './me/profileStore';
import './Me.css';

/**
 * 我的 — 入口列表；资料来自本地 profile，点资料栏进入可编辑页。
 */
const UserList: React.FC = () => {
  const navigate = useNavigate();
  const { preference } = useAxiTheme();
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());

  useEffect(() => {
    const onChange = () => setProfile(loadProfile());
    window.addEventListener('wb-profile-changed', onChange);
    return () => window.removeEventListener('wb-profile-changed', onChange);
  }, []);

  const avatarSrc = profile.avatarDataUrl || avatarDefault;
  const themeLabel = preference === 'dark' ? '深色' : preference === 'light' ? '浅色' : '跟随系统';

  return (
    <div className="wb-me">
      <button type="button" className="wb-me__profile" onClick={() => navigate('/admin/me/account')}>
        <img className="wb-me__avatar" src={avatarSrc} alt="头像" />
        <div className="wb-me__meta">
          <div className="wb-me__name">{profile.nickname}</div>
          <div className="wb-me__email">{profile.email}</div>
          <div className="wb-me__status">
            <span className="wb-me__status-dot" />
            <span>在线</span>
          </div>
        </div>
        <WorkbenchIcon name="forward" className="wb-me__chevron" />
      </button>

      <div className="wb-me__group">
        {[
          { label: '设备管理', path: '/admin/me/devices' },
          { label: '通知中心', path: '/admin/me/notifications' },
        ].map((item, i, arr) => (
          <button
            key={item.path}
            type="button"
            className={`wb-me__row ${i < arr.length - 1 ? 'has-divider' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span>{item.label}</span>
            <WorkbenchIcon name="forward" className="wb-me__chevron" />
          </button>
        ))}
      </div>

      <div className="wb-me__group">
        <button type="button" className="wb-me__row has-divider" onClick={() => navigate('/admin/me/theme')}>
          <span>主题外观</span>
          <span className="wb-me__value">
            {themeLabel}
            <WorkbenchIcon name="forward" className="wb-me__chevron" />
          </span>
        </button>
        <button type="button" className="wb-me__row" onClick={() => navigate('/admin/me/settings')}>
          <span>设置</span>
          <WorkbenchIcon name="forward" className="wb-me__chevron" />
        </button>
      </div>
    </div>
  );
};

export default UserList;
