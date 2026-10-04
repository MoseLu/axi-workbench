import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { t } = useI18n();
  const [message, setMessage] = useState(t('auth.callback.establishing'));
  const [failed, setFailed] = useState(false);

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
        setFailed(true);
        setMessage(t('auth.callback.failed'));
      }
    });
    return () => { active = false; };
  }, [navigate, refreshSession, t]);

  if (failed) {
    return (
      <main
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 20,
          background: 'linear-gradient(135deg, var(--color-tabbar-dark) 0%, var(--color-login-bg) 100%)',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 32,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 22, color: 'var(--color-bg-card)' }}>{message}</h1>
          <p style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)' }}>
            授权未在限定时间内完成，请重试或返回登录重新发起流程。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--color-bg-card)',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-info-antd, #1677ff)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              返回登录
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.18)',
            borderTopColor: 'rgba(255,255,255,0.85)',
            animation: 'workbench-auth-callback-spin 0.85s linear infinite',
          }}
        />
        <span style={{ fontSize: 14, opacity: 0.7 }}>{message}</span>
        <style>{`@keyframes workbench-auth-callback-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
