import { useAuth } from '@axi/workbench-foundation';
import { AxiMark } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

/** 独立移动端登录页；认证策略由 Axi Identity 的 OIDC/PKCE 流程拥有。 */
export default function LoginPage() {
  const { beginLogin, isLoading, error } = useAuth();
  const { t } = useMobileI18n();

  return (
    <main className="axi-mobile-login">
      <div className="axi-mobile-login__brand"><AxiMark size={34} /><span>{t('app.name')}</span></div>
      <div className="axi-mobile-login__copy">
        <p>{t('login.eyebrow')}</p>
        <h1>{t('login.title')}</h1>
        <small>邮箱验证、密码和扫码审批由 Axi Identity 安全完成。</small>
      </div>
      <section className="axi-mobile-login__form" aria-label="Axi Identity 登录">
        {error && <p className="axi-mobile-login__error">{error}</p>}
        <button type="button" disabled={isLoading} onClick={() => beginLogin('/home')}>
          {isLoading ? t('login.loading') : '使用 Axi 账户继续'}
        </button>
      </section>
    </main>
  );
}
