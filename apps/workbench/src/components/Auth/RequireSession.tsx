import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';

export default function RequireSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { t } = useI18n();
  if (isLoading) {
    return (
      <main
        className="workbench-session-skeleton"
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
              animation: 'workbench-session-spin 0.85s linear infinite',
            }}
          />
          <span style={{ fontSize: 14, opacity: 0.7 }}>{t('requireSession.checking')}</span>
          <style>{`@keyframes workbench-session-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}
