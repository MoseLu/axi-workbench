import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCode } from 'antd';
import { AxiBanner } from '@axi/widgets';
import { resolveGatewayURL, resolveUsername } from '@axi/workbench-foundation';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import { oneTimeCodeValue } from '../lib/oneTimeCode';
import { OneTimeCodeInput } from '../components/OneTimeCodeInput';
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
import { localizeLoginError } from '../lib/localizeLoginError';
import {
  getLocalRuntimeStatus,
  isLocalRuntimeBlocked,
  listenLocalRuntimeStatus,
  LOCAL_RUNTIME_STARTING,
  retryLocalRuntime,
  type LocalRuntimeStatus,
} from '../lib/localRuntime';
import {
  getOrCreateDeviceId,
  readLastAccount,
  writeLastAccount,
  type LastAccount,
} from '../lib/lastAccount';
import wechatBrandIconUrl from '../assets/icons/communication/wechat-brand.svg';
import qqBrandIconUrl from '../assets/icons/communication/qq-brand.svg';
import {
  closeLoginWindow,
  emitShellLoginSuccess,
  externalLegalUrl,
  getShellWindowLabel,
  isTauriShell,
  openExternalLegalPage,
} from '../lib/shell';
import './Login.css';

type Phase = 'email' | 'code' | 'verifying';
type LoginMode = 'password' | 'email';
type LoginSurface = 'quick' | 'qr' | 'account';
type DeviceQrStatus = 'creating' | 'waiting_scan' | 'approved' | 'expired' | 'failed';
type PasswordLoginResponse = { authenticated: boolean };

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

function focusLoginField(id: string) {
  const node = document.getElementById(id);
  if (node instanceof HTMLElement) node.focus();
}

function isLoginEnterPassthroughTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('a[href]')
    || target.closest('.axi-login-email-suffix-wrap')
    || target.closest('.axi-login-form-switch')
    || target.closest('.axi-login-email-code-resend')
    || target.closest('.axi-login-email-code-meta button')
    || target.closest('.axi-login-qr-corner-switch')
    || target.closest('.axi-login-window-close')
    || target.closest('.axi-login-quick-links'),
  );
}

function PasswordVisibilityToggle({
  visible,
  disabled,
  showLabel,
  hideLabel,
  onToggle,
}: {
  visible: boolean;
  disabled?: boolean;
  showLabel: string;
  hideLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`axi-login-password-toggle${visible ? ' is-visible' : ''}`}
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3.2 3.2 L20.8 20.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M9.6 9.7 A3.2 3.2 0 0 0 14.3 14.4 M7.1 7.3 C4.6 8.8 2.6 12 2.6 12 S6.4 19 12 19 c1.7 0 3.2-.4 4.5-1.1 M16.8 16.5 C19.4 14.9 21.4 12 21.4 12 S17.6 5 12 5 c-.8 0-1.6.1-2.3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.6 12 S6.4 5 12 5 s9.4 7 9.4 7-3.8 7-9.4 7-9.4-7-9.4-7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
    </button>
  );
}

function SocialLoginPlaceholder({
  provider,
  label,
  comingSoon,
}: {
  provider: 'wechat' | 'qq';
  label: string;
  comingSoon: string;
}) {
  return (
    <button
      type="button"
      className={`axi-login-social-placeholder axi-login-social-placeholder--${provider}`}
      aria-label={`${label}（${comingSoon}）`}
      title={comingSoon}
      disabled
    >
      <span className="axi-login-social-icon" aria-hidden="true">
        <img src={provider === 'wechat' ? wechatBrandIconUrl : qqBrandIconUrl} alt="" />
      </span>
    </button>
  );
}

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
 * 视觉结构采用紧凑客户端登录卡：扫码入口收进左上角二维码角标，
 * 账号入口内部只保留轻量的密码/邮箱方式切换，不让两类表单同时占据画布。
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
    user,
  } = useAuth();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/admin/dashboard';

  // 快捷登录必须先经过原生/浏览器会话探测，不能用本地缓存的账号信息
  // 直接渲染一个可能必然失败的“一键登录”入口。
  const [loginSurface, setLoginSurface] = useState<LoginSurface>('account');
  const [quickAccount, setQuickAccount] = useState<LastAccount | null>(() => readLastAccount());
  const otherMethodsRef = useRef(false);
  const formLoginRef = useRef(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [rememberLogin, setRememberLogin] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('axi.login.remember') !== 'false';
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreeHint, setShowAgreeHint] = useState(false);
  const [emailAttempted, setEmailAttempted] = useState(false);
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [codeAttempted, setCodeAttempted] = useState(false);
  const agreedRef = useRef(false);
  const hintRef = useRef(false);
  agreedRef.current = agreedToTerms;
  hintRef.current = showAgreeHint;
  const [phase, setPhase] = useState<Phase>('email');
  const [emailLocalPart, setEmailLocalPart] = useState('');
  const [emailSuffix, setEmailSuffix] = useState<EmailSuffix>(DEFAULT_EMAIL_SUFFIX);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [code, setCode] = useState('');
  const codeInputRef = useRef<HTMLInputElement | null>(null);
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
  const didNavigateRef = useRef(false);
  const deviceQrCreatingRef = useRef(false);
  const deviceQrConsumingRef = useRef(false);
  const handleAccountEnterRef = useRef<() => void>(() => {});
  const [localRuntimeStatus, setLocalRuntimeStatus] = useState<LocalRuntimeStatus | null>(null);
  const [localRuntimeStatusResolved, setLocalRuntimeStatusResolved] = useState(() => !isTauriShell());
  const localRuntimeRequired = isTauriShell()
    && import.meta.env.VITE_DESKTOP_LOCAL_RUNTIME === 'true';
  const localRuntimeBlocked = isLocalRuntimeBlocked(
    localRuntimeRequired,
    localRuntimeStatusResolved,
    localRuntimeStatus,
  );

  useEffect(() => {
    if (!localRuntimeRequired) return undefined;
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    const refresh = async () => {
      const status = await getLocalRuntimeStatus();
      if (cancelled) return;
      setLocalRuntimeStatus(status);
      setLocalRuntimeStatusResolved(true);
    };
    void refresh();
    void listenLocalRuntimeStatus((status) => {
      if (cancelled) return;
      setLocalRuntimeStatus(status);
      setLocalRuntimeStatusResolved(true);
    }).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    const interval = window.setInterval(() => void refresh(), 750);
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [localRuntimeRequired]);

  const handleLocalRuntimeRetry = async () => {
    setLocalRuntimeStatus(LOCAL_RUNTIME_STARTING);
    setLocalRuntimeStatusResolved(true);
    try {
      await retryLocalRuntime();
    } catch (cause: unknown) {
      setLocalRuntimeStatus({
        ...LOCAL_RUNTIME_STARTING,
        phase: 'failed',
        error: cause instanceof Error ? cause.message : '无法重启本机服务',
      });
    }
  };

  const finishAuthenticatedEntry = () => {
    if (didNavigateRef.current) return;
    didNavigateRef.current = true;
    if (isTauriShell()) {
      void emitShellLoginSuccess();
      if (getShellWindowLabel() === 'main') {
        navigate(next, { replace: true });
      }
      return;
    }
    navigate(next, { replace: true });
  };

  useEffect(() => {
    if (!user) return;
    const existing = readLastAccount();
    setQuickAccount(writeLastAccount({
      subject: user.id,
      name: existing?.subject === user.id ? existing.name : user.name,
      email: user.email,
    }));
    if (!otherMethodsRef.current && !formLoginRef.current) {
      setLoginSurface((current) => (current === 'qr' ? current : 'quick'));
    }
  }, [user]);

  useEffect(() => {
    const deviceId = getOrCreateDeviceId();
    const controller = new AbortController();
    void fetch(resolveGatewayURL('/api/v1/sessions/resume'), {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Axi-Device-Id': deviceId },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        setQuickAccount(null);
        if (!otherMethodsRef.current) setLoginSurface('account');
        return;
      }
      const body = (await response.json()) as { resumable?: boolean; user?: { subject?: string; email?: string; name?: string } };
      if (!body.resumable || !body.user?.subject) {
        setQuickAccount(null);
        if (!otherMethodsRef.current) setLoginSurface('account');
        return;
      }
      const existing = readLastAccount();
      const account = writeLastAccount({
        subject: body.user.subject,
        name: existing?.subject === body.user.subject
          ? existing.name
          : resolveUsername({
            candidate: body.user.name,
            email: body.user.email,
            subject: body.user.subject,
          }),
        email: body.user.email,
      });
      setQuickAccount(account);
      if (!otherMethodsRef.current) setLoginSurface('quick');
    }).catch(() => {
      setQuickAccount(null);
      if (!otherMethodsRef.current) setLoginSurface('account');
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !didNavigateRef.current && formLoginRef.current) {
      finishAuthenticatedEntry();
    }
  }, [isAuthenticated, navigate, next]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (loginSurface !== 'account' && loginSurface !== 'quick') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (event.isComposing || event.keyCode === 229) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isLoginEnterPassthroughTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat) return;
      handleAccountEnterRef.current();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [loginSurface]);


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
  const emailFieldIsInvalid = (emailAttempted || emailLocalPart.length > 0) && !emailIsValid;
  const passwordFieldIsInvalid = passwordAttempted && !password;
  const codeIsValid = OTP_PATTERN.test(oneTimeCodeValue(code));
  const codeFieldIsInvalid = codeAttempted && !codeIsValid;
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
  const resendCountdownLabel = String(cooldown);
  const canVerify = emailIsValid && codeIsValid && !submitting && Boolean(challengeId) && sentTo === trimmedEmail;
  const showingEmailCodeForm = Boolean(challengeId) && sentTo === trimmedEmail;

  const resetEmailChallenge = () => {
    setCode('');
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

  const handleCodeInputChange = (value: readonly string[] | string) => {
    setCode(oneTimeCodeValue(value));
    setError(null);
  };

  const requireTermsAgreement = () => {
    if (agreedRef.current) {
      hintRef.current = false;
      setShowAgreeHint(false);
      return true;
    }
    setError(null);
    setHint(null);
    hintRef.current = true;
    setShowAgreeHint(true);
    return false;
  };

  const assertEmailField = () => {
    if (emailIsValid) return true;
    setEmailAttempted(true);
    setError(t('auth.login.invalidEmail'));
    focusLoginField(loginMode === 'password' ? 'axi-login-password-email' : 'axi-login-email');
    return false;
  };

  const assertPasswordField = () => {
    if (password) return true;
    setPasswordAttempted(true);
    setError(t('auth.login.passwordRequired'));
    focusLoginField('axi-login-password');
    return false;
  };

  const assertCodeField = () => {
    const trimmed = oneTimeCodeValue(code);
    if (!trimmed) {
      setCodeAttempted(true);
      setError(t('auth.login.codeRequired'));
      codeInputRef.current?.focus();
      return false;
    }
    if (!OTP_PATTERN.test(trimmed)) {
      setCodeAttempted(true);
      setError(t('auth.login.codeLength'));
      codeInputRef.current?.focus();
      return false;
    }
    return true;
  };

  const submitSendCode = async () => {
    if (localRuntimeBlocked || submitting || sessionLoading || isEmailCodeCoolingDown) return;
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
      setCode('');
      setPhase('code');
      setHint(t('auth.login.codeSentHint'));
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('auth.login.sendFailed');
      setError(localizeLoginError(message, t));
    } finally {
      setEmailCodeSubmitting(false);
      setSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    if (localRuntimeBlocked || submitting || sessionLoading) return;
    if (isEmailCodeCoolingDown) return;
    if (!assertEmailField()) return;
    if (!requireTermsAgreement()) return;
    await submitSendCode();
  };

  const loginWithPassword = async (loginEmail: string, loginPassword: string): Promise<boolean> => {
    const response = await fetch(resolveGatewayURL('/api/v1/sessions'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
        rememberMe: rememberLogin,
        deviceId: getOrCreateDeviceId(),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as PasswordLoginResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || `密码登录失败 (HTTP ${response.status})`);
    }
    if (payload.authenticated !== true) throw new Error('密码登录未建立会话');
    formLoginRef.current = true;
    const authenticated = await refreshSession();
    if (!authenticated) throw new Error('会话未建立，请重试密码登录');
    return authenticated;
  };

  const submitPasswordLogin = async () => {
    if (passwordSubmitting || sessionLoading) return;
    setError(null);
    setHint(null);
    setPasswordSubmitting(true);
    try {
      const ok = await loginWithPassword(trimmedEmail, password);
      if (!ok) setError('密码登录失败，请检查邮箱和密码。');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? localizeLoginError(caught.message, t) : '密码登录失败，请检查邮箱和密码。');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordSubmitting || sessionLoading) return;
    if (!assertEmailField()) return;
    if (!assertPasswordField()) return;
    if (!requireTermsAgreement()) return;
    await submitPasswordLogin();
  };

  const submitEmailCodeLogin = async () => {
    if (submitting) return;
    const trimmed = oneTimeCodeValue(code);
    setError(null);
    setHint(null);
    setPhase('verifying');
    setSubmitting(true);
    try {
      const ok = await confirmEmailCode(challengeId, trimmed);
      if (ok) {
        formLoginRef.current = true;
        return;
      }
      setError(t('auth.login.codeInvalid'));
      setPhase('code');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? localizeLoginError(caught.message, t) : t('auth.login.codeInvalid'));
      setPhase('code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    if (event && 'preventDefault' in event) event.preventDefault();
    if (submitting) return;
    if (!assertEmailField()) return;
    if (!assertCodeField()) return;
    if (!requireTermsAgreement()) return;
    await submitEmailCodeLogin();
  };

  const submitQuickLogin = async () => {
    if (submitting || passwordSubmitting || sessionLoading) return;
    if (!quickAccount) {
      openOtherMethods();
      return;
    }
    setError(null);
    setHint(null);
    if (isAuthenticated) {
      formLoginRef.current = true;
      finishAuthenticatedEntry();
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(resolveGatewayURL('/api/v1/sessions/resume'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Axi-Device-Id': getOrCreateDeviceId(),
        },
      });
      if (!response.ok) {
        throw new Error(t('auth.login.resumeExpired'));
      }
      const ok = await refreshSession();
      if (!ok) throw new Error(t('auth.login.resumeExpired'));
      formLoginRef.current = true;
      finishAuthenticatedEntry();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? localizeLoginError(caught.message, t) : t('auth.login.resumeExpired'));
      setQuickAccount(null);
      otherMethodsRef.current = true;
      setLoginSurface('account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async () => {
    if (!requireTermsAgreement()) return;
    await submitQuickLogin();
  };

  const openOtherMethods = () => {
    otherMethodsRef.current = true;
    setLoginSurface('account');
    setShowAgreeHint(false);
  };

  const handleAccountEnter = () => {
    if (passwordSubmitting || submitting) return;
    if (loginSurface === 'quick') {
      void handleQuickLogin();
      return;
    }

    if (loginMode === 'password') {
      if (!assertEmailField()) return;
      if (!assertPasswordField()) return;
    } else if (!showingEmailCodeForm) {
      if (!assertEmailField()) return;
    } else if (!assertCodeField()) {
      return;
    }

    if (!agreedRef.current) {
      if (!hintRef.current) {
        setError(null);
        setHint(null);
        hintRef.current = true;
        setShowAgreeHint(true);
        return;
      }
      agreedRef.current = true;
      hintRef.current = false;
      setAgreedToTerms(true);
      setShowAgreeHint(false);
      return;
    }

    if (sessionLoading) return;
    if (loginMode === 'password') {
      void submitPasswordLogin();
      return;
    }
    if (showingEmailCodeForm) {
      void submitEmailCodeLogin();
      return;
    }
    void submitSendCode();
  };

  handleAccountEnterRef.current = handleAccountEnter;

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
      setCode('');
      setPhase('code');
      setHint(t('auth.login.resentHint'));
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('auth.login.resendFailed');
      setError(localizeLoginError(message, t));
    } finally {
      setEmailCodeSubmitting(false);
      setSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setPhase('email');
    resetEmailChallenge();
    setEmailAttempted(false);
    setCodeAttempted(false);
    setError(null);
    setHint(null);
    focusLoginField('axi-login-email');
  };

  const handleLoginModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setPhase('email');
    resetEmailChallenge();
    setEmailAttempted(false);
    setPasswordAttempted(false);
    setCodeAttempted(false);
    setPasswordVisible(false);
    setError(null);
    setHint(null);
  };

  const handleLoginSurfaceChange = (surface: LoginSurface) => {
    setLoginSurface(surface);
    setError(null);
    setHint(null);
  };

  const handleRememberLoginChange = (checked: boolean) => {
    setRememberLogin(checked);
    window.localStorage.setItem('axi.login.remember', String(checked));
  };

  const banner = error || (sessionError && (phase === 'verifying' || loginMode === 'password') ? sessionError : null);
  const appName = t('app.name');
  const runtimeStatusLabel = localRuntimeStatus?.phase === 'failed'
    ? t('auth.login.localRuntimeFailed')
    : t('auth.login.localRuntimeStarting');
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

      <section className={`axi-login-card${localRuntimeBlocked ? ' is-runtime-blocked' : ''}`} aria-labelledby="axi-login-title">
        {!isTauriShell() && loginSurface === 'quick' && (
          <div className="axi-login-card__chrome" aria-hidden="true">
            <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--close" />
            <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--minimize" />
            <span className="axi-login-card__chrome-dot axi-login-card__chrome-dot--maximize" />
          </div>
        )}
        {isTauriShell() && (
          <button
            type="button"
            className="axi-login-window-close"
            aria-label={t('auth.login.closeWindow')}
            title={t('auth.login.closeWindow')}
            onClick={() => void closeLoginWindow()}
          >
            <span aria-hidden="true" />
          </button>
        )}
        {localRuntimeBlocked && (
          <div
            className="axi-login-runtime-gate"
            role={localRuntimeStatus?.phase === 'failed' ? 'alert' : 'status'}
            aria-live="polite"
            aria-busy={localRuntimeStatus?.phase !== 'failed'}
          >
            <strong>{runtimeStatusLabel}</strong>
            <span>
              {localRuntimeStatus?.phase === 'failed'
                ? [
                    localRuntimeStatus.error || t('auth.login.localRuntimeRetryHint'),
                    localRuntimeStatus.logPath ? `日志：${localRuntimeStatus.logPath}` : '',
                  ].filter(Boolean).join(' ')
                : t('auth.login.localRuntimeWaitHint')}
            </span>
            {localRuntimeStatus?.phase === 'failed' && (
              <button type="button" onClick={() => void handleLocalRuntimeRetry()}>
                {t('auth.login.localRuntimeRetry')}
              </button>
            )}
          </div>
        )}
        <div className={`axi-login-card__body${loginSurface === 'quick' ? ' is-quick' : ''}`}>
          {loginSurface === 'account' && (
            <button
              type="button"
              className="axi-login-qr-corner-switch"
              aria-label={t('auth.login.switchToQr')}
              title={t('auth.login.switchToQr')}
              onClick={() => handleLoginSurfaceChange('qr')}
            >
              <img className="axi-login-qr-corner-png" src="/login-qr-corner.png" alt="" aria-hidden="true" />
            </button>
          )}


          <div className={`axi-login-entry-panel is-${loginSurface}`}>
            {loginSurface === 'quick' ? (
              <section className="axi-login-quick" aria-label={t('auth.login.quickLogin')}>
                <div className="axi-login-quick-brand" aria-label={appName}>
                  <span className="axi-login-quick-mark">
                    <img src="/apple-touch-icon.png" alt="" aria-hidden="true" />
                  </span>
                  <h1 id="axi-login-title">{appName}</h1>
                </div>
                <div className="axi-login-quick-dock">
                <div className="axi-login-quick-account">
                  <img
                    className="axi-login-quick-avatar"
                    src="/login-default-avatar.jpg"
                    alt=""
                    aria-hidden="true"
                  />
                  <span className="axi-login-quick-meta">
                    <strong>{quickAccount?.name || t('auth.login.quickAccountFallbackName')}</strong>
                    <em>{quickAccount?.emailMasked || quickAccount?.email || t('auth.login.quickAccountFallbackHint')}</em>
                  </span>
                  <button
                    type="button"
                    className="axi-login-quick-submit"
                    onClick={() => void handleQuickLogin()}
                    disabled={submitting || sessionLoading}
                  >
                    {submitting ? t('auth.login.verifying') : t('auth.signin')}
                  </button>
                </div>
                <div className="axi-login-consent axi-login-consent--quick">
                  <label>
                    <span className="axi-login-consent-box">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          agreedRef.current = checked;
                          setAgreedToTerms(checked);
                          if (checked) {
                            hintRef.current = false;
                            setShowAgreeHint(false);
                          }
                        }}
                      />
                      {showAgreeHint ? (
                        <span className="axi-login-consent-tooltip" role="alert">
                          {t('auth.login.agreeHint')}
                        </span>
                      ) : null}
                    </span>
                    <span className="axi-login-consent-copy">{t('auth.login.agreePrefixQuick')}<a
                      href={externalLegalUrl('terms')}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => {
                        if (!isTauriShell()) return;
                        event.preventDefault();
                        void openExternalLegalPage('terms');
                      }}
                    >{t('auth.login.terms')}</a><a
                      href={externalLegalUrl('privacy')}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => {
                        if (!isTauriShell()) return;
                        event.preventDefault();
                        void openExternalLegalPage('privacy');
                      }}
                    >{t('auth.login.privacy')}</a></span>
                  </label>
                </div>
                <div className="axi-login-quick-links">
                  <span>{t('auth.login.loginHelp')}？</span>
                  <button type="button" onClick={openOtherMethods}>{t('auth.login.otherMethods')}</button>
                </div>
                </div>
              </section>
            ) : null}
            {loginSurface !== 'quick' ? (
            <div className="axi-login-brand" aria-label={appName}>
              <img src="/apple-touch-icon.png" alt="" aria-hidden="true" />
              <span>{appName}</span>
            </div>
            ) : null}
            {loginSurface === 'qr' ? (
              <section className="axi-login-qr-column" id="axi-login-qr-panel" aria-label={t('auth.login.qrLogin')}>
                <h1 id="axi-login-title">{t('auth.login.scanTitle')}</h1>
                <div
                  className="axi-login-qr-hover"
                  title={`请使用 ${appName} 手机端扫描二维码登录`}
                  aria-label={`使用 ${appName} 手机端扫描二维码登录`}
                  role="img"
                  tabIndex={0}
                >
                  <div className={`axi-login-qr-frame ${deviceQrStatus === 'failed' || deviceQrStatus === 'expired' ? 'is-error' : ''}`}>
                    {deviceQr ? (
                      // axi-ui-escape-hatch: antd QRCode 在 Axi UI 尚未提供等价组件前的临时替代
                      <QRCode
                        aria-label="电脑登录二维码"
                        value={webDeviceLoginQrPayload(deviceQr)}
                        size={160}
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
                </div>
                <p className="axi-login-qr-instruction">
                  使用 <strong>{appName} 手机端</strong> 扫码登录
                </p>
                {qrError && deviceQrStatus === 'failed' && (
                  <AxiBanner compact tone="danger" role="alert" className="axi-login-banner axi-login-banner--qr" aria-label="电脑登录二维码错误">
                    {qrError}
                  </AxiBanner>
                )}
                <button type="button" className="axi-login-entry-switch" onClick={() => handleLoginSurfaceChange('account')}>
                  {t('auth.login.useAccount')}
                </button>
              </section>
            ) : loginSurface === 'account' ? (
              <section className="axi-login-account" id="axi-login-account-panel" aria-label={t('auth.login.accountLogin')}>
                <div className={`axi-login-right__body is-${loginMode}`}>
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
                  <div className={`axi-login-form__row axi-login-form__row--input${passwordFieldIsInvalid ? ' is-invalid' : ''}`}>
                    <input
                      id="axi-login-password"
                      className="axi-login-password-input"
                      name="password"
                      type={passwordVisible ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="请输入密码"
                      aria-invalid={passwordFieldIsInvalid}
                      disabled={passwordSubmitting}
                    />
                    <PasswordVisibilityToggle
                      visible={passwordVisible}
                      disabled={passwordSubmitting}
                      showLabel={t('auth.login.showPassword')}
                      hideLabel={t('auth.login.hidePassword')}
                      onToggle={() => setPasswordVisible((current) => !current)}
                    />
                  </div>
                  <div className="axi-login-form-options">
                    <label className="axi-login-remember-option">
                      <span className="axi-login-remember-box">
                        <input
                          type="checkbox"
                          checked={rememberLogin}
                          onChange={(event) => handleRememberLoginChange(event.target.checked)}
                        />
                        <span className="axi-login-remember-tooltip">十天内免登录</span>
                      </span>
                      <span>{t('auth.login.autoLogin')}</span>
                    </label>
                    <button type="button" className="axi-login-form-switch" onClick={() => handleLoginModeChange('email')}>
                      {t('auth.login.codeLogin')}
                    </button>
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
                <form
                  className={`axi-login-form axi-login-form--email${showingEmailCodeForm ? ' is-code' : ''}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (showingEmailCodeForm) void handleVerifyCode();
                    else void handleSendCode();
                  }}
                  noValidate
                >
                  {!showingEmailCodeForm && <>
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
                  </>}

                  {showingEmailCodeForm ? (
                    <>
                      <div id="axi-login-email-code" className={`axi-login-email-code-row axi-login-form__row--code${codeFieldIsInvalid ? ' is-invalid' : ''}`}>
                        <OneTimeCodeInput
                          value={code}
                          onChange={handleCodeInputChange}
                          firstInputRef={codeInputRef}
                          ariaLabelledBy="axi-login-email-code-label"
                          ariaInvalid={codeFieldIsInvalid}
                          disabled={submitting}
                        />
                        <span id="axi-login-email-code-label" className="axi-visually-hidden">{t('auth.login.codeLabel')}</span>
                        <button
                          type="button"
                          className={`axi-login-email-code-resend axi-login-text-button--send${canResend ? ' is-resend' : ''}`}
                          onClick={canResend ? handleResend : undefined}
                          disabled={!canResend}
                          aria-live="polite"
                          aria-atomic="true"
                          data-email-code-state={emailCodeButtonState}
                        >
                          {emailCodeSubmitting
                            ? t('auth.login.sending')
                            : isEmailCodeCoolingDown
                              ? resendCountdownLabel
                              : t('auth.login.resendCode')}
                        </button>
                      </div>
                      <div className="axi-login-email-code-meta">
                        <span>{t('auth.login.codeSentShort').replace('{email}', sentTo)}</span>
                        <button type="button" onClick={handleChangeEmail}>
                          {t('auth.login.changeEmail')}
                        </button>
                        <button type="button" onClick={() => handleLoginModeChange('password')}>
                          {t('auth.login.passwordLogin')}
                        </button>
                      </div>
                      <button
                        className="axi-login-button axi-login-button--primary"
                        type="submit"
                        disabled={!canVerify}
                      >
                        {submitting ? t('auth.login.verifying') : t('auth.signin')}
                      </button>
                    </>
                  ) : (
                    <>
                    <div className="axi-login-form-options">
                      <label className="axi-login-remember-option">
                        <span className="axi-login-remember-box">
                          <input
                            type="checkbox"
                            checked={rememberLogin}
                            onChange={(event) => handleRememberLoginChange(event.target.checked)}
                          />
                          <span className="axi-login-remember-tooltip">十天内免登录</span>
                        </span>
                        <span>{t('auth.login.autoLogin')}</span>
                      </label>
                      <button type="button" className="axi-login-form-switch" onClick={() => handleLoginModeChange('password')}>
                        {t('auth.login.passwordLogin')}
                      </button>
                    </div>
                    <button
                      className="axi-login-button axi-login-button--primary axi-login-button--code-login"
                      type="submit"
                      disabled={!canRequestCode}
                      data-email-code-state={emailCodeButtonState}
                      aria-live="polite"
                    >
                      {emailCodeSubmitting ? t('auth.login.sending') : t('auth.login.codeLogin')}
                    </button>
                    </>
                  )}
                </form>
              )}

              </div>
              <div className="axi-login-banner-slot" aria-live="polite">
                {banner && <AxiBanner compact icon={false} tone="danger" role="alert" className="axi-login-banner axi-login-banner--error">{banner}</AxiBanner>}
              </div>
              <div className="axi-login-social-placeholders" aria-label={t('auth.login.socialLogin')}>
                <SocialLoginPlaceholder
                  provider="wechat"
                  label={t('auth.login.wechatLogin')}
                  comingSoon={t('auth.login.socialComingSoon')}
                />
                <SocialLoginPlaceholder
                  provider="qq"
                  label={t('auth.login.qqLogin')}
                  comingSoon={t('auth.login.socialComingSoon')}
                />
              </div>
              <div className="axi-login-consent">
                <label>
                  <span className="axi-login-consent-box">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        agreedRef.current = checked;
                        setAgreedToTerms(checked);
                        if (checked) {
                          hintRef.current = false;
                          setShowAgreeHint(false);
                        }
                      }}
                    />
                    {showAgreeHint ? (
                      <span className="axi-login-consent-tooltip" role="alert">
                        {t('auth.login.agreeHint')}
                      </span>
                    ) : null}
                  </span>
                  <span>{t('auth.login.agreePrefix')}</span>
                  <a
                    href={externalLegalUrl('terms')}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!isTauriShell()) return;
                      event.preventDefault();
                      void openExternalLegalPage('terms');
                    }}
                  >
                    {t('auth.login.terms')}
                  </a>
                  <span>{t('auth.login.and')}</span>
                  <a
                    href={externalLegalUrl('privacy')}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!isTauriShell()) return;
                      event.preventDefault();
                      void openExternalLegalPage('privacy');
                    }}
                  >
                    {t('auth.login.privacy')}
                  </a>
                </label>
              </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
