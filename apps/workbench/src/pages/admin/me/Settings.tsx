import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeGroup, MeHint, MeNavRow, MeSubPage } from './MeSubChrome';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [cache, setCache] = useState('128 MB');

  return (
    <MeSubPage title="设置">
      <MeHint>通用</MeHint>
      <MeGroup>
        <MeNavRow label="语言" value="简体中文" onClick={() => undefined} />
        <MeNavRow label="清除缓存" value={cache} onClick={() => setCache('0 MB')} />
        <MeNavRow label="存储空间" value="8.2 GB / 50 GB" onClick={() => undefined} />
      </MeGroup>
      <MeHint>安全</MeHint>
      <MeGroup>
        <MeNavRow label="修改密码" onClick={() => undefined} />
        <MeNavRow label="自动锁定" value="5 分钟" onClick={() => undefined} />
        <MeNavRow label="二次验证" value="未开启" onClick={() => undefined} />
      </MeGroup>
      <MeHint>关于</MeHint>
      <MeGroup>
        <MeNavRow label="当前版本" value="1.0.0" chevron={false} />
        <MeNavRow label="用户协议" onClick={() => undefined} />
        <MeNavRow label="隐私政策" onClick={() => undefined} />
        <MeNavRow label="开源许可" onClick={() => undefined} />
      </MeGroup>
      <button
        type="button"
        className="wb-me-sub__logout"
        onClick={() => {
          if (window.confirm('确定要退出登录吗？')) navigate('/login');
        }}
      >
        退出登录
      </button>
    </MeSubPage>
  );
};

export default Settings;
