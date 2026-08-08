import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MeGroup, MeNavRow, MeSubPage } from './MeSubChrome';

const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MeSubPage title="设置">
      <MeGroup>
        <MeNavRow label="账号信息" onClick={() => navigate('/admin/me/account')} />
        <MeNavRow label="通知中心" onClick={() => navigate('/admin/me/notifications')} />
        <MeNavRow label="主题外观" onClick={() => navigate('/admin/me/theme')} />
      </MeGroup>
    </MeSubPage>
  );
};

export default Settings;
