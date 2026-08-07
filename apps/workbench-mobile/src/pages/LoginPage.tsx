import { useAuth } from '@axi/workbench-foundation';
import { useLocation } from 'react-router-dom';
import { AxiLogoMark } from '@axi/core';
import { useMobileI18n } from '../i18n';

/** 独立移动端登录页；认证策略由 Axi Identity 的 OIDC/PKCE 流程拥有。 */
export default function LoginPage() {
  const { beginLogin, isLoading, error } = useAuth();
  const location = useLocation();
  const { t } = useMobileI18n();
  const requestedDestination = new URLSearchParams(location.search).get('next');
  const destination = requestedDestination && requestedDestination.startsWith('/') && !requestedDestination.startsWith('//')
    ? requestedDestination
    : '/home';

  return (
    <main className="axi-mobile-login">
      <div className="axi-mobile-login__brand"><AxiLogoMark size={34} /><span>{t('app.name')}</span></div>
      <div className="axi-mobile-login__copy">
        <p>{t('login.eyebrow')}</p>
        <h1>{t('login.title')}</h1>
        <small>{t('login.hint')}</small>
      </div>
      <section className="axi-mobile-login__form" aria-label="Axi Identity 登录">
        {error && <p className="axi-mobile-login__error">{error}</p>}
        <button type="button" disabled={isLoading} onClick={() => beginLogin(destination)}>
          {isLoading ? t('login.loading') : t('login.emailCode')}
        </button>
      </section>
    </main>
  );
}
