import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@axi/workbench-foundation';
import { useMobileI18n } from '../i18n';

// 移动端保持自己的回调呈现与路由，不复用 Web 管理端页面。
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { t } = useMobileI18n();
  const [message, setMessage] = useState(t('auth.callback.loading'));

  useEffect(() => {
    let active = true;
    void refreshSession().then((authenticated) => {
      if (!active) return;
      const stored = window.sessionStorage.getItem('axi.auth.return-to');
      window.sessionStorage.removeItem('axi.auth.return-to');
      const destination = stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : '/home';
      if (authenticated) {
        navigate(destination, { replace: true });
      } else {
        setMessage(t('auth.callback.failed'));
        window.setTimeout(() => navigate('/login', { replace: true }), 700);
      }
    });
    return () => { active = false; };
  }, [navigate, refreshSession, t]);

  return <main className="axi-mobile-login"><p>{message}</p></main>;
}
