import { useNavigate } from 'react-router-dom';
import { useAxiTheme } from '@axi/core';
import { useAuth } from '@axi/workbench-foundation';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useAxiTheme();
  const { locale, setLocale, t } = useMobileI18n();
  const signedIn = Boolean(user);

  return (
    <section className="axi-mobile-page axi-mobile-profile">
      <div className="axi-mobile-profile-card">
        <span className="axi-mobile-profile-card__avatar">{(user?.name || 'A').slice(0, 1).toUpperCase()}</span>
        <span className="axi-mobile-profile-card__identity"><strong>{user?.name || t('profile.guest')}</strong><small>{user?.email || t('profile.account')}</small></span>
        <MobileIcon name="arrow-right" size={18} />
      </div>
      <div className="axi-mobile-setting-group">
        <p>{t('profile.account')}</p>
        <button type="button" className="axi-mobile-setting-row" onClick={() => toggleMode()}>
          <span className="axi-mobile-setting-row__icon"><MobileIcon name={mode === 'dark' ? 'moon' : 'sun'} size={19} /></span>
          <span>{t('profile.theme')}</span>
          <em>{mode === 'dark' ? t('profile.theme.dark') : t('profile.theme.light')}</em>
          <MobileIcon name="arrow-right" size={16} />
        </button>
        <button type="button" className="axi-mobile-setting-row" onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
          <span className="axi-mobile-setting-row__icon"><MobileIcon name="language" size={19} /></span>
          <span>{t('profile.language')}</span>
          <em>{locale === 'zh-CN' ? '简体中文' : 'English'}</em>
          <MobileIcon name="arrow-right" size={16} />
        </button>
      </div>
      {signedIn ? (
        <button type="button" className="axi-mobile-signout" onClick={() => { logout(); navigate('/login'); }}><MobileIcon name="logout" size={19} />{t('profile.logout')}</button>
      ) : (
        <button type="button" className="axi-mobile-signout" onClick={() => navigate('/login')}>{t('profile.signIn')}</button>
      )}
    </section>
  );
}
