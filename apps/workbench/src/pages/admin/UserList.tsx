import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Descriptions } from 'antd';
import { AxiSvgIcon, useAxiTheme } from '@axi/core';
import { AxiTableGroup } from '@axi/crud';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { useAuth } from '../../contexts/AuthContext';
import { DesktopSettingsPage } from './me/DesktopSettingsPage';
import { loadProfile, type UserProfile } from './me/profileStore';
import './Me.css';

/** 桌面端个人中心：资料只读取本地 profile，不展示无来源的在线或设备状态。 */
const UserList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preference } = useAxiTheme();
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(user));

  useEffect(() => {
    const onChange = () => setProfile(loadProfile(user));
    window.addEventListener('wb-profile-changed', onChange);
    return () => window.removeEventListener('wb-profile-changed', onChange);
  }, [user]);

  const themeLabel = preference === 'dark' ? '深色' : preference === 'light' ? '浅色' : '跟随系统';

  return (
    <DesktopSettingsPage
      activeKey="/admin/me"
      actions={<Button size="small" type="primary" onClick={() => navigate('/admin/me/account')}>编辑资料</Button>}
      title="个人中心"
    >
      <AxiTableGroup title="账户资料">
        <div className="wb-me-overview__profile">
          {profile.avatarDataUrl ? (
            <img className="wb-me-overview__avatar" src={profile.avatarDataUrl} alt="头像" />
          ) : (
            <span aria-label="默认头像" className="wb-me-overview__avatar wb-me-overview__avatar--default">
              <AxiSvgIcon name={axiWorkbenchIconMap.account} size={22} />
            </span>
          )}
          <div className="wb-me-overview__identity">
            <strong>{profile.nickname}</strong>
            <span>{profile.email}</span>
          </div>
        </div>
        <Descriptions column={2} colon={false} size="small">
          <Descriptions.Item label="账户状态">{profile.status || '已登录'}</Descriptions.Item>
          <Descriptions.Item label="主题外观">{themeLabel}</Descriptions.Item>
        </Descriptions>
      </AxiTableGroup>

      <AxiTableGroup title="常用设置">
        <div className="wb-me-overview__actions">
          <Button onClick={() => navigate('/admin/me/notifications')}>通知中心</Button>
          <Button onClick={() => navigate('/admin/me/theme')}>主题外观</Button>
          <Button onClick={() => navigate('/admin/me/settings')}>全部设置</Button>
        </div>
      </AxiTableGroup>
    </DesktopSettingsPage>
  );
};

export default UserList;
