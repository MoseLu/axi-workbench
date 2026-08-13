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

type Phase = 'email' | 'code' | 'verifying';
type DeviceQrStatus = 'creating' | 'waiting_scan' | 'approved' | 'expired' | 'failed';

const RESEND_COOLDOWN_SECONDS = 60;
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

  // 左侧二维码固定存在；phase 只描述右侧邮箱登录的步骤。
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<OneTimeCode | string>(() => createOneTimeCode());
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
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
    if (deviceQr || deviceQrCreatingRef.current) return;
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
  }, [deviceQr]);

  useEffect(() => {
    if (!deviceQr || deviceQrStatus === 'expired' || deviceQrStatus === 'failed') return undefined;

    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await getWebDeviceLoginQrStatus(deviceQr);
        if (cancelled) return;
        if (status.status === 'expired' || status.status === 'consumed') {
          setDeviceQrStatus('expired');
          if (status.status === 'expired') setQrError('二维码已过期，请重新生成。');
          return;
        }
        setDeviceQrStatus(status.status);
        if (status.status !== 'approved' || deviceQrConsumingRef.current) return;

        deviceQrConsumingRef.current = true;
        setQrSubmitting(true);
        try {
          await consumeWebDeviceLoginQr(deviceQr);
          const authenticated = await refreshSession();
          if (!authenticated) throw new Error('电脑会话未建立，请重新生成二维码。');
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
    const interval = window.setInterval(() => void refresh(), 1_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [deviceQr, deviceQrStatus, refreshSession]);

  const resetDeviceQr = () => {
    if (qrSubmitting) return;
    deviceQrConsumingRef.current = false;
    setDeviceQr(null);
    setDeviceQrStatus('creating');
    setQrError(null);
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

  const banner = error || (sessionError && phase === 'verifying' ? sessionError : null);
  const qrStatusLabel: Record<DeviceQrStatus, string> = {
    creating: '正在生成二维码',
    waiting_scan: '等待手机扫码',
    approved: '手机已确认登录',
    expired: '二维码已失效',
    failed: '暂时无法生成二维码',
  };

  return (
    <main className="axi-login-page">
      <div className="axi-login-page__glow axi-login-page__glow--one" aria-hidden="true" />
      <div className="axi-login-page__glow axi-login-page__glow--two" aria-hidden="true" />
      <div className="axi-login-page__grid" aria-hidden="true" />

      <section className="axi-login-card" aria-labelledby="axi-login-title">
        <div className="axi-login-card__body">
          <section className="axi-login-qr-column" id="axi-login-qr-panel" aria-label="扫码登录">
            <h1 id="axi-login-title">扫描二维码登录</h1>
            <div className={`axi-login-qr-frame ${deviceQrStatus === 'failed' || deviceQrStatus === 'expired' ? 'is-error' : ''}`}>
              {deviceQr ? (
                <QRCode
                  aria-label="电脑登录二维码"
                  value={webDeviceLoginQrPayload(deviceQr)}
                  size={176}
                  errorLevel="M"
                  status={deviceQrStatus === 'expired' || deviceQrStatus === 'failed' ? 'expired' : 'active'}
                />
              ) : (
                <div className="axi-login-qr-loading"><span /><span /><span /></div>
              )}
            </div>
            <p className="axi-login-qr-instruction">
              请使用 <strong>Axi WorkBench 手机端</strong><br />
              扫码登录或确认本机登录
            </p>
            <div className="axi-login-qr-status">
              <span className={`axi-login-qr-status__dot is-${deviceQrStatus}`} />
              <strong>{qrStatusLabel[deviceQrStatus]}</strong>
            </div>
            {deviceQr && deviceQrStatus === 'waiting_scan' && (
              <p className="axi-login-qr-meta">有效期至 {new Date(deviceQr.expiresAt * 1000).toLocaleTimeString()}</p>
            )}
            {qrError && <div className="axi-login-qr-alert" role="alert">{qrError}</div>}
            <button className="axi-login-button axi-login-button--quiet" type="button" onClick={resetDeviceQr} disabled={qrSubmitting}>
              重新生成二维码
            </button>
          </section>

          <div className="axi-login-card__divider" aria-hidden="true" />

          <section className="axi-login-right" id="axi-login-email-panel" aria-label="邮箱登录">
            <div className="axi-login-right__tabs" role="tablist" aria-label="登录方式">
              <button
                type="button"
                role="tab"
                aria-selected={false}
                aria-disabled="true"
                disabled
                title="当前环境暂未启用密码登录"
                className="is-disabled"
              >
                密码登录
              </button>
              <span aria-hidden="true">|</span>
              <button type="button" role="tab" aria-selected={true} className="is-active">
                邮箱登录
              </button>
            </div>

            <div className="axi-login-right__body">
              {banner && <div className="axi-login-alert" role="alert">{banner}</div>}
              {hint && !banner && <div className="axi-login-hint">{hint}</div>}

              {phase === 'email' && (
                <form className="axi-login-form" onSubmit={handleRequestCode} noValidate>
                  <h2>邮箱登录</h2>
                  <p className="axi-login-form__description">输入登录邮箱，获取验证码完成登录。</p>
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
            <p className="axi-login-right__hint">首次登录使用邮箱验证码；验证通过后，本机浏览器会保持安全会话。</p>
          </section>
        </div>

        <footer className="axi-login-card__footer">
          <span><AxiLogoMark size={15} /> Axi WorkBench</span>
          <span>安全会话由网关托管</span>
        </footer>
      </section>

      <p className="axi-login-page__footer">Axi WorkBench · 本地开发工作台</p>
    </main>
  );
};

export default Login;
