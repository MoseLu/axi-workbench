import React from 'react';
import { Link } from 'react-router-dom';

// 当前本地环境未配置外部 OIDC 身份提供商，不能暴露一个必然失败的跳转。
const Register: React.FC = () => {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--color-tabbar-dark) 0%, var(--color-login-bg) 100%)', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 400, padding: 40, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.06)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, color: 'var(--color-bg-card)', margin: '0 0 12px' }}>使用邮箱验证码登录</h1>
        <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.56)', lineHeight: 1.7, margin: '0 0 28px' }}>
          当前环境未配置外部身份提供商。请输入邮箱获取验证码后登录。
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }}>
          <Link to="/login" style={{ color: 'var(--color-info-antd)' }}>返回登录</Link>
        </p>
      </section>
    </main>
  );
};

export default Register;
