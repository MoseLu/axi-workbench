/**
 * Web 登录入口。
 *
 * 视觉结构采用紧凑客户端登录卡：扫码入口收进左上角二维码角标，
 * 账号入口内部只保留轻量的密码/邮箱方式切换，不让两类表单同时占据画布。
 *
 * 拆分后本文件只负责编排：
 *  - _hooks/*   ：登录表单控制器、扫码流程、最近账号探测、桌面本机运行时门禁；
 *  - _components/*：一键登录面板、二维码面板、账号面板（含密码/邮箱码表单）。
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import {
  closeLoginWindow,
  emitShellLoginSuccess,
  getShellWindowLabel,
  isTauriShell,
} from '../../lib/shell';
import { useLoginForm } from './_hooks/useLoginForm';
import { useLocalRuntime } from './_hooks/useLocalRuntime';
import { useDeviceQrLogin } from './_hooks/useDeviceQrLogin';
import { useQuickAccount } from './_hooks/useQuickAccount';
import type { LoginSurface } from './_hooks/types';
import QuickLoginPanel from './_components/QuickLoginPanel';
import QrLoginPanel from './_components/QrLoginPanel';
import AccountLoginPanel from './_components/AccountLoginPanel';
import '../Login.css';
// /login is the first paint for unauthenticated users; main.tsx no longer
// carries the @axi/* stylesheets. Pull @axi/widgets explicitly because
// Login renders `<AxiBanner />` before any layout component mounts.
import '@axi/widgets/styles.css';

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

  const [loginSurface, setLoginSurface] = useState<LoginSurface>('account');
  const otherMethodsRef = useRef(false);
  const formLoginRef = useRef(false);
  const didNavigateRef = useRef(false);

  const { quickAccount, setQuickAccount } = useQuickAccount({
    user,
    setLoginSurface,
    otherMethodsRef,
    formLoginRef,
  });
  const {
    blocked: localRuntimeBlocked,
    status: localRuntimeStatus,
    retry: handleLocalRuntimeRetry,
  } = useLocalRuntime();
  const {
    deviceQr,
    status: deviceQrStatus,
    error: qrError,
    refresh: refreshDeviceQr,
  } = useDeviceQrLogin(refreshSession);

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
    // A browser refresh can land on /login while the HttpOnly session is still
    // valid. That is already an authenticated entry, so it must not wait for a
    // new form submit to leave the login surface.
    if (
      isAuthenticated
      && !didNavigateRef.current
      && (!isTauriShell() || formLoginRef.current)
    ) {
      finishAuthenticatedEntry();
    }
  }, [isAuthenticated, navigate, next]);

  const form = useLoginForm({
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
  });

  const handleLoginSurfaceChange = (surface: LoginSurface) => {
    setLoginSurface(surface);
    form.clearFeedback();
  };

  const banner = form.error
    || (sessionError && (form.phase === 'verifying' || form.loginMode === 'password') ? sessionError : null);
  const appName = t('app.name');
  const runtimeStatusLabel = localRuntimeStatus?.phase === 'failed'
    ? t('auth.login.localRuntimeFailed')
    : t('auth.login.localRuntimeStarting');

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
        <div className={`axi-login-card__body${loginSurface === 'quick' ? ' is-quick' : loginSurface === 'account' ? ' is-account' : ''}`}>
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
              <QuickLoginPanel
                appName={appName}
                quickAccount={quickAccount}
                agreedToTerms={form.agreedToTerms}
                showAgreeHint={form.showAgreeHint}
                submitting={form.submitting}
                sessionLoading={sessionLoading}
                t={t}
                onAgreedChange={form.handleAgreedChange}
                onQuickLogin={() => void form.handleQuickLogin()}
                onOpenOtherMethods={form.openOtherMethods}
              />
            ) : null}
            {loginSurface !== 'quick' ? (
            <div className="axi-login-brand" aria-label={appName}>
              <img src="/apple-touch-icon.png" alt="" aria-hidden="true" />
              <span>{appName}</span>
            </div>
            ) : null}
            {loginSurface === 'qr' ? (
              <QrLoginPanel
                appName={appName}
                qrLoginLabel={t('auth.login.qrLogin')}
                scanTitle={t('auth.login.scanTitle')}
                useAccountLabel={t('auth.login.useAccount')}
                deviceQr={deviceQr}
                deviceQrStatus={deviceQrStatus}
                qrError={qrError}
                onRefresh={refreshDeviceQr}
                onUseAccount={() => handleLoginSurfaceChange('account')}
              />
            ) : loginSurface === 'account' ? (
              <AccountLoginPanel form={form} banner={banner} t={t} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
