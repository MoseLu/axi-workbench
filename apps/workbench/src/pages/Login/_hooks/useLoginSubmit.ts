/**
 * 工作台登录页 — 登录提交动作层。
 *
 * 邮箱验证码（发送/验证/重发）、密码登录、一键登录（quick）以及
 * 账号面 Enter 键提交的编排。状态读写全部来自 useLoginFormState。
 */
import { useEffect, useRef } from 'react';
import type {
  Dispatch,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  SetStateAction,
} from 'react';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { backoffFetch } from '../../../lib/network/backoffFetch';
import { oneTimeCodeValue } from '../../../lib/oneTimeCode';
import { localizeLoginError } from '../../../lib/localizeLoginError';
import { getOrCreateDeviceId, type LastAccount } from '../../../lib/lastAccount';
import type { useLoginFormState } from './useLoginFormState';
import type { LoginSurface, Translate } from './types';

const RESEND_COOLDOWN_SECONDS = 60;

type PasswordLoginResponse = { authenticated: boolean };

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

export interface UseLoginSubmitOptions {
  loginSurface: LoginSurface;
  setLoginSurface: Dispatch<SetStateAction<LoginSurface>>;
  otherMethodsRef: MutableRefObject<boolean>;
  formLoginRef: MutableRefObject<boolean>;
  quickAccount: LastAccount | null;
  setQuickAccount: Dispatch<SetStateAction<LastAccount | null>>;
  isAuthenticated: boolean;
  sessionLoading: boolean;
  /** 桌面壳本机运行时不可用时，禁止发起邮箱验证码请求（与拆分前一致）。 */
  localRuntimeBlocked: boolean;
  requestEmailCode: (email: string) => Promise<{ challengeId: string; expiresAt: string }>;
  confirmEmailCode: (challengeId: string, token: string) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  finishAuthenticatedEntry: () => void;
  t: Translate;
}

export function useLoginSubmit(
  state: ReturnType<typeof useLoginFormState>,
  {
    loginSurface,
    setLoginSurface,
    otherMethodsRef,
    formLoginRef,
    quickAccount,
    setQuickAccount,
    isAuthenticated,
    sessionLoading,
    localRuntimeBlocked,
    requestEmailCode,
    confirmEmailCode,
    refreshSession,
    finishAuthenticatedEntry,
    t,
  }: UseLoginSubmitOptions,
) {
  const {
    trimmedEmail,
    isEmailCodeCoolingDown,
    canResend,
    sentTo,
    code,
    password,
    rememberLogin,
    loginMode,
    submitting,
    passwordSubmitting,
    showingEmailCodeForm,
    agreedRef,
    hintRef,
    setPhase,
    setCode,
    setSentTo,
    setChallengeId,
    setExpiresAt,
    setCooldown,
    setSubmitting,
    setEmailCodeSubmitting,
    setPasswordSubmitting,
    setError,
    setHint,
    setAgreedToTerms,
    setShowAgreeHint,
    assertEmailField,
    assertPasswordField,
    assertCodeField,
    requireTermsAgreement,
  } = state;

  const handleAccountEnterRef = useRef<() => void>(() => {});

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

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
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
      const ok = await confirmEmailCode(state.challengeId, trimmed);
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

  const handleVerifyCode = async (event?: FormEvent<HTMLFormElement> | ReactMouseEvent<HTMLButtonElement>) => {
    if (event && 'preventDefault' in event) event.preventDefault();
    if (submitting) return;
    if (!assertEmailField()) return;
    if (!assertCodeField()) return;
    if (!requireTermsAgreement()) return;
    await submitEmailCodeLogin();
  };

  const handleEmailCodeFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (showingEmailCodeForm) void handleVerifyCode();
    else void handleSendCode();
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
      const response = await backoffFetch(resolveGatewayURL('/api/v1/sessions/resume'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Axi-Device-Id': getOrCreateDeviceId(),
        },
        backoff: { maxRetries: 2, baseDelayMs: 1000 },
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

  return {
    handleSendCode,
    handlePasswordLogin,
    handleEmailCodeFormSubmit,
    handleResend,
    handleQuickLogin,
    openOtherMethods,
  };
}
