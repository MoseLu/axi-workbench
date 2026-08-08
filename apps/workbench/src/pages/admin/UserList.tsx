import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxiTheme } from '@axi/core';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import avatarDefault from '../../assets/avatar-me.jpg';
import { loadProfile, type UserProfile } from './me/profileStore';
import './Me.css';

/** 个人中心入口：资料只读取本地 profile，不展示无来源的在线或设备状态。 */
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
    <main className="wb-me" aria-labelledby="wb-me-title">
      <h1 className="wb-me__visually-hidden" id="wb-me-title">个人中心</h1>
      <button type="button" className="wb-me__profile" onClick={() => navigate('/admin/me/account')}>
        <img className="wb-me__avatar" src={avatarSrc} alt="头像" />
        <span className="wb-me__meta">
          <span className="wb-me__name">{profile.nickname}</span>
          <span className="wb-me__email">{profile.email}</span>
        </span>
        <WorkbenchIcon name="forward" className="wb-me__chevron" />
      </button>

      <section className="wb-me__list" aria-label="账号设置">
        <button type="button" className="wb-me__row" onClick={() => navigate('/admin/me/notifications')}>
          <span>通知中心</span>
          <WorkbenchIcon name="forward" className="wb-me__chevron" />
        </button>
        <button type="button" className="wb-me__row" onClick={() => navigate('/admin/me/theme')}>
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
      </section>
    </main>
  );
};

export default UserList;
