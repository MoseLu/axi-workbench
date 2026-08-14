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
      <section className="axi-mobile-profile__hero" aria-label={t('profile.account')}>
        <div className="axi-mobile-profile__cover" aria-hidden="true">
          <span className="axi-mobile-profile__eyebrow">AXI WORKBENCH · MOBILE</span>
          <span className="axi-mobile-profile__cover-mark"><i /><i /><i /><i /></span>
          <span className="axi-mobile-profile__cover-orbit axi-mobile-profile__cover-orbit--one" />
          <span className="axi-mobile-profile__cover-orbit axi-mobile-profile__cover-orbit--two" />
        </div>
        <div className="axi-mobile-profile-card">
          <span className="axi-mobile-profile-card__avatar">{(user?.name || 'A').slice(0, 1).toUpperCase()}<i /></span>
          <span className="axi-mobile-profile-card__identity"><strong>{user?.name || t('profile.guest')}</strong><small>{user?.email || t('profile.account')}</small><em><i />已登录 · 本机工作台</em></span>
          <MobileIcon name="arrow-right" size={19} />
        </div>
        <div className="axi-mobile-profile__hero-meta">
          <span><small>当前身份</small><strong>受保护会话</strong></span>
          <span><small>安全等级</small><strong className="is-positive">已验证</strong></span>
        </div>
      </section>
      <section className="axi-mobile-profile__quick-section" aria-labelledby="mobile-profile-quick-title">
        <div className="axi-mobile-profile__section-heading">
          <span><small>QUICK ACCESS</small><strong id="mobile-profile-quick-title">快捷设置</strong></span>
          <em>轻触即可切换</em>
        </div>
        <div className="axi-mobile-profile__preference-actions">
          <button type="button" className="axi-mobile-profile__preference-action" onClick={() => toggleMode()}>
            <span className="axi-mobile-profile__preference-icon"><MobileIcon name={mode === 'dark' ? 'moon' : 'sun'} size={19} /></span>
            <span><small>{t('profile.theme')}</small><strong>{mode === 'dark' ? t('profile.theme.dark') : t('profile.theme.light')}</strong><em>界面外观</em></span>
            <MobileIcon name="arrow-right" size={15} />
          </button>
          <button type="button" className="axi-mobile-profile__preference-action" onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
            <span className="axi-mobile-profile__preference-icon"><MobileIcon name="language" size={19} /></span>
            <span><small>{t('profile.language')}</small><strong>{locale === 'zh-CN' ? '简体中文' : 'English'}</strong><em>内容语言</em></span>
            <MobileIcon name="arrow-right" size={15} />
          </button>
        </div>
      </section>
      <section className="axi-mobile-setting-group axi-mobile-device-pairing" aria-labelledby="mobile-profile-security-title">
        <div className="axi-mobile-setting-group__heading"><span><small>DEVICE TRUST</small><strong id="mobile-profile-security-title">设备安全</strong></span><span className={`axi-mobile-security-pill${deviceSession ? ' is-ready' : ''}`}><i />{deviceSession ? '已配对' : '待配对'}</span></div>
        {deviceSession ? <><div className="axi-mobile-device-pairing__status"><strong>此设备已配对</strong><small>{deviceSession.deviceId}</small></div><button type="button" className="axi-mobile-setting-row" onClick={() => { void clearMobileDeviceSession(); }}><span>清除本机设备配对</span><MobileIcon name="arrow-right" size={16} /></button></> : <>
          <div className="axi-mobile-device-pairing__status"><strong>为本机建立受控会话</strong><small>访问工作区、审批和项目动作前，需要先完成一次设备配对。</small></div>
          {!pairingStarted ? <button type="button" className="axi-mobile-setting-row axi-mobile-setting-row--primary" disabled={pairingBusy} onClick={() => void beginPairing()}><span>{pairingBusy ? '正在请求配对…' : '开始设备配对'}</span><MobileIcon name="arrow-right" size={16} /></button> : <div className="axi-mobile-device-pairing__confirm"><input value={pairingCode} inputMode="numeric" maxLength={6} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ''))} placeholder="6 位确认码" /><button type="button" disabled={pairingBusy || pairingCode.length !== 6} onClick={() => void finishPairing()}>{pairingBusy ? '正在确认…' : '确认配对'}</button></div>}
        </>}
        {pairingMessage ? <p className="axi-mobile-device-pairing__message" role="status">{pairingMessage}</p> : null}
      </section>
      {signedIn ? (
        <button type="button" className="axi-mobile-signout" onClick={() => { void clearMobileDeviceSession(); void logout(); navigate('/login'); }}><MobileIcon name="logout" size={19} />{t('profile.logout')}</button>
      ) : (
        <button type="button" className="axi-mobile-signout" onClick={() => navigate('/login')}>{t('profile.signIn')}</button>
      )}
    </section>
  );
}
