import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AxiLogoMark } from '@axi/core';
import { useAuth } from '../contexts/AuthContext';

/**
 * Web 管理端的登录入口。邮箱验证、密码、扫码审批都由 Axi Identity 的
 * ZITADEL 登录流程完成；本页不收集密码，也不处理二维码换取 JWT。
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { beginLogin, isAuthenticated, isLoading, error } = useAuth();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/admin/dashboard';

  useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

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
            在 Axi Identity 中完成邮箱验证、密码登录或扫码审批。
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.3)', borderRadius: 8, color: 'var(--color-chart-4)', fontSize: 13, marginBottom: 20 }}>
            无法恢复会话：{error}
          </div>
        )}

        <button
          type="button"
          disabled={isLoading}
          onClick={() => beginLogin(next)}
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--axi-text-inverse, #fff)',
            background: isLoading ? 'color-mix(in srgb, var(--axi-primary) 60%, transparent)' : 'var(--axi-primary)',
            border: 'none',
            borderRadius: 8,
            cursor: isLoading ? 'wait' : 'pointer',
          }}
        >
          {isLoading ? '正在检查会话…' : '使用 Axi 账户继续'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }}>
          需要新建账户？{' '}
          <Link to="/register" style={{ color: 'var(--axi-primary)', textDecoration: 'none', fontWeight: 500 }}>
            前往 Axi Identity 注册
          </Link>
        </p>
      </section>
    </main>
  );
};

export default Login;
