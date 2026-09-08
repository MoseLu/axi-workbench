import { useAuth } from '@axi/workbench-foundation';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { AxiLogoMark } from '@axi/core';
import { useMobileI18n } from '../i18n';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resendCooldownSeconds = 60;

/** 独立移动端登录页；仅消费网关的挑战绑定邮箱验证码，不继承桌面 OIDC 壳层。 */
export default function LoginPage() {
  const { isAuthenticated, isLoading, error, requestEmailCode, confirmEmailCode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const requestedDestination = new URLSearchParams(location.search).get('next');
  const destination = requestedDestination && requestedDestination.startsWith('/') && !requestedDestination.startsWith('//')
    ? requestedDestination
    : '/home';

  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate(destination, { replace: true });
  }, [destination, isAuthenticated, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (phase === 'code') codeRef.current?.focus();
  }, [phase]);

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!emailPattern.test(value)) {
      setLocalError('请输入合法的邮箱地址');
      return;
    }
    setLocalError(null);
    setHint(null);
    try {
      const response = await requestEmailCode(value);
      setEmail(value);
      setSentTo(value);
      setChallengeId(response.challengeId);
      setCode('');
      setCooldown(resendCooldownSeconds);
      setPhase('code');
      setHint('验证码已发送，请查收邮箱（QQ 邮箱可能在垃圾邮件中）。');
    } catch {
      // AuthProvider exposes a redacted human-readable error.
    }
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setLocalError('请输入 6 位数字验证码');
      return;
    }
    setLocalError(null);
    await confirmEmailCode(challengeId, code);
  };

  const resendCode = async () => {
    if (cooldown > 0 || !sentTo) return;
    setLocalError(null);
    try {
      const response = await requestEmailCode(sentTo);
      setChallengeId(response.challengeId);
      setCode('');
      setCooldown(resendCooldownSeconds);
      setHint('新的验证码已发送。');
    } catch {
      // AuthProvider exposes the error.
    }
  };

  const banner = localError || error;

  return (
    <main className="axi-mobile-login">
      <div className="axi-mobile-login__brand"><AxiLogoMark size={34} /><span>{t('app.name')}</span></div>
      <div className="axi-mobile-login__copy">
        <p>{t('login.eyebrow')}</p>
        <h1>{t('login.title')}</h1>
        <small>{t('login.hint')}</small>
      </div>
      <section className="axi-mobile-login__form" aria-label="Axi Identity 登录">
        {banner && <p className="axi-mobile-login__error" role="alert">{banner}</p>}
        {hint && !banner && <p className="axi-mobile-login__hint" role="status">{hint}</p>}
        {phase === 'email' ? (
          <form onSubmit={(event) => void requestCode(event)} noValidate>
            <label htmlFor="mobile-login-email">邮箱</label>
            <input id="mobile-login-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={isLoading} />
            <button type="submit" disabled={isLoading || !email.trim()}>{isLoading ? '正在发送…' : t('login.emailCode')}</button>
          </form>
        ) : (
          <form onSubmit={(event) => void verifyCode(event)} noValidate>
            <label htmlFor="mobile-login-code">验证码</label>
            <input ref={codeRef} id="mobile-login-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" disabled={isLoading} />
            <p className="axi-mobile-login__hint">已发送至 {sentTo}</p>
            <button type="submit" disabled={isLoading || code.length !== 6}>{isLoading ? '正在验证…' : '登录'}</button>
            <div className="axi-mobile-login__code-actions">
              <button type="button" className="axi-mobile-login__secondary" onClick={() => { setPhase('email'); setCode(''); setLocalError(null); }} disabled={isLoading}>换一个邮箱</button>
              <button type="button" className="axi-mobile-login__secondary" onClick={() => void resendCode()} disabled={isLoading || cooldown > 0}>{cooldown > 0 ? `${cooldown}s 后重发` : '重新发送'}</button>
            </div>
          </form>
        )}
        <a className="axi-mobile-login__link" href="/login/confirm-web">已登录？确认网页登录</a>
      </section>
    </main>
  );
}
