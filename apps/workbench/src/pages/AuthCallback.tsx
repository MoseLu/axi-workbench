import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { t } = useI18n();
  const [message, setMessage] = useState(t('auth.callback.establishing'));

  useEffect(() => {
    let active = true;
    void refreshSession().then((authenticated) => {
      if (!active) return;
      const stored = window.sessionStorage.getItem('axi.auth.return-to');
      window.sessionStorage.removeItem('axi.auth.return-to');
      const destination = stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : '/admin/dashboard';
      if (authenticated) {
        navigate(destination, { replace: true });
      } else {
        setMessage(t('auth.callback.failed'));
        window.setTimeout(() => navigate('/login', { replace: true }), 700);
      }
    });
    return () => { active = false; };
  }, [navigate, refreshSession, t]);

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>{message}</main>;
}
