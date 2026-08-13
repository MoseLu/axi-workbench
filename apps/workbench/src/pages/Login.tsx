import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCode } from 'antd';
import { AxiLogoMark } from '@axi/core';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import { OneTimeCodeInput } from '../components/OneTimeCodeInput';
import { createOneTimeCode, oneTimeCodeValue, type OneTimeCode } from '../lib/oneTimeCode';
import {
  consumeWebDeviceLoginQr,
  createWebDeviceLoginQr,
  getWebDeviceLoginQrStatus,
  webDeviceLoginQrPayload,
  type WebDeviceLoginQr,
} from '../lib/webDeviceLogin';
import './Login.css';

type Phase = 'device-qr' | 'email' | 'code' | 'verifying';

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 邮箱验证码登录入口。
 *
 * 流程：浏览器输入邮箱 → gateway 转发到 identity-adapter 生成 token
 * → dev 模式落到 identity-adapter 日志 → 浏览器粘贴 token
 * → gateway /api/v1/auth/login/email/confirm 完成校验并写入 HttpOnly session cookie
 * → 后续受保护路由通过 /api/v1/auth/session 拉取当前会话。
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    error: sessionError,
    requestEmailCode,
    confirmEmailCode,
    refreshSession,
  } = useAuth();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/admin/dashboard';

  const [phase, setPhase] = useState<Phase>('device-qr');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<OneTimeCode | string>(() => createOneTimeCode());
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [deviceQr, setDeviceQr] = useState<WebDeviceLoginQr | null>(null);
  const [deviceQrStatus, setDeviceQrStatus] = useState<'creating' | 'waiting_scan' | 'approved' | 'expired' | 'failed'>('creating');
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  // 跟踪成功提交后的导航动作，避免在 navigate 后再触发 setState。
  const didNavigateRef = useRef(false);
  const deviceQrCreatingRef = useRef(false);
  const deviceQrConsumingRef = useRef(false);

  // 已有有效会话则直接跳走。
  useEffect(() => {
    if (isAuthenticated && !didNavigateRef.current) {
      didNavigateRef.current = true;
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, navigate, next]);

  // 倒计时。
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  // 进入 code 步骤时自动聚焦输入框。
  useEffect(() => {
    if (phase === 'code') codeInputRef.current?.focus();
  }, [phase]);

  // A computer that has no session can start a QR transaction, but the QR
  // itself contains only the scanner bearer. The poll bearer remains in this
  // component's memory and is never put in the camera payload or storage.
  useEffect(() => {
    if (phase !== 'device-qr' || deviceQr || deviceQrCreatingRef.current) return;
    deviceQrCreatingRef.current = true;
    setDeviceQrStatus('creating');
    setError(null);
    void createWebDeviceLoginQr()
      .then((created) => {
        setDeviceQr(created);
        setDeviceQrStatus('waiting_scan');
      })
      .catch((cause: unknown) => {
        setDeviceQrStatus('failed');
        setError(cause instanceof Error ? cause.message : '无法生成电脑登录二维码');
      })
      .finally(() => {
        deviceQrCreatingRef.current = false;
      });
  }, [deviceQr, phase]);

  // The browser learns only the transaction state. Once the already signed-in
  // phone has scanned, the Gateway consumes the one-time approval and writes
  // the usual HttpOnly browser session cookie.
  useEffect(() => {
    if (phase !== 'device-qr' || !deviceQr || deviceQrStatus === 'expired' || deviceQrStatus === 'failed') return undefined;

    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await getWebDeviceLoginQrStatus(deviceQr);
        if (cancelled) return;
        if (status.status === 'expired' || status.status === 'consumed') {
          setDeviceQrStatus('expired');
          if (status.status === 'expired') setHint('二维码已过期，请重新生成。');
          return;
        }
        setDeviceQrStatus(status.status);
        if (status.status !== 'approved' || deviceQrConsumingRef.current) return;

        deviceQrConsumingRef.current = true;
        setSubmitting(true);
        try {
          await consumeWebDeviceLoginQr(deviceQr);
          const authenticated = await refreshSession();
          if (!authenticated) throw new Error('电脑会话未建立，请重新生成二维码。');
        } catch (cause: unknown) {
          if (!cancelled) {
            setDeviceQrStatus('failed');
            setError(cause instanceof Error ? cause.message : '手机授权后无法建立电脑会话');
          }
        } finally {
          if (!cancelled) setSubmitting(false);
        }
      } catch (cause: unknown) {
        if (!cancelled) {
          setDeviceQrStatus('failed');
          setError(cause instanceof Error ? cause.message : '无法读取电脑登录二维码状态');
        }
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 1_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [deviceQr, deviceQrStatus, phase, refreshSession]);

  const resetDeviceQr = () => {
    if (submitting) return;
    deviceQrConsumingRef.current = false;
    setDeviceQr(null);
    setDeviceQrStatus('creating');
    setError(null);
    setHint(null);
  };

  const selectEmailLogin = () => {
    setPhase('email');
    setError(null);
    setHint(null);
  };

  const handleRequestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || sessionLoading) return;
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t('auth.login.invalidEmail'));
      return;
    }
    setError(null);
    setHint(null);
    setSubmitting(true);
    try {
      const result = await requestEmailCode(trimmed);
      setSentTo(trimmed);
      setChallengeId(result.challengeId);
      setExpiresAt(result.expiresAt || null);
      setCode(createOneTimeCode());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setPhase('code');
      setHint(t('auth.login.codeSentHint'));
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('auth.login.sendFailed');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmed = oneTimeCodeValue(code);
    if (!trimmed) {
      setError(t('auth.login.codeRequired'));
      return;
    }
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t('auth.login.codeLength'));
      return;
    }
    setError(null);
    setHint(null);
    setPhase('verifying');
    setSubmitting(true);
    try {
      const ok = await confirmEmailCode(challengeId, trimmed);
      if (ok) {
        // AuthProvider refreshes the HttpOnly session and updates
        // isAuthenticated. Let the effect above navigate only after that
        // state has committed; navigating here can briefly render a protected
        // route with stale unauthenticated state and bounce back to /login.
        return;
      }
      setError(t('auth.login.codeInvalid'));
      setPhase('code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || submitting || !sentTo) return;
    setError(null);
    setHint(null);
    setSubmitting(true);
    try {
      const result = await requestEmailCode(sentTo);
      setChallengeId(result.challengeId);
      setExpiresAt(result.expiresAt || null);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode(createOneTimeCode());
      setHint(t('auth.login.resentHint'));
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('auth.login.resendFailed');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setPhase('email');
    setCode(createOneTimeCode());
    setChallengeId('');
    setError(null);
    setHint(null);
  };

  const localError = error;
  const banner = localError || (sessionError && phase === 'verifying' ? sessionError : null);
  const qrStatusLabel = {
    creating: '正在准备安全二维码',
    waiting_scan: '等待手机扫码确认',
    approved: '手机已确认，正在建立会话',
    expired: '二维码已失效，请重新生成',
    failed: '二维码暂不可用',
  }[deviceQrStatus];

  return (
    <main className="axi-login-page">
      <div className="axi-login-page__glow axi-login-page__glow--one" aria-hidden="true" />
      <div className="axi-login-page__glow axi-login-page__glow--two" aria-hidden="true" />
      <div className="axi-login-page__grid" aria-hidden="true" />

      <section className="axi-login-card" aria-labelledby="axi-login-title">
        <header className="axi-login-card__header">
          <div className="axi-login-brand">
            <span className="axi-login-brand__mark"><AxiLogoMark size={30} /></span>
            <span>
              <strong>Axi WorkBench</strong>
              <small>LOCAL WORKSPACE</small>
            </span>
          </div>
          <div className="axi-login-security"><span />安全登录</div>
        </header>

        <div className="axi-login-heading">
          <span className="axi-login-eyebrow">AXIOMATICWORLD / WORKBENCH</span>
          <h1 id="axi-login-title">登录工作台</h1>
          <p>
            {phase === 'device-qr'
              ? '用已登录的手机确认一次，即可安全进入本机工作台。'
              : phase === 'code' || phase === 'verifying'
              ? t('auth.login.subtitle.code')
              : t('auth.login.subtitle.email')}
          </p>
        </div>

        <div className="axi-login-methods" role="tablist" aria-label="登录方式">
          <button
            type="button"
            role="tab"
            aria-selected={phase === 'device-qr'}
            aria-controls="axi-login-qr-panel"
            onClick={() => {
              setPhase('device-qr');
              setError(null);
              setHint(null);
            }}
            className={phase === 'device-qr' ? 'is-active' : ''}
          >
            <span>手机扫码登录</span>
            <small>推荐</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={phase !== 'device-qr'}
            aria-controls="axi-login-email-panel"
            onClick={selectEmailLogin}
            className={phase !== 'device-qr' ? 'is-active' : ''}
          >
            邮箱验证码
          </button>
        </div>
        <div className="axi-login-card__body">
          {phase === 'device-qr' ? (
            <section className="axi-login-qr-panel" id="axi-login-qr-panel" aria-label="手机扫码登录">
              <div className="axi-login-panel-kicker">登录方式 01</div>
              <div className={`axi-login-qr-frame ${deviceQrStatus === 'failed' || deviceQrStatus === 'expired' ? 'is-error' : ''}`}>
                {deviceQr ? (
                  <QRCode
                    aria-label="电脑登录二维码"
                    value={webDeviceLoginQrPayload(deviceQr)}
                    size={224}
                    errorLevel="M"
                    status={deviceQrStatus === 'expired' || deviceQrStatus === 'failed' ? 'expired' : 'active'}
                  />
                ) : (
                  <div className="axi-login-qr-loading"><span /><span /><span /></div>
                )}
              </div>
              <div className="axi-login-qr-status">
                <span className={`axi-login-qr-status__dot is-${deviceQrStatus}`} />
                <strong>{qrStatusLabel}</strong>
              </div>
              <p className="axi-login-qr-meta">
                {deviceQr && deviceQrStatus === 'waiting_scan'
                  ? `有效期至 ${new Date(deviceQr.expiresAt * 1000).toLocaleTimeString()}`
                  : '二维码仅用于本次登录，不包含邮箱验证码。'}
              </p>
              <button className="axi-login-button axi-login-button--quiet" type="button" onClick={resetDeviceQr} disabled={submitting}>
                重新生成二维码
              </button>
            </section>
          ) : (
            <aside className="axi-login-side-note" aria-label="邮箱登录说明">
              <div className="axi-login-side-note__badge">邮箱登录</div>
              <h2>邮箱是你的<br /><em>固定登录凭证</em></h2>
              <p>首次登录或设备变更时输入验证码。验证通过后，浏览器会建立安全会话。</p>
              <div className="axi-login-side-note__rule" />
              <div className="axi-login-side-note__facts">
                <span><b>01</b> 验证邮箱归属</span>
                <span><b>02</b> 写入 HttpOnly 会话</span>
              </div>
              <button className="axi-login-text-button" type="button" onClick={() => { setPhase('device-qr'); setError(null); setHint(null); }}>
                返回手机扫码登录
              </button>
            </aside>
          )}

          <div className="axi-login-card__divider" aria-hidden="true" />

          <section className="axi-login-form-panel" id="axi-login-email-panel" aria-label="邮箱验证码登录">
            {banner && <div className="axi-login-alert" role="alert">{banner}</div>}
            {hint && !banner && <div className="axi-login-hint">{hint}</div>}

            {phase === 'device-qr' && (
              <div className="axi-login-qr-guide">
                <div className="axi-login-panel-kicker">手机授权</div>
                <h2>在手机上确认登录</h2>
                <p>请使用已登录的手机端打开“扫一扫”，扫描左侧二维码。</p>
                <ol>
                  <li><span>1</span>打开手机端工作台</li>
                  <li><span>2</span>扫描此页面上的二维码</li>
                  <li><span>3</span>在手机上确认本机登录</li>
                </ol>
                <button className="axi-login-button axi-login-button--secondary" type="button" onClick={selectEmailLogin}>
                  使用邮箱验证码登录
                </button>
              </div>
            )}

            {phase === 'email' && (
              <form className="axi-login-form" onSubmit={handleRequestCode} noValidate>
                <div className="axi-login-panel-kicker">登录方式 02</div>
                <h2>邮箱验证码登录</h2>
                <p className="axi-login-form__description">输入固定邮箱，获取一次性验证码完成登录。</p>
                <label htmlFor="axi-login-email">{t('auth.email')}</label>
                <input
                  id="axi-login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@axi.workbench.dev"
                  disabled={submitting}
                />
                <button
                  className="axi-login-button axi-login-button--primary"
                  type="submit"
                  disabled={submitting || sessionLoading || !email.trim()}
                >
                  {submitting ? t('auth.login.sending') : t('auth.login.requestCode')}
                </button>
              </form>
            )}

            {(phase === 'code' || phase === 'verifying') && (
              <form className="axi-login-form" onSubmit={handleVerifyCode} noValidate>
                <div className="axi-login-panel-kicker">邮箱验证码</div>
                <h2>输入邮箱中的验证码</h2>
                <div className="axi-login-form__row">
                  <span id="axi-login-code-label">{t('auth.login.sentTo')} <strong>{sentTo}</strong></span>
                  <button className="axi-login-text-button" type="button" onClick={handleChangeEmail}>{t('auth.login.changeEmail')}</button>
                </div>
                <OneTimeCodeInput
                  ariaLabelledBy="axi-login-code-label"
                  disabled={submitting}
                  firstInputRef={codeInputRef}
                  value={code}
                  onChange={setCode}
                />
                <div className="axi-login-form__row axi-login-form__row--muted">
                  <span>{expiresAt ? `${t('auth.login.expiresPrefix')}${new Date(expiresAt).toLocaleString()}${t('auth.login.expiresSuffix')}` : '验证码有效期有限'}</span>
                  <button className="axi-login-text-button" type="button" onClick={handleResend} disabled={cooldown > 0 || submitting}>
                    {cooldown > 0 ? `${cooldown}${t('auth.login.resendCooldown')}` : t('auth.login.resend')}
                  </button>
                </div>
                <button className="axi-login-button axi-login-button--primary" type="submit" disabled={submitting || oneTimeCodeValue(code).length !== 6}>
                  {phase === 'verifying' || submitting ? t('auth.login.verifying') : t('auth.signin')}
                </button>
              </form>
            )}
          </section>
        </div>

        <footer className="axi-login-card__footer">
          <span><i />本机 Web 登录</span>
          <span>安全会话由网关托管</span>
        </footer>
      </section>

      <p className="axi-login-page__footer">Axi WorkBench · 本地开发工作台</p>
    </main>
  );
};

export default Login;
