import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [message, setMessage] = useState('正在建立安全会话…');

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
        setMessage('未能建立会话，正在返回登录页…');
        window.setTimeout(() => navigate('/login', { replace: true }), 700);
      }
    });
    return () => { active = false; };
  }, [navigate, refreshSession]);

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>{message}</main>;
}
