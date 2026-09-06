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
  EMAIL_LOCAL_PART_MAX_LENGTH,
  EMAIL_LOCAL_PART_PATTERN,
  isValidEmailLocalPart,
  normalizeEmailLocalPart,
} from '../lib/emailValidation';
import {
  consumeWebDeviceLoginQr,
  createWebDeviceLoginQr,
  getWebDeviceLoginQrStatus,
  webDeviceLoginQrPayload,
  type WebDeviceLoginQr,
} from '../lib/webDeviceLogin';
import { emitShellLoginSuccess, isTauriShell } from '../lib/shell';
import './Login.css';

const TAURI_BODY_CLASS = 'axi-tauri-shell';

type Phase = 'email' | 'code' | 'verifying';
type LoginMode = 'password' | 'email';
type DeviceQrStatus = 'creating' | 'waiting_scan' | 'approved' | 'expired' | 'failed';
type PasswordLoginResponse = { authenticated: boolean };
type AuthMethodsResponse = { passwordLogin?: boolean };

const RESEND_COOLDOWN_SECONDS = 60;
const QR_POLL_INTERVAL_MS = 3_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_SUFFIX_OPTIONS = [
  'qq.com',
  '163.com',
  'gmail.com',
  'outlook.com',
] as const;
type EmailSuffix = (typeof EMAIL_SUFFIX_OPTIONS)[number];
const DEFAULT_EMAIL_SUFFIX: EmailSuffix = 'qq.com';
const OTP_PATTERN = /^\d{6}$/;

function EmailSuffixSelect({
  id,
  value,
  disabled,
  label,
  onChange,
}: {
  id: string;
  value: EmailSuffix;
  disabled?: boolean;
  label: string;
  onChange: (value: EmailSuffix) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = `${id}-list`;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`axi-login-email-suffix-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        id={id}
        className="axi-login-email-suffix"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-value={value}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="axi-login-email-suffix-value">@{value}</span>
        <svg className="axi-login-email-suffix-chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.4 4.2 L6 8 L9.6 4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul id={listId} className="axi-login-email-suffix-menu" role="listbox" aria-label={label}>
          {EMAIL_SUFFIX_OPTIONS.map((suffix) => (
            <li
              key={suffix}
              role="option"
              aria-selected={suffix === value}
              className={`axi-login-email-suffix-option${suffix === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(suffix);
                setOpen(false);
              }}
            >
              @{suffix}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Web 登录入口。
 *
 * 视觉结构固定为客户端常见的双栏登录面板：左侧始终显示扫码登录，
 * 右侧承载密码和邮箱验证码流程。扫码和右侧登录方式是并行的
 * 真实登录路径，不再通过顶部标签互相替换整个面板。
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
  const [emailLocalPart, setEmailLocalPart] = useState('');
  const [emailSuffix, setEmailSuffix] = useState<EmailSuffix>(DEFAULT_EMAIL_SUFFIX);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState<OneTimeCode | string>(() => createOneTimeCode());
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [emailCodeSubmitting, setEmailCodeSubmitting] = useState(false);
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
      // Mac App（Tauri 壳）下：通知 shell 关 login 窗、开 main 窗；
      // 纯浏览器下：走 React Router navigate 到 next。
      if (isTauriShell()) {
        void emitShellLoginSuccess();
      } else {
        navigate(next, { replace: true });
      }
    }
  }, [isAuthenticated, navigate, next]);

  // 紧凑 macOS 登录窗只用 body 标记切换窗口内边距；登录内容本身仍与 Web 共用。
  useEffect(() => {
    if (!isTauriShell() || typeof document === 'undefined') return;
    document.body.classList.add(TAURI_BODY_CLASS);
    return () => {
      document.body.classList.remove(TAURI_BODY_CLASS);
    };
  }, []);

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

  // 二维码始终在左侧启动；其轮询凭证只留在内存中。
  useEffect(() => {
    if (deviceQr || deviceQrCreatingRef.current) return undefined;
    if (deviceQrStatus === 'failed') return undefined;
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

  const trimmedEmailLocalPart = normalizeEmailLocalPart(emailLocalPart).trim().toLowerCase();
  const trimmedEmail = trimmedEmailLocalPart ? `${trimmedEmailLocalPart}@${emailSuffix}` : '';
  const emailSuffixIsSelected = EMAIL_SUFFIX_OPTIONS.includes(emailSuffix);
  const emailIsValid = emailSuffixIsSelected && isValidEmailLocalPart(trimmedEmailLocalPart) && EMAIL_PATTERN.test(trimmedEmail);
  const emailFieldIsInvalid = emailLocalPart.length > 0 && !emailIsValid;
  const codeIsValid = OTP_PATTERN.test(oneTimeCodeValue(code));
  const hasCurrentEmailChallenge = Boolean(sentTo) && sentTo === trimmedEmail;
  const isEmailCodeCoolingDown = hasCurrentEmailChallenge && cooldown > 0;
  const canResend = emailIsValid && cooldown <= 0 && !submitting && !sessionLoading && hasCurrentEmailChallenge;
  const canRequestCode = emailIsValid && !submitting && !sessionLoading && !isEmailCodeCoolingDown;
  const emailCodeButtonState = emailCodeSubmitting
    ? 'sending'
    : isEmailCodeCoolingDown
      ? 'cooldown'
      : canResend
        ? 'resend'
        : canRequestCode
          ? 'request'
          : 'disabled';
  const canVerify = emailIsValid && codeIsValid && !submitting && Boolean(challengeId) && sentTo === trimmedEmail;
  const canEnterCode = Boolean(challengeId) && sentTo === trimmedEmail;

  const resetEmailChallenge = () => {
    setCode(createOneTimeCode());
    setChallengeId('');
    setSentTo('');
    setExpiresAt(null);
    setCooldown(0);
  };

  const handleEmailLocalPartChange = (value: string) => {
    setEmailLocalPart(normalizeEmailLocalPart(value));
    resetEmailChallenge();
    setError(null);
    setHint(null);
  };

  const handleEmailSuffixChange = (value: EmailSuffix) => {
    setEmailSuffix(value);
    resetEmailChallenge();
    setError(null);
    setHint(null);
  };

  const handleSendCode = async () => {
    if (submitting || sessionLoading) return;
    if (isEmailCodeCoolingDown) return;
    if (!emailIsValid) {
      setError(t('auth.login.invalidEmail'));
      return;
    }
    setError(null);
    setHint(null);
    setSubmitting(true);
    setEmailCodeSubmitting(true);
    try {
      const result = await requestEmailCode(trimmedEmail);
      setSentTo(trimmedEmail);
      setChallengeId(result.challengeId);
      setExpiresAt(result.expiresAt || null);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode(createOneTimeCode());
      setHint(t('auth.login.codeSentHint'));
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('auth.login.sendFailed');
      setError(message);
    } finally {
      setEmailCodeSubmitting(false);
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
    if (!emailIsValid) {
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
      const ok = await loginWithPassword(trimmedEmail, password);
      if (!ok) setError('密码登录失败，请检查邮箱和密码。');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '密码登录失败，请检查邮箱和密码。');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleVerifyCode = async (event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    if (event && 'preventDefault' in event) event.preventDefault();
    if (submitting) return;
    if (!emailIsValid) {
      setError(t('auth.login.invalidEmail'));
      return;
    }
    const trimmed = oneTimeCodeValue(code);
    if (!trimmed) {
      setError(t('auth.login.codeRequired'));
      return;
    }
    if (!codeIsValid) {
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
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('auth.login.codeInvalid'));
      setPhase('code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || sentTo !== trimmedEmail) return;
    setError(null);
    setHint(null);
    setSubmitting(true);
    setEmailCodeSubmitting(true);
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
      setEmailCodeSubmitting(false);
      setSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setPhase('email');
    resetEmailChallenge();
    setError(null);
    setHint(null);
  };

  const handleLoginModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setPhase('email');
    resetEmailChallenge();
    setError(null);
    setHint(null);
  };

  const banner = error || (sessionError && (phase === 'verifying' || loginMode === 'password') ? sessionError : null);
  const appName = t('app.name');
  const qrOverlayTitle = deviceQrStatus === 'expired' ? '二维码已过期' : '二维码加载失败';
  const qrOverlayHint = deviceQrStatus === 'expired' ? '请点击刷新' : '请点击重试';
  const refreshDeviceQr = () => {
    deviceQrConsumingRef.current = false;
    setDeviceQr(null);
    setDeviceQrStatus('creating');
    setQrError(null);
  };

  return (
    <main className="axi-login-page">
      <div
        className="axi-login-drag-region"
        data-tauri-drag-region
        aria-hidden="true"
      />
      <div className="axi-login-page__grid" aria-hidden="true" />

      <section className="axi-login-card" aria-labelledby="axi-login-title">
        {!isTauriShell() && (
          <div className="axi-login-card__chrome" aria-hidden="true">
            <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--close" />
            <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--minimize" />
            <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--maximize" />
          </div>
        )}
        <div className="axi-login-card__body">
          <section className="axi-login-qr-column" id="axi-login-qr-panel" aria-label="扫码登录">
            <h1 id="axi-login-title">扫描二维码登录</h1>
            <div
              className="axi-login-qr-hover"
              title={`请使用 ${appName} 手机端扫描二维码登录`}
              aria-label={`使用 ${appName} 手机端扫描二维码登录`}
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
                    bordered={false}
                    status="active"
                  />
                ) : deviceQrStatus === 'failed' ? (
                  <div className="axi-login-qr-error" role="status">
                    <span className="axi-login-qr-error__title">二维码暂时不可用</span>
                    <button type="button" onClick={refreshDeviceQr}>重新生成</button>
                  </div>
                ) : (
                  <div className="axi-login-qr-loading"><span /><span /><span /></div>
                )}
                {(deviceQrStatus === 'expired' || deviceQrStatus === 'failed') && deviceQr && (
                  <button
                    type="button"
                    className="axi-login-qr-expired-overlay"
                    aria-label={`${qrOverlayTitle}，${qrOverlayHint}`}
                    onClick={refreshDeviceQr}
                  >
                    <span className="axi-login-qr-expired-overlay__icon" aria-hidden="true" />
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
              请使用 <strong>{appName} 手机端</strong><br />
              扫码登录或确认本机登录
            </p>
            {qrError && deviceQrStatus === 'failed' && (
              <AxiBanner compact tone="danger" role="alert" className="axi-login-banner axi-login-banner--qr" aria-label="电脑登录二维码错误">
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
                onClick={() => handleLoginModeChange('password')}
              >
                密码登录
              </button>
              <span aria-hidden="true">|</span>
              <button
                type="button"
                role="tab"
                aria-selected={loginMode === 'email'}
                className={loginMode === 'email' ? 'is-active' : ''}
                onClick={() => handleLoginModeChange('email')}
              >
                邮箱登录
              </button>
            </div>

            <div className="axi-login-right__body">
              <div className="axi-login-banner-slot" aria-live="polite">
                {banner && <AxiBanner compact tone="danger" role="alert" className="axi-login-banner axi-login-banner--error">{banner}</AxiBanner>}
                {!banner && hint && <AxiBanner compact tone="brand" className="axi-login-banner axi-login-banner--hint">{hint}</AxiBanner>}
              </div>
              <div className="axi-login-form-slot">
                {loginMode === 'password' && (
                <form className="axi-login-form axi-login-form--password" onSubmit={handlePasswordLogin} noValidate>
                  <label htmlFor="axi-login-password-email">{t('auth.email')}</label>
                  <div className={`axi-login-form__row axi-login-form__row--email axi-login-form__row--password-email${emailFieldIsInvalid ? ' is-invalid' : ''}`}>
                    <input
                      id="axi-login-password-email"
                      name="email-local-part"
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      required
                      value={emailLocalPart}
                      onChange={(event) => handleEmailLocalPartChange(event.target.value)}
                      placeholder={t('auth.email.localPartPlaceholder')}
                      maxLength={EMAIL_LOCAL_PART_MAX_LENGTH}
                      pattern={EMAIL_LOCAL_PART_PATTERN.source}
                      aria-invalid={emailFieldIsInvalid}
                      spellCheck={false}
                      disabled={passwordSubmitting}
                    />
                    <EmailSuffixSelect
                      id="axi-login-password-email-suffix"
                      value={emailSuffix}
                      disabled={passwordSubmitting}
                      label={t('auth.email.suffixLabel')}
                      onChange={handleEmailSuffixChange}
                    />
                  </div>
                  <label htmlFor="axi-login-password">密码</label>
                  <div className="axi-login-form__row axi-login-form__row--input">
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
                  </div>
                  <button
                    className="axi-login-button axi-login-button--primary"
                    type="submit"
                    disabled={passwordSubmitting || sessionLoading || !emailIsValid || !password}
                  >
                    {passwordSubmitting ? '登录中…' : '登录'}
                  </button>
                </form>
              )}

              {loginMode === 'email' && (
                <form className="axi-login-form axi-login-form--email" onSubmit={(event) => event.preventDefault()} noValidate>
                  <label htmlFor="axi-login-email">{t('auth.email')}</label>
                  <div className={`axi-login-form__row axi-login-form__row--email${emailFieldIsInvalid ? ' is-invalid' : ''}`}>
                    <input
                      id="axi-login-email"
                      name="email-local-part"
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      required
                      value={emailLocalPart}
                      onChange={(event) => handleEmailLocalPartChange(event.target.value)}
                      placeholder={t('auth.email.localPartPlaceholder')}
                      maxLength={EMAIL_LOCAL_PART_MAX_LENGTH}
                      pattern={EMAIL_LOCAL_PART_PATTERN.source}
                      aria-invalid={emailFieldIsInvalid}
                      spellCheck={false}
                      disabled={submitting}
                    />
                    <EmailSuffixSelect
                      id="axi-login-email-suffix"
                      value={emailSuffix}
                      disabled={submitting}
                      label={t('auth.email.suffixLabel')}
                      onChange={handleEmailSuffixChange}
                    />
                  </div>

                  <label htmlFor="axi-login-otp-first">{t('auth.login.codeLabel')}</label>
                  <div className="axi-login-form__row axi-login-form__row--code">
                    <OneTimeCodeInput
                      ariaLabelledBy="axi-login-otp-first"
                      disabled={submitting || !canEnterCode}
                      firstInputRef={codeInputRef}
                      value={code}
                      onChange={setCode}
                    />
                    <button
                      type="button"
                      className={`axi-login-text-button axi-login-text-button--send axi-login-code-send${canResend ? ' is-resend' : ''}`}
                      onClick={canResend ? handleResend : handleSendCode}
                      disabled={!canRequestCode}
                      title={isEmailCodeCoolingDown ? `${cooldown}s 后可重新发送` : canResend ? t('auth.login.resendCode') : t('auth.login.requestCode')}
                      aria-live="polite"
                      aria-atomic="true"
                      data-email-code-state={emailCodeButtonState}
                    >
                      {emailCodeSubmitting
                        ? t('auth.login.sending')
                        : isEmailCodeCoolingDown
                          ? `${cooldown}s`
                          : canResend
                            ? t('auth.login.resendCode')
                            : t('auth.login.requestCode')}
                    </button>
                  </div>

                  <button
                    className="axi-login-button axi-login-button--primary"
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={!canVerify}
                  >
                    {submitting ? t('auth.login.verifying') : t('auth.signin')}
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
