import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { LoginInput } from '@axi/workstation-contracts';
import { useAuth } from '../contexts/AuthContext';

/**
 * Axi Workbench Web 管理端登录。
 * - 密码：浏览器邮箱密码
 * - 扫码：本会话展示二维码，由移动端或受信设备确认
 * 移动工作台拥有独立应用与自己的登录页，不在此处用 viewport 分支复用页面。
 */

type LoginMode = 'password' | 'qr';
type QrStatus = 'init' | 'ready' | 'scanned' | 'confirmed' | 'expired' | 'error';

interface QrInitResponse {
  qrCodeId: string;
  qrCodePayload: string;
  qrCodeSignature: string;
  expiresAt: number;
  pollIntervalMs: number;
}

interface PollResponse {
  qrCodeId: string;
  status: 'pending' | 'confirmed' | 'consumed' | 'expired';
  user?: { id: string; email: string; name: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number } | null;
}

const TOKEN_KEY = 'epap_auth_token';
const REFRESH_TOKEN_KEY = 'epap_refresh_token';
const USER_KEY = 'epap_user';

function defaultMode(search: URLSearchParams): LoginMode {
  const mode = search.get('mode');
  if (mode === 'qr' || mode === 'password') return mode;
  return 'password';
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';
  const { login, isLoading, error } = useAuth();

  const [mode, setMode] = useState<LoginMode>(() => defaultMode(searchParams));
  const [formData, setFormData] = useState<LoginInput>({ email: '', password: '' });
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});

  // QR state
  const [qrStatus, setQrStatus] = useState<QrStatus>('init');
  const [qrError, setQrError] = useState('');
  const [qrData, setQrData] = useState<QrInitResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    const params = new URLSearchParams(searchParams);
    params.set('mode', nextMode);
    setSearchParams(params, { replace: true });
  }

  // --- password ---
  const validate = (): boolean => {
    const errors: Partial<Record<keyof LoginInput, string>> = {};
    if (!formData.email) errors.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = '邮箱格式不正确';
    if (!formData.password) errors.password = '请输入密码';
    else if (formData.password.length < 8) errors.password = '密码至少 8 位';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await login(formData);
      navigate(next);
    } catch {
      // AuthContext owns error
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name as keyof LoginInput]) {
      setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // --- QR ---
  function stopCountdown() {
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }
  function stopPolling() {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }
  function stopTimers() {
    stopPolling();
    stopCountdown();
  }

  function startCountdown() {
    stopCountdown();
    countdownRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopTimers();
          setQrStatus('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function startPolling(qrId: string, intervalMs: number) {
    stopPolling();
    const tick = async () => {
      try {
        const res = await fetch(`/api/v1/auth/qrcode/${qrId}`);
        if (!res.ok) return;
        const data = (await res.json()) as PollResponse;
        if (data.status === 'confirmed' && data.tokens && data.user) {
          localStorage.setItem(TOKEN_KEY, data.tokens.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, data.tokens.refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          setQrStatus('confirmed');
          stopTimers();
          window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY }));
          setTimeout(() => {
            window.location.href = next;
          }, 800);
          return;
        }
        if (data.status === 'pending') {
          setQrStatus((prev) => (prev === 'ready' ? 'scanned' : prev));
        }
        if (data.status === 'expired') {
          setQrStatus('expired');
          stopTimers();
        }
      } catch {
        // keep polling on network blips
      }
    };
    pollTimerRef.current = window.setInterval(tick, intervalMs);
    void tick();
  }

  async function initQr() {
    stopTimers();
    setQrError('');
    setQrData(null);
    setQrStatus('init');
    try {
      const res = await fetch('/api/v1/auth/qrcode/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 60 }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`init failed: ${res.status} ${body}`);
      }
      const data = (await res.json()) as QrInitResponse;
      setQrData(data);
      setQrStatus('ready');
      setSecondsLeft(Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000)));
      startCountdown();
      startPolling(data.qrCodeId, data.pollIntervalMs);
    } catch (e: unknown) {
      setQrError(e instanceof Error ? e.message : String(e));
      setQrStatus('error');
    }
  }

  useEffect(() => {
    if (mode !== 'qr') {
      stopTimers();
      return;
    }
    void initQr();
    return () => stopTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const qrPayload = qrData
    ? JSON.stringify({ qrCodeId: qrData.qrCodeId, signature: qrData.qrCodeSignature })
    : '';

  const qrStatusText: Record<QrStatus, string> = {
    init: '正在生成二维码...',
    ready: '请使用 Axi 工作台 App 扫描二维码',
    scanned: '已检测到扫码，等待确认...',
    confirmed: '登录成功！正在进入工作台...',
    expired: '二维码已过期',
    error: '发生错误',
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
    padding: '12px 16px',
    fontSize: 14,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: 'var(--color-bg-card)',
    outline: 'none',
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    color: active ? 'var(--color-bg-card)' : 'rgba(255,255,255,0.55)',
    background: active ? 'var(--color-info-antd)' : 'rgba(255,255,255,0.05)',
  });

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: 'var(--color-bg-card)', marginBottom: 8, letterSpacing: '-0.5px' }}>
            Axi 工作台
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }}>
            Web 与移动端同一入口 · 同一会话
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button type="button" style={tabBtn(mode === 'password')} onClick={() => switchMode('password')}>
            邮箱密码
          </button>
          <button type="button" style={tabBtn(mode === 'qr')} onClick={() => switchMode('qr')}>
            扫码登录
          </button>
        </div>

        {mode === 'password' && (
          <>
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 77, 79, 0.1)',
                  border: '1px solid rgba(255, 77, 79, 0.3)',
                  borderRadius: 8,
                  color: 'var(--color-chart-4)',
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="email" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                  邮箱
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  style={{ ...inputStyle, borderColor: validationErrors.email ? 'var(--color-chart-4)' : 'rgba(255,255,255,0.1)' }}
                />
                {validationErrors.email && (
                  <span style={{ fontSize: 12, color: 'var(--color-chart-4)' }}>{validationErrors.email}</span>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="password" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                  密码
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  style={{ ...inputStyle, borderColor: validationErrors.password ? 'var(--color-chart-4)' : 'rgba(255,255,255,0.1)' }}
                />
                {validationErrors.password && (
                  <span style={{ fontSize: 12, color: 'var(--color-chart-4)' }}>{validationErrors.password}</span>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-bg-card)',
                  background: isLoading ? 'rgba(24, 144, 255, 0.6)' : 'var(--color-info-antd)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? '登录中...' : '进入工作台'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              没有账号？{' '}
              <Link to="/register" style={{ color: 'var(--color-info-antd)', textDecoration: 'none', fontWeight: 500 }}>
                注册
              </Link>
            </p>
          </>
        )}

        {mode === 'qr' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: 'var(--color-bg-card)',
                borderRadius: 12,
                marginBottom: 16,
                minWidth: 240,
                minHeight: 240,
              }}
            >
              {qrStatus === 'init' && <div style={{ color: 'var(--color-muted-3)', fontSize: 13 }}>加载中...</div>}
              {qrStatus === 'error' && <div style={{ color: 'var(--color-chart-4)', fontSize: 13, padding: 24 }}>{qrError}</div>}
              {(qrStatus === 'ready' || qrStatus === 'scanned' || qrStatus === 'confirmed' || qrStatus === 'expired') &&
                qrData && (
                  <div style={{ position: 'relative' }}>
                    <QRCodeSVG value={qrPayload} size={208} level="M" bgColor="var(--color-bg-card)" fgColor="var(--color-ink-abs)" />
                    {qrStatus === 'expired' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(255,255,255,0.85)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-chart-4)',
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        已过期
                      </div>
                    )}
                  </div>
                )}
            </div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color:
                  qrStatus === 'confirmed'
                    ? 'var(--color-chart-2)'
                    : qrStatus === 'expired' || qrStatus === 'error'
                      ? 'var(--color-chart-4)'
                      : 'rgba(255,255,255,0.85)',
                marginBottom: 6,
              }}
            >
              {qrStatusText[qrStatus]}
            </p>
            {(qrStatus === 'ready' || qrStatus === 'scanned') && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
                二维码 {secondsLeft}s 后过期
              </p>
            )}
            {(qrStatus === 'expired' || qrStatus === 'error') && (
              <button
                type="button"
                onClick={() => void initQr()}
                style={{
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-bg-card)',
                  background: 'var(--color-info-antd)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                刷新二维码
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
