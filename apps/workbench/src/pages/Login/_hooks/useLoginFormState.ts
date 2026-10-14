/**
 * 工作台登录页 — 登录表单状态层。
 *
 * 字段状态、派生校验、字段级 handler、同意条款门禁与 assert 前置检查。
 * 提交动作在 useLoginSubmit 中，本文件不发起任何网络请求。
 *
 * 注意：hint / expiresAt 与原实现一样只写入、不参与渲染，保留以免改变行为。
 */
import { useEffect, useRef, useState } from 'react';
import { oneTimeCodeValue } from '../../../lib/oneTimeCode';
import { isValidEmailLocalPart, normalizeEmailLocalPart } from '../../../lib/emailValidation';
import {
  DEFAULT_EMAIL_SUFFIX,
  EMAIL_SUFFIX_OPTIONS,
  type EmailSuffix,
} from '../_components/EmailSuffixSelect';
import type { EmailCodeButtonState } from '../_components/EmailCodeLoginForm';
import type { LoginMode, Phase, Translate } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

function focusLoginField(id: string) {
  const node = document.getElementById(id);
  if (node instanceof HTMLElement) node.focus();
}

export function useLoginFormState(t: Translate, sessionLoading: boolean) {
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
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

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
  const emailCodeButtonState: EmailCodeButtonState = emailCodeSubmitting
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

  const handlePasswordChange = (value: string) => {
    setPassword(value);
  };

  const handleRememberLoginChange = (checked: boolean) => {
    setRememberLogin(checked);
    window.localStorage.setItem('axi.login.remember', String(checked));
  };

  const handleAgreedChange = (checked: boolean) => {
    agreedRef.current = checked;
    setAgreedToTerms(checked);
    if (checked) {
      hintRef.current = false;
      setShowAgreeHint(false);
    }
  };

  const clearFeedback = () => {
    setError(null);
    setHint(null);
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

  return {
    // 状态值
    loginMode,
    phase,
    emailLocalPart,
    emailSuffix,
    password,
    passwordVisible,
    code,
    rememberLogin,
    sentTo,
    challengeId,
    submitting,
    emailCodeSubmitting,
    passwordSubmitting,
    error,
    agreedToTerms,
    showAgreeHint,
    // refs
    agreedRef,
    hintRef,
    codeInputRef,
    // 派生值
    trimmedEmail,
    emailIsValid,
    emailFieldIsInvalid,
    passwordFieldIsInvalid,
    codeFieldIsInvalid,
    isEmailCodeCoolingDown,
    canResend,
    canRequestCode,
    emailCodeButtonState,
    resendCountdownLabel,
    canVerify,
    showingEmailCodeForm,
    // setters（供 useLoginSubmit 写回）
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
    setPasswordVisible,
    // 字段/门禁 handler
    handleEmailLocalPartChange,
    handleEmailSuffixChange,
    handleCodeInputChange,
    handlePasswordChange,
    handleRememberLoginChange,
    handleAgreedChange,
    togglePasswordVisible: () => setPasswordVisible((current) => !current),
    clearFeedback,
    requireTermsAgreement,
    assertEmailField,
    assertPasswordField,
    assertCodeField,
    handleChangeEmail,
    handleLoginModeChange,
  };
}
