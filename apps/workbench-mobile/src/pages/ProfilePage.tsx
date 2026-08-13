import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxiTheme } from '@axi/core';
import { useAuth } from '@axi/workbench-foundation';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';
import { clearMobileDeviceSession, confirmMobileDevicePairing, startMobileDevicePairing, useMobileDeviceSession } from '../lib/mobileControl';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useAxiTheme();
  const { locale, setLocale, t } = useMobileI18n();
  const signedIn = Boolean(user);
  const deviceSession = useMobileDeviceSession();
  const [pairingStarted, setPairingStarted] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingMessage, setPairingMessage] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);

  const beginPairing = async () => {
    setPairingBusy(true); setPairingMessage('');
    try {
      await startMobileDevicePairing();
      setPairingStarted(true);
      setPairingMessage('已请求配对，请输入受控渠道收到的 6 位确认码。');
    } catch { setPairingMessage('无法启动配对：控制面不可用或当前环境未启用设备配对。'); }
    finally { setPairingBusy(false); }
  };
  const finishPairing = async () => {
    setPairingBusy(true); setPairingMessage('');
    try {
      const session = await confirmMobileDevicePairing(pairingCode);
      setPairingStarted(false); setPairingCode(''); setPairingMessage(`设备已配对，短期会话将在 ${new Date(session.expiresAt * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 失效。`);
    } catch { setPairingMessage('配对失败：确认码无效、已过期或设备已被撤销。'); }
    finally { setPairingBusy(false); }
  };

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
      <div className="axi-mobile-setting-group axi-mobile-device-pairing">
        <p>设备配对</p>
        {deviceSession ? <><div className="axi-mobile-device-pairing__status"><strong>此设备已配对</strong><small>{deviceSession.deviceId}</small></div><button type="button" className="axi-mobile-setting-row" onClick={() => { void clearMobileDeviceSession(); }}><span>清除本机设备配对</span><MobileIcon name="arrow-right" size={16} /></button></> : <>
          <div className="axi-mobile-device-pairing__status"><strong>未配对</strong><small>访问工作区和审批前需要短期设备会话。</small></div>
          {!pairingStarted ? <button type="button" className="axi-mobile-setting-row" disabled={pairingBusy} onClick={() => void beginPairing()}><span>{pairingBusy ? '正在请求配对…' : '开始设备配对'}</span><MobileIcon name="arrow-right" size={16} /></button> : <div className="axi-mobile-device-pairing__confirm"><input value={pairingCode} inputMode="numeric" maxLength={6} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ''))} placeholder="6 位确认码" /><button type="button" disabled={pairingBusy || pairingCode.length !== 6} onClick={() => void finishPairing()}>{pairingBusy ? '正在确认…' : '确认配对'}</button></div>}
        </>}
        {pairingMessage ? <p className="axi-mobile-device-pairing__message" role="status">{pairingMessage}</p> : null}
      </div>
      {signedIn ? <button type="button" className="axi-mobile-web-login-link" onClick={() => navigate('/login/confirm-web')}>确认网页登录</button> : null}
      {signedIn ? (
        <button type="button" className="axi-mobile-signout" onClick={() => { void clearMobileDeviceSession(); void logout(); navigate('/login'); }}><MobileIcon name="logout" size={19} />{t('profile.logout')}</button>
      ) : (
        <button type="button" className="axi-mobile-signout" onClick={() => navigate('/login')}>{t('profile.signIn')}</button>
      )}
    </section>
  );
}
