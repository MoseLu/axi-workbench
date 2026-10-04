import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// 当前本地环境未配置外部 OIDC 身份提供商，不能暴露一个必然失败的注册表单。
// 主动跳转登录页并提示原因；同时渲染悬浮 fallback，避免用户停留在路由切换的中间态。
const Register: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate('/login', { replace: true });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main
      role="status"
      aria-live="polite"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--color-tabbar-dark) 0%, var(--color-login-bg) 100%)', padding: 20 }}
    >
      <section style={{ width: '100%', maxWidth: 420, padding: 32, background: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, color: 'var(--color-bg-card)', margin: '0 0 12px' }}>当前未开放独立注册</h1>
        <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.7, margin: '0 0 24px' }}>
          本环境未接入外部身份提供商。请使用邮箱验证码或扫码登录，正为您跳转到登录页……
        </p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            padding: '10px 22px',
            borderRadius: 8,
            background: 'var(--color-info-antd, #1677ff)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          立即前往登录
        </Link>
      </section>
    </main>
  );
};

export default Register;
