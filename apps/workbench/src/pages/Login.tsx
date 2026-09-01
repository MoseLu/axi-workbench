import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCode } from 'antd';
import { AxiBanner } from '@axi/widgets';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import scanPromptImage from '../assets/login/scan-prompt.png';
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

type Phase = 'email' | 'code' | 'verifying';
type LoginMode = 'password' | 'email';
type DeviceQrStatus = 'creating' | 'waiting_scan' | 'approved' | 'expired' | 'failed';
type PasswordLoginResponse = { authenticated: boolean };
type AuthMethodsResponse = { passwordLogin?: boolean };

const RESEND_COOLDOWN_SECONDS = 60;
const QR_POLL_INTERVAL_MS = 3_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Web 登录入口。
 *
 * 视觉结构固定为客户端常见的双栏登录面板：左侧始终显示扫码登录，
 * 右侧承载邮箱验证码流程。扫码和邮箱是两条并行的真实登录路径，
 * 不再通过顶部标签互相替换整个面板。
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

  // 左侧二维码固定存在；登录方式和 phase 只描述右侧登录流程。
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [passwordLoginEnabled, setPasswordLoginEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState<OneTimeCode | string>(() => createOneTimeCode());
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [qrSubmitting, setQrSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [deviceQr, setDeviceQr] = useState<WebDeviceLoginQr | null>(null);
  const [deviceQrStatus, setDeviceQrStatus] = useState<DeviceQrStatus>('creating');
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const didNavigateRef = useRef(false);
  const deviceQrCreatingRef = useRef(false);
  const deviceQrConsumingRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !didNavigateRef.current) {
      didNavigateRef.current = true;
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, navigate, next]);

  // Capability discovery stays local to the Web login surface. Mobile keeps
  // its existing shared AuthProvider contract and does not gain a new request.
  useEffect(() => {
    let cancelled = false;
    void fetch(resolveGatewayURL('/api/v1/auth/methods'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('登录方式不可用');
        return (await response.json().catch(() => ({}))) as AuthMethodsResponse;
      })
      .then((methods) => {
        if (!cancelled) setPasswordLoginEnabled(methods.passwordLogin === true);
      })
      .catch(() => {
        if (!cancelled) setPasswordLoginEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (phase === 'code') codeInputRef.current?.focus();
  }, [phase]);

  // 二维码始终在左侧启动；其轮询凭证只留在内存中。
  useEffect(() => {
    if (deviceQr || deviceQrCreatingRef.current) return undefined;
    if (deviceQrStatus === 'failed') {
      const retryTimer = window.setTimeout(() => {
        setDeviceQrStatus('creating');
        setQrError(null);
      }, 2_500);
      return () => window.clearTimeout(retryTimer);
    }
    deviceQrCreatingRef.current = true;
    setDeviceQrStatus('creating');
    setQrError(null);
    void createWebDeviceLoginQr()
      .then((created) => {
        setDeviceQr(created);
        setDeviceQrStatus('waiting_scan');
      })
      .catch((cause: unknown) => {
        setDeviceQrStatus('failed');
        setQrError(cause instanceof Error ? cause.message : '无法生成电脑登录二维码');
      })
      .finally(() => {
        deviceQrCreatingRef.current = false;
      });
    return undefined;
  }, [deviceQr, deviceQrStatus]);

  useEffect(() => {
    if (!deviceQr || deviceQrStatus === 'expired' || deviceQrStatus === 'failed') return undefined;

    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await getWebDeviceLoginQrStatus(deviceQr);
        if (cancelled) return;
        if (status.status === 'expired' || status.status === 'consumed') {
          setDeviceQrStatus('expired');
          if (status.status === 'expired') setQrError('二维码已过期，正在自动更新。');
          return;
        }
        setDeviceQrStatus(status.status);
        if (status.status !== 'approved' || deviceQrConsumingRef.current) return;

        deviceQrConsumingRef.current = true;
        setQrSubmitting(true);
        try {
          await consumeWebDeviceLoginQr(deviceQr);
          const authenticated = await refreshSession();
          if (!authenticated) throw new Error('电脑会话未建立，正在自动更新二维码。');
        } catch (cause: unknown) {
          if (!cancelled) {
            setDeviceQrStatus('failed');
            setQrError(cause instanceof Error ? cause.message : '手机授权后无法建立电脑会话');
          }
        } finally {
          if (!cancelled) setQrSubmitting(false);
        }
      } catch (cause: unknown) {
        if (!cancelled) {
          setDeviceQrStatus('failed');
          setQrError(cause instanceof Error ? cause.message : '无法读取电脑登录二维码状态');
        }
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), QR_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [deviceQr, deviceQrStatus, refreshSession]);

  // 服务异常自动重试；二维码明确过期时保留蒙层，交给用户点击刷新。
  useEffect(() => {
    if (!deviceQr || !['expired', 'failed'].includes(deviceQrStatus) || qrSubmitting) return undefined;
    if (deviceQrStatus === 'expired') return undefined;
    const refreshTimer = window.setTimeout(() => {
      deviceQrConsumingRef.current = false;
      setDeviceQr(null);
      setDeviceQrStatus('creating');
      setQrError(null);
    }, 2_500);
    return () => window.clearTimeout(refreshTimer);
  }, [deviceQr, deviceQrStatus, qrSubmitting]);

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

  const loginWithPassword = async (loginEmail: string, loginPassword: string): Promise<boolean> => {
    const response = await fetch(resolveGatewayURL('/api/v1/auth/login/password'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    const payload = (await response.json().catch(() => ({}))) as PasswordLoginResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || `密码登录失败 (HTTP ${response.status})`);
    }
    if (payload.authenticated !== true) throw new Error('密码登录未建立会话');
    const authenticated = await refreshSession();
    if (!authenticated) throw new Error('会话未建立，请重试密码登录');
    return authenticated;
  };

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordSubmitting || sessionLoading) return;
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t('auth.login.invalidEmail'));
      return;
    }
    if (!password) {
      setError('请输入登录密码');
      return;
    }
    setError(null);
    setHint(null);
    setPasswordSubmitting(true);
    try {
      const ok = await loginWithPassword(trimmed, password);
      if (!ok) setError('密码登录失败，请检查邮箱和密码。');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '密码登录失败，请检查邮箱和密码。');
    } finally {
      setPasswordSubmitting(false);
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
      if (ok) return;
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

  const banner = error || (sessionError && (phase === 'verifying' || loginMode === 'password') ? sessionError : null);
  const qrOverlayTitle = deviceQrStatus === 'expired' ? '二维码已过期' : '二维码加载失败';
  const qrOverlayHint = deviceQrStatus === 'expired' ? '请点击刷新' : '请点击重试';

  return (
    <main className="axi-login-page">
      <div className="axi-login-page__grid" aria-hidden="true" />

      <section className="axi-login-card" aria-labelledby="axi-login-title">
        <div className="axi-login-card__chrome" aria-hidden="true">
          <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--close" />
          <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--minimize" />
          <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--maximize" />
        </div>
        <div className="axi-login-card__body">
          <section className="axi-login-qr-column" id="axi-login-qr-panel" aria-label="扫码登录">
            <h1 id="axi-login-title">扫描二维码登录</h1>
            <div
              className="axi-login-qr-hover"
              title="请使用 Axi WorkBench 手机端扫描二维码登录"
              aria-label="使用 Axi WorkBench 手机端扫描二维码登录"
              role="img"
              tabIndex={0}
            >
              <div className={`axi-login-qr-frame ${deviceQrStatus === 'failed' || deviceQrStatus === 'expired' ? 'is-error' : ''}`}>
                {deviceQr ? (
                  <QRCode
                    aria-label="电脑登录二维码"
                    value={webDeviceLoginQrPayload(deviceQr)}
                    size={176}
                    color="#111827"
                    bgColor="#ffffff"
                    errorLevel="M"
                    status="active"
                  />
                ) : (
                  <div className="axi-login-qr-loading"><span /><span /><span /></div>
                )}
                {(deviceQrStatus === 'expired' || deviceQrStatus === 'failed') && deviceQr && (
                  <button
                    type="button"
                    className="axi-login-qr-expired-overlay"
                    aria-label={`${qrOverlayTitle}，${qrOverlayHint}`}
                    onClick={() => {
                      deviceQrConsumingRef.current = false;
                      setDeviceQr(null);
                      setDeviceQrStatus('creating');
                      setQrError(null);
                    }}
                  >
                    <span className="axi-login-qr-expired-overlay__icon" />
                    <span className="axi-login-qr-expired-overlay__title">{qrOverlayTitle}</span>
                    <span className="axi-login-qr-expired-overlay__hint">{qrOverlayHint}</span>
                  </button>
                )}
              </div>
              <span className="axi-login-qr-tooltip" role="tooltip">
                <img src={scanPromptImage} alt="" aria-hidden="true" />
                <span className="axi-login-qr-tooltip__label">在手机端「我的」点击右上角扫一扫</span>
              </span>
            </div>
            <p className="axi-login-qr-instruction">
              请使用 <strong>Axi WorkBench 手机端</strong><br />
              扫码登录或确认本机登录
            </p>
            {qrError && deviceQrStatus === 'failed' && (
              <AxiBanner tone="danger" role="alert" className="axi-login-banner axi-login-banner--qr" aria-label="电脑登录二维码错误">
                {qrError}
              </AxiBanner>
            )}
          </section>

          <div className="axi-login-card__divider" aria-hidden="true" />

          <section className="axi-login-right" id="axi-login-email-panel" aria-label="登录方式">
            <div className="axi-login-right__tabs" role="tablist" aria-label="登录方式">
              <button
                type="button"
                role="tab"
                aria-selected={loginMode === 'password'}
                aria-disabled={!passwordLoginEnabled}
                disabled={!passwordLoginEnabled}
                title={passwordLoginEnabled ? '使用邮箱和密码登录' : '当前环境尚未配置密码登录'}
                className={`${loginMode === 'password' ? 'is-active' : ''} ${!passwordLoginEnabled ? 'is-disabled' : ''}`}
                onClick={() => {
                  setLoginMode('password');
                  setError(null);
                  setHint(null);
                }}
              >
                密码登录
              </button>
              <span aria-hidden="true">|</span>
              <button
                type="button"
                role="tab"
                aria-selected={loginMode === 'email'}
                className={loginMode === 'email' ? 'is-active' : ''}
                onClick={() => {
                  setLoginMode('email');
                  setError(null);
                  setHint(null);
                }}
              >
                邮箱登录
              </button>
            </div>

            <div className={`axi-login-right__body${banner || hint ? ' has-banner' : ''}`}>
              <div className="axi-login-banner-slot" aria-live="polite">
                {banner && <AxiBanner tone="danger" role="alert" className="axi-login-banner axi-login-banner--error">{banner}</AxiBanner>}
                {!banner && hint && <AxiBanner tone="brand" className="axi-login-banner axi-login-banner--hint">{hint}</AxiBanner>}
              </div>
              <div className="axi-login-form-slot">
                {loginMode === 'password' && (
                <form className="axi-login-form" onSubmit={handlePasswordLogin} noValidate>
                  <label htmlFor="axi-login-password-email">{t('auth.email')}</label>
                  <input
                    id="axi-login-password-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@axi.workbench.dev"
                    disabled={passwordSubmitting}
                  />
                  <label htmlFor="axi-login-password">密码</label>
                  <input
                    id="axi-login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入密码"
                    disabled={passwordSubmitting}
                  />
                  <button
                    className="axi-login-button axi-login-button--primary"
                    type="submit"
                    disabled={passwordSubmitting || sessionLoading || !email.trim() || !password}
                  >
                    {passwordSubmitting ? '登录中…' : '登录'}
                  </button>
                </form>
              )}

              {loginMode === 'email' && phase === 'email' && (
                <form className="axi-login-form" onSubmit={handleRequestCode} noValidate>
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

              {loginMode === 'email' && (phase === 'code' || phase === 'verifying') && (
                <form className="axi-login-form" onSubmit={handleVerifyCode} noValidate>
                  <h2>输入邮箱验证码</h2>
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
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
};

export default Login;
