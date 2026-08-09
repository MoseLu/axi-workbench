import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AxiLogoMark } from '@axi/core';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import { OneTimeCodeInput } from '../components/OneTimeCodeInput';
import { createOneTimeCode, oneTimeCodeValue, type OneTimeCode } from '../lib/oneTimeCode';

type Phase = 'email' | 'code' | 'verifying';

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
  } = useAuth();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/admin/dashboard';

  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<OneTimeCode | string>(() => createOneTimeCode());
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  // 跟踪成功提交后的导航动作，避免在 navigate 后再触发 setState。
  const didNavigateRef = useRef(false);

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

  const shell: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--color-tabbar-dark) 0%, var(--color-login-bg) 100%)',
    padding: 20,
  };
  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    padding: 36,
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    color: 'var(--axi-text, #f8fafc)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const primaryButton: React.CSSProperties = {
    width: '100%',
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--axi-text-inverse, #fff)',
    background: 'var(--axi-primary)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  };
  const linkButton: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--axi-primary)',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
  };

  const localError = error;
  const banner = localError || (sessionError && phase === 'verifying' ? sessionError : null);

  return (
    <main style={shell}>
      <section style={card} aria-labelledby="axi-login-title">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AxiLogoMark size={28} />
            <h1 id="axi-login-title" style={{ fontSize: 24, fontWeight: 650, color: 'var(--axi-text, #f8fafc)', letterSpacing: '-0.5px', margin: 0 }}>
              Axi WorkBench
            </h1>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255, 255, 255, 0.54)', margin: 0 }}>
            {phase === 'code' || phase === 'verifying'
              ? t('auth.login.subtitle.code')
              : t('auth.login.subtitle.email')}
          </p>
        </div>

        {banner && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              background: 'rgba(255, 77, 79, 0.1)',
              border: '1px solid rgba(255, 77, 79, 0.3)',
              borderRadius: 8,
              color: 'var(--color-chart-4)',
              fontSize: 13,
              marginBottom: 20,
              wordBreak: 'break-word',
            }}
          >
            {banner}
          </div>
        )}

        {hint && !banner && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(64, 169, 255, 0.08)',
              border: '1px solid rgba(64, 169, 255, 0.28)',
              borderRadius: 8,
              color: 'rgba(180, 220, 255, 0.92)',
              fontSize: 12,
              marginBottom: 18,
              lineHeight: 1.6,
            }}
          >
            {hint}
          </div>
        )}

        {phase === 'email' && (
          <form onSubmit={handleRequestCode} noValidate>
            <label
              htmlFor="axi-login-email"
              style={{ display: 'block', fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 6 }}
            >
              {t('auth.email')}
            </label>
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
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            <button
              type="submit"
              disabled={submitting || sessionLoading || !email.trim()}
              style={{
                ...primaryButton,
                opacity: submitting || sessionLoading || !email.trim() ? 0.6 : 1,
                cursor: submitting || sessionLoading || !email.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('auth.login.sending') : t('auth.login.requestCode')}
            </button>
          </form>
        )}

        {(phase === 'code' || phase === 'verifying') && (
          <form onSubmit={handleVerifyCode} noValidate>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <span id="axi-login-code-label">{t('auth.login.codeLabel')}</span>
              <button type="button" onClick={handleChangeEmail} style={linkButton}>
                {t('auth.login.changeEmail')}
              </button>
            </div>
            <OneTimeCodeInput
              ariaLabelledBy="axi-login-code-label"
              disabled={submitting}
              firstInputRef={codeInputRef}
              value={code}
              onChange={setCode}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.55)',
                marginBottom: 16,
              }}
            >
              <span>
                {t('auth.login.sentTo')}{' '}
                <strong style={{ color: 'var(--axi-text, #f8fafc)' }}>{sentTo}</strong>
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || submitting}
                style={{
                  ...linkButton,
                  color: cooldown > 0 ? 'rgba(255, 255, 255, 0.4)' : 'var(--axi-primary)',
                  cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {cooldown > 0 ? `${cooldown}${t('auth.login.resendCooldown')}` : t('auth.login.resend')}
              </button>
            </div>
            {expiresAt && (
              <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', margin: '0 0 16px' }}>
                {t('auth.login.expiresPrefix')}{new Date(expiresAt).toLocaleString()}{t('auth.login.expiresSuffix')}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || oneTimeCodeValue(code).length !== 6}
              style={{
                ...primaryButton,
                opacity: submitting || oneTimeCodeValue(code).length !== 6 ? 0.6 : 1,
                cursor: submitting || oneTimeCodeValue(code).length !== 6 ? 'not-allowed' : 'pointer',
              }}
            >
              {phase === 'verifying' || submitting ? t('auth.login.verifying') : t('auth.signin')}
            </button>
          </form>
        )}

      </section>
    </main>
  );
};

export default Login;
