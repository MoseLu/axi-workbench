import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@axi/workbench-foundation';
import { useMobileI18n } from '../i18n';

export default function RequireSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { t } = useMobileI18n();
  if (isLoading) return <main className="axi-mobile-login"><p>{t('auth.checking')}</p></main>;
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}
