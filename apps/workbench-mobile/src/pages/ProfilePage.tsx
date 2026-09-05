import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxiTheme } from '@axi/core';
import { useAuth } from '@axi/workbench-foundation';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';
import { clearMobileDeviceSession, useMobileDeviceSession } from '../lib/mobileControl';

type ProfilePanel = 'devices' | 'settings' | null;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, preference, setPreference } = useAxiTheme();
  const { locale, setLocale, t } = useMobileI18n();
  const deviceSession = useMobileDeviceSession();
  const [panel, setPanel] = useState<ProfilePanel>(null);

  const signedIn = Boolean(user);
  const displayName = user?.name?.trim() || '未登录';
  const email = user?.email?.trim() || '未绑定邮箱';
  const themeLabel = preference === 'system' ? '跟随系统' : mode === 'dark' ? t('profile.theme.dark') : t('profile.theme.light');

  const closePanel = () => {
    setPanel(null);
  };

  const signOut = () => {
    void clearMobileDeviceSession();
    void logout();
    navigate('/login');
  };

  return (
    <section className="axi-mobile-page axi-mobile-profile">
      <button
        type="button"
        className="axi-mobile-profile-account"
        onClick={() => { if (!signedIn) navigate('/login'); }}
        aria-label={signedIn ? '账户状态' : '登录'}
      >
        <span className="axi-mobile-profile-account__avatar" aria-hidden="true"><MobileIcon name="profile" size={25} /></span>
        <span className="axi-mobile-profile-account__identity">
          <strong>{displayName}</strong>
          <small>{email}</small>
        </span>
        <span className={`axi-mobile-profile-account__status${signedIn ? ' is-signed-in' : ''}`}>{signedIn ? '已登录' : '未登录'}</span>
        <MobileIcon name="arrow-right" size={17} />
      </button>

      <div className="axi-mobile-setting-group axi-mobile-setting-group--plain">
        <button type="button" className="axi-mobile-setting-row" onClick={() => setPanel('devices')}>
          <span className="axi-mobile-setting-row__icon"><MobileIcon name="workspace" size={19} /></span>
          <span>设备管理</span>
          <MobileIcon name="arrow-right" size={16} />
        </button>
        <button type="button" className="axi-mobile-setting-row" onClick={() => navigate('/inbox')}>
          <span className="axi-mobile-setting-row__icon"><MobileIcon name="bell" size={19} /></span>
          <span>通知设置</span>
          <MobileIcon name="arrow-right" size={16} />
        </button>
      </div>

      <div className="axi-mobile-setting-group axi-mobile-setting-group--plain">
        <button
          type="button"
          className="axi-mobile-setting-row"
          onClick={() => setPreference(preference === 'system' ? (mode === 'light' ? 'dark' : 'light') : 'system')}
        >
          <span className="axi-mobile-setting-row__icon"><MobileIcon name="sun" size={19} /></span>
          <span>主题外观</span>
          <em>{themeLabel}</em>
          <MobileIcon name="arrow-right" size={16} />
        </button>
        <button type="button" className="axi-mobile-setting-row" onClick={() => setPanel('settings')}>
          <span className="axi-mobile-setting-row__icon"><MobileIcon name="language" size={19} /></span>
          <span>设置</span>
          <MobileIcon name="arrow-right" size={16} />
        </button>
      </div>

      {panel ? (
        <div className="axi-mobile-profile-modal" role="presentation" onClick={closePanel}>
          <section className="axi-mobile-profile-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-profile-panel-title" onClick={(event) => event.stopPropagation()}>
            <header className="axi-mobile-profile-modal__header">
              <h2 id="mobile-profile-panel-title">{panel === 'devices' ? '设备管理' : '设置'}</h2>
              <button type="button" onClick={closePanel} aria-label="关闭"><MobileIcon name="back" size={18} /></button>
            </header>

            {panel === 'devices' ? (
              <div className="axi-mobile-profile-modal__body">
                <div className="axi-mobile-device-status">
                  <span className={`axi-mobile-device-status__dot${deviceSession ? ' is-connected' : ''}`} aria-hidden="true" />
                  <span><strong>{deviceSession ? '本机已配对' : '本机尚未配对'}</strong><small>{deviceSession ? deviceSession.deviceId : '配对后才能读取工作区和处理待办。'}</small></span>
                </div>
                {deviceSession ? (
                  <button type="button" className="axi-mobile-profile-modal__danger" onClick={() => { void clearMobileDeviceSession(); }}>解除本机配对</button>
                ) : (
                  <button type="button" className="axi-mobile-profile-modal__primary" onClick={() => { closePanel(); navigate('/scan/pair'); }}>扫描配对二维码</button>
                )}
              </div>
            ) : (
              <div className="axi-mobile-profile-modal__body">
                <button type="button" className="axi-mobile-setting-row" onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
                  <span>语言</span>
                  <em>{locale === 'zh-CN' ? '简体中文' : 'English'}</em>
                  <MobileIcon name="arrow-right" size={16} />
                </button>
                {signedIn ? <button type="button" className="axi-mobile-profile-modal__danger" onClick={signOut}><MobileIcon name="logout" size={18} />退出登录</button> : <button type="button" className="axi-mobile-profile-modal__primary" onClick={() => { closePanel(); navigate('/login'); }}>登录账号</button>}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
